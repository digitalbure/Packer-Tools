import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, 
  ShieldCheck, 
  Truck, 
  CheckCircle2, 
  ArrowRight, 
  X,
  Layout,
  Camera,
  Users,
  Wrench,
  Shirt,
  Car,
  Cpu,
  Cake,
  Compass,
  Trophy,
  Sliders,
  Sparkles,
  Check,
  Database,
  SlidersHorizontal,
  Workflow,
  HelpCircle,
  Briefcase,
  QrCode,
  Box,
  ClipboardList,
  Store,
  Terminal,
  Calendar,
  MessageSquare,
  Flame,
  CheckSquare,
  Settings
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, INDUSTRIES, FeatureKey } from '../types';
import { toast } from 'sonner';
import { authenticatedFetch } from '../lib/api';

interface OnboardingProps {
  user: UserProfile;
  onComplete: () => void;
  onClose?: () => void;
}

export interface UseCaseIntent {
  id: string;
  title: string;
  shortLabel: string;
  desc: string;
  icon: React.ReactNode;
  recommendedFeatures: FeatureKey[];
}

const INTENT_OPTIONS: UseCaseIntent[] = [
  {
    id: 'create_kits',
    title: 'Create Kits, Flight Cases & Loadouts',
    shortLabel: 'Create Kits',
    desc: 'Assemble camera rigs, flight cases, equipment bundles & job packing lists.',
    icon: <Box className="w-5 h-5 text-amber-500 shrink-0" />,
    recommendedFeatures: ['toolingLists', 'travelCases', 'organizer', 'aiWizard', 'gearLibrary']
  },
  {
    id: 'add_gear',
    title: 'Add & Track Gear Assets',
    shortLabel: 'Add Gear',
    desc: 'Register master gear items, serial numbers, categories, model specs & photos.',
    icon: <Camera className="w-5 h-5 text-indigo-500 shrink-0" />,
    recommendedFeatures: ['gearLibrary', 'toolingLists']
  },
  {
    id: 'manage_inventory',
    title: 'Manage Multi-Warehouse Inventory',
    shortLabel: 'Manage Inventory',
    desc: 'Track multi-location stock counts, supplier directories & component BOMs.',
    icon: <Database className="w-5 h-5 text-teal-500 shrink-0" />,
    recommendedFeatures: ['inventoryManagement', 'supplierManagement', 'bomManagement', 'gearLibrary']
  },
  {
    id: 'asset_labels',
    title: 'Create Asset Labels & Barcode / QR Tags',
    shortLabel: 'Asset Labels',
    desc: 'Design label stickers, print Avery QR sheets, and scan physical barcodes.',
    icon: <QrCode className="w-5 h-5 text-emerald-500 shrink-0" />,
    recommendedFeatures: ['gearLibrary', 'inventoryManagement', 'travelCases']
  },
  {
    id: 'field_kiosk',
    title: 'Deploy Field Kiosk & Self-Service Checkouts',
    shortLabel: 'Field Kiosk',
    desc: 'Set up touch terminals for rapid item check-ins, check-outs & digital signatures.',
    icon: <Terminal className="w-5 h-5 text-purple-500 shrink-0" />,
    recommendedFeatures: ['kioskMode', 'gearLibrary', 'reminders']
  },
  {
    id: 'maintenance_safety',
    title: 'Maintenance, Repairs & Safety Testing',
    shortLabel: 'Maintenance',
    desc: 'Schedule safety calibrations, track cleaning intervals & log equipment repairs.',
    icon: <Wrench className="w-5 h-5 text-rose-500 shrink-0" />,
    recommendedFeatures: ['reminders', 'gearLibrary', 'supplierManagement']
  },
  {
    id: 'b2b_marketplace',
    title: 'B2B Hire & Rental Marketplace',
    shortLabel: 'B2B Rentals',
    desc: 'List spare gear for sub-hire or lease equipment from partner organizations.',
    icon: <Store className="w-5 h-5 text-blue-500 shrink-0" />,
    recommendedFeatures: ['marketplace', 'gearLibrary']
  }
];

