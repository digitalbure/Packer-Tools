export type PickupMode = 'off' | 'platform' | 'owners';

export interface PickupPoint {
  id: string;
  name: string;
  address: string;
  city?: string;
  notes?: string;
}

export interface PickupConfig {
  /** off: no pickup planner. platform: only points the platform lists. owners: owners list their own. */
  mode: PickupMode;
  /** In owners mode, also offer the platform's points. */
  includePlatformPoints: boolean;
  /** Let the renter type a custom address instead of choosing a point. */
  allowCustomAddress: boolean;
  maxOwnerPoints: number;
  platformPoints: PickupPoint[];
}

export const DEFAULT_PICKUP_CONFIG: PickupConfig = {
  mode: 'platform',
  includePlatformPoints: true,
  allowCustomAddress: true,
  maxOwnerPoints: 10,
  platformPoints: [],
};

export interface ResolvedPoint extends PickupPoint {
  source: 'platform' | 'owner';
}

export interface ResolvedPickup {
  enabled: boolean;
  points: ResolvedPoint[];
  allowCustom: boolean;
}

export function normalizeConfig(raw?: Partial<PickupConfig> | null): PickupConfig {
  const c = { ...DEFAULT_PICKUP_CONFIG, ...(raw || {}) };
  if (!['off', 'platform', 'owners'].includes(c.mode)) c.mode = 'platform';
  c.platformPoints = Array.isArray(c.platformPoints) ? c.platformPoints.filter((p) => p && p.id && p.name) : [];
  c.maxOwnerPoints = Math.max(0, Math.floor(Number(c.maxOwnerPoints) || 0));
  return c;
}

/** What a renter is offered on one listing. `ownerQualifies` is whether the owner's plan includes own points. */
export function resolvePickupPoints(rawConfig: Partial<PickupConfig> | null | undefined, ownerPoints: PickupPoint[], ownerQualifies: boolean): ResolvedPickup {
  const cfg = normalizeConfig(rawConfig);
  if (cfg.mode === 'off') return { enabled: false, points: [], allowCustom: false };
  const platform: ResolvedPoint[] = cfg.platformPoints.map((p) => ({ ...p, source: 'platform' }));
  let points: ResolvedPoint[] = [];
  if (cfg.mode === 'platform') {
    points = platform;
  } else {
    const own: ResolvedPoint[] = ownerQualifies ? ownerPoints.slice(0, cfg.maxOwnerPoints).map((p) => ({ ...p, source: 'owner' })) : [];
    points = cfg.includePlatformPoints ? [...own, ...platform] : own;
  }
  const allowCustom = cfg.allowCustomAddress;
  return { enabled: points.length > 0 || allowCustom, points, allowCustom };
}

/** Whether a signed-in owner may add and edit their own points. */
export function canManageOwnPoints(rawConfig: Partial<PickupConfig> | null | undefined, planIncludesFeature: boolean): boolean {
  return normalizeConfig(rawConfig).mode === 'owners' && planIncludesFeature;
}
