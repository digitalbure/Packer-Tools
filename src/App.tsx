import { useEffect, useState, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, getDocs, addDoc, query, where, deleteDoc, writeBatch } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { UserProfile } from './types';
import { AnimatePresence, motion } from 'motion/react';

import { Toaster, toast } from 'sonner';

// Components
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import PackingListDetail from './pages/PackingListDetail';
import PackingListBioView from './pages/PackingListBioView';
import CameraScanner from './pages/CameraScanner';
import AdminPanel from './pages/AdminPanel';
import OrganizationModule from './pages/OrganizationModule';
import ProfilePage from './pages/ProfilePage';
import LegalPage from './pages/LegalPage';
import ContactPage from './pages/ContactPage';
import AITemplateWizard from './pages/AITemplateWizard';
import HelpCenter from './pages/HelpCenter';
import GearLibrary from './pages/GearLibrary';
import InventoryModule from './pages/InventoryModule';
import RackingDashboard from './pages/RackingDashboard';
import RackDetail from './pages/RackDetail';
import ProjectDashboard from './pages/ProjectDashboard';
import ProjectDetail from './pages/ProjectDetail';
import SystemsBuilder from './pages/SystemsBuilder';
import TravelCaseModule from './pages/TravelCaseModule';
import OrganizerModule from './pages/OrganizerModule';
import ToolingListModule from './pages/ToolingListModule';
import LogisticsDashboard from './pages/LogisticsDashboard';
import Contacts from './pages/Contacts';
import MarketplaceView from './pages/MarketplaceView';
import Marketplace from './pages/Marketplace';
import PagesManager from './pages/PagesManager';
import PageViewer from './pages/PageViewer';
import KioskMode from './pages/KioskMode';
import ListingsModule from './pages/ListingsModule';
import GearBioPage from './pages/GearBioPage';
import ShopPage from './pages/ShopPage';
import ScenarioBuilder from './pages/ScenarioBuilder';
import TravellerModule from './pages/TravellerModule';
import ErrorBoundary from './components/ErrorBoundary';
import AddGearModal from './components/AddGearModal';
import { IndustryProvider } from './context/IndustryContext';
import { ThemeProvider } from './context/ThemeContext';
import AuthGate from './components/AuthGate';
import QuickActionsDrawer from './components/QuickActionsDrawer';
import Onboarding from './components/Onboarding';
import DukeyAssistant from './components/DukeyAssistant';
import Footer from './components/Footer';
import CommunitySelector from './components/CommunitySelector';
import { AdminSettings, Plan } from './types';
import { isFeatureEnabled } from './lib/featureUtils';