const AVAILABLE_FEATURES: { key: FeatureKey; label: string; desc: string; category: string }[] = [
  { key: 'gearLibrary', label: 'Primary Gear Library', desc: 'Manage central equipment index, item categories, serial numbers & tags.', category: 'Assets' },
  { key: 'inventoryManagement', label: 'Custom Inventory Sheets', desc: 'Establish multiple regional locations, inventories & warehouse manifests.', category: 'Assets' },
  { key: 'toolingLists', label: 'Smart Packing Lists', desc: 'Create packing checklists, flight kit specs, and job load-outs.', category: 'Checklists' },
  { key: 'aiWizard', label: 'Gemini AI Assistant', desc: 'Generate template checklists or optimize gear weights automatically with AI.', category: 'Intelligence' },
  { key: 'marketplace', label: 'B2B Hire Marketplace', desc: 'Search, list or lease spare equipment with partner organizations.', category: 'Marketplace' },
  { key: 'kioskMode', label: 'Self-Service Gear Terminal', desc: 'Deploys visual secure sign-out kiosks with signature support.', category: 'Operations' },
  { key: 'reminders', label: 'Inspections & Calibrations', desc: 'Setup alerts for recurring safety testing, cleaning, and testing intervals.', category: 'Maintenance' },
  { key: 'travelCases', label: 'Mobile Containers & Case Packs', desc: 'Group specific item packages into hardcases or flightcases.', category: 'Logistics' },
  { key: 'organizer', label: 'Interactive Systems Builder', desc: 'Build graphic setups and visual assemblies of interconnected gear.', category: 'Logistics' },
  { key: 'bomManagement', label: 'Bills of Materials (BOM)', desc: 'Track technical components, assemblies & subparts catalogs.', category: 'Enterprise' },
  { key: 'supplierManagement', label: 'Vendor CRM Directory', desc: 'Centralize details for dealers, sales representatives, and manufacturer warranties.', category: 'Enterprise' }
];

