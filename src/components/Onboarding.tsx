import React, { useState } from 'react';
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
  Briefcase
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, INDUSTRIES } from '../types';
import { toast } from 'sonner';

interface OnboardingProps {
  user: UserProfile;
  onComplete: () => void;
}

const steps = [
  {
    title: "Welcome to Packer Tools",
    description: "The professional visual inventory & gear lifecycle platform. Let's get you set up for success.",
    icon: <Package className="w-12 h-12 text-primary" />,
    color: "bg-primary/10"
  },
  {
    title: "Build Your Gear Library",
    description: "Add your equipment with photos, serial numbers, and asset tags. Visual verification starts here.",
    icon: <Camera className="w-12 h-12 text-blue-500" />,
    color: "bg-blue-50"
  },
  {
    title: "Smart Packing Lists",
    description: "Create lists for every job. Use our AI wizard to generate templates or build from scratch.",
    icon: <Layout className="w-12 h-12 text-emerald-500" />,
    color: "bg-emerald-50"
  },
  {
    title: "Select Your Primary Industry",
    description: "Choose your focus area. Your workspace terms (like lists, categories, and gear labels) will automatically localize.",
    icon: <Briefcase className="w-12 h-12 text-amber-500" />,
    color: "bg-amber-50"
  },
  {
    title: "You're All Set!",
    description: "Start organizing your gear and streamline your professional workflow today.",
    icon: <CheckCircle2 className="w-12 h-12 text-primary" />,
    color: "bg-primary/10"
  }
];

export default function Onboarding({ user, onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedIndustryId, setSelectedIndustryId] = useState('production');
  const [workspaceName, setWorkspaceName] = useState('My Camera Gear Hub');

  // Pre-fill workspace name when industry changes
  const handleIndustrySelect = (indId: string) => {
    setSelectedIndustryId(indId);
    if (indId === 'production') setWorkspaceName('Primary Video Lab');
    else if (indId === 'construction') setWorkspaceName('Contracting & Tools Hub');
    else if (indId === 'costume') setWorkspaceName('Wardrobe Dressing Room');
    else if (indId === 'car_rental') setWorkspaceName('Car Fleet Garage');
    else if (indId === 'it') setWorkspaceName('Hardware Server Rack');
    else if (indId === 'event') setWorkspaceName('Main Event Banquet Store');
    else setWorkspaceName('My General Inventory');
  };

  const getIndustryIcon = (iconName: string) => {
    switch (iconName) {
      case 'Camera': return <Camera className="w-5 h-5 text-indigo-500 shrink-0" />;
      case 'Wrench': return <Wrench className="w-5 h-5 text-amber-600 shrink-0" />;
      case 'Shirt': return <Shirt className="w-5 h-5 text-pink-500 shrink-0" />;
      case 'Car': return <Car className="w-5 h-5 text-red-500 shrink-0" />;
      case 'Cpu': return <Cpu className="w-5 h-5 text-teal-500 shrink-0" />;
      case 'Cake': return <Cake className="w-5 h-5 text-purple-500 shrink-0" />;
      default: return <Package className="w-5 h-5 text-slate-500 shrink-0" />;
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    try {
      const generatedWorkspaceId = `ws_${Math.random().toString(36).substring(2, 11)}`;
      const activeWorkspace = {
        id: generatedWorkspaceId,
        name: workspaceName.trim() || 'Default Workspace',
        industry: selectedIndustryId,
        createdAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'users', user.uid), {
        onboardingCompleted: true,
        selectedIndustry: selectedIndustryId,
        activeWorkspaceId: generatedWorkspaceId,
        workspaces: [activeWorkspace]
      });
      
      // Asynchronously release welcome onboarding packet 
      fetch('/api/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: user.email,
          displayName: user.displayName,
          subPlan: user.plan ? user.plan.toUpperCase() : "FREE STARTER"
        })
      }).catch(err => console.error("Could not trigger welcome email:", err));

      toast.success(`Welcome checklist slip queued! Custom ${selectedIndustryId} workspace created.`);
      onComplete();
    } catch (error) {
      console.error("Error completing onboarding:", error);
      toast.error("Failed to complete onboarding setup.");
    }
  };

  const handleSkip = () => {
    handleFinish();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`bg-white rounded-[2.5rem] shadow-2xl ${
          currentStep === 3 ? 'max-w-2xl' : 'max-w-lg'
        } w-full overflow-hidden relative transition-all duration-300`}
      >
        <button 
          onClick={handleSkip}
          className="absolute top-6 right-6 p-2 text-neutral-400 hover:text-neutral-600 transition-colors z-10"
        >
          <X size={24} />
        </button>

        <div className="p-8 md:p-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {currentStep !== 3 ? (
                <div className="text-center space-y-6">
                  <div className={`w-24 h-24 ${steps[currentStep].color} rounded-3xl flex items-center justify-center mx-auto mb-6`}>
                    {steps[currentStep].icon}
                  </div>

                  <div className="space-y-4">
                    <h2 className="text-3xl font-black tracking-tight text-neutral-900">
                      {steps[currentStep].title}
                    </h2>
                    <p className="text-lg text-neutral-500 font-medium leading-relaxed">
                      {steps[currentStep].description}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-black tracking-tight text-neutral-900">Choose Your Workspace Focus</h2>
                    <p className="text-xs text-neutral-500 leading-relaxed max-w-md mx-auto">
                      Select your primary industry category below. We will customize your terminology & create your initial sandbox to launch.
                    </p>
                  </div>

                  {/* Grid of Industry selectors */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1">
                    {INDUSTRIES.map((ind) => (
                      <button
                        key={ind.id}
                        type="button"
                        onClick={() => handleIndustrySelect(ind.id)}
                        className={`p-3.5 rounded-2xl border text-left transition-all flex gap-3 ${
                          selectedIndustryId === ind.id
                            ? 'border-primary bg-primary/[0.02] ring-2 ring-primary/20'
                            : 'border-neutral-150 hover:bg-neutral-50 hover:border-neutral-300'
                        }`}
                      >
                        <div className="w-9 h-9 bg-neutral-100 rounded-lg flex items-center justify-center">
                          {getIndustryIcon(ind.icon)}
                        </div>
                        <div className="space-y-0.5 min-w-0">
                          <p className="text-[11px] font-black tracking-tight text-neutral-800">{ind.name}</p>
                          <p className="text-[9px] text-neutral-400 font-bold truncate tracking-normal">{ind.gearLabelPlural} &middot; {ind.listLabelSingular}</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Workspace name customizer */}
                  <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-150 space-y-3">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400">
                      Specify Workspace Sandbox Name
                    </label>
                    <input
                      type="text"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      placeholder="e.g. Primary Rentals Hub..."
                      className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-xs font-black text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-10 space-y-6">
            <div className="flex justify-center gap-2">
              {steps.map((_, idx) => (
                <div 
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentStep ? 'w-8 bg-primary' : 'w-2 bg-neutral-200'
                  }`}
                />
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleNext}
                id="btn-onboarding-next"
                className="w-full py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest hover:bg-primary/95 transition shadow-xl flex items-center justify-center gap-2"
              >
                {currentStep === steps.length - 1 ? 'Get Started' : 'Next Step'}
                <ArrowRight size={20} />
              </button>
              
              {currentStep < steps.length - 1 && (
                <button
                  onClick={handleSkip}
                  id="btn-onboarding-skip"
                  className="w-full py-2.5 text-neutral-400 font-bold uppercase tracking-widest hover:text-neutral-600 transition"
                >
                  Skip Onboarding
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
