import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, ArrowRight, Package, Shield, Globe, Zap, Camera, QrCode, ShoppingBag, Truck } from 'lucide-react';
import { UserProfile, AdminSettings, LandingPageFeature } from '../types';
import { signInWithGoogle } from '../firebase';
import PackerLogo from '../components/PackerLogo';
import { motion, AnimatePresence } from 'motion/react';
import Marketplace from './Marketplace';

const iconMap: { [key: string]: React.ReactNode } = {
  Camera: <Camera size={24} />,
  QrCode: <QrCode size={24} />,
  ShoppingBag: <ShoppingBag size={24} />,
  Truck: <Truck size={24} />,
  Zap: <Zap size={24} />,
  Shield: <Shield size={24} />,
  Globe: <Globe size={24} />,
  Package: <Package size={24} />
};

const DEFAULT_SCENARIOS = [
  {
    title: "Film & Photo Production",
    image: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&q=80&w=800",
    industry: "Cinema Crews & Live Broadcasters",
    description: "Camera operators, DITs, and rental houses tracking cine gear, active lenses, and rigs across intense production schedules. Simple QR scans instantly verify kit checkouts."
  },
  {
    title: "Alpine & Field Expeditions",
    image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=800",
    industry: "Mountaineers, Guides & Explorers",
    description: "Safety leads preparing cold-weather equipment lists. Dynamic weight metrics provide critical trail-load visibility to optimize cargo distribution on mountain slopes."
  },
  {
    title: "Tactical & Clinical Dispatch",
    image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=800",
    industry: "Tactical Logistics & Medical Teams",
    description: "Clinical responders and field technicians deploying search/life-support kits under high-pressure scenarios. Kiosk check-in logs ensure secure, non-reputable custody verification."
  },
  {
    title: "Asset Co-ops & Digital Garages",
    image: "https://images.unsplash.com/photo-1533560904424-a0c61dc306fc?auto=format&fit=crop&q=80&w=800",
    industry: "Tool Cooperatives & Shared Repots",
    description: "Rental establishments or community gear rooms organizing items with real-time maintenance logs, health scoring, and one-click public listing deployment."
  }
];

const DEFAULT_FAQ = [
  {
    question: "How do Public vs. Private kit settings work?",
    answer: "Each kit prepared by an owner can have its visibility adjusted. Private kits restrict access to the authorized preparer—extremely useful when prepping gear lists for specific clients, experimental builds, or confidential teams. Public lists can be shared via QR code scanning or hyperlinks with clients and field team associates so they can review packing specs easily."
  },
  {
    question: "What exactly is the Gemini-powered AI Shutter Scan?",
    answer: "It is our deep-learning equipment logger. Snapshot or upload a photo of your hardware—such as a cinema camera body, drone, lenses, or clinical box—and our integrated Gemini API instantly parses manufacturer attributes, model spec details, and outputs dynamic description templates."
  },
  {
    question: "Can I use existing vinyl barcodes or physical QR tags?",
    answer: "Absolutely! Packer Tools creates dedicated asset passport URLs for every unit. You can print our beautiful QR tags on standard sheets, or link your existing barcode labels, serial tags, or engraved steel metal stamps directly into your item records."
  },
  {
    question: "What target industries rely on Packer Tools?",
    answer: "Our software is built specifically for commercial filmmakers, touring theatrical stage crews, search response leads, high-altitude outdoors programs, and shared equipment libraries where a single missing accessory halts full operations."
  }
];

const DEFAULT_TESTIMONIALS = [
  {
    content: "Packer Tools has reduced kit errors to absolute zero. Before trucks depart, crew members take active scans of our private packages, and our dashboard flags any missing auxiliary wire or battery.",
    name: "Marcus Vance",
    role: "Core Cinematographer",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150"
  },
  {
    content: "When climbing remote alpine runs, carry weight is survival. The app's dynamic weight-planning indices let us coordinate survival equipment lists and pack lists down to the gram.",
    name: "Elena Rostova",
    role: "Outdoor Safety Leader",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150"
  },
  {
    content: "Our crisis responder medical packs require extreme precision. The kiosk handshake removes compliance guesswork and assures on-scene professionals that kits are perfect.",
    name: "Dr. Kenji Tanaka",
    role: "Disaster Logistics Lead",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150"
  }
];