export default function Onboarding({ user, onComplete, onClose }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedIndustryId, setSelectedIndustryId] = useState(user.selectedIndustry || 'production');
  const [workspaceName, setWorkspaceName] = useState('Primary Video Lab');
  const [userRole, setUserRole] = useState(user.role || 'Operator / Gear Lead');
  
  // Selected intent choices (multi-select)
  const [selectedIntents, setSelectedIntents] = useState<Set<string>>(
    new Set(['create_kits', 'add_gear', 'asset_labels'])
  );
  const [customGoalPrompt, setCustomGoalPrompt] = useState('');

  // Auto-configuration preference mode
  const [configChoice, setConfigChoice] = useState<'auto' | 'full' | 'custom'>('auto');

  // Currently enabled features
  const [enabledFeatures, setEnabledFeatures] = useState<Set<FeatureKey>>(
    new Set(AVAILABLE_FEATURES.map(f => f.key))
  );

  // Auto pre-fill workspace sandbox names based on industry selected
  const handleIndustrySelect = (indId: string) => {
    setSelectedIndustryId(indId);
    if (indId === 'production') setWorkspaceName('Primary Video Lab');
    else if (indId === 'construction') setWorkspaceName('Contracting & Tools Hub');
    else if (indId === 'costume') setWorkspaceName('Wardrobe Dressing Room');
    else if (indId === 'car_rental') setWorkspaceName('Car Fleet Garage');
    else if (indId === 'it') setWorkspaceName('Hardware Server Rack');
    else if (indId === 'event') setWorkspaceName('Main Event Banquet Store');
    else if (indId === 'sports') setWorkspaceName('Championship Athletic Locker');
    else if (indId === 'outdoors') setWorkspaceName('Expedition Basecamp Pack');
    else setWorkspaceName('My General Inventory Hub');
  };

  const toggleIntent = (intentId: string) => {
    const next = new Set(selectedIntents);
    if (next.has(intentId)) {
      if (next.size > 1) {
        next.delete(intentId);
      } else {
        toast.info("Select at least one primary intent.");
      }
    } else {
      next.add(intentId);
    }
    setSelectedIntents(next);
  };

  // Compute recommended feature set based on selected intents & configChoice
  useEffect(() => {
    if (configChoice === 'full') {
      // Enable all
      setEnabledFeatures(new Set(AVAILABLE_FEATURES.map(f => f.key)));
    } else if (configChoice === 'auto') {
      // Combine recommended features from all selected intents
      const recSet = new Set<FeatureKey>();
      // Always include core gear library by default
      recSet.add('gearLibrary');
      
      selectedIntents.forEach(intentId => {
        const found = INTENT_OPTIONS.find(i => i.id === intentId);
        if (found) {
          found.recommendedFeatures.forEach(feat => recSet.add(feat));
        }
      });

      // If user mentioned AI or Packing in custom prompt, add aiWizard / toolingLists
      const promptLower = customGoalPrompt.toLowerCase();
      if (promptLower.includes('ai') || promptLower.includes('assistant') || promptLower.includes('smart')) {
        recSet.add('aiWizard');
      }
      if (promptLower.includes('pack') || promptLower.includes('list') || promptLower.includes('flight')) {
        recSet.add('toolingLists');
        recSet.add('travelCases');
      }

      setEnabledFeatures(recSet);
    }
  }, [selectedIntents, customGoalPrompt, configChoice]);

  const toggleFeature = (key: FeatureKey) => {
    const fresh = new Set(enabledFeatures);
    if (fresh.has(key)) {
      fresh.delete(key);
    } else {
      fresh.add(key);
    }
    setEnabledFeatures(fresh);
  };

  const getIndustryIcon = (iconName: string) => {
    switch (iconName) {
      case 'Camera': return <Camera className="w-5 h-5 text-indigo-500 shrink-0" />;
      case 'Wrench': return <Wrench className="w-5 h-5 text-amber-600 shrink-0" />;
      case 'Shirt': return <Shirt className="w-5 h-5 text-pink-500 shrink-0" />;
      case 'Car': return <Car className="w-5 h-5 text-red-500 shrink-0" />;
      case 'Cpu': return <Cpu className="w-5 h-5 text-teal-500 shrink-0" />;
      case 'Cake': return <Cake className="w-5 h-5 text-purple-500 shrink-0" />;
      case 'Compass': return <Compass className="w-5 h-5 text-emerald-600 shrink-0" />;
      case 'Trophy': return <Trophy className="w-5 h-5 text-amber-500 shrink-0" />;
      default: return <Package className="w-5 h-5 text-slate-500 shrink-0" />;
    }
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleFinishConfig();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleFinishConfig = async () => {
    try {
      const generatedWorkspaceId = `ws_${Math.random().toString(36).substring(2, 11)}`;
      const activeWorkspace = {
        id: generatedWorkspaceId,
        name: workspaceName.trim() || 'Default Workspace',
        industry: selectedIndustryId,
        createdAt: new Date().toISOString()
      };

      // Determine disabled items in the features system
      const disabledList: FeatureKey[] = AVAILABLE_FEATURES
        .map(f => f.key)
        .filter(key => !enabledFeatures.has(key));

      const selectedIntentsList = Array.from(selectedIntents);

      await updateDoc(doc(db, 'users', user.uid), {
        onboardingCompleted: true,
        configOnboardingCompleted: true,
        selectedIndustry: selectedIndustryId,
        role: userRole.trim() || 'Operator',
        activeWorkspaceId: generatedWorkspaceId,
        workspaces: [activeWorkspace],
        disabledFeatures: disabledList,
        activeWorkspacePreset: configChoice === 'auto' ? 'smart_auto' : configChoice,
        onboardingConfig: {
          industry: selectedIndustryId,
          role: userRole.trim() || 'Operator',
          intents: selectedIntentsList,
          customPrompt: customGoalPrompt.trim(),
          configChoice: configChoice,
          activeModulesCount: enabledFeatures.size,
          disabledModulesCount: disabledList.length,
          configuredAt: new Date().toISOString()
        }
      });

      // Send welcome email if needed
      authenticatedFetch('/api/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: user.email,
          displayName: user.displayName,
          subPlan: user.plan ? user.plan.toUpperCase() : "FREE STARTER"
        })
      }).catch(err => console.error("Could not trigger welcome email:", err));

      toast.success(`Success! Workspace configured for ${workspaceName} (${enabledFeatures.size} modules active).`);
      onComplete();
    } catch (error) {
      console.error("Error setting onboarding configuration:", error);
      toast.error("Failed to complete system calibration.");
    }
  };

  const currentStepData = [
    { title: "Industry & Operations Hub", subtitle: "Select your industry trade so we adapt nomenclature, QR codes, and default fields." },
    { title: "What do you intend to do?", subtitle: "Choose your primary goals so Packer Tools tailors the interface specifically for your workflow." },
    { title: "Smart AI Configuration", subtitle: "We evaluated your intent and formulated a clean, high-performance module layout." },
    { title: "Fine-Tune Individual Modules", subtitle: "Review and toggle specific platform services to match your exact operational requirements." },
    { title: "Ready for Launch!", subtitle: "Confirming deployment layout & activating user preferences." }
  ][currentStep];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-neutral-950/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl bg-white text-neutral-900 rounded-2xl sm:rounded-[2.5rem] shadow-2xl border border-neutral-100 flex flex-col overflow-hidden relative max-h-[94vh] sm:max-h-[90vh]"
      >
        {/* Top Branding Header */}
        <div className="px-4 sm:px-8 pt-4 sm:pt-6 pb-3 border-b border-neutral-100 flex justify-between items-center bg-neutral-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-neutral-900 flex items-center justify-center text-white shrink-0 shadow-md">
              <Sparkles size={16} className="text-[#ff4f3a] animate-pulse" />
            </div>
            <div>
              <p className="text-[10px] font-mono tracking-widest text-neutral-400 font-extrabold uppercase leading-none">Smart Setup Calibrator</p>
              <h2 className="text-xs sm:text-sm font-black tracking-tight text-neutral-800 uppercase mt-0.5">Use-Case Workspace Onboarder</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-[10px] font-mono font-black uppercase text-neutral-400 bg-neutral-200/60 px-2 py-1 rounded-md shrink-0">
              Step {currentStep + 1} / 5
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg bg-neutral-200/60 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center transition"
                title="Close Onboarding"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Progress Timeline Bar */}
        <div className="w-full bg-neutral-100 h-1.5 relative shrink-0">
          <motion.div 
            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-[#ff4f3a] to-amber-500"
            initial={{ width: '0%' }}
            animate={{ width: `${((currentStep + 1) / 5) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Scrollable Setup Body */}
        <div className="p-4 sm:p-8 flex-1 overflow-y-auto">
          <div className="space-y-4 sm:space-y-6">
            <div className="space-y-1">
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#ff4f3a] bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-100">
                INTENT ENGINE &middot; v5.21.0
              </span>
              <h3 className="text-lg sm:text-xl font-black tracking-tight text-neutral-800 leading-tight">
                {currentStepData.title}
              </h3>
              <p className="text-xs font-semibold text-neutral-400 leading-relaxed">
                {currentStepData.subtitle}
              </p>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="pt-1"
              >
                {/* STEP 1: Focus Industry & Workspace Name */}
                {currentStep === 0 && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 max-h-[260px] overflow-y-auto pr-1">
                      {INDUSTRIES.map((ind) => (
                        <button
                          key={ind.id}
                          type="button"
                          onClick={() => handleIndustrySelect(ind.id)}
                          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all flex gap-3 items-center min-h-[52px] cursor-pointer touch-manipulation active:scale-[0.99] ${
                            selectedIndustryId === ind.id
                              ? 'border-[#ff4f3a] bg-rose-50/20 ring-2 ring-[#ff4f3a]/15 shadow-sm'
                              : 'border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300'
                          }`}
                        >
                          <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center shrink-0">
                            {getIndustryIcon(ind.icon)}
                          </div>
                          <div className="space-y-0.5 min-w-0">
                            <p className="text-xs font-black tracking-tight text-neutral-800">{ind.name}</p>
                            <p className="text-[10px] text-neutral-400 font-semibold truncate leading-relaxed">
                              {ind.gearLabelPlural} &middot; {ind.listLabelSingular}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="p-4 sm:p-5 bg-neutral-50 rounded-2xl border border-neutral-200/80 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-[9px] font-black uppercase tracking-widest text-neutral-400">
                            Workspace Sandbox Name
                          </label>
                          <input
                            type="text"
                            value={workspaceName}
                            onChange={(e) => setWorkspaceName(e.target.value)}
                            placeholder="e.g. Primary Video Lab..."
                            className="w-full min-h-[44px] px-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl text-xs sm:text-sm font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-[#ff4f3a]/20 focus:border-[#ff4f3a]"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[9px] font-black uppercase tracking-widest text-neutral-400">
                            Your Team Role / Duty
                          </label>
                          <input
                            type="text"
                            value={userRole}
                            onChange={(e) => setUserRole(e.target.value)}
                            placeholder="e.g. Flight Rig Lead, Logistics Mgr..."
                            className="w-full min-h-[44px] px-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl text-xs sm:text-sm font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-[#ff4f3a]/20 focus:border-[#ff4f3a]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: Intended Activities & Goals Matrix */}
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">
                        Select all tasks you plan to perform:
                      </span>
                      <span className="text-[10px] font-bold text-[#ff4f3a] bg-rose-50 px-2 py-0.5 rounded-md">
                        {selectedIntents.size} Selected
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[280px] overflow-y-auto pr-1">
                      {INTENT_OPTIONS.map((intent) => {
                        const isSelected = selectedIntents.has(intent.id);
                        return (
                          <button
                            key={intent.id}
                            type="button"
                            onClick={() => toggleIntent(intent.id)}
                            className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 relative cursor-pointer touch-manipulation active:scale-[0.99] ${
                              isSelected
                                ? 'border-[#ff4f3a] bg-rose-50/30 ring-2 ring-[#ff4f3a]/20 shadow-sm'
                                : 'border-neutral-200 bg-white hover:bg-neutral-50 hover:border-neutral-300'
                            }`}
                          >
                            <div className="p-2 bg-neutral-100 rounded-xl shrink-0 mt-0.5">
                              {intent.icon}
                            </div>
                            <div className="space-y-0.5 min-w-0 flex-1 pr-6">
                              <p className="text-xs font-black tracking-tight text-neutral-900 leading-snug">
                                {intent.title}
                              </p>
                              <p className="text-[10px] font-semibold text-neutral-400 leading-relaxed">
                                {intent.desc}
                              </p>
                            </div>
                            <div className={`absolute top-3.5 right-3.5 w-5 h-5 rounded-md flex items-center justify-center border transition ${
                              isSelected ? 'bg-[#ff4f3a] text-white border-[#ff4f3a]' : 'border-neutral-300 bg-white'
                            }`}>
                              {isSelected && <Check size={12} strokeWidth={3} />}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/80 space-y-1.5">
                      <label className="block text-[9px] font-black uppercase tracking-widest text-neutral-500">
                        Custom Workflow or Specific Equipment Needs (Optional):
                      </label>
                      <textarea
                        value={customGoalPrompt}
                        onChange={(e) => setCustomGoalPrompt(e.target.value)}
                        placeholder="e.g. We build camera flight packages, need to print QR tags for flight cases, and run daily equipment sign-outs..."
                        rows={2}
                        className="w-full p-2.5 bg-white border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-[#ff4f3a]/20 focus:border-[#ff4f3a] resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* STEP 3: Smart AI Recommendation & Configuration Question */}
                {currentStep === 2 && (
                  <div className="space-y-4">
                    {/* AI Prompt Insights Card */}
                    <div className="p-4 bg-gradient-to-br from-neutral-900 to-neutral-950 text-white rounded-2xl sm:rounded-3xl shadow-xl border border-neutral-800 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-[#ff4f3a]/20 text-[#ff4f3a]">
                          <Sparkles size={16} />
                        </div>
                        <span className="text-[10px] font-mono font-black uppercase tracking-widest text-amber-400">
                          AI Workspace Analysis
                        </span>
                      </div>

                      <p className="text-xs text-neutral-200 font-medium leading-relaxed">
                        Based on your selected intent (<strong>{Array.from(selectedIntents).map(id => INTENT_OPTIONS.find(o => o.id === id)?.shortLabel).join(', ')}</strong>), Packer Tools has formulated a customized module layout.
                      </p>

                      <div className="p-3 bg-neutral-800/80 rounded-xl border border-neutral-700/60 flex flex-wrap gap-1.5 items-center text-[10px]">
                        <span className="text-neutral-400 font-extrabold uppercase mr-1">Recommended Modules:</span>
                        {AVAILABLE_FEATURES.filter(f => enabledFeatures.has(f.key)).map(f => (
                          <span key={f.key} className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-md font-bold">
                            {f.label}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Configuration Question */}
                    <div className="space-y-3 pt-1">
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-black uppercase tracking-wide text-neutral-800">
                          Would you like the app automatically configured for your use case?
                        </h4>
                        <p className="text-[11px] text-neutral-400 font-semibold">
                          Auto-configuring hides unneeded tools so your workspace stays clean, fast, and clutter-free.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setConfigChoice('auto')}
                          className={`p-3.5 rounded-2xl border text-left transition-all space-y-1.5 cursor-pointer active:scale-95 ${
                            configChoice === 'auto'
                              ? 'border-[#ff4f3a] bg-rose-50/30 ring-2 ring-[#ff4f3a]/20 shadow-md'
                              : 'border-neutral-200 bg-white hover:bg-neutral-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase tracking-widest text-[#ff4f3a] bg-rose-100/80 px-2 py-0.5 rounded">Recommended</span>
                            {configChoice === 'auto' && <CheckCircle2 size={16} className="text-[#ff4f3a]" />}
                          </div>
                          <p className="text-xs font-black uppercase tracking-tight text-neutral-900">⚡ Auto-Configure</p>
                          <p className="text-[9.5px] text-neutral-500 font-medium leading-snug">
                            Activate only the {enabledFeatures.size} modules matching your exact goals.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setConfigChoice('full')}
                          className={`p-3.5 rounded-2xl border text-left transition-all space-y-1.5 cursor-pointer active:scale-95 ${
                            configChoice === 'full'
                              ? 'border-[#ff4f3a] bg-rose-50/30 ring-2 ring-[#ff4f3a]/20 shadow-md'
                              : 'border-neutral-200 bg-white hover:bg-neutral-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400">All Features</span>
                            {configChoice === 'full' && <CheckCircle2 size={16} className="text-[#ff4f3a]" />}
                          </div>
                          <p className="text-xs font-black uppercase tracking-tight text-neutral-900">🌐 Full Workspace</p>
                          <p className="text-[9.5px] text-neutral-500 font-medium leading-snug">
                            Keep all 11 modules unlocked across all navigation menus.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setConfigChoice('custom')}
                          className={`p-3.5 rounded-2xl border text-left transition-all space-y-1.5 cursor-pointer active:scale-95 ${
                            configChoice === 'custom'
                              ? 'border-[#ff4f3a] bg-rose-50/30 ring-2 ring-[#ff4f3a]/20 shadow-md'
                              : 'border-neutral-200 bg-white hover:bg-neutral-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Manual</span>
                            {configChoice === 'custom' && <CheckCircle2 size={16} className="text-[#ff4f3a]" />}
                          </div>
                          <p className="text-xs font-black uppercase tracking-tight text-neutral-900">🛠️ Fine-Tune</p>
                          <p className="text-[9.5px] text-neutral-500 font-medium leading-snug">
                            Hand-pick each module toggle on the next screen.
                          </p>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 4: Features Fine Tuning Selector Grid */}
                {currentStep === 3 && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center bg-neutral-50 px-3.5 py-2.5 rounded-xl border border-neutral-200">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 font-bold">
                        {enabledFeatures.size} of {AVAILABLE_FEATURES.length} Modules Active
                      </span>
                      <div className="flex gap-2">
                        <button 
                          type="button"
                          onClick={() => setEnabledFeatures(new Set(AVAILABLE_FEATURES.map(f => f.key)))}
                          className="text-[9px] font-black uppercase text-neutral-600 hover:text-[#ff4f3a] px-2 py-1 bg-white border border-neutral-200 rounded-lg cursor-pointer"
                        >
                          Enable All
                        </button>
                        <button 
                          type="button"
                          onClick={() => setEnabledFeatures(new Set(['gearLibrary']))}
                          className="text-[9px] font-black uppercase text-neutral-600 hover:text-[#ff4f3a] px-2 py-1 bg-white border border-neutral-200 rounded-lg cursor-pointer"
                        >
                          Minimal
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[240px] overflow-y-auto pr-1">
                      {AVAILABLE_FEATURES.map((feature) => {
                        const active = enabledFeatures.has(feature.key);
                        return (
                          <button
                            key={feature.key}
                            type="button"
                            onClick={() => toggleFeature(feature.key)}
                            className={`p-3 rounded-xl border text-left transition-all flex justify-between items-center min-h-[48px] cursor-pointer touch-manipulation ${
                              active
                                ? 'border-neutral-900 bg-neutral-950 text-white ring-1 ring-neutral-900'
                                : 'border-neutral-200 bg-white hover:bg-neutral-50'
                            }`}
                          >
                            <div className="space-y-0.5 min-w-0 flex-1 pr-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                  active ? 'bg-neutral-800 text-white' : 'bg-neutral-100 text-neutral-500'
                                }`}>
                                  {feature.category}
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-tight truncate">
                                  {feature.label}
                                </span>
                              </div>
                              <p className={`text-[8.5px] leading-tight mt-1 truncate ${active ? 'text-neutral-400 font-bold' : 'text-neutral-400 font-semibold'}`}>
                                {feature.desc}
                              </p>
                            </div>
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${
                              active ? 'bg-white text-neutral-950 border-white' : 'border-neutral-300'
                            }`}>
                              {active && <Check size={11} strokeWidth={4} />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* STEP 5: Confirmation & Deploy */}
                {currentStep === 4 && (
                  <div className="text-center py-2 space-y-4">
                    <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto shadow-inner text-emerald-600 border border-emerald-100">
                      <CheckCircle2 size={32} />
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-[#ff4f3a] font-extrabold">Calibration Ready</p>
                      <h4 className="text-xl font-black text-neutral-900 tracking-tight">Deploying your tailored workspace...</h4>
                      <p className="text-xs text-neutral-400 leading-relaxed max-w-sm mx-auto">
                        Your workspace layout is configured for <strong>{workspaceName}</strong> with <strong>{enabledFeatures.size} active modules</strong>.
                      </p>
                    </div>

                    <div className="max-w-md mx-auto grid grid-cols-2 gap-2.5 pb-1">
                      <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-200 text-left">
                        <span className="text-[8px] font-black uppercase text-neutral-400 tracking-wider">INDUSTRY HUB</span>
                        <p className="text-xs font-black truncate mt-0.5 text-neutral-800">
                          {INDUSTRIES.find(it => it.id === selectedIndustryId)?.name || 'General Operations'}
                        </p>
                      </div>

                      <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-200 text-left">
                        <span className="text-[8px] font-black uppercase text-neutral-400 tracking-wider">CONFIGURED MODULES</span>
                        <p className="text-xs font-black mt-0.5 text-neutral-800">
                          {enabledFeatures.size} Active &middot; {AVAILABLE_FEATURES.length - enabledFeatures.size} Hidden
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Action Controls Footer */}
        <div className="px-4 sm:px-8 py-4 border-t border-neutral-100 flex justify-between items-center bg-neutral-50 rounded-b-2xl sm:rounded-b-[2.5rem] shrink-0 gap-3">
          <div>
            {currentStep > 0 ? (
              <button
                type="button"
                onClick={handlePrev}
                className="px-4 py-2.5 hover:bg-neutral-200 border border-neutral-200 bg-white text-neutral-600 rounded-xl text-xs font-black uppercase tracking-widest transition min-h-[44px] cursor-pointer touch-manipulation active:scale-95"
              >
                Go Back
              </button>
            ) : (
              <div />
            )}
          </div>

          <button
            type="button"
            onClick={handleNext}
            id="btn-onboarding-next"
            className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-850 hover:scale-[1.02] text-white rounded-xl text-xs font-black uppercase tracking-widest transition shadow-xl flex items-center gap-2 min-h-[44px] cursor-pointer touch-manipulation active:scale-95"
          >
            <span>{currentStep === 4 ? 'Deploy Configured Workspace' : 'Continue'}</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
