import React, { useState } from 'react';
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { X, Check, Zap, Shield, Crown, Loader2 } from 'lucide-react';
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

  const handleManualSubmit = async () => {
    if (!manualReferenceId.trim()) {
      toast.error("Please enter your Direct Payment Transaction Reference ID.");
      return;
    }
    setIsProcessing(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        plan: selectedPlan?.id,
        extraSeats: extraSeatsCount,
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
        // Update user plan in Firestore
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          plan: selectedPlan?.id,
          extraSeats: extraSeatsCount,
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
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden relative flex flex-col md:flex-row"
        >
          <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 hover:bg-neutral-100 rounded-full transition z-10"
          >
            <X size={20} />
          </button>

          {/* Left Side: Plans */}
          <div className="flex-1 p-10 space-y-8 bg-neutral-50">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-3xl font-black uppercase tracking-tighter">Upgrade Your Kit</h2>
                <p className="text-neutral-500 font-medium">Choose the plan that matches your production scale.</p>
              </div>
              <div className="flex bg-neutral-100 p-1 rounded-xl shrink-0">
                <button 
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition ${billingCycle === 'monthly' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-400'}`}
                >
                  Monthly
                </button>
                <button 
                  onClick={() => setBillingCycle('annual')}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition ${billingCycle === 'annual' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-400'}`}
                >
                  Annual
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan)}
                  className={`w-full p-6 rounded-2xl border-2 transition-all text-left flex items-center justify-between group ${
                    selectedPlan?.id === plan.id 
                      ? 'border-primary bg-white shadow-lg' 
                      : 'border-transparent bg-neutral-100 hover:bg-white hover:border-neutral-200'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      plan.id === 'pro' ? 'bg-accent text-white' : 'bg-primary text-white'
                    }`}>
                      {plan.id === 'pro' ? <Zap size={24} /> : <Shield size={24} />}
                    </div>
                    <div>
                      <div className="font-black uppercase tracking-tight">{plan.name}</div>
                      <div className="text-xs text-neutral-400 font-bold uppercase tracking-widest">
                        {plan.aiTokenLimit} AI Tokens • {plan.maxContacts} Contacts
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black tracking-tighter">{currentCurrency?.symbol || '$'}{getActivePrice(plan)}</div>
                    <div className="text-[10px] font-bold text-neutral-400 uppercase">
                      {billingCycle === 'monthly' ? 'Per Month' : 'Per Year'}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {selectedPlan && (
              <div className="p-6 bg-white rounded-2xl border border-neutral-100 space-y-4">
                <div className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Included Features</div>
                <div className="grid grid-cols-2 gap-3">
                  {selectedPlan.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs font-bold text-neutral-600">
                      <Check size={14} className="text-green-500" />
                      <span className="capitalize">{feature.replace(/([A-Z])/g, ' $1')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Side: Checkout */}
          <div className="w-full md:w-[350px] p-10 bg-white border-l border-neutral-100 flex flex-col justify-center">
            {selectedPlan ? (
              <div className="space-y-8">
                <div className="text-center space-y-2">
                  <div className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Total Due Today</div>
                  <div className="text-5xl font-black tracking-tighter">{currentCurrency?.symbol || '$'}{getActivePrice(selectedPlan)}</div>
                  {billingCycle === 'annual' && selectedPlan.annualPrice && (
                    <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded flex items-center justify-center gap-1">
                      <Zap size={10} />
                      <span>Annual Savings Included</span>
                    </div>
                  )}
                </div>

                {selectedPlan.price > 0 && (
                  <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-3">
                    <div className="flex justify-between items-center text-left">
                      <div>
                        <span className="text-[10px] font-black uppercase text-neutral-800 tracking-wider">Additional Seats</span>
                        <p className="text-[9px] text-neutral-400 font-medium leading-tight">Plan includes {selectedPlan.includedSeats ?? 3} base users</p>
                      </div>
                      <span className="text-[10px] bg-primary/10 text-primary font-black px-2 py-1 rounded-lg border border-primary/5">
                        +${selectedPlan.extraSeatCost ?? 10}/mo
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <button
                        type="button"
                        onClick={() => setExtraSeatsCount(Math.max(0, extraSeatsCount - 1))}
                        className="w-8 h-8 rounded-lg bg-neutral-200 text-neutral-800 font-bold hover:bg-neutral-300 transition shrink-0 flex items-center justify-center cursor-pointer text-sm"
                      >
                        -
                      </button>
                      <div className="text-center font-bold text-xs text-neutral-700">
                        {extraSeatsCount} extra seat{extraSeatsCount !== 1 ? 's' : ''}
                      </div>
                      <button
                        type="button"
                        onClick={() => setExtraSeatsCount(extraSeatsCount + 1)}
                        className="w-8 h-8 rounded-lg bg-neutral-200 text-neutral-800 font-bold hover:bg-neutral-300 transition shrink-0 flex items-center justify-center cursor-pointer text-sm"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-[9px] text-neutral-400 font-medium text-center border-t border-neutral-100/60 pt-2">
                      Total Seats: <strong className="text-neutral-700 font-black">{(selectedPlan.includedSeats ?? 3) + extraSeatsCount} Licenses</strong>
                    </div>
                  </div>
                )}

                <div className="relative">
                  {isProcessing && (
                    <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-2xl gap-3">
                      <Loader2 size={32} className="text-primary animate-spin" />
                      <div className="text-xs font-bold uppercase tracking-widest">Processing Kit...</div>
                    </div>
                  )}
                  
                {/* Currency Selection */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-neutral-450 tracking-widest block">Choose Billing Currency</label>
                  <select
                    value={selectedCurrencyCode}
                    onChange={(e) => {
                      setSelectedCurrencyCode(e.target.value);
                      setSelectedGatewayIdx(0);
                    }}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl outline-none font-bold text-sm text-neutral-800 transition focus:ring-2 focus:ring-primary appearance-none"
                  >
                    {activeCurrencies.map((c) => (
                      <option key={c.code} value={c.code}>{c.code} ({c.symbol}) — {c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Gateway Dropdown Selection */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-neutral-450 tracking-widest block">Select Gateway Method</label>
                  {enabledGateways.length === 0 ? (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-semibold">
                      No payment methods configured for this currency.
                    </div>
                  ) : (
                    <select
                      value={selectedGatewayIdx}
                      onChange={(e) => setSelectedGatewayIdx(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl outline-none font-bold text-sm text-neutral-800 transition focus:ring-2 focus:ring-primary"
                    >
                      {enabledGateways.map((gw, idx) => (
                        <option key={idx} value={idx}>{gw.name} ({gw.gateway === 'paypal' ? 'PayPal Checkout' : 'Manual Deposit'})</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Rendering Active Gateway View */}
                {selectedGateway && (
                  <div className="space-y-4">
                    {selectedGateway.gateway === 'paypal' ? (
                      <div className="relative">
                        {isProcessing && (
                          <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-2xl gap-3">
                            <Loader2 size={32} className="text-primary animate-spin" />
                            <div className="text-xs font-bold uppercase tracking-widest">Processing Kit...</div>
                          </div>
                        )}
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
                      <div className="p-5 bg-neutral-50 border border-neutral-150 rounded-2xl space-y-4">
                        <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider border-b border-neutral-200/50 pb-1 flex items-center gap-1">
                          <Shield size={10} className="text-primary animate-pulse" />
                          <span>Direct Deposit Instructions</span>
                        </div>
                        <p className="text-xs text-neutral-600 leading-relaxed font-semibold whitespace-pre-line bg-white p-3 rounded-xl border border-neutral-100">
                          {selectedGateway.instructions || "Please contact the system administrator to obtain offline payment details."}
                        </p>
                        
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Transaction Reference ID / Proof</label>
                          <input
                            type="text"
                            placeholder="e.g. TXN-908234-BSP-FIJI"
                            value={manualReferenceId}
                            onChange={(e) => setManualReferenceId(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl outline-none text-xs font-mono focus:ring-2 focus:ring-primary transition"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={handleManualSubmit}
                          disabled={isProcessing}
                          className="w-full py-3 bg-neutral-900 border border-transparent rounded-xl text-white text-xs font-black uppercase tracking-widest hover:bg-neutral-800 transition flex items-center justify-center gap-2"
                        >
                          {isProcessing ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              <span>Submitting...</span>
                            </>
                          ) : (
                            <span>Submit Direct Payment</span>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                </div>

                <div className="text-center">
                  <p className="text-[10px] text-neutral-400 font-medium leading-relaxed">
                    By confirming your kit upgrade, you agree to our Terms of Service and Privacy Policy. Subscriptions can be managed in your profile.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4 py-12">
                <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto text-neutral-300">
                  <Crown size={32} />
                </div>
                <div className="space-y-1">
                  <div className="font-bold uppercase tracking-tight">Select a Plan</div>
                  <p className="text-xs text-neutral-400">Choose a plan on the left to proceed with checkout.</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
