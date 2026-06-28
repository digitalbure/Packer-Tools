import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  Layers, 
  FolderKanban, 
  QrCode, 
  Settings, 
  ShieldCheck, 
  ShoppingBag, 
  Search, 
  LogOut, 
  User, 
  HelpCircle, 
  Layout, 
  ArrowLeftRight, 
  Sparkles,
  ChevronRight,
  Monitor,
  Package,
  Wrench,
  Truck,
  Building2,
  Calendar,
  Zap,
  Cpu,
  Tv,
  Coins,
  History,
  Info
} from 'lucide-react';
import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { auth, db, logout } from '../firebase';
import { UserProfile, AdminSettings } from '../types';
import PackerLogo from './PackerLogo';
import { useAuth } from '../providers/AuthProvider';

interface WorkflowLayoutProps {
  user: UserProfile;
  setUser: (user: UserProfile | null) => void;
  adminSettings: AdminSettings | null;
  selectedCommunity: string | null;
  onOpenSelector: () => void;
  onToggleLayoutTheme: () => void;
  children: React.ReactNode;
}

export default function WorkflowLayout({
  user,
  setUser,
  adminSettings,
  selectedCommunity,
  onOpenSelector,
  onToggleLayoutTheme,
  children
}: WorkflowLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const currentSearch = location.search;

  const { selectedCurrency, setSelectedCurrency } = useAuth();

  const [activeTab, setActiveTab] = useState<'inventory' | 'projects' | 'checkout' | 'utilities' | 'adminPanel'>('inventory');

  // Multi-Industry hook integration
  const activeCommunities = adminSettings?.communities || [
    { id: 'fiji', name: 'Fiji Community', country: 'Fiji', countryCode: 'FJ', currency: 'FJD', flag: '🇫🇯', companyName: 'Packer Tools Fiji', isActive: true },
    { id: 'australia', name: 'Australian Community', country: 'Australia', countryCode: 'AU', currency: 'AUD', flag: '🇦🇺', companyName: 'Packer Tools Australia', isActive: true },
    { id: 'new_zealand', name: 'New Zealand Community', country: 'New Zealand', countryCode: 'NZ', currency: 'NZD', flag: '🇳🇿', companyName: 'Packer Tools New Zealand', isActive: true }
  ];
  const currentComm = activeCommunities.find(c => c.id === selectedCommunity);

  // Sync active tab based on router location
  useEffect(() => {
    if (
      currentPath.startsWith('/library') || 
      currentPath.startsWith('/inventory') || 
      currentPath.startsWith('/organizer') || 
      currentPath.startsWith('/tooling') || 
      currentPath.startsWith('/travel-cases') ||
      currentPath.startsWith('/racks') ||
      currentPath.startsWith('/rack/') ||
      currentPath.startsWith('/gear/')
    ) {
      setActiveTab('inventory');
    } else if (
      currentPath.startsWith('/projects') ||
      currentPath.startsWith('/project/') ||
      currentPath.startsWith('/dashboard') ||
      currentPath.startsWith('/list/') ||
      currentPath.startsWith('/systems-builder') ||
      currentPath.startsWith('/scenario-builder') ||
      currentPath.startsWith('/traveller')
    ) {
      setActiveTab('projects');
    } else if (
      currentPath.startsWith('/kiosk') || 
      currentPath.startsWith('/scan')
    ) {
      setActiveTab('checkout');
    } else if (currentPath.startsWith('/admin')) {
      const tabParam = new URLSearchParams(currentSearch).get('tab');
      if (tabParam === 'users' || tabParam === 'organizations' || tabParam === 'billing' || tabParam === 'modules') {
        setActiveTab('adminPanel');
      } else {
        setActiveTab('utilities');
      }
    } else {
      setActiveTab('projects');
    }
  }, [currentPath, currentSearch]);

  const handleTabClick = (tabId: typeof activeTab) => {
    setActiveTab(tabId);
    if (tabId === 'inventory') {
      navigate('/library');
    } else if (tabId === 'projects') {
      navigate('/dashboard');
    } else if (tabId === 'checkout') {
      navigate('/kiosk');
    } else if (tabId === 'utilities') {
      navigate('/admin?tab=settings&sub=branding');
    } else if (tabId === 'adminPanel') {
      navigate('/admin?tab=users');
    }
  };

  // Helper check for active sub-links
  const isSubActive = (path: string, searchTab?: string, subTab?: string) => {
    const cleanPath = path.split('?')[0];
    const pathMatch = currentPath === cleanPath;
    
    if (!pathMatch) return false;
    if (searchTab) {
      const searchParams = new URLSearchParams(currentSearch);
      const activeTabParam = searchParams.get('tab');
      if (activeTabParam !== searchTab) return false;
      
      if (subTab) {
        const activeSubParam = searchParams.get('sub');
        return activeSubParam === subTab;
      }
    }
    return true;
  };

  // Sub navigation definitions
  const subNavItems = {
    inventory: [
      { name: 'Gear Library Registry', path: '/library', icon: Layers },
      { name: 'Inventory Sheets Tracker', path: '/inventory', icon: Package },
      { name: 'Virtual Rack & Case Stage', path: '/organizer', icon: Tv },
      { name: 'Server Racks Cabinets', path: '/racks', icon: Monitor },
      { name: 'Specialist Tooling Lists', path: '/tooling', icon: Wrench },
      { name: 'Travel Case Manifests', path: '/travel-cases', icon: Truck },
    ],
    projects: [
      { name: 'Project Dashboards', path: '/projects', icon: FolderKanban },
      { name: 'Standard Packing Sheets', path: '/dashboard', icon: Layers },
      { name: 'Staging Scenarios', path: '/scenario-builder', icon: Sparkles },
      { name: 'Visual Systems Builder', path: '/systems-builder', icon: Cpu },
      { name: 'Global Logistics dispatched', path: '/logistics', icon: Truck },
    ],
    checkout: [
      { name: 'Kiosk Self-Service Terminal', path: '/kiosk', icon: QrCode },
      { name: 'Corporate Contacts List', path: '/contacts', icon: User },
    ],
    utilities: [
      { name: 'White-Label Branding', path: '/admin?tab=settings&sub=branding', icon: Zap },
      { name: 'Financial Costing Settings', path: '/admin?tab=settings&sub=billing', icon: Coins },
      { name: 'Alerts & Reminders logs', path: '/admin?tab=settings&sub=reminders', icon: Calendar },
      { name: 'API integrations & Custom tokens', path: '/admin?tab=settings&sub=apiIntegrations', icon: Cpu },
    ],
    adminPanel: [
      { name: 'Corporate Users Directory', path: '/admin?tab=users', icon: User },
      { name: 'Multi-Tenant Organizations', path: '/admin?tab=organizations', icon: Building2 },
      { name: 'Unified Application Modules', path: '/admin?tab=modules', icon: ShieldCheck },
      { name: 'Account Billing Logs', path: '/admin?tab=billing', icon: History },
    ]
  };

  const isMarketplaceActive = currentPath.startsWith('/marketplace') || currentPath.startsWith('/shop') || currentPath.startsWith('/listings');

  return (
    <div className="min-h-screen bg-[#111113] text-[#dfdfe5] font-sans flex flex-col selection:bg-[#ff4f3a] selection:text-white">
      {/* 1. Header Area: DaVinci Resolve Professional Studio Command */}
      <header className="bg-[#151518] border-b border-[#2a2a30] h-16 flex items-center justify-between px-6 sticky top-0 z-50 shrink-0">
        {/* Left: Brand Logo and division quick-access */}
        <div className="flex items-center gap-4 shrink-0">
          <Link to="/" className="flex items-center gap-2 group shrink-0">
            {adminSettings?.branding?.logo ? (
              <div className="flex items-center gap-2 shrink-0">
                <img src={adminSettings.branding.logo} className="h-7 w-auto max-w-[120px] object-contain shrink-0 rounded" alt="Logo" referrerPolicy="no-referrer" />
                <span className="font-black text-xs text-white tracking-widest uppercase hidden lg:inline bg-[#19191d] px-2 py-1 rounded border border-[#26262c]">
                  {adminSettings?.branding?.companyName || 'Packer Tools'}
                </span>
                <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/20 font-mono py-0.5 px-1.5 rounded uppercase font-extrabold hidden sm:inline">Resolve Studio</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                <PackerLogo variant="full" size={26} light={false} />
                <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/20 font-mono py-0.5 px-1.5 rounded uppercase font-extrabold hidden sm:inline">Resolve Studio</span>
              </div>
            )}
          </Link>

          {/* Region selector / Workspace trigger */}
          {onOpenSelector && (
            <button 
              onClick={onOpenSelector}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1a1a1f] hover:bg-[#222228] text-neutral-400 hover:text-white rounded-md text-xs font-semibold font-mono transition border border-[#2a2a32] cursor-pointer"
              title="Click to switch community region"
            >
              <span>{currentComm ? currentComm.flag : '🌐'}</span>
              <span className="text-[9px] font-black uppercase tracking-wider hidden md:inline">{currentComm ? currentComm.name : 'Global Portal'}</span>
              <span className="text-[7px] text-neutral-500">▼</span>
            </button>
          )}

          {/* Currency Dropdown Select (Workflow Theme) */}
          <div className="relative inline-flex items-center">
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="bg-[#1a1a1f] hover:bg-[#222228] text-neutral-400 hover:text-white border border-[#2a2a32] rounded-md px-2.5 py-1 text-xs font-semibold font-mono transition outline-none focus:ring-1 focus:ring-primary cursor-pointer appearance-none pr-7 pl-2.5"
              title="Change display currency app-wide"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="AUD">AUD (A$)</option>
              <option value="FJD">FJD (FJ$)</option>
              <option value="CAD">CAD (C$)</option>
              <option value="NZD">NZD (NZ$)</option>
            </select>
            <span className="absolute right-3.5 text-[7px] text-neutral-500 pointer-events-none">▼</span>
          </div>
        </div>

        {/* Center: Sleek Physical-looking Marketplace Toggle Switch Lever */}
        <div className="flex items-center justify-center shrink-0">
          <div className="bg-[#1d1d22] border border-[#2c2c34] rounded-full p-1 flex items-center shadow-inner gap-1">
            <button
              onClick={() => navigate('/library')}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-1.5 ${
                !isMarketplaceActive 
                  ? 'bg-gradient-to-r from-neutral-800 to-neutral-700 text-white shadow-md border border-[#40404a]' 
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <Layers size={11} className={!isMarketplaceActive ? 'text-amber-500' : ''} />
              <span>LOGISTICS SUITE</span>
            </button>
            
            <div className="h-4 w-[1px] bg-[#2a2a32]" />

            <button
              onClick={() => navigate('/marketplace')}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-1.5 ${
                isMarketplaceActive 
                  ? 'bg-gradient-to-r from-[#ff4f3a]/90 to-[#e53a25]/90 text-white shadow-md border border-[#ff6452]/50 animate-pulse' 
                  : 'text-neutral-500 hover:text-[#ff4f3a]'
              }`}
            >
              <ShoppingBag size={11} className={isMarketplaceActive ? 'text-white' : ''} />
              <span>MARKETPLACE</span>
            </button>
          </div>
        </div>

        {/* Right: Quick console command, Avatar profile & Layout Selector */}
        <div className="flex items-center gap-4 shrink-0 font-mono">
          {/* Quick-Access Command Palette Search */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1f] hover:bg-[#222228] text-neutral-400 hover:text-white rounded-md transition border border-[#2a2a32] cursor-pointer text-xs select-none"
            title="Open Search Console (⌘K)"
          >
            <Search size={12} className="text-neutral-500" />
            <span className="text-[8px] uppercase tracking-widest font-black hidden lg:inline">CONSOLE</span>
            <kbd className="px-1 py-0.5 rounded bg-[#131317] border border-[#2d2d35] text-[8px] text-neutral-500 shadow-sm leading-none">⌘K</kbd>
          </button>

          {/* Core Layout Switcher - Return to standard design instantly */}
          <button
            onClick={onToggleLayoutTheme}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a1f] hover:bg-[#ff4f3a]/10 hover:text-[#ff4f3a]/90 hover:border-[#ff4f3a]/20 text-neutral-400 rounded-md transition border border-[#2a2a32] cursor-pointer text-xs"
            title="Switch back to standard sidebar theme"
          >
            <Layout size={12} className="text-[#ff4f3a]" />
            <span className="text-[8px] uppercase tracking-widest font-black hidden xl:inline">STANDARD PANEL</span>
          </button>

          <div className="h-5 w-[1px] bg-[#2a2a32]" />

          {/* User profile details */}
          <div className="flex items-center gap-3">
            <Link to="/profile" className="flex items-center gap-2 hover:opacity-80 transition">
              <div className="text-right hidden sm:block">
                <div className="text-[10px] font-black uppercase text-white tracking-wide">{user.displayName}</div>
                <div className="text-[8px] text-amber-500 font-extrabold uppercase tracking-widest">
                  {adminSettings?.plans?.find(p => p.id === user.plan || p.name.toLowerCase() === user.plan?.toLowerCase())?.name || user.plan || 'Free'}
                </div>
              </div>
              <img src={user.photoURL} alt={user.displayName} className="w-8 h-8 rounded-full border border-amber-500/20 grayscale hover:grayscale-0 transition cursor-pointer" />
            </Link>
            
            <button
              onClick={logout}
              className="p-1.5 text-neutral-500 hover:text-[#ff4f3a] transition"
              title="Logout session"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Top Secondary Area: Sub-navigation paths corresponding to the selected Workspace area */}
      <div className="bg-[#1a1a1f] border-b border-[#2a2a30] min-h-[44px] flex items-center justify-between px-6 text-xs text-neutral-400 gap-4 overflow-x-auto select-none">
        <div className="flex items-center gap-6 min-w-max">
          {subNavItems[activeTab].map((item, index) => {
            const isTabActive = currentPath === item.path || 
              (item.path.includes('?') && 
               currentPath === item.path.split('?')[0] && 
               currentSearch.includes(new URLSearchParams(item.path.split('?')[1]).get('sub') || ''));

            return (
              <button
                key={index}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-2 py-3 border-b-2 font-mono text-[9px] uppercase tracking-widest font-black transition-all ${
                  isTabActive
                    ? 'border-amber-500 text-white font-extrabold'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <item.icon size={12} className={isTabActive ? 'text-amber-500 animate-pulse' : 'text-neutral-500'} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic active scope or stats overview */}
        <div className="hidden lg:flex items-center gap-3 font-mono text-[9px] text-[#ff4f3a] font-extrabold tracking-widest uppercase bg-[#ff4f3a]/5 py-1 px-3.5 rounded border border-[#ff4f3a]/10">
          <span className="h-1.5 w-1.5 rounded-full bg-[#ff4f3a] animate-ping" />
          <span>REAL-TIME AUDIT COGNITION ACTIVE</span>
        </div>
      </div>

      {/* 3. Main Viewport Content Staging area */}
      <main className="flex-1 w-full flex flex-col relative z-10 overflow-y-auto">
        <div className="flex-1 max-w-[1700px] w-full mx-auto px-6 py-6 pb-24 text-neutral-200">
          {children}
        </div>
      </main>

      {/* 4. Bottom Centered Professional resolve ribbon dock */}
      <footer className="fixed bottom-4 left-0 right-0 z-40 px-6 flex justify-center pointer-events-none select-none">
        <div className="pointer-events-auto bg-[#141416]/95 backdrop-blur-md border border-[#2e2e36] shadow-[0_12px_40px_rgba(0,0,0,0.8)] rounded-xl py-1 px-1.5 flex items-center gap-1">
          {/* Inventory Tab */}
          <button
            onClick={() => handleTabClick('inventory')}
            className={`px-4 py-1.5 rounded-lg flex flex-col items-center gap-0.5 min-w-[80px] transition-all cursor-pointer relative ${
              activeTab === 'inventory'
                ? 'bg-[#1b1b20] text-white border border-[#3e3e46]'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Layers size={14} className={activeTab === 'inventory' ? 'text-amber-500' : ''} />
            <span className="text-[8px] font-black tracking-widest uppercase font-mono">MEDIA & INVENTORY</span>
            {activeTab === 'inventory' && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-[3px] bg-amber-500 rounded-full shadow-[0_0_8px_#f59e0b]" />
            )}
          </button>

          {/* Projects & Lists Tab */}
          <button
            onClick={() => handleTabClick('projects')}
            className={`px-4 py-1.5 rounded-lg flex flex-col items-center gap-0.5 min-w-[80px] transition-all cursor-pointer relative ${
              activeTab === 'projects'
                ? 'bg-[#1b1b20] text-white border border-[#3e3e46]'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <FolderKanban size={14} className={activeTab === 'projects' ? 'text-amber-500' : ''} />
            <span className="text-[8px] font-black tracking-widest uppercase font-mono">PROJECTS & LISTS</span>
            {activeTab === 'projects' && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-[3px] bg-amber-500 rounded-full shadow-[0_0_8px_#f59e0b]" />
            )}
          </button>

          {/* Checkout & Kiosk Tab */}
          <button
            onClick={() => handleTabClick('checkout')}
            className={`px-4 py-1.5 rounded-lg flex flex-col items-center gap-0.5 min-w-[80px] transition-all cursor-pointer relative ${
              activeTab === 'checkout'
                ? 'bg-[#1b1b20] text-white border border-[#3e3e46]'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <QrCode size={14} className={activeTab === 'checkout' ? 'text-amber-500' : ''} />
            <span className="text-[8px] font-black tracking-widest uppercase font-mono">CHECKOUT / KIOSK</span>
            {activeTab === 'checkout' && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-[3px] bg-amber-500 rounded-full shadow-[0_0_8px_#f59e0b]" />
            )}
          </button>

          <div className="h-6 w-[1px] bg-[#2d2d34] mx-1" />

          {/* Utilities & Admin settings Tab */}
          <button
            onClick={() => handleTabClick('utilities')}
            className={`px-4 py-1.5 rounded-lg flex flex-col items-center gap-0.5 min-w-[80px] transition-all cursor-pointer relative ${
              activeTab === 'utilities'
                ? 'bg-[#1b1b20] text-white border border-[#3e3e46]'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Settings size={14} className={activeTab === 'utilities' ? 'text-amber-500' : ''} />
            <span className="text-[8px] font-black tracking-widest uppercase font-mono">UTILITIES & SYSTEM</span>
            {activeTab === 'utilities' && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-[3px] bg-amber-500 rounded-full shadow-[0_0_8px_#f59e0b]" />
            )}
          </button>

          {/* Admin Panel Tab */}
          <button
            onClick={() => handleTabClick('adminPanel')}
            className={`px-4 py-1.5 rounded-lg flex flex-col items-center gap-0.5 min-w-[80px] transition-all cursor-pointer relative ${
              activeTab === 'adminPanel'
                ? 'bg-[#1b1b20] text-white border border-[#3e3e46]'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <ShieldCheck size={14} className={activeTab === 'adminPanel' ? 'text-amber-500' : ''} />
            <span className="text-[8px] font-black tracking-widest uppercase font-mono">ADMIN PANEL</span>
            {activeTab === 'adminPanel' && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-[3px] bg-amber-500 rounded-full shadow-[0_0_8px_#f59e0b]" />
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