const IndustrialTicker = ({ pairs }: { pairs: { by: string, for: string }[] }) => {
  const validPairs = Array.isArray(pairs) 
    ? pairs.filter(p => p && typeof p.by === 'string' && typeof p.for === 'string')
    : [];

  const activePairs = validPairs.length > 0 ? validPairs : [
    { by: "Production Crews", for: "Camera Kit Labeling" },
    { by: "Logistics Teams", for: "Team Kit Distribution" },
    { by: "Mountaineers", for: "Expedition Readiness" },
    { by: "Safety Teams", for: "Compliance Audit Reporting" }
  ];

  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [activePairs.length]);

  useEffect(() => {
    if (activePairs.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % activePairs.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [activePairs.length]);

  const currentPair = activePairs[index] || { by: "", for: "" };

  return (
    <div className="space-y-8 md:space-y-12 max-w-full overflow-visible">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-3 bg-primary" />
          <span className="micro-label text-neutral-400">Used By</span>
        </div>
        <div className="relative min-h-[4rem] md:min-h-[6rem] flex items-start overflow-visible">
          <AnimatePresence mode="wait">
            <motion.div
              key={`by-${index}`}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
              className="w-full"
            >
              <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase text-primary font-mono leading-[0.9] break-words">
                {currentPair.by}
              </h2>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-3 bg-accent" />
          <span className="micro-label text-neutral-400">Used For</span>
        </div>
        <div className="relative min-h-[4rem] md:min-h-[6rem] flex items-start overflow-visible">
          <AnimatePresence mode="wait">
            <motion.div
              key={`for-${index}`}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
              className="w-full"
            >
              <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase text-accent font-mono leading-[0.9] break-words">
                {currentPair.for}
              </h2>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

const AIRecognitionDisplay = ({ config }: { config?: AdminSettings['aiRecognitionConfig'] }) => {
  const defaultItems = [
    {
      id: '1',
      name: "Sony A7IV",
      details: "Identified with 24-70mm f/2.8 GM II",
      image: "https://images.unsplash.com/photo-1542332213-9b5a5a3fad35?auto=format&fit=crop&q=80&w=2000",
      icon: 'Camera'
    },
    {
      id: '2',
      name: "DJI Mavic 3 Pro",
      details: "Triple-camera system detected",
      image: "https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&q=80&w=2000",
      icon: 'Package'
    },
    {
      id: '3',
      name: "Arc'teryx Alpha SV",
      details: "GORE-TEX PRO shell identified",
      image: "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&q=80&w=2000",
      icon: 'Shield'
    },
    {
      id: '4',
      name: "Peak Design Travel",
      details: "45L Backpack - Sage Edition",
      image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=2000",
      icon: 'Package'
    },
    {
      id: '5',
      name: "Blackmagic Pocket 6K",
      details: "EF Mount with Rigging detected",
      image: "https://images.unsplash.com/photo-1533310266094-8898a03807dd?auto=format&fit=crop&q=80&w=2000",
      icon: 'Camera'
    }
  ];

  const items = config?.items || defaultItems;
  const interval = config?.interval || 6000;
  const isEnabled = config?.enabled !== false;

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!isEnabled || items.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length);
    }, interval);
    return () => clearInterval(timer);
  }, [items.length, interval, isEnabled]);

  if (!isEnabled) return null;

  return (
    <div className="flex-1 relative bg-neutral-200 overflow-hidden min-h-[400px] lg:min-h-full">
      <AnimatePresence mode="wait">
        <motion.img
          key={`img-${index}`}
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          src={items[index].image}
          alt={items[index].name}
          className="absolute inset-0 w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-1000"
          referrerPolicy="no-referrer"
        />
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-t from-paper/40 to-transparent" />
      
      <div className="absolute bottom-8 left-8 right-8 glass p-6 rounded-2xl flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={`icon-${index}`}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white"
            >
              {iconMap[items[index].icon] || <Package size={24} />}
            </motion.div>
          </AnimatePresence>
          <div>
            <div className="font-bold flex items-center gap-2">
              <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
              AI Recognition Active
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={`text-${index}`}
                initial={{ y: 5, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -5, opacity: 0 }}
                className="text-xs text-neutral-500"
              >
                <span className="font-bold text-primary">{items[index].name}</span> {items[index].details}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        <div className="w-10 h-10 border border-primary/10 rounded-full flex items-center justify-center">
          <div className="w-2 h-2 bg-accent rounded-full animate-ping" />
        </div>
      </div>
    </div>
  );
};

