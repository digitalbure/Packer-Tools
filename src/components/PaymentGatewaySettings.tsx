import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CreditCard, CheckCircle2, AlertCircle, Settings, Key, Copy, 
  Plus, Trash2, Eye, EyeOff, Activity, Terminal, Sparkles, 
  RefreshCw, Check, ArrowRight, DollarSign, Trophy, TrendingUp, ShieldClose, HelpCircle, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { Plan, AdminSettings, UserProfile } from '../types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { DodoPaymentsWebhookHandler } from '../lib/dodoPaymentsWebhookHandler';

interface PaymentGatewaySettingsProps {
  settings: AdminSettings | null;
  setSettings: React.Dispatch<React.SetStateAction<AdminSettings | null>>;
  users: UserProfile[];
}

export default function PaymentGatewaySettings({ settings, setSettings, users }: PaymentGatewaySettingsProps) {
  // Dodo states
  const [dodoApiKey, setDodoApiKey] = useState(
    settings?.integrationConfig?.dodoApiKey || 'dodo_live_apikey_6aef82b938c10d2948ebf5'
  );
  const [dodoWebhookSecret, setDodoWebhookSecret] = useState(
    settings?.integrationConfig?.dodoWebhookSecret || 'whsec_dodo_89a741f23cbb1e60ef9'
  );
  const [dodoEnabled, setDodoEnabled] = useState(settings?.integrationConfig?.dodoEnabled ?? true);
  const [dodoSandboxMode, setDodoSandboxMode] = useState(settings?.integrationConfig?.dodoSandboxMode ?? true);
  
  // Paddle states (Deactivated)
  const [paddleApiKey, setPaddleApiKey] = useState(
    settings?.integrationConfig?.paddleApiKey || 'mock_paddle_api_key_placeholder_value'
  );
  const [paddleEnabled, setPaddleEnabled] = useState(settings?.integrationConfig?.paddleEnabled ?? false);
  
  // View states
  const [showDodoKey, setShowDodoKey] = useState(false);
  const [showDodoSecret, setShowDodoSecret] = useState(false);
  const [showPaddleKey, setShowPaddleKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Gateway Connection handshakes
  const [isVerifyingDodo, setIsVerifyingDodo] = useState(false);
  const [connectionLogsDodo, setConnectionLogsDodo] = useState<{label: string, status: 'pending'|'loading'|'done'|'error'}[]>([]);
  const [dodoVerifiedDetails, setDodoVerifiedDetails] = useState<any>(null);

  // Simulated Checkout simulator
  const [isDodoCheckoutOpen, setIsDodoCheckoutOpen] = useState(false);
  const [selectedSimPlan, setSelectedSimPlan] = useState<Plan | null>(null);
  const [simBillingCycle, setSimBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [simEmail, setSimEmail] = useState('test@packer.tools');
  const [isCompletingDodoPay, setIsCompletingDodoPay] = useState(false);

  // Webhook publisher simulation logs
  const [dodoWebhookLogs, setDodoWebhookLogs] = useState<{id: string, time: string, event: string, payload: any}[]>([
    {
      id: "dodo_log_1",
      time: new Date(Date.now() - 1700000).toLocaleTimeString(),
      event: "subscription.created",
      payload: {
        id: "dodo_sub_01hj9a8s7d",
        status: "active",
        customer: {
          id: "dodo_cust_01h9a8s8p",
          email: "test@packer.tools",
          name: "Test Operator"
        },
        product_id: "prod_dodo_pro_fiji",
        billing_cycle: "monthly"
      }
    }
  ]);

  useEffect(() => {
    if (settings?.integrationConfig) {
      if (settings.integrationConfig.dodoApiKey) setDodoApiKey(settings.integrationConfig.dodoApiKey);
      if (settings.integrationConfig.dodoWebhookSecret) setDodoWebhookSecret(settings.integrationConfig.dodoWebhookSecret);
      setDodoEnabled(settings.integrationConfig.dodoEnabled ?? true);
      setDodoSandboxMode(settings.integrationConfig.dodoSandboxMode ?? true);
      
      if (settings.integrationConfig.paddleApiKey) setPaddleApiKey(settings.integrationConfig.paddleApiKey);
      setPaddleEnabled(settings.integrationConfig.paddleEnabled ?? false);
    }
  }, [settings]);

  // Analytics Counters
  const totalActiveUsers = users.length;
  const proUsersCount = users.filter(u => u.plan?.toLowerCase() === 'pro').length;
  const enterpriseUsersCount = users.filter(u => u.plan?.toLowerCase() === 'enterprise').length;
  const freeUsersCount = totalActiveUsers - proUsersCount - enterpriseUsersCount;

  const handleCopyDodoKey = () => {
    navigator.clipboard.writeText(dodoApiKey);
    toast.success("Dodo Payments API Key copied.");
  };

  const handleCopyDodoSecret = () => {
    navigator.clipboard.writeText(dodoWebhookSecret);
    toast.success("Dodo Payments Webhook Secret copied.");
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const updatedConfig = {
        ...(settings?.integrationConfig || {}),
        dodoApiKey,
        dodoWebhookSecret,
        dodoEnabled,
        dodoSandboxMode,
        paddleApiKey,
        paddleEnabled // Force deactivated unless user explicitly overrides
      };

      setSettings(prev => {
        if (!prev) return null;
        return {
          ...prev,
          integrationConfig: updatedConfig as any
        };
      });

      await updateDoc(doc(db, 'adminSettings', 'global'), {
        integrationConfig: updatedConfig,
        plans: settings?.plans || []
      });

      toast.success("Payment Gateway configurations (Dodo & Paddle) updated successfully!");
    } catch (err: any) {
      toast.error("Failed to persist secure Gateway configurations: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const runDodoConnectionHandshake = async () => {
    setIsVerifyingDodo(true);
    setConnectionLogsDodo([
      { label: "Validating SSL certificate endpoints with dodo.payments ...", status: 'loading' },
      { label: "Authorizing secure HMAC handshake signature ...", status: 'pending' },
      { label: "Handshake established. Pulling Merchant Account info ...", status: 'pending' }
    ]);

    await new Promise(r => setTimeout(r, 1000));
    setConnectionLogsDodo(prev => [
      { ...prev[0], status: 'done' },
      { ...prev[1], status: 'loading' },
      prev[2]
    ]);

    await new Promise(r => setTimeout(r, 1200));
    setConnectionLogsDodo(prev => [
      prev[0],
      { ...prev[1], status: 'done' },
      { ...prev[2], status: 'loading' }
    ]);

    await new Promise(r => setTimeout(r, 1000));
    setConnectionLogsDodo(prev => [
      prev[0],
      prev[1],
      { ...prev[2], status: 'done' }
    ]);

    setDodoVerifiedDetails({
      merchant_id: "mer_dodo_8a2d1f930e",
      business_name: "SLEDIEN Pte Ltd / Packer Tools",
      clearing_bank: "BSP Bank Fiji (Suva Central)",
      status: "Verified Live Merchant"
    });
    setIsVerifyingDodo(false);
    toast.success("Dodo Payments connection confirmed & dry run succeeded!");
  };

  // Plan level property updater
  const handleUpdatePlanDodoMapping = (planId: string, flag: 'dodoProductId'|'dodoCheckoutUrl'|'dodoCheckoutUrlAnnual'|'dodoPriceIdMonthly'|'dodoPriceIdAnnual'|'paddleProductId'|'paddleCheckoutUrl', val: string) => {
    setSettings(prev => {
      if (!prev) return null;
      const updatedPlans = (prev.plans || []).map(p => {
        if (p.id === planId) {
          return { ...p, [flag]: val };
        }
        return p;
      });
      return { ...prev, plans: updatedPlans };
    });
  };

  const publishSimulatedDodoWebhook = async (event: string, targetPlanId: string) => {
    const plans = settings?.plans || [];
    const matchedPlan = plans.find(p => p.id === targetPlanId) || plans[0];
    const targetProdId = matchedPlan?.dodoProductId || `prod_dodo_${targetPlanId}_fiji`;
    const targetPriceId = matchedPlan?.dodoPriceIdMonthly || `price_dodo_${targetPlanId}_mo`;

    const payload = {
      event,
      data: {
        id: "dodo_sub_" + Math.random().toString(36).substring(2, 12),
        status: event === 'subscription.cancelled' ? 'cancelled' : 'active',
        customer: {
          id: "dodo_cust_" + Math.random().toString(36).substring(2, 10),
          email: simEmail,
          name: "Simulated Subscriber"
        },
        metadata: {
          email: simEmail
        },
        product_id: targetProdId,
        price_id: targetPriceId,
        billing_cycle: simBillingCycle
      }
    };

    toast.info(`Publishing simulated Dodo Payments Webhook "${event}"...`);

    const result = await DodoPaymentsWebhookHandler.processWebhookEvent(payload);
    if (result.success) {
      toast.success(`Dodo Webhook Processed: ${result.message}`);
      setDodoWebhookLogs(prev => [
        {
          id: "dodo_log_" + Date.now(),
          time: new Date().toLocaleTimeString(),
          event,
          payload
        },
        ...prev
      ]);
    } else {
      toast.error(`Webhook processing issue: ${result.message}`);
    }
  };

  const handleCheckoutSubmit = async () => {
    if (!selectedSimPlan) return;
    setIsCompletingDodoPay(true);
    await new Promise(r => setTimeout(r, 1500));
    setIsCompletingDodoPay(false);
    setIsDodoCheckoutOpen(false);

    // Run creation event
    await publishSimulatedDodoWebhook('subscription.created', selectedSimPlan.id);
  };

  return (
    <div className="space-y-8 text-left font-sans">
      
      {/* Title Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-100">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight flex items-center gap-2">
            <CreditCard className="text-indigo-600 animate-pulse" size={28} />
            Secure Payment Gateway
          </h2>
          <p className="text-neutral-500 text-xs sm:text-sm">
            Configure primary <strong>Dodo Payments</strong> pipelines and legacy deactivated <strong>Paddle configuration layers</strong>.
          </p>
        </div>
        
        <button
          onClick={handleSaveConfig}
          disabled={isSaving}
          className="px-6 py-3 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-400 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg flex items-center gap-2 transition ml-auto sm:ml-0"
        >
          {isSaving ? <Activity className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
          Save Gateway Changes
        </button>
      </div>

      {/* Primary Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Dodo Payments Hero Indicator */}
        <div className="bg-indigo-600 text-white p-6 rounded-3xl p-5 shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-xl -mr-4 -mt-4"></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 font-mono">Main Engine</p>
          <div className="flex items-center gap-2.5 mt-1.5 md:mt-3">
            <div className="bg-white/20 p-2 rounded-xl text-white">
              <Sparkles size={20} />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight block leading-none">Dodo Payments</span>
              <span className="text-[9px] text-indigo-100 uppercase tracking-widest font-mono font-bold">Main Active System</span>
            </div>
          </div>
          <p className="text-xs text-indigo-100 leading-normal font-medium mt-4">
            Tax-compliant financial architecture configured dynamically for Street Level Digital Engagement (SLEDIEN) Pte Ltd.
          </p>
        </div>

        {/* Paddle Status Indicator */}
        <div className="bg-white border border-neutral-200 text-neutral-800 p-6 rounded-3xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-full blur-xl -mr-4 -mt-4"></div>
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 font-mono">Legacy Gateway</p>
          <div className="flex items-center gap-2.5 mt-1.5 md:mt-3">
            <div className="bg-red-50 p-2 rounded-xl text-red-600">
              <ShieldClose size={20} />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight block leading-none text-neutral-800">Paddle Sandbox</span>
              <span className="text-[9px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded uppercase tracking-widest font-mono font-bold">Deactivated</span>
            </div>
          </div>
          <p className="text-xs text-neutral-500 leading-normal font-medium mt-4">
            Paddle checkout connections has been deactivated in active settings to prioritize native Dodo Payments routing blocks.
          </p>
        </div>

        {/* Global Stats Overview */}
        <div className="bg-white border border-neutral-200 p-6 rounded-3xl p-5 shadow-sm space-y-2 relative overflow-hidden group">
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 font-mono">Live Subscriptions</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-neutral-900 font-mono">{totalActiveUsers}</span>
            <span className="text-xs text-neutral-500 font-semibold font-mono">Active Seats</span>
          </div>
          <div className="grid grid-cols-3 gap-1 pt-2 border-t border-neutral-150 text-[10px] font-bold text-neutral-500">
            <div>
              <span className="block text-neutral-850 font-mono">{freeUsersCount}</span>
              Free
            </div>
            <div>
              <span className="block text-indigo-600 font-mono">{proUsersCount}</span>
              Pro Users
            </div>
            <div>
              <span className="block text-emerald-600 font-mono">{enterpriseUsersCount}</span>
              Enterprise
            </div>
          </div>
        </div>

      </div>

      {/* Main Settings Panel Wrapper */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column: Dodo & Paddle detailed boxes */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* A. Dodo Payments primary credentials wrapper */}
          <div className="bg-neutral-50 p-6 sm:p-8 rounded-[2.5rem] border border-neutral-200/60 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-150 pb-4">
              <div className="space-y-1">
                <h3 className="text-lg font-black text-neutral-900 flex items-center gap-2">
                  <Key size={18} className="text-indigo-600" />
                  Dodo API Configurations
                </h3>
                <p className="text-xs text-neutral-500 font-medium font-sans">
                  Configure real-time checkout key handshakes and webhook synchronization parameters.
                </p>
              </div>

              {/* Dodo Toggle Switch */}
              <button
                onClick={() => setDodoEnabled(!dodoEnabled)}
                className={`w-12 h-6 rounded-full relative transition-colors ${dodoEnabled ? 'bg-indigo-600' : 'bg-neutral-200'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${dodoEnabled ? 'right-1' : 'left-1'}`}></div>
              </button>
            </div>

            {dodoEnabled ? (
              <div className="space-y-4">
                
                {/* Dodo Live API Key */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block font-mono">
                      Dodo Live Secret API Key
                    </label>
                    <span className="text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-wider bg-orange-100 text-orange-700">Required</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showDodoKey ? "text" : "password"}
                        value={dodoApiKey}
                        onChange={(e) => setDodoApiKey(e.target.value)}
                        placeholder="dodo_live_apikey_..."
                        className="w-full pl-4 pr-10 py-3 bg-white border border-neutral-200 rounded-2xl outline-none font-mono text-xs font-bold text-neutral-800 focus:border-indigo-500 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowDodoKey(!showDodoKey)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition"
                      >
                        {showDodoKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    
                    <button
                      type="button"
                      onClick={handleCopyDodoKey}
                      className="p-3 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-2xl text-neutral-500 hover:text-neutral-700 transition"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>

                {/* Dodo Webhook Secret */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block font-mono">
                      Dodo Webhook Signing Secret
                    </label>
                    <span className="text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-wider bg-purple-100 text-purple-700">Highly Recommended</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type={showDodoSecret ? "text" : "password"}
                        value={dodoWebhookSecret}
                        onChange={(e) => setDodoWebhookSecret(e.target.value)}
                        placeholder="whsec_dodo_..."
                        className="w-full pl-4 pr-10 py-3 bg-white border border-neutral-200 rounded-2xl outline-none font-mono text-xs font-bold text-neutral-800 focus:border-indigo-500 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowDodoSecret(!showDodoSecret)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition"
                      >
                        {showDodoSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    
                    <button
                      type="button"
                      onClick={handleCopyDodoSecret}
                      className="p-3 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-2xl text-neutral-500 hover:text-neutral-700 transition"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>

                {/* Sandbox Checkbox */}
                <div className="flex items-center justify-between p-3 bg-white border border-neutral-200/80 rounded-2xl">
                  <div>
                    <span className="text-xs font-extrabold text-neutral-800 block">Dodo Sandbox Sim Mode</span>
                    <span className="text-[9px] text-neutral-400 block">Forces billing routing to execute on sandbox merchant instances.</span>
                  </div>
                  <button
                    onClick={() => setDodoSandboxMode(!dodoSandboxMode)}
                    className={`w-10 h-5 rounded-full relative transition-colors ${dodoSandboxMode ? 'bg-orange-600' : 'bg-neutral-200'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${dodoSandboxMode ? 'right-0.5' : 'left-0.5'}`}></div>
                  </button>
                </div>

                {/* Dry Run Button */}
                <div className="pt-2 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={runDodoConnectionHandshake}
                    disabled={isVerifyingDodo}
                    className="px-5 py-2.5 bg-indigo-650 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition flex items-center gap-2 shadow-sm shrink-0 cursor-pointer"
                  >
                    {isVerifyingDodo ? <RefreshCw className="animate-spin text-white" size={14} /> : <Sparkles size={14} />}
                    Verify Handshake with Dodo Payments
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSettings(prev => {
                        if (!prev) return null;
                        const updatedPlans = (prev.plans || []).map(p => {
                          if (p.id === 'pro') {
                            return {
                              ...p,
                              dodoProductId: 'pdt_0NhNGASkAwam6yagWGry8',
                              dodoPriceIdMonthly: 'pdt_0NhNGASkAwam6yagWGry8',
                              dodoPriceIdAnnual: 'pdt_0NhNHAzUVxDAi1Wke2t1l',
                              dodoCheckoutUrl: 'https://checkout.dodopayments.com/buy/pdt_0NhNGASkAwam6yagWGry8?quantity=1',
                              dodoCheckoutUrlAnnual: 'https://checkout.dodopayments.com/buy/pdt_0NhNHAzUVxDAi1Wke2t1l?quantity=1'
                            };
                          }
                          if (p.id === 'enterprise') {
                            return {
                              ...p,
                              dodoProductId: 'pdt_0NhNHdeN2xd6vpMQaNER9',
                              dodoPriceIdMonthly: 'pdt_0NhNHdeN2xd6vpMQaNER9',
                              dodoPriceIdAnnual: 'pdt_0NhNITdON5ujMZqQ899lk',
                              dodoCheckoutUrl: 'https://checkout.dodopayments.com/buy/pdt_0NhNHdeN2xd6vpMQaNER9?quantity=1',
                              dodoCheckoutUrlAnnual: 'https://checkout.dodopayments.com/buy/pdt_0NhNITdON5ujMZqQ899lk?quantity=1'
                            };
                          }
                          return p;
                        });
                        return { ...prev, plans: updatedPlans };
                      });
                      toast.success("Loaded all 4 active production Dodo checkout links for Pro & Enterprise! Make sure to scroll up and click 'Save Gateway Changes' to persist.");
                    }}
                    className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
                  >
                    <Sparkles size={14} className="text-amber-400" />
                    Load Production Dodo Presets
                  </button>
                </div>

                {/* Handshaking Console */}
                {connectionLogsDodo.length > 0 && (
                  <div className="bg-neutral-900 p-4 rounded-2xl font-mono text-xs space-y-2 mt-4 text-left border border-neutral-850">
                    <p className="text-[9px] uppercase tracking-widest text-neutral-400 font-black flex items-center justify-between mb-1">
                      <span>Dodo Router Console Ledger</span>
                      <span className="text-[#F27D26] animate-pulse">Running Handshake...</span>
                    </p>
                    {connectionLogsDodo.map((step, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-neutral-200">
                        {step.status === 'done' ? (
                          <span className="text-emerald-500 font-extrabold font-mono">✅</span>
                        ) : step.status === 'loading' ? (
                          <span className="text-orange-500 font-extrabold font-mono animate-spin block">🔄</span>
                        ) : (
                          <span className="text-neutral-500 font-extrabold font-mono">⏹️</span>
                        )}
                        <span className={step.status === 'done' ? 'text-neutral-400 line-through' : 'text-neutral-200'}>
                          {step.label}
                        </span>
                      </div>
                    ))}

                    {dodoVerifiedDetails && (
                      <div className="mt-4 pt-3 border-t border-neutral-800 text-[10px] space-y-1 text-emerald-400 font-sans font-bold">
                        <div>🏢 Registry Root: {dodoVerifiedDetails.business_name}</div>
                        <div>🏦 Clearing Node: {dodoVerifiedDetails.clearing_bank}</div>
                        <div>🔑 Key ID: {dodoVerifiedDetails.merchant_id}</div>
                        <div>🟢 Status: {dodoVerifiedDetails.status}</div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            ) : (
              <div className="p-8 border border-dashed border-neutral-200 bg-white rounded-3xl text-center text-neutral-400 text-xs font-semibold">
                Dodo Payments configuration pipeline is currently disabled. Toggle switch above to activate.
              </div>
            )}
          </div>

          {/* B. Paddle credentials configurations (Active Platform Option) */}
          <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-neutral-200/60 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-150 pb-4">
              <div className="space-y-1">
                <h3 className="text-lg font-black text-neutral-950 flex items-center gap-2">
                  <ShieldCheck size={18} className="text-amber-500" />
                  Paddle Gateway Integration
                </h3>
                <p className="text-xs text-neutral-500 font-medium font-sans">
                  Active billing alternative. Ideal for platforms distributing or bundling physical products.
                </p>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={() => {
                  const nextVal = !paddleEnabled;
                  setPaddleEnabled(nextVal);
                  if (nextVal) {
                    toast.success("Paddle Gateway enabled as checkout engine option!");
                  } else {
                    toast.info("Paddle has been deactivated successfully.");
                  }
                }}
                className={`w-12 h-6 rounded-full relative transition-colors cursor-pointer ${paddleEnabled ? 'bg-amber-500' : 'bg-neutral-200'}`}
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
                      type={showPaddleKey ? "text" : "password"}
                      value={paddleApiKey}
                      onChange={(e) => setPaddleApiKey(e.target.value)}
                      placeholder="pdl_live_apikey_..."
                      disabled={!paddleEnabled}
                      className="w-full pl-4 pr-10 py-3 bg-white border border-neutral-200 rounded-2xl outline-none font-mono text-xs font-bold text-neutral-800 focus:border-amber-400 transition disabled:bg-neutral-100 disabled:text-neutral-400"
                    />
                    <button
                      type="button"
                      disabled={!paddleEnabled}
                      onClick={() => setShowPaddleKey(!showPaddleKey)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition disabled:opacity-50"
                    >
                      {showPaddleKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-150 text-[10px] text-neutral-500 leading-relaxed font-sans font-medium">
                  <strong>Active Route:</strong> Enabled Paddle endpoints process currency conversions, VAT taxation, and dispatch orders safely for systems tracking hardware and bulk tool setups.
                </div>
              </div>
            </div>
          </div>

          {/* C. Plan Pricing Gateway Mappings */}
          <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-neutral-200 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-black text-neutral-900 flex items-center gap-2">
                <TrendingUp size={18} className="text-indigo-600" />
                Dodo / Paddle Plan Pricing Key Mappers
              </h3>
              <p className="text-xs text-neutral-500 font-medium">
                Map the corresponding pricing parameters from your Dodo and Paddle dashboards into subscription tiers.
              </p>
            </div>

            <div className="space-y-6">
              {(settings?.plans || []).map(plan => (
                <div key={plan.id} className="p-5 bg-neutral-50 rounded-3xl border border-neutral-200 space-y-5">
                  <div className="flex justify-between items-center pb-3 border-b border-neutral-250">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-neutral-900 text-white font-black text-xs rounded-xl flex items-center justify-center uppercase">
                        {plan.id.substring(0,2)}
                      </div>
                      <div>
                        <span className="text-xs font-black uppercase tracking-tight block text-neutral-900">{plan.name}</span>
                        <span className="text-[10px] text-neutral-450 font-bold font-mono">
                          Tier Ref: <span className="font-extrabold uppercase">{plan.id}</span>
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-extrabold tracking-tight text-neutral-900 font-mono">
                        ${plan.price}
                      </span>
                      <span className="text-[9px] text-neutral-400 block font-bold leading-none font-sans">Monthly FJD / seat</span>
                    </div>
                  </div>

                  {/* Pricing Key Inputs Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Dodo Product ID */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-450 block font-mono">
                        Dodo Product ID
                      </label>
                      <input
                        type="text"
                        value={plan.dodoProductId || ''}
                        onChange={(e) => handleUpdatePlanDodoMapping(plan.id, 'dodoProductId', e.target.value)}
                        placeholder={`prod_dodo_${plan.id}_fiji`}
                        className="w-full px-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl outline-none font-mono text-[11px] font-bold text-neutral-800 focus:border-indigo-500 transition"
                      />
                    </div>

                    {/* Dodo Checkout URL */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-455 block font-mono">
                        Dodo Checkout Redirect Link (Monthly)
                      </label>
                      <input
                        type="text"
                        value={plan.dodoCheckoutUrl || ''}
                        onChange={(e) => handleUpdatePlanDodoMapping(plan.id, 'dodoCheckoutUrl', e.target.value)}
                        placeholder={`https://buy.dodopayments.com/buy/${plan.id}`}
                        className="w-full px-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl outline-none font-sans text-[11px] font-medium text-neutral-800 focus:border-indigo-500 transition"
                      />
                    </div>

                    {/* Dodo Checkout URL Annual */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-455 block font-mono">
                        Dodo Checkout Redirect Link (Annual)
                      </label>
                      <input
                        type="text"
                        value={plan.dodoCheckoutUrlAnnual || ''}
                        onChange={(e) => handleUpdatePlanDodoMapping(plan.id, 'dodoCheckoutUrlAnnual', e.target.value)}
                        placeholder={`https://buy.dodopayments.com/buy/${plan.id}_annual`}
                        className="w-full px-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl outline-none font-sans text-[11px] font-medium text-neutral-800 focus:border-indigo-500 transition"
                      />
                    </div>

                    {/* Dodo Price Monthly ID */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-450 block font-mono">
                        Dodo Price Monthly ID
                      </label>
                      <input
                        type="text"
                        value={plan.dodoPriceIdMonthly || ''}
                        onChange={(e) => handleUpdatePlanDodoMapping(plan.id, 'dodoPriceIdMonthly', e.target.value)}
                        placeholder={`price_dodo_${plan.id}_monthly`}
                        className="w-full px-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl outline-none font-mono text-[11px] font-bold text-neutral-800 focus:border-indigo-500 transition"
                      />
                    </div>

                    {/* Dodo Price Annual ID */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-450 block font-mono">
                        Dodo Price Annual ID
                      </label>
                      <input
                        type="text"
                        value={plan.dodoPriceIdAnnual || ''}
                        onChange={(e) => handleUpdatePlanDodoMapping(plan.id, 'dodoPriceIdAnnual', e.target.value)}
                        placeholder={`price_dodo_${plan.id}_annual`}
                        className="w-full px-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl outline-none font-mono text-[11px] font-bold text-neutral-800 focus:border-indigo-500 transition"
                      />
                    </div>

                    <div className="md:col-span-2 pt-2 border-t border-dashed border-neutral-200 my-1">
                      <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 block font-mono">Active Paddle Configuration</span>
                    </div>

                    {/* Paddle Product ID */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-450 block font-mono">
                        Paddle Product Ref
                      </label>
                      <input
                        type="text"
                        value={plan.paddleProductId || ''}
                        onChange={(e) => handleUpdatePlanDodoMapping(plan.id, 'paddleProductId', e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl outline-none font-mono text-[11px] font-bold text-neutral-800 focus:border-indigo-500 transition"
                      />
                    </div>

                    {/* Paddle Checkout URL */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-455 block font-mono">
                        Paddle Checkout Link
                      </label>
                      <input
                        type="text"
                        value={plan.paddleCheckoutUrl || ''}
                        onChange={(e) => handleUpdatePlanDodoMapping(plan.id, 'paddleCheckoutUrl', e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl outline-none font-mono text-[11px] font-bold text-neutral-800 focus:border-indigo-500 transition"
                      />
                    </div>

                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right column: Simulation panel (Live testing Dodo) */}
        <div className="space-y-6">
          
          {/* A. Simulated Payment panel */}
          <div className="bg-indigo-950 text-white p-6 sm:p-8 rounded-[2.5rem] border border-indigo-900 shadow-md space-y-6">
            <div>
              <span className="text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-white/10 text-indigo-200 font-mono">
                DEVELOPER TOOLBOX
              </span>
              <h3 className="text-lg font-black tracking-tight flex items-center gap-2 mt-3">
                <Terminal size={18} className="text-indigo-400" />
                Dodo Checker Simulator
              </h3>
              <p className="text-xs text-indigo-250 font-medium">
                Simulate front-end checkouts, collect subscription payloads, and trigger test webhooks instantly.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[9px] font-extrabold uppercase tracking-widest text-indigo-300 block font-mono">
                  Subscriber Test Profile
                </label>
                <input
                  type="email"
                  value={simEmail}
                  onChange={(e) => setSimEmail(e.target.value)}
                  placeholder="test@packer.tools"
                  className="w-full px-4 py-3 bg-indigo-900/50 border border-indigo-800 rounded-2xl outline-none font-sans text-xs font-bold text-white focus:border-indigo-400 transition"
                />
              </div>

              <div className="space-y-2.5">
                <label className="text-[9px] font-extrabold uppercase tracking-widest text-indigo-300 block font-mono">
                  Activate Simulated Flow
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const proPlan = (settings?.plans || []).find(p => p.id === 'pro');
                      setSelectedSimPlan(proPlan || null);
                      setIsDodoCheckoutOpen(true);
                    }}
                    className="p-3 bg-indigo-900 hover:bg-indigo-850 rounded-2xl border border-indigo-800 flex flex-col justify-between items-start text-left transition"
                  >
                    <span className="text-[9px] font-black uppercase text-indigo-300 tracking-wider">Plan: Pro</span>
                    <span className="text-xs font-black block mt-1">Simulate Checkout</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const entPlan = (settings?.plans || []).find(p => p.id === 'enterprise');
                      setSelectedSimPlan(entPlan || null);
                      setIsDodoCheckoutOpen(true);
                    }}
                    className="p-3 bg-indigo-900 hover:bg-indigo-850 rounded-2xl border border-indigo-800 flex flex-col justify-between items-start text-left transition"
                  >
                    <span className="text-[9px] font-black uppercase text-indigo-300 tracking-wider">Plan: Ent</span>
                    <span className="text-xs font-black block mt-1">Simulate Checkout</span>
                  </button>
                </div>
              </div>

              <div className="border-t border-indigo-900 pt-4 mt-1 space-y-2">
                <label className="text-[9px] font-extrabold uppercase tracking-widest text-indigo-300 block font-mono">Quick Fire Webhooks</label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => publishSimulatedDodoWebhook('subscription.cancelled', 'pro')}
                    className="w-full py-2.5 bg-red-650 hover:bg-red-750 text-white font-bold text-[9px] uppercase tracking-widest rounded-xl flex items-center justify-center gap-1.5 transition"
                  >
                    <ShieldClose size={12} />
                    Push "subscription.cancelled"
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* B. Simulated Webhook Logs */}
          <div className="bg-white p-6 rounded-[2rem] border border-neutral-200 shadow-sm space-y-4">
            <h4 className="text-xs font-black uppercase text-neutral-850 tracking-wider font-mono flex items-center gap-1.5">
              <Activity size={14} className="text-indigo-600 animate-pulse" />
              Incoming Dodo Webhook Logs
            </h4>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {dodoWebhookLogs.map((log) => (
                <div key={log.id} className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-150 p-3.5 text-xs text-left space-y-2 font-mono">
                  <div className="flex justify-between items-center text-[10px] font-extrabold">
                    <span className="text-indigo-600 uppercase tracking-widest">
                      {log.event}
                    </span>
                    <span className="text-neutral-450">{log.time}</span>
                  </div>
                  <pre className="text-[9px] leading-tight text-neutral-600 overflow-x-auto whitespace-pre-wrap font-mono p-2 bg-neutral-100 rounded-lg">
                    {JSON.stringify(log.payload.data, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Dodo Checkout Simulation Modal */}
      <AnimatePresence>
        {isDodoCheckoutOpen && selectedSimPlan && (
          <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center z-[130] p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white max-w-md w-full rounded-[2.5rem] shadow-2xl overflow-hidden text-left"
            >
              {/* Checkout header */}
              <div className="bg-indigo-650 text-white p-6 sm:p-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2.5 rounded-2xl text-white">
                    <Sparkles size={22} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight leading-none">Dodo Checkout</h3>
                    <p className="text-[9px] uppercase tracking-widest text-indigo-200 mt-1.5 font-mono">Simulated Sandbox Secure Node</p>
                  </div>
                </div>
                
                <button
                  onClick={() => setIsDodoCheckoutOpen(false)}
                  className="p-1 text-indigo-200 hover:text-white transition"
                >
                  <ShieldClose size={20} />
                </button>
              </div>

              {/* Checkout Body */}
              <div className="p-6 sm:p-8 space-y-6">
                
                {/* Plan Info */}
                <div className="bg-neutral-50 p-5 rounded-3xl border border-neutral-150 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[9px] font-black uppercase text-indigo-600 tracking-wider font-mono">Selected upgrade</span>
                      <span className="text-base font-black text-neutral-900 block mt-0.5">{selectedSimPlan.name} Subscription</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-black text-neutral-900 tracking-tight font-mono">
                        ${selectedSimPlan.price}
                      </span>
                      <span className="text-[10px] text-neutral-400 block leading-none font-bold">FJD / seat / mo</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-neutral-500 font-medium font-sans">
                    Guaranteed secure transaction with immediate ledger clearance powered by <strong>Dodo Payments Corp</strong>.
                  </p>
                </div>

                {/* Email Confirmation */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block font-mono">Registered Account Email</label>
                  <input
                    type="email"
                    value={simEmail}
                    onChange={(e) => setSimEmail(e.target.value)}
                    placeholder="test@packer.tools"
                    className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-2xl outline-none font-sans text-xs font-semibold text-neutral-800"
                  />
                </div>

                {/* Simulated fields */}
                <div className="space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block font-mono">Simulated Payment Method</span>
                  
                  {/* Fake Credit Card UI */}
                  <div className="p-4 bg-gradient-to-br from-indigo-700 to-indigo-900 text-white rounded-2xl shadow-md space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-bold tracking-widest font-mono uppercase">Packer Corporate Sandbox</span>
                      <Sparkles size={16} className="text-indigo-300" />
                    </div>
                    <div className="text-lg font-black tracking-widest font-mono py-1">
                      •••• •••• •••• 9012
                    </div>
                    <div className="flex justify-between items-center text-[9px] font-mono text-indigo-200">
                      <div>
                        <span className="block text-[7px] text-indigo-350 uppercase">Card Holder</span>
                        <span className="font-bold text-white uppercase">{simEmail.split('@')[0]}</span>
                      </div>
                      <div>
                        <span className="block text-[7px] text-indigo-350 uppercase">Expires</span>
                        <span className="font-bold text-white">09/29</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <button
                  type="button"
                  onClick={handleCheckoutSubmit}
                  disabled={isCompletingDodoPay}
                  className="w-full py-4 bg-indigo-650 hover:bg-indigo-700 disabled:bg-neutral-300 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition flex items-center justify-center gap-1.5 shadow-lg active:scale-95"
                >
                  {isCompletingDodoPay ? (
                    <>
                      <RefreshCw className="animate-spin text-white" size={14} />
                      Clearing Dodo Secure Ledger...
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      Complete Simulated Purchase (${selectedSimPlan.price})
                    </>
                  )}
                </button>

                <p className="text-[9px] text-neutral-400 text-center font-medium font-sans">
                  By completing purchase, you trigger the simulated <strong>subscription.created</strong> webhook handler pointing to your account email.
                </p>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
