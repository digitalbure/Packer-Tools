import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, writeBatch, doc } from 'firebase/firestore';
import { 
  Zap, ChevronRight, ChevronLeft, Loader2, Package, Check, Sparkles, 
  Info, Battery, Shield, CloudRain, MapPin, DollarSign, Camera, 
  Clock, Briefcase, TrendingUp, HelpCircle, FileText, ArrowRight, 
  Layers, CheckCircle2, Coins, Calendar, HelpCircle as TipIcon 
} from 'lucide-react';
import { db } from '../firebase';
import { UserProfile, PackingList, GearItem, AdminSettings } from '../types';
import { toast } from 'sonner';
import { canUseAI, trackAIUsage } from '../lib/limitUtils';
import { authenticatedFetch } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';

// Render appropriate icons for planning tips dynamically
const renderTipIcon = (iconName: string) => {
  const props = { className: "text-neutral-500 shrink-0", size: 20 };
  switch (iconName?.toLowerCase()) {
    case 'battery': return <Battery {...props} className="text-yellow-500" />;
    case 'shield': return <Shield {...props} className="text-emerald-500" />;
    case 'cloudrain': return <CloudRain {...props} className="text-blue-500" />;
    case 'mappin': return <MapPin {...props} className="text-red-500" />;
    case 'dollarsign': return <DollarSign {...props} className="text-green-500" />;
    case 'camera': return <Camera {...props} className="text-purple-500" />;
    default: return <TipIcon {...props} className="text-amber-500" />;
  }
};