const featureKeyLabels: Record<string, string> = {
  aiWizard: "AI List Generator",
  gearLibrary: "Central Gear Library",
  reminders: "Maintenance Alerts",
  versionHistory: "Version History",
  branding: "Custom Branding",
  qrSharing: "Asset QR Codes",
  toolingLists: "Field Tooling Lists",
  organizer: "Kit Organizer",
  travelCases: "Case Dimensioning Solver",
  logisticsDashboard: "Logistics Dashboard",
  movingDashboard: "Moving Log",
  rackingDashboard: "Racks & Shell Shelving",
  marketplace: "Lender Shopfronts",
  marketplaceListings: "Commercial Listings",
  kioskMode: "Kiosk Checkout Terminal",
  orgManagement: "Organization Security",
  departments: "Dynamic Departments",
  teams: "Team Segregation",
  inventoryManagement: "Active Warehouse Inventory",
  projectCost: "Project Cost Estimating",
  supplierManagement: "Supplier Catalogues",
  bomManagement: "BOM Kit Deconstruction",
  customBarcodes: "Custom Barcodes & Labels",
  automaticDepreciation: "Asset Depreciation Log",
  digitalSignatures: "Authorized Sign-offs",
  clientPortal: "Client Rental App",
  apiIntegrations: "External Integrations",
  weightAnalytics: "Transit Weight Optimization",
  kioskOrderMode: "Smart Checkout Queue",
  kioskDirectCheckout: "Direct Tap Out"
};

