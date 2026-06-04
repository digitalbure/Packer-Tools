import React, { createContext, useContext, useMemo } from 'react';
import { UserProfile, AdminSettings, INDUSTRIES } from '../types';

export interface CustomTerms {
  gearLabelSingular: string;
  gearLabelPlural: string;
  listLabelSingular: string;
  listLabelPlural: string;
  description: string;
  icon: string;
  name: string;
}

interface IndustryContextProps {
  activeIndustry: string;
  customTerms: CustomTerms;
  currentWorkspace: any;
  isConstruction: boolean;
  isAutomotive: boolean;
  isOutdoors: boolean;
  getAdjustedLabel: (key: 'library' | 'lists' | 'racks' | 'logistics' | 'inventory' | 'systems-builder' | 'packing-lists' | 'templates') => string;
  getAdjustedNav: <T extends { to: string }>(items: T[]) => T[];
}

const IndustryContext = createContext<IndustryContextProps | undefined>(undefined);

export function useIndustry() {
  const context = useContext(IndustryContext);
  if (!context) {
    throw new Error('useIndustry must be used within an IndustryProvider');
  }
  return context;
}

interface IndustryProviderProps {
  user: UserProfile | null;
  adminSettings: AdminSettings | null;
  children: React.ReactNode;
}

export function IndustryProvider({ user, adminSettings, children }: IndustryProviderProps) {
  const currentWorkspace = useMemo(() => {
    if (!user?.workspaces || user.workspaces.length === 0) return null;
    return user.workspaces.find((w: any) => w.id === user.activeWorkspaceId) || user.workspaces[0];
  }, [user?.workspaces, user?.activeWorkspaceId]);

  const activeIndustry = useMemo(() => {
    return currentWorkspace?.industry || user?.selectedIndustry || 'general';
  }, [currentWorkspace, user?.selectedIndustry]);

  const isConstruction = activeIndustry === 'construction';
  const isAutomotive = activeIndustry === 'car_rental';
  const isOutdoors = activeIndustry === 'outdoors';

  const customTerms = useMemo(() => {
    const defaultTerm = INDUSTRIES.find(ind => ind.id === activeIndustry) || INDUSTRIES[INDUSTRIES.length - 1];
    const adminTerm = adminSettings?.multiIndustryConfig?.customTerms?.[activeIndustry];
    return {
      gearLabelSingular: adminTerm?.gearLabelSingular || defaultTerm.gearLabelSingular,
      gearLabelPlural: adminTerm?.gearLabelPlural || defaultTerm.gearLabelPlural,
      listLabelSingular: adminTerm?.listLabelSingular || defaultTerm.listLabelSingular,
      listLabelPlural: adminTerm?.listLabelPlural || defaultTerm.listLabelPlural,
      description: adminTerm?.description || defaultTerm.description,
      icon: defaultTerm.icon,
      name: defaultTerm.name
    };
  }, [activeIndustry, adminSettings?.multiIndustryConfig?.customTerms]);

  // Adjusts general labels for specialized views
  const getAdjustedLabel = (key: 'library' | 'lists' | 'racks' | 'logistics' | 'inventory' | 'systems-builder' | 'packing-lists' | 'templates') => {
    if (isConstruction) {
      switch (key) {
        case 'library': return customTerms.gearLabelPlural; // e.g. "Tools & Equipment"
        case 'lists': return customTerms.listLabelPlural; // e.g. "Job Site Manifests"
        case 'packing-lists': return 'Site Manifest Lists';
        case 'templates': return 'Site Checklists (Templates)';
        case 'racks': return 'Depot Storage Chests';
        case 'logistics': return 'Heavy Freight Logistics';
        case 'inventory': return 'Inspected Safety Stock';
        case 'systems-builder': return 'Rig Assembly Systems';
        default: break;
      }
    }

    if (isAutomotive) {
      switch (key) {
        case 'library': return customTerms.gearLabelPlural; // e.g. "Vehicles & Cars"
        case 'lists': return customTerms.listLabelPlural; // e.g. "Vehicle Bookings"
        case 'packing-lists': return 'Fleet Active Bookings';
        case 'templates': return 'Booking Preset Checklists';
        case 'racks': return 'Garage Slot Tracker';
        case 'logistics': return 'Automotive Dispatch Route';
        case 'inventory': return 'Fleet Mileage & Intake';
        case 'systems-builder': return 'Vehicle Configuration';
        default: break;
      }
    }

    if (isOutdoors) {
      switch (key) {
        case 'library': return customTerms.gearLabelPlural; // "Adventure & Outdoors Gear"
        case 'lists': return customTerms.listLabelPlural; // "Expedition Packing Lists"
        case 'packing-lists': return 'Expedition Trip Lists';
        case 'templates': return 'Expedition Presets';
        case 'racks': return 'Locker Rack Rooms';
        case 'logistics': return 'Trail & Water Dispatch Routing';
        case 'inventory': return 'Outdoors Field Intake Logs';
        case 'systems-builder': return 'Survival Load Configurer';
        default: break;
      }
    }

    // Default translation using custom terms where available or sensible fallbacks
    switch (key) {
      case 'library': return customTerms.gearLabelPlural;
      case 'lists': return customTerms.listLabelPlural;
      case 'packing-lists': return 'Packing Lists';
      case 'templates': return 'Templates';
      case 'racks': return 'Rack Management';
      case 'logistics': return 'Logistics';
      case 'inventory': return 'Asset Inventory';
      case 'systems-builder': return 'Systems Builder';
    }
  };

  // Dynamically filters and reorders nav links based on selected industry category
  const getAdjustedNav = <T extends { to: string }>(items: T[]): T[] => {
    if (isConstruction) {
      const prioritized = ['/library', '/lists', '/racks', '/logistics', '/inventory', '/systems-builder'];
      return [...items].sort((a, b) => {
        const idxA = prioritized.indexOf(a.to);
        const idxB = prioritized.indexOf(b.to);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });
    }

    if (isAutomotive) {
      const prioritized = ['/library', '/lists', '/inventory', '/logistics', '/racks', '/systems-builder'];
      return [...items].sort((a, b) => {
        const idxA = prioritized.indexOf(a.to);
        const idxB = prioritized.indexOf(b.to);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });
    }

    if (isOutdoors) {
      const prioritized = ['/library', '/lists', '/inventory', '/systems-builder', '/logistics', '/racks'];
      return [...items].sort((a, b) => {
        const idxA = prioritized.indexOf(a.to);
        const idxB = prioritized.indexOf(b.to);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });
    }

    return items;
  };

  const contextValue = useMemo(() => ({
    activeIndustry,
    customTerms,
    currentWorkspace,
    isConstruction,
    isAutomotive,
    isOutdoors,
    getAdjustedLabel,
    getAdjustedNav,
  }), [activeIndustry, customTerms, currentWorkspace, isConstruction, isAutomotive, isOutdoors]);

  return (
    <IndustryContext.Provider value={contextValue}>
      {children}
    </IndustryContext.Provider>
  );
}
