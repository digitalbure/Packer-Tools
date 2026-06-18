import React from 'react';
import { Link } from 'react-router-dom';
import { Package, ShieldCheck, Mail, HelpCircle, Heart } from 'lucide-react';
import PackerLogo from './PackerLogo';
import { AdminSettings } from '../types';

interface FooterProps {
  adminSettings: AdminSettings | null;
  selectedCommunity?: string | null;
  onOpenSelector?: () => void;
}

export default function Footer({ adminSettings, selectedCommunity, onOpenSelector }: FooterProps) {
  const currentYear = new Date().getFullYear();
  const companyName = adminSettings?.branding?.companyName || 'Packer Tools';

  const activeCommunities = adminSettings?.communities || [
    { id: 'fiji', name: 'Fiji Community', country: 'Fiji', countryCode: 'FJ', currency: 'FJD', flag: '🇫🇯', companyName: 'Packer Tools Fiji', isActive: true },
    { id: 'australia', name: 'Australian Community', country: 'Australia', countryCode: 'AU', currency: 'AUD', flag: '🇦🇺', companyName: 'Packer Tools Australia', isActive: true },
    { id: 'new_zealand', name: 'New Zealand Community', country: 'New Zealand', countryCode: 'NZ', currency: 'NZD', flag: '🇳🇿', companyName: 'Packer Tools New Zealand', isActive: true }
  ];

  const currentComm = activeCommunities.find(c => c.id === selectedCommunity);
  
  let communityLabel = 'Global Portal 🌐';
  let versionSuffix = 'Global Site';

  if (currentComm) {
    communityLabel = `${currentComm.name} ${currentComm.flag}`;
    versionSuffix = currentComm.name;
  } else if (!selectedCommunity) {
    communityLabel = 'Select Community 📍';
    versionSuffix = 'Standard';
  }

  const footerConfig = adminSettings?.footerNavConfig || {
    enabled: true,
    alignMobileCentred: true,
    links: [
      { label: 'Workspaces', href: '/dashboard' },
      { label: 'Gear Library', href: '/library' },
      { label: 'Kiosk Terminal', href: '/kiosk' },
      { label: 'Client Booking', href: '/marketplace' },
      { label: 'Technical Help', href: '/help' }
    ]
  };

  const isMobileCentred = footerConfig.alignMobileCentred;

  return (
    <footer className="w-full bg-white border-t border-neutral-200/60 mt-12 py-12 px-6 sm:px-12 class-footer">
      <div className="max-w-[1700px] mx-auto">
        
        {/* Footer Navigation Menu (Optional / Enabled by Admin) */}
        {footerConfig.enabled && footerConfig.links && footerConfig.links.length > 0 && (
          <div className={`mb-10 pb-8 border-b border-neutral-150 flex flex-wrap gap-x-8 gap-y-4 items-center ${isMobileCentred ? 'justify-center text-center' : 'justify-center md:justify-start text-left'}`}>
            {footerConfig.links.map((link, idx) => (
              link.isExternal ? (
                <a
                  key={idx}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-black text-neutral-500 hover:text-primary transition uppercase tracking-widest font-mono"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={idx}
                  to={link.href}
                  className="text-xs font-black text-neutral-500 hover:text-primary transition uppercase tracking-widest font-mono"
                >
                  {link.label}
                </Link>
              )
            ))}
          </div>
        )}

        <div className={`grid grid-cols-1 md:grid-cols-4 gap-10 items-start ${isMobileCentred ? 'text-center md:text-left' : 'text-left'}`}>
          
          {/* Branding Column */}
          <div className={`md:col-span-2 space-y-4 ${isMobileCentred ? 'flex flex-col items-center md:items-start text-center md:text-left' : 'text-left'}`}>
            <Link to="/" className="inline-flex items-center gap-1 group">
              {adminSettings?.branding?.logo ? (
                <div className="flex items-center gap-2">
                  <img src={adminSettings.branding.logo} className="h-8 w-auto max-w-[120px] object-contain shrink-0 rounded-md" alt="Logo" referrerPolicy="no-referrer" />
                  <span className="font-extrabold text-sm text-neutral-800 tracking-tight group-hover:text-primary transition-colors">
                    {companyName}
                  </span>
                </div>
              ) : (
                <PackerLogo variant="full" size={32} light={true} />
              )}
            </Link>
            <p className="text-xs text-neutral-500 font-semibold leading-relaxed max-w-sm">
              Professional-grade AV logistics, rack assembly planning, and gear lifecycle orchestration. Built for high-stakes on-set execution.
            </p>
            <div 
              onClick={onOpenSelector}
              className="flex items-center gap-2 pt-2 cursor-pointer hover:opacity-85 transition group inline-flex"
              title="Switch geographic community hub"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono font-extrabold text-neutral-400 group-hover:text-primary uppercase tracking-wider transition-colors">
                {communityLabel} • Switch Hub
              </span>
            </div>
          </div>
          
          {/* Workspace Quicklinks */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Active Workspace</h4>
            <ul className={`space-y-2.5 text-xs font-bold text-neutral-600 uppercase tracking-wide ${isMobileCentred ? 'flex flex-col items-center md:items-start' : ''}`}>
              <li>
                <Link to="/dashboard" className="hover:text-primary transition flex items-center gap-2">
                  <span>Dashboard Overview</span>
                </Link>
              </li>
              <li>
                <Link to="/library" className="hover:text-primary transition flex items-center gap-2">
                  <span>Gear Library Inventory</span>
                </Link>
              </li>
              <li>
                <Link to="/profile" className="hover:text-primary transition flex items-center gap-2">
                  <span>Subscription Seats</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources & Help */}
          <div className="space-y-4 font-sans">
            <h4 className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Help & Support Desk</h4>
            <ul className={`space-y-2.5 text-xs font-bold text-neutral-600 uppercase tracking-wide ${isMobileCentred ? 'flex flex-col items-center md:items-start' : ''}`}>
              <li>
                <Link to="/contact" className="hover:text-primary transition flex items-center gap-1.5">
                  <Mail size={12} className="text-neutral-400 shrink-0" />
                  <span>Submit Technical Enquiry</span>
                </Link>
              </li>
              <li>
                <Link to="/help" className="hover:text-primary transition flex items-center gap-1.5">
                  <HelpCircle size={12} className="text-neutral-400 shrink-0" />
                  <span>Reference Guide Docs</span>
                </Link>
              </li>
              <li>
                <span className="text-[10px] text-neutral-400 font-mono tracking-tighter">
                  Version v4.14.0 ({versionSuffix})
                </span>
              </li>
            </ul>
          </div>

        </div>
      </div>

      {/* Under footer */}
      <div className={`max-w-[1700px] mx-auto border-t border-neutral-150 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] font-mono text-neutral-400 ${isMobileCentred ? 'text-center' : ''}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span>&copy; {currentYear} {companyName}. All rights reserved.</span>
          <span>&bull;</span>
          <Link to="/pg/privacy-policy" className="hover:text-neutral-600 transition">Privacy Policy</Link>
          <span>&bull;</span>
          <Link to="/pg/terms-of-service" className="hover:text-neutral-600 transition">Terms of Use</Link>
          <span>&bull;</span>
          <Link to="/pg/refund-policy" className="hover:text-neutral-600 transition">Refund Policy</Link>
        </div>
        <div className="flex items-center gap-1">
          <span>{currentComm ? `Community: ${currentComm.name}` : 'Global Site'} | App by Digital Bure</span>
        </div>
      </div>
    </footer>
  );
}
