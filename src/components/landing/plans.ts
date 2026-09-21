import type { AdminSettings, FeatureKey, Plan } from '../../types';

/** Live plan data (adminSettings.plans) is the single source of truth for prices, limits, trials and features. */
export function activePlans(settings: AdminSettings | null): Plan[] {
  const plans = (settings?.plans || []).filter(p => p && p.isActive !== false);
  return [...plans].sort((a, b) => Number(a.price) - Number(b.price));
}

/** Name of the cheapest plan that includes a feature, or null when the base plan has it or no plan lists it. */
export function planBadge(feature: FeatureKey | undefined, plans: Plan[]): string | null {
  if (!feature || plans.length === 0) return null;
  const first = plans.find(p => p.features?.includes(feature));
  if (!first || first === plans[0]) return null;
  return first.name;
}

export const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return typeof n === 'number' && isFinite(n) ? n : fallback;
};

export function trialLabel(plan: Plan | undefined): string | null {
  return plan?.trialEnabled && num(plan.trialDays) > 0 ? `${num(plan.trialDays)}-day trial` : null;
}
