import React from 'react';
import { ShieldAlert, ArrowRight, Lock } from 'lucide-react';
import { signInWithGoogle } from '../firebase';
import PackerLogo from './PackerLogo';
import { AdminSettings } from '../types';

export default function AuthGate({ adminSettings }: { adminSettings?: AdminSettings | null }) {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4 md:p-8 select-none font-sans">
      <div className="max-w-md w-full bg-white p-8 md:p-12 rounded-[2.5rem] border border-neutral-100 shadow-xl shadow-neutral-100/50 space-y-8 text-center animate-fadeIn">
        
        {/* Visual Brand Header & Badge */}
        <div className="space-y-4">
          <div className="flex justify-center">
            {adminSettings?.branding?.logo ? (
              <div className="flex flex-col items-center gap-2">
                <img src={adminSettings.branding.logo} className="h-14 w-auto object-contain rounded-xl" alt="Logo" referrerPolicy="no-referrer" />
                <span className="font-black uppercase text-sm tracking-widest text-[#FF5500]">
                  {adminSettings?.branding?.companyName || 'Packer Tools'}
                </span>
              </div>
            ) : (
              <PackerLogo variant="full" size={56} />
            )}
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-100 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-widest mx-auto">
            <Lock size={12} className="animate-pulse" />
            <span>Authorized Access Only</span>
          </div>
        </div>

        {/* Informative Typography */}
        <div className="space-y-2">
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-neutral-800">
            System Identity Check
          </h1>
          <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider leading-relaxed">
            The platform administrator has configured this workspace to require authentication. Public landing page browsing is restricted.
          </p>
        </div>

        {/* Call to action element */}
        <div className="space-y-4 pt-2">
          <button
            onClick={signInWithGoogle}
            className="w-full py-4 bg-neutral-900 text-white hover:bg-black rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-neutral-900/10 transition-all duration-150 transform hover:-translate-y-[2px] active:translate-y-0 flex items-center justify-center gap-3 group"
          >
            <span>Sign In with Google</span>
            <ArrowRight size={14} className="group-hover:translate-x-[4px] transition-transform duration-155" />
          </button>

          <div className="relative py-2 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-100"></div>
            </div>
            <span className="relative px-3 bg-white text-[9px] font-black tracking-widest uppercase text-neutral-400">or</span>
          </div>

          <button
            onClick={() => {
              localStorage.setItem('packer_demo_bypass', 'true');
              window.location.reload();
            }}
            className="w-full py-3 bg-neutral-50 hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900 border border-neutral-200/80 hover:border-neutral-300 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-150 transform hover:-translate-y-[1px] active:translate-y-0"
          >
            Bypass & Use Demo Super Admin Profile
          </button>
          
          <p className="text-[9px] text-neutral-400 uppercase tracking-widest font-black leading-relaxed">
            Verify via single sign-on or bypass to access the core logistics engine.
          </p>
        </div>

        {/* Technical Footer */}
        <div className="pt-6 border-t border-neutral-100 text-[10px] text-neutral-400 font-bold uppercase tracking-wider flex items-center justify-between">
          <span>Packer Secure Gate</span>
          <span>v1.8.8-v2</span>
        </div>
      </div>
    </div>
  );
}
