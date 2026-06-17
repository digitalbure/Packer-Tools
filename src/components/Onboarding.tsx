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
  Briefcase
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, INDUSTRIES, FeatureKey } from '../types';
import { toast } from 'sonner';
import { authenticatedFetch } from '../lib/api';

interface OnboardingProps {
  user: UserProfile;
  onComplete: () => void;
}

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

export default function Onboarding({ user, onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedIndustryId, setSelectedIndustryId] = useState('production');
  const [workspaceName, setWorkspaceName] = useState('Primary Video Lab');
  const [userRole, setUserRole] = useState('');
  const [useGoal, setUseGoal] = useState<'packing' | 'inventory' | 'tagging' | 'max'>('max');
  const [isLiteMode, setIsLiteMode] = useState(false);
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

  // Preset module sets based on use intent & Lite mode configurations
  useEffect(() => {
    let preselectedKeys: FeatureKey[] = AVAILABLE_FEATURES.map(f => f.key);

    if (isLiteMode) {
      if (useGoal === 'packing') {
        preselectedKeys = ['toolingLists', 'travelCases', 'organizer', 'aiWizard'];
      } else if (useGoal === 'inventory') {
        preselectedKeys = ['inventoryManagement', 'reminders', 'bomManagement', 'supplierManagement'];
      } else if (useGoal === 'tagging') {
        preselectedKeys = ['gearLibrary'];
      } else {
        // General lite view
        preselectedKeys = ['gearLibrary', 'inventoryManagement', 'toolingLists'];
      }
    } else {
      if (useGoal === 'packing') {
        preselectedKeys = ['toolingLists', 'travelCases', 'organizer', 'aiWizard', 'gearLibrary'];
      } else if (useGoal === 'inventory') {
        preselectedKeys = ['inventoryManagement', 'reminders', 'bomManagement', 'supplierManagement', 'gearLibrary'];
      } else if (useGoal === 'tagging') {
        preselectedKeys = ['gearLibrary', 'inventoryManagement', 'reminders'];
      }
    }

    setEnabledFeatures(new Set(preselectedKeys));
  }, [useGoal, isLiteMode]);

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

      await updateDoc(doc(db, 'users', user.uid), {
        onboardingCompleted: true,
        configOnboardingCompleted: true,
        selectedIndustry: selectedIndustryId,
        activeWorkspaceId: generatedWorkspaceId,
        workspaces: [activeWorkspace],
        disabledFeatures: disabledList,
        activeWorkspacePreset: isLiteMode ? `lite_${useGoal}` : useGoal,
        onboardingConfig: {
          industry: selectedIndustryId,
          role: userRole.trim() || 'Operator',
          intent: useGoal,
          isLiteMode: isLiteMode
        }
      });

      // Send greeting email
      authenticatedFetch('/api/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: user.email,
          displayName: user.displayName,
          subPlan: user.plan ? user.plan.toUpperCase() : "FREE STARTER"
        })
      }).catch(err => console.error("Could not trigger welcome email:", err));

      toast.success(`Success! Workspace customized for ${workspaceName}.`);
      onComplete();
    } catch (error) {
      console.error("Error setting onboarding configuration:", error);
      toast.error("Failed to complete system calibration.");
    }
  };

  const currentStepData = [
    { title: "Choose Focus Industry", subtitle: "We synchronize local nomenclature, fields & logs for your trade." },
    { title: "Define Role & Purpose", subtitle: "Help us calibrate widgets to better accommodate your specific activities." },
    { title: "Choose UI Density", subtitle: "Lite layouts minimize clutter, maximizing runtime workflow ergonomics." },
    { title: "Fine-tune Modules", subtitle: "Optimize platform services by activating or de-activating functional sectors below." },
    { title: "Ready for Dispatch!", subtitle: "Confirming customized deployment layout settings." }
  ][currentStep];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl bg-white text-neutral-900 rounded-[2.5rem] shadow-2xl border border-neutral-100 flex flex-col overflow-hidden relative"
      >
        {/* Top Branding Header */}
        <div className="px-8 pt-8 pb-3 border-b border-neutral-100 flex justify-between items-center bg-neutral-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-neutral-900 flex items-center justify-center text-white">
              <Sliders size={15} className="text-[#ff4f3a]" />
            </div>
            <div>
              <p className="text-[10px] font-mono tracking-widest text-neutral-400 font-extrabold uppercase leading-none">Config Onboarder</p>
              <h2 className="text-sm font-black tracking-tight text-neutral-800 uppercase mt-0.5">Workspace Setup Calibration</h2>
            </div>
          </div>
          <div className="text-[10px] font-mono font-black uppercase text-neutral-400">
            Step {currentStep + 1} of 5
          </div>
        </div>

        {/* Progress Timeline Header Accent */}
        <div className="w-full bg-neutral-100 h-1 relative">
          <motion.div 
            className="absolute left-0 top-0 bottom-0 bg-[#ff4f3a]"
            initial={{ width: '0%' }}
            animate={{ width: `${((currentStep + 1) / 5) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Scrollable Setup Body */}
        <div className="p-8 md:p-10 flex-1 overflow-y-auto max-h-[60vh]">
          <div className="space-y-6">
            <div className="space-y-1">
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#ff4f3a] bg-rose-50 px-2 py-0.5 rounded-md">
                SETUP ENGINE
              </span>
              <h3 className="text-xl font-black tracking-tight text-neutral-800 leading-tight">
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
                className="pt-2"
              >
                {/* STEP 1: Focus Industry Selector */}
                {currentStep === 0 && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[250px] overflow-y-auto pr-1">
                      {INDUSTRIES.map((ind) => (
                        <button
                          key={ind.id}
                          type="button"
                          onClick={() => handleIndustrySelect(ind.id)}
                          className={`p-4 rounded-2xl border text-left transition-all flex gap-3 ${
                            selectedIndustryId === ind.id
                              ? 'border-[#ff4f3a] bg-rose-50/10 ring-2 ring-[#ff4f3a]/10'
                              : 'border-neutral-150 hover:bg-neutral-50 hover:border-neutral-300'
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

                    <div className="p-5 bg-neutral-50 rounded-2xl border border-neutral-150 space-y-3">
                      <label className="block text-[9px] font-black uppercase tracking-widest text-neutral-400">
                        Create Sandbox Workspace Name
                      </label>
                      <input
                        type="text"
                        value={workspaceName}
                        onChange={(e) => setWorkspaceName(e.target.value)}
                        placeholder="e.g. Primary Operations Depot..."
                        className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-[#ff4f3a]/10 focus:border-[#ff4f3a]"
                      />
                    </div>
                  </div>
                )}

                {/* STEP 2: Role and Intended Activities Setup */}
                {currentStep === 1 && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="block text-[9px] font-black uppercase tracking-widest text-[#ff4f3a]">
                        What is your team role / core duty?
                      </label>
                      <input
                        type="text"
                        value={userRole}
                        onChange={(e) => setUserRole(e.target.value)}
                        placeholder="e.g. Flight Rig Manager, Lead Technician, Site Coordinator"
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-[#ff4f3a]/10 focus:bg-white"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="block text-[9px] font-black uppercase tracking-widest text-neutral-400">
                        How do you plan to use Packer Tools? (Workspace Goal)
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {[
                          { id: 'packing', label: 'Packing & Checklist Prep', desc: 'Synthesize packing templates, logistics case lists and loadouts.' },
                          { id: 'inventory', label: 'Inventory & Operations', desc: 'Manage master hardware catalogs, supplier assets, and maintenance.' },
                          { id: 'tagging', label: 'Physical Labeling & Audit', desc: 'Scan barcodes, trace serial logs, print QR sticker sheets.' },
                          { id: 'max', label: 'Complete Toolkit (Max Features)', desc: 'Run all modules together - AI assistant, checkout kiosks, and bookings.' }
                        ].map(goal => (
                          <button
                            key={goal.id}
                            type="button"
                            onClick={() => setUseGoal(goal.id as any)}
                            className={`p-4 rounded-2xl border text-left transition-all space-y-1.5 ${
                              useGoal === goal.id
                                ? 'border-[#ff4f3a] bg-rose-50/10 ring-2 ring-[#ff4f3a]/10'
                                : 'border-neutral-150 hover:bg-neutral-50 hover:border-neutral-300'
                            }`}
                          >
                            <p className="text-xs font-black tracking-tight text-neutral-800 uppercase">{goal.label}</p>
                            <p className="text-[10px] leading-relaxed font-semibold text-neutral-400">{goal.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3: Lite Version vs Full Version Toggle */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setIsLiteMode(true)}
                        className={`p-5 rounded-[2.5rem] border text-left transition-all space-y-3 relative ${
                          isLiteMode
                            ? 'border-[#ff4f3a] bg-rose-50/10 ring-2 ring-[#ff4f3a]/15'
                            : 'border-neutral-150 hover:bg-neutral-50 hover:border-neutral-300'
                        }`}
                      >
                        {isLiteMode && (
                          <div className="absolute top-4 right-4 bg-[#ff4f3a] text-white p-1 rounded-full">
                            <Check size={12} />
                          </div>
                        )}
                        <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                          <SlidersHorizontal size={18} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-black uppercase tracking-tight text-neutral-800">Lite Workspace View</p>
                          <p className="text-[10px] leading-relaxed font-semibold text-neutral-400">
                            Deactivates all unnecessary widgets, B2B rental tabs, and secondary menus. Highly streamlined for single-purpose, fast action.
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsLiteMode(false)}
                        className={`p-5 rounded-[2.5rem] border text-left transition-all space-y-3 relative ${
                          !isLiteMode
                            ? 'border-[#ff4f3a] bg-rose-50/10 ring-2 ring-[#ff4f3a]/15'
                            : 'border-neutral-150 hover:bg-neutral-50 hover:border-neutral-300'
                        }`}
                      >
                        {!isLiteMode && (
                          <div className="absolute top-4 right-4 bg-[#ff4f3a] text-white p-1 rounded-full">
                            <Check size={12} />
                          </div>
                        )}
                        <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                          <Workflow size={18} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-black uppercase tracking-tight text-neutral-800">Full Enterprise Workspace</p>
                          <p className="text-[10px] leading-relaxed font-semibold text-neutral-400">
                            Enables all interconnected utilities - AI assistance, checkout terminals with digital signature capture, audits, and automated metrics tracking.
                          </p>
                        </div>
                      </button>
                    </div>

                    <div className="p-4 bg-yellow-50/50 rounded-2xl border border-yellow-100 flex gap-3 text-[10px] text-yellow-800 leading-relaxed">
                      <HelpCircle size={16} className="shrink-0 mt-0.5 text-yellow-600" />
                      <p>
                        <strong>Note on presentation:</strong> Setting the Lite layout is fully dynamic. If selected, other widgets are hidden, but you can always change this, add custom features, or build presets using the Quick Access button at any time.
                      </p>
                    </div>
                  </div>
                )}

                {/* STEP 4: Features Fine Tuning Selector Grid */}
                {currentStep === 3 && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-neutral-50 px-4 py-3 rounded-xl border border-neutral-150">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">Curated plan modules</span>
                      <button 
                        type="button"
                        onClick={() => setEnabledFeatures(new Set(AVAILABLE_FEATURES.map(f => f.key)))}
                        className="text-[9px] font-black uppercase text-neutral-500 hover:text-[#ff4f3a]"
                      >
                        Reset / Enable All
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                      {AVAILABLE_FEATURES.map((feature) => {
                        const active = enabledFeatures.has(feature.key);
                        return (
                          <button
                            key={feature.key}
                            type="button"
                            onClick={() => toggleFeature(feature.key)}
                            className={`p-3 rounded-xl border text-left transition-all flex justify-between items-center ${
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

                {/* STEP 5: Congratulations & Setup Deployment */}
                {currentStep === 4 && (
                  <div className="text-center py-4 space-y-6">
                    <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto shadow-inner text-emerald-600">
                      <CheckCircle2 size={36} />
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-[#ff4f3a] font-extrabold">Calibration Ready</p>
                      <h4 className="text-2xl font-black text-neutral-900 tracking-tight">Constructing personalized workspace...</h4>
                      <p className="text-xs text-neutral-400 leading-relaxed max-w-sm mx-auto">
                        We have customized the interface modules based on your role <strong>({userRole || 'Operator'})</strong>, targeting focus area <strong>({useGoal.toUpperCase()})</strong>.
                      </p>
                    </div>

                    <div className="max-w-md mx-auto grid grid-cols-2 gap-3 pb-3">
                      <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-150 text-left">
                        <span className="text-[8px] font-black uppercase text-neutral-400 tracking-wider">INDUSTRY HUB</span>
                        <p className="text-xs font-black truncate mt-0.5 text-neutral-800">
                          {INDUSTRIES.find(it => it.id === selectedIndustryId)?.name || 'General Operations'}
                        </p>
                      </div>

                      <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-150 text-left">
                        <span className="text-[8px] font-black uppercase text-neutral-400 tracking-wider">ACTIVE MODULES</span>
                        <p className="text-xs font-black mt-0.5 text-neutral-800">
                          {enabledFeatures.size} of {AVAILABLE_FEATURES.length} Enabled
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
        <div className="px-8 py-6 border-t border-neutral-100 flex justify-between items-center bg-neutral-50 rounded-b-[2.5rem]">
          <div>
            {currentStep > 0 ? (
              <button
                type="button"
                onClick={handlePrev}
                className="px-5 py-3 hover:bg-neutral-200 border border-neutral-200 bg-white text-neutral-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition"
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
            className="px-6 py-3 bg-neutral-900 hover:bg-neutral-850 hover:scale-[1.02] text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition shadow-xl flex items-center gap-1.5"
          >
            {currentStep === 4 ? 'Build Custom Workspace' : 'Continue Setting Up'}
            <ArrowRight size={14} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