export default function AITemplateWizard({ user, adminSettings }: { user: UserProfile, adminSettings: AdminSettings | null }) {
  const [step, setStep] = useState(1);
  const [activeResultsTab, setActiveResultsTab] = useState<'scope' | 'gear' | 'itinerary' | 'cost'>('scope');
  const [gearLibrary, setGearLibrary] = useState<GearItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Gig Assistant Inputs
  const [profile, setProfile] = useState<'family-picnic' | 'cinematic-documentary' | 'multi-day-filming' | 'broadcast' | 'custom'>('cinematic-documentary');
  const [scope, setScope] = useState('');
  const [duration, setDuration] = useState(3);
  const [expectations, setExpectations] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [includeTravel, setIncludeTravel] = useState(true);
  const [travelInfo, setTravelInfo] = useState('');
  const [includeCostBreakdown, setIncludeCostBreakdown] = useState(true);
  const [budget, setBudget] = useState('2500');
  const [currency, setCurrency] = useState('USD');
  const [matchGear, setMatchGear] = useState(true);

  // Generation Loading States
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState('');
  
  // Generated Results
  const [results, setResults] = useState<any | null>(null);
  const [selectedRecommendations, setSelectedRecommendations] = useState<Set<string>>(new Set());

  const navigate = useNavigate();

  useEffect(() => {
    const fetchGear = async () => {
      try {
        const gearSnap = await getDocs(collection(db, 'users', user.uid, 'gearLibrary'));
        setGearLibrary(gearSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as GearItem)));
      } catch (err) {
        console.error("Failed to fetch gear library:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchGear();
  }, [user.uid]);

  // Loading animation simulation phase triggers
  useEffect(() => {
    if (!isGenerating) return;
    const phases = [
      "Securing satellite transit coordinates...",
      "Analyzing geographical meteorological profiles...",
      "Matching available kit telemetry from your inventory...",
      "Sourcing direct equipment rental rates...",
      "Calculating optimal safety margins & backup power capacities..."
    ];
    let index = 0;
    setLoadingPhase(phases[0]);
    const interval = setInterval(() => {
      index = (index + 1) % phases.length;
      setLoadingPhase(phases[index]);
    }, 2800);
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleGenerate = async () => {
    if (!scope.trim()) {
      toast.error("Please provide a description of the scope of work.");
      return;
    }

    const aiCheck = await canUseAI(user, adminSettings);
    if (!aiCheck.allowed) {
      toast.error(aiCheck.reason);
      return;
    }

    setIsGenerating(true);

    try {
      const response = await authenticatedFetch('/api/ai/gig-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          profile,
          scope,
          duration,
          expectations,
          deliverables,
          includeTravel,
          travelInfo,
          includeCostBreakdown,
          budget,
          currency,
          gearLibrary: matchGear ? gearLibrary : []
        })
      });

      const json = await response.json();
      if (json.status === 'success' && json.data) {
        setResults(json.data);
        await trackAIUsage(user.uid);
        
        // Auto-select all critical or matched items for the checklist converter
        const initialSelected = new Set<string>();
        json.data.gearChecklist?.forEach((cat: any) => {
          cat.items?.forEach((item: any) => {
            initialSelected.add(item.itemName);
          });
        });
        setSelectedRecommendations(initialSelected);
        
        setStep(5); // Transition to results workspace
        toast.success("Gig plan synthesized successfully!");
      } else {
        throw new Error(json.message || "Failed to parse assistant recommendations");
      }
    } catch (error) {
      console.error("Gig Assistant synthesization failed:", error);
      toast.error("Assistant encountered an error planning your gig. Check network coordinates.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateManifestFromRecommendations = async () => {
    if (!results) return;

    try {
      const selectedItemsToCreate: any[] = [];
      results.gearChecklist?.forEach((cat: any) => {
        cat.items?.forEach((item: any) => {
          if (selectedRecommendations.has(item.itemName)) {
            // Find matched gear item in library if any
            const matched = gearLibrary.find(g => g.id === item.matchedGearId);
            selectedItemsToCreate.push({
              name: item.itemName,
              category: cat.category || 'General',
              description: item.reasoning,
              matchedGear: matched || null
            });
          }
        });
      });

      if (selectedItemsToCreate.length === 0) {
        toast.error("Select at least one recommended item to build a manifest.");
        return;
      }

      toast.loading("Generating your live Packer Tools manifest...");

      const newListRef = await addDoc(collection(db, 'packingLists'), {
        ownerId: user.uid,
        name: `Manifest: ${scope.slice(0, 32)}${scope.length > 32 ? '...' : ''}`,
        description: `Synthesized by Gig Assistant. Duration: ${duration} Days. Scope: ${scope}`,
        isTemplate: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const batch = writeBatch(db);
      selectedItemsToCreate.forEach((item, index) => {
        const itemRef = doc(collection(db, 'packingLists', newListRef.id, 'items'));
        batch.set(itemRef, {
          listId: newListRef.id,
          name: item.name,
          category: item.category,
          photoUrls: item.matchedGear?.photoUrls || [],
          assetTag: item.matchedGear?.assetTag || 'N/A',
          status: 'pending',
          description: item.description,
          order: index,
          createdAt: new Date().toISOString()
        });
      });

      await batch.commit();
      toast.dismiss();
      toast.success("Packing manifest deployed successfully!");
      navigate(`/list/${newListRef.id}`);
    } catch (error) {
      console.error("Failed to deploy packing list:", error);
      toast.dismiss();
      toast.error("Failed to launch list manifest.");
    }
  };

  const toggleRecommendation = (itemName: string) => {
    const next = new Set(selectedRecommendations);
    if (next.has(itemName)) next.delete(itemName);
    else next.add(itemName);
    setSelectedRecommendations(next);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-48 gap-4 font-sans text-neutral-400">
        <Loader2 className="animate-spin text-neutral-900" size={36} />
        <p className="text-xs uppercase font-black tracking-widest text-neutral-500">Retrieving secure coordinates...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 font-sans">
      {/* HEADER SECTION */}
      <div className="mb-8 flex flex-col md:flex-row items-center justify-between gap-4 border-b border-neutral-100 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-neutral-900 text-white rounded-2.5xl shadow-md shrink-0">
            <Zap size={28} className="text-[#ff4f3a]" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tight text-neutral-900 uppercase">Gig Assistant</h1>
            <p className="text-xs text-neutral-500 font-medium italic">Intelligent scope planning, itinerary builders, real-world costing & inventory mapping.</p>
          </div>
        </div>

        {results && (
          <button
            onClick={() => {
              setResults(null);
              setStep(1);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-black uppercase tracking-wider rounded-xl transition"
          >
            <ChevronLeft size={16} />
            <span>Configure New Gig</span>
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {/* PROGRESSIVE SETUP BUILDER */}
        {step < 5 && !isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* LEFT 2 COLUMNS: PROGRESSIVE FORM PANELS */}
            <div className="lg:col-span-2 bg-white rounded-[2rem] border border-neutral-100 shadow-sm p-6 sm:p-8 space-y-8">
              {/* STAGES HEADER */}
              <div className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Calibration Progress</span>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4].map((i) => (
                    <div 
                      key={i} 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        step === i ? 'w-8 bg-neutral-900' : step > i ? 'w-4 bg-green-500' : 'w-2 bg-neutral-100'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* STEP 1: SCOPE & PROFILE */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <h2 className="text-xl font-black uppercase tracking-tight text-neutral-900">1. Gig Profile & Scope</h2>
                    <p className="text-xs text-neutral-500">Define the profile scale and duration metrics of this undertaking.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { id: 'cinematic-documentary', label: 'Cinematic Documentary', desc: '4K/8K film shoots, logs, interviews & rugged scenarios' },
                      { id: 'broadcast', label: 'Broadcast & Live-Stream', desc: 'Live event pipelines, multi-cam mixes & switchboards' },
                      { id: 'multi-day-filming', label: 'Multi-Country Expedition', desc: 'Custom international logistics, flight cases & carnet limits' },
                      { id: 'family-picnic', label: 'Picnic / Outdoor Recreation', desc: 'Outdoors, catering, transport, safety bags & power banks' },
                      { id: 'custom', label: 'Custom Operations Plan', desc: 'Define your unique project coordinates from scratch' }
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setProfile(p.id as any)}
                        className={`p-5 rounded-2xl border-2 text-left space-y-1.5 transition-all duration-200 ${
                          profile === p.id 
                            ? 'border-neutral-950 bg-neutral-950/5 shadow-sm' 
                            : 'border-neutral-100 hover:border-neutral-200'
                        }`}
                      >
                        <h4 className="font-extrabold text-xs uppercase text-neutral-800 flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${profile === p.id ? 'bg-[#ff4f3a]' : 'bg-neutral-200'}`} />
                          {p.label}
                        </h4>
                        <p className="text-[10px] text-neutral-500 leading-normal font-medium">{p.desc}</p>
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="sm:col-span-2 space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">Brief Working Scope Title</label>
                      <input
                        type="text"
                        value={scope}
                        onChange={(e) => setScope(e.target.value)}
                        placeholder="e.g. Shooting drone footage of the Swiss Alps for series pilot..."
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-neutral-900 transition"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">Duration (Days)</label>
                      <div className="flex items-center gap-3">
                        <button 
                          type="button"
                          onClick={() => setDuration(Math.max(1, duration - 1))}
                          className="w-10 h-10 border border-neutral-200 hover:border-neutral-400 rounded-xl text-xs font-black flex items-center justify-center transition"
                        >
                          -
                        </button>
                        <span className="flex-1 text-center font-extrabold text-sm text-neutral-800">{duration}</span>
                        <button 
                          type="button"
                          onClick={() => setDuration(duration + 1)}
                          className="w-10 h-10 border border-neutral-200 hover:border-neutral-400 rounded-xl text-xs font-black flex items-center justify-center transition"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!scope.trim()}
                    onClick={() => setStep(2)}
                    className="w-full py-3.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg hover:shadow-xl transition disabled:opacity-40"
                  >
                    Configure Expectations & Deliverables
                  </button>
                </div>
              )}

              {/* STEP 2: EXPECTATIONS & DELIVERABLES */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <button onClick={() => setStep(1)} className="flex items-center gap-1 text-neutral-400 hover:text-neutral-600 transition font-black text-[10px] uppercase tracking-widest mb-2">
                      <ChevronLeft size={12} />
                      <span>Back to Profile</span>
                    </button>
                    <h2 className="text-xl font-black uppercase tracking-tight text-neutral-900">2. Performance Objectives</h2>
                    <p className="text-xs text-neutral-500">Outline exact crew expectations and finalized deliverables for planning bounds.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">Crew / Scope Expectations</label>
                      <textarea
                        value={expectations}
                        onChange={(e) => setExpectations(e.target.value)}
                        placeholder="e.g. Arrive before sunrise, high-speed hiking to 2500m peaks, maintain strict cold-weather lithium-battery logs..."
                        rows={5}
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-neutral-900 transition resize-none leading-relaxed"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">End Deliverables</label>
                      <textarea
                        value={deliverables}
                        onChange={(e) => setDeliverables(e.target.value)}
                        placeholder="e.g. 10 hours raw log 4K ProRes footage on rugged SSD drives, three 30-sec social trailers, safety checkoff sheets..."
                        rows={5}
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-neutral-900 transition resize-none leading-relaxed"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="w-full py-3.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg hover:shadow-xl transition"
                  >
                    Continue to Travel & Budgets
                  </button>
                </div>
              )}

              {/* STEP 3: TRAVEL & FINANCES */}
              {step === 3 && (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <button onClick={() => setStep(2)} className="flex items-center gap-1 text-neutral-400 hover:text-neutral-600 transition font-black text-[10px] uppercase tracking-widest mb-2">
                      <ChevronLeft size={12} />
                      <span>Back to Objectives</span>
                    </button>
                    <h2 className="text-xl font-black uppercase tracking-tight text-neutral-900">3. Logistics & Financial Planning</h2>
                    <p className="text-xs text-neutral-500">Determine whether the assistant should research transit parameters and budget guestimates.</p>
                  </div>

                  {/* Travel Toggle & Info */}
                  <div className="p-5 rounded-2xl border border-neutral-150 bg-neutral-50/50 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="font-extrabold text-xs uppercase text-neutral-800 block">Activate Travel & Transit Router</span>
                        <span className="text-[10px] text-neutral-500 font-medium">Include day-by-day itineraries and logistical travel recommendations.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIncludeTravel(!includeTravel)}
                        className={`w-12 h-6 rounded-full transition-colors relative duration-200 ease-in-out shrink-0 outline-none ${
                          includeTravel ? 'bg-neutral-900' : 'bg-neutral-200'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all duration-200 ${
                          includeTravel ? 'left-[26px]' : 'left-0.5'
                        }`} />
                      </button>
                    </div>

                    {includeTravel && (
                      <div className="space-y-1.5 animate-in fade-in duration-200">
                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Transit Coordinates & Location Info</label>
                        <input
                          type="text"
                          value={travelInfo}
                          onChange={(e) => setTravelInfo(e.target.value)}
                          placeholder="e.g. Flight from London Heathrow to Geneva, standard hire van to Zermatt, mountain lifts..."
                          className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-neutral-900 transition"
                        />
                      </div>
                    )}
                  </div>

                  {/* Cost Toggle & Budget Info */}
                  <div className="p-5 rounded-2xl border border-neutral-150 bg-neutral-50/50 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="font-extrabold text-xs uppercase text-neutral-800 block">Include Financial Estimator & Costings</span>
                        <span className="text-[10px] text-neutral-500 font-medium">Predict real-world market costs of rentals, transit tariffs, per-diem.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIncludeCostBreakdown(!includeCostBreakdown)}
                        className={`w-12 h-6 rounded-full transition-colors relative duration-200 ease-in-out shrink-0 outline-none ${
                          includeCostBreakdown ? 'bg-neutral-900' : 'bg-neutral-200'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all duration-200 ${
                          includeCostBreakdown ? 'left-[26px]' : 'left-0.5'
                        }`} />
                      </button>
                    </div>

                    {includeCostBreakdown && (
                      <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-200">
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Target Budget Ceiling</label>
                          <input
                            type="number"
                            value={budget}
                            onChange={(e) => setBudget(e.target.value)}
                            placeholder="e.g. 5000"
                            className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-neutral-900 transition"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Currency Unit</label>
                          <select
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-neutral-900 transition"
                          >
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (€)</option>
                            <option value="GBP">GBP (£)</option>
                            <option value="CHF">CHF (Swiss Franc)</option>
                            <option value="AUD">AUD ($)</option>
                            <option value="JPY">JPY (¥)</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="w-full py-3.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg hover:shadow-xl transition"
                  >
                    Proceed to Inventory Mapping
                  </button>
                </div>
              )}

              {/* STEP 4: GEAR MAPPING & INVENTORY CONFIG */}
              {step === 4 && (
                <div className="space-y-6">
                  <div className="space-y-1">
                    <button onClick={() => setStep(3)} className="flex items-center gap-1 text-neutral-400 hover:text-neutral-600 transition font-black text-[10px] uppercase tracking-widest mb-2">
                      <ChevronLeft size={12} />
                      <span>Back to Finances</span>
                    </button>
                    <h2 className="text-xl font-black uppercase tracking-tight text-neutral-900">4. Inventory Core Sync</h2>
                    <p className="text-xs text-neutral-500">Cross-reference recommendations directly against actual workspace assets.</p>
                  </div>

                  <div className="p-5 rounded-2xl border border-neutral-150 bg-neutral-50/50 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="font-extrabold text-xs uppercase text-neutral-800 block">Map Recommendations to Live Library</span>
                        <span className="text-[10px] text-neutral-500 font-medium">
                          Fuzzy-search and matching against {gearLibrary.length} items in your actual gear database.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMatchGear(!matchGear)}
                        className={`w-12 h-6 rounded-full transition-colors relative duration-200 ease-in-out shrink-0 outline-none ${
                          matchGear ? 'bg-neutral-900' : 'bg-neutral-200'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all duration-200 ${
                          matchGear ? 'left-[26px]' : 'left-0.5'
                        }`} />
                      </button>
                    </div>

                    {matchGear && (
                      <div className="p-4 bg-white rounded-xl border border-neutral-200 text-xs text-neutral-500 font-medium space-y-1.5 animate-in fade-in duration-200 leading-relaxed font-sans">
                        <div className="flex items-center gap-1.5 text-neutral-800 font-bold mb-1 uppercase tracking-wider text-[10px]">
                          <Info size={12} />
                          <span>Fuzzy Sync Mode Active</span>
                        </div>
                        The assistant will scan names and categories within your gear database. Recommendations matching actual holdings will highlight with green flags, identifying immediate operational capabilities vs missing gaps.
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerate}
                    className="w-full py-4 bg-neutral-900 hover:bg-neutral-950 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg hover:shadow-xl transition flex items-center justify-center gap-2"
                  >
                    <Sparkles size={16} className="text-[#ff4f3a]" />
                    <span>Synthesize Gig Plan via AI</span>
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT SIDE PANEL: INTUITION CARD */}
            <div className="bg-neutral-950 text-white p-8 rounded-[2.5rem] flex flex-col justify-between shadow-lg space-y-12">
              <div className="space-y-6">
                <span className="px-3 py-1 bg-white/10 text-white/90 font-black text-[9px] uppercase tracking-widest rounded-full">
                  Elite Logistics Engine
                </span>
                
                <div className="space-y-2">
                  <h3 className="text-xl font-black uppercase tracking-tight">Gig Planning Assistant</h3>
                  <p className="text-neutral-400 text-xs leading-relaxed font-medium">
                    This assistant integrates deep reasoning algorithms with your actual warehouse inventory. By analyzing travel coordinates, weather patterns, per-diem metrics, and local safety rules, it structures professional briefs and custom checklists.
                  </p>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/10">
                  <div className="flex gap-3">
                    <div className="p-1.5 bg-white/10 rounded-lg self-start">
                      <Camera size={14} />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold uppercase text-neutral-300">Scalable Architecture</h5>
                      <p className="text-[10px] text-neutral-400 leading-normal">Plans anything from a local park barbecue up to a multi-camera broadcast across continents.</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="p-1.5 bg-white/10 rounded-lg self-start">
                      <Coins size={14} />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold uppercase text-neutral-300">Cost Calibration</h5>
                      <p className="text-[10px] text-neutral-400 leading-normal">Sources approximate operational rates for rental setups and incidentals in local currencies.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-neutral-500 font-mono italic">
                Powered by Gemini-3.5-Flash
              </div>
            </div>
          </motion.div>
        )}

        {/* LOADING SCREEN */}
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-white rounded-[2.5rem] border border-neutral-150 p-12 md:p-24 text-center space-y-8 flex flex-col items-center justify-center min-h-[500px]"
          >
            <div className="relative">
              <div className="w-20 h-20 bg-neutral-900 rounded-full flex items-center justify-center animate-pulse">
                <Sparkles size={36} className="text-[#ff4f3a] animate-spin" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-[10px] font-black uppercase">
                AI
              </div>
            </div>

            <div className="space-y-2 max-w-md mx-auto">
              <h3 className="text-2xl font-black uppercase tracking-tight text-neutral-900">Synthesizing Logistics Coordinates</h3>
              <p className="text-xs text-neutral-500 font-semibold italic min-h-[16px]">
                {loadingPhase}
              </p>
            </div>

            <div className="w-64 h-1 bg-neutral-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#ff4f3a] rounded-full animate-infinite-loading" style={{ width: '60%' }} />
            </div>
          </motion.div>
        )}

        {/* GENERATED RESULTS WORKSPACE */}
        {step === 5 && results && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-8"
          >
            {/* WORKSPACE LAYOUT GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              
              {/* LEFT 3 COLUMNS: MAIN WORKSPACE TABS */}
              <div className="lg:col-span-3 bg-white rounded-[2.5rem] border border-neutral-100 shadow-sm overflow-hidden flex flex-col h-[74vh]">
                
                {/* TABS SELECTOR STRIP */}
                <div className="bg-neutral-50/70 border-b border-neutral-100 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 font-sans">
                  <div className="flex gap-2">
                    {[
                      { id: 'scope', label: 'Logistical Scope', icon: <FileText size={14} /> },
                      { id: 'gear', label: 'Gear Recommendations', icon: <Camera size={14} /> },
                      { id: 'itinerary', label: 'Transit Itinerary', icon: <Calendar size={14} /> },
                      { id: 'cost', label: 'Cost Estimator', icon: <Coins size={14} /> }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveResultsTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                          activeResultsTab === tab.id 
                            ? 'bg-neutral-950 text-white shadow-sm' 
                            : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
                        }`}
                      >
                        {tab.icon}
                        <span>{tab.label}</span>
                      </button>
                    ))}
                  </div>

                  {activeResultsTab === 'gear' && (
                    <button
                      type="button"
                      onClick={handleCreateManifestFromRecommendations}
                      className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white hover:bg-neutral-800 rounded-xl text-xs font-black uppercase tracking-wider transition"
                    >
                      <Layers size={14} className="text-[#ff4f3a]" />
                      <span>Convert Selected to Manifest</span>
                    </button>
                  )}
                </div>

                {/* SCROLLABLE CONTENT CANVAS */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                  {/* TAB 1: LOGISTICAL ASSESSMENT MARKDOWN */}
                  {activeResultsTab === 'scope' && (
                    <div className="prose prose-neutral max-w-none text-neutral-800 text-xs leading-relaxed space-y-4 font-sans">
                      <div className="whitespace-pre-wrap leading-relaxed font-sans text-xs text-neutral-700 bg-neutral-50 border border-neutral-150 p-6 rounded-2xl">
                        {results.scopeAssessment}
                      </div>
                    </div>
                  )}

                  {/* TAB 2: RECOMMENDATIONS CHECKLIST */}
                  {activeResultsTab === 'gear' && (
                    <div className="space-y-6">
                      <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-150 text-xs text-neutral-500 font-semibold italic flex items-center justify-between">
                        <span>Check/uncheck recommended items to compile your finalized manifest setup.</span>
                        <span className="font-extrabold text-neutral-800 uppercase not-italic text-[10px]">
                          {selectedRecommendations.size} Items Selected
                        </span>
                      </div>

                      {results.gearChecklist?.map((cat: any, i: number) => (
                        <div key={i} className="space-y-3">
                          <h4 className="text-[11px] font-black uppercase tracking-widest text-neutral-400 border-b border-neutral-100 pb-1 pt-2">
                            {cat.category}
                          </h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {cat.items?.map((item: any, j: number) => {
                              const isSelected = selectedRecommendations.has(item.itemName);
                              const matchedItem = gearLibrary.find(g => g.id === item.matchedGearId);
                              return (
                                <div 
                                  key={j}
                                  onClick={() => toggleRecommendation(item.itemName)}
                                  className={`p-4 rounded-xl border-2 transition text-left cursor-pointer flex gap-3 ${
                                    isSelected 
                                      ? 'border-neutral-900 bg-neutral-50/40' 
                                      : 'border-neutral-100 hover:border-neutral-200 bg-white'
                                  }`}
                                >
                                  {/* Selection Circle */}
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition ${
                                    isSelected ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300'
                                  }`}>
                                    {isSelected && <Check size={12} />}
                                  </div>

                                  <div className="space-y-2 min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-2">
                                      <h5 className="font-extrabold text-xs text-neutral-800 leading-tight uppercase truncate">{item.itemName}</h5>
                                      {item.isEssential && (
                                        <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[8px] font-black uppercase tracking-wider shrink-0">
                                          Critical
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-neutral-500 leading-normal font-medium">{item.reasoning}</p>

                                    {/* Matches Indicators */}
                                    {matchedItem ? (
                                      <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 text-green-700 border border-green-150 rounded-lg text-[9px] font-bold">
                                        <CheckCircle2 size={10} className="shrink-0" />
                                        <span className="truncate">Matched: {matchedItem.name} ({matchedItem.assetTag})</span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1.5 px-2 py-1 bg-neutral-50 text-neutral-500 border border-neutral-200 rounded-lg text-[9px] font-medium">
                                        <Package size={10} className="shrink-0" />
                                        <span>Not in library (recommended purchase/rent)</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* TAB 3: TRAVEL ITINERARY TIMELINE */}
                  {activeResultsTab === 'itinerary' && (
                    <div className="space-y-6">
                      <div className="relative pl-6 border-l-2 border-neutral-100 space-y-8 font-sans">
                        {results.itinerary?.map((phase: any, i: number) => (
                          <div key={i} className="relative">
                            {/* Dot */}
                            <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white bg-neutral-900 flex items-center justify-center">
                              <div className="w-1.5 h-1.5 bg-white rounded-full" />
                            </div>

                            <div className="bg-neutral-50 border border-neutral-150 rounded-2xl p-5 space-y-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <h4 className="font-extrabold text-xs uppercase text-neutral-800 tracking-tight">{phase.phase}</h4>
                                <span className="px-2 py-0.5 bg-neutral-200 text-neutral-600 rounded text-[8px] font-black uppercase tracking-widest">
                                  Stage {i + 1}
                                </span>
                              </div>
                              <p className="text-xs font-bold text-neutral-700 leading-relaxed">{phase.activity}</p>
                              {phase.notes && (
                                <p className="text-[10px] text-neutral-500 font-medium bg-white px-3 py-1.5 rounded-lg border border-neutral-100 leading-normal">
                                  💡 {phase.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: FINANCIAL ESTIMATES */}
                  {activeResultsTab === 'cost' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
                        <div className="p-5 rounded-2xl bg-neutral-900 text-white space-y-1">
                          <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Target Budget</span>
                          <h3 className="text-xl font-black">{budget ? `${budget} ${currency}` : 'Flexible'}</h3>
                        </div>

                        <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-1">
                          <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Estimated Range Low</span>
                          <h3 className="text-xl font-black text-neutral-800">
                            {results.costBreakdown?.reduce((sum: number, c: any) => sum + (c.lowEstimate || 0), 0).toLocaleString()} {currency}
                          </h3>
                        </div>

                        <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-1">
                          <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Estimated Range High</span>
                          <h3 className="text-xl font-black text-neutral-800">
                            {results.costBreakdown?.reduce((sum: number, c: any) => sum + (c.highEstimate || 0), 0).toLocaleString()} {currency}
                          </h3>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-2xl border border-neutral-150">
                        <table className="w-full border-collapse text-left">
                          <thead>
                            <tr className="bg-neutral-50/50 border-b border-neutral-150 text-[10px] font-black uppercase tracking-widest text-neutral-400">
                              <th className="p-4">Category</th>
                              <th className="p-4">Expense Description</th>
                              <th className="p-4 text-right">Low Estimate</th>
                              <th className="p-4 text-right">High Estimate</th>
                              <th className="p-4">Sourcing / Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-100 text-xs">
                            {results.costBreakdown?.map((cost: any, i: number) => (
                              <tr key={i} className="hover:bg-neutral-50/20 font-sans">
                                <td className="p-4 font-black uppercase text-neutral-400 tracking-wider text-[9px] whitespace-nowrap">{cost.category}</td>
                                <td className="p-4 font-bold text-neutral-800">{cost.item}</td>
                                <td className="p-4 text-right font-semibold text-neutral-600">{cost.lowEstimate?.toLocaleString()} {currency}</td>
                                <td className="p-4 text-right font-bold text-neutral-800">{cost.highEstimate?.toLocaleString()} {currency}</td>
                                <td className="p-4 text-neutral-500 font-medium leading-normal max-w-xs">{cost.notes}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT SIDEBAR: EXPERT LOGISTICS TIPS */}
              <div className="bg-neutral-950 text-white rounded-[2.5rem] p-6 sm:p-8 space-y-6 flex flex-col justify-between">
                <div className="space-y-6">
                  <div className="space-y-1">
                    <span className="px-3 py-1 bg-white/10 text-white/90 font-black text-[9px] uppercase tracking-widest rounded-full">
                      Field Handbook
                    </span>
                    <h3 className="text-lg font-black uppercase tracking-tight pt-2">Researched Tips</h3>
                    <p className="text-[11px] text-neutral-400 leading-normal font-medium">Logistical and regulatory advice synthesized specifically for your gig profile scale.</p>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/10 font-sans">
                    {results.planningTips?.map((tip: any, i: number) => (
                      <div key={i} className="flex gap-3">
                        <div className="p-2 bg-white/10 rounded-xl self-start">
                          {renderTipIcon(tip.icon)}
                        </div>
                        <div className="space-y-1">
                          <h5 className="text-xs font-black uppercase text-neutral-200 tracking-wide leading-tight">{tip.title}</h5>
                          <p className="text-[10px] text-neutral-400 leading-relaxed font-medium">{tip.advice}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-white/10 text-[10px] font-mono text-neutral-500 flex justify-between items-center">
                  <span>Logistics Engine</span>
                  <span>v2.4 Live</span>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
