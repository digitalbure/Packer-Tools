import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { isFeatureEnabled } from '../lib/featureUtils';
import { Loader2 } from 'lucide-react';
import AuthGuard from '../guards/AuthGuard';
import AdminGuard from '../guards/AdminGuard';

// Helper to handle dynamic import failures gracefully
const lazyWithRetry = (importFn: () => Promise<any>) => {
  return lazy(async () => {
    try {
      return await importFn();
    } catch (err) {
      console.warn("Dynamic import failed, attempting a retry...", err);
      // Try importing again after 1.5 seconds
      await new Promise(resolve => setTimeout(resolve, 1500));
      try {
        return await importFn();
      } catch (retryErr) {
        console.error("Dynamic import retry failed, reloading page to clean up cache...", retryErr);
        // Ensure we reload the page once to clear any service worker cache or stale scripts
        const reloaded = sessionStorage.getItem('packer_page_reloaded_on_import_error');
        if (!reloaded) {
          sessionStorage.setItem('packer_page_reloaded_on_import_error', 'true');
          window.location.reload();
        }
        throw retryErr;
      }
    }
  });
};

// Lazy-loaded Pages
const LandingPage = lazyWithRetry(() => import('../pages/LandingPage'));
const Dashboard = lazyWithRetry(() => import('../pages/Dashboard'));
const PackingListDetail = lazyWithRetry(() => import('../pages/PackingListDetail'));
const PackingListBioView = lazyWithRetry(() => import('../pages/PackingListBioView'));
const CameraScanner = lazyWithRetry(() => import('../pages/CameraScanner'));
const AdminPanel = lazyWithRetry(() => import('../pages/AdminPanel'));
const OrganizationModule = lazyWithRetry(() => import('../pages/OrganizationModule'));
const ProfilePage = lazyWithRetry(() => import('../pages/ProfilePage'));
const LegalPage = lazyWithRetry(() => import('../pages/LegalPage'));
const PricesPage = lazyWithRetry(() => import('../pages/PricesPage'));
const ContactPage = lazyWithRetry(() => import('../pages/ContactPage'));
const AITemplateWizard = lazyWithRetry(() => import('../pages/AITemplateWizard'));
const HelpCenter = lazyWithRetry(() => import('../pages/HelpCenter'));
const GearLibrary = lazyWithRetry(() => import('../pages/GearLibrary'));
const InventoryModule = lazyWithRetry(() => import('../pages/InventoryModule'));
const RackingDashboard = lazyWithRetry(() => import('../pages/RackingDashboard'));
const RackDetail = lazyWithRetry(() => import('../pages/RackDetail'));
const ProjectDashboard = lazyWithRetry(() => import('../pages/ProjectDashboard'));
const ProjectDetail = lazyWithRetry(() => import('../pages/ProjectDetail'));
const SystemsBuilder = lazyWithRetry(() => import('../pages/SystemsBuilder'));
const TravelCaseModule = lazyWithRetry(() => import('../pages/TravelCaseModule'));
const OrganizerModule = lazyWithRetry(() => import('../pages/OrganizerModule'));
const ToolingListModule = lazyWithRetry(() => import('../pages/ToolingListModule'));
const LogisticsDashboard = lazyWithRetry(() => import('../pages/LogisticsDashboard'));
const Contacts = lazyWithRetry(() => import('../pages/Contacts'));
const MarketplaceView = lazyWithRetry(() => import('../pages/MarketplaceView'));
const Marketplace = lazyWithRetry(() => import('../pages/Marketplace'));
const PagesManager = lazyWithRetry(() => import('../pages/PagesManager'));
const PageViewer = lazyWithRetry(() => import('../pages/PageViewer'));
const KioskMode = lazyWithRetry(() => import('../pages/KioskMode'));
const ListingsModule = lazyWithRetry(() => import('../pages/ListingsModule'));
const GearBioPage = lazyWithRetry(() => import('../pages/GearBioPage'));
const PublicInventoryItemView = lazyWithRetry(() => import('../pages/PublicInventoryItemView'));
const ShopPage = lazyWithRetry(() => import('../pages/ShopPage'));
const ScenarioBuilder = lazyWithRetry(() => import('../pages/ScenarioBuilder'));
const TravellerModule = lazyWithRetry(() => import('../pages/TravellerModule'));
const OrganizerBioPage = lazyWithRetry(() => import('../pages/OrganizerBioPage'));
const OrganizerIOPage = lazyWithRetry(() => import('../pages/OrganizerIOPage'));
const RFIDModule = lazyWithRetry(() => import('../pages/RFIDModule'));
const GroupsModule = lazyWithRetry(() => import('../pages/GroupsModule'));
const IdResolutionPage = lazyWithRetry(() => import('../pages/IdResolutionPage'));

// Component AuthGate (replaces inline Gate component)
const AuthGate = lazyWithRetry(() => import('../components/AuthGate'));

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
      "/groups": "Groups & Folders Module",
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
      sessionStorage.removeItem('packer_page_reloaded_on_import_error');
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
        <Route path="/groups" element={<AuthGuard><GroupsModule user={user!} adminSettings={adminSettings} /></AuthGuard>} />

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
        <Route path="/inventory-item/:inventoryId/:itemId" element={<PublicInventoryItemView />} />
        <Route path="/id/:token" element={<IdResolutionPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/help" element={<HelpCenter user={user} />} />
        
        {/* Wildcard Fallback */}
        <Route path="*" element={user ? <Navigate to="/dashboard" replace /> : <Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default AnimatedRoutes;