export default function LandingPage({ 
  user, 
  adminSettings,
  landingView: parentLandingView,
  setLandingView: parentSetLandingView
}: { 
  user: UserProfile | null, 
  adminSettings: AdminSettings | null,
  landingView?: string,
  setLandingView?: (view: string) => void
}) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [localLandingView, setLocalLandingView] = useState<string>('saas');

  const landingView = parentLandingView !== undefined ? parentLandingView : localLandingView;
  const setLandingView = parentSetLandingView !== undefined ? parentSetLandingView : setLocalLandingView;

  const plans = adminSettings?.plans || [];
  const activeLander = adminSettings?.landers?.find(l => l.id === adminSettings.activeLanderId);
  
  // Use new structure if available, otherwise fallback to old one
  const lp = activeLander?.content || adminSettings?.landingPage;
  const isMarketplaceActive = landingView === 'marketplace';

  if (isMarketplaceActive) {
    return (
      <div className="min-h-screen bg-paper text-primary selection:bg-accent selection:text-white bg-grid overflow-x-hidden pt-4">
        <div className="animate-fadeIn">
          <Marketplace user={user} adminSettings={adminSettings} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-primary selection:bg-accent selection:text-white bg-grid overflow-x-hidden">
      {/* Hero Section - Split Layout */}
      {(lp?.hero?.isEnabled !== false) && (
        <section className="relative min-h-screen flex flex-col lg:flex-row border-b border-primary/10 overflow-hidden pt-4">
          {/* Animated Industrial Gradient */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 5, 0],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-accent/5 blur-[120px] rounded-full pointer-events-none"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            rotate: [0, -5, 0],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] bg-safety-yellow/5 blur-[120px] rounded-full pointer-events-none"
        />

        <div className="flex-1 flex flex-col justify-center p-8 lg:p-24 space-y-16 relative z-10">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            <div className="flex items-center gap-3">
              <span className="micro-label">{lp?.hero?.subtitle || 'Industrial Grade Gear Tracking'}</span>
            </div>
                    <h1 className="text-6xl md:text-[120px] font-black tracking-tighter leading-[0.82] uppercase whitespace-pre-line">
              {typeof lp?.hero?.title === 'string' ? lp.hero.title.split('. ').map((part, i) => (
                <span key={i} className={i % 2 !== 0 ? 'text-accent' : 'text-primary'}>
                  {part}{i < lp.hero.title.split('. ').length - 1 ? '.' : ''} <br />
                </span>
              )) : (
                <>
                  Visual <br />
                  <span className="text-accent">Inventory.</span> <br />
                  Instant <br />
                  <span className="text-primary">Market.</span>
                </>
              )}
            </h1>
            
            {(lp?.ticker?.isEnabled !== false) && (
              <div className="max-w-md">
                <IndustrialTicker 
                  pairs={Array.isArray(lp?.ticker?.pairs) ? lp.ticker.pairs : [
                    { by: "Production Crews", for: "Camera Kit Labeling" },
                    { by: "Logistics Teams", for: "Team Kit Distribution" },
                    { by: "Mountaineers", for: "Expedition Readiness" },
                    { by: "Global Logistics", for: "Asset Accountability" },
                    { by: "Rental Houses", for: "Lifecycle Management" },
                    { by: "Hikers & Backpackers", for: "Trail Weight Optimization" },
                    { by: "Touring Artists", for: "Backstage Inventory" },
                    { by: "Field Engineers", for: "Tooling Deployment" }
                  ]} 
                />
              </div>
            )}

            <p className="text-xl text-neutral-500 max-w-md leading-relaxed font-medium">
              {lp?.hero?.description || 'Professional-grade lifecycle management for high-stakes equipment. Visual verification, asset tracking, and one-click marketplace deployment.'}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap gap-4"
          >
            {user ? (
              <Link
                to="/dashboard"
                className="group flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-full font-bold transition-all hover:gap-5"
              >
                Go to Dashboard
                <ArrowRight size={20} />
              </Link>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="group flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-full font-bold transition-all hover:gap-5"
              >
                {lp?.hero?.primaryButtonText || 'Get Started'}
                <ArrowRight size={20} />
              </button>
            )}
            <a
              href="#scenarios"
              className="px-8 py-4 border border-primary/10 rounded-full font-bold hover:bg-white transition-colors"
            >
              {lp?.hero?.secondaryButtonText || 'Explore Use Cases'}
            </a>
            
            <button
              type="button"
              onClick={() => setLandingView('marketplace')}
              className="px-8 py-4 bg-accent/10 text-accent hover:bg-accent/20 border border-accent/20 rounded-full font-bold transition-all flex items-center gap-2 cursor-pointer"
            >
              <ShoppingBag size={18} />
              Browse Marketplace
            </button>
          </motion.div>

          {(lp?.stats?.isEnabled !== false) && (
            <div className="pt-12 grid grid-cols-3 gap-8 border-t border-primary/5">
              {(Array.isArray(lp?.stats?.items) ? lp.stats.items : [
                { label: "Recognition", value: "99.2%" },
                { label: "Active Users", value: "12k+" },
                { label: "Kits Managed", value: "450k" }
              ]).map((stat, i) => (
                <div key={i} className="space-y-1">
                  <div className="text-2xl font-black tracking-tighter">{stat.value}</div>
                  <div className="micro-label text-[8px]">{stat.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <AIRecognitionDisplay config={adminSettings?.aiRecognitionConfig} />
      </section>
      )}

      {/* Value Proposition - Grid Layout */}
      {(lp?.features?.isEnabled !== false) && (
        <section className="py-24 px-8 max-w-7xl mx-auto relative">
          {/* Industrial Gradient Accents */}
          <div className="absolute top-0 left-0 w-64 h-64 bg-accent/5 blur-[100px] rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-safety-yellow/5 blur-[120px] rounded-full translate-x-1/2 translate-y-1/2" />

          <div className="grid md:grid-cols-2 gap-24 items-end mb-24 relative z-10">
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase leading-[0.85]">
              {lp?.features?.title ? lp.features.title.split(' ').map((word, i) => (
                <React.Fragment key={i}>
                  {i === lp.features.title.split(' ').length - 1 ? <span className="text-neutral-400">{word}</span> : word}
                  {i < lp.features.title.split(' ').length - 1 && <br />}
                </React.Fragment>
              )) : (
                <>
                  Built for <br />
                  <span className="text-neutral-400">The Field.</span>
                </>
              )}
            </h2>
            <p className="text-xl text-neutral-500 leading-relaxed font-medium pb-2">
              {lp?.features?.description || "We've engineered a system that thrives in high-pressure environments. From remote expeditions to back-to-back production schedules."}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-1px bg-primary/10 border border-primary/10 rounded-3xl overflow-hidden relative z-10">
            {( Array.isArray((lp?.features as any)?.items) ? (lp.features as any).items : [
              { 
                icon: 'Camera', 
                title: "Visual Audit", 
                description: "Every item requires a photographic record. No more 'I thought I packed it'—absolute accountability for every piece of gear." 
              },
              { 
                icon: 'QrCode', 
                title: "Asset Integration", 
                description: "Seamlessly bridge digital lists with physical hardware using our integrated QR and Asset Tag scanning system." 
              },
              { 
                icon: 'ShoppingBag', 
                title: "Marketplace Sync", 
                description: "Instantly deploy gear lists to global marketplaces. One-click sharing with professional formatting and visual verification." 
              }
            ] ).map((feature: any, i: number) => (
              <div key={i} className="bg-paper p-12 space-y-8 hover:bg-white transition-all duration-500 group border-b md:border-b-0 md:border-r border-primary/5 last:border-0">
                <div className="w-12 h-12 flex items-center justify-center text-primary group-hover:text-accent transition-colors">
                  {iconMap[feature.icon] || <Package />}
                </div>
                <div className="space-y-4">
                  <h3 className="text-2xl font-black tracking-tight uppercase">{feature.title}</h3>
                  <p className="text-neutral-500 leading-relaxed text-sm">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Safety Stripe Divider */}
      <div className="h-4 safety-stripes w-full" />
      {(lp?.scenarios?.isEnabled !== false) && (
        <section id="scenarios" className="py-24 border-t border-primary/10 bg-paper/50 relative overflow-hidden">
          <div className="px-8 max-w-7xl mx-auto space-y-16 relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-end gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-safety-yellow rounded-full animate-pulse" />
                  <span className="micro-label">Field Operations</span>
                </div>
                <h2 className="text-5xl font-black tracking-tighter uppercase text-primary">{lp?.scenarios?.title || 'Target Sectors & Use Cases'}</h2>
              </div>
              <p className="text-neutral-500 max-w-sm text-sm font-medium">
                {lp?.scenarios?.subtitle || 'Engineered directly for critical industries requiring absolute digital accountability of physical hardware. Build, verify, and pack with zero list leakage.'}
              </p>
            </div>
 
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {(Array.isArray((lp?.scenarios as any)?.items) ? (lp.scenarios as any).items : DEFAULT_SCENARIOS).map((s: any, i: number) => (
                <motion.div 
                  key={i}
                  whileHover={{ y: -5 }}
                  className="bg-white rounded-[2rem] border border-primary/5 p-6 space-y-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="relative aspect-[4/3] rounded-2xl overflow-hidden group">
                      <img src={s.image} alt={s.title} className="absolute inset-0 w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" referrerPolicy="no-referrer" />
                      <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent opacity-40 animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <div className="font-mono text-[8px] text-accent tracking-widest font-black uppercase">SECTOR 0{i + 1} // {s.industry || 'FIELD WORKLAND'}</div>
                      <h3 className="text-xl font-black uppercase tracking-tight text-neutral-900 leading-tight">{s.title}</h3>
                      <p className="text-xs text-neutral-500 leading-relaxed font-semibold">{s.description || s.useCase}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Safety Stripe Divider */}
      <div className="h-4 safety-stripes w-full" />

      {/* Testimonials */}
      {(lp?.testimonials?.isEnabled !== false) && (
        <section className="py-24 px-8 max-w-7xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-5xl font-black tracking-tighter uppercase text-primary">{lp?.testimonials?.title || "HEARD FROM ACTIVE OPERATIONS"}</h2>
            <p className="text-neutral-500 font-medium max-w-md mx-auto">{lp?.testimonials?.subtitle || "Real field feedback from engineers and safety leads trusted to pack and deploy critical hardware."}</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {(Array.isArray(lp?.testimonials?.items) ? lp.testimonials.items : DEFAULT_TESTIMONIALS).map((t: any, i: number) => (
              <div key={i} className="bg-white p-8 rounded-[2rem] border border-neutral-100 shadow-sm space-y-6 hover:shadow-md transition-all">
                <p className="text-sm font-medium leading-relaxed italic text-neutral-600">"{t.content}"</p>
                <div className="flex items-center gap-4 pt-2 border-t border-neutral-50">
                  {t.avatar && <img src={t.avatar} alt={t.name} className="w-12 h-12 rounded-full object-cover border border-neutral-200" referrerPolicy="no-referrer" />}
                  <div>
                    <div className="font-black uppercase tracking-tighter text-neutral-800">{t.name}</div>
                    <div className="text-[10px] text-neutral-400 font-extrabold uppercase tracking-widest">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FAQ Section */}
      {(lp?.faq?.isEnabled !== false) && (
        <section id="faq" className="py-24 px-8 max-w-4xl mx-auto border-t border-neutral-100">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-5xl font-black tracking-tighter uppercase text-primary">{lp?.faq?.title || "FREQUENT HANDSHAKES & FAQ"}</h2>
            <p className="text-neutral-500 font-medium">{lp?.faq?.subtitle || "Everything you need to know about Packer's digital-to-physical inventory pipeline."}</p>
          </div>
          <div className="space-y-4">
            {(Array.isArray(lp?.faq?.items) ? lp.faq.items : DEFAULT_FAQ).map((item: any, i: number) => (
              <div key={i} className="bg-white p-8 rounded-3xl border border-neutral-150/60 shadow-sm space-y-3 hover:border-neutral-300 transition-all">
                <h3 className="text-base font-black uppercase tracking-tight text-neutral-900 flex items-center gap-2">
                  <span className="text-accent font-mono font-black py-0.5 px-2 bg-neutral-100 rounded text-xs select-none">Q</span> {item.question}
                </h3>
                <p className="text-neutral-500 text-xs sm:text-sm leading-relaxed font-semibold pl-7">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pricing - Minimalist */}
      <section className="py-24 px-8" id="pricing">
        <div className="max-w-7xl mx-auto bg-primary text-white rounded-[3rem] p-12 md:p-24 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-accent/10 blur-[120px] rounded-full" />
          
          <div className="relative z-10 grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase leading-[0.85]">
                {lp?.cta?.title ? lp.cta.title.split(' ').map((word, i) => (
                  <React.Fragment key={i}>
                    {i === lp.cta.title.split(' ').length - 1 ? <span className="text-white/40">{word}</span> : word}
                    {i < lp.cta.title.split(' ').length - 1 && <br />}
                  </React.Fragment>
                )) : (
                  <>
                    Simple <br />
                    <span className="text-white/40">Access.</span>
                  </>
                )}
              </h2>
              <p className="text-xl text-white/60 leading-relaxed max-w-md">
                {lp?.cta?.description || "Professional tools shouldn't have complex pricing. Choose the tier that matches your scale."}
              </p>
              
              <div className="flex bg-white/5 border border-white/10 p-1 rounded-2xl max-w-xs ring-1 ring-white/10">
                <button 
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`flex-1 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${billingCycle === 'monthly' ? 'bg-white text-primary shadow-lg' : 'text-white/60 hover:text-white'}`}
                >
                  Monthly
                </button>
                <button 
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  className={`flex-1 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${billingCycle === 'annual' ? 'bg-white text-primary shadow-lg' : 'text-white/60 hover:text-white'}`}
                >
                  Annual
                </button>
              </div>
            </div>

            <div className="grid gap-6">
              {plans.length > 0 ? (
                plans.map((plan) => {
                  const isPaid = plan.price > 0;
                  const trialInfo = plan.trialEnabled && plan.trialDays ? `${plan.trialDays}-Day Free Trial` : null;
                  
                  let calculatedPrice = plan.price;
                  let periodLabel = 'Per Month';
                  let equivalentText = null;
                  let savingPct = 0;

                  if (billingCycle === 'annual' && isPaid) {
                    calculatedPrice = plan.annualPrice || (plan.price * 12);
                    periodLabel = 'Per Year';
                    equivalentText = `equivalent to $${Math.round(calculatedPrice / 12)}/mo`;
                    
                    if (plan.annualPrice && plan.price) {
                      savingPct = Math.round((1 - (plan.annualPrice / (plan.price * 12))) * 100);
                    }
                  }

                  return (
                    <div 
                      key={plan.id} 
                      className={`p-8 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-all relative overflow-hidden ${
                        isPaid ? 'bg-white text-primary shadow-2xl scale-102 border border-neutral-100' : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                      }`}
                    >
                      {savingPct > 0 && (
                        <div className="absolute top-3 right-3 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                          Save {savingPct}%
                        </div>
                      )}
                      
                      <div className="space-y-4 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xl font-bold uppercase tracking-tight">{plan.name}</h3>
                          {trialInfo && (
                            <span className="text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-md bg-accent/15 text-accent shrink-0 animate-pulse">
                              {trialInfo}
                            </span>
                          )}
                        </div>

                        {/* Quantitative Plan Limits */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] uppercase font-bold tracking-wider opacity-90">
                          <div className="flex items-center gap-1.5">
                            <span className="text-accent">■</span>
                            <span>{plan.maxGearItems >= 10000 ? 'Unlimited' : `${plan.maxGearItems.toLocaleString()}`} Items</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-accent">■</span>
                            <span>{plan.maxPackingLists >= 1000 ? 'Unlimited' : `${plan.maxPackingLists}`} Pack Lists</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-accent">■</span>
                            <span>{plan.maxProjects >= 50 ? 'Unlimited' : `${plan.maxProjects}`} Projects</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-accent">■</span>
                            <span>{plan.aiTokenLimit} AI Quota</span>
                          </div>
                        </div>

                        {/* Feature Tags list */}
                        <div className="flex flex-wrap gap-1 pt-1">
                          {Array.isArray(plan.features) ? plan.features.slice(0, 3).map((f) => {
                            const label = featureKeyLabels[f] || f.replace(/([A-Z])/g, ' $1');
                            return (
                              <span 
                                key={f} 
                                className={`text-[8px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-md ${
                                  isPaid 
                                    ? 'bg-neutral-100 text-neutral-600 border border-neutral-200/50' 
                                    : 'bg-white/10 text-white/80 border border-white/5'
                                }`}
                              >
                                {label}
                              </span>
                            );
                          }) : null}
                          {Array.isArray(plan.features) && plan.features.length > 3 && (
                            <span className={`text-[8px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-md ${
                              isPaid ? 'bg-neutral-50 text-neutral-400' : 'bg-white/5 text-white/45'
                            }`}>
                              +{plan.features.length - 3} More
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-left md:text-right shrink-0">
                        <div className="text-3xl font-black tracking-tighter">${calculatedPrice}</div>
                        <div className={`micro-label uppercase font-black tracking-widest text-[9px] ${isPaid ? 'text-primary/45' : 'text-white/45'}`}>
                          {isPaid ? periodLabel : 'Forever'}
                        </div>
                        {equivalentText && (
                          <div className={`text-[9px] font-bold uppercase tracking-wider ${isPaid ? 'text-primary/30' : 'text-white/30'} mt-0.5`}>
                            {equivalentText}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 bg-white/5 border border-white/10 rounded-3xl text-center">
                  <p className="text-white/40">Loading plans...</p>
                </div>
              )}

              <button 
                onClick={signInWithGoogle}
                className="w-full py-5 bg-accent text-white rounded-2xl font-black uppercase tracking-widest hover:bg-accent/90 transition shadow-xl mt-4"
              >
                {lp?.cta?.buttonText || 'Get Started Now'}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
