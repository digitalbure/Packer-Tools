import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, LogOut, LayoutDashboard, Settings, Package, User, Menu, X, Zap, HelpCircle, Server, Home, Truck, ShieldCheck, Briefcase, Search, Layout, CreditCard } from 'lucide-react';
import PackerLogo from './PackerLogo';
import { signInWithGoogle, logout } from '../firebase';
import { UserProfile, AdminSettings } from '../types';
import { isFeatureEnabled } from '../lib/featureUtils';
import { useAuth } from '../providers/AuthProvider';

export default function Navbar({ 
  user, 
  adminSettings, 
  onMenuClick,
  selectedCommunity,
  onOpenSelector,
  landingView,
  setLandingView,
  onToggleLayoutTheme
}: { 
  user: UserProfile | null, 
  adminSettings: AdminSettings | null, 
  onMenuClick?: () => void,
  selectedCommunity?: string | null,
  onOpenSelector?: () => void,
  landingView?: string,
  setLandingView?: (view: string) => void,
  onToggleLayoutTheme?: () => void
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { selectedCurrency, setSelectedCurrency } = useAuth();

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const activeCommunities = adminSettings?.communities || [
    { id: 'fiji', name: 'Fiji Community', country: 'Fiji', countryCode: 'FJ', currency: 'FJD', flag: '🇫🇯', companyName: 'Packer Tools Fiji', isActive: true },
    { id: 'australia', name: 'Australian Community', country: 'Australia', countryCode: 'AU', currency: 'AUD', flag: '🇦🇺', companyName: 'Packer Tools Australia', isActive: true },
    { id: 'new_zealand', name: 'New Zealand Community', country: 'New Zealand', countryCode: 'NZ', currency: 'NZD', flag: '🇳🇿', companyName: 'Packer Tools New Zealand', isActive: true }
  ];

  const currentComm = activeCommunities.find(c => c.id === selectedCommunity);

  return (
    <nav className="bg-paper/80 backdrop-blur-xl border-b border-primary/5 sticky top-0 z-50">
      <div className="w-full max-w-[1700px] mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <Link to="/" onClick={() => setLandingView?.('saas')} className="flex items-center gap-2 group shrink-0">
            {adminSettings?.branding?.logo ? (
              <div className="flex items-center gap-2 shrink-0">
                <img src={adminSettings.branding.logo} className="h-8 sm:h-9 w-auto max-w-[100px] sm:max-w-[140px] object-contain shrink-0 rounded-md" alt="Logo" referrerPolicy="no-referrer" />
                <span className="font-extrabold text-sm text-neutral-800 tracking-tight group-hover:text-primary transition-colors hidden sm:inline">
                  {adminSettings?.branding?.companyName || 'Packer Tools'}
                </span>
              </div>
            ) : (
              <div className="flex items-center shrink-0">
                <span className="block sm:hidden">
                  <PackerLogo variant="text-only" light={true} />
                </span>
                <span className="hidden sm:block">
                  <PackerLogo variant="full" size={32} light={true} />
                </span>
              </div>
            )}
          </Link>

          {/* Active Community Badge */}
          {onOpenSelector && (
            <button 
              onClick={onOpenSelector}
              className="flex items-center gap-1 px-2.5 py-1 bg-neutral-50 hover:bg-neutral-100 text-neutral-600 rounded-full text-xs font-semibold font-sans transition border border-neutral-200/50 cursor-pointer inline-flex shrink-0"
              title="Click to switch community region"
            >
              <span>{currentComm ? currentComm.flag : '🌐'}</span>
              <span className="text-[10px] font-black uppercase tracking-wider hidden sm:inline">{currentComm ? currentComm.name : 'Global Portal'}</span>
              <span className="text-[8px] text-neutral-400">▼</span>
            </button>
          )}

          {/* Currency Dropdown Select */}
          <div className="relative inline-flex items-center shrink-0">
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="bg-neutral-50 hover:bg-neutral-100 text-neutral-700 hover:text-neutral-900 border border-neutral-200/50 rounded-full px-3 py-1 text-xs font-bold font-sans transition outline-none focus:ring-1 focus:ring-primary cursor-pointer appearance-none pr-7 pl-3"
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
            <span className="absolute right-3.5 text-[8px] text-neutral-400 pointer-events-none">▼</span>
          </div>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6">
          {user ? (
            <>
              <div className="flex items-center gap-4 pl-6">
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
                  className="flex items-center gap-2 px-3 py-1.5 h-10 bg-neutral-50 hover:bg-neutral-100 text-neutral-500 hover:text-neutral-850 rounded-xl transition border border-neutral-200/50 cursor-pointer text-xs font-semibold select-none active:scale-95 whitespace-nowrap"
                  title="Open Search Console (⌘K)"
                >
                  <Search size={14} className="text-neutral-400" />
                  <span className="text-[9px] uppercase font-black tracking-widest text-neutral-500">Console</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-white border border-neutral-250 text-[9px] font-mono text-neutral-450 shadow-xs leading-none">⌘K</kbd>
                </button>

                {onToggleLayoutTheme && (
                  <button
                    onClick={onToggleLayoutTheme}
                    className="flex items-center gap-1.5 px-3 py-1.5 h-10 bg-neutral-50 hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 rounded-xl transition border border-neutral-200/50 cursor-pointer text-xs font-semibold select-none active:scale-95 whitespace-nowrap"
                    title="Switch Workspace Theme Layout Mode"
                  >
                    <Layout size={14} className="text-[#ff4f3a]" />
                    <span className="text-[9px] uppercase font-black tracking-widest text-[#ff4f3a]">Workflow Mode</span>
                  </button>
                )}

                <Link to="/profile" className="flex items-center gap-3 hover:bg-neutral-50 p-2 rounded-xl transition">
                  <div className="text-right hidden sm:block">
                    <div className="text-xs font-black uppercase tracking-tight">{user.displayName}</div>
                    <div className="text-[10px] text-neutral-400 font-bold uppercase">
                      {adminSettings?.plans?.find(p => p.id === user.plan || p.name.toLowerCase() === user.plan?.toLowerCase())?.name || user.plan || 'Free'} Plan
                    </div>
                  </div>
                  <img src={user.photoURL} alt={user.displayName} className="w-9 h-9 rounded-full border border-primary/10 grayscale hover:grayscale-0 transition-all cursor-pointer" />
                </Link>
                <button
                  onClick={logout}
                  className="p-2 text-primary/40 hover:text-accent transition"
                  title="Logout"
                >
                  <LogOut size={18} />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-6">
              <Link to="/prices" className="flex items-center gap-2 text-[#ff4f3a] hover:text-[#ff4f3a]/80 transition font-bold uppercase text-xs tracking-widest">
                <CreditCard size={18} />
                <span>Prices</span>
              </Link>
              <Link to="/help" className="flex items-center gap-2 text-primary/60 hover:text-primary transition font-bold uppercase text-xs tracking-widest">
                <HelpCircle size={18} />
                <span>Help</span>
              </Link>
              <button
                onClick={signInWithGoogle}
                className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-full hover:bg-primary/90 transition shadow-lg font-bold uppercase text-xs tracking-widest"
              >
                <LogIn size={18} />
                <span>Sign In</span>
              </button>
            </div>
          )}
        </div>

        {/* Mobile Search & Menu Toggles Grouped */}
        <div className="md:hidden flex items-center gap-1 shrink-0">
          {user && (
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
              className="p-2 text-primary hover:bg-neutral-100 rounded-lg transition cursor-pointer flex items-center justify-center shrink-0"
              title="Open Search Console"
            >
              <Search size={22} className="text-neutral-500 hover:text-neutral-900" />
            </button>
          )}

          <button 
            onClick={user ? onMenuClick : toggleMenu}
            className="p-2 text-primary hover:bg-primary/5 rounded-lg transition flex items-center justify-center shrink-0"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-paper border-b border-primary/5 animate-in slide-in-from-top duration-300">
          <div className="container mx-auto px-6 py-8 space-y-6">
            {user ? (
              <>
                <div className="flex items-center gap-4 pb-6 border-b border-primary/5">
                  <img src={user.photoURL} alt={user.displayName} className="w-12 h-12 rounded-full border border-primary/10" />
                  <div>
                    <div className="font-black uppercase tracking-tight">{user.displayName}</div>
                    <div className="text-xs text-neutral-500">{user.email}</div>
                  </div>
                </div>
                <Link 
                  to="/" 
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 text-primary font-bold uppercase text-sm tracking-widest"
                >
                  <Home size={20} />
                  <span>Home</span>
                </Link>
                <Link 
                  to="/dashboard" 
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 text-primary font-bold uppercase text-sm tracking-widest"
                >
                  <LayoutDashboard size={20} />
                  <span>Dashboard</span>
                </Link>
                <Link 
                  to="/library" 
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 text-primary font-bold uppercase text-sm tracking-widest"
                >
                  <Package size={20} />
                  <span>Gear Library</span>
                </Link>
                <Link 
                  to="/racks" 
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 text-primary font-bold uppercase text-sm tracking-widest"
                >
                  <Server size={20} />
                  <span>Rack Management</span>
                </Link>
                <Link 
                  to="/projects" 
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 text-primary font-bold uppercase text-sm tracking-widest"
                >
                  <Briefcase size={20} />
                  <span>Projects</span>
                </Link>
                <Link 
                  to="/logistics" 
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 text-primary font-bold uppercase text-sm tracking-widest"
                >
                  <Truck size={20} />
                  <span>Logistics</span>
                </Link>
                {isFeatureEnabled('aiWizard', user, adminSettings) && (
                  <Link 
                    to="/ai-wizard" 
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 text-primary font-bold uppercase text-sm tracking-widest"
                  >
                    <Zap size={20} />
                    <span>Gig Assistant</span>
                  </Link>
                )}
                <Link 
                  to="/help" 
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 text-primary font-bold uppercase text-sm tracking-widest"
                >
                  <HelpCircle size={20} />
                  <span>Help Center</span>
                </Link>
                <Link 
                  to="/profile" 
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 text-primary font-bold uppercase text-sm tracking-widest"
                >
                  <User size={20} />
                  <span>Profile</span>
                </Link>
                {user.role === 'admin' && (
                  <Link 
                    to="/admin" 
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-3 text-primary font-bold uppercase text-sm tracking-widest"
                  >
                    <ShieldCheck size={20} />
                    <span>Admin Console</span>
                  </Link>
                )}
                <button
                  onClick={() => {
                    logout();
                    setIsMenuOpen(false);
                  }}
                  className="flex items-center gap-3 text-accent font-bold uppercase text-sm tracking-widest pt-4 border-t border-primary/5 w-full"
                >
                  <LogOut size={20} />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <>
                <Link 
                  to="/help" 
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center gap-3 text-primary font-bold uppercase text-sm tracking-widest"
                >
                  <HelpCircle size={20} />
                  <span>Help Center</span>
                </Link>
                <button
                  onClick={() => {
                    signInWithGoogle();
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-3 bg-primary text-white py-4 rounded-2xl font-bold uppercase text-sm tracking-widest shadow-lg"
                >
                  <LogIn size={20} />
                  <span>Sign In with Google</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
