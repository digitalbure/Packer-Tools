import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { isFeatureEnabled } from '../lib/featureUtils';
import { Loader2 } from 'lucide-react';
import AuthGuard from '../guards/AuthGuard';
import AdminGuard from '../guards/AdminGuard';

// Lazy-loaded Pages
const LandingPage = lazy(() => import('../pages/LandingPage'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const PackingListDetail = lazy(() => import('../pages/PackingListDetail'));
const PackingListBioView = lazy(() => import('../pages/PackingListBioView'));
const CameraScanner = lazy(() => import('../pages/CameraScanner'));
const AdminPanel = lazy(() => import('../pages/AdminPanel'));
const OrganizationModule = lazy(() => import('../pages/OrganizationModule'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));
const LegalPage = lazy(() => import('../pages/LegalPage'));
const PricesPage = lazy(() => import('../pages/PricesPage'));
const ContactPage = lazy(() => import('../pages/ContactPage'));
const AITemplateWizard = lazy(() => import('../pages/AITemplateWizard'));
const HelpCenter = lazy(() => import('../pages/HelpCenter'));
const GearLibrary = lazy(() => import('../pages/GearLibrary'));
const InventoryModule = lazy(() => import('../pages/InventoryModule'));
const RackingDashboard = lazy(() => import('../pages/RackingDashboard'));
const RackDetail = lazy(() => import('../pages/RackDetail'));
const ProjectDashboard = lazy(() => import('../pages/ProjectDashboard'));
const ProjectDetail = lazy(() => import('../pages/ProjectDetail'));
const SystemsBuilder = lazy(() => import('../pages/SystemsBuilder'));
const TravelCaseModule = lazy(() => import('../pages/TravelCaseModule'));
const OrganizerModule = lazy(() => import('../pages/OrganizerModule'));
const ToolingListModule = lazy(() => import('../pages/ToolingListModule'));
const LogisticsDashboard = lazy(() => import('../pages/LogisticsDashboard'));
const Contacts = lazy(() => import('../pages/Contacts'));
const MarketplaceView = lazy(() => import('../pages/MarketplaceView'));
const Marketplace = lazy(() => import('../pages/Marketplace'));
const PagesManager = lazy(() => import('../pages/PagesManager'));
const PageViewer = lazy(() => import('../pages/PageViewer'));
const KioskMode = lazy(() => import('../pages/KioskMode'));
const ListingsModule = lazy(() => import('../pages/ListingsModule'));
const GearBioPage = lazy(() => import('../pages/GearBioPage'));
const ShopPage = lazy(() => import('../pages/ShopPage'));
const ScenarioBuilder = lazy(() => import('../pages/ScenarioBuilder'));
const TravellerModule = lazy(() => import('../pages/TravellerModule'));
const OrganizerBioPage = lazy(() => import('../pages/OrganizerBioPage'));
const OrganizerIOPage = lazy(() => import('../pages/OrganizerIOPage'));
const RFIDModule = lazy(() => import('../pages/RFIDModule'));

// Component AuthGate (replaces inline Gate component)
const AuthGate = lazy(() => import('../components/AuthGate'));

// Pre-defined fallback spinner
const LazySpinner = () => (
  <div className="flex items-center justify-center min-h-[400px] w-full">
    <Loader2 className="animate-spin text-neutral-400" size={32} />
  </div>
);

export function AnimatedRoutes() {
  const { user, setUser, adminSettings, setIsMobileSidebarOpen, landingView, setLandingView } = useAuth();
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

  const onMenuClick = () => setIsMobileSidebarOpen(true);

  return (
    <Suspense fallback={<LazySpinner />}>
      <Routes location={location}>
        <Route path="/" element={user ? <Navigate to="/dashboard" /> : (adminSettings?.rootVisibility === 'auth_only' ? <AuthGate adminSettings={adminSettings} /> : <LandingPage user={user} adminSettings={adminSettings} landingView={landingView} />)} />
        
        {/* Protected Routes */}
        <Route path="/dashboard" element={<AuthGuard><Dashboard user={user!} adminSettings={adminSettings} /></AuthGuard>} />
        <Route path="/marketplace/:id" element={isFeatureEnabled('marketplace', user, adminSettings) ? <AuthGuard><MarketplaceView /></AuthGuard> : <Navigate to="/dashboard" />} />
        <Route path="/shop/:uid" element={isFeatureEnabled('marketplace', user, adminSettings) ? <AuthGuard><ShopPage /></AuthGuard> : <Navigate to="/dashboard" />} />
        <Route path="/marketplace" element={isFeatureEnabled('marketplace', user, adminSettings) ? <AuthGuard><Marketplace user={user!} adminSettings={adminSettings} /></AuthGuard> : <Navigate to="/dashboard" />} />
        <Route path="/scan/:id" element={<AuthGuard><CameraScanner user={user!} adminSettings={adminSettings} /></AuthGuard>} />
        
        <Route path="/organization" element={<AuthGuard><OrganizationModule user={user!} adminSettings={adminSettings} /></AuthGuard>} />
        <Route path="/profile" element={<AuthGuard><ProfilePage user={user!} onUpdate={setUser} adminSettings={adminSettings} /></AuthGuard>} />
        <Route path="/listings" element={isFeatureEnabled('marketplaceListings', user, adminSettings) ? <AuthGuard><ListingsModule user={user!} adminSettings={adminSettings} /></AuthGuard> : <Navigate to="/dashboard" />} />
        
        <Route path="/ai-wizard" element={isFeatureEnabled('aiWizard', user, adminSettings) ? <AITemplateWizard user={user!} adminSettings={adminSettings} /> : <Navigate to="/dashboard" />} />
        <Route path="/library" element={<AuthGuard><GearLibrary user={user!} adminSettings={adminSettings} /></AuthGuard>} />
        <Route path="/systems-builder" element={<AuthGuard><SystemsBuilder user={user!} /></AuthGuard>} />
        <Route path="/racks" element={<AuthGuard><RackingDashboard user={user!} adminSettings={adminSettings} /></AuthGuard>} />
        <Route path="/rack/:id" element={<AuthGuard><RackDetail user={user!} /></AuthGuard>} />
        <Route path="/projects" element={<AuthGuard><ProjectDashboard user={user!} adminSettings={adminSettings} /></AuthGuard>} />
        <Route path="/project/:id" element={<AuthGuard><ProjectDetail user={user!} /></AuthGuard>} />
        <Route path="/inventory" element={<AuthGuard><InventoryModule user={user!} adminSettings={adminSettings} /></AuthGuard>} />
        <Route path="/scenario-builder" element={<AuthGuard><ScenarioBuilder user={user!} adminSettings={adminSettings} /></AuthGuard>} />
        <Route path="/traveller" element={<AuthGuard><TravellerModule user={user!} adminSettings={adminSettings} /></AuthGuard>} />
        <Route path="/logistics" element={<AuthGuard><LogisticsDashboard user={user!} adminSettings={adminSettings} /></AuthGuard>} />
        <Route path="/contacts" element={<AuthGuard><Contacts user={user!} adminSettings={adminSettings} /></AuthGuard>} />

        <Route path="/tooling" element={isFeatureEnabled('toolingLists', user, adminSettings) ? <ToolingListModule user={user!} adminSettings={adminSettings} /> : <Navigate to="/dashboard" />} />
        <Route path="/organizer" element={isFeatureEnabled('organizer', user, adminSettings) ? <OrganizerModule user={user!} adminSettings={adminSettings} /> : <Navigate to="/dashboard" />} />
        <Route path="/organizer/:id/io" element={<AuthGuard><OrganizerIOPage user={user} /></AuthGuard>} />
        <Route path="/travel-cases" element={isFeatureEnabled('travelCases', user, adminSettings) ? <TravelCaseModule user={user!} adminSettings={adminSettings} /> : <Navigate to="/dashboard" />} />
        <Route path="/rfid" element={<AuthGuard><RFIDModule user={user!} adminSettings={adminSettings} /></AuthGuard>} />

        {/* SuperAdmin Routes */}
        <Route path="/admin" element={<AdminGuard><AdminPanel user={user!} onMenuClick={onMenuClick} /></AdminGuard>} />
        <Route path="/admin/pages" element={<AdminGuard><PagesManager user={user!} /></AdminGuard>} />

        {/* Public Routes */}
        <Route path="/list/:id" element={<PackingListDetail user={user} adminSettings={adminSettings} />} />
        <Route path="/p/:id" element={<PackingListBioView />} />
        <Route path="/o/:id" element={<OrganizerBioPage />} />
        <Route path="/organizer/:id/bio" element={<OrganizerBioPage />} />
        <Route path="/privacy" element={<LegalPage type="privacy" />} />
        <Route path="/terms" element={<LegalPage type="terms" />} />
        <Route path="/prices" element={<PricesPage user={user} onUpdateUser={setUser} adminSettings={adminSettings} />} />
        <Route path="/pricing" element={<PricesPage user={user} onUpdateUser={setUser} adminSettings={adminSettings} />} />
        <Route path="/pg/:slug" element={<PageViewer />} />
        <Route path="/kiosk" element={<KioskMode user={user} adminSettings={adminSettings} />} />
        <Route path="/gear/:id" element={<GearBioPage user={user} adminSettings={adminSettings} />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/help" element={<HelpCenter user={user} />} />
        
        {/* Wildcard Fallback */}
        <Route path="*" element={user ? <Navigate to="/dashboard" replace /> : <Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default AnimatedRoutes;
