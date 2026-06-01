import React from 'react';
import { Link } from 'react-router-dom';
import { Package, ShieldCheck, Mail, HelpCircle, Heart } from 'lucide-react';
import PackerLogo from './PackerLogo';
import { AdminSettings } from '../types';

interface FooterProps {
  adminSettings: AdminSettings | null;
}

export default function Footer({ adminSettings }: FooterProps) {
  const currentYear = new Date().getFullYear();
  const companyName = adminSettings?.branding?.companyName || 'Packer Tools';

  return (
    <footer className="w-full bg-white border-t border-neutral-200/60 mt-12 py-12 px-6 sm:px-12 class-footer">
      <div className="max-w-[1700px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 items-start">
        
        {/* Branding Column */}
        <div className="md:col-span-2 space-y-4">
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
          <div className="flex items-center gap-2 pt-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-mono font-extrabold text-neutral-400 uppercase tracking-wider">
              Fiji Community 🇫🇯
            </span>
          </div>
        </div>

        {/* Workspace Quicklinks */}
        <div className="space-y-4 text-left">
          <h4 className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Active Workspace</h4>
          <ul className="space-y-2.5 text-xs font-bold text-neutral-600 uppercase tracking-wide">
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
        <div className="space-y-4 text-left font-sans">
          <h4 className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Help & Support Desk</h4>
          <ul className="space-y-2.5 text-xs font-bold text-neutral-600 uppercase tracking-wide">
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
                Version v1.0.0-beta.2 (Fiji Community)
              </span>
            </li>
          </ul>
        </div>

      </div>

      {/* Under footer */}
      <div className="max-w-[1700px] mx-auto border-t border-neutral-150 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] font-mono text-neutral-400">
        <div className="flex flex-wrap items-center gap-2">
          <span>&copy; {currentYear} {companyName}. All rights reserved.</span>
          <span>&bull;</span>
          <Link to="/privacy" className="hover:text-neutral-600 transition">Privacy Policy</Link>
          <span>&bull;</span>
          <Link to="/terms" className="hover:text-neutral-600 transition">Terms of Use</Link>
        </div>
        <div className="flex items-center gap-1">
          <span>Made in 🇫🇯 with 💙 | App by Digital Bure</span>
        </div>
      </div>
    </footer>
  );
}
