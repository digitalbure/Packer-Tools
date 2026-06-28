import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, signInWithGoogle } from '../firebase';
import { AdminSettings, Plan, UserProfile } from '../types';
import { motion } from 'motion/react';
import { Check, HelpCircle, ArrowLeft, ShieldCheck, Mail, RefreshCw, Sparkles, CreditCard, ExternalLink, HelpCircle as QuestionIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface PricesPageProps {
  user: UserProfile | null;
  onUpdateUser?: (user: UserProfile) => void;
  adminSettings: AdminSettings | null;
}

export default function PricesPage({ user, onUpdateUser, adminSettings }: PricesPageProps) {
  const [settings, setSettings] = useState<AdminSettings | null>(adminSettings);
  const [loading, setLoading] = useState(!adminSettings);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'adminSettings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as AdminSettings);
      }
      setLoading(false);
    }, (error) => {
      console.warn("PricesPage: Error loading global admin settings:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const plans = settings?.plans || [];

  // Fallback plans if none found or database not initialized
  const displayPlans: Plan[] = plans.length > 0 ? plans : [
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
      name: 'Professional', 
      price: 19, 
      annualPrice: 180,
      features: ['aiWizard', 'gearLibrary', 'reminders', 'versionHistory', 'qrSharing', 'toolingLists', 'organizer', 'travelCases', 'logisticsDashboard', 'movingDashboard', 'rackingDashboard', 'marketplace', 'kioskMode', 'inventoryManagement'], 
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
      features: ['aiWizard', 'gearLibrary', 'reminders', 'versionHistory', 'branding', 'qrSharing', 'toolingLists', 'organizer', 'travelCases', 'logisticsDashboard', 'movingDashboard', 'rackingDashboard', 'marketplace', 'kioskMode', 'orgManagement', 'departments', 'teams', 'inventoryManagement', 'rfidTracking'], 
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

  const handleCheckoutAction = (plan: Plan) => {
    if (plan.id === 'free') {
      if (!user) {
        toast.info("Please login first to activate your Free Starter plan.");
        signInWithGoogle();
        return;
      }
      toast.success("You are on the Free plan. Explore your workspace!");
      navigate('/dashboard');
      return;
    }

    // Active Paddle parameters
    const paddleUrl = billingCycle === 'annual' 
      ? (plan.paddleCheckoutUrl || plan.paddlePriceIdAnnual ? `https://checkout.packer.tools/buy/${plan.paddlePriceIdAnnual || plan.id}` : null)
      : (plan.paddleCheckoutUrl || plan.paddlePriceIdMonthly ? `https://checkout.packer.tools/buy/${plan.paddlePriceIdMonthly || plan.id}` : null);

    const directCheckoutLink = plan.paddleCheckoutUrl || paddleUrl;

    if (directCheckoutLink) {
      toast.info(`Redirecting you to Paddle Secure Checkout for ${plan.name}...`);
      window.open(directCheckoutLink, '_blank', 'noopener,noreferrer');
    } else {
      // General handler redirecting to billing dashboard settings inside user profile
      if (!user) {
        toast.info("Please sign in to select a plan & complete secure checkout.");
        signInWithGoogle();
        return;
      }
      toast.info(`Opening secure checkout modal inside your profile settings...`);
      navigate('/profile?tab=billing');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="animate-spin text-[#ff4f3a]" size={36} />
          <p className="text-xs font-mono uppercase tracking-widest text-neutral-400 font-bold">Synchronizing plan tiers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 py-16 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-16">
        
        {/* Navigation back and header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-neutral-200/60 pb-8">
          <div className="space-y-2">
            <Link 
              to="/" 
              className="inline-flex items-center gap-2 text-neutral-400 hover:text-neutral-900 transition group mb-2"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
              <span className="font-extrabold uppercase text-[10px] tracking-wider font-mono">Back to Home</span>
            </Link>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight uppercase text-neutral-900">
              Workspace Pricing Plan Tiers
            </h1>
            <p className="text-sm font-semibold text-neutral-500 max-w-2xl leading-relaxed">
              Transparent, scalable plans for camera logistics, heavy operations, AV rigging, and live sports setups. All processing managed securely by Paddle.
            </p>
          </div>

          {/* Monthly / Annual Toggle */}
          <div className="flex items-center gap-3 bg-neutral-200/60 p-1.5 rounded-2xl self-start md:self-center shrink-0 shadow-inner border border-neutral-300/30">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-wider ${
                billingCycle === 'monthly'
                  ? 'bg-accent text-white shadow-md shadow-accent/20'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              Monthly Billing
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 uppercase tracking-wider ${
                billingCycle === 'annual'
                  ? 'bg-accent text-white shadow-md shadow-accent/20'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              Annual Billing
              <span className="bg-emerald-50 text-emerald-700 text-[9px] font-black px-1.5 py-0.5 rounded-md tracking-tight">SAVE 20%</span>
            </button>
          </div>
        </div>

        {/* Pricing Card Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch pt-4">
          {displayPlans.map((plan) => {
            const isPro = plan.id === 'pro';
            const isEnterprise = plan.id === 'enterprise';
            const priceVal = billingCycle === 'annual' && plan.annualPrice 
              ? Math.floor(plan.annualPrice / 12) 
              : plan.price;
            
            const totalAnnualVal = plan.annualPrice || (plan.price * 12);

            return (
              <motion.div
                key={plan.id}
                whileHover={{ y: -6 }}
                transition={{ duration: 0.2 }}
                className={`relative bg-white rounded-3xl p-8 border hover:shadow-xl transition-all flex flex-col justify-between overflow-hidden ${
                  isPro 
                    ? 'border-neutral-900 ring-2 ring-neutral-900 ring-offset-2' 
                    : 'border-neutral-200'
                }`}
              >
                {/* Visual Accent Badge */}
                {isPro && (
                  <div className="absolute top-0 right-0 bg-neutral-900 text-white font-mono text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-2xl flex items-center gap-1">
                    <Sparkles size={10} className="text-amber-400" /> RECOMMENDED
                  </div>
                )}
                {isEnterprise && (
                  <div className="absolute top-0 right-0 bg-[#ff4f3a] text-white font-mono text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-bl-2xl">
                    TEAM CONTROL
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <h3 className="text-xs uppercase font-mono font-black text-neutral-400 tracking-widest">{plan.id} Tier</h3>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-neutral-900 mt-1">{plan.name}</h2>
                    <p className="text-xs text-neutral-500 font-semibold mt-2 leading-relaxed">
                      {plan.id === 'free' && 'Perfect to get a preview of smart checklists and local gear folders.'}
                      {plan.id === 'pro' && 'For commercial crews, cinematographers, builders, and active track operations.'}
                      {plan.id === 'enterprise' && 'Multi-dept organization workspaces, full custom branding, and heavy bulk rosters.'}
                    </p>
                  </div>

                  {/* Pricing block */}
                  <div className="py-2 border-y border-neutral-100 flex items-baseline gap-2">
                    <span className="text-5xl font-black tracking-tighter text-neutral-900">
                      ${priceVal}
                    </span>
                    <div className="text-left">
                      <span className="text-xs font-bold text-neutral-400 block uppercase tracking-wider">USD / Mo</span>
                      {plan.price > 0 && (
                        <span className="text-[10px] font-mono text-neutral-500 block leading-tight font-bold">
                          {billingCycle === 'annual' ? `Billed annually ($${totalAnnualVal}/yr)` : `Billed monthly`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Limits and quotas */}
                  <div className="space-y-1 bg-neutral-50/60 p-4 rounded-2xl border border-neutral-200/50">
                    <span className="text-[9px] font-mono font-black text-neutral-400 uppercase tracking-widest block mb-2">Workspace Quotas</span>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] font-semibold text-neutral-600">
                      <div>📁 Gear Items: <span className="font-mono font-bold text-neutral-900">{plan.maxGearItems === 100000 ? 'Unlimited' : plan.maxGearItems}</span></div>
                      <div>📦 Packing Lists: <span className="font-mono font-bold text-neutral-900">{plan.maxPackingLists}</span></div>
                      <div>📍 Racks / Case grids: <span className="font-mono font-bold text-neutral-900">{plan.maxRacks}</span></div>
                      <div>📋 Inventory rows: <span className="font-mono font-bold text-neutral-900">{plan.maxInventoryItems}</span></div>
                      <div>🧠 AI Wizard Tokens: <span className="font-mono font-bold text-neutral-900">{plan.aiTokenLimit} / mo</span></div>
                      <div>👥 Roster Teams: <span className="font-mono font-bold text-neutral-900">{plan.maxTeams}</span></div>
                    </div>
                  </div>

                  {/* Features list */}
                  <div className="space-y-3 pt-2">
                    <span className="text-[9px] font-mono font-black text-neutral-400 uppercase tracking-widest block">Included Features</span>
                    <ul className="space-y-2.5">
                      {plan.features.slice(0, 7).map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-xs font-bold text-neutral-700">
                          <div className={`rounded-full p-0.5 mt-0.5 shrink-0 ${isPro ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'}`}>
                            <Check size={10} strokeWidth={3} />
                          </div>
                          <span>
                            {feat === 'aiWizard' && 'AI-Powered Smart Setup Generator'}
                            {feat === 'gearLibrary' && 'Primary Gear & Equipment Ledger'}
                            {feat === 'qrSharing' && 'Custom Barcode & PWA QR Scans'}
                            {feat === 'reminders' && 'Automated Maintenance Alerts'}
                            {feat === 'toolingLists' && 'Physical Tooling & Racks Checklist'}
                            {feat === 'organizer' && 'Virtual Case Space Packer'}
                            {feat === 'kioskMode' && 'Signature Kiosk Check-out Flow'}
                            {feat === 'inventoryManagement' && 'Master Operations Stock Inventory'}
                            {feat === 'logisticsDashboard' && 'Real-time Transport Logistics Map'}
                            {feat === 'orgManagement' && 'Enterprise Organization Accounts'}
                            {feat === 'branding' && 'Custom Tenant Company Logos'}
                            {feat !== 'aiWizard' && feat !== 'gearLibrary' && feat !== 'qrSharing' && feat !== 'reminders' && feat !== 'toolingLists' && feat !== 'organizer' && feat !== 'kioskMode' && feat !== 'inventoryManagement' && feat !== 'logisticsDashboard' && feat !== 'orgManagement' && feat !== 'branding' && feat}
                          </span>
                        </li>
                      ))}
                      {plan.features.length > 7 && (
                        <li className="text-[10px] font-bold text-neutral-400 italic pl-5 font-mono">
                          + {plan.features.length - 7} core productivity tools enabled
                        </li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Checkout CTA block */}
                <div className="pt-8">
                  <button
                    onClick={() => handleCheckoutAction(plan)}
                    className={`w-full py-4 text-xs font-bold uppercase tracking-widest rounded-2xl transition cursor-pointer active:scale-98 select-none ${
                      isPro 
                        ? 'bg-neutral-900 hover:bg-neutral-850 text-white shadow-md' 
                        : 'bg-neutral-150 hover:bg-neutral-200 text-neutral-800 border border-neutral-300/40'
                    }`}
                  >
                    {plan.id === 'free' ? 'Activate Standard Starter' : 'Unlock Pro Workspace with Paddle'}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Feature Comparison Matrix */}
        <div className="bg-white border border-neutral-200 rounded-3xl overflow-hidden shadow-sm pt-8">
          <div className="px-8 pb-6 border-b border-neutral-150">
            <h2 className="text-xl font-black uppercase tracking-tight text-neutral-900">Compare Workspace Plan Limits</h2>
            <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wider mt-1">Detailed directory of active boundaries per seat subscription.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans border-collapse">
              <thead>
                <tr className="bg-neutral-50 font-mono text-[9px] uppercase font-black text-neutral-400 border-b border-neutral-150">
                  <th className="py-4 px-8 font-semibold">Workspace Metrics</th>
                  <th className="py-4 px-8 font-semibold">Free Starter</th>
                  <th className="py-4 px-8 font-semibold">Pro Active</th>
                  <th className="py-4 px-8 font-semibold">Enterprise Scale</th>
                </tr>
              </thead>
              <tbody className="text-xs font-bold divide-y divide-neutral-100 text-neutral-700">
                <tr>
                  <td className="py-4 px-8 text-neutral-900">Equipment Catalog Quota</td>
                  <td className="py-4 px-8 font-mono">25 items max</td>
                  <td className="py-4 px-8 font-mono text-neutral-900">500 items max</td>
                  <td className="py-4 px-8 font-mono text-neutral-900">10,000 items max</td>
                </tr>
                <tr>
                  <td className="py-4 px-8 text-neutral-900">Logistics Packing Lists</td>
                  <td className="py-4 px-8 font-mono">3 checklists max</td>
                  <td className="py-4 px-8 font-mono text-neutral-900">50 checklists max</td>
                  <td className="py-4 px-8 font-mono text-neutral-900">1,000 checklists max</td>
                </tr>
                <tr>
                  <td className="py-4 px-8 text-neutral-900">Racks & Travel Case Spaces</td>
                  <td className="py-4 px-8 font-mono">1 rack max</td>
                  <td className="py-4 px-8 font-mono text-neutral-900">10 racks max</td>
                  <td className="py-4 px-8 font-mono text-neutral-900">100 racks max</td>
                </tr>
                <tr>
                  <td className="py-4 px-8 text-neutral-900">Operations Stock Inventory</td>
                  <td className="py-4 px-8 font-mono">10 item rows max</td>
                  <td className="py-4 px-8 font-mono text-neutral-900">1,000 item rows max</td>
                  <td className="py-4 px-8 font-mono text-neutral-900">100,000 item rows max</td>
                </tr>
                <tr>
                  <td className="py-4 px-8 text-neutral-900">Global Roster team size</td>
                  <td className="py-4 px-8 font-mono">1 Team Account</td>
                  <td className="py-4 px-8 font-mono text-neutral-900">50 Roster Teams</td>
                  <td className="py-4 px-8 font-mono text-neutral-900">1,000 Roster Teams</td>
                </tr>
                <tr>
                  <td className="py-4 px-8 text-neutral-900">Secure Signature Kiosk Mode</td>
                  <td className="py-4 px-8 text-red-500 font-mono">X - Blocked</td>
                  <td className="py-4 px-8 text-[#ff4f3a] font-semibold">✓ Supported via PWA</td>
                  <td className="py-4 px-8 text-[#ff4f3a] font-semibold">✓ Supported via PWA</td>
                </tr>
                <tr>
                  <td className="py-4 px-8 text-neutral-900">Custom Organization Hierarchies</td>
                  <td className="py-4 px-8 text-red-500 font-mono">X - Blocked</td>
                  <td className="py-4 px-8 text-red-500 font-mono">X - Blocked</td>
                  <td className="py-4 px-8 text-[#ff4f3a] font-semibold">✓ Multi-Organization accounts</td>
                </tr>
                <tr>
                  <td className="py-4 px-8 text-neutral-900">Custom Portal Branding & CSS Logos</td>
                  <td className="py-4 px-8 text-red-500 font-mono">X - Blocked</td>
                  <td className="py-4 px-8 text-red-500 font-mono">X - Blocked</td>
                  <td className="py-4 px-8 text-[#ff4f3a] font-semibold">✓ Fully customizable branding</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
          <div className="space-y-4">
            <h3 className="text-xs uppercase font-mono font-black text-[#ff4f3a] tracking-widest flex items-center gap-2">
              <QuestionIcon size={14} /> Paddle Frequently Asked Questions
            </h3>
            <h2 className="text-2xl font-black uppercase tracking-tight text-neutral-900">
              Clear & Honest Solutions
            </h2>
            <p className="text-xs text-neutral-500 leading-relaxed font-semibold">
              Read our direct instructions regarding active payments coverage, subscription terms, VAT/Tax calculations, invoice downloads, and support channels.
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-1.5">
              <h4 className="text-sm font-extrabold uppercase tracking-tight text-neutral-800">Who processes my payments?</h4>
              <p className="text-xs text-neutral-550 leading-relaxed font-semibold">
                All transactions are processed securely via our payment processor and Merchant of Record, <strong>Paddle</strong>. Paddle handles global billing compliance, secure encryption, active VAT/Fiji taxation rules, and transactional receipts.
              </p>
            </div>
            
            <div className="space-y-1.5">
              <h4 className="text-sm font-extrabold uppercase tracking-tight text-neutral-800">Can I request a full refund?</h4>
              <p className="text-xs text-neutral-550 leading-relaxed font-semibold">
                Yes! We offer a standard 14-day hassle-free refund window. If you wish to cancel and request a return on subscription costs, please email us directly at <strong>support@packer.tools</strong>, referencing your original Paddle invoice ID.
              </p>
            </div>

            <div className="space-y-1.5">
              <h4 className="text-sm font-extrabold uppercase tracking-tight text-neutral-800">How do physical products relate to Packer Tools?</h4>
              <p className="text-xs text-neutral-550 leading-relaxed font-semibold">
                Our workspace allows rental pool dispatchers to map barcode tracking tags and case organizers. While we assist in organizing storage containers and gear kits internally, our main direct platform bills are for visual seat management tools (monthly and annual software plans).
              </p>
            </div>
          </div>
        </div>

        {/* Merchant & Compliance Information Drawer Banner */}
        <div className="bg-neutral-900 text-white rounded-3xl p-8 relative overflow-hidden space-y-6 border border-neutral-800">
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-2xl -mr-12 -mt-12"></div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="bg-neutral-800 text-xs font-mono font-black uppercase text-[#ff4f3a] tracking-widest px-3 py-1 rounded-xl w-fit flex items-center gap-1.5">
                <ShieldCheck size={12} /> SECURE MERCHANT PORTAL
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight">Standard Billing Compliance</h3>
              <p className="text-xs text-neutral-400 font-semibold max-w-2xl leading-relaxed">
                Packer Tools is a dynamic logistics platform engineered by <strong>Digital Bure</strong> (digitalbure.com) and owned by <strong>Street Level Digital Engagement (SLEDIEN) Pte Ltd</strong>, registration country fiji. All credit card details are encrypted via premium bank interfaces. We never store raw card numbers.
              </p>
            </div>

            <div className="shrink-0 space-y-2.5">
              <a
                href="mailto:support@packer.tools"
                className="flex items-center justify-center gap-2 px-5 py-3 h-12 bg-[#ff4f3a] hover:bg-[#e0402c] text-white rounded-xl uppercase tracking-widest font-mono text-[10px] font-black transition active:scale-95 cursor-pointer shadow-md"
              >
                <Mail size={14} /> support@packer.tools
              </a>
              <div className="text-[9px] text-neutral-400 font-mono text-center md:text-right font-bold uppercase tracking-wider">
                Support response &lt; 24h
              </div>
            </div>
          </div>

          {/* Legal references required by Paddle */}
          <div className="pt-6 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-4 text-[10px] font-mono text-neutral-500 font-bold">
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/pg/privacy-policy" className="hover:text-white transition uppercase">Privacy Policy</Link>
              <span>&bull;</span>
              <Link to="/pg/terms-of-service" className="hover:text-white transition uppercase">Terms & Conditions</Link>
              <span>&bull;</span>
              <Link to="/pg/refund-policy" className="hover:text-white transition uppercase">Refund Terms</Link>
            </div>

            <div>
              Fiji Reg: 8 Kukusau Road, Nasinu, Fiji
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
