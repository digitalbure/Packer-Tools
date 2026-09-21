import { dbAdmin } from "../firebaseAdmin";

/**
 * Server-side port of src/lib/featureUtils.ts isFeatureEnabled (the legacy plan-name fallbacks there never
 * cover kiosk features, so they are omitted). Keep the two in step.
 */
export function featureEnabled(feature: string, user: Record<string, any> | undefined, adminSettings: Record<string, any> | undefined): boolean {
  if (!adminSettings || !user) return false;
  if (adminSettings.globalFeatures && adminSettings.globalFeatures[feature] === false) return false;
  if (adminSettings.betaFeatures?.[feature] === true && user.isSuperAdmin !== true && user.isBetaTester !== true) return false;
  if (user.isSuperAdmin === true) return true;
  if (Array.isArray(user.disabledFeatures) && user.disabledFeatures.includes(feature)) return false;
  if (Array.isArray(user.enabledFeatures) && user.enabledFeatures.includes(feature)) return true;
  const plan = Array.isArray(adminSettings.plans) ? adminSettings.plans.find((p: any) => p.id === user.plan) : undefined;
  return !!plan && Array.isArray(plan.features) && plan.features.includes(feature);
}

const cache = new Map<string, { ok: boolean; until: number }>();

/** Cached (60s) so a downgrade takes effect within a minute without a Firestore read per scan. */
export async function ownerHasFeature(ownerUid: string, feature: string): Promise<boolean> {
  const key = `${ownerUid}:${feature}`;
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.ok;
  const [userSnap, settingsSnap] = await Promise.all([
    dbAdmin.collection("users").doc(ownerUid).get(),
    dbAdmin.collection("adminSettings").doc("global").get(),
  ]);
  const ok = featureEnabled(feature, userSnap.data(), settingsSnap.data());
  cache.set(key, { ok, until: Date.now() + 60_000 });
  if (cache.size > 5000) cache.clear();
  return ok;
}

export function clearEntitlementCache() { cache.clear(); }
