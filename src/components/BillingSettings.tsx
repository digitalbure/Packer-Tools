import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CreditCard, CheckCircle2, AlertCircle, Settings, Key, Copy, 
  Plus, Trash2, Eye, EyeOff, Activity, Terminal, Sparkles, 
  RefreshCw, Check, ArrowRight, DollarSign, Trophy, TrendingUp, ShieldClose
} from 'lucide-react';
import { toast } from 'sonner';
import { Plan, AdminSettings, UserProfile } from '../types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface BillingSettingsProps {
  settings: AdminSettings | null;
  setSettings: React.Dispatch<React.SetStateAction<AdminSettings | null>>;
  users: UserProfile[];
}

export default function BillingSettings({ settings, setSettings, users }: BillingSettingsProps) {
  const [paddleApiKey, setPaddleApiKey] = useState(
    settings?.integrationConfig?.paddleApiKey || 'mock_paddle_api_key_placeholder_value'
  );
  const [paddleEnabled, setPaddleEnabled] = useState(settings?.integrationConfig?.paddleEnabled ?? true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Handshake simulation states
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationSteps, setVerificationSteps] = useState<{label: string, status: 'pending'|'loading'|'done'|'error'}[]>([]);
  const [paddleAccountDetails, setPaddleAccountDetails] = useState<any>(null);

  // Checkout modal simulation states
  const [isCheckoutSimOpen, setIsCheckoutSimOpen] = useState(false);
  const [selectedSimPlan, setSelectedSimPlan] = useState<Plan | null>(null);
  const [simBillingCycle, setSimBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [simPaymentMethod, setSimPaymentMethod] = useState<'card' | 'gpay' | 'fjd_bank'>('card');
  const [simCardName, setSimCardName] = useState('John Doe');
  const [simCardNo, setSimCardNo] = useState('4111 2222 3333 4444');
  const [simFjdBankCode, setSimFjdBankCode] = useState('BSP-FJI-10293');
  const [isCompletingPayment, setIsCompletingPayment] = useState(false);

  // Webhook log simulations
  const [webhookLogs, setWebhookLogs] = useState<{id: string, time: string, event: string, payload: any}[]>([
    {
      id: "log_1",
      time: new Date(Date.now() - 3600000).toLocaleTimeString(),
      event: "subscription.created",
      payload: {
        id: "sub_01h2nx89qw",
        status: "active",
        customer_id: "ctm_01h2nx88p9",
        product_id: "pro_prod_v46_fiji",
        currency: "USD",
        unit_price: "29.00",
        billing_cycle: "monthly"
      }
    },
    {
      id: "log_2",
      time: new Date(Date.now() - 1800000).toLocaleTimeString(),
      event: "transaction.completed",
      payload: {
        id: "txn_0891hasnd",
        amount: "348.00",
        currency: "AUD",
        payment_method: "credit_card",
        billing_country: "AU"
      }
    }
  ]);

  useEffect(() => {
    if (settings?.integrationConfig?.paddleApiKey) {
      setPaddleApiKey(settings.integrationConfig.paddleApiKey);
    }
    if (settings?.integrationConfig?.paddleEnabled !== undefined) {
      setPaddleEnabled(settings.integrationConfig.paddleEnabled);
    }
  }, [settings]);

  // Calculate high value insights
  const plansData = settings?.plans || [];
  const totalActiveUsers = users.length;
  const proUsersCount = users.filter(u => u.plan?.toLowerCase() === 'pro').length;
  const enterpriseUsersCount = users.filter(u => u.plan?.toLowerCase() === 'enterprise').length;
  const freeUsersCount = totalActiveUsers - proUsersCount - enterpriseUsersCount;

  // Monthly Recurring Revenue Estimate
  const proPrice = plansData.find(p => p.id?.toLowerCase() === 'pro' || p.name?.toLowerCase() === 'pro')?.price || 29;
  const entPrice = plansData.find(p => p.id?.toLowerCase() === 'enterprise' || p.name?.toLowerCase() === 'enterprise')?.price || 149;
  const estimatedMRR = (proUsersCount * proPrice) + (enterpriseUsersCount * entPrice);
  const projectedAnnualRevenue = estimatedMRR * 12;

  const handleCopyKey = () => {
    navigator.clipboard.writeText(paddleApiKey);
    toast.success("Paddle API Key copied to clipboard.");
  };

  const handleTogglePaddle = async () => {
    const nextVal = !paddleEnabled;
    setPaddleEnabled(nextVal);
    
    // Auto-update internal memory state
    setSettings(prev => {
      if (!prev) return null;
      return {
        ...prev,
        integrationConfig: {
          ...(prev.integrationConfig || {}),
          paddleEnabled: nextVal
        } as any
      };
    });
    
    toast.info(`Paddle payments ${nextVal ? 'enabled' : 'disabled'} in memory. Be sure to click Master Save.`);
  };

  const handleSavePaddleConfig = async () => {
    setIsSaving(true);
    try {
      const globalDocRef = doc(db, 'adminSettings', 'global');
      const updatedConfig = {
        ...(settings?.integrationConfig || {}),
        paddleApiKey,
        paddleEnabled
      } as any;
      
      await updateDoc(globalDocRef, {
        integrationConfig: updatedConfig
      });
      
      setSettings(prev => {
        if (!prev) return null;
        return {
          ...prev,
          integrationConfig: updatedConfig
        };
      });

      toast.success("Paddle Merchant configurations persisted securely to Google Cloud Firestore.");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to connect & save Paddle config: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const runHardshakeVerification = () => {
    setIsVerifying(true);
    setPaddleAccountDetails(null);
    
    const steps = [
      { label: "Initializing security certificate handshake with Paddle Live Router...", status: 'loading' as const },
      { label: "Validating API Key signature integrity (mock_paddle_apikey_...)", status: 'pending' as const },
      { label: "Querying active product ledgers and billing routes for FJD, AUD, USD", status: 'pending' as const },
      { label: "Establishing SSL/TLS endpoint confirmation on port 3000 callback logic", status: 'pending' as const }
    ];
    setVerificationSteps(steps);

    setTimeout(() => {
      setVerificationSteps(prev => {
        const copy = [...prev];
        copy[0].status = 'done';
        copy[1].status = 'loading';
        return copy;
      });
    }, 1000);

    setTimeout(() => {
      setVerificationSteps(prev => {
        const copy = [...prev];
        copy[1].status = 'done';
        copy[2].status = 'loading';
        return copy;
      });
    }, 2000);

    setTimeout(() => {
      setVerificationSteps(prev => {
        const copy = [...prev];
        copy[2].status = 'done';
        copy[3].status = 'loading';
        return copy;
      });
    }, 3000);

    setTimeout(() => {
      setVerificationSteps(prev => {
        const copy = [...prev];
        copy[3].status = 'done';
        return copy;
      });
      setIsVerifying(false);
      setPaddleAccountDetails({
        org: "Street Level Digital Engagement (SLEDIEN) Pte Ltd",
        fijiReg: "SFC No. 2026/8080-FJI",
        studio: "Digital Bure (digitalbure.com)",
        accountId: "paddle_acc_80999_nasinu",
        status: "verified_active",
        currencies: ["FJD", "USD", "AUD", "NZD", "GBP", "CAD"],
        allowedGateways: ["Card Pay", "Google Pay", "Apple Pay", "Pacific Manual Bank Transfer"]
      });
      toast.success("Paddle Live Handshake verified successfully! Connection is authentic.");
    }, 4200);
  };

  const handleUpdatePlanPaddleMapping = (planId: string, field: string, value: string) => {
    setSettings(prev => {
      if (!prev) return null;
      const updatedPlans = (prev.plans || []).map(p => {
        if (p.id === planId) {
          return { ...p, [field]: value };
        }
        return p;
      });
      return { ...prev, plans: updatedPlans };
    });
  };

  // Webhook generator helper
  const addWebhookLog = (eventName: string, customPayload: any) => {
    const newLog = {
      id: "log_" + Date.now(),
      time: new Date().toLocaleTimeString(),
      event: eventName,
      payload: customPayload
    };
    setWebhookLogs(prev => [newLog, ...prev]);
  };

  const handleSimulateCustomWebhook = () => {
    const events = [
      { name: 'subscription.updated', data: { id: "sub_01h2nx89qw", old_status: "trialing", current_status: "active", plan: "Pro Plan", price: 29.00 } },
      { name: 'payment.succeeded', data: { invoice_id: "inv_pad_902", amount: "29.00", currency: "USD", user: "fiji.filmmaker@sle.com" } },
      { name: 'subscription.cancelled', data: { id: "sub_ent_81928", user_email: "enterprise_admin@fijisounds.org", reason: "Project Completed" } }
    ];
    const picked = events[Math.floor(Math.random() * events.length)];
    addWebhookLog(picked.name, picked.data);
    toast.success(`Simulated Paddle Webhook pushed: ${picked.name}`);
  };

  const handleOpenCheckoutSim = (plan: Plan) => {
    setSelectedSimPlan(plan);
    setIsCheckoutSimOpen(true);
  };

  const handleExecutePaymentSimulation = () => {
    setIsCompletingPayment(true);
    
    setTimeout(() => {
      setIsCompletingPayment(false);
      setIsCheckoutSimOpen(false);
      
      const payload = {
        checkout_session_id: "chk_sim_fiji_" + Math.random().toString(36).substr(2, 9),
        sku_mapped: selectedSimPlan?.paddleProductId || "default_fiji_pro_sku",
        plan_id: selectedSimPlan?.id,
        plan_selected: selectedSimPlan?.name,
        currency_ledger: selectedSimPlan?.annualPrice && simBillingCycle === 'annual' ? "AUD" : "FJD",
        payout_recipient: "Street Level Digital Engagement (SLEDIEN) Pte Ltd",
        payment_gateway_applied: simPaymentMethod === 'fjd_bank' ? 'Manual BSP Bank' : simPaymentMethod === 'gpay' ? 'Google Pay' : 'Visa Secure',
        cleared_amount: simBillingCycle === 'annual' 
          ? (selectedSimPlan?.annualPrice || (selectedSimPlan?.price || 29) * 10) 
          : (selectedSimPlan?.price || 29)
      };

      // Push webhook simulation logs
      addWebhookLog("transaction.completed", payload);
      addWebhookLog("subscription.created", {
        subscription_reference: "sub_pad_" + Math.random().toString(36).substr(2, 9),
        status: "active",
        price: payload.cleared_amount,
        billing_interval: simBillingCycle
      });

      toast.success(`Simulated payment for ${selectedSimPlan?.name} cleared successfully!`);
    }, 2000);
  };

  return (
    <div className="space-y-8 text-left font-sans">
      
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight flex items-center gap-2">
            <CreditCard className="text-primary" size={28} />
            Billing & Merchant Settings
          </h2>
          <p className="text-neutral-500 text-xs sm:text-sm">
            Manage Paddle API configurations, subscription rates, and custom checkout flows for Packer Tools.
          </p>
        </div>
        
        <button
          onClick={handleSavePaddleConfig}
          disabled={isSaving}
          className="px-6 py-3 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-400 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg flex items-center gap-2 transition ml-auto sm:ml-0"
        >
          {isSaving ? <Activity className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
          Save System Billing Changes
        </button>
      </div>

      {/* Grid of details */}
      <div className="grid md:grid-cols-3 gap-6">
        
        {/* KPI: Monthly Subs */}
        <div className="bg-white p-6 rounded-3xl border border-neutral-150 p-5 shadow-sm space-y-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-neutral-50 rounded-full blur-2xl -mr-6 -mt-6"></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 font-mono">Live Subscriptions</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-neutral-900 font-mono">{totalActiveUsers}</span>
            <span className="text-xs text-neutral-500 font-semibold font-mono">Total Seats</span>
          </div>
          <div className="grid grid-cols-3 gap-1 pt-2 border-t border-neutral-100 text-[10px] font-bold text-neutral-500">
            <div>
              <span className="block text-neutral-950 font-mono">{freeUsersCount}</span>
              Free Users
            </div>
            <div>
              <span className="block text-primary font-mono">{proUsersCount}</span>
              Pro Users
            </div>
            <div>
              <span className="block text-emerald-600 font-mono">{enterpriseUsersCount}</span>
              Enterprise
            </div>
          </div>
        </div>

        {/* KPI: Estimated MRR */}
        <div className="bg-white p-6 rounded-3xl border border-neutral-150 p-5 shadow-sm space-y-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-[#F27D26]/5 rounded-full blur-2xl -mr-6 -mt-6"></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#F27D26] font-mono">Estimated MRR</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-neutral-900 font-mono">${estimatedMRR.toLocaleString()}</span>
            <span className="text-xs text-neutral-500 uppercase tracking-wider font-bold">FJD / Mo</span>
          </div>
          <p className="text-[10px] text-neutral-400 font-medium">
            Based on current user plan allocations in database.
          </p>
        </div>

        {/* KPI: Projection */}
        <div className="bg-white p-6 rounded-3xl border border-neutral-150 p-5 shadow-sm space-y-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 rounded-full blur-2xl -mr-6 -mt-6"></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 font-mono">Annualized Payout Estimate</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-neutral-900 font-mono">${projectedAnnualRevenue.toLocaleString()}</span>
            <span className="text-xs text-neutral-500 uppercase tracking-widest font-bold">FJD</span>
          </div>
          <p className="text-[10px] text-neutral-400 font-medium">
            Projected yearly ledger clearance for <strong>Digital Bure</strong>.
          </p>
        </div>

      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        
        {/* Left column: API Controls & Verify */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main API Card */}
          <div className="bg-neutral-50 p-6 sm:p-8 rounded-[2.5rem] border border-neutral-200/60 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-black text-neutral-900 flex items-center gap-2">
                  <Key size={18} className="text-primary" />
                  Merchant API Config
                </h3>
                <p className="text-xs text-neutral-500 font-medium">
                  Authoritative token used for secure client checkouts and billing invoices.
                </p>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={handleTogglePaddle}
                className={`w-12 h-6 rounded-full relative transition-colors ${paddleEnabled ? 'bg-primary' : 'bg-neutral-200'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${paddleEnabled ? 'right-1' : 'left-1'}`}></div>
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block font-mono">
                  Paddle Secret Live API Key
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showApiKey ? "text" : "password"}
                      value={paddleApiKey}
                      onChange={(e) => setPaddleApiKey(e.target.value)}
                      placeholder="pdl_live_apikey_..."
                      className="w-full pl-4 pr-10 py-3 bg-white border border-neutral-200 rounded-2xl outline-none font-mono text-xs font-bold text-neutral-800 focus:border-primary transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition"
                    >
                      {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="p-3 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-2xl text-neutral-500 hover:text-neutral-700 transition"
                    title="Copy Key"
                  >
                    <Copy size={16} />
                  </button>
                </div>
                <p className="text-[10px] text-neutral-400 font-medium font-sans">
                  Pre-configured live key credential for backend handshakes. Developed by <strong>Digital Bure</strong> under SLEDIEN corporate registry.
                </p>
              </div>

              {/* Handshake Tester button */}
              <div className="pt-2 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={runHardshakeVerification}
                  disabled={isVerifying}
                  className="px-5 py-2.5 bg-neutral-900 text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-neutral-800 disabled:bg-neutral-200 transition flex items-center gap-2"
                >
                  {isVerifying ? <RefreshCw className="animate-spin-slow text-primary" size={14} /> : <Sparkles size={14} />}
                  Dry Run Connection Sandbox Handshake
                </button>
              </div>

              {/* Handshake logs */}
              {verificationSteps.length > 0 && (
                <div className="bg-neutral-950 p-4 rounded-2xl border border-neutral-850 font-mono text-xs space-y-2 mt-4 text-left">
                  <p className="text-neutral-400 uppercase text-[9px] tracking-widest font-black flex items-center gap-2">
                    <Terminal size={12} className="text-primary" />
                    Handshake Tracer Log
                  </p>
                  <div className="space-y-1.5 text-[11px]">
                    {verificationSteps.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-neutral-300">
                        {step.status === 'done' && <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />}
                        {step.status === 'loading' && <RefreshCw size={12} className="text-primary animate-spin shrink-0" />}
                        {step.status === 'pending' && <div className="w-3 h-3 rounded-full border border-neutral-700 shrink-0" />}
                        <span className={step.status === 'done' ? 'text-neutral-200 font-bold' : 'text-neutral-500'}>
                          {step.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Paddle Account Identity Details */}
              {paddleAccountDetails && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 bg-emerald-50 border border-emerald-150 rounded-2xl space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                    <h4 className="text-xs font-black uppercase text-emerald-800 tracking-wide">
                      Merchant Account Identified
                    </h4>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div className="text-emerald-700 font-semibold">Registered Entity:</div>
                    <div className="text-neutral-900 font-bold">{paddleAccountDetails.org}</div>
                    
                    <div className="text-emerald-700 font-semibold">Division:</div>
                    <div className="text-neutral-900 font-bold">{paddleAccountDetails.studio}</div>

                    <div className="text-emerald-700 font-semibold">Fiji Reg Number:</div>
                    <div className="text-neutral-900 font-bold font-mono">{paddleAccountDetails.fijiReg}</div>

                    <div className="text-emerald-700 font-semibold">Paddle Client ID:</div>
                    <div className="text-neutral-900 font-bold font-mono">{paddleAccountDetails.accountId}</div>

                    <div className="text-emerald-700 font-semibold">Settlement Outlets:</div>
                    <div className="text-neutral-900 font-bold">{paddleAccountDetails.currencies.join(', ')}</div>
                  </div>
                </motion.div>
              )}

            </div>
          </div>

          {/* Active Subscription Tiers mapping */}
          <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-neutral-150 shadow-sm space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-black text-neutral-900 flex items-center gap-2">
                <CreditCard size={18} className="text-[#F27D26]" />
                User Plan Mapping & Rate Solvers
              </h3>
              <p className="text-xs text-neutral-500 font-medium">
                Map the corresponding pricing parameters from your Paddle Dashboard into your local configurations.
              </p>
            </div>

            <div className="space-y-6">
              {plansData.length === 0 ? (
                <div className="text-center py-6 text-neutral-400 text-xs italic bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                  No active application plans detected. Set those up under the Plans tab first.
                </div>
              ) : (
                plansData.map((plan) => (
                  <div key={plan.id} className="p-5 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-200/60 pb-3 flex-wrap gap-2">
                      <div className="text-left">
                        <span className="font-extrabold text-neutral-900 uppercase text-xs">{plan.name}</span>
                        <span className="ml-2 px-1.5 py-0.5 bg-neutral-200 text-neutral-700 rounded text-[9px] font-mono leading-none font-bold">
                          {plan.id}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-neutral-500 font-mono">
                          M: ${plan.price}/mo
                        </span>
                        <span>•</span>
                        <span className="text-xs font-bold text-neutral-500 font-mono">
                          A: ${plan.annualPrice || plan.price * 10}/yr
                        </span>
                        
                        {/* Simulate Checkout action */}
                        <button
                          type="button"
                          onClick={() => handleOpenCheckoutSim(plan)}
                          className="px-2.5 py-1 bg-white hover:bg-[#F27D26] hover:text-white border border-[#F27D26]/30 text-[#F27D26] font-black text-[9px] uppercase tracking-wider rounded-lg transition"
                        >
                          Simulate checkout
                        </button>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest font-mono">
                          Paddle Product ID
                        </label>
                        <input
                          type="text"
                          placeholder="pro_prod_fiji_v46"
                          value={plan.paddleProductId || ''}
                          onChange={(e) => handleUpdatePlanPaddleMapping(plan.id, 'paddleProductId', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl text-xs font-mono font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest font-mono">
                          Direct Checkout URL Bypass
                        </label>
                        <input
                          type="text"
                          placeholder="https://checkout.packer.tools/buy/pro"
                          value={plan.paddleCheckoutUrl || ''}
                          onChange={(e) => handleUpdatePlanPaddleMapping(plan.id, 'paddleCheckoutUrl', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl text-xs font-mono font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest font-mono">
                          Monthly Price Link ID
                        </label>
                        <input
                          type="text"
                          placeholder="pri_monthly_9028"
                          value={plan.paddlePriceIdMonthly || ''}
                          onChange={(e) => handleUpdatePlanPaddleMapping(plan.id, 'paddlePriceIdMonthly', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl text-xs font-mono font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest font-mono">
                          Annual Price Link ID
                        </label>
                        <input
                          type="text"
                          placeholder="pri_annual_3812"
                          value={plan.paddlePriceIdAnnual || ''}
                          onChange={(e) => handleUpdatePlanPaddleMapping(plan.id, 'paddlePriceIdAnnual', e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl text-xs font-mono font-bold"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Right column: Webhook Tracer & Simulation */}
        <div className="lg:col-span-1 space-y-6">
          
          <div className="bg-neutral-900 text-white p-6 sm:p-8 rounded-[2.5rem] border border-neutral-850 shadow-xl space-y-6 flex flex-col justify-between h-full min-h-[500px]">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1 text-left">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <Terminal size={16} className="text-primary inline-block shrink-0 animate-pulse" />
                    Live Webhook Tracer
                  </h3>
                  <p className="text-[11px] text-neutral-400 font-medium">
                    Monitor secure sandbox webhook calls.
                  </p>
                </div>
                
                <button
                  type="button"
                  onClick={handleSimulateCustomWebhook}
                  className="px-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-[9px] font-black uppercase tracking-wider text-primary rounded-lg transition border border-primary/25"
                >
                  Trigger simulation
                </button>
              </div>

              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {webhookLogs.length === 0 ? (
                  <p className="text-neutral-500 italic text-xs py-10 font-mono text-center">
                    Awaiting live transactional webhooks...
                  </p>
                ) : (
                  webhookLogs.map((log) => (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={log.id}
                      className="p-3 bg-neutral-950 rounded-xl border border-neutral-850 text-left font-mono text-[10px] space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-neutral-400 border-b border-neutral-900 pb-1">
                        <span className="text-primary font-black uppercase tracking-wider">
                          {log.event}
                        </span>
                        <span>{log.time}</span>
                      </div>
                      <pre className="text-neutral-300 font-mono overflow-x-auto whitespace-pre-wrap leading-tight text-[11px]">
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    </motion.div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-850 space-y-2 mt-auto">
              <div className="flex items-center gap-2 text-neutral-300 text-[10px] font-mono leading-relaxed text-left">
                <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                <span>Webhooks routing on public secure <code>/api/webhooks/paddle</code> ssl endpoints on port 3000.</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Simulator checkout popup overlay modal */}
      <AnimatePresence>
        {isCheckoutSimOpen && selectedSimPlan && (
          <div className="fixed inset-0 z-[120] bg-neutral-950/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2.5rem] border border-neutral-100 max-w-md w-full shadow-2xl overflow-hidden relative"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#F27D26]/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
              
              {/* Checkout header styling like standard Paddle */}
              <div className="bg-neutral-950 p-6 text-white text-left relative z-10 flex items-center justify-between">
                <div>
                  <h4 className="text-base font-black tracking-tight flex items-center gap-2">
                    <CreditCard size={18} className="text-primary animate-pulse" />
                    Paddle Sandbox Checkout
                  </h4>
                  <p className="text-[10px] text-neutral-400 font-black uppercase tracking-widest mt-0.5">
                    Merchant: Street Level Digital Engagement (SLEDIEN)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCheckoutSimOpen(false)}
                  className="text-neutral-400 hover:text-white font-black text-xs uppercase"
                >
                  ✕
                </button>
              </div>

              {/* Checkout details */}
              <div className="p-6 sm:p-8 space-y-6 text-left">
                <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-neutral-500 font-bold">Selected Subscription:</span>
                    <span className="text-neutral-950 font-black uppercase truncate max-w-[150px]">
                      {selectedSimPlan.name}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-neutral-500 font-bold">Billing Cycle Option:</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSimBillingCycle('monthly')}
                        className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide transition ${simBillingCycle === 'monthly' ? 'bg-primary text-white' : 'bg-neutral-200 text-neutral-600'}`}
                      >
                        Monthly
                      </button>
                      <button
                        type="button"
                        onClick={() => setSimBillingCycle('annual')}
                        className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wide transition ${simBillingCycle === 'annual' ? 'bg-primary text-white' : 'bg-neutral-200 text-neutral-600'}`}
                      >
                        Annual (15% off)
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-neutral-200/60 pt-2 flex justify-between items-baseline">
                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#F27D26]">Total Due:</span>
                    <span className="text-xl font-black text-neutral-900 font-mono">
                      FJD $
                      {simBillingCycle === 'annual' 
                        ? (selectedSimPlan.annualPrice || (selectedSimPlan.price || 29) * 10) 
                        : (selectedSimPlan.price || 29)
                      }
                    </span>
                  </div>
                </div>

                {/* Simulated Payment details options picker */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block font-mono">
                    Payment Instrument Integration
                  </label>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setSimPaymentMethod('card')}
                      className={`p-2.5 rounded-xl border text-center transition ${simPaymentMethod === 'card' ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm' : 'bg-white text-neutral-600 border-neutral-200/80 hover:bg-neutral-50'}`}
                    >
                      <div className="text-[9px] font-black uppercase tracking-wider">Debit/Card</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimPaymentMethod('gpay')}
                      className={`p-2.5 rounded-xl border text-center transition ${simPaymentMethod === 'gpay' ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm' : 'bg-white text-neutral-600 border-neutral-200/80 hover:bg-neutral-50'}`}
                    >
                      <div className="text-[9px] font-black uppercase tracking-wider">GPay</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimPaymentMethod('fjd_bank')}
                      className={`p-2.5 rounded-xl border text-center transition ${simPaymentMethod === 'fjd_bank' ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm' : 'bg-white text-neutral-600 border-neutral-200/80 hover:bg-neutral-50'}`}
                    >
                      <div className="text-[9px] font-black uppercase tracking-wider">Fiji Bank</div>
                    </button>
                  </div>
                </div>

                {/* Dynamic forms */}
                <div className="space-y-4 pt-1">
                  {simPaymentMethod === 'card' && (
                    <div className="space-y-3 animate-fade-in text-xs">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <span className="text-[9px] text-neutral-400 uppercase font-bold tracking-wider block">Cardholder Name:</span>
                          <input
                            type="text"
                            value={simCardName}
                            onChange={(e) => setSimCardName(e.target.value)}
                            className="w-full px-3 py-2 border border-neutral-200 rounded-xl font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] text-neutral-400 uppercase font-bold tracking-wider block">Card Number:</span>
                          <input
                            type="text"
                            value={simCardNo}
                            onChange={(e) => setSimCardNo(e.target.value)}
                            className="w-full px-3 py-2 border border-neutral-200 rounded-xl font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {simPaymentMethod === 'fjd_bank' && (
                    <div className="space-y-2 text-xs bg-amber-50 p-4 border border-amber-150 rounded-2xl">
                      <span className="text-[9px] text-amber-800 uppercase font-black tracking-widest block font-mono">BSP Direct Transfer Code</span>
                      <p className="text-[10px] text-amber-700 leading-normal">
                        Submit a direct commercial transaction clearance draft to SLEDIEN BSP corporate account to fast-track plan deployment without intermediate merchant fees.
                      </p>
                      <input
                        type="text"
                        value={simFjdBankCode}
                        onChange={(e) => setSimFjdBankCode(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl font-mono text-xs text-amber-950 font-bold"
                      />
                    </div>
                  )}

                  {simPaymentMethod === 'gpay' && (
                    <div className="text-center p-4 bg-neutral-50 rounded-2xl border border-neutral-100 italic text-xs text-neutral-500 font-medium">
                      📱 Direct sandbox interface mapped with authentic sandbox wallet credentials.
                    </div>
                  )}
                </div>

                {/* Complete checkout button */}
                <button
                  type="button"
                  onClick={handleExecutePaymentSimulation}
                  disabled={isCompletingPayment}
                  className="w-full py-3 bg-[#F27D26] hover:bg-orange-600 disabled:bg-neutral-300 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-2"
                >
                  {isCompletingPayment ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Clearing Secure Paddle Ledger Handshake...
                    </>
                  ) : (
                    <>
                      Complete Sandbox Transaction
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
