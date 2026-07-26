import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, 
  Check, 
  Shield, 
  Globe, 
  Zap, 
  Camera, 
  QrCode, 
  ShoppingBag, 
  Truck, 
  Box, 
  Layers, 
  Sparkles, 
  ChevronRight, 
  ChevronDown, 
  Star, 
  Cpu, 
  Smartphone, 
  CheckCircle2, 
  Lock, 
  Users, 
  BarChart3, 
  Wrench, 
  Activity, 
  Scale, 
  Compass, 
  Play, 
  RefreshCw, 
  FileText, 
  HelpCircle,
  Stethoscope,
  Building2,
  Car,
  Trophy,
  Sliders,
  CheckSquare,
  Package,
  Crosshair
} from 'lucide-react';
import { UserProfile, AdminSettings } from '../types';
import { signInWithGoogle } from '../firebase';
import PackerLogo from './PackerLogo';
import { hapticLight, hapticSuccess, hapticMedium } from '../utils/haptics';

interface ModernLandingPageProps {
  user: UserProfile | null;
  adminSettings: AdminSettings | null;
  onExploreMarketplace?: () => void;
}

// Multi-Industry Data Presets
const INDUSTRIES_DATA = [
  {
    id: 'cinema',
    name: 'Film & Broadcast',
    icon: Camera,
    badge: 'Cine & Live Media',
    color: 'from-amber-500/20 to-orange-500/20 text-amber-500 border-amber-500/30',
    description: 'Cinema camera bodies, cine prime lenses, wireless video feeds, V-mount power grids, and sound boards. Keep 100% kit integrity on high-stakes sets.',
    keyGear: ['ARRI Alexa Mini LF', 'Cooke Anamorphic Set', 'Teradek Bolt 4K MAX', 'Anton Bauer Battery Grid', 'SmallHD Cine 7 Monitor'],
    metric: '0 Missing Ancillaries',
    statsLabel: 'Kit Turnaround Time',
    statsVal: '< 15 mins'
  },
  {
    id: 'construction',
    name: 'Construction & Rigging',
    icon: Building2,
    badge: 'Heavy Industry & Tooling',
    color: 'from-blue-500/20 to-indigo-500/20 text-blue-500 border-blue-500/30',
    description: 'Pneumatic tools, fall harnesses, laser levels, torque drivers, and generator packs. Streamline tool-room checkouts and safety compliance logs.',
    keyGear: ['Milwaukee FUEL 18V Kit', 'DeWalt Rotary Laser', 'Miller Fall Protection Harness', 'Honda 7000W Generator', 'Hilti Concrete Core Drill'],
    metric: '100% OSHA Audit Compliant',
    statsLabel: 'Tool Room Loss Rate',
    statsVal: '0.0%'
  },
  {
    id: 'medical',
    name: 'Field Medical & Tactical',
    icon: Stethoscope,
    badge: 'Crisis & Clinical Dispatch',
    color: 'from-emerald-500/20 to-teal-500/20 text-emerald-500 border-emerald-500/30',
    description: 'Trauma bags, portable ventilators, ECG monitors, oxygen cylinders, and triage packs. Secure digital signatures for strict chain-of-custody tracking.',
    keyGear: ['ZOLL X Series Monitor', 'Hamilton Portable Ventilator', 'Trauma Pack Alpha', 'Oxygen Cylinder Unit', 'Tactical Triage Kit'],
    metric: 'Verified Custody Handshake',
    statsLabel: 'Dispatch Readiness',
    statsVal: '100.0%'
  },
  {
    id: 'expedition',
    name: 'Alpine & Expeditions',
    icon: Compass,
    badge: 'Extreme Environments',
    color: 'from-cyan-500/20 to-blue-500/20 text-cyan-400 border-cyan-500/30',
    description: 'Cold-weather tents, mountaineering ropes, satellite communicators, avalanche transceivers, and crampons with dynamic trail weight balance.',
    keyGear: ['Garmin inReach Mini 2', 'Mammut 60m Dry Rope Set', 'RECCO Avalanche Beacon', 'Mountain Hardwear Trango 3', 'MSR Reactor Stove System'],
    metric: 'Gram-Precision Weight',
    statsLabel: 'Payload Optimization',
    statsVal: '32% Lighter'
  },
  {
    id: 'automotive',
    name: 'Automotive & Mechanics',
    icon: Car,
    badge: 'Pits & Service Bays',
    color: 'from-red-500/20 to-rose-500/20 text-rose-500 border-rose-500/30',
    description: 'OBD-II diagnostic meters, pneumatic impact guns, hydraulic jacks, torque wrenches, and specialty alignment gauges with recurring calibration timers.',
    keyGear: ['Snap-on Diagnostic Scanner', 'Ingersoll Rand Air Impact', 'Matco Torque Wrench 1/2"', 'Hydraulic Low-Profile Jack', 'Borescope Inspection Meter'],
    metric: 'Automatic Calibration Alerts',
    statsLabel: 'Bay Efficiency Boost',
    statsVal: '+45%'
  },
  {
    id: 'sports',
    name: 'Sports & Athletics',
    icon: Trophy,
    badge: 'Rosters & Team Travel',
    color: 'from-purple-500/20 to-violet-500/20 text-purple-400 border-purple-500/30',
    description: 'Team jerseys, protective helmets, training pads, medical response trunks, and athletic tech. Bulk decompose imports for instant roster assignment.',
    keyGear: ['Riddell SpeedFlex Helmet Set', 'Team Medical Trunk', 'GPS Player Tracking Pods', 'Hydration Station Kit', 'Video Analysis Camera Rig'],
    metric: 'Roster-Wide Bulk Assign',
    statsLabel: 'Packing Speed',
    statsVal: '5x Faster'
  }
];