function AnimatedRoutes({ user, setUser, adminSettings, onMenuClick, selectedCommunity, landingView, setLandingView }: { 
  user: UserProfile | null, 
  setUser: (user: UserProfile | null) => void, 
  adminSettings: AdminSettings | null,
  onMenuClick: () => void,
  selectedCommunity?: string | null,
  landingView?: string,
  setLandingView?: (view: string) => void
}) {
  const location = useLocation();

  useEffect(() => {
    const pathHumanMap: { [key: string]: string } = {
      "/dashboard": "Dashboard Home",
      "/organization": "Organization Hub",
      "/profile": "User Profile Page",
      "/kiosk": "Kiosk Scanning Interface",
      "/ai-wizard": "AI Template Generator",
      "/library": "Gear Master Library",
      "/racks": "Physical Racks & Racking Dashboard",
      "/projects": "Project Coordinates & Briefs",
      "/tooling": "Tooling Assets & Custom lists",
      "/organizer": "Bulk Case Organizer Module",
      "/inventory": "Custom Sheet Inventories & Audits",
      "/travel-cases": "Travel Suitcase Size Solver",
      "/logistics": "Logistics Dispatch Panel",
      "/contacts": "Contacts & External Signees",
      "/help": "Platform Help Center & Knowledge Base",
      "/privacy": "Privacy Policy Review",
      "/terms": "Terms of Service Review"
    };

    let matched = pathHumanMap[location.pathname];
    if (!matched) {
      if (location.pathname.startsWith("/list/")) {
        matched = "Visual Packing Checklist Manifest";
      } else if (location.pathname.startsWith("/project/")) {
        matched = "Full Project Workspace Details";
      } else if (location.pathname.startsWith("/rack/")) {
        matched = "Rack Slots Detail View";
      } else if (location.pathname.startsWith("/gear/")) {
        matched = "Gear Bio & Spec Sheet";
      } else {
        matched = `Visited ${location.pathname}`;
      }
    }

    try {
      const recent = JSON.parse(localStorage.getItem("packer_recent_views") || "[]");
      const filtered = [matched, ...recent.filter((r: string) => r !== matched)].slice(0, 8);
      localStorage.setItem("packer_recent_views", JSON.stringify(filtered));
    } catch (e) {
      console.error(e);
    }
  }, [location.pathname]);
  
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <Routes location={location}>
          <Route path="/" element={user ? <Navigate to="/dashboard" /> : (adminSettings?.rootVisibility === 'auth_only' ? <AuthGate adminSettings={adminSettings} /> : (selectedCommunity === 'global' ? <LandingPage user={user} adminSettings={adminSettings} landingView={landingView} setLandingView={setLandingView} /> : <Marketplace user={user} adminSettings={adminSettings} />))} />
          <Route path="/dashboard" element={user ? <Dashboard user={user} adminSettings={adminSettings} /> : <Navigate to="/" />} />
          <Route path="/list/:id" element={<PackingListDetail user={user} adminSettings={adminSettings} />} />
          <Route path="/p/:id" element={<PackingListBioView />} />
          <Route path="/marketplace/:id" element={<MarketplaceView />} />
          <Route path="/shop/:uid" element={<ShopPage />} />
          <Route path="/marketplace" element={<Marketplace user={user} adminSettings={adminSettings} />} />
          <Route path="/scan/:id" element={user ? <CameraScanner user={user} adminSettings={adminSettings} /> : <Navigate to="/" />} />
          <Route path="/admin" element={user?.isSuperAdmin ? <AdminPanel user={user} onMenuClick={onMenuClick} /> : <Navigate to="/" />} />
          <Route path="/admin/pages" element={user?.isSuperAdmin ? <PagesManager user={user} /> : <Navigate to="/" />} />
          <Route path="/organization" element={user ? <OrganizationModule user={user} adminSettings={adminSettings} /> : <Navigate to="/" />} />
          <Route path="/profile" element={user ? <ProfilePage user={user} onUpdate={setUser} adminSettings={adminSettings} /> : <Navigate to="/" />} />
          <Route path="/listings" element={user ? <ListingsModule user={user} adminSettings={adminSettings} /> : <Navigate to="/" />} />
          <Route path="/privacy" element={<LegalPage type="privacy" />} />
          <Route path="/terms" element={<LegalPage type="terms" />} />
          <Route path="/pg/:slug" element={<PageViewer />} />
          <Route path="/kiosk" element={<KioskMode user={user} adminSettings={adminSettings} />} />
          <Route path="/ai-wizard" element={isFeatureEnabled('aiWizard', user, adminSettings) ? <AITemplateWizard user={user} adminSettings={adminSettings} /> : <Navigate to="/dashboard" />} />
          <Route path="/library" element={user ? <GearLibrary user={user} adminSettings={adminSettings} /> : <Navigate to="/" />} />
          <Route path="/gear/:id" element={<GearBioPage user={user} adminSettings={adminSettings} />} />
          <Route path="/systems-builder" element={user ? <SystemsBuilder user={user} /> : <Navigate to="/" />} />
          <Route path="/racks" element={user ? <RackingDashboard user={user} adminSettings={adminSettings} /> : <Navigate to="/" />} />
          <Route path="/rack/:id" element={user ? <RackDetail user={user} /> : <Navigate to="/" />} />
          <Route path="/projects" element={user ? <ProjectDashboard user={user} adminSettings={adminSettings} /> : <Navigate to="/" />} />
          <Route path="/project/:id" element={user ? <ProjectDetail user={user} /> : <Navigate to="/" />} />
          <Route path="/tooling" element={isFeatureEnabled('toolingLists', user, adminSettings) ? <ToolingListModule user={user} adminSettings={adminSettings} /> : <Navigate to="/dashboard" />} />
          <Route path="/organizer" element={isFeatureEnabled('organizer', user, adminSettings) ? <OrganizerModule user={user} adminSettings={adminSettings} /> : <Navigate to="/dashboard" />} />
          <Route path="/inventory" element={user ? <InventoryModule user={user} adminSettings={adminSettings} /> : <Navigate to="/" />} />
          <Route path="/travel-cases" element={isFeatureEnabled('travelCases', user, adminSettings) ? <TravelCaseModule user={user!} adminSettings={adminSettings} /> : <Navigate to="/dashboard" />} />
          <Route path="/scenario-builder" element={user ? <ScenarioBuilder user={user} adminSettings={adminSettings} /> : <Navigate to="/" />} />
          <Route path="/traveller" element={user ? <TravellerModule user={user} adminSettings={adminSettings} /> : <Navigate to="/" />} />
          <Route path="/logistics" element={user ? <LogisticsDashboard user={user} adminSettings={adminSettings} /> : <Navigate to="/" />} />
          <Route path="/contacts" element={user ? <Contacts user={user} adminSettings={adminSettings} /> : <Navigate to="/" />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/help" element={<HelpCenter user={user} />} />
          <Route path="*" element={user ? <Navigate to="/dashboard" replace /> : <Navigate to="/" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

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
        title: 'Visual Inventory. Instant Market.',
        subtitle: 'Industrial Grade Gear Tracking',
        description: 'Professional-grade lifecycle management for high-stakes equipment. Visual verification, asset tracking, and one-click marketplace deployment.',
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
      model: 'gemini-3-flash-preview',
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
    } as any
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
    
    // helper to clean undefined fields
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

    // 1. Update ownerId in organizations and find a migrated org ID
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

    // 2. Link user profile fields and include the migrated org ID
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

    // 3. Migrate gearLibrary subcollection
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

    // 4. Migrate containers subcollection
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

    // 5. Update ownerId in inventories
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

    // 6. Update ownerId in racks
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

    // Delete the original demo user profile so we don't repeatedly migrate it
    await deleteDoc(fromUserRef);
    toast.success("Successfully linked and migrated your sandbox organization, inventory, and gear lists to your Google account!");
  } catch (error) {
    console.warn(`[Migration] Soft notice - Failed to migrate demo data:`, error);
  }
}

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [adminSettings, setAdminSettings] = useState<AdminSettings>(getDefaultAdminSettings());
  const [loading, setLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [landingView, setLandingView] = useState<string>('saas');

  const hasInitializedSidebarCollapse = useRef(false);

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
  const [listsCount, setListsCount] = useState(0);
  const [currentHash, setCurrentHash] = useState(window.location.hash);
  
  const [selectedCommunity, setSelectedCommunity] = useState<string | null>(() => {
    return localStorage.getItem("packer_selected_community");
  });
  const [isCommunitySelectorOpen, setIsCommunitySelectorOpen] = useState(() => {
    const selected = localStorage.getItem("packer_selected_community");
    const dontShow = localStorage.getItem("packer_dont_show_community_selector") === "true";
    return selected === null && !dontShow;
  });

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

  const isLayoutHidden = currentHash.startsWith('#/kiosk') || currentHash.includes('hideLayout=true') || currentHash.startsWith('#/p/') || currentHash.startsWith('#/gear/');

  // Conditional routing and location detection for community selector
  useEffect(() => {
    if (!user) return;

    // 1. First-time log-in detector
    const loginKey = `packer_has_logged_in_${user.uid}`;
    const hasLoggedInBefore = localStorage.getItem(loginKey);
    if (!hasLoggedInBefore) {
      localStorage.setItem(loginKey, "true");
      setIsCommunitySelectorOpen(true);
    }

    // 2. Geolocation shift detector (if user moves to a new location)
    const detectAndCheckLocationShift = async () => {
      try {
        const res = await fetch('https://freeipapi.app/api/json');
        if (res.ok) {
          const data = await res.json();
          const code = data.countryCode; // e.g. "FJ", "AU", "NZ", "US"
          if (code) {
            const lastCode = localStorage.getItem('packer_last_known_location_country');
            if (lastCode && lastCode.toUpperCase() !== code.toUpperCase()) {
              console.log(`[Location Routing] Location shifted from ${lastCode} to ${code}`);
              localStorage.setItem('packer_last_known_location_country', code);
              // Clear Don't Show Again since they changed locations
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

  // Dynamic Web Manifest & Theme/Splash Customizer Effect
  useEffect(() => {
    if (!adminSettings) return;

    const brand = adminSettings.branding || {};
    const name = brand.pwaName || brand.companyName || "Packer Tools";
    const shortName = brand.pwaShortName || brand.companyName || "Packer Tools";
    const bgColor = brand.pwaBgColor || "#0a0a0c";
    const themeColor = brand.pwaThemeColor || "#0a0a0c";
    const icon192 = brand.pwaIcon192Url || "/icon-192.png";
    const icon512 = brand.pwaIcon512Url || "/icon-512.png";

    // 1. Update <meta name="theme-color">
    let themeMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeMeta) {
      themeMeta = document.createElement('meta');
      themeMeta.setAttribute('name', 'theme-color');
      document.head.appendChild(themeMeta);
    }
    themeMeta.setAttribute('content', themeColor);

    // 2. Update <link rel="apple-touch-icon">
    let appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
    if (!appleIcon) {
      appleIcon = document.createElement('link');
      appleIcon.setAttribute('rel', 'apple-touch-icon');
      document.head.appendChild(appleIcon);
    }
    appleIcon.setAttribute('href', icon192);

    // 3. Update PWA Manifest dynamically via a Data URI
    try {
      const manifestObj = {
        name: name,
        short_name: shortName,
        description: "The professional visual inventory & gear lifecycle platform.",
        start_url: "/#/kiosk", // Ensures we default to the gorgeous Kiosk dashboard on install
        display: "standalone",
        orientation: "portrait",
        background_color: bgColor,
        theme_color: themeColor,
        icons: [
          {
            src: icon192,
            sizes: "192x192",
            type: icon192.startsWith("data:image/") ? icon192.split(";")[0].split(":")[1] : "image/png",
            purpose: "any"
          },
          {
            src: icon512,
            sizes: "512x512",
            type: icon512.startsWith("data:image/") ? icon512.split(";")[0].split(":")[1] : "image/png",
            purpose: "any"
          },
          {
            src: icon192,
            sizes: "192x192",
            type: icon192.startsWith("data:image/") ? icon192.split(";")[0].split(":")[1] : "image/png",
            purpose: "maskable"
          },
          {
            src: icon512,
            sizes: "512x512",
            type: icon512.startsWith("data:image/") ? icon512.split(";")[0].split(":")[1] : "image/png",
            purpose: "maskable"
          }
        ]
      };

      const manifestString = JSON.stringify(manifestObj);
      const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(manifestString);

      let linkElement = document.querySelector('link[rel="manifest"]');
      if (!linkElement) {
        linkElement = document.createElement('link');
        linkElement.setAttribute('rel', 'manifest');
        document.head.appendChild(linkElement);
      }
      linkElement.setAttribute('href', dataUri);
    } catch (manifestError) {
      console.warn("Dynamic PWA customizer failure:", manifestError);
    }
  }, [adminSettings]);

  useEffect(() => {
    // Initialize global settings and plans if they don't exist
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
                title: 'Visual Inventory. Instant Market.',
                subtitle: 'Industrial Grade Gear Tracking',
                description: 'Professional-grade lifecycle management for high-stakes equipment. Visual verification, asset tracking, and one-click marketplace deployment.',
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
              model: 'gemini-3-flash-preview',
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
        }
      } catch (error) {
        console.warn("Soft initialization notice:", error);
      }
    };

    initializeDefaults();

    let unsubscribeUser: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Run migration check in the background asynchronously without blocking the profile snapshot initialization
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

        // Use onSnapshot for real-time profile updates
        unsubscribeUser = onSnapshot(doc(db, 'users', firebaseUser.uid), async (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data() as UserProfile;
            
            // Auto-heal empty orgId for existing users who own an organization
            if (!userData.orgId) {
              try {
                const orgsSnap = await getDocs(query(collection(db, 'organizations'), where('ownerId', '==', firebaseUser.uid)));
                if (!orgsSnap.empty) {
                  const firstOrgId = orgsSnap.docs[0].id;
                  await setDoc(doc(db, 'users', firebaseUser.uid), { orgId: firstOrgId }, { merge: true });
                  console.log(`[Auto-Heal] Successfully linked empty orgId to owned organization: ${firstOrgId}`);
                }
              } catch (healError) {
                console.warn("[Auto-Heal] Failed to auto-associate organization:", healError);
              }
            }

            // Ensure default admin has super admin privileges
            if (firebaseUser.email === 'jnakasamai@gmail.com' && firebaseUser.emailVerified && !userData.isSuperAdmin) {
              const updatedUser = { ...userData, isSuperAdmin: true, role: 'owner' as const };
              await setDoc(doc(db, 'users', firebaseUser.uid), updatedUser);
              setUser(updatedUser);
            } else {
              setUser(userData);
            }
          } else {
            // Find if there is an owned organization to link immediately for new users
            let initialOrgId = '';
            try {
              const orgsSnap = await getDocs(query(collection(db, 'organizations'), where('ownerId', '==', firebaseUser.uid)));
              if (!orgsSnap.empty) {
                initialOrgId = orgsSnap.docs[0].id;
              }
            } catch (initialMatchError) {
              console.warn("[Auto-Heal] Initial org match soft error:", initialMatchError);
            }

            const newUser: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'User',
              photoURL: firebaseUser.photoURL || '',
              orgId: initialOrgId,
              plan: 'free',
              isSuperAdmin: (firebaseUser.email === 'jnakasamai@gmail.com' && firebaseUser.emailVerified),
              role: (firebaseUser.email === 'jnakasamai@gmail.com' && firebaseUser.emailVerified) ? 'owner' : 'viewer',
              createdAt: new Date().toISOString(),
            };
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
        if (localStorage.getItem('packer_demo_bypass') === 'true') {
          const fakeUser: UserProfile = {
            uid: 'demo-super-admin',
            email: 'jnakasamai@gmail.com',
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Toaster position="bottom-right" richColors />
      <ThemeProvider>
        <IndustryProvider user={user} adminSettings={adminSettings}>
          <Router>
          <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans flex overflow-hidden">
            {user && !isLayoutHidden && (
              <Sidebar 
                user={user} 
                adminSettings={adminSettings} 
                isCollapsed={isSidebarCollapsed} 
                setIsCollapsed={setIsSidebarCollapsed} 
                isMobileOpen={isMobileSidebarOpen}
                setIsMobileOpen={setIsMobileSidebarOpen}
                listsCount={listsCount}
              />
            )}
            
            <div className="flex-1 min-w-0 flex flex-col min-h-screen transition-all duration-300 font-sans">
              {!isLayoutHidden && (
                <Navbar 
                  user={user} 
                  adminSettings={adminSettings} 
                  onMenuClick={() => setIsMobileSidebarOpen(true)} 
                  selectedCommunity={selectedCommunity}
                  onOpenSelector={() => setIsCommunitySelectorOpen(true)}
                  landingView={landingView}
                  setLandingView={setLandingView}
                />
              )}
              <main className={`flex-1 w-full overflow-y-auto flex flex-col justify-between ${
                isLayoutHidden 
                  ? `max-w-none px-0 py-0 sm:px-0 sm:py-0 ${(currentHash.startsWith('#/p/') || currentHash.startsWith('#/gear/')) ? 'bg-neutral-50' : 'bg-neutral-900'}` 
                  : 'max-w-[1700px] mx-auto px-4 sm:px-6 py-6 sm:py-8'
              }`}>
                <div className="flex-1">
                  <AnimatedRoutes 
                    user={user} 
                    setUser={setUser} 
                    adminSettings={adminSettings} 
                    onMenuClick={() => setIsMobileSidebarOpen(true)} 
                    selectedCommunity={selectedCommunity}
                    landingView={landingView}
                    setLandingView={setLandingView}
                  />
                </div>
                {!isLayoutHidden && (
                  <Footer 
                    adminSettings={adminSettings} 
                    selectedCommunity={selectedCommunity}
                    onOpenSelector={() => setIsCommunitySelectorOpen(true)}
                  />
                )}
              </main>
            </div>

            {/* Dynamic Geographic Community Router Portal */}
            <CommunitySelector
              adminSettings={adminSettings}
              selectedCommunity={selectedCommunity}
              isOpen={isCommunitySelectorOpen}
              onSelect={(mId) => {
                localStorage.setItem("packer_selected_community", mId);
                setSelectedCommunity(mId);
                setIsCommunitySelectorOpen(false);
              }}
              onClose={() => setIsCommunitySelectorOpen(false)}
              isDismissible={selectedCommunity !== null}
            />

            {user && !user.onboardingCompleted && (
              <Onboarding 
                user={user} 
                onComplete={() => setUser({ ...user, onboardingCompleted: true })} 
              />
            )}

            {user && <DukeyAssistant user={user} />}
            {user && <AddGearModal user={user} adminSettings={adminSettings} />}
            {user && <QuickActionsDrawer user={user} />}
          </div>
        </Router>
      </IndustryProvider>
    </ThemeProvider>
  </ErrorBoundary>
  );
}
