import { dbAdmin } from "../firebaseAdmin";

export interface ServerPlan {
  id: string;
  price: number;
  annualPrice?: number;
  extraSeatCost: number;
  trialDays: number;
  trialEnabled: boolean;
}

const DEFAULT_PLANS: Record<string, ServerPlan> = {
  free: { id: "free", price: 0, extraSeatCost: 0, trialDays: 0, trialEnabled: false },
  pro: { id: "pro", price: 19, annualPrice: 180, extraSeatCost: 10, trialDays: 14, trialEnabled: true },
  enterprise: { id: "enterprise", price: 99, annualPrice: 948, extraSeatCost: 10, trialDays: 14, trialEnabled: true },
};

export const PAID_PLAN_IDS = ["pro", "enterprise"];
export const MAX_EXTRA_SEATS = 500;

const settingsCache: { plans: any[] | null; until: number } = { plans: null, until: 0 };

/** The admin console stores plans (prices, seats, trials, features) in adminSettings/global.plans. Cached 60s. */
async function adminSettingsPlans(): Promise<any[]> {
  if (settingsCache.plans && settingsCache.until > Date.now()) return settingsCache.plans;
  let plans: any[] = [];
  try {
    const data = (await dbAdmin.collection("adminSettings").doc("global").get()).data();
    if (Array.isArray(data?.plans)) plans = data!.plans;
  } catch (e: any) {
    console.error("[Plans] adminSettings lookup failed:", e.message);
  }
  settingsCache.plans = plans;
  settingsCache.until = Date.now() + 60_000;
  return plans;
}

/** Raw plan record (limits such as maxGearItems, feature list, ...) from the same sources as getServerPlan. */
export async function getPlanRecord(planId: string): Promise<Record<string, any> | undefined> {
  const fromSettings = (await adminSettingsPlans()).find((p: any) => p && p.id === planId);
  if (fromSettings) return fromSettings;
  try {
    const snap = await dbAdmin.collection("plans").doc(planId).get();
    return snap.exists ? snap.data() : undefined;
  } catch { return undefined; }
}

export function clearPlanCache() { settingsCache.plans = null; settingsCache.until = 0; }

/**
 * Resolves a plan. Source of truth is adminSettings/global.plans (what the pricing page and admin console use),
 * then the legacy `plans` collection, then built-in defaults. Returns null for unknown plans.
 */
export async function getServerPlan(planId: unknown): Promise<ServerPlan | null> {
  if (typeof planId !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(planId)) return null;
  const base = DEFAULT_PLANS[planId];
  let doc: Record<string, any> | undefined = (await adminSettingsPlans()).find((p: any) => p && p.id === planId);
  if (!doc) {
    try {
      const snap = await dbAdmin.collection("plans").doc(planId).get();
      if (snap.exists) doc = snap.data();
    } catch (e: any) {
      console.error("[Plans] plans collection lookup failed, using defaults:", e.message);
    }
  }
  if (!doc && !base) return null;
  // Values may arrive as numbers or numeric strings depending on how the admin console saved them.
  const num = (v: any, fb: number) => { const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v; return typeof n === "number" && isFinite(n) && n >= 0 ? n : fb; };
  return {
    id: planId,
    price: num(doc?.price, base?.price ?? 0),
    annualPrice: doc?.annualPrice !== undefined && doc?.annualPrice !== null ? num(doc.annualPrice, 0) : base?.annualPrice,
    extraSeatCost: num(doc?.extraSeatCost, base?.extraSeatCost ?? 10),
    trialDays: Math.min(num(doc?.trialDays, base?.trialDays ?? 14), 30),
    trialEnabled: doc?.trialEnabled !== undefined ? !!doc.trialEnabled : (base?.trialEnabled ?? false),
  };
}

export function sanitizeSeats(v: unknown): number {
  const n = Math.floor(Number(v));
  return isFinite(n) && n > 0 ? Math.min(n, MAX_EXTRA_SEATS) : 0;
}

/** Authoritative USD price, mirrors client getPlanPrice. */
export function computePlanPriceUsd(plan: ServerPlan, cycle: "monthly" | "annual", extraSeats: number): number {
  if (plan.price === 0) return 0;
  const annual = cycle === "annual";
  const base = annual ? (plan.annualPrice || plan.price * 12) : plan.price;
  const extra = plan.extraSeatCost * extraSeats * (annual ? 12 : 1);
  return Math.round((base + extra) * 100) / 100;
}
