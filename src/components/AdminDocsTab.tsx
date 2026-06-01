import React from 'react';
import { BookOpen, Award, Layers, Globe, FileText, CheckCircle, ShieldAlert, Zap, Cpu, Settings, Smartphone, Clipboard } from 'lucide-react';

export default function AdminDocsTab() {
  return (
    <div className="space-y-12 text-left animate-in fade-in duration-300">
      {/* Hero Banner */}
      <div className="bg-neutral-900 text-white rounded-[2.5rem] p-8 sm:p-10 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/20 blur-[100px] -mr-10 -mt-10 rounded-full" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-emerald-500/10 blur-[90px] -ml-20 -mb-20 rounded-full" />

        <div className="relative space-y-4 max-w-3xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-primary border border-white/5 text-[9px] font-black uppercase tracking-widest leading-none">
            🎓 Packer Tools University & Reference Guide
          </span>
          <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tight leading-none text-white leading-[1.05]">
            Master Platform Features & Client Widgets
          </h2>
          <p className="text-neutral-400 text-sm leading-relaxed max-w-2xl font-medium">
            Deploy full-stack inventory workflows, build robust logistics sheets, and master barcode scanning. Control custom embeds to enable third-party clients to view your rental catalogs directly from your websites.
          </p>
        </div>
      </div>

      {/* Platform & SDK Version Status Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm space-y-1">
          <p className="text-[9px] font-black tracking-widest uppercase text-neutral-400">Platform Build</p>
          <p className="text-2xl font-black text-neutral-950">v2.4.9</p>
          <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[8px] font-mono font-bold">Stable Core</span>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm space-y-1">
          <p className="text-[9px] font-black tracking-widest uppercase text-neutral-400 font-mono">AI Scraper Engine</p>
          <p className="text-2xl font-black text-neutral-950">v1.2.6</p>
          <span className="inline-block px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[8px] font-mono font-bold">Gemini Live</span>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm space-y-1">
          <p className="text-[9px] font-black tracking-widest uppercase text-neutral-400">Embed Widget SDK</p>
          <p className="text-2xl font-black text-neutral-950">v1.0.8</p>
          <span className="inline-block px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[8px] font-mono font-bold">CORS Whitelisted</span>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm space-y-1">
          <p className="text-[9px] font-black tracking-widest uppercase text-neutral-400 font-mono">DB Schema Spec</p>
          <p className="text-2xl font-black text-neutral-950">v3.1.2</p>
          <span className="inline-block px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[8px] font-mono font-bold">Encrypted Keys</span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Core documentation blocks - left columns */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Section 1: Major Functional Modules & Widgets */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2 text-neutral-950">
              <Layers className="text-primary" size={20} />
              <span>1. Functional Modules & Embedded Components</span>
            </h3>
            <p className="text-xs text-neutral-500 leading-relaxed font-medium">
              Packer Tools operates utilizing multiple integrated state managers synchronizing database structures to prevent discrepancies across operations:
            </p>

            <div className="space-y-6">
              <div className="border-l-2 border-primary pl-4 space-y-1">
                <p className="text-xs font-black uppercase text-neutral-900">● Gear Library Module (`/gear` & `/bio` pages)</p>
                <p className="text-neutral-500 text-xs leading-relaxed">
                  The primary central repository for all physical high-value company assets. Keeps records of model names, brands, barcode serialization, upkeep intervals, structural metrics (weight/volume), and condition categories. Facilitates QR scanner printing directly.
                </p>
              </div>

              <div className="border-l-2 border-emerald-500 pl-4 space-y-1">
                <p className="text-xs font-black uppercase text-neutral-900">● Custom Inventory Module & Sheets (`/inventories` collections)</p>
                <p className="text-neutral-500 text-xs leading-relaxed">
                  Designed for non-synchronized standalone logistics operations (e.g. customized expedition kits or supplier lists). Built with standard bulk assign states, AI spreadsheet header importers, and our proprietary **Lead-Time & Supply Chain Analyzer**.
                </p>
              </div>

              <div className="border-l-2 border-indigo-500 pl-4 space-y-1">
                <p className="text-xs font-black uppercase text-neutral-900">● Barcode Scanner & Kiosk Terminal Module</p>
                <p className="text-neutral-500 text-xs leading-relaxed">
                  An isolated responsive full-width environment (Kiosk mode) suited for mounting on tablet screens inside warehouse bays. Allows operators to scan barcodes using integrated mobile cameras, check gear allocation instantly, block duplicates, and inspect maintenance timers.
                </p>
              </div>

              <div className="border-l-2 border-purple-505 pl-4 space-y-1">
                <p className="text-xs font-black uppercase text-neutral-900">● Global Multi-tenant Architecture</p>
                <p className="text-neutral-500 text-xs leading-relaxed">
                  Enforces Zero-Trust isolation. Teams, Departments, and Organizations map directly to resources. Collaborators have restricted access controls (Viewer, Editor, Moderator, Owner).
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Embedding the Rental Storefront */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2 text-neutral-950">
              <Globe className="text-emerald-500" size={20} />
              <span>2. Storefront Embed Widgets & API Rules</span>
            </h3>
            <p className="text-xs text-neutral-500 leading-relaxed font-semibold">
              Publish and rent items easily. By including standard IFRAME layouts or CDN script tag bundles, users create visual rental shops anywhere on external properties:
            </p>

            <div className="grid sm:grid-cols-2 gap-6">
              <div className="p-5 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-3">
                <span className="text-[8px] px-2.5 py-0.5 bg-[#ff4f3a]/10 text-primary font-black uppercase tracking-wider rounded-full">IFRAME Option</span>
                <p className="text-xs font-bold text-neutral-905">Responsive Sandbox Containers</p>
                <p className="text-neutral-500 text-[11px] leading-relaxed">
                  Ideal for low-code platform builders like Squarespace or Wordpress. Embeds entire lists or specific gear catalogs. Adapts to mobile dimensions, facilitates checking item specifications, and triggers checkout popups safely.
                </p>
              </div>

              <div className="p-5 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-3">
                <span className="text-[8px] px-2.5 py-0.5 bg-indigo-50 text-indigo-600 font-black uppercase tracking-wider rounded-full">SDK Option</span>
                <p className="text-xs font-bold text-neutral-905">CDN-Loaded Dynamic HTML Templates</p>
                <p className="text-neutral-500 text-[11px] leading-relaxed">
                  Ideal for React or custom web developers. The SDK script injects custom components directly onto your landing properties without CSS clashes. List data is fetched asynchronously via CORS proxy.
                </p>
              </div>
            </div>

            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-amber-800 text-xs flex gap-3">
              <ShieldAlert size={18} className="shrink-0 mt-0.5" />
              <div>
                <strong className="font-extrabold block mb-1 uppercase tracking-tight">Security Caution</strong>
                Your confidential API credentials (`pk_live_packer_...`) grant total retrieval access code permissions. Never write credentials onto client-side JavaScript. Keep them isolated inside secure backend servers.
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Packer Tools University Curriculum */}
        <div className="space-y-8">
          {/* Packer Tools University block */}
          <div className="bg-emerald-50/40 p-8 rounded-[2.5rem] border border-emerald-100 shadow-sm space-y-6">
            <div className="flex items-center gap-2">
              <Award className="text-emerald-600" size={22} />
              <h3 className="font-bold text-lg text-neutral-950 uppercase tracking-tight">Packer University</h3>
            </div>
            
            <p className="text-xs text-neutral-600 font-medium leading-relaxed">
              Step-by-step masterclass courses for operators. Follow these exact workflows to maintain operational efficiency:
            </p>

            <div className="space-y-4 text-xs font-sans">
              <div className="space-y-1">
                <p className="font-bold text-neutral-800 flex items-center gap-1.5">
                  <span className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center text-[10px] text-emerald-800 font-black font-mono">1</span>
                  <span>Upkeep Diagnostics</span>
                </p>
                <p className="text-neutral-500 leading-relaxed pl-6">
                  Navigate to Gear Library, activate 'Audit View' to filter items whose physical status needs maintenance. Check calibration dates and interval timers.
                </p>
              </div>

              <div className="space-y-1 col-span-2">
                <p className="font-bold text-neutral-800 flex items-center gap-1.5">
                  <span className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center text-[10px] text-emerald-800 font-black font-mono">2</span>
                  <span>Seamless Barcode Allocation</span>
                </p>
                <p className="text-neutral-500 leading-relaxed pl-6">
                  Open terminal inside Kiosk panel, align your mobile camera with standard barcodes on cases. System matches models and registers check-out/check-in logs in real-time.
                </p>
              </div>

              <div className="space-y-1">
                <p className="font-bold text-neutral-800 flex items-center gap-1.5">
                  <span className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center text-[10px] text-emerald-800 font-black font-mono">3</span>
                  <span>Supply-Chain Risk Management</span>
                </p>
                <p className="text-neutral-500 leading-relaxed pl-6 font-medium">
                  Trigger the Lead Time Scraper against suppliers. Fallback heuristic engines automatically alert if any logistical lag risks delayed deployment.
                </p>
              </div>
            </div>
          </div>

          {/* Quick FAQ / Contacts Panel */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
            <h3 className="text-sm font-black uppercase text-neutral-900 tracking-wider">Quick Platform Support</h3>
            <div className="space-y-4 text-xs text-neutral-600">
              <p>For custom database overrides or special volume white-label layouts, reach out directly:</p>
              <div className="space-y-1 font-mono text-[11px] text-neutral-500 font-semibold">
                <p>● Email: support@packer_tools.run.app</p>
                <p>● Live Slack: #packer-enterprise-university</p>
                <p>● Hours: 24/7 Premium SLA Support</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
