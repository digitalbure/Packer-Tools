import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useIndustry } from '../context/IndustryContext';
import { 
  Home, 
  LayoutDashboard, 
  Package, 
  Server, 
  Truck, 
  User, 
  Zap, 
  HelpCircle, 
  ShieldCheck, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  Plus,
  QrCode,
  Layers,
  Briefcase,
  Wrench,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Building2,
  BarChart3,
  Users,
  LayoutGrid,
  CreditCard,
  Globe,
  FileText,
  Layout,
  Settings,
  Hammer,
  DollarSign,
  Building,
  Box,
  Book,
  ListChecks,
  Camera,
  AlertCircle,
  Cpu,
  ShoppingBag,
  Sparkles,
  Compass,
  Sun,
  Mail,
  Code,
  Smartphone,
  Bug
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, AdminSettings, FeatureKey } from '../types';
import { isFeatureEnabled } from '../lib/featureUtils';
import { logout, db } from '../firebase';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import PackerLogo from './PackerLogo';
import { toast } from 'sonner';
import OfflineSyncWidget from './OfflineSyncWidget';

interface SidebarProps {
  user: UserProfile | null;
  adminSettings: AdminSettings | null;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  listsCount: number;
}

export default function Sidebar({ user, adminSettings, isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen, listsCount }: SidebarProps) {
  const location = useLocation();
  const [projectData, setProjectData] = useState<any>(null);

  const isProjectRoute = location.pathname.startsWith('/project/');
  const projectId = isProjectRoute ? location.pathname.split('/')[2] : null;
  const isHelpRoute = location.pathname.startsWith('/help');

  const [hasActiveBugs, setHasActiveBugs] = useState<boolean>(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!user || !user.isSuperAdmin) {
      setHasActiveBugs(false);
      return;
    }
    const unsubscribe = onSnapshot(collection(db, 'bugs'), (snapshot) => {
      const active = snapshot.docs.some(doc => {
        const data = doc.data();
        return data.status === 'open' || data.status === 'in_review';
      });
      setHasActiveBugs(active);
    }, (error) => {
      console.warn("Sidebar: Error listening to bugs:", error);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!projectId) {
      setProjectData(null);
      return;
    }
    const unsubscribe = onSnapshot(doc(db, 'projects', projectId), (snap) => {
      if (snap.exists()) {
        setProjectData({ id: snap.id, ...snap.data() });
      }
    }, (error) => {
      console.warn("Sidebar: Error listening to project doc:", projectId, error);
    });
    return () => unsubscribe();
  }, [projectId]);

  const isFeatureEnabledSafe = (feature: FeatureKey) => {
    if (!user) return false;
    return user.enabledFeatures?.includes(feature) || user.plan === 'Pro' || user.plan === 'Enterprise';
  };

  const [isProjectStartersOpen, setIsProjectStartersOpen] = useState(false);
  const [openSubItems, setOpenSubItems] = useState<string[]>([]);

  const { getAdjustedLabel, getAdjustedNav } = useIndustry();

  if (!user) return null;

  const allAvailableModules = [
    { to: '/organization', label: 'Organization', icon: <Building2 size={20} /> },
    { to: '/projects', label: 'Projects', icon: <Briefcase size={20} /> },
    { to: '/kiosk', label: 'Gear Kiosk', icon: <QrCode size={20} />, feature: 'kioskMode' as FeatureKey },
    { to: '/library', label: getAdjustedLabel('library'), icon: <Package size={20} /> },
    { to: '/systems-builder', label: getAdjustedLabel('systems-builder'), icon: <Hammer size={20} /> },
    { 
      to: '/marketplace', 
      label: 'Marketplace', 
      icon: <ShoppingBag size={20} />,
      subItems: user.isSuperAdmin ? [
        { to: '/marketplace', label: 'Browse Marketplace', icon: <ShoppingBag size={16} /> },
        { to: '/admin?tab=listings', label: 'Moderate & Categories', icon: <ListChecks size={16} /> },
        { to: '/admin?tab=landing', label: 'Marketplace Front', icon: <Layout size={16} /> },
        { to: '/admin?tab=settings', label: 'Geo-Launch Settings', icon: <Settings size={16} /> },
      ] : undefined
    },
    { to: '/listings', label: 'Listings', icon: <ListChecks size={20} /> },
    { 
      to: '/lists', 
      label: getAdjustedLabel('lists'), 
      icon: <Layers size={20} />,
      subItems: [
        { to: '/dashboard?tab=lists', label: getAdjustedLabel('packing-lists'), icon: <FileText size={16} /> },
        { to: '/dashboard?tab=templates', label: getAdjustedLabel('templates'), icon: <FileText size={16} /> },
        { to: '/inventory', label: 'Inventories', icon: <LayoutGrid size={16} /> },
        { to: '/library?type=kit', label: 'Kits', icon: <Zap size={16} /> },
        { to: '/organizer', label: 'Groups & Shelves', icon: <Layout size={16} /> },
      ]
    },
    { to: '/racks', label: getAdjustedLabel('racks'), icon: <Server size={20} /> },
    { to: '/logistics', label: getAdjustedLabel('logistics'), icon: <Truck size={20} /> },
    { 
      to: '/inventory', 
      label: getAdjustedLabel('inventory'), 
      icon: <LayoutGrid size={20} />,
      feature: 'inventoryManagement' as FeatureKey 
    },
    { to: '/contacts', label: 'Contacts', icon: <User size={20} /> },
    { 
      to: '/ai-wizard', 
      label: 'AI Wizard', 
      icon: <Zap size={20} />, 
      feature: 'aiWizard' as FeatureKey 
    },
    { to: '/scenario-builder', label: 'Scenario Builder', icon: <Sparkles size={20} /> },
    { to: '/traveller', label: 'Traveller Module', icon: <Compass size={20} /> },
    { to: '/tooling', label: 'Tooling Lists', icon: <Wrench size={20} />, feature: 'toolingLists' as FeatureKey },
    { to: '/organizer', label: 'Organizer', icon: <Layers size={20} />, feature: 'organizer' as FeatureKey },
    { to: '/travel-cases', label: 'Travel Cases', icon: <Briefcase size={20} />, feature: 'travelCases' as FeatureKey },
  ];

  const allowedModules = allAvailableModules.filter(item => {
    if (item.to === '/kiosk') return true;
    return !item.feature || isFeatureEnabled(item.feature, user, adminSettings);
  });

  const selectedStarters = user.selectedStarters !== undefined ? user.selectedStarters : ['/tooling', '/organizer', '/travel-cases'];

  const navItems = getAdjustedNav(allowedModules.filter(item => !selectedStarters.includes(item.to)));

  const adminNavItems = [
    { to: '/admin?tab=analytics', label: 'Platform Analytics', icon: <BarChart3 size={20} /> },
    { to: '/admin?tab=telemetry', label: 'Resource Monitor', icon: <Cpu size={20} /> },
    { to: '/admin?tab=system_health', label: 'System Health', icon: <Server size={20} /> },
    { to: '/admin?tab=organizations', label: 'Organizations', icon: <Building2 size={20} /> },
    { to: '/admin?tab=users', label: 'Manage Users', icon: <Users size={20} /> },
    { to: '/admin?tab=projects', label: 'Global Projects', icon: <Briefcase size={20} /> },
    { to: '/admin?tab=plans', label: 'Subscription Plans', icon: <CreditCard size={20} /> },
    { to: '/admin?tab=features', label: 'Global Features', icon: <Zap size={20} /> },
    { to: '/admin?tab=integrations', label: 'Integrations & API', icon: <Globe size={20} /> },
    { to: '/admin?tab=checkouts', label: 'Checkout Logs', icon: <Package size={20} /> },
    { to: '/admin?tab=listings', label: 'Marketplace Listings', icon: <ShoppingBag size={20} /> },
    { to: '/admin?tab=kiosk', label: 'Kiosk Settings', icon: <QrCode size={20} /> },
    { to: '/admin?tab=landing', label: 'Landing Page', icon: <Layout size={20} /> },
    { to: '/admin/pages', label: 'Custom Pages', icon: <FileText size={20} /> },
    { 
      to: '/admin?tab=settings', 
      label: 'System Settings', 
      icon: <Settings size={20} />,
      subItems: [
        { to: '/admin?tab=settings&sub=branding', label: 'Branding & Kit', icon: <Sparkles size={16} /> },
        { to: '/admin?tab=settings&sub=emails', label: 'Email Customizer', icon: <Mail size={16} /> },
        { to: '/admin?tab=settings&sub=billing', label: 'Billing & money', icon: <CreditCard size={16} /> },
        { to: '/admin?tab=settings&sub=multi_industry', label: 'Multi Industry', icon: <Building2 size={16} /> },
        { to: '/admin?tab=settings&sub=marketplace', label: 'Marketplace', icon: <ShoppingBag size={16} /> },
        { to: '/admin?tab=settings&sub=widgets', label: 'Widget modules', icon: <Wrench size={16} /> },
        { to: '/admin?tab=settings&sub=bugs', label: 'Bug Finder', icon: <Bug size={16} />, isBugFinder: true },
        { to: '/admin?tab=settings&sub=smtp', label: 'SMTP Server', icon: <Server size={16} /> }
      ]
    },
  ];

  const isAdminRoute = location.pathname.startsWith('/admin');
  const isProfileRoute = location.pathname.startsWith('/profile');

  const profileNavItems = [
    // Section: Identity
    { id: 'about', label: 'About Me', section: 'Identity', icon: <User size={18} /> },
    { id: 'kyc', label: 'Business & KYC (Fiji)', section: 'Identity', icon: <ShieldCheck size={18} /> },
    { id: 'connect', label: 'Connect & Socials', section: 'Identity', icon: <Globe size={18} /> },
    
    // Section: Workspace Prefs
    { id: 'preferences', label: 'Layout & Density', section: 'Workspace', icon: <Settings size={18} /> },
    { id: 'theme', label: 'Theme Settings', section: 'Workspace', icon: <Sun size={18} /> },
    
    // Section: Monetization & Brand
    { id: 'store', label: 'Brand & Shopfront', section: 'Shopfront', icon: <Package size={18} /> },
    { id: 'billing', label: 'Plan & Billing', section: 'Shopfront', icon: <BarChart3 size={18} /> },
    
    // Section: Technical
    { id: 'api', label: 'API & Embeds', section: 'Developer', icon: <Code size={18} /> },
    { id: 'notifications', label: 'Notification Desk', section: 'Developer', icon: <Mail size={18} /> },
    { id: 'device', label: 'Mobile App (PWA)', section: 'Developer', icon: <Smartphone size={18} /> },
  ];

  const projectStarters = allowedModules.filter(item => selectedStarters.includes(item.to));

  const currentPlan = (adminSettings?.plans || []).find(p => p.id === user.plan);
  const maxLists = currentPlan?.maxPackingLists || 3;

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileOpen(false)}
            className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm z-50 lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ 
          width: isCollapsed ? 80 : 280,
          x: isMobileOpen ? 0 : (windowWidth < 1024 ? -280 : 0)
        }}
        className={`fixed lg:sticky left-0 top-0 bottom-0 bg-white border-r border-neutral-200 z-[60] lg:z-40 flex flex-col transition-all duration-300 ease-in-out h-screen`}
      >
        {/* Header / Logo */}
        <div className="h-20 flex items-center px-6 border-b border-neutral-100 shrink-0 justify-between">
          <Link to="/" className="flex items-center gap-2 overflow-hidden" onClick={() => setIsMobileOpen(false)}>
            {isCollapsed ? (
              adminSettings?.branding?.logo ? (
                <img src={adminSettings.branding.logo} className="h-8 w-8 object-contain shrink-0 rounded-md" alt="Logo" referrerPolicy="no-referrer" />
              ) : (
                <PackerLogo variant="symbol-only" size={32} light={true} />
              )
            ) : (
              adminSettings?.branding?.logo ? (
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <img src={adminSettings.branding.logo} className="h-8 w-auto max-w-[120px] object-contain shrink-0 rounded-md" alt="Logo" referrerPolicy="no-referrer" />
                  <span className="font-black uppercase tracking-tight text-neutral-800 text-xs truncate max-w-[100px]">
                    {adminSettings?.branding?.companyName || 'Packer Tools'}
                  </span>
                </div>
              ) : (
                <div className="flex items-center">
                  <span className="block sm:hidden">
                    <PackerLogo variant="text-only" light={true} />
                  </span>
                  <span className="hidden sm:block">
                    <PackerLogo variant="full" size={26} light={true} className="scale-95 origin-left" />
                  </span>
                </div>
              )
            )}
          </Link>
          <button onClick={() => setIsMobileOpen(false)} className="lg:hidden p-2 text-neutral-400">
            <X size={20} />
          </button>
        </div>

        {/* Toggle Button (Desktop Only) */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex absolute -right-4 top-24 w-8 h-8 bg-white border border-neutral-200 rounded-full items-center justify-center text-neutral-400 hover:text-primary shadow-sm transition-colors z-50"
        >
          {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>

      <div className="flex-1 overflow-y-auto py-4 px-2 space-y-6 scrollbar-hide">
        {isAdminRoute ? (
          /* Admin Navigation */
          <div className="space-y-6">
            <div className="flex items-center justify-between px-3">
              {!isCollapsed && <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 leading-none">System Admin</h3>}
              <Link
                to="/dashboard"
                className="flex items-center gap-2 p-2.5 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition text-neutral-900 shadow-sm group"
                title="Exit Admin Control"
              >
                {!isCollapsed && <span className="text-[9px] font-black uppercase tracking-widest pl-1">Exit</span>}
                <X size={14} className="group-hover:rotate-90 transition-transform" />
              </Link>
            </div>

            <nav className="space-y-1">
              {adminNavItems.map((item) => {
                const currentPath = location.pathname + location.search;
                const isActive = currentPath === item.to || (item.to === '/admin?tab=settings' && currentPath.includes('tab=settings'));
                const hasSubItems = 'subItems' in item && (item as any).subItems?.length > 0;
                const isSubOpen = openSubItems.includes(item.to) || (isActive && hasSubItems);

                return (
                  <div key={item.to} className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Link
                        to={item.to}
                        onClick={() => setIsMobileOpen(false)}
                        className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all group ${
                          isActive 
                            ? 'bg-neutral-900 text-white shadow-lg' 
                            : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                        } ${isCollapsed ? 'justify-center' : ''}`}
                        title={isCollapsed ? item.label : ''}
                      >
                        <div className="shrink-0 flex items-center justify-center w-6">
                          <div className="relative">
                            {item.icon}
                            {hasActiveBugs && item.to === '/admin?tab=settings' && (
                              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-650"></span>
                              </span>
                            )}
                          </div>
                        </div>
                        {!isCollapsed && (
                          <div className="flex-1 flex items-center justify-between min-w-0">
                            <motion.span
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="text-xs uppercase tracking-tight truncate pr-1"
                            >
                              {item.label}
                            </motion.span>
                            {hasActiveBugs && item.to === '/admin?tab=settings' && !isSubOpen && (
                              <span className="px-1.5 py-0.5 text-[8px] font-black uppercase text-red-700 bg-red-50 rounded-lg tracking-wider animate-pulse border border-red-200 shrink-0">
                                BUG
                              </span>
                            )}
                          </div>
                        )}
                      </Link>

                      {!isCollapsed && hasSubItems && (
                        <button
                          onClick={() => setOpenSubItems(prev => 
                            prev.includes(item.to) 
                              ? prev.filter(p => p !== item.to) 
                              : [...prev, item.to]
                          )}
                          className="p-3 text-neutral-400 hover:text-neutral-900 rounded-xl transition-colors shrink-0"
                        >
                          <ChevronRight size={14} className={`transition-transform duration-300 ${isSubOpen ? 'rotate-90' : ''}`} />
                        </button>
                      )}
                    </div>

                    <AnimatePresence>
                      {!isCollapsed && hasSubItems && isSubOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="pl-9 space-y-1 overflow-hidden"
                        >
                          {(item as any).subItems.map((sub: any) => {
                            const isSubActive = currentPath === sub.to || (sub.to === '/admin?tab=settings&sub=branding' && currentPath === '/admin?tab=settings');
                            const isBugItem = (sub as any).isBugFinder;
                            return (
                              <Link
                                key={sub.to}
                                to={sub.to}
                                onClick={() => setIsMobileOpen(false)}
                                className={`flex items-center justify-between px-3 py-2 text-[11px] font-bold transition-colors rounded-lg ${
                                  isSubActive
                                    ? 'text-neutral-900 bg-neutral-150' 
                                    : 'text-neutral-450 hover:text-neutral-900 hover:bg-neutral-50/70'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0 font-extrabold uppercase">
                                  <span className="shrink-0 opacity-70 flex items-center justify-center w-4">{sub.icon}</span>
                                  <span className="truncate">{sub.label}</span>
                                </div>
                                {isBugItem && hasActiveBugs && (
                                  <span className="px-1.5 py-0.5 text-[7px] font-black uppercase text-red-700 bg-red-50 rounded-md tracking-widest animate-pulse border border-red-100 shrink-0">
                                    ACTIVE
                                  </span>
                                )}
                              </Link>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </nav>
          </div>
        ) : isProfileRoute ? (
          /* Profile Navigation */
          <div className="space-y-6">
            <div className="flex items-center justify-between px-3">
              {!isCollapsed && <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 leading-none">User Settings</h3>}
              <Link
                to="/dashboard"
                className="flex items-center gap-2 p-2.5 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition text-neutral-900 shadow-sm group"
                title="Exit Profile Settings"
              >
                {!isCollapsed && <span className="text-[9px] font-black uppercase tracking-widest pl-1">Exit</span>}
                <X size={14} className="group-hover:rotate-90 transition-transform" />
              </Link>
            </div>

            {/* Profile Summary Card when not collapsed */}
            {!isCollapsed && (
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 mx-1 flex items-center gap-3">
                <img src={user.photoURL} alt={user.displayName} className="w-10 h-10 rounded-full border border-primary/10 select-none pointer-events-none" />
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-xs truncate leading-tight text-neutral-950 uppercase">{user.displayName || 'User'}</span>
                  <span className="text-[8px] font-black uppercase bg-primary/10 text-primary px-1 mr-auto rounded mt-0.5">{user.plan} Tier</span>
                </div>
              </div>
            )}

            {/* Profile Navigation Groups */}
            <div className="space-y-5">
              {['Identity', 'Workspace', 'Shopfront', 'Developer'].map((sect) => {
                const sectItems = profileNavItems.filter(item => item.section === sect);
                return (
                  <div key={sect} className="space-y-1">
                    {!isCollapsed && (
                      <h4 className="text-[9px] font-black uppercase tracking-widest text-neutral-400 px-3 mb-1">{sect}</h4>
                    )}
                    <nav className="space-y-0.5">
                      {sectItems.map((item) => {
                        const currentTab = new URLSearchParams(location.search).get('tab') || 'about';
                        const isActive = currentTab === item.id;
                        return (
                          <Link
                            key={item.id}
                            to={`/profile?tab=${item.id}`}
                            onClick={() => setIsMobileOpen(false)}
                            className={`flex items-center gap-3 px-3 py-2 rounded-xl font-bold transition-all group ${
                              isActive 
                                ? 'bg-neutral-900 text-white shadow-lg' 
                                : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                            } ${isCollapsed ? 'justify-center' : ''}`}
                            title={isCollapsed ? item.label : ''}
                          >
                            <div className="shrink-0 flex items-center justify-center w-5">{item.icon}</div>
                            {!isCollapsed && (
                              <motion.span
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-xs uppercase tracking-tight"
                              >
                                {item.label}
                              </motion.span>
                            )}
                          </Link>
                        );
                      })}
                    </nav>
                  </div>
                );
              })}
            </div>
          </div>
        ) : isProjectRoute ? (
          /* Project Workspace Navigation */
          <div className="space-y-6">
            <div className="flex items-center justify-between px-3">
              {!isCollapsed && <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 leading-none mr-2">Workspace</h3>}
              <Link
                to="/projects"
                className="flex items-center gap-1.5 p-2 px-3 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition text-neutral-900 shadow-sm group shrink-0"
                title="Exit Workspace"
              >
                <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                {!isCollapsed && <span className="text-[9px] font-black uppercase tracking-widest leading-none">All Projects</span>}
              </Link>
            </div>

            {projectData && (
              <div className={`p-4 bg-neutral-50 rounded-2xl border border-neutral-100 mx-1 space-y-3 ${isCollapsed ? 'flex flex-col items-center' : ''}`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 bg-neutral-900 text-white rounded-xl flex items-center justify-center shrink-0 shadow-sm">
                    <Briefcase size={16} />
                  </div>
                  {!isCollapsed && (
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-xs truncate leading-tight text-neutral-950 uppercase">{projectData.name}</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[8px] font-black uppercase bg-primary/10 text-primary px-1 hover:bg-primary/20 rounded">v{projectData.version || 1}</span>
                        <span className={`text-[8px] font-black uppercase px-1 rounded ${projectData.stage === 'actual' ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-600'}`}>{projectData.stage || 'proposed'}</span>
                      </div>
                    </div>
                  )}
                </div>

                {!isCollapsed && (
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-medium pt-2 border-t border-neutral-100/60 leading-none">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-neutral-400 font-bold uppercase text-[8px] tracking-wider">Status</span>
                      <span className="font-black text-neutral-700 uppercase truncate text-[9px]">{projectData.status?.replace('_', ' ') || 'planning'}</span>
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-neutral-400 font-bold uppercase text-[8px] tracking-wider">Priority</span>
                      <span className="font-black text-neutral-700 uppercase truncate text-[9px]">{projectData.priority || 'standard'}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <nav className="space-y-1">
              {[
                { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={18} /> },
                ...(isFeatureEnabledSafe('projectCost') ? [{ id: 'costs', label: 'Costs & Budget', icon: <DollarSign size={18} /> }] : []),
                ...(isFeatureEnabledSafe('supplierManagement') ? [{ id: 'suppliers', label: 'Vendor CRM', icon: <Building size={18} /> }] : []),
                ...(isFeatureEnabledSafe('bomManagement') ? [{ id: 'bom', label: 'BOM Composer', icon: <Zap size={18} /> }] : []),
                ...(isFeatureEnabledSafe('aiWizard') ? [{ id: 'compatibility', label: 'AI Intelligence', icon: <ShieldCheck size={18} /> }] : [])
              ].map((tab) => {
                const tabUrl = `/project/${projectId}?tab=${tab.id}`;
                const currentTab = new URLSearchParams(location.search).get('tab') || 'overview';
                const isActive = currentTab === tab.id;
                return (
                  <Link
                    key={tab.id}
                    to={tabUrl}
                    onClick={() => setIsMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all group ${
                      isActive 
                        ? 'bg-neutral-900 text-white shadow-lg' 
                        : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                    } ${isCollapsed ? 'justify-center' : ''}`}
                    title={isCollapsed ? tab.label : ''}
                  >
                    <div className="shrink-0 flex items-center justify-center w-6">{tab.icon}</div>
                    {!isCollapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-xs uppercase tracking-tight"
                      >
                        {tab.label}
                      </motion.span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        ) : isHelpRoute ? (
          /* Help Center Navigation */
          <div className="space-y-6">
            <div className="flex items-center justify-between px-3">
              {!isCollapsed && <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 leading-none">Knowledge Base</h3>}
              <Link
                to="/dashboard"
                className="flex items-center gap-2 p-2 px-3 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition text-neutral-900 shadow-sm group shrink-0"
                title="Exit Help"
              >
                <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                {!isCollapsed && <span className="text-[9px] font-black uppercase tracking-widest leading-none">Dashboard</span>}
              </Link>
            </div>

            <nav className="space-y-1">
              {[
                { id: 'all', label: 'All Guides', icon: <Box size={18} /> },
                { id: 'getting-started', label: 'Getting Started', icon: <Book size={18} /> },
                { id: 'packing-lists', label: 'Manifests', icon: <ListChecks size={18} /> },
                { id: 'gear-library', label: 'Gear Library', icon: <Camera size={18} /> },
                { id: 'ai-wizard', label: 'AI Wizard', icon: <Zap size={18} /> },
                { id: 'moving', label: 'Projects & Tasks', icon: <Truck size={18} /> },
                { id: 'billing', label: 'Billing & SLA', icon: <ShieldCheck size={18} /> },
              ].map((cat) => {
                const catUrl = cat.id === 'all' ? '/help' : `/help?category=${cat.id}`;
                const currentCategory = new URLSearchParams(location.search).get('category') || 'all';
                const isActive = currentCategory === cat.id;
                return (
                  <Link
                    key={cat.id}
                    to={catUrl}
                    onClick={() => setIsMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all group ${
                      isActive 
                        ? 'bg-neutral-900 text-white shadow-lg' 
                        : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                    } ${isCollapsed ? 'justify-center' : ''}`}
                    title={isCollapsed ? cat.label : ''}
                  >
                    <div className="shrink-0 flex items-center justify-center w-6">{cat.icon}</div>
                    {!isCollapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-xs uppercase tracking-tight"
                      >
                        {cat.label}
                      </motion.span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {!isCollapsed && (
              <div className="p-4 bg-neutral-50 border border-neutral-100 rounded-2xl mx-1 space-y-2.5">
                <div className="text-primary"><AlertCircle size={18} /></div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-800">Protocol Status</h4>
                <p className="text-[9px] text-neutral-500 leading-relaxed italic">All system documentation synchronized and fully operational.</p>
              </div>
            )}
          </div>
        ) : (
          /* Standard User Navigation */
          <div className="space-y-6">
            {/* Dashboard First */}
            <nav className="space-y-1">
              <Link
                to="/dashboard"
                onClick={() => setIsMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl font-bold transition-all group ${
                  location.pathname === '/dashboard' 
                    ? 'bg-neutral-900 text-white shadow-lg' 
                    : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                } ${isCollapsed ? 'justify-center' : ''}`}
                title={isCollapsed ? 'Dashboard' : ''}
              >
                <div className="shrink-0 flex items-center justify-center w-6"><LayoutDashboard size={20} /></div>
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm"
                  >
                    Dashboard
                  </motion.span>
                )}
              </Link>
            </nav>

            {/* User Profile */}
            <div className={`flex items-center gap-3 p-2.5 bg-neutral-50 rounded-2xl overflow-hidden border border-neutral-100 ${isCollapsed ? 'justify-center' : ''}`}>
              <div className="w-10 h-10 bg-neutral-900 text-white rounded-xl flex items-center justify-center font-black text-lg shrink-0 shadow-sm">
                {user.displayName?.[0] || user.email?.[0]?.toUpperCase()}
              </div>
              {!isCollapsed && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col min-w-0"
                >
                  <span className="font-bold text-sm truncate leading-tight">{user.displayName || 'User'}</span>
                  <span className="text-[9px] text-neutral-400 font-black uppercase tracking-widest">{user.plan} Tier</span>
                </motion.div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="space-y-2">
              {!isCollapsed && (
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 px-3">Quick Actions</h3>
              )}
              <div className="flex flex-col gap-2">
                <Link
                  to="/scan/new"
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center justify-center gap-3 bg-neutral-900 text-white px-3 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition group`}
                  title={isCollapsed ? 'Scan to Pack' : ''}
                >
                  <QrCode size={18} className="group-hover:scale-110 transition-transform shrink-0" />
                  {!isCollapsed && <span className="text-sm">Scan to Pack</span>}
                </Link>
                
                <Link
                  to="/dashboard?create=true"
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center justify-center gap-3 bg-primary text-white px-3 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition group`}
                  title={isCollapsed ? 'New List' : ''}
                >
                  <Plus size={18} className="group-hover:scale-110 transition-transform shrink-0" />
                  {!isCollapsed && <span className="text-sm">New List</span>}
                </Link>

                <Link
                  to="/library?addGear=true"
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center justify-center gap-3 bg-neutral-900 text-white px-3 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition group`}
                  title={isCollapsed ? 'Add Gear' : ''}
                >
                  <Plus size={18} className="group-hover:scale-110 transition-transform shrink-0" />
                  {!isCollapsed && <span className="text-sm">Add Gear</span>}
                </Link>
              </div>
            </div>

            {/* Main Nav */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.to;
                const hasSubItems = 'subItems' in item && (item as any).subItems?.length > 0;
                const isSubOpen = openSubItems.includes(item.to);

                const isKioskModeItem = item.feature === 'kioskMode';
                const isKioskQualified = isFeatureEnabled('kioskMode', user, adminSettings);
                const isKioskDisabled = isKioskModeItem && !isKioskQualified;

                return (
                  <div key={item.to} className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Link
                        to={isKioskDisabled ? '#' : item.to}
                        onClick={(e) => {
                          if (isKioskDisabled) {
                            e.preventDefault();
                            toast.error("The self-service Gear Kiosk is a premium module. Please subscribe to Pro or Enterprise plans to activate Kiosk check-out!");
                            return;
                          }
                          setIsMobileOpen(false);
                        }}
                        className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all group ${
                          isKioskDisabled
                            ? 'text-neutral-300 opacity-60 bg-neutral-50/50 cursor-not-allowed border-none'
                            : isActive 
                              ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                              : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 border-none'
                        } ${isCollapsed ? 'justify-center' : ''}`}
                        title={isCollapsed ? (isKioskDisabled ? `${item.label} (Premium Required)` : item.label) : ''}
                      >
                        <div className="shrink-0 flex items-center justify-center w-6">{item.icon}</div>
                        {!isCollapsed && (
                          <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-sm whitespace-nowrap text-left"
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </Link>
                      {!isCollapsed && hasSubItems && (
                        <button
                          onClick={() => setOpenSubItems(prev => 
                            prev.includes(item.to) 
                              ? prev.filter(p => p !== item.to) 
                              : [...prev, item.to]
                          )}
                          className="p-3 text-neutral-400 hover:text-neutral-900 rounded-xl transition-colors shrink-0"
                        >
                          <ChevronRight size={14} className={`transition-transform duration-300 ${isSubOpen ? 'rotate-90' : ''}`} />
                        </button>
                      )}
                    </div>

                    <AnimatePresence>
                      {!isCollapsed && hasSubItems && isSubOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="pl-9 space-y-1 overflow-hidden"
                        >
                          {(item as any).subItems.map((sub: any) => (
                            <Link
                              key={sub.to}
                              to={sub.to}
                              onClick={() => setIsMobileOpen(false)}
                              className={`flex items-center gap-2.5 px-3 py-2 text-[11px] font-bold transition-colors rounded-lg ${
                                location.pathname + location.search === sub.to || 
                                (sub.to === '/dashboard?tab=lists' && location.pathname === '/dashboard' && !location.search.includes('tab=templates') && !location.search.includes('tab=overview')) ||
                                (sub.to === '/dashboard?tab=lists' && location.pathname === '/dashboard' && location.search === '')
                                  ? 'text-primary bg-primary/5' 
                                  : 'text-neutral-400 hover:text-neutral-900 hover:bg-neutral-50'
                              }`}
                            >
                              <span className="shrink-0 opacity-70 flex items-center justify-center w-4">{sub.icon}</span>
                              <span className="truncate">{sub.label}</span>
                            </Link>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </nav>

            {/* Project Starters */}
            {!isCollapsed && projectStarters.length > 0 && (
              <div className="space-y-2">
                <button 
                  onClick={() => setIsProjectStartersOpen(!isProjectStartersOpen)}
                  className="w-full flex items-center justify-between px-3 group"
                >
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 group-hover:text-neutral-600 transition-colors">Starters</h3>
                  <ChevronRight size={12} className={`text-neutral-300 transition-transform duration-300 ${isProjectStartersOpen ? 'rotate-90' : ''}`} />
                </button>
                
                <AnimatePresence>
                  {isProjectStartersOpen && (
                    <motion.nav
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="space-y-1 overflow-hidden"
                    >
                      {projectStarters.map((item) => (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setIsMobileOpen(false)}
                          className="group w-full flex items-center gap-3 px-3 py-2 rounded-xl text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-all border-none focus:outline-none"
                        >
                          <span className="text-neutral-400 group-hover:text-primary transition-colors shrink-0 flex items-center justify-center w-6">
                            {React.isValidElement(item.icon)
                              ? React.cloneElement(item.icon as any, { size: 18 })
                              : item.icon
                            }
                          </span>
                          <span className="font-bold text-[11px] whitespace-nowrap">{item.label}</span>
                        </Link>
                      ))}
                    </motion.nav>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Quick Stats */}
            {!isCollapsed && (
              <div className="p-4 bg-neutral-50/50 border border-neutral-100 rounded-[1.5rem] space-y-2.5 mx-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Inventory Status</span>
                  <span className="text-xs font-black text-neutral-900">{listsCount} / {maxLists}</span>
                </div>
                <div className="h-2 bg-neutral-100 rounded-full overflow-hidden border border-neutral-200/50">
                  <div 
                    className="h-full bg-primary transition-all duration-1000 shadow-[0_0_8px_rgba(242,125,38,0.3)]" 
                    style={{ width: `${Math.min((listsCount / maxLists) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Admin Section */}
            {user.isSuperAdmin && (
              <div className="pt-4 border-t border-neutral-100">
                {!isCollapsed && (
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 px-3 mb-2">Management</h3>
                )}
                <Link
                  to="/admin"
                  onClick={() => setIsMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl font-bold transition-all group ${
                    isAdminRoute 
                      ? 'bg-neutral-900 text-white shadow-lg'
                      : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 border-none'
                  } ${isCollapsed ? 'justify-center' : ''}`}
                  title={isCollapsed ? 'Admin Panel' : ''}
                >
                  <ShieldCheck size={20} className="shrink-0 group-hover:text-primary transition-colors" />
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm whitespace-nowrap"
                    >
                      Admin Panel
                    </motion.span>
                  )}
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-neutral-100 space-y-2">
        <OfflineSyncWidget isCollapsed={isCollapsed} />
        <Link
          to="/help"
          onClick={() => setIsMobileOpen(false)}
          className={`flex items-center gap-3 px-3 py-3 rounded-xl font-bold text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 transition-all ${isCollapsed ? 'justify-center' : ''}`}
          title={isCollapsed ? 'Help Center' : ''}
        >
          <HelpCircle size={20} className="shrink-0" />
          {!isCollapsed && <span className="text-sm">Help Center</span>}
        </Link>
        <button
          onClick={() => {
            logout();
            setIsMobileOpen(false);
          }}
          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl font-bold text-red-500 hover:bg-red-50 transition-all ${isCollapsed ? 'justify-center' : ''}`}
          title={isCollapsed ? 'Logout' : ''}
        >
          <LogOut size={20} className="shrink-0" />
          {!isCollapsed && <span className="text-sm">Logout</span>}
        </button>

        {/* Release Version Stamp */}
        <div className="pt-3 flex flex-col items-center justify-center border-t border-neutral-100/50">
          <span className={`font-mono font-black text-neutral-400 tracking-wider ${isCollapsed ? 'text-[8px]' : 'text-[10px]'} uppercase`}>
            {isCollapsed ? 'v4.16.0' : 'Version 4.16.0'}
          </span>
          {!isCollapsed && (
            <span className="text-[8px] font-black text-green-600 uppercase tracking-widest mt-1 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-200">
              Stable Production
            </span>
          )}
        </div>
      </div>
    </motion.aside>
  </>
);
}