// Interactive Blueprint Case Items Simulation
const CASE_BLUEPRINT_ITEMS = [
  { id: '1', name: 'ARRI Alexa Mini LF Body', category: 'Camera', weight: 3.2, x: 10, y: 15, w: 35, h: 40, color: 'bg-neutral-800 border-neutral-700 text-white' },
  { id: '2', name: 'Cooke 50mm Prime Lens', category: 'Optics', weight: 1.8, x: 48, y: 15, w: 22, h: 22, color: 'bg-amber-950/80 border-amber-800/80 text-amber-200' },
  { id: '3', name: 'Teradek Bolt 4K MAX', category: 'Wireless', weight: 0.6, x: 73, y: 15, w: 20, h: 22, color: 'bg-blue-950/80 border-blue-800/80 text-blue-200' },
  { id: '4', name: 'Anton Bauer V-Mount x4', category: 'Power', weight: 4.1, x: 48, y: 42, w: 45, h: 43, color: 'bg-emerald-950/80 border-emerald-800/80 text-emerald-200' },
  { id: '5', name: 'SmallHD Cine 7 Monitor', category: 'Display', weight: 0.9, x: 10, y: 60, w: 35, h: 25, color: 'bg-purple-950/80 border-purple-800/80 text-purple-200' },
];

