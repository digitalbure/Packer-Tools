import React from 'react';
import { ShieldAlert, ArrowRight, Lock } from 'lucide-react';
import { signInWithGoogle } from '../firebase';
import PackerLogo from './PackerLogo';

export default function AuthGate() {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4 md:p-8 select-none font-sans">
      <div className="max-w-md w-full bg-white p-8 md:p-12 rounded-[2.5rem] border border-neutral-100 shadow-xl shadow-neutral-100/50 space-y-8 text-center animate-fadeIn">
        
        {/* Visual Brand Header & Badge */}
        <div className="space-y-4">
          <div className="flex justify-center">
            <PackerLogo variant="full" size={56} />
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
            <span>Sign In with Identity Provider</span>
            <ArrowRight size={14} className="group-hover:translate-x-[4px] transition-transform duration-155" />
          </button>
          
          <p className="text-[9px] text-neutral-400 uppercase tracking-widest font-black leading-relaxed">
            Verify via single sign-on to access the core logistics engine.
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
