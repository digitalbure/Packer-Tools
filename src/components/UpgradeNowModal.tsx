import React, { useState } from 'react';
import { X, Check, Zap, Shield, Crown, Loader2, ArrowRight, Sparkles, Lock, Code, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Plan, UserProfile, AdminSettings } from '../types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';

interface UpgradeNowModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  adminSettings: AdminSettings | null;
  onSuccess: (newPlan: string) => void;
  restrictedFeatureName?: string;
}

export default function UpgradeNowModal({
  isOpen,
  onClose,
  user,
  adminSettings,
  onSuccess,
  restrictedFeatureName = "Developer API & White-Labeling"
}: UpgradeNowModalProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string>('pro');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [isProcessing, setIsProcessing] = useState(false);
  const [extraSeats, setExtraSeats] = useState<number>(0);

  const plans = adminSettings?.plans || [];
  const selectedPlanObj = plans.find(p => p.id === selectedPlanId) || plans.find(p => p.id === 'pro') || plans[0];

  const handleInstantUpgrade = async () => {
    if (!selectedPlanObj) return;
    setIsProcessing(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      
      // Update user plan to the chosen subscription level
      // and update subscriptionStatus to 'active' which converts trial to paid subscription
      await updateDoc(userRef, {
        plan: selectedPlanObj.id,
        subscriptionStatus: 'active',
        trialActive: false,
        trialStartDate: null,
        trialEndDate: null,
        updatedAt: new Date().toISOString()
      });

      toast.success(`Successfully upgraded to premium paid subscription for ${selectedPlanObj.name}!`);
      onSuccess(selectedPlanObj.id);
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Instant upgrade failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const activePremiumPlans = plans.filter(p => p.id !== 'free');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-neutral-900/60 backdrop-blur-md"
        />

        {/* Modal Content container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative bg-white w-full max-w-2xl rounded-[2.5rem] border border-neutral-100 shadow-2xl p-6 md:p-8 overflow-hidden z-10 max-h-[90vh] overflow-y-auto"
        >
          {/* Close trigger */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800 transition-all border-none cursor-pointer"
          >
            <X size={16} />
          </button>

          {/* Golden/Orange Trial Badge Header */}
          <div className="flex flex-col items-center text-center space-y-4 max-w-lg mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-[10px] font-black uppercase tracking-widest font-mono animate-pulse">
              <Sparkles size={11} className="fill-amber-500 text-amber-500" />
              <span>Trial Upgrade Required</span>
            </div>

            <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-neutral-900 leading-none">
              Unlock Paid Feature
            </h3>
            
            <p className="text-xs text-neutral-500 font-bold uppercase tracking-wider font-mono">
              Feature: <span className="text-orange-600">{restrictedFeatureName}</span>
            </p>

            <p className="text-[11.5px] text-neutral-500 leading-normal font-semibold">
              You are currently on a **Free Trial** tier. To unlock this feature permanently and experience uninterrupted multi-team syncs, developer keys, and continuous custom whitelabeling, activate a paid subscription now.
            </p>
          </div>

          {/* Plan selectors */}
          <div className="mt-8 space-y-6">
            {/* Billing Cycle Toggle */}
            <div className="flex justify-center">
              <div className="inline-flex bg-neutral-100 p-1 rounded-full items-center">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider transition ${
                    billingCycle === 'monthly' ? 'bg-neutral-900 text-white shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
                  } border-none cursor-pointer`}
                >
                  Monthly billing
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider transition flex items-center gap-1 ${
                    billingCycle === 'annual' ? 'bg-neutral-900 text-white shadow-xs' : 'text-neutral-500 hover:text-neutral-900'
                  } border-none cursor-pointer`}
                >
                  <span>Annual billing</span>
                  <span className="text-[8px] bg-emerald-500 text-white font-mono px-1 rounded hover:bg-emerald-600">SAVE</span>
                </button>
              </div>
            </div>

            {/* Grid of plans */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activePremiumPlans.map((plan) => {
                const isSelected = selectedPlanId === plan.id;
                const monthlyPrice = plan.price;
                const annualPrice = plan.annualPrice || (plan.price * 10);
                const displayPrice = billingCycle === 'annual' ? Math.round(annualPrice / 12) : monthlyPrice;

                return (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`p-5 rounded-3xl text-left border-2 transition-all flex flex-col justify-between relative cursor-pointer group bg-neutral-50/60 ${
                      isSelected 
                        ? 'border-orange-500 bg-orange-50/20 ring-4 ring-orange-500/10' 
                        : 'border-neutral-200/80 hover:border-neutral-350 hover:bg-neutral-50'
                    }`}
                  >
                    {/* Select indicator */}
                    <div className="absolute top-4 right-4">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center transition ${
                        isSelected ? 'bg-orange-500 text-white' : 'border border-neutral-300 bg-white'
                      }`}>
                        {isSelected && <Check size={12} className="stroke-[3]" />}
                      </div>
                    </div>

                    <div className="space-y-1 pr-6">
                      <h4 className="text-base font-black uppercase tracking-tight text-neutral-950 group-hover:text-neutral-900">
                        {plan.name} Plan
                      </h4>
                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider font-mono">
                        Instant Activation
                      </p>
                    </div>

                    {/* Pricing */}
                    <div className="my-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-neutral-950">${displayPrice}</span>
                        <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest font-mono">/Mo</span>
                      </div>
                      <p className="text-[9px] text-neutral-450 font-semibold mt-0.5">
                        {billingCycle === 'annual' 
                          ? `Billed annually ($${annualPrice}/Year)` 
                          : `Billed monthly ($${monthlyPrice}/Month)`
                        }
                      </p>
                    </div>

                    {/* Features key highlight */}
                    <div className="space-y-1.5 pt-3 border-t border-neutral-200/50 w-full text-neutral-600">
                      <div className="flex items-center gap-1.5 text-[9.5px] font-semibold">
                        <Check size={11} className="text-emerald-500 stroke-[3]" />
                        <span>Up to {plan.maxPackingLists} active Packing Lists</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[9.5px] font-semibold">
                        <Check size={11} className="text-emerald-500 stroke-[3]" />
                        <span>Up to {plan.maxGearItems} Library items</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[9.5px] font-semibold">
                        <Check size={11} className="text-emerald-500 stroke-[3]" />
                        <span>API Access & Whitelabel Keys</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Instant checkout upgrade panel trigger button */}
            <div className="bg-orange-50 border border-orange-250/20 rounded-[2rem] p-4 text-center space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/10 blur-xl rounded-full" />
              <div>
                <p className="text-[10px] font-mono font-black uppercase text-orange-600">Instant Billing Conversion</p>
                <p className="text-[11px] text-neutral-600 font-semibold mt-0.5">
                  Your trial ends now and your continuous {selectedPlanObj?.name} subscription plan starts instantly.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-200 rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleInstantUpgrade}
                  disabled={isProcessing}
                  className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-orange-500/15 border-none disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>Upgrade Subscription</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
