import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, LogOut, LayoutDashboard, Settings, Package, User, Menu, X, Zap, HelpCircle, Server, Home, Truck, ShieldCheck, Briefcase } from 'lucide-react';
import PackerLogo from './PackerLogo';
import { signInWithGoogle, logout } from '../firebase';
import { UserProfile, AdminSettings } from '../types';
import { isFeatureEnabled } from '../lib/featureUtils';

export default function Navbar({ 
  user, 
  adminSettings, 
  onMenuClick,
  selectedCommunity,
  onOpenSelector
}: { 
  user: UserProfile | null, 
  adminSettings: AdminSettings | null, 
  onMenuClick?: () => void,
  selectedCommunity?: string | null,
  onOpenSelector?: () => void
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 group">
            {adminSettings?.branding?.logo ? (
              <div className="flex items-center gap-2">
                <img src={adminSettings.branding.logo} className="h-9 w-auto max-w-[140px] object-contain shrink-0 rounded-md" alt="Logo" referrerPolicy="no-referrer" />
                <span className="font-extrabold text-sm text-neutral-800 tracking-tight group-hover:text-primary transition-colors">
                  {adminSettings?.branding?.companyName || 'Packer Tools'}
                </span>
              </div>
            ) : (
              <PackerLogo variant="full" size={36} light={true} />
            )}
          </Link>

          {/* Active Community Badge */}
          {onOpenSelector && (
            <button 
              onClick={onOpenSelector}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-50 hover:bg-neutral-100 text-neutral-600 rounded-full text-xs font-semibold font-sans transition border border-neutral-200/50 cursor-pointer inline-flex"
              title="Click to switch community region"
            >
              <span>{currentComm ? currentComm.flag : '🌐'}</span>
              <span className="text-[10px] font-black uppercase tracking-wider">{currentComm ? currentComm.name : 'Global Portal'}</span>
              <span className="text-[8px] text-neutral-400">▼</span>
            </button>
          )}
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6">
          {user ? (
            <>
              <div className="flex items-center gap-4 pl-6">
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

        {/* Mobile Menu Toggle */}
        <button 
          onClick={user ? onMenuClick : toggleMenu}
          className="md:hidden p-2 text-primary hover:bg-primary/5 rounded-lg transition"
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
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
                    <span>AI Wizard</span>
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