export default function ModernLandingPage({ user, adminSettings, onExploreMarketplace }: ModernLandingPageProps) {
  const [activeTab, setActiveTab] = useState<'blueprint' | 'ai_scan' | 'kiosk' | 'qr'>('blueprint');
  const [selectedIndustry, setSelectedIndustry] = useState('cinema');
  const [selectedCaseItem, setSelectedCaseItem] = useState<string | null>('1');
  
  // Weight calculator simulator
  const [calcCameraCount, setCalcCameraCount] = useState(2);
  const [calcLensCount, setCalcLensCount] = useState(4);
  const [calcBatteryCount, setCalcBatteryCount] = useState(6);
  const [calcToolCount, setCalcToolCount] = useState(3);

  // FAQ Accordion
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Total weight calculations
  const totalCalcWeightKg = (calcCameraCount * 3.4 + calcLensCount * 1.5 + calcBatteryCount * 0.9 + calcToolCount * 2.1).toFixed(1);
  const totalCalcWeightLbs = (parseFloat(totalCalcWeightKg) * 2.20462).toFixed(1);

  const currentIndustryObj = INDUSTRIES_DATA.find(i => i.id === selectedIndustry) || INDUSTRIES_DATA[0];

  const handleStartAuth = () => {
    hapticSuccess();
    signInWithGoogle();
  };

  return (
    <div className="min-h-screen bg-[#0d0f12] text-white selection:bg-[#ff4f3a] selection:text-white font-sans overflow-x-hidden">
      
      {/* Dynamic Background Noise & Mesh Grids */}
      <div className="fixed inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none z-0" />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-[#ff4f3a]/15 via-amber-500/5 to-transparent blur-[140px] pointer-events-none z-0" />

      {/* Top Floating Glass Navigation */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0d0f12]/80 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          <div className="flex items-center gap-3">
            <PackerLogo size={36} />
            <div className="hidden sm:flex flex-col">
              <span className="text-xs font-black uppercase tracking-widest text-neutral-400">Packer Tools</span>
              <span className="text-[10px] text-[#ff4f3a] font-mono font-bold">v5.17 Enterprise</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-bold text-neutral-300">
            <a href="#features" onClick={() => hapticLight()} className="hover:text-white transition">Capabilities</a>
            <a href="#blueprint" onClick={() => hapticLight()} className="hover:text-[#ff4f3a] transition flex items-center gap-1.5">
              <Layers size={14} className="text-[#ff4f3a]" />
              <span>2D Blueprint</span>
            </a>
            <a href="#industries" onClick={() => hapticLight()} className="hover:text-white transition">Industries</a>
            <a href="#calculator" onClick={() => hapticLight()} className="hover:text-white transition">Weight Calc</a>
            <a href="#pricing" onClick={() => hapticLight()} className="hover:text-white transition">Pricing</a>
            <a href="#faq" onClick={() => hapticLight()} className="hover:text-white transition">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            {onExploreMarketplace && (
              <button
                onClick={() => {
                  hapticLight();
                  onExploreMarketplace();
                }}
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold border border-white/10 transition"
              >
                <ShoppingBag size={14} className="text-amber-400" />
                <span>Marketplace</span>
              </button>
            )}

            {user ? (
              <a
                href="/dashboard"
                onClick={() => hapticSuccess()}
                className="px-5 py-2.5 bg-[#ff4f3a] hover:bg-[#ff3b22] text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg shadow-[#ff4f3a]/25 flex items-center gap-2"
              >
                <span>Go to Workspace</span>
                <ArrowRight size={14} />
              </a>
            ) : (
              <button
                onClick={handleStartAuth}
                className="px-5 py-2.5 bg-[#ff4f3a] hover:bg-[#ff3b22] text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg shadow-[#ff4f3a]/25 flex items-center gap-2 cursor-pointer"
              >
                <Zap size={14} />
                <span>Start Free Trial — 14 Days →</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 overflow-hidden z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-4xl mx-auto space-y-6">
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#ff4f3a]/20 via-amber-500/20 to-blue-500/20 border border-[#ff4f3a]/30 rounded-full text-xs font-mono text-neutral-200 shadow-xl"
            >
              <Sparkles size={14} className="text-[#ff4f3a] animate-pulse" />
              <span className="font-bold text-white">Packer Tools v5.18.6</span>
              <span className="text-neutral-400">|</span>
              <span className="text-amber-300 font-bold">Multi-Industry Field Asset & Logistics Engine</span>
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.05] text-white"
            >
              Did they sign for it? <br />
              <span className="bg-gradient-to-r from-[#ff4f3a] via-amber-400 to-rose-400 bg-clip-text text-transparent">
                Every item. Every crew. Accountable.
              </span>
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg sm:text-xl text-neutral-300 font-normal leading-relaxed max-w-3xl mx-auto"
            >
              Build, track, assign, and audit high-volume gear setups. Featuring Gemini AI Shutter Spec Extraction, 2D Spatial Travel Case Blueprints, Kiosk Signature Audits, and Serialized Barcode Passports.
            </motion.p>

            {/* CTAs */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
            >
              <button
                onClick={handleStartAuth}
                className="w-full sm:w-auto px-8 py-4 bg-[#ff4f3a] hover:bg-[#ff3b22] text-white rounded-2xl font-black uppercase text-xs tracking-widest transition shadow-2xl shadow-[#ff4f3a]/40 hover:scale-[1.02] flex items-center justify-center gap-3 cursor-pointer"
              >
                <Zap size={18} />
                <span>Start Free Trial — 14 Days →</span>
              </button>

              <a
                href="#blueprint"
                onClick={() => hapticMedium()}
                className="w-full sm:w-auto px-8 py-4 bg-white/10 hover:bg-white/15 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition border border-white/15 flex items-center justify-center gap-2"
              >
                <Layers size={18} className="text-[#ff4f3a]" />
                <span>Book a Demo</span>
              </a>
            </motion.div>

            {/* Key Trust Stats */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="pt-12 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-white/10 mt-12 text-left"
            >
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-1">
                <div className="text-2xl sm:text-3xl font-black text-white font-mono">99.98%</div>
                <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Kit Readiness Rate</div>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-1">
                <div className="text-2xl sm:text-3xl font-black text-[#ff4f3a] font-mono">&lt; 3 sec</div>
                <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">QR Passport Scan</div>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-1">
                <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">150k+</div>
                <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Tracked Assets</div>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-1">
                <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">0 Lost</div>
                <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Ancillaries & Cables</div>
              </div>
            </motion.div>

          </div>

        </div>
      </section>

      {/* INTERACTIVE DEMO / BLUEPRINT SANDBOX */}
      <section id="blueprint" className="py-20 bg-black/40 border-y border-white/10 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-xs font-mono font-bold uppercase">
              <Layers size={14} />
              <span>Interactive Operations Preview</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              Experience the Packer Engine Live
            </h2>
            <p className="text-neutral-400 text-sm sm:text-base">
              Switch modules below to test our 2D Case Layout Engine, AI Shutter Scanner, Kiosk Signatures, and Asset Passports.
            </p>
          </div>

          {/* Module Switcher Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4 p-2 bg-white/5 border border-white/10 rounded-2xl max-w-3xl mx-auto">
            <button
              onClick={() => { hapticLight(); setActiveTab('blueprint'); }}
              className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'blueprint' 
                  ? 'bg-[#ff4f3a] text-white shadow-lg shadow-[#ff4f3a]/30' 
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Box size={16} />
              <span>2D Travel Case Blueprint</span>
            </button>

            <button
              onClick={() => { hapticLight(); setActiveTab('ai_scan'); }}
              className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'ai_scan' 
                  ? 'bg-[#ff4f3a] text-white shadow-lg shadow-[#ff4f3a]/30' 
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Camera size={16} />
              <span>AI Shutter Scan</span>
            </button>

            <button
              onClick={() => { hapticLight(); setActiveTab('kiosk'); }}
              className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'kiosk' 
                  ? 'bg-[#ff4f3a] text-white shadow-lg shadow-[#ff4f3a]/30' 
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Smartphone size={16} />
              <span>Kiosk Signature Pad</span>
            </button>

            <button
              onClick={() => { hapticLight(); setActiveTab('qr'); }}
              className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'qr' 
                  ? 'bg-[#ff4f3a] text-white shadow-lg shadow-[#ff4f3a]/30' 
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <QrCode size={16} />
              <span>QR Asset Passport</span>
            </button>
          </div>

          {/* Interactive Display Stage */}
          <div className="bg-[#12151a] border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden min-h-[460px]">
            
            {/* TAB 1: 2D CASE BLUEPRINT */}
            {activeTab === 'blueprint' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="grid lg:grid-cols-3 gap-8 items-start"
              >
                {/* 2D Grid Canvas Simulation */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
                      <Box size={14} className="text-[#ff4f3a]" />
                      <span>Case #A102 - Pelican Air 1615 Foam Insert</span>
                    </div>
                    <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-mono font-bold">
                      Spatial Balanced (10.6 kg)
                    </span>
                  </div>

                  {/* Visual Travel Case Container Box */}
                  <div className="relative w-full h-[320px] bg-neutral-950 border-2 border-neutral-800 rounded-2xl p-4 overflow-hidden bg-[radial-gradient(#ffffff0d_1px,transparent_1px)] [background-size:16px_16px]">
                    <div className="absolute top-2 left-2 text-[10px] font-mono text-neutral-600 uppercase">Top Lid Guard</div>
                    <div className="absolute bottom-2 right-2 text-[10px] font-mono text-neutral-600 uppercase">Pelican 1615 Grid Scale</div>

                    {CASE_BLUEPRINT_ITEMS.map((item) => (
                      <motion.button
                        key={item.id}
                        whileHover={{ scale: 1.02 }}
                        onClick={() => { hapticMedium(); setSelectedCaseItem(item.id); }}
                        style={{
                          left: `${item.x}%`,
                          top: `${item.y}%`,
                          width: `${item.w}%`,
                          height: `${item.h}%`
                        }}
                        className={`absolute rounded-xl border p-2 flex flex-col justify-between transition-all cursor-pointer shadow-lg ${item.color} ${
                          selectedCaseItem === item.id ? 'ring-2 ring-[#ff4f3a] ring-offset-2 ring-offset-black scale-[1.02] z-20' : 'opacity-90 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono uppercase font-bold truncate">
                          <span className="truncate">{item.name}</span>
                          <span className="ml-1 opacity-75">{item.weight}kg</span>
                        </div>
                        <div className="text-[9px] font-mono opacity-60 uppercase">{item.category}</div>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Case Inspector Sidebar */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono font-bold uppercase text-[#ff4f3a]">Selected Item Inspector</span>
                    <h3 className="text-lg font-black text-white">
                      {CASE_BLUEPRINT_ITEMS.find(i => i.id === selectedCaseItem)?.name || 'ARRI Alexa Mini LF'}
                    </h3>
                  </div>

                  <div className="space-y-3 text-xs text-neutral-300 border-t border-white/10 pt-4 font-mono">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Net Weight:</span>
                      <span className="font-bold text-white">{CASE_BLUEPRINT_ITEMS.find(i => i.id === selectedCaseItem)?.weight} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Category:</span>
                      <span className="font-bold text-amber-400">{CASE_BLUEPRINT_ITEMS.find(i => i.id === selectedCaseItem)?.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Foam Cutout:</span>
                      <span className="font-bold text-emerald-400">Custom CNC Mapped</span>
                    </div>
                  </div>

                  <div className="p-4 bg-black/40 rounded-xl border border-white/5 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-white">
                      <Scale size={14} className="text-amber-400" />
                      <span>Total Case Weight</span>
                    </div>
                    <div className="text-2xl font-black font-mono text-white">10.6 kg <span className="text-xs font-normal text-neutral-400">(23.3 lbs)</span></div>
                    <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
                      <div className="bg-gradient-to-r from-emerald-500 to-amber-500 h-full w-[46%]" />
                    </div>
                    <div className="text-[10px] text-neutral-400 flex justify-between font-mono">
                      <span>0 kg</span>
                      <span className="text-emerald-400 font-bold">Airline Safe (&lt;23kg)</span>
                      <span>50 kg</span>
                    </div>
                  </div>

                  <button
                    onClick={handleStartAuth}
                    className="w-full py-3 bg-[#ff4f3a] hover:bg-[#ff3b22] text-white rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Build Your Blueprint</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* TAB 2: AI SHUTTER SCAN */}
            {activeTab === 'ai_scan' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="grid lg:grid-cols-2 gap-8 items-center"
              >
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-full text-xs font-mono font-bold">
                    <Sparkles size={14} />
                    <span>Gemini 2.5 AI Recognition Engine</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-white">
                    Instant Spec & Asset Extraction from Camera Shots
                  </h3>
                  <p className="text-neutral-300 text-sm leading-relaxed">
                    Point your device at any cine camera, drill, ventilator, or tactical tool. Packer Tools parses manufacturer, model, serial tags, and generates complete description templates in seconds.
                  </p>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-1">
                      <div className="text-xs font-black text-white flex items-center gap-1.5">
                        <CheckCircle2 size={14} className="text-emerald-400" />
                        <span>Auto Brand Detect</span>
                      </div>
                      <p className="text-[11px] text-neutral-400">ARRI, RED, Milwaukee, DeWalt, ZOLL</p>
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-1">
                      <div className="text-xs font-black text-white flex items-center gap-1.5">
                        <CheckCircle2 size={14} className="text-emerald-400" />
                        <span>Serial OCR Read</span>
                      </div>
                      <p className="text-[11px] text-neutral-400">Parses metal stamps & serial stickers</p>
                    </div>
                  </div>
                </div>

                <div className="relative bg-neutral-950 border border-white/10 rounded-2xl p-6 space-y-4">
                  <div className="relative h-56 rounded-xl overflow-hidden border border-white/10 bg-neutral-900 flex items-center justify-center">
                    <img 
                      src="https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&q=80&w=800" 
                      alt="Camera gear scan"
                      className="w-full h-full object-cover opacity-80"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                    
                    {/* Simulated Bounding Box Overlay */}
                    <div className="absolute top-1/4 left-1/4 right-1/4 bottom-1/4 border-2 border-dashed border-[#ff4f3a] rounded-xl flex items-center justify-center animate-pulse">
                      <span className="px-3 py-1 bg-[#ff4f3a] text-white text-[10px] font-mono font-bold rounded-full">
                        Gemini Scanning...
                      </span>
                    </div>
                  </div>

                  <div className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-2 font-mono text-xs">
                    <div className="flex justify-between text-neutral-400">
                      <span>Detected Entity:</span>
                      <span className="text-emerald-400 font-bold">ARRI Alexa Mini LF</span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>Parsed Serial:</span>
                      <span className="text-white font-bold">#S-774921-X</span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>Suggested Category:</span>
                      <span className="text-amber-400 font-bold">Cinema Camera Body</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 3: KIOSK MODE */}
            {activeTab === 'kiosk' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="grid lg:grid-cols-2 gap-8 items-center"
              >
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-mono font-bold">
                    <Smartphone size={14} />
                    <span>Self-Service Kiosk Mode</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-white">
                    Non-Reputable Digital Signature Checkouts
                  </h3>
                  <p className="text-neutral-300 text-sm leading-relaxed">
                    Set up dedicated tablet stations in warehouse bays, gear rooms, or staging tents. Crew members scan their badge, tap items OUT, sign on-screen, and trigger instant Google Workspace notifications.
                  </p>

                  <div className="flex items-center gap-4 text-xs font-mono text-neutral-400">
                    <span className="flex items-center gap-1 text-emerald-400 font-bold">
                      <Check size={14} /> Offline Caching
                    </span>
                    <span className="flex items-center gap-1 text-emerald-400 font-bold">
                      <Check size={14} /> Signature Canvas
                    </span>
                    <span className="flex items-center gap-1 text-emerald-400 font-bold">
                      <Check size={14} /> PIN Verification
                    </span>
                  </div>
                </div>

                <div className="bg-neutral-950 border border-white/10 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="text-xs font-mono font-bold text-white flex items-center gap-2">
                      <Shield size={14} className="text-[#ff4f3a]" />
                      <span>KIOSK STATION #01</span>
                    </div>
                    <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-mono rounded">LIVE ONLINE</span>
                  </div>

                  <div className="p-4 bg-black/60 rounded-xl border border-white/5 space-y-3">
                    <div className="text-xs font-mono text-neutral-400">Holder: <span className="text-white font-bold">Marcus Vance (Director of Photography)</span></div>
                    <div className="text-xs font-mono text-neutral-400">Items (3): <span className="text-amber-400 font-bold">Alexa Mini LF, Cooke 50mm, Teradek</span></div>
                    
                    {/* Simulated Signature Line */}
                    <div className="p-3 bg-neutral-900 rounded-lg border border-dashed border-neutral-700 h-20 flex flex-col justify-between">
                      <div className="text-[10px] font-mono text-neutral-500">Sign below to confirm check-out:</div>
                      <svg className="w-full h-8 text-amber-400" viewBox="0 0 200 40">
                        <path d="M 10 20 Q 30 5, 50 25 T 90 20 T 130 30 T 180 15" fill="none" stroke="currentColor" strokeWidth="2" />
                      </svg>
                    </div>
                  </div>

                  <button
                    onClick={handleStartAuth}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg shadow-emerald-600/30 cursor-pointer"
                  >
                    Activate Kiosk Mode in Your Workspace
                  </button>
                </div>
              </motion.div>
            )}

            {/* TAB 4: QR PASSPORT */}
            {activeTab === 'qr' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="grid lg:grid-cols-2 gap-8 items-center"
              >
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-xs font-mono font-bold">
                    <QrCode size={14} />
                    <span>Label Studio & Asset Passports</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-white">
                    Unique QR Passports & Vinyl Tag Printing
                  </h3>
                  <p className="text-neutral-300 text-sm leading-relaxed">
                    Every asset generates a dedicated, public or private URL passport. Print adhesive vinyl labels directly using standard thermal printer sheet layouts or link existing engraved metal tags.
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-neutral-300">Avery 5160 Presets</span>
                    <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-neutral-300">Custom Thermal Dymo</span>
                    <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-xs font-mono text-neutral-300">Industrial Barcodes</span>
                  </div>
                </div>

                <div className="bg-neutral-950 border border-white/10 rounded-2xl p-6 space-y-4 text-center">
                  <div className="p-6 bg-white text-black rounded-2xl max-w-xs mx-auto shadow-2xl space-y-3">
                    <div className="text-[10px] font-mono font-black uppercase tracking-widest text-neutral-500">PACKER TOOLS PASSPORT</div>
                    <div className="p-3 bg-neutral-100 rounded-xl inline-block border border-neutral-300">
                      <QrCode size={100} className="text-black" />
                    </div>
                    <div className="text-xs font-mono font-black tracking-widest text-black">ASSET #PK-774921</div>
                    <div className="text-[10px] font-bold text-neutral-600">ARRI ALEXA MINI LF BODY</div>
                  </div>
                </div>
              </motion.div>
            )}

          </div>

        </div>
      </section>

      {/* MULTI-INDUSTRY MATRIX */}
      <section id="industries" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 relative z-10">
        
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full text-xs font-mono font-bold uppercase">
            <Globe size={14} />
            <span>Multi-Industry Adaptability</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
            Tailored to Your Operations
          </h2>
          <p className="text-neutral-400 text-sm sm:text-base">
            Packer Tools adapts terminology, checklists, and maintenance workflows dynamically across high-intensity sectors.
          </p>
        </div>

        {/* Industry Selection Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {INDUSTRIES_DATA.map((ind) => {
            const IconComp = ind.icon;
            const isSelected = selectedIndustry === ind.id;
            return (
              <button
                key={ind.id}
                onClick={() => { hapticLight(); setSelectedIndustry(ind.id); }}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between h-32 ${
                  isSelected 
                    ? 'bg-white/10 border-[#ff4f3a] text-white shadow-xl ring-1 ring-[#ff4f3a]' 
                    : 'bg-white/5 border-white/5 text-neutral-400 hover:text-white hover:bg-white/10'
                }`}
              >
                <IconComp size={22} className={isSelected ? 'text-[#ff4f3a]' : 'text-neutral-400'} />
                <div className="space-y-0.5">
                  <div className="text-xs font-black uppercase leading-tight">{ind.name}</div>
                  <div className="text-[10px] font-mono text-neutral-500 truncate">{ind.badge}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Industry Card */}
        <AnimatePresence mode="wait">
          <motion.div 
            key={currentIndustryObj.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="bg-[#12151a] border border-white/10 rounded-3xl p-6 md:p-10 grid lg:grid-cols-3 gap-8 items-center"
          >
            <div className="lg:col-span-2 space-y-6">
              <div className="space-y-2">
                <span className={`inline-block px-3 py-1 bg-gradient-to-r ${currentIndustryObj.color} rounded-full text-xs font-mono font-bold border`}>
                  {currentIndustryObj.badge}
                </span>
                <h3 className="text-2xl sm:text-4xl font-black text-white">{currentIndustryObj.name}</h3>
                <p className="text-neutral-300 text-sm leading-relaxed">{currentIndustryObj.description}</p>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-wider">Representative Equipment Tracked:</div>
                <div className="flex flex-wrap gap-2">
                  {currentIndustryObj.keyGear.map((gear, idx) => (
                    <span key={`gear-${gear}-${idx}`} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs font-mono text-neutral-200">
                      {gear}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6 text-center">
              <div className="space-y-1">
                <div className="text-3xl sm:text-4xl font-black font-mono text-[#ff4f3a]">{currentIndustryObj.statsVal}</div>
                <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{currentIndustryObj.statsLabel}</div>
              </div>

              <div className="p-3 bg-black/40 rounded-xl border border-white/5 text-xs font-mono text-emerald-400 font-bold flex items-center justify-center gap-2">
                <CheckCircle2 size={16} />
                <span>{currentIndustryObj.metric}</span>
              </div>

              <button
                onClick={handleStartAuth}
                className="w-full py-3 bg-[#ff4f3a] hover:bg-[#ff3b22] text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg shadow-[#ff4f3a]/30 cursor-pointer"
              >
                Launch Industry Workspace
              </button>
            </div>
          </motion.div>
        </AnimatePresence>

      </section>

      {/* LIVE INTERACTIVE WEIGHT & PAYLOAD CALCULATOR WIDGET */}
      <section id="calculator" className="py-20 bg-black/50 border-y border-white/10 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-xs font-mono font-bold uppercase">
              <Scale size={14} />
              <span>Interactive Cargo Calculator</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              Estimate Payload & Transit Weight
            </h2>
            <p className="text-neutral-400 text-sm sm:text-base">
              Test how Packer Tools calculates dynamic payload distribution for airline baggage thresholds and trail load limits.
            </p>
          </div>

          <div className="bg-[#12151a] border border-white/10 rounded-3xl p-6 md:p-10 max-w-4xl mx-auto grid md:grid-cols-2 gap-8 items-center">
            
            {/* Controls */}
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono font-bold">
                    <span className="text-neutral-300">Camera / Primary Unit Bodies:</span>
                    <span className="text-[#ff4f3a]">{calcCameraCount} Units</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="10" 
                    value={calcCameraCount}
                    onChange={(e) => setCalcCameraCount(parseInt(e.target.value))}
                    className="w-full accent-[#ff4f3a] bg-neutral-800 rounded-lg h-2 cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono font-bold">
                    <span className="text-neutral-300">Optics / Specialty Lenses:</span>
                    <span className="text-amber-400">{calcLensCount} Units</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="12" 
                    value={calcLensCount}
                    onChange={(e) => setCalcLensCount(parseInt(e.target.value))}
                    className="w-full accent-amber-400 bg-neutral-800 rounded-lg h-2 cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono font-bold">
                    <span className="text-neutral-300">High-Capacity Battery Blocks:</span>
                    <span className="text-emerald-400">{calcBatteryCount} Units</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="20" 
                    value={calcBatteryCount}
                    onChange={(e) => setCalcBatteryCount(parseInt(e.target.value))}
                    className="w-full accent-emerald-400 bg-neutral-800 rounded-lg h-2 cursor-pointer"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono font-bold">
                    <span className="text-neutral-300">Auxiliary Power & Rig Tooling:</span>
                    <span className="text-blue-400">{calcToolCount} Kits</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="10" 
                    value={calcToolCount}
                    onChange={(e) => setCalcToolCount(parseInt(e.target.value))}
                    className="w-full accent-blue-400 bg-neutral-800 rounded-lg h-2 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Calculated Results */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6 text-center">
              <div className="space-y-1">
                <span className="text-xs font-mono text-neutral-400 uppercase tracking-widest">Calculated Payload</span>
                <div className="text-4xl sm:text-5xl font-black font-mono text-white">
                  {totalCalcWeightKg} <span className="text-lg text-neutral-400 font-normal">kg</span>
                </div>
                <div className="text-xs font-mono text-amber-400 font-bold">
                  ({totalCalcWeightLbs} lbs total)
                </div>
              </div>

              {/* Threshold Status */}
              {parseFloat(totalCalcWeightKg) <= 23 ? (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>Standard Airline Checked Bag (&lt;23kg)</span>
                </div>
              ) : parseFloat(totalCalcWeightKg) <= 32 ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-2">
                  <Zap size={16} />
                  <span>Heavy Checked Bag Tag Required (&lt;32kg)</span>
                </div>
              ) : (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-mono font-bold flex items-center justify-center gap-2">
                  <Shield size={16} />
                  <span>Split Across 2 Transit Cases</span>
                </div>
              )}

              <button
                onClick={handleStartAuth}
                className="w-full py-3 bg-[#ff4f3a] hover:bg-[#ff3b22] text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-lg shadow-[#ff4f3a]/30"
              >
                Track Equipment Weights in App
              </button>
            </div>

          </div>

        </div>
      </section>

      {/* PRICING TIERS */}
      <section id="pricing" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 relative z-10">
        
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-mono font-bold uppercase">
            <Zap size={14} />
            <span>Transparent Subscription Plans</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
            Scalable Enterprise Pricing
          </h2>
          <p className="text-neutral-400 text-sm sm:text-base">
            Start free for small crews or scale to high-volume multi-workspace enterprise logistics.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          
          {/* STARTER */}
          <div className="bg-[#12151a] border border-white/10 rounded-3xl p-8 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <span className="text-xs font-mono font-bold text-neutral-400 uppercase">Starter Crew</span>
              <div className="text-4xl font-black font-mono text-white">$0 <span className="text-xs font-normal text-neutral-500">/ forever</span></div>
              <p className="text-neutral-300 text-xs">Ideal for individual cinematographers, freelancers, and small field teams.</p>
              
              <ul className="space-y-2.5 text-xs text-neutral-300 pt-4 border-t border-white/10">
                <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400" /> Up to 100 Tracked Items</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400" /> 2D Travel Case Blueprint</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400" /> Standard QR Asset Passports</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-emerald-400" /> PWA Offline Caching</li>
              </ul>
            </div>

            <button
              onClick={handleStartAuth}
              className="w-full py-3 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-black uppercase tracking-wider transition border border-white/10 cursor-pointer"
            >
              Start Free Trial — 14 Days →
            </button>
          </div>

          {/* PRO OPERATOR */}
          <div className="bg-gradient-to-b from-[#ff4f3a]/20 to-[#12151a] border-2 border-[#ff4f3a] rounded-3xl p-8 space-y-6 flex flex-col justify-between relative shadow-2xl">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#ff4f3a] text-white text-[10px] font-mono font-black uppercase tracking-widest rounded-full">
              Most Popular
            </div>

            <div className="space-y-4 pt-2">
              <span className="text-xs font-mono font-bold text-[#ff4f3a] uppercase">Pro Operations</span>
              <div className="text-4xl font-black font-mono text-white">$49 <span className="text-xs font-normal text-neutral-400">/ month</span></div>
              <p className="text-neutral-200 text-xs">For active rental houses, cinema crews, and commercial logistics teams.</p>

              <ul className="space-y-2.5 text-xs text-neutral-200 pt-4 border-t border-white/10">
                <li className="flex items-center gap-2"><Check size={14} className="text-[#ff4f3a]" /> Unlimited Asset Tracking</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-[#ff4f3a]" /> Gemini AI Shutter Spec Scanner</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-[#ff4f3a]" /> Self-Service Kiosk Signature Pad</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-[#ff4f3a]" /> Bulk Decompose & Serialized Imports</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-[#ff4f3a]" /> Google Workspace Chat Webhooks</li>
              </ul>
            </div>

            <button
              onClick={handleStartAuth}
              className="w-full py-3.5 bg-[#ff4f3a] hover:bg-[#ff3b22] text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg shadow-[#ff4f3a]/40 cursor-pointer"
            >
              Start Free Trial — 14 Days →
            </button>
          </div>

          {/* ENTERPRISE */}
          <div className="bg-[#12151a] border border-white/10 rounded-3xl p-8 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <span className="text-xs font-mono font-bold text-amber-400 uppercase">Enterprise Fleet</span>
              <div className="text-4xl font-black font-mono text-white">$199 <span className="text-xs font-normal text-neutral-500">/ month</span></div>
              <p className="text-neutral-300 text-xs">For multi-tenant corporations, field medical fleets, and construction outfits.</p>

              <ul className="space-y-2.5 text-xs text-neutral-300 pt-4 border-t border-white/10">
                <li className="flex items-center gap-2"><Check size={14} className="text-amber-400" /> Multi-Tenant Workspaces & RBAC</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-amber-400" /> System Health & Telemetry Grids</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-amber-400" /> Custom Workspace Preset Calibration</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-amber-400" /> Dedicated Account Manager & SLA</li>
              </ul>
            </div>

            <button
              onClick={handleStartAuth}
              className="w-full py-3 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-black uppercase tracking-wider transition border border-white/10 cursor-pointer"
            >
              Book a Demo
            </button>
          </div>

        </div>

      </section>

      {/* FAQ ACCORDION */}
      <section id="faq" className="py-20 bg-black/40 border-t border-white/10 relative z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-black tracking-tight text-white">Frequently Asked Questions</h2>
            <p className="text-neutral-400 text-sm">Everything you need to know about Packer Tools implementation.</p>
          </div>

          <div className="space-y-3">
            {[
              {
                q: "Can Packer Tools operate completely offline in remote field locations?",
                a: "Yes! Packer Tools is engineered as a Progressive Web Application (PWA). Your packing checklists, inventory sheets, and kiosk checkout logs cache locally on your device and automatically sync back to Google Cloud Firestore once internet connectivity is restored."
              },
              {
                q: "How does the 2D Spatial Travel Case Blueprint work?",
                a: "The 2D Blueprint builder lets you visual-model your travel cases (Pelican, SKB, custom foam inserts) with spatial dimensions, foam cutouts, and real-time total weight calculations to guarantee airline baggage compliance before departure."
              },
              {
                q: "What is Gemini AI Shutter Scan?",
                a: "Our integrated Gemini 2.5 API processes uploaded photos or camera snapshots of cinema gear, power tooling, or medical kits to automatically detect manufacturer names, serial tags, and output formatted spec templates."
              },
              {
                q: "Can I print custom vinyl adhesive barcodes and QR tags?",
                a: "Absolutely. The integrated Label Studio generates dedicated asset passport URLs for every unit. You can print QR tags using standard Avery adhesive sheets or Dymo thermal printers, or link existing vinyl labels and engraved metal tags."
              }
            ].map((item, idx) => (
              <div 
                key={`mlp-faq-${idx}`}
                className="bg-[#12151a] border border-white/10 rounded-2xl overflow-hidden transition"
              >
                <button
                  onClick={() => { hapticLight(); setOpenFaq(openFaq === idx ? null : idx); }}
                  className="w-full p-5 text-left font-bold text-sm text-white flex items-center justify-between gap-4 cursor-pointer hover:bg-white/5"
                >
                  <span>{item.q}</span>
                  <ChevronDown size={18} className={`text-neutral-400 shrink-0 transition-transform ${openFaq === idx ? 'rotate-180 text-[#ff4f3a]' : ''}`} />
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-5 pt-1 text-xs text-neutral-300 leading-relaxed border-t border-white/5">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 bg-[#090b0e] border-t border-white/10 text-xs text-neutral-500 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          
          <div className="flex items-center gap-3">
            <PackerLogo size={28} />
            <span className="font-mono font-bold text-neutral-400">Packer Tools © {new Date().getFullYear()}</span>
            <span className="text-neutral-600 font-mono text-[11px]">&bull; Built by Digital Bure · Fiji · For crews worldwide</span>
          </div>

          <div className="flex items-center gap-6 font-mono text-[11px]">
            <span className="flex items-center gap-2 text-emerald-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              All Systems Operational
            </span>
            <a href="#features" className="hover:text-white transition">Capabilities</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
          </div>

        </div>
      </footer>

    </div>
  );
}
