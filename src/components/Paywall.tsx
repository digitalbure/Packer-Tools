import React, { useState, useEffect } from 'react';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { 
  ShieldCheck, Check, Zap, Crown, Loader2, CreditCard, 
  UserPlus, Calendar, ArrowRight, Sparkles, HelpCircle, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Plan, UserProfile, AdminSettings } from '../types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import { authenticatedFetch } from '../lib/api';
import { useIndustry } from '../context/IndustryContext';
import confetti from 'canvas-confetti';

interface PaywallProps {
  user: UserProfile | null;
  adminSettings: AdminSettings | null;
  onSuccess?: (newPlan: string) => void;
  onClose?: () => void;
  initialSelectedPlanId?: string;
}

export default function Paywall({ 
  user, 
  adminSettings, 
  onSuccess, 
  onClose,
  initialSelectedPlanId = 'pro'
}: PaywallProps) {
  const { getAdjustedLabel } = useIndustry();

  // State Management
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [extraSeats, setExtraSeats] = useState<number>(user?.extraSeats || 0);
  const [paymentMethod, setPaymentMethod] = useState<'paypal' | 'card'>('card');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [paymentSuccess, setPaymentSuccess] = useState<boolean>(false);

  // Credit Card Form State
  const [ccNumber, setCcNumber] = useState<string>('');
  const [ccExpiry, setCcExpiry] = useState<string>('');
  const [ccCvc, setCcCvc] = useState<string>('');
  const [ccName, setCcName] = useState<string>(user?.displayName || '');
  const [ccZip, setCcZip] = useState<string>('');

  // Default plans fallback if adminSettings is not fully synchronized
  const defaultPlans: Plan[] = adminSettings?.plans || [
    { 
      id: 'free',
      name: 'Free Starter', 
      price: 0, 
      features: ['gearLibrary', 'qrSharing'], 
      aiTokenLimit: 10,
      maxPackingLists: 3,
      maxGearItems: 25,
      maxRacks: 1,
      maxProjects: 0,
      maxContacts: 5,
      maxOrganizations: 1,
      maxDepartments: 1,
      maxTeams: 1,
      maxInventoryItems: 10
    },
    { 
      id: 'pro',
      name: 'Professional Tier', 
      price: 19, 
      annualPrice: 180,
      features: ['aiWizard', 'gearLibrary', 'reminders', 'qrSharing', 'toolingLists', 'organizer', 'travelCases', 'logisticsDashboard'], 
      aiTokenLimit: 500,
      maxPackingLists: 50,
      maxGearItems: 500,
      maxRacks: 10,
      maxProjects: 5,
      maxContacts: 50,
      maxOrganizations: 5,
      maxDepartments: 20,
      maxTeams: 50,
      maxInventoryItems: 1000,
      trialDays: 14,
      trialEnabled: true
    },
    { 
      id: 'enterprise',
      name: 'Enterprise Scale', 
      price: 99, 
      annualPrice: 948,
      features: ['aiWizard', 'gearLibrary', 'reminders', 'branding', 'qrSharing', 'orgManagement', 'inventoryManagement', 'rfidTracking'], 
      aiTokenLimit: 5000,
      maxPackingLists: 1000,
      maxGearItems: 10000,
      maxRacks: 100,
      maxProjects: 50,
      maxContacts: 500,
      maxOrganizations: 50,
      maxDepartments: 500,
      maxTeams: 1000,
      maxInventoryItems: 100000,
      trialDays: 14,
      trialEnabled: true
    }
  ];

  const activePlans = defaultPlans.filter(p => p.isActive !== false);
  const paypalClientId = adminSettings?.integrationConfig?.paypalClientId || import.meta.env.VITE_PAYPAL_CLIENT_ID || "test";

  // Handle Initial Plan Assignment
  useEffect(() => {
    if (activePlans.length > 0) {
      const match = activePlans.find(p => p.id === initialSelectedPlanId) || activePlans.find(p => p.id === 'pro') || activePlans[0];
      setSelectedPlan(match);
    }
  }, [adminSettings, initialSelectedPlanId]);

  // Calculate prices based on seats and billing cycle
  const getPlanPrice = (plan: Plan) => {
    if (plan.price === 0) return 0;
    const base = billingCycle === 'annual' ? (plan.annualPrice || (plan.price * 12)) : plan.price;
    const extraCost = (plan.extraSeatCost ?? 10) * extraSeats * (billingCycle === 'annual' ? 12 : 1);
    return base + extraCost;
  };

  const getMonthlyEquivalent = (plan: Plan) => {
    if (plan.price === 0) return 0;
    if (billingCycle === 'annual' && plan.annualPrice) {
      return Math.floor((plan.annualPrice + ((plan.extraSeatCost ?? 10) * extraSeats * 12)) / 12);
    }
    return plan.price + ((plan.extraSeatCost ?? 10) * extraSeats);
  };

  // Format Credit Card number with spaces
  const handleCcNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    let formatted = val.match(/.{1,4}/g)?.join(' ') || '';
    if (formatted.length <= 19) {
      setCcNumber(formatted);
    }
  };

  // Format Credit Card Expiry as MM/YY
  const handleCcExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length >= 2) {
      setCcExpiry(val.slice(0, 2) + '/' + val.slice(2, 4));
    } else {
      setCcExpiry(val);
    }
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 }
    });
  };

  // Custom Credit Card (Authorized and processed via PayPal endpoints)
  const handleCreditCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please sign in to complete your purchase.");
      return;
    }
    if (!selectedPlan) {
      toast.error("Please select a plan tier first.");
      return;
    }
    if (!ccNumber || !ccExpiry || !ccCvc || !ccName || !ccZip) {
      toast.error("Please fill in all credit card payment fields.");
      return;
    }

    setIsProcessing(true);
    try {
      const amount = getPlanPrice(selectedPlan);

      // 1. Create a secure transaction order with the PayPal API proxy
      const createRes = await authenticatedFetch('/api/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          planId: selectedPlan.id, 
          amount, 
          billingCycle, 
          currency: 'USD' 
        })
      });

      const orderData = await createRes.json();
      if (!createRes.ok || !orderData.id) {
        throw new Error(orderData.error || "Failed to create secure transaction order via PayPal.");
      }

      // 2. Capture the transaction order instantly
      const captureRes = await authenticatedFetch('/api/paypal/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderID: orderData.id,
          planId: selectedPlan.id,
          extraSeats: extraSeats
        })
      });

      const captureData = await captureRes.json();
      if (captureRes.ok && captureData.status === 'COMPLETED') {
        // Success pathway
        setPaymentSuccess(true);
        triggerConfetti();
        toast.success(`Success! You have been upgraded to ${selectedPlan.name}.`);
        if (onSuccess) {
          onSuccess(selectedPlan.id);
        }
      } else {
        throw new Error(captureData.error || "Card processing returned an incomplete state.");
      }
    } catch (err: any) {
      console.error("[Card Processing Failure]", err);
      toast.error(err.message || "Failed to complete credit card transaction.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Activate Free plan directly
  const handleFreeActivation = async () => {
    if (!user) {
      toast.error("Please login to proceed.");
      return;
    }
    setIsProcessing(true);
    try {
      const res = await authenticatedFetch('/api/billing/activate-free', {
        method: 'POST'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Activation failed");
      }
      setPaymentSuccess(true);
      triggerConfetti();
      toast.success("Successfully upgraded to Free Starter!");
      if (onSuccess) {
        onSuccess('free');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to activate Free plan.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (paymentSuccess) {
    return (
      <div id="paywall-success-screen" className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 text-center space-y-6 max-w-lg mx-auto text-white shadow-2xl">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center justify-center">
            <ShieldCheck size={36} className="animate-pulse" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black uppercase tracking-tight text-white">Payment Authorized</h2>
          <p className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">
            Your workspace has been successfully cleared and upgraded!
          </p>
        </div>
        <div className="bg-neutral-950 p-5 rounded-2xl border border-neutral-850 text-left space-y-3 font-mono text-xs text-neutral-400">
          <div className="flex justify-between">
            <span>Status:</span>
            <span className="text-emerald-400 font-bold">✓ ACTIVE</span>
          </div>
          <div className="flex justify-between">
            <span>Plan:</span>
            <span className="text-white font-extrabold uppercase">{selectedPlan?.name}</span>
          </div>
          <div className="flex justify-between">
            <span>Term Cycle:</span>
            <span className="text-white capitalize">{billingCycle}</span>
          </div>
          <div className="flex justify-between">
            <span>Seats:</span>
            <span className="text-white">{extraSeats + (selectedPlan?.includedSeats || 3)} operating seats</span>
          </div>
        </div>
        <div className="pt-4 flex gap-3">
          <button
            id="paywall-close-btn"
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-[#ff4f3a] hover:bg-[#e0402c] text-white text-xs font-black uppercase tracking-widest rounded-xl transition cursor-pointer shadow-md"
          >
            Go to Workspace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="paywall-container" className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl max-w-5xl w-full mx-auto text-white">
      {/* Top Banner / Secure Indicator */}
      <div className="bg-neutral-950 px-6 py-3.5 border-b border-neutral-850 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-[10px] font-mono font-black uppercase tracking-widest text-neutral-400">
            Secure Payment Hub • SSL Protected
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold uppercase tracking-widest text-neutral-500 hover:text-white transition"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left Hand: Selection and Config Form */}
        <div className="lg:col-span-7 p-6 sm:p-8 space-y-6 border-r border-neutral-800">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
              <Sparkles size={20} className="text-[#ff4f3a]" />
              Select Your Setup Plan
            </h1>
            <p className="text-[10px] sm:text-xs text-neutral-400 font-bold uppercase tracking-wider">
              Optimize camera logs, rigging inventories, & {getAdjustedLabel('lists')} processing.
            </p>
          </div>

          {/* Billing Cycle Selector */}
          <div className="bg-neutral-950 p-1.5 rounded-2xl border border-neutral-850 flex items-center justify-between">
            <span className="text-[10px] font-mono font-black uppercase text-neutral-400 tracking-wider pl-3">
              Billing Frequency:
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                  billingCycle === 'monthly'
                    ? 'bg-neutral-800 text-white shadow-md'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 cursor-pointer ${
                  billingCycle === 'annual'
                    ? 'bg-neutral-800 text-white shadow-md'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                Annual
                <span className="bg-[#ff4f3a]/15 text-[#ff4f3a] text-[8px] font-black px-1.5 py-0.5 rounded">SAVE 20%</span>
              </button>
            </div>
          </div>

          {/* Plans Radio Cards */}
          <div className="space-y-3">
            {activePlans.map((plan) => {
              const isSelected = selectedPlan?.id === plan.id;
              const isPro = plan.id === 'pro';
              const isEnterprise = plan.id === 'enterprise';
              const basePrice = getPlanPrice(plan);

              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan)}
                  className={`w-full p-4 rounded-2xl border transition-all text-left flex items-center justify-between relative overflow-hidden cursor-pointer ${
                    isSelected 
                      ? 'border-[#ff4f3a] bg-neutral-950/60 shadow-lg' 
                      : 'border-neutral-800 bg-neutral-900/40 hover:border-neutral-700'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-0 bottom-0 left-0 w-1 bg-[#ff4f3a]" />
                  )}
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isPro ? 'bg-[#ff4f3a]/10 text-[#ff4f3a]' : isEnterprise ? 'bg-indigo-500/10 text-indigo-400' : 'bg-neutral-800 text-neutral-400'
                    }`}>
                      {isPro ? <Zap size={16} /> : isEnterprise ? <Crown size={16} /> : <ShieldCheck size={16} />}
                    </div>
                    <div>
                      <div className="font-black text-sm uppercase tracking-tight flex items-center gap-1.5 flex-wrap">
                        <span>{plan.name}</span>
                        {isPro && (
                          <span className="bg-[#ff4f3a]/10 text-[#ff4f3a] text-[7.5px] font-black tracking-widest px-1.5 py-0.5 rounded uppercase">POPULAR</span>
                        )}
                        {plan.trialEnabled && (
                          <span className="bg-emerald-500/10 text-emerald-400 text-[7.5px] font-black tracking-widest px-1.5 py-0.5 rounded uppercase">
                            {plan.trialDays}-DAY TRIAL
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider mt-0.5">
                        {plan.aiTokenLimit} AI Tokens • Up to {plan.maxGearItems} {getAdjustedLabel('library')}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-black text-white">
                      ${basePrice}
                    </div>
                    <div className="text-[8px] font-bold text-neutral-500 uppercase tracking-wider">
                      {billingCycle === 'monthly' ? 'Per Month' : 'Per Year'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Dynamic Seats Adjuster */}
          {selectedPlan && selectedPlan.price > 0 && (
            <div className="bg-neutral-950 p-4 rounded-2xl border border-neutral-850 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase text-white tracking-wide">Additional Operating Seats</h4>
                  <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider mt-0.5">
                    Plan includes {selectedPlan.includedSeats ?? 3} base users
                  </p>
                </div>
                <span className="text-[8.5px] font-mono bg-neutral-900 border border-neutral-800 text-neutral-300 font-black px-2 py-0.5 rounded">
                  +${selectedPlan.extraSeatCost ?? 10}/mo each
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 bg-neutral-900 p-2 rounded-xl border border-neutral-800">
                <button
                  type="button"
                  onClick={() => setExtraSeats(prev => Math.max(0, prev - 1))}
                  className="w-8 h-8 rounded-lg bg-neutral-950 border border-neutral-850 flex items-center justify-center text-sm font-bold text-neutral-400 hover:text-white transition"
                >
                  -
                </button>
                <div className="text-center">
                  <span className="text-sm font-black font-mono">{extraSeats} extra seats</span>
                  <span className="block text-[8px] text-neutral-500 uppercase font-bold tracking-wider">
                    Total {extraSeats + (selectedPlan.includedSeats ?? 3)} operators
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setExtraSeats(prev => Math.min(100, prev + 1))}
                  className="w-8 h-8 rounded-lg bg-neutral-950 border border-neutral-850 flex items-center justify-center text-sm font-bold text-neutral-400 hover:text-white transition"
                >
                  +
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Hand: Checkout & Summary */}
        <div className="lg:col-span-5 p-6 sm:p-8 bg-neutral-950/45 flex flex-col justify-between space-y-6">
          <div className="space-y-6">
            <h3 className="text-xs uppercase font-mono font-black text-[#ff4f3a] tracking-widest border-b border-neutral-800 pb-2">
              Order Receipt Summary
            </h3>

            {/* Dynamic Price Breakdown */}
            {selectedPlan && (
              <div className="space-y-3.5 bg-neutral-950/80 p-4 rounded-2xl border border-neutral-850 font-mono text-xs text-neutral-400">
                <div className="flex justify-between">
                  <span>Selected Tier:</span>
                  <span className="text-white font-bold uppercase">{selectedPlan.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Term Cycle:</span>
                  <span className="text-white capitalize">{billingCycle}</span>
                </div>
                {extraSeats > 0 && (
                  <div className="flex justify-between">
                    <span>Extra Seats ({extraSeats}):</span>
                    <span className="text-white">
                      ${(selectedPlan.extraSeatCost ?? 10) * extraSeats * (billingCycle === 'annual' ? 12 : 1)}
                    </span>
                  </div>
                )}
                <div className="border-t border-neutral-800 pt-2 flex justify-between items-baseline">
                  <span className="font-sans font-black uppercase text-neutral-300">Total Charged:</span>
                  <div className="text-right">
                    <span className="text-lg font-black text-white">
                      ${getPlanPrice(selectedPlan)}
                    </span>
                    {selectedPlan.price > 0 && (
                      <span className="block text-[9px] text-neutral-500">
                        (~${getMonthlyEquivalent(selectedPlan)}/mo equiv)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {selectedPlan && selectedPlan.price === 0 ? (
              <div className="space-y-3">
                <p className="text-[10px] text-neutral-400 leading-relaxed font-sans">
                  The Free Starter includes fundamental equipment organization tags. Click the activation link below to claim this tier instantly.
                </p>
                <button
                  type="button"
                  onClick={handleFreeActivation}
                  disabled={isProcessing}
                  className="w-full h-12 bg-white hover:bg-neutral-150 text-neutral-900 font-black text-xs uppercase tracking-widest rounded-xl transition flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <Loader2 size={16} className="animate-spin text-neutral-900" />
                  ) : (
                    "Activate Free Plan"
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Payment Gateway Toggle Tabs */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-950 rounded-xl border border-neutral-850">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer ${
                      paymentMethod === 'card'
                        ? 'bg-neutral-850 text-white'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    Credit Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('paypal')}
                    className={`py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer ${
                      paymentMethod === 'paypal'
                        ? 'bg-neutral-850 text-white'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    PayPal
                  </button>
                </div>

                {/* Conditional Form Render */}
                <AnimatePresence mode="wait">
                  {paymentMethod === 'card' ? (
                    <motion.form
                      key="card-form"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      onSubmit={handleCreditCardSubmit}
                      className="space-y-3.5"
                    >
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase tracking-widest text-neutral-400 block font-mono">
                          Cardholder Name
                        </label>
                        <input
                          type="text"
                          required
                          value={ccName}
                          onChange={(e) => setCcName(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl focus:ring-2 focus:ring-[#ff4f3a] focus:border-[#ff4f3a] outline-none text-xs text-white"
                          placeholder="e.g. Samuel Stark"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase tracking-widest text-neutral-400 block font-mono">
                          Card Number
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            value={ccNumber}
                            onChange={handleCcNumberChange}
                            maxLength={19}
                            className="w-full pl-10 pr-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl focus:ring-2 focus:ring-[#ff4f3a] focus:border-[#ff4f3a] outline-none text-xs text-white tracking-widest font-mono"
                            placeholder="4111 2222 3333 4444"
                          />
                          <CreditCard size={14} className="absolute left-3.5 top-3.5 text-neutral-500" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[8px] font-black uppercase tracking-widest text-neutral-400 block font-mono">
                            Expiry Date
                          </label>
                          <input
                            type="text"
                            required
                            value={ccExpiry}
                            onChange={handleCcExpiryChange}
                            maxLength={5}
                            className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl focus:ring-2 focus:ring-[#ff4f3a] focus:border-[#ff4f3a] outline-none text-xs text-white text-center font-mono"
                            placeholder="MM/YY"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[8px] font-black uppercase tracking-widest text-neutral-400 block font-mono">
                            CVV
                          </label>
                          <input
                            type="password"
                            required
                            value={ccCvc}
                            onChange={(e) => setCcCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            maxLength={4}
                            className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl focus:ring-2 focus:ring-[#ff4f3a] focus:border-[#ff4f3a] outline-none text-xs text-white text-center font-mono"
                            placeholder="CVC"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase tracking-widest text-neutral-400 block font-mono">
                          Billing ZIP / Postal Code
                        </label>
                        <input
                          type="text"
                          required
                          value={ccZip}
                          onChange={(e) => setCcZip(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl focus:ring-2 focus:ring-[#ff4f3a] focus:border-[#ff4f3a] outline-none text-xs text-white font-mono"
                          placeholder="e.g. 90210"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isProcessing}
                        className="w-full h-12 bg-[#ff4f3a] hover:bg-[#e0402c] text-white text-xs font-black uppercase tracking-widest rounded-xl transition flex items-center justify-center gap-2 mt-4 cursor-pointer"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 size={16} className="animate-spin text-white" />
                            <span>Processing Card...</span>
                          </>
                        ) : (
                          <>
                            <span>Complete Purchase</span>
                            <ArrowRight size={13} />
                          </>
                        )}
                      </button>
                    </motion.form>
                  ) : (
                    <motion.div
                      key="paypal-form"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="space-y-4 pt-2"
                    >
                      <p className="text-[10px] text-neutral-400 leading-relaxed font-sans">
                        Pay securely with your PayPal account balance, connected bank accounts, or regional methods via standard express checkout.
                      </p>

                      {selectedPlan && (
                        <div className="relative min-h-[120px] bg-neutral-950/60 p-4 rounded-2xl border border-neutral-850">
                          <PayPalScriptProvider options={{ 
                            clientId: paypalClientId,
                            currency: 'USD',
                            intent: 'capture'
                          }}>
                            <PayPalButtons
                              forceReRender={[selectedPlan.id, billingCycle, extraSeats]}
                              style={{ layout: "vertical", color: "blue", shape: "rect", label: "pay" }}
                              createOrder={async () => {
                                const amount = getPlanPrice(selectedPlan);
                                try {
                                  const res = await authenticatedFetch('/api/paypal/create-order', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      planId: selectedPlan.id,
                                      amount,
                                      currency: 'USD'
                                    })
                                  });
                                  const order = await res.json();
                                  if (!res.ok || !order.id) {
                                    throw new Error(order.error || "Failed to generate PayPal order on backend.");
                                  }
                                  return order.id;
                                } catch (err: any) {
                                  console.error("PayPal Create Order Error", err);
                                  toast.error(err.message || "Failed to open PayPal gateway checkout.");
                                  throw err;
                                }
                              }}
                              onApprove={async (data) => {
                                setIsProcessing(true);
                                try {
                                  const res = await authenticatedFetch('/api/paypal/capture-order', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      orderID: data.orderID,
                                      planId: selectedPlan.id,
                                      extraSeats: extraSeats
                                    })
                                  });
                                  const captureData = await res.json();
                                  if (res.ok && captureData.status === 'COMPLETED') {
                                    setPaymentSuccess(true);
                                    triggerConfetti();
                                    toast.success(`Success! Upgraded to ${selectedPlan.name}!`);
                                    if (onSuccess) {
                                      onSuccess(selectedPlan.id);
                                    }
                                  } else {
                                    throw new Error(captureData.error || "Could not verify order capture state.");
                                  }
                                } catch (err: any) {
                                  console.error("PayPal Capture Error", err);
                                  toast.error(err.message || "PayPal verification capture failed.");
                                } finally {
                                  setIsProcessing(false);
                                }
                              }}
                            />
                          </PayPalScriptProvider>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          <div className="text-[9px] text-neutral-500 font-mono text-center pt-4 uppercase tracking-widest flex items-center justify-center gap-1">
            <ShieldCheck size={11} className="text-emerald-500" /> Fully Encrypted SSL Security Clearance
          </div>
        </div>
      </div>
    </div>
  );
}
