import React, { useState } from 'react';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { X, Check, Zap, Shield, Crown, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Plan, UserProfile, AdminSettings } from '../types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  adminSettings: AdminSettings | null;
  onSuccess: (newPlan: string) => void;
}

export default function PaymentModal({ isOpen, onClose, user, adminSettings, onSuccess }: PaymentModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [extraSeatsCount, setExtraSeatsCount] = useState<number>(user.extraSeats || 0);

  const plans = adminSettings?.plans || [];
  const paypalClientId = adminSettings?.integrationConfig?.paypalClientId || import.meta.env.VITE_PAYPAL_CLIENT_ID || "test";

  const [selectedCurrencyCode, setSelectedCurrencyCode] = useState<string>('USD');
  const [selectedGatewayIdx, setSelectedGatewayIdx] = useState<number>(0);
  const [manualReferenceId, setManualReferenceId] = useState<string>('');

  const onboarded = adminSettings?.onboardedCurrencies || [
    {
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      isActive: true,
      paymentMethods: [
        { gateway: 'paypal', name: 'PayPal Gateway', enabled: true },
        { gateway: 'manual', name: 'Manual Wire Transfer', instructions: 'Transfer USD with reference code to Bank of America, Routing #...', enabled: true }
      ]
    },
    {
      code: 'FJD',
      name: 'Fijian Dollar',
      symbol: 'FJ$',
      isActive: true,
      paymentMethods: [
        { gateway: 'manual', name: 'BSP Direct Transfer', instructions: 'Transfer FJ$ to BSP Account #1002445129, Westpac Code BSPFJ (Suva Branch). Write your account email address as transaction description.', enabled: true }
      ]
    }
  ];

  const activeCurrencies = onboarded.filter(c => c.isActive);
  const currentCurrency = activeCurrencies.find(c => c.code === selectedCurrencyCode) || activeCurrencies[0] || onboarded[0];
  
  const enabledGateways = currentCurrency?.paymentMethods?.filter(p => {
    if (selectedCurrencyCode === 'FJD' && p.gateway === 'paypal') {
      return false; // Paypal does not work with Fiji currency
    }
    return p.enabled;
  }) || [];

  const selectedGateway = enabledGateways[selectedGatewayIdx] || enabledGateways[0];

  // Initialize selectedPlan to user's plan or the first plan or "Pro"
  React.useEffect(() => {
    if (plans.length > 0 && !selectedPlan) {
      const activeUserPlan = plans.find(p => p.id === user.plan);
      setSelectedPlan(activeUserPlan || plans.find(p => p.id === 'pro') || plans[0]);
    }
  }, [plans, user.plan, selectedPlan]);

  const handleManualSubmit = async () => {
    if (!manualReferenceId.trim()) {
      toast.error("Please enter your Direct Payment Transaction Reference ID.");
      return;
    }
    setIsProcessing(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const isTrial = selectedPlan?.trialEnabled && selectedPlan?.trialDays;
      await updateDoc(userRef, {
        plan: selectedPlan?.id,
        extraSeats: extraSeatsCount,
        subscriptionStatus: isTrial ? 'trialing' : 'active',
        trialStartDate: isTrial ? new Date().toISOString() : null,
        trialEndDate: isTrial 
          ? new Date(Date.now() + ((selectedPlan?.trialDays || 14) * 24 * 60 * 60 * 1000)).toISOString()
          : null,
        trialActive: isTrial ? true : false,
        manualPaymentPending: true,
        manualPaymentReference: manualReferenceId,
        updatedAt: new Date().toISOString()
      });

      toast.success(`Successfully requested upgrade to ${selectedPlan?.name}! Manual payment queued for verification.`);
      onSuccess(selectedPlan!.id);
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Manual payment update failed. Try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFreeActivation = async () => {
    setIsProcessing(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        plan: 'free',
        extraSeats: 0,
        subscriptionStatus: 'active',
        trialActive: false,
        manualPaymentPending: false,
        updatedAt: new Date().toISOString()
      });
      toast.success("Successfully upgraded to Free layout catalog!");
      onSuccess('free');
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Free activation failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTrialActivation = async () => {
    setIsProcessing(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const trialDays = selectedPlan?.trialDays || 14;
      const trialStartDate = new Date().toISOString();
      const trialEndDate = new Date(Date.now() + (trialDays * 24 * 60 * 60 * 1000)).toISOString();

      await updateDoc(userRef, {
        plan: selectedPlan?.id,
        subscriptionStatus: 'trialing',
        trialStartDate,
        trialEndDate,
        trialActive: true,
        extraSeats: extraSeatsCount,
        manualPaymentPending: false,
        updatedAt: new Date().toISOString()
      });

      toast.success(`Successfully activated your ${trialDays}-day free trial for ${selectedPlan?.name}!`);
      onSuccess(selectedPlan!.id);
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Trial activation failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const getActivePrice = (plan: Plan) => {
    if (plan.price === 0) return 0;
    
    let basePrice = 0;
    if (billingCycle === 'annual') {
      basePrice = plan.annualPrice || (plan.price * 12);
    } else {
      basePrice = plan.price;
    }

    const seatCostPerMonth = plan.extraSeatCost ?? 10;
    let seatCost = extraSeatsCount * seatCostPerMonth;
    if (billingCycle === 'annual') {
      seatCost = seatCost * 12;
    }

    return basePrice + seatCost;
  };

  const handleApprove = async (orderID: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/paypal/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderID })
      });

      const data = await response.json();

      if (data.status === 'COMPLETED') {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          plan: selectedPlan?.id,
          extraSeats: extraSeatsCount,
          subscriptionStatus: 'active',
          trialActive: false,
          updatedAt: new Date().toISOString()
        });

        toast.success(`Successfully upgraded to ${selectedPlan?.name}!`);
        onSuccess(selectedPlan!.id);
        onClose();
      } else {
        throw new Error('Payment not completed');
      }
    } catch (error) {
      console.error('Payment Error:', error);
      toast.error('Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden relative flex flex-col max-h-[92vh] md:max-h-[88vh]"
        >
          {/* Header & Step progress */}
          <div className="px-8 pt-8 pb-4 border-b border-neutral-100 flex items-center justify-between shrink-0 bg-white">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setStep(1)}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-colors ${step === 1 ? 'bg-primary text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                  {step > 1 ? <Check size={12} className="stroke-[3]" /> : '1'}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-wider ${step === 1 ? 'text-neutral-800' : 'text-neutral-400 font-bold'}`}>Tier</span>
              </div>
              <div className="w-6 h-[2px] bg-neutral-200"></div>
              <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => selectedPlan && setStep(2)}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-colors ${step === 2 ? 'bg-primary text-white' : step > 2 ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-400'}`}>
                  {step > 2 ? <Check size={12} className="stroke-[3]" /> : '2'}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-wider ${step === 2 ? 'text-neutral-800' : 'text-neutral-400 font-bold'}`}>Features</span>
              </div>
              <div className="w-6 h-[2px] bg-neutral-200"></div>
              <div className="flex items-center gap-1.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-colors ${step === 3 ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-400'}`}>
                  3
                </div>
                <span className={`text-[10px] font-black uppercase tracking-wider ${step === 3 ? 'text-neutral-800' : 'text-neutral-400 font-bold'}`}>Checkout</span>
              </div>
            </div>
            
            {/* Close Button */}
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-neutral-100 rounded-full transition text-neutral-400 hover:text-neutral-700 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scrollable middle text wrapper content */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 scrollbar-thin max-h-[60vh] md:max-h-[55vh]">
            
            {/* STEP 1: BASELINE PLAN SELECTION */}
            {step === 1 && (
              <div className="space-y-6 animate-fadeIn">
                <div className="space-y-1">
                  <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-neutral-900 leading-none">Upgrade Your Kit</h2>
                  <p className="text-[10px] md:text-xs text-neutral-400 font-bold uppercase tracking-wider">Choose the plan that matches your production scale.</p>
                </div>

                {/* Billing Cycle switch */}
                <div className="flex items-center justify-between bg-neutral-105 p-1 rounded-2xl max-w-xs">
                  <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider pl-3">Term Cycle:</span>
                  <div className="flex gap-1">
                    <button 
                      type="button"
                      onClick={() => setBillingCycle('monthly')}
                      className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${billingCycle === 'monthly' ? 'bg-white shadow-xs text-neutral-900' : 'text-neutral-400 hover:text-neutral-600'}`}
                    >
                      Monthly
                    </button>
                    <button 
                      type="button"
                      onClick={() => setBillingCycle('annual')}
                      className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${billingCycle === 'annual' ? 'bg-white shadow-xs text-neutral-900' : 'text-neutral-400 hover:text-neutral-600'}`}
                    >
                      Annual
                    </button>
                  </div>
                </div>

                {/* Plans List */}
                <div className="space-y-3">
                  {plans.map((plan) => {
                    const isSelected = selectedPlan?.id === plan.id;
                    const calculatedPrice = getActivePrice(plan);
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setSelectedPlan(plan)}
                        className={`w-full p-5 rounded-3xl border-2 transition-all duration-200 text-left flex items-center justify-between group relative overflow-hidden cursor-pointer ${
                          isSelected 
                            ? 'border-primary bg-white shadow-lg' 
                            : 'border-transparent bg-neutral-55 hover:bg-white hover:border-neutral-200'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-primary" />
                        )}
                        <div className="flex items-center gap-3.5">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            plan.id === 'pro' ? 'bg-accent text-white' : plan.id === 'enterprise' ? 'bg-indigo-605 text-white' : 'bg-neutral-800 text-white'
                          }`}>
                            {plan.id === 'pro' ? <Zap size={18} /> : plan.id === 'enterprise' ? <Crown size={18} /> : <Shield size={18} />}
                          </div>
                          <div>
                            <div className="font-black uppercase tracking-tight text-neutral-805 text-sm flex items-center gap-1.5 flex-wrap">
                              <span>{plan.name}</span>
                              {plan.id === 'pro' && (
                                <span className="bg-accent/10 text-accent text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded uppercase">POPULAR</span>
                              )}
                              {plan.trialEnabled && plan.trialDays && (
                                <span className="bg-orange-100 text-orange-700 text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded uppercase">
                                  {plan.trialDays}-DAY TRIAL
                                </span>
                              )}
                            </div>
                            <div className="text-[9.5px] text-neutral-400 font-bold uppercase tracking-wider mt-0.5">
                              {plan.aiTokenLimit} AI Tokens • {plan.maxContacts || 50} Contacts
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-black tracking-tighter text-neutral-900">
                            {currentCurrency?.symbol || '$'}{calculatedPrice}
                          </div>
                          <div className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">
                            {billingCycle === 'monthly' ? 'Per Month' : 'Per Year'}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 2: TIER FEATURES & SEAT CONFIGURATION */}
            {step === 2 && selectedPlan && (
              <div className="space-y-6 animate-fadeIn">
                <div className="space-y-1">
                  <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-neutral-900 leading-none">Configure Tier & Seats</h2>
                  <p className="text-[10px] md:text-xs text-neutral-400 font-bold uppercase tracking-wider">Configure optional seat counts and verify capabilities.</p>
                </div>

                {/* Selected Plan mini-badge */}
                <div className="p-4 bg-neutral-900 text-white rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center font-black">
                      ✓
                    </div>
                    <div>
                      <p className="text-[8px] text-primary/80 font-bold uppercase tracking-widest mb-0.5 leading-none">Active Target Choice</p>
                      <h4 className="text-xs font-black uppercase text-white">{selectedPlan.name} Plan ({billingCycle})</h4>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-[9px] font-black text-primary hover:underline uppercase tracking-wide cursor-pointer"
                  >
                    Change selection
                  </button>
                </div>

                {/* Configure Seats (if price > 0) */}
                {selectedPlan.price > 0 && (
                  <div className="p-5 bg-white rounded-[2rem] border border-neutral-150 space-y-4">
                    <div className="flex justify-between items-center text-left">
                      <div>
                        <span className="text-xs font-black uppercase text-neutral-805 tracking-wider">Additional Operating Seats</span>
                        <p className="text-[9.5px] text-neutral-400 font-bold uppercase tracking-wider leading-tight mt-0.5">Plan includes {selectedPlan.includedSeats ?? 3} base users</p>
                      </div>
                      <span className="text-[9px] bg-primary/10 text-primary font-black px-2 py-0.5 rounded-lg border border-primary/5">
                        +{currentCurrency?.symbol || '$'}{selectedPlan.extraSeatCost ?? 10}/mo each
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 bg-neutral-50 p-2.5 rounded-xl border border-neutral-100">
                      <button
                        type="button"
                        onClick={() => setExtraSeatsCount(Math.max(0, extraSeatsCount - 1))}
                        className="w-10 h-10 rounded-lg bg-neutral-200 hover:bg-neutral-300 transition shrink-0 flex items-center justify-center cursor-pointer text-sm font-black text-neutral-850"
                      >
                        -
                      </button>
                      <div className="text-center flex flex-col">
                        <span className="font-mono text-xs font-black text-neutral-850">{extraSeatsCount}</span>
                        <span className="text-[7.5px] text-neutral-400 uppercase tracking-widest font-black">Added seat{extraSeatsCount !== 1 ? 's' : ''}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExtraSeatsCount(extraSeatsCount + 1)}
                        className="w-10 h-10 rounded-lg bg-neutral-200 hover:bg-neutral-300 transition shrink-0 flex items-center justify-center cursor-pointer text-sm font-black text-neutral-855"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-[9.5px] text-neutral-400 font-bold uppercase text-center border-t border-neutral-100 pt-3 leading-none">
                      Total Licensed Workspace Users: <strong className="text-neutral-700 font-black">{(selectedPlan.includedSeats ?? 3) + extraSeatsCount} Licenses</strong>
                    </div>
                  </div>
                )}

                {/* Features list for selected plan */}
                <div className="p-5 bg-neutral-50 rounded-[2rem] border border-neutral-100 space-y-3 text-left">
                  <div className="text-[8.5px] font-black text-neutral-400 uppercase tracking-widest font-mono border-b border-neutral-200/50 pb-2">
                    Included with {selectedPlan.name} Tier
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    {selectedPlan.features?.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2 text-neutral-600 font-semibold uppercase text-[9px] tracking-wide">
                        <Check size={11} className="text-emerald-500 stroke-[3.5] shrink-0" />
                        <span className="text-neutral-500 font-black truncate">{feature.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: CHECKOUT DETAILS & TRANSACTION FORM */}
            {step === 3 && selectedPlan && (
              <div className="space-y-6 animate-fadeIn">
                <div className="space-y-1 text-left">
                  <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-neutral-900 leading-none">Complete Upgrade</h2>
                  <p className="text-[10px] md:text-xs text-neutral-400 font-bold uppercase tracking-wider">Confirm your billing details and complete checkout securely.</p>
                </div>

                {/* Total Due Billing Block */}
                <div className="text-center p-6 bg-neutral-900 text-white rounded-[2rem] shadow-md space-y-1 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-[100px] h-[100px] bg-primary/20 blur-[55px] pointer-events-none" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-450">Total Due Today</p>
                  <div className="text-4xl md:text-5xl font-black tracking-tighter text-white">
                    {selectedPlan.trialEnabled ? "$0" : `${currentCurrency?.symbol || '$'}${getActivePrice(selectedPlan)}`}
                  </div>
                  {selectedPlan.trialEnabled && selectedPlan.trialDays ? (
                    <div className="inline-flex bg-orange-500 text-white text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full items-center gap-1 mx-auto mt-2 animate-pulse">
                      <Zap size={9} className="fill-white text-white" />
                      <span>{selectedPlan.trialDays}-Day Free Trial Active</span>
                    </div>
                  ) : billingCycle === 'annual' && selectedPlan.annualPrice && (
                    <div className="inline-flex bg-white/10 text-emerald-400 text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full items-center gap-1 mx-auto mt-2">
                      <Zap size={9} className="fill-emerald-400 text-emerald-400" />
                      <span>Annual Cost Savings Applied</span>
                    </div>
                  )}
                </div>

                {selectedPlan.trialEnabled && selectedPlan.trialDays ? (
                  <div className="p-6 bg-orange-50 border border-orange-200/60 rounded-[2rem] space-y-4 text-left relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/10 blur-xl rounded-full" />
                    <div>
                      <span className="text-[9px] font-black uppercase text-orange-600 bg-orange-100 px-2.5 py-0.5 rounded-full">Trial Offer</span>
                      <h4 className="text-sm font-black uppercase text-orange-950 mt-1">Start Your {selectedPlan.trialDays}-Day Trial Instantly</h4>
                      <p className="text-[11px] text-orange-850 font-semibold mt-1 leading-normal">
                        No credit card or payment is required today. You will receive full access to all features of the {selectedPlan.name} plan for {selectedPlan.trialDays} days. At the end of the trial, you can choose to subscribe or downgrade.
                      </p>
                    </div>
                    
                    <button
                      type="button"
                      onClick={handleTrialActivation}
                      disabled={isProcessing}
                      className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50 border-none"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Activating your {selectedPlan.trialDays}-day trial...</span>
                        </>
                      ) : (
                        <span>Activate {selectedPlan.trialDays}-Day Free Trial</span>
                      )}
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Currency & Gateway selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                      {/* Currency Selector */}
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase text-neutral-400 tracking-wider block font-mono">Billing Currency</label>
                        <select
                          value={selectedCurrencyCode}
                          onChange={(e) => {
                            setSelectedCurrencyCode(e.target.value);
                            setSelectedGatewayIdx(0);
                          }}
                          className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl outline-none font-bold text-xs text-neutral-800 transition focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
                        >
                          {activeCurrencies.map((c) => (
                            <option key={c.code} value={c.code}>{c.code} ({c.symbol}) — {c.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Gateway Selector */}
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase text-neutral-400 tracking-wider block font-mono">Gateway Method</label>
                        {enabledGateways.length === 0 ? (
                          <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-semibold">
                            No active gateways.
                          </div>
                        ) : (
                          <select
                            value={selectedGatewayIdx}
                            onChange={(e) => setSelectedGatewayIdx(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl outline-none font-bold text-xs text-neutral-800 transition focus:ring-2 focus:ring-primary cursor-pointer"
                          >
                            {enabledGateways.map((gw, idx) => (
                              <option key={idx} value={idx}>{gw.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>

                    {/* Active Gateway content interface */}
                    {selectedGateway && (
                      <div className="p-1.5 border border-neutral-100 rounded-[2rem] overflow-hidden bg-white shadow-sm relative text-left">
                        {isProcessing && (
                          <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center rounded-[2rem] gap-2">
                            <Loader2 size={24} className="text-primary animate-spin" />
                            <div className="text-[9px] font-bold uppercase tracking-widest text-neutral-655">Syncing Settlement...</div>
                          </div>
                        )}

                        {selectedGateway.gateway === 'paypal' ? (
                          <div className="p-3">
                            <PayPalScriptProvider options={{ clientId: selectedGateway.paypalClientId || paypalClientId }}>
                              <PayPalButtons
                                style={{ layout: "vertical", shape: "pill", label: "pay" }}
                                createOrder={async () => {
                                  const amount = getActivePrice(selectedPlan);
                                  const response = await fetch('/api/paypal/create-order', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ planId: selectedPlan.id, amount, billingCycle })
                                  });
                                  const order = await response.json();
                                  return order.id;
                                }}
                                onApprove={async (data) => {
                                  await handleApprove(data.orderID);
                                }}
                              />
                            </PayPalScriptProvider>
                          </div>
                        ) : (
                          <div className="p-4 space-y-4">
                            <div className="text-[8.5px] font-black text-neutral-450 uppercase tracking-widest border-b border-neutral-100 pb-1 flex items-center gap-1.5">
                              <Check size={10} className="text-emerald-500 stroke-[3]" />
                              <span>Direct Settlement instructions</span>
                            </div>
                            <p className="text-[10px] text-neutral-600 leading-relaxed font-semibold whitespace-pre-line bg-neutral-50 p-3 rounded-xl border border-neutral-100 select-all font-mono">
                              {selectedGateway.instructions || "Contact account manager for bank routing details."}
                            </p>
                            
                            <div className="space-y-1">
                              <label className="text-[8.5px] font-black uppercase tracking-wider text-neutral-400 block font-mono">Transaction Reference ID</label>
                              <input
                                type="text"
                                placeholder="e.g. BSP-WIRE-90342-FIJI"
                                value={manualReferenceId}
                                onChange={(e) => setManualReferenceId(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl outline-none text-xs font-mono focus:ring-2 focus:ring-primary transition"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={handleManualSubmit}
                              disabled={isProcessing}
                              className="w-full py-2.5 bg-neutral-900 hover:bg-black rounded-xl text-white text-[9px] font-black uppercase tracking-widest transition flex items-center justify-center gap-2 cursor-pointer border-none"
                            >
                              {isProcessing ? (
                                <>
                                  <Loader2 size={12} className="animate-spin" />
                                  <span>Queuing Request...</span>
                                </>
                              ) : (
                                <span>Submit Offline Verification</span>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <p className="text-[9px] text-neutral-400 font-bold uppercase text-center tracking-wide leading-relaxed">
                      Verification of manual receipts/wire deposits can take up to 24 hours to clear organization accounts.
                    </p>
                  </>
                )}
              </div>
            )}
            
          </div>

          {/* Fixed Footer controls */}
          <div className="px-8 py-5 border-t border-neutral-100 flex items-center justify-between shrink-0 bg-neutral-50/50">
            {step === 1 ? (
              <>
                <div className="text-left font-bold text-[10px] text-neutral-450 uppercase tracking-wider">
                  {selectedPlan ? (
                    <span>Target: <strong className="text-neutral-800 font-extrabold uppercase">{selectedPlan.name}</strong></span>
                  ) : (
                    <span>No target selected</span>
                  )}
                </div>
                
                {selectedPlan && selectedPlan.price === 0 ? (
                  <button
                    type="button"
                    onClick={handleFreeActivation}
                    disabled={isProcessing}
                    className="bg-neutral-900 hover:bg-neutral-800 text-white font-black text-[10px] uppercase tracking-widest px-6 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <span>Activate Free Plan</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={!selectedPlan}
                    className="bg-[#ff4f3a] hover:bg-[#e43f2a] text-white font-black text-[10px] uppercase tracking-widest px-6 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border-none"
                  >
                    <span>Proceed to Seats Config</span>
                    <ArrowRight size={11} strokeWidth={2.5} />
                  </button>
                )}
              </>
            ) : step === 2 ? (
              <>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-[10px] font-black uppercase text-neutral-500 hover:text-neutral-800 transition flex items-center gap-1.5 cursor-pointer bg-transparent border-none"
                >
                  <ArrowLeft size={11} strokeWidth={3} />
                  <span>Choose Plan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={!selectedPlan}
                  className="bg-[#ff4f3a] hover:bg-[#e43f2a] text-white font-black text-[10px] uppercase tracking-widest px-6 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-md cursor-pointer border-none"
                >
                  <span>Proceed to Payment</span>
                  <ArrowRight size={11} strokeWidth={2.5} />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-[10px] font-black uppercase text-neutral-500 hover:text-neutral-800 transition flex items-center gap-1.5 cursor-pointer bg-transparent border-none"
                >
                  <ArrowLeft size={11} strokeWidth={3} />
                  <span>Configure Seats</span>
                </button>
                <div className="text-right text-[9px] font-extrabold text-neutral-400 uppercase tracking-widest font-mono">
                  Active Direct Security Lock
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
