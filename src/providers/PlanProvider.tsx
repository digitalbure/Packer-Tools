import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthProvider';
import { Plan, FeatureKey } from '../types';
import { isFeatureEnabled } from '../lib/featureUtils';

interface PlanContextType {
  plan: Plan | null;
  isPro: boolean;
  isEnterprise: boolean;
  isFeatureEnabled: (feature: FeatureKey) => boolean;
}

const PlanContext = createContext<PlanContextType | undefined>(undefined);

export const PlanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, adminSettings } = useAuth();

  const plan = useMemo(() => {
    if (!user || !adminSettings || !adminSettings.plans) return null;
    return adminSettings.plans.find(p => p.id === user.plan) || null;
  }, [user, adminSettings]);

  const isPro = useMemo(() => {
    return user?.plan === 'pro' || user?.plan === 'enterprise';
  }, [user]);

  const isEnterprise = useMemo(() => {
    return user?.plan === 'enterprise';
  }, [user]);

  const checkFeatureEnabled = (feature: FeatureKey): boolean => {
    return isFeatureEnabled(feature, user, adminSettings);
  };

  return (
    <PlanContext.Provider value={{
      plan,
      isPro,
      isEnterprise,
      isFeatureEnabled: checkFeatureEnabled
    }}>
      {children}
    </PlanContext.Provider>
  );
};

export const usePlan = () => {
  const context = useContext(PlanContext);
  if (!context) {
    throw new Error('usePlan must be used within a PlanProvider');
  }
  return context;
};
