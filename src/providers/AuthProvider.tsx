import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, getDocs, query, where, deleteDoc, writeBatch } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, AdminSettings, Plan } from '../types';
import { toast } from 'sonner';
import { privacyPolicyMD, termsOfServiceMD, refundPolicyMD } from '../lib/legalContent';

export interface AuthContextType {
  user: UserProfile | null;
  setUser: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  isInvited: boolean | null;
  setIsInvited: React.Dispatch<React.SetStateAction<boolean | null>>;
  adminSettings: AdminSettings;
  setAdminSettings: React.Dispatch<React.SetStateAction<AdminSettings>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  landingView: string;
  setLandingView: React.Dispatch<React.SetStateAction<string>>;
  showScrollTop: boolean;
  setShowScrollTop: React.Dispatch<React.SetStateAction<boolean>>;
  listsCount: number;
  setListsCount: React.Dispatch<React.SetStateAction<number>>;
  currentHash: string;
  setCurrentHash: React.Dispatch<React.SetStateAction<string>>;
  selectedCommunity: string | null;
  setSelectedCommunity: React.Dispatch<React.SetStateAction<string | null>>;
  isCommunitySelectorOpen: boolean;
  setIsCommunitySelectorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  toggleLayoutTheme: () => Promise<void>;
  isLayoutHidden: boolean;
  selectedCurrency: string;
  setSelectedCurrency: React.Dispatch<React.SetStateAction<string>>;
  convertCurrency: (value: number | undefined | null, from: string | undefined, to?: string) => number;
  formatCurrency: (value: number | undefined | null, from: string | undefined, to?: string) => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function getDefaultAdminSettings(): AdminSettings {
  const defaultPlans: Plan[] = [
    { 
      id: 'free',
      name: 'Free', 
      price: 0, 
      features: ['gearLibrary', 'qrSharing'], 
      aiTokenLimit: 10,
      maxPackingLists: 3,
      maxGearItems: 25,
      maxRacks: 1,
      maxProjects: 0,
      maxContacts: 5,
      maxOrganizations: 1,
      maxDepartments: 1,
      maxTeams: 1,
      maxInventoryItems: 10
    },
    { 
      id: 'pro',
      name: 'Pro', 
      price: 19, 
      annualPrice: 180,
      features: ['aiWizard', 'gearLibrary', 'reminders', 'versionHistory', 'qrSharing', 'toolingLists', 'organizer', 'travelCases', 'logisticsDashboard', 'movingDashboard', 'rackingDashboard', 'marketplace', 'kioskMode', 'inventoryManagement'], 
      aiTokenLimit: 500,
      maxPackingLists: 50,
      maxGearItems: 500,
      maxRacks: 10,
      maxProjects: 5,
      maxContacts: 50,
      maxOrganizations: 5,
      maxDepartments: 20,
      maxTeams: 50,
      maxInventoryItems: 1000,
      trialDays: 14,
      trialEnabled: true
    },
    { 
      id: 'enterprise',
      name: 'Enterprise', 
      price: 99, 
      annualPrice: 948,
      features: ['aiWizard', 'gearLibrary', 'reminders', 'versionHistory', 'branding', 'qrSharing', 'toolingLists', 'organizer', 'travelCases', 'logisticsDashboard', 'movingDashboard', 'rackingDashboard', 'marketplace', 'kioskMode', 'orgManagement', 'departments', 'teams', 'inventoryManagement'], 
      aiTokenLimit: 5000,
      maxPackingLists: 1000,
      maxGearItems: 10000,
      maxRacks: 100,
      maxProjects: 50,
      maxContacts: 500,
      maxOrganizations: 50,
      maxDepartments: 500,
      maxTeams: 1000,
      maxInventoryItems: 100000,
      trialDays: 14,
      trialEnabled: true
    }
  ];

  return {
    plans: defaultPlans,
    globalFeatures: {},
    communities: [
      { id: 'fiji', name: 'Fiji Community', country: 'Fiji', countryCode: 'FJ', currency: 'FJD', flag: '🇫🇯', companyName: 'Packer Tools Fiji', isActive: true },
      { id: 'australia', name: 'Australian Community', country: 'Australia', countryCode: 'AU', currency: 'AUD', flag: '🇦🇺', companyName: 'Packer Tools Australia', isActive: true },
      { id: 'new_zealand', name: 'New Zealand Community', country: 'New Zealand', countryCode: 'NZ', currency: 'NZD', flag: '🇳🇿', companyName: 'Packer Tools New Zealand', isActive: true }
    ],
    branding: {
      primaryColor: '#F27D26',
      logo: ''
    },
    frontPageCopy: 'Professional Gear Management for the Modern Pro.',
    landingPage: {
      header: { logoText: 'Packer Tools', links: [] },
      hero: {
        title: 'Visual Inventory. Smarter Logistics.',
        subtitle: 'Industrial Grade Gear Tracking',
        description: 'Professional-grade lifecycle management for high-stakes equipment. Visual verification, asset tracking, and integrated team logistics.',
        primaryButtonText: 'Get Started',
        secondaryButtonText: 'Explore Use Cases',
        isEnabled: true
      },
      ticker: {
        title: 'Used By',
        pairs: [
          { by: "Production Crews", for: "Camera Kit Labeling" },
          { by: "Logistics Teams", for: "Team Kit Distribution" },
          { by: "Mountaineers", for: "Expedition Readiness" },
          { by: "Global Logistics", for: "Asset Accountability" },
          { by: "Rental Houses", for: "Lifecycle Management" },
          { by: "Hikers & Backpackers", for: "Trail Weight Optimization" },
          { by: "Touring Artists", for: "Backstage Inventory" },
          { by: "Field Engineers", for: "Tooling Deployment" }
        ],
        isEnabled: true
      },
      features: {
        title: 'Built for the Field',
        description: "We've engineered a system that thrives in high-pressure environments. From remote expeditions to back-to-back production schedules.",
        items: [
          { title: 'Visual Verification', description: 'Every item is tracked with high-resolution photos for instant identification.', icon: 'Camera' },
          { title: 'Asset Tagging', description: 'Generate and scan QR codes for rapid inventory audits and tracking.', icon: 'QrCode' },
          { title: 'Marketplace Integration', description: 'List surplus gear for sale or rental with a single click.', icon: 'ShoppingBag' },
          { title: 'Team Distribution', description: 'Deploy kits to team members and track their status in real-time.', icon: 'Truck' }
        ],
        isEnabled: true
      },
      scenarios: {
        title: 'The Standard Across Industries',
        subtitle: 'From independent creators to global logistics teams, Packer Tools provides the infrastructure for visual gear management and versioned workflows.',
        items: [
          { title: "Film Production", image: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&q=80&w=800" },
          { title: "Alpine Expeditions", image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=800" },
          { title: "Tactical Logistics", image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=800" },
          { title: "Extreme Sports", image: "https://images.unsplash.com/photo-1533560904424-a0c61dc306fc?auto=format&fit=crop&q=80&w=800" }
        ],
        isEnabled: true
      },
      stats: {
        items: [
          { label: "Recognition", value: "99.2%" },
          { label: "Active Users", value: "12k+" },
          { label: "Kits Managed", value: "450k" }
        ],
        isEnabled: true
      },
      testimonials: { title: 'Trusted Professionals', subtitle: 'What our users say', items: [], isEnabled: false },
      faq: { title: 'FAQ', subtitle: 'Frequently Asked Questions', items: [], isEnabled: false },
      cta: {
        title: 'Ready to Streamline Your Workflow?',
        description: 'Join thousands of professionals who trust Packer Tools for their critical equipment management.',
        buttonText: 'Get Started Now',
        isEnabled: true
      },
      footer: { copyright: '© 2026 Packer Tools', links: [] }
    },
    billingEnabled: false,
    aiConfig: {
      enabled: true,
      model: 'gemini-3.5-flash',
      monthlyGlobalLimit: 10000,
      currentMonthlyUsage: 0,
      maxTokensPerRequest: 2048,
      cachingEnabled: true,
      smartPackerName: 'Smart Packer'
    },
    kioskConfig: {
      allowManualSearch: true,
      showItemStatus: true,
      requireSignature: false,
      autoLogoutMinutes: 5,
      restrictedStatuses: ['maintenance', 'retired', 'missing']
    },
    integrationConfig: {
      apiEnabled: false,
      wordpressEnabled: false,
      callbackUrlDev: `${window.location.origin}/auth/callback`,
      callbackUrlProd: '',
      paypalClientId: '',
      paddleApiKey: 'mock_paddle_api_key_placeholder_value',
      paddleEnabled: true
    },
    marketplaceRegionConfig: {
      launchCountry: 'Fiji',
      availableCountries: ['Fiji', 'United States', 'Australia', 'New Zealand', 'United Kingdom', 'Canada'],
      restrictToAvailableCountries: false
    },
    marketplaceLandingPageConfig: {
      heroTitle: 'The largest, most trusted camera sharing community',
      heroSubtitle: 'Packer verified marketplace',
      heroDescription: 'Professional visual equipment hire & purchase marketplace. Connecting production crews on Viti Levu and beyond.',
      showPromotions: true,
      bannerATitle: 'Packer Insights',
      bannerASubtitle: 'Get the latest data on which products rented & sold best across major organizations.',
      bannerAButtonText: 'View Report',
      bannerAImage: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=400',
      bannerBTitle: 'Exclusive Student Discounts',
      bannerBSubtitle: 'Are you enrolled in film academy? Enjoy up to a 20% discount as a verified student operator.',
      bannerBButtonText: 'Claim Now',
      bannerBImage: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=300',
      showStaffPicks: true,
      showCategories: true,
      showGuarantees: true,
      requiresEduVerification: true,
      partnerLogosText: 'Members of Packer Network',
      partnerLogosList: ['facebook', 'amazon studios', 'HBO', 'Disney']
    } as any,
    smtp: {
      enabled: false,
      host: '',
      port: 587,
      user: '',
      pass: ''
    }
  };
}

async function migrateDemoDataToUser(fromUid: string, toUid: string) {
  try {
    const fromUserRef = doc(db, 'users', fromUid);
    const toUserRef = doc(db, 'users', toUid);
    
    const fromUserSnap = await getDoc(fromUserRef);
    const fromUserData = fromUserSnap.exists() ? fromUserSnap.data() || {} : {};
    const toUserSnap = await getDoc(toUserRef);
    const toUserData = toUserSnap.exists() ? toUserSnap.data() : {};
    
    const cleanObject = (obj: any): any => {
      const copy = { ...obj };
      Object.keys(copy).forEach(key => {
        if (copy[key] === undefined) {
          delete copy[key];
        } else if (copy[key] && typeof copy[key] === 'object' && !Array.isArray(copy[key]) && !(copy[key] instanceof Date)) {
          copy[key] = cleanObject(copy[key]);
        }
      });
      return copy;
    };

    const orgsCol = collection(db, 'organizations');
    const orgsSnap = await getDocs(orgsCol);
    let migratedOrgId = '';
    if (!orgsSnap.empty) {
      const batch = writeBatch(db);
      let updatedCount = 0;
      for (const d of orgsSnap.docs) {
        const data = d.data();
        if (data.ownerId === fromUid) {
          const orgRef = doc(db, 'organizations', d.id);
          batch.update(orgRef, { ownerId: toUid });
          updatedCount++;
          if (!migratedOrgId) migratedOrgId = d.id;
        } else if (data.ownerId === toUid && !migratedOrgId) {
          migratedOrgId = d.id;
        }
      }
      if (updatedCount > 0) {
        await batch.commit();
        console.log(`[Migration] Updated ownership of ${updatedCount} organizations to ${toUid}`);
      }
    }

    const updatedToUser = {
      ...toUserData,
      orgId: toUserData.orgId || fromUserData.orgId || migratedOrgId || '',
      onboardingCompleted: toUserData.onboardingCompleted !== undefined 
        ? toUserData.onboardingCompleted 
        : (fromUserData.onboardingCompleted || false),
      role: toUserData.role || fromUserData.role || 'owner',
      plan: toUserData.plan && toUserData.plan !== 'free' 
        ? toUserData.plan 
        : (fromUserData.plan || 'free'),
      isSuperAdmin: toUserData.isSuperAdmin !== undefined 
        ? toUserData.isSuperAdmin 
        : (fromUserData.isSuperAdmin || false),
    };
    
    await setDoc(toUserRef, updatedToUser, { merge: true });

    const fromGearCol = collection(db, 'users', fromUid, 'gearLibrary');
    const toGearCol = collection(db, 'users', toUid, 'gearLibrary');
    const gearSnap = await getDocs(fromGearCol);
    
    if (!gearSnap.empty) {
      const batch = writeBatch(db);
      let copiedCount = 0;
      for (const d of gearSnap.docs) {
        const destDocRef = doc(toGearCol, d.id);
        batch.set(destDocRef, cleanObject(d.data()));
        copiedCount++;
      }
      if (copiedCount > 0) {
        await batch.commit();
        console.log(`[Migration] Migrated ${copiedCount} gear items to ${toUid}`);
      }
    }

    const fromContainersCol = collection(db, 'users', fromUid, 'containers');
    const toContainersCol = collection(db, 'users', toUid, 'containers');
    const containersSnap = await getDocs(fromContainersCol);
    
    if (!containersSnap.empty) {
      const batch = writeBatch(db);
      let copiedCount = 0;
      for (const d of containersSnap.docs) {
        const destDocRef = doc(toContainersCol, d.id);
        batch.set(destDocRef, cleanObject(d.data()));
        copiedCount++;
      }
      if (copiedCount > 0) {
        await batch.commit();
        console.log(`[Migration] Migrated ${copiedCount} containers to ${toUid}`);
      }
    }

    const inventoriesCol = collection(db, 'inventories');
    const inventoriesSnap = await getDocs(inventoriesCol);
    if (!inventoriesSnap.empty) {
      const batch = writeBatch(db);
      let updatedCount = 0;
      for (const d of inventoriesSnap.docs) {
        const data = d.data();
        if (data.ownerId === fromUid) {
          const invRef = doc(db, 'inventories', d.id);
          batch.update(invRef, { ownerId: toUid });
          updatedCount++;
        }
      }
      if (updatedCount > 0) {
        await batch.commit();
        console.log(`[Migration] Updated ownership of ${updatedCount} inventories to ${toUid}`);
      }
    }

    const racksCol = collection(db, 'racks');
    const racksSnap = await getDocs(racksCol);
    if (!racksSnap.empty) {
      const batch = writeBatch(db);
      let updatedCount = 0;
      for (const d of racksSnap.docs) {
        const data = d.data();
        if (data.ownerId === fromUid) {
          const rackRef = doc(db, 'racks', d.id);
          batch.update(rackRef, { ownerId: toUid });
          updatedCount++;
        }
      }
      if (updatedCount > 0) {
        await batch.commit();
        console.log(`[Migration] Updated ownership of ${updatedCount} racks to ${toUid}`);
      }
    }

    await deleteDoc(fromUserRef);
    toast.success("Successfully linked and migrated your sandbox organization, inventory, and gear lists to your Google account!");
  } catch (error) {
    console.warn(`[Migration] Soft notice - Failed to migrate demo data:`, error);
  }
}

const EXCHANGE_RATES: { [key: string]: number } = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  AUD: 1.52,
  FJD: 2.25,
  CAD: 1.37,
  NZD: 1.63
};

const SYMBOL_MAP: { [key: string]: string } = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  AUD: 'A$',
  FJD: 'FJ$',
  CAD: 'C$',
  NZD: 'NZ$'
};

const SYMBOL_TO_CODE: { [key: string]: string } = {
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  'A$': 'AUD',
  'FJ$': 'FJD',
  'C$': 'CAD',
  'NZ$': 'NZ$'
};

const normalizeCurrencyCode = (c: string | undefined): string => {
  if (!c) return 'USD';
  const clean = c.trim();
  if (SYMBOL_TO_CODE[clean]) return SYMBOL_TO_CODE[clean];
  if (EXCHANGE_RATES[clean]) return clean;
  const upper = clean.toUpperCase();
  if (EXCHANGE_RATES[upper]) return upper;
  return 'USD';
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedCurrency, setSelectedCurrencyState] = useState<string>(() => {
    const saved = localStorage.getItem("packer_selected_currency");
    if (saved) return saved;
    const commId = localStorage.getItem("packer_selected_community");
    if (commId === 'fiji') return 'FJD';
    if (commId === 'australia') return 'AUD';
    if (commId === 'new_zealand') return 'NZD';
    return 'USD';
  });

  const setSelectedCurrency = (currency: string | ((prev: string) => string)) => {
    setSelectedCurrencyState(prev => {
      const val = typeof currency === 'function' ? currency(prev) : currency;
      localStorage.setItem("packer_selected_currency", val);
      return val;
    });
  };

  const convertCurrency = (value: number | undefined | null, from: string | undefined, to?: string): number => {
    if (value === undefined || value === null) return 0;
    const fromCode = normalizeCurrencyCode(from);
    const toCode = normalizeCurrencyCode(to || selectedCurrency);
    
    if (fromCode === toCode) return value;
    
    const fromRate = EXCHANGE_RATES[fromCode] || 1.0;
    const toRate = EXCHANGE_RATES[toCode] || 1.0;
    
    const valueInUSD = value / fromRate;
    return valueInUSD * toRate;
  };

  const formatCurrency = (value: number | undefined | null, from: string | undefined, to?: string): string => {
    const toCode = normalizeCurrencyCode(to || selectedCurrency);
    const converted = convertCurrency(value, from, toCode);
    const symbol = SYMBOL_MAP[toCode] || '$';
    return `${symbol}${converted.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  const [user, setUser] = useState<UserProfile | null>(null);
  const [isInvited, setIsInvited] = useState<boolean | null>(null);
  const [adminSettings, setAdminSettings] = useState<AdminSettings>(getDefaultAdminSettings());
  const [loading, setLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [landingView, setLandingView] = useState<string>('saas');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [listsCount, setListsCount] = useState(0);
  const [currentHash, setCurrentHash] = useState(window.location.hash);
  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(() => {
    return localStorage.getItem("packer_selected_community");
  });
  const [isCommunitySelectorOpen, setIsCommunitySelectorOpen] = useState(false);

  const hasInitializedSidebarCollapse = useRef(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (user && !hasInitializedSidebarCollapse.current) {
      if (user.layoutPreferences?.sidebarCollapsedInitially) {
        setIsSidebarCollapsed(true);
      } else if (user.layoutPreferences?.sidebarCollapsedInitially === false) {
        setIsSidebarCollapsed(false);
      }
      hasInitializedSidebarCollapse.current = true;
    }
  }, [user]);

  useEffect(() => {
    if (selectedCommunity) {
      let nextCurrency = 'USD';
      if (selectedCommunity === 'fiji') nextCurrency = 'FJD';
      else if (selectedCommunity === 'australia') nextCurrency = 'AUD';
      else if (selectedCommunity === 'new_zealand') nextCurrency = 'NZD';
      setSelectedCurrency(nextCurrency);
    }
  }, [selectedCommunity]);

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    const interval = setInterval(handleHashChange, 250);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
      clearInterval(interval);
    };
  }, []);

  const isLayoutHidden = (currentHash.startsWith('#/kiosk') && currentHash.includes('fullscreen=true')) || currentHash.includes('hideLayout=true') || currentHash.startsWith('#/p/') || currentHash.startsWith('#/gear/');

  useEffect(() => {
    if (!user) return;

    if (user.selectedCommunity) {
      if (localStorage.getItem("packer_selected_community") !== user.selectedCommunity) {
        localStorage.setItem("packer_selected_community", user.selectedCommunity);
        setSelectedCommunity(user.selectedCommunity);
        setIsCommunitySelectorOpen(false);
      }
    } else {
      const localSelected = localStorage.getItem("packer_selected_community");
      if (localSelected && user.onboardingCompleted) {
        setDoc(doc(db, 'users', user.uid), { selectedCommunity: localSelected }, { merge: true })
          .catch(err => console.warn("Failed to sync community local selection to Firestore:", err));
      }
    }

    if (user.onboardingCompleted && !user.selectedCommunity && !localStorage.getItem("packer_selected_community")) {
      const dontShow = localStorage.getItem("packer_dont_show_community_selector") === "true";
      if (!dontShow) {
        setIsCommunitySelectorOpen(true);
      }
    }

    const detectAndCheckLocationShift = async () => {
      try {
        const res = await fetch('https://freeipapi.app/api/json');
        if (res.ok) {
          const data = await res.json();
          const code = data.countryCode;
          if (code) {
            const lastCode = localStorage.getItem('packer_last_known_location_country');
            if (lastCode && lastCode.toUpperCase() !== code.toUpperCase()) {
              console.log(`[Location Routing] Location shifted from ${lastCode} to ${code}`);
              localStorage.setItem('packer_last_known_location_country', code);
              localStorage.removeItem('packer_dont_show_community_selector');
              setIsCommunitySelectorOpen(true);
            } else if (!lastCode) {
              localStorage.setItem('packer_last_known_location_country', code);
            }
          }
        }
      } catch (err) {
        console.warn("[Location Check] Background detection failed:", err);
      }
    };

    detectAndCheckLocationShift();
  }, [user]);

  const toggleLayoutTheme = async () => {
    if (!user) return;
    const newTheme = user.layoutTheme === 'workflow' ? 'standard' : 'workflow';
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { layoutTheme: newTheme }, { merge: true });
      setUser(prev => prev ? { ...prev, layoutTheme: newTheme } : null);
      toast.success(`Switched workspace layout to: ${newTheme === 'workflow' ? 'Resolve Professional Workflow' : 'Standard Sidebar'} Layout!`);
    } catch (err) {
      console.error("Failed to update layout theme:", err);
      setUser(prev => prev ? { ...prev, layoutTheme: newTheme } : null);
    }
  };

  useEffect(() => {
    if (user) {
      const q = query(collection(db, 'packingLists'), where('ownerId', '==', user.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setListsCount(snapshot.size);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'packingLists (count)');
      });
      return () => unsubscribe();
    } else {
      setListsCount(0);
    }
  }, [user]);

  useEffect(() => {
    const initializeDefaults = async () => {
      try {
        const settingsRef = doc(db, 'adminSettings', 'global');
        const settingsSnap = await getDoc(settingsRef);
        if (!settingsSnap.exists()) {
          const defaultPlans: Plan[] = [
            { 
              id: 'free',
              name: 'Free', 
              price: 0, 
              features: ['gearLibrary', 'qrSharing'], 
              aiTokenLimit: 10,
              maxPackingLists: 3,
              maxGearItems: 25,
              maxRacks: 1,
              maxProjects: 0,
              maxContacts: 5,
              maxOrganizations: 1,
              maxDepartments: 1,
              maxTeams: 1,
              maxInventoryItems: 10,
              trialDays: 0,
              trialEnabled: false
            },
            { 
              id: 'pro',
              name: 'Pro', 
              price: 19, 
              annualPrice: 180,
              features: ['aiWizard', 'gearLibrary', 'reminders', 'versionHistory', 'qrSharing', 'toolingLists', 'organizer', 'travelCases', 'logisticsDashboard', 'movingDashboard', 'rackingDashboard', 'marketplace', 'kioskMode', 'inventoryManagement'], 
              aiTokenLimit: 500,
              maxPackingLists: 50,
              maxGearItems: 500,
              maxRacks: 10,
              maxProjects: 5,
              maxContacts: 50,
              maxOrganizations: 5,
              maxDepartments: 20,
              maxTeams: 50,
              maxInventoryItems: 1000,
              trialDays: 14,
              trialEnabled: true
            },
            { 
              id: 'enterprise',
              name: 'Enterprise', 
              price: 99, 
              annualPrice: 948,
              features: ['aiWizard', 'gearLibrary', 'reminders', 'versionHistory', 'branding', 'qrSharing', 'toolingLists', 'organizer', 'travelCases', 'logisticsDashboard', 'movingDashboard', 'rackingDashboard', 'marketplace', 'kioskMode', 'orgManagement', 'departments', 'teams', 'inventoryManagement'], 
              aiTokenLimit: 5000,
              maxPackingLists: 1000,
              maxGearItems: 10000,
              maxRacks: 100,
              maxProjects: 50,
              maxContacts: 500,
              maxOrganizations: 50,
              maxDepartments: 500,
              maxTeams: 1000,
              maxInventoryItems: 100000,
              trialDays: 14,
              trialEnabled: true
            }
          ];
          const defaultSettings: AdminSettings = {
            plans: defaultPlans,
            globalFeatures: {},
            privacyContent: privacyPolicyMD,
            termsContent: termsOfServiceMD,
            branding: {
              primaryColor: '#F27D26',
              logo: '',
              companyName: 'Packer Tools',
              pwaName: 'Packer Tools',
              pwaShortName: 'Packer',
              pwaBgColor: '#0a0a0c',
              pwaThemeColor: '#0a0a0c',
              pwaIcon192Url: '/icon-192.png',
              pwaIcon512Url: '/icon-512.png'
            },
            frontPageCopy: 'Professional Gear Management for the Modern Pro.',
            landingPage: {
              header: { logoText: 'Packer Tools', links: [] },
              hero: {
                title: 'Visual Inventory. Smarter Logistics.',
                subtitle: 'Industrial Grade Gear Tracking',
                description: 'Professional-grade lifecycle management for high-stakes equipment. Visual verification, asset tracking, and integrated team logistics.',
                primaryButtonText: 'Get Started',
                secondaryButtonText: 'Explore Use Cases',
                isEnabled: true
              },
              ticker: {
                title: 'Used By',
                pairs: [
                  { by: "Production Crews", for: "Camera Kit Labeling" },
                  { by: "Logistics Teams", for: "Team Kit Distribution" },
                  { by: "Mountaineers", for: "Expedition Readiness" },
                  { by: "Global Logistics", for: "Asset Accountability" },
                  { by: "Rental Houses", for: "Lifecycle Management" },
                  { by: "Hikers & Backpackers", for: "Trail Weight Optimization" },
                  { by: "Touring Artists", for: "Backstage Inventory" },
                  { by: "Field Engineers", for: "Tooling Deployment" }
                ],
                isEnabled: true
              },
              features: {
                title: 'Built for the Field',
                description: 'We\'ve engineered a system that thrives in high-pressure environments. From remote expeditions to back-to-back production schedules.',
                items: [
                  { title: 'Visual Verification', description: 'Every item is tracked with high-resolution photos for instant identification.', icon: 'Camera' },
                  { title: 'Asset Tagging', description: 'Generate and scan QR codes for rapid inventory audits and tracking.', icon: 'QrCode' },
                  { title: 'Marketplace Integration', description: 'List surplus gear for sale or rental with a single click.', icon: 'ShoppingBag' },
                  { title: 'Team Distribution', description: 'Deploy kits to team members and track their status in real-time.', icon: 'Truck' }
                ],
                isEnabled: true
              },
              scenarios: {
                title: 'The Standard Across Industries',
                subtitle: 'From independent creators to global logistics teams, Packer Tools provides the infrastructure for visual gear management and versioned workflows.',
                items: [
                  { title: "Film Production", image: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&q=80&w=800" },
                  { title: "Alpine Expeditions", image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=800" },
                  { title: "Tactical Logistics", image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=800" },
                  { title: "Extreme Sports", image: "https://images.unsplash.com/photo-1533560904424-a0c61dc306fc?auto=format&fit=crop&q=80&w=800" }
                ],
                isEnabled: true
              },
              stats: {
                items: [
                  { label: "Recognition", value: "99.2%" },
                  { label: "Active Users", value: "12k+" },
                  { label: "Kits Managed", value: "450k" }
                ],
                isEnabled: true
              },
              testimonials: { title: 'Trusted Professionals', subtitle: 'What our users say', items: [], isEnabled: false },
              faq: { title: 'FAQ', subtitle: 'Frequently Asked Questions', items: [], isEnabled: false },
              cta: {
                title: 'Ready to Streamline Your Workflow?',
                description: 'Join thousands of professionals who trust Packer Tools for their critical equipment management.',
                buttonText: 'Get Started Now',
                isEnabled: true
              },
              footer: { copyright: '© 2026 Packer Tools', links: [] }
            },
            billingEnabled: false,
            aiConfig: {
              enabled: true,
              model: 'gemini-3.5-flash',
              monthlyGlobalLimit: 10000,
              currentMonthlyUsage: 0,
              maxTokensPerRequest: 2048,
              cachingEnabled: true,
              smartPackerName: 'Smart Packer'
            },
            kioskConfig: {
              allowManualSearch: true,
              showItemStatus: true,
              requireSignature: false,
              autoLogoutMinutes: 5,
              restrictedStatuses: ['maintenance', 'retired', 'missing']
            },
            integrationConfig: {
              apiEnabled: false,
              wordpressEnabled: false,
              callbackUrlDev: `${window.location.origin}/auth/callback`,
              callbackUrlProd: '',
              paypalClientId: ''
            },
            marketplaceRegionConfig: {
              launchCountry: 'Fiji',
              availableCountries: ['Fiji', 'United States', 'Australia', 'New Zealand', 'United Kingdom', 'Canada'],
              restrictToAvailableCountries: false
            }
          };
          try {
            await setDoc(settingsRef, defaultSettings);
          } catch (writeError) {
            console.warn("Unable to write global settings to Firebase (expected if not signed in as admin):", writeError);
          }
        } else {
          const data = settingsSnap.data() || {};
          if (!data.privacyContent || !data.termsContent || !data.integrationConfig?.paddleApiKey) {
            try {
              const updatedConfig = { ...(data.integrationConfig || {}) };
              if (!updatedConfig.paddleApiKey) {
                updatedConfig.paddleApiKey = 'mock_paddle_api_key_placeholder_value';
                updatedConfig.paddleEnabled = true;
              }
              await setDoc(settingsRef, {
                privacyContent: data.privacyContent || privacyPolicyMD,
                termsContent: data.termsContent || termsOfServiceMD,
                integrationConfig: updatedConfig
              }, { merge: true });
            } catch (err) {
              console.warn("Unable to merge-update settings with privacy/terms/paddle content:", err);
            }
          }
        }

        const nowStr = new Date().toISOString();
        const pagesToSeed = [
          {
            slug: 'privacy-policy',
            title: 'Privacy Policy',
            content: privacyPolicyMD,
            category: 'policy' as const,
            status: 'published' as const,
            isVisible: true,
            createdAt: nowStr,
            updatedAt: nowStr,
            lastUpdatedBy: 'system'
          },
          {
            slug: 'terms-of-service',
            title: 'Terms of Service',
            content: termsOfServiceMD,
            category: 'legal' as const,
            status: 'published' as const,
            isVisible: true,
            createdAt: nowStr,
            updatedAt: nowStr,
            lastUpdatedBy: 'system'
          },
          {
            slug: 'refund-policy',
            title: 'Refund Policy',
            content: refundPolicyMD,
            category: 'legal' as const,
            status: 'published' as const,
            isVisible: true,
            createdAt: nowStr,
            updatedAt: nowStr,
            lastUpdatedBy: 'system'
          }
        ];

        for (const pg of pagesToSeed) {
          try {
            const pageRef = doc(db, 'pages', pg.slug);
            const pageSnap = await getDoc(pageRef);
            if (!pageSnap.exists()) {
              await setDoc(pageRef, pg);
              console.log(`[Seeding] Custom Page created successfully: /pg/${pg.slug}`);
            }
          } catch (err) {
            console.warn(`[Seeding] Custom page seeding failed for slug ${pg.slug}:`, err);
          }
        }
      } catch (error) {
        console.warn("Soft initialization notice:", error);
      }
    };

    initializeDefaults();

    let unsubscribeUser: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let isSuperAdminClaim = false;
        try {
          const idTokenResult = await firebaseUser.getIdTokenResult();
          isSuperAdminClaim = idTokenResult.claims.role === 'superAdmin';
        } catch (claimsError) {
          console.warn("[Auth] Failed to retrieve Custom Claims:", claimsError);
        }

        const userEmail = (firebaseUser.email || '').toLowerCase().trim();
        if (userEmail) {
          try {
            const inviteSnap = await getDoc(doc(db, 'betaInvitations', userEmail));
            setIsInvited(inviteSnap.exists());
          } catch (e) {
            console.warn("[Beta] Invite lookup query failed:", e);
            setIsInvited(false);
          }
        } else {
          setIsInvited(false);
        }

        (async () => {
          try {
            const [demoOrgs, demoGear, demoInvs] = await Promise.all([
              getDocs(query(collection(db, 'organizations'), where('ownerId', '==', 'demo-super-admin'))),
              getDocs(collection(db, 'users', 'demo-super-admin', 'gearLibrary')),
              getDocs(query(collection(db, 'inventories'), where('ownerId', '==', 'demo-super-admin')))
            ]);
            
            if (!demoOrgs.empty || !demoGear.empty || !demoInvs.empty) {
              await migrateDemoDataToUser('demo-super-admin', firebaseUser.uid);
            }
          } catch (migrationError) {
            console.warn("Migration check notice:", migrationError);
          }
        })();

        unsubscribeUser = onSnapshot(doc(db, 'users', firebaseUser.uid), async (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data() as UserProfile;
            let updatedUser = { ...userData };
            let hasChanged = false;
            
            if (!userData.orgId) {
              try {
                const orgsSnap = await getDocs(query(collection(db, 'organizations'), where('ownerId', '==', firebaseUser.uid)));
                if (!orgsSnap.empty) {
                  const firstOrgId = orgsSnap.docs[0].id;
                  updatedUser.orgId = firstOrgId;
                  hasChanged = true;
                  console.log(`[Auto-Heal] Successfully linked empty orgId to owned organization: ${firstOrgId}`);
                }
              } catch (healError) {
                console.warn("[Auto-Heal] Failed to auto-associate organization:", healError);
              }
            }

            if (isSuperAdminClaim && !userData.isSuperAdmin) {
              updatedUser.isSuperAdmin = true;
              updatedUser.role = 'owner';
              hasChanged = true;
            }

            if (userEmail && !isSuperAdminClaim) {
              try {
                const inviteSnap = await getDoc(doc(db, 'betaInvitations', userEmail));
                if (inviteSnap.exists() && !userData.betaTrialInitialized) {
                  updatedUser.plan = 'enterprise';
                  updatedUser.trialEnabled = true;
                  updatedUser.trialStartDate = new Date().toISOString();
                  updatedUser.trialEndDate = new Date(Date.now() + 3 * 30 * 24 * 60 * 60 * 1000).toISOString();
                  updatedUser.subscriptionStatus = 'trialing';
                  updatedUser.betaTrialInitialized = true;
                  hasChanged = true;
                  toast.success("Welcome to Packer Tools! Your pre-authorized beta invite has activated a 3-month Trial with full premium access!", { duration: 10000 });
                }
              } catch (trialError) {
                console.warn("[Beta] Automated trial configuration failed:", trialError);
              }
            }

            if (hasChanged) {
              await setDoc(doc(db, 'users', firebaseUser.uid), updatedUser);
              setUser(updatedUser);
            } else {
              setUser(userData);
            }
          } else {
            let initialOrgId = '';
            try {
              const orgsSnap = await getDocs(query(collection(db, 'organizations'), where('ownerId', '==', firebaseUser.uid)));
              if (!orgsSnap.empty) {
                initialOrgId = orgsSnap.docs[0].id;
              }
            } catch (initialMatchError) {
              console.warn("[Auto-Heal] Initial org match soft error:", initialMatchError);
            }

            let isInvitedGuest = false;
            if (userEmail) {
              try {
                const inviteSnap = await getDoc(doc(db, 'betaInvitations', userEmail));
                isInvitedGuest = inviteSnap.exists();
              } catch (e) {
                console.warn("[Beta] Invite lookup query failed on registration:", e);
              }
            }

            const newUser: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'User',
              photoURL: firebaseUser.photoURL || '',
              orgId: initialOrgId,
              plan: isInvitedGuest ? 'enterprise' : 'free',
              isSuperAdmin: isSuperAdminClaim,
              role: isSuperAdminClaim ? 'owner' : 'viewer',
              createdAt: new Date().toISOString(),
            };
            if (isInvitedGuest) {
              newUser.trialEnabled = true;
              newUser.trialStartDate = new Date().toISOString();
              newUser.trialEndDate = new Date(Date.now() + 3 * 30 * 24 * 60 * 60 * 1000).toISOString();
              newUser.subscriptionStatus = 'trialing';
              newUser.betaTrialInitialized = true;
            }
            await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
            setUser(newUser);
          }
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          setLoading(false);
        });
      } else {
        if (unsubscribeUser) unsubscribeUser();
        setIsInvited(null);
        if (localStorage.getItem('packer_demo_bypass') === 'true') {
          const fakeUser: UserProfile = {
            uid: 'demo-super-admin',
            email: 'admin@packer.tools',
            displayName: 'Demo Super Admin',
            photoURL: '',
            plan: 'enterprise',
            isSuperAdmin: true,
            role: 'owner',
            onboardingCompleted: true,
            createdAt: new Date().toISOString(),
          };
          setUser(fakeUser);
          setLoading(false);
        } else {
          setUser(null);
          setLoading(false);
        }
      }
    });

    const unsubscribeSettings = onSnapshot(doc(db, 'adminSettings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        setAdminSettings(docSnap.data() as AdminSettings);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'adminSettings/global');
    });

    return () => {
      unsubscribeAuth();
      unsubscribeSettings();
      if (unsubscribeUser) unsubscribeUser();
    };
  }, []);

  useEffect(() => {
    if (adminSettings?.branding?.faviconUrl) {
      let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = adminSettings.branding.faviconUrl;
    }
  }, [adminSettings?.branding?.faviconUrl]);

  return (
    <AuthContext.Provider value={{
      user, setUser,
      isInvited, setIsInvited,
      adminSettings, setAdminSettings,
      loading, setLoading,
      isSidebarCollapsed, setIsSidebarCollapsed,
      isMobileSidebarOpen, setIsMobileSidebarOpen,
      landingView, setLandingView,
      showScrollTop, setShowScrollTop,
      listsCount, setListsCount,
      currentHash, setCurrentHash,
      selectedCommunity, setSelectedCommunity,
      isCommunitySelectorOpen, setIsCommunitySelectorOpen,
      toggleLayoutTheme,
      isLayoutHidden,
      selectedCurrency,
      setSelectedCurrency,
      convertCurrency,
      formatCurrency
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
