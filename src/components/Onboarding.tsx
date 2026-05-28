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
  Users
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
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
    title: "Team Logistics",
    description: "Deploy kits to your team, track distributions, and manage returns with professional precision.",
    icon: <Truck className="w-12 h-12 text-amber-500" />,
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

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        onboardingCompleted: true
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

      toast.success("Welcome checklist slip queued to your email inbox!");
      onComplete();
    } catch (error) {
      console.error("Error completing onboarding:", error);
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
        className="bg-white rounded-[2.5rem] shadow-2xl max-w-lg w-full overflow-hidden relative"
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
              className="space-y-8 text-center"
            >
              <div className={`w-24 h-24 ${steps[currentStep].color} rounded-3xl flex items-center justify-center mx-auto mb-8`}>
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
            </motion.div>
          </AnimatePresence>

          <div className="mt-12 space-y-6">
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
                className="w-full py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest hover:bg-primary/90 transition shadow-xl flex items-center justify-center gap-2"
              >
                {currentStep === steps.length - 1 ? 'Get Started' : 'Next Step'}
                <ArrowRight size={20} />
              </button>
              
              {currentStep < steps.length - 1 && (
                <button
                  onClick={handleSkip}
                  className="w-full py-4 text-neutral-400 font-bold uppercase tracking-widest hover:text-neutral-600 transition"
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
