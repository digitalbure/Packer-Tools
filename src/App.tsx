import { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, getDocs, addDoc, query, where } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile } from './types';
import { AnimatePresence, motion } from 'motion/react';

import { Toaster } from 'sonner';

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
import ErrorBoundary from './components/ErrorBoundary';
import AddGearModal from './components/AddGearModal';
import AuthGate from './components/AuthGate';
import QuickActionsDrawer from './components/QuickActionsDrawer';
import Onboarding from './components/Onboarding';
import DukeyAssistant from './components/DukeyAssistant';
import Footer from './components/Footer';
import { AdminSettings, Plan } from './types';
import { isFeatureEnabled } from './lib/featureUtils';

function AnimatedRoutes({ user, setUser, adminSettings, onMenuClick }: { 
  user: UserProfile | null, 
  setUser: (user: UserProfile | null) => void, 
  adminSettings: AdminSettings | null,
  onMenuClick: () => void 
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
          <Route path="/" element={user ? <Navigate to="/dashboard" /> : (adminSettings?.rootVisibility === 'auth_only' ? <AuthGate /> : (adminSettings?.activeLandingPageType === 'marketplace' ? <Marketplace user={user} adminSettings={adminSettings} /> : <LandingPage user={user} adminSettings={adminSettings} />))} />
          <Route path="/dashboard" element={user ? <Dashboard user={user} adminSettings={adminSettings} /> : <Navigate to="/" />} />
          <Route path="/list/:id" element={<PackingListDetail user={user} adminSettings={adminSettings} />} />
          <Route path="/p/:id" element={<PackingListBioView />} />
          <Route path="/marketplace/:id" element={<MarketplaceView />} />
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
      maxInventoryItems: 1000
    },
    { 
      id: 'enterprise',
      name: 'Enterprise', 
      price: 99, 
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
      maxInventoryItems: 100000
    }
  ];

  return {
    plans: defaultPlans,
    globalFeatures: {},
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

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [adminSettings, setAdminSettings] = useState<AdminSettings>(getDefaultAdminSettings());
  const [loading, setLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [listsCount, setListsCount] = useState(0);

  useEffect(() => {
    if (user) {
      const q = query(collection(db, 'packingLists'), where('ownerId', '==', user.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setListsCount(snapshot.size);
      }, (error) => {
        console.warn("App: Error listening to packingLists count:", error);
      });
      return () => unsubscribe();
    } else {
      setListsCount(0);
    }
  }, [user]);

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
              maxInventoryItems: 10
            },
            { 
              id: 'pro',
              name: 'Pro', 
              price: 19, 
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
              maxInventoryItems: 1000
            },
            { 
              id: 'enterprise',
              name: 'Enterprise', 
              price: 99, 
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
              maxInventoryItems: 100000
            }
          ];
          const defaultSettings: AdminSettings = {
            plans: defaultPlans,
            globalFeatures: {},
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

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Use onSnapshot for real-time profile updates
        unsubscribeUser = onSnapshot(doc(db, 'users', firebaseUser.uid), async (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data() as UserProfile;
            // Ensure default admin has super admin privileges
            if (firebaseUser.email === 'jnakasamai@gmail.com' && firebaseUser.emailVerified && !userData.isSuperAdmin) {
              const updatedUser = { ...userData, isSuperAdmin: true, role: 'owner' as const };
              await setDoc(doc(db, 'users', firebaseUser.uid), updatedUser);
              setUser(updatedUser);
            } else {
              setUser(userData);
            }
          } else {
            const newUser: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'User',
              photoURL: firebaseUser.photoURL || '',
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
          console.error("App: Error listening to user profile:", error);
          setLoading(false);
        });
      } else {
        if (unsubscribeUser) unsubscribeUser();
        setUser(null);
        setLoading(false);
      }
    });

    const unsubscribeSettings = onSnapshot(doc(db, 'adminSettings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        setAdminSettings(docSnap.data() as AdminSettings);
      }
    }, (error) => {
      console.warn("App: Error listening to global settings:", error);
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
      <Router>
        <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans flex overflow-hidden">
          {user && (
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
            <Navbar user={user} adminSettings={adminSettings} onMenuClick={() => setIsMobileSidebarOpen(true)} />
            <main className="flex-1 w-full max-w-[1700px] mx-auto px-4 sm:px-6 py-6 sm:py-8 overflow-y-auto flex flex-col justify-between">
              <div className="flex-1">
                <AnimatedRoutes user={user} setUser={setUser} adminSettings={adminSettings} onMenuClick={() => setIsMobileSidebarOpen(true)} />
              </div>
              <Footer adminSettings={adminSettings} />
            </main>
          </div>

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
    </ErrorBoundary>
  );
}
