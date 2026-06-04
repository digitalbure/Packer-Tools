import { UserProfile, AdminSettings, FeatureKey } from '../types';

export function isFeatureEnabled(
  feature: FeatureKey,
  user: UserProfile | null,
  adminSettings: AdminSettings | null
): boolean {
  if (!adminSettings) return false;

  // 1. Check Global Feature Toggle
  if (adminSettings.globalFeatures && adminSettings.globalFeatures[feature] === false) {
    return false;
  }

  // 2. Check Beta Mode Restriction
  const isBetaOnly = adminSettings.betaFeatures?.[feature] === true;
  if (isBetaOnly) {
    // Only super admins and registered beta testers can run this feature/module
    const isUserSuperAdmin = user?.isSuperAdmin === true;
    const isUserBetaTester = user?.isBetaTester === true;
    if (!isUserSuperAdmin && !isUserBetaTester) {
      return false;
    }
  }

  if (!user) return false;

  // Super admins have access to all features bypass
  if (user.isSuperAdmin) return true;

  // 2. Check User-Specific Overrides
  if (user.disabledFeatures?.includes(feature)) return false;
  if (user.enabledFeatures?.includes(feature)) return true;

  // 3. Check Plan-Based Features
  const userPlan = adminSettings.plans?.find(p => p.id === user.plan);
  if (userPlan && userPlan.features.includes(feature)) {
    return true;
  }

  // 4. Fallback for legacy 'pro' plan if plans are not fully configured
  if (user.plan === 'pro' && ['aiWizard', 'gearLibrary', 'versionHistory', 'branding', 'toolingLists', 'organizer', 'travelCases', 'inventoryManagement'].includes(feature)) {
    return true;
  }

  return false;
}
