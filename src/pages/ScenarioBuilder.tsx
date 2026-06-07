import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, getDocs, addDoc, doc } from 'firebase/firestore';
import { 
  Sparkles, 
  ChevronRight, 
  Briefcase, 
  Package, 
  Check, 
  Trash2, 
  Plus, 
  Clock, 
  AlertTriangle,
  Flame,
  Wrench,
  Compass,
  ArrowRight,
  Info
} from 'lucide-react';
import { db } from '../firebase';
import { UserProfile, GearItem, AdminSettings } from '../types';
import { toast } from 'sonner';

interface ScenarioBuilderProps {
  user: UserProfile;
  adminSettings: AdminSettings | null;
}

interface RecommendedListItem {
  id: string; // client side temp ID
  name: string;
  category: string;
  reason: string;
  quantity: number;
  estimatedWeight?: number;
  weightUnit?: string;
  matchedGearId: string;
  included: boolean;
}

export default function ScenarioBuilder({ user, adminSettings }: ScenarioBuilderProps) {
  const navigate = useNavigate();
  const [brief, setBrief] = useState('');
  const [gearLibrary, setGearLibrary] = useState<GearItem[]>([]);
  const [loadingGear, setLoadingGear] = useState(true);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestedItems, setSuggestedItems] = useState<RecommendedListItem[]>([]);
  const [aiWarningMessage, setAiWarningMessage] = useState('');
  const [listsName, setListsName] = useState('My Custom Photography Gear List');
  const [listsDesc, setListsDesc] = useState('');

  // Sourced presets for simple click
  const PRESETS = [
    {
      title: "Solo Photo Shoot",
      desc: "Ideal for a single photographer, focusing on camera bodies, lens pairings, and backup batteries.",
      brief: "Solo photography session representing the photographer's workspace, focusing on high-end portraits, multiple prime/zoom lenses, speedlights, robust media storage, and sufficient battery buffers."
    },
    {
      title: "Indie Music Video",
      desc: "Medium sized shoot requiring stabilizers, monitors, multi-cams, lighting arrays, and lav mics.",
      brief: "Medium-sized video shoot for an indie acoustic/pop music video, requiring stabilization gimbal/gimbal support and high write-speed memory, main audio recorder, boom mic nodes, and continuous led key lights."
    },
    {
      title: "Wilderness 3-Day Expedition",
      desc: "Trekking checklist covering shelter setup, sleeping insulation gears, solar power backups.",
      brief: "Outdoor wilderness 3-day adventure hike crossing high-altitude areas with dynamic climate changes. Requires tent shelter, lightweight cooksets, insulated sleeping gear, rugged bags, and thermal layers."
    },
    {
      title: "Event Audio-Visual Set",
      desc: "Corporate seminar configurations: stage microphones, video monitors, mixers, and audio cords.",
      brief: "Banquet level corporate conference AV staging: requiring vocal handheld wireless transmitters, stage speakers, professional audio mixer nodes, cables, presentation clicker adapters, and adhesive tapes."
    }
  ];

  useEffect(() => {
    const fetchGear = async () => {
      try {
        const gearSnap = await getDocs(collection(db, 'users', user.uid, 'gearLibrary'));
        const gearData = gearSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as GearItem));
        setGearLibrary(gearData);
      } catch (err) {
        console.error("ScenarioBuilder: Error retrieving gear:", err);
        toast.error("Failed to load your Gear Library database.");
      } finally {
        setLoadingGear(false);
      }
    };
    fetchGear();
  }, [user.uid]);

  const handleSelectPreset = (pBrief: string, pTitle: string) => {
    setBrief(pBrief);
    setListsName(`Gig Packing: ${pTitle}`);
    setListsDesc(`Automatically built packlist tailored for: ${pTitle}`);
    toast.info(`Applied preset: ${pTitle}`);
  };

  const handleGenerateList = async () => {
    if (!brief.trim()) {
      toast.warning("Describe your customized scenario or select a preset first.");
      return;
    }

    setIsGenerating(true);
    setSuggestedItems([]);
    setAiWarningMessage('');

    try {
      const response = await fetch('/api/generate-scenario-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, gear: gearLibrary })
      });

      if (!response.ok) {
        throw new Error(`Server returned error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.aiWarning) {
        setAiWarningMessage(data.aiWarning);
      }

      const parsed: RecommendedListItem[] = (data.recommendedItems || []).map((item: any, i: number) => ({
        id: `rec_${Date.now()}_${i}`,
        name: item.name || '',
        category: item.category || 'Gear',
        reason: item.reason || 'Requested item matches the brief specifics.',
        quantity: typeof item.quantity === 'number' ? item.quantity : 1,
        estimatedWeight: item.estimatedWeight,
        weightUnit: item.weightUnit || 'g',
        matchedGearId: item.matchedGearId || '',
        included: true
      }));

      setSuggestedItems(parsed);
      toast.success("AI suggested packing list generated successfully!");
    } catch (err: any) {
      console.error("ScenarioBuilder API trigger failed:", err);
      toast.error("Process aborted. Sourced heuristic fallback offline suggestions.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleInclude = (itemId: string) => {
    setSuggestedItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, included: !item.included } : item
    ));
  };

  const handleUpdateItemValue = (itemId: string, field: keyof RecommendedListItem, val: any) => {
    setSuggestedItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, [field]: val } : item
    ));
  };

  const handleAddManualItem = () => {
    const newItem: RecommendedListItem = {
      id: `manual_${Date.now()}`,
      name: 'Custom Accessories / Item',
      category: 'Accessories',
      reason: 'User manual addition to packing specifications.',
      quantity: 1,
      estimatedWeight: 100,
      weightUnit: 'g',
      matchedGearId: '',
      included: true
    };
    setSuggestedItems(prev => [...prev, newItem]);
    toast.success("Additional custom row appended.");
  };

  const handleRemoveItem = (itemId: string) => {
    setSuggestedItems(prev => prev.filter(item => item.id !== itemId));
    toast.info("Item suggestion removed.");
  };

  const handleCompilePackingList = async () => {
    const activeItems = suggestedItems.filter(item => item.included && item.name.trim() !== '');
    if (activeItems.length === 0) {
      toast.warning("Confirm at least one item row is toggled for packing.");
      return;
    }

    try {
      // 1. Create packingList document
      const listPayload = {
        ownerId: user.uid,
        ownerEmail: user.email || '',
        name: listsName.trim() || 'Custom Scenario Packing List',
        description: listsDesc.trim() || `Generated for scenario: "${brief.substring(0, 80)}..."`,
        isTemplate: false,
        status: 'Draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        itemsCount: activeItems.length
      };

      const docRef = await addDoc(collection(db, 'packingLists'), listPayload);
      const newListId = docRef.id;

      // 2. Insert items sequentially as subcollection packingLists/{listId}/items
      for (let i = 0; i < activeItems.length; i++) {
        const rec = activeItems[i];
        
        // Match with full library properties if selected
        const matchedLib = gearLibrary.find(g => g.id === rec.matchedGearId);

        const packingItemPayload = {
          listId: newListId,
          name: rec.name,
          quantity: rec.quantity,
          status: 'pending',
          priority: 'High',
          order: i,
          reasoning: rec.reason,
          category: rec.category,
          estimatedWeight: rec.estimatedWeight || 0,
          weightUnit: rec.weightUnit || 'g',
          gearId: rec.matchedGearId || '',
          assetTag: matchedLib?.assetTag || `SCEN-${String(Date.now()).slice(-6)}-${i}`,
          photoUrls: matchedLib?.photoUrls || [],
          createdAt: new Date().toISOString()
        };

        await addDoc(collection(db, 'packingLists', newListId, 'items'), packingItemPayload);
      }

      toast.success("Packing List fully compiled! Loading detail dashboard...");
      navigate(`/list/${newListId}`);
    } catch (err) {
      console.error("Error compiling packing list:", err);
      toast.error("An error occurred during database list write. Please try again.");
    }
  };

  return (
    <div id="scenario-builder-workspace" className="max-w-6xl mx-auto px-4 py-8 space-y-8 text-neutral-800">
      {/* Visual Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1 px-2.5 bg-neutral-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest">
              AI Powered
            </span>
            <span className="flex items-center gap-1 text-xs text-primary font-bold">
              <Sparkles size={14} /> Sandbox Engine
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-neutral-900 font-sans">
            Scenario Packing Builder
          </h1>
          <p className="text-sm text-neutral-500 mt-1 max-w-2xl">
            Input custom project goals or gig briefs. The agent analyzes existing physical assets from your Gear Library and suggests high-precision payloads.
          </p>
        </div>
        
        <div className="flex items-center gap-2.5 bg-neutral-50 border border-neutral-100 px-4 py-3 rounded-2xl shrink-0">
          <Package className="text-neutral-400" size={18} />
          <div className="flex flex-col text-xs">
            <span className="font-bold text-neutral-700 leading-none">
              {loadingGear ? 'Loading...' : `${gearLibrary.length} assets`}
            </span>
            <span className="text-neutral-400 font-extrabold text-[9px] uppercase tracking-wider mt-0.5">
              Available Gear Registry
            </span>
          </div>
        </div>
      </div>

      {/* Grid of Presets & Brief Input */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Presets Sidebar - 4 columns */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400">
              Starter Templates
            </h3>
            <span className="text-[10px] text-neutral-400 font-bold">4 presets available</span>
          </div>

          <div className="grid grid-cols-1 gap-3.5">
            {PRESETS.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectPreset(p.brief, p.title)}
                className="group text-left p-4 bg-white border border-neutral-200 rounded-2xl hover:border-neutral-900 shadow-sm hover:shadow transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-black tracking-tight text-neutral-900 group-hover:text-primary transition-colors">
                    {p.title}
                  </span>
                  <ArrowRight size={14} className="text-neutral-300 group-hover:text-neutral-900 transition-colors group-hover:translate-x-1 duration-200" />
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed truncate">
                  {p.desc}
                </p>
              </button>
            ))}
          </div>

          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-2">
            <div className="flex items-center gap-2 text-neutral-800">
              <Info size={16} className="text-neutral-400 shrink-0" />
              <h4 className="text-[10px] font-black uppercase tracking-widest leading-none">Smart Matching</h4>
            </div>
            <p className="text-[10px] text-neutral-500 leading-relaxed italic">
              When matched, the AI links list entries to your exact catalog item. Checked items preserve model specifications and visual previews.
            </p>
          </div>
        </div>

        {/* Input area - 8 columns */}
        <div className="lg:col-span-8 bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-widest text-neutral-500 block">
              Enter Custom Gig Brief / Adventure Context
            </label>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Describe where you are going, what media you are shooting, expected atmosphere, weather, or crew density.
            </p>
          </div>

          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Example: Outdoor pre-wedding shoot at sunset. High moisture wind. Needs prime lenses, drone coverage, stabilizers, lighting fixtures, and a rugged carrying bag."
            className="w-full min-h-[140px] p-4 bg-neutral-50 border border-neutral-200 focus:bg-white focus:border-neutral-900 focus:outline-none rounded-2xl text-xs leading-relaxed transition-colors scrollbar-hide"
          />

          <div className="flex items-center justify-between border-t border-neutral-100 pt-5">
            <span className="text-[10px] text-neutral-400 italic">
              {brief.length} characters written
            </span>

            <button
              onClick={handleGenerateList}
              disabled={isGenerating || loadingGear}
              className="flex items-center gap-2.5 bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-100 disabled:text-neutral-400 px-6 py-2.5 rounded-xl font-bold text-xs shadow-md transition"
            >
              {isGenerating ? (
                <>
                  <span className="h-3 w-3 border-2 border-neutral-300 border-t-neutral-800 animate-spin rounded-full inline-block" />
                  Generating List Suggestions...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Analyze and Compile Payload
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Suggested Items Table Panel */}
      {suggestedItems.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm space-y-6 animate-fade-in">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 pb-5">
            <div>
              <h2 className="text-lg font-black tracking-tight text-neutral-900">
                Suggested Payload Blueprint
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Refine, toggle, and map items before building your official Packer Tools list.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={handleAddManualItem}
                className="flex items-center gap-2 text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2 hover:bg-neutral-100 text-xs font-bold transition"
              >
                <Plus size={14} /> Add Item Row
              </button>
            </div>
          </div>

          {aiWarningMessage && (
            <div className="p-3 px-4 bg-orange-50 border border-orange-100 rounded-xl flex items-start gap-2.5">
              <AlertTriangle className="text-orange-500 shrink-0 mt-0.5" size={16} />
              <div className="text-[11px] text-orange-700 font-medium leading-relaxed">
                {aiWarningMessage}
              </div>
            </div>
          )}

          {/* Table list */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-100 text-[10px] font-black uppercase tracking-widest text-neutral-400">
                  <th className="py-3 px-2 w-12">Pack</th>
                  <th className="py-3 px-4 min-w-[200px]">Equipment Specifications</th>
                  <th className="py-3 px-4">Workspace Match Mapping</th>
                  <th className="py-3 px-4 w-24">Quantity</th>
                  <th className="py-3 px-4 w-32">Weight Base</th>
                  <th className="py-3 px-2 text-right w-12">Action</th>
                </tr>
              </thead>
              <tbody>
                {suggestedItems.map((item) => {
                  const matchingGear = gearLibrary.filter(gl => {
                    const cName = gl.name.toLowerCase();
                    const cCategory = (gl.primaryCategory || gl.category || '').toLowerCase();
                    const sName = item.name.toLowerCase();
                    const sCat = item.category.toLowerCase();
                    
                    return cName.includes(sName) || 
                           sName.includes(cName) || 
                           (sCat.includes(cCategory) && cCategory.length > 2);
                  });

                  // If matchedGearId is set, get details of specific gear
                  const activeMatchedGear = gearLibrary.find(g => g.id === item.matchedGearId);
                  const isAssetInUse = activeMatchedGear?.status === 'in_use';

                  return (
                    <tr 
                      key={item.id} 
                      className={`border-b border-neutral-100 text-xs hover:bg-neutral-50/50 transition-colors ${
                        !item.included ? 'opacity-40' : ''
                      }`}
                    >
                      {/* Checkbox pack */}
                      <td className="py-4 px-2">
                        <button
                          onClick={() => handleToggleInclude(item.id)}
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                            item.included 
                              ? 'bg-neutral-900 border-neutral-900 text-white' 
                              : 'border-neutral-300 hover:border-neutral-900'
                          }`}
                        >
                          {item.included && <Check size={12} strokeWidth={3} />}
                        </button>
                      </td>

                      {/* Info & Specs */}
                      <td className="py-4 px-4 space-y-1">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleUpdateItemValue(item.id, 'name', e.target.value)}
                          className="font-bold text-neutral-900 bg-transparent border-b border-transparent hover:border-neutral-200 focus:border-neutral-900 focus:outline-none w-full py-0.5 leading-none"
                        />
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="p-0.5 px-1.5 bg-neutral-100 text-neutral-500 rounded text-[9px] uppercase font-black tracking-wider block shrink-0">
                            {item.category}
                          </span>
                          <span className="text-[10px] text-neutral-400 italic font-medium leading-tight">
                            {item.reason}
                          </span>
                        </div>
                      </td>

                      {/* Matching dropdown */}
                      <td className="py-4 px-4 space-y-1">
                        {item.matchedGearId ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1.5 p-1 px-2.5 bg-emerald-50 text-emerald-700 font-bold text-[9px] uppercase tracking-wide rounded-full">
                              <Check size={10} strokeWidth={3} /> Match Found
                            </span>
                            
                            <select
                              value={item.matchedGearId}
                              onChange={(e) => handleUpdateItemValue(item.id, 'matchedGearId', e.target.value)}
                              className="block w-full text-[11px] bg-neutral-50 border border-neutral-200 rounded-lg p-1.5 focus:outline-none focus:border-neutral-900 font-medium"
                            >
                              <option value="">-- Disconnect and Pack missing --</option>
                              {gearLibrary.map(g => (
                                <option key={g.id} value={g.id}>
                                  {g.brand ? `[${g.brand}] ` : ''}{g.name} ({g.primaryCategory || g.category || 'Gear'})
                                </option>
                              ))}
                            </select>

                            {/* AGENTS.md condition check for status === 'in_use' */}
                            {isAssetInUse && (
                              <div className="text-[10px] text-orange-600 bg-orange-50 border border-orange-100 rounded p-1 flex items-center gap-1 mt-1 font-bold">
                                <AlertTriangle size={10} /> OUT / Checked Out 
                                {activeMatchedGear?.currentHolder ? ` to: ${activeMatchedGear.currentHolder}` : ''}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {matchingGear.length > 0 ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 p-0.5 px-1.5 bg-amber-50 text-amber-700 text-[9px] uppercase tracking-wide rounded font-black">
                                  Registry Matches Available ({matchingGear.length})
                                </span>
                                <select
                                  onChange={(e) => handleUpdateItemValue(item.id, 'matchedGearId', e.target.value)}
                                  className="block w-full text-[10px] bg-white border border-neutral-200 rounded p-1"
                                >
                                  <option value="">-- Select matched asset --</option>
                                  {matchingGear.map(g => (
                                    <option key={g.id} value={g.id}>
                                      {g.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <span className="inline-flex items-center p-1 px-2.5 bg-neutral-50 text-neutral-500 text-[9px] uppercase tracking-wide rounded-full font-bold">
                                Unmatched / Source missing
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Quantity input */}
                      <td className="py-4 px-4">
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={item.quantity}
                          onChange={(e) => handleUpdateItemValue(item.id, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-14 p-1 px-2 border border-neutral-200 text-center rounded-lg bg-neutral-50 text-xs font-bold focus:bg-white focus:border-neutral-900"
                        />
                      </td>

                      {/* Estimated weight */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={item.estimatedWeight || ''}
                            placeholder="0"
                            onChange={(e) => handleUpdateItemValue(item.id, 'estimatedWeight', parseFloat(e.target.value) || undefined)}
                            className="w-16 p-1 px-1.5 border border-neutral-200 rounded-lg text-xs leading-none bg-neutral-50 focus:bg-white focus:outline-none focus:border-neutral-900"
                          />
                          <select
                            value={item.weightUnit || 'g'}
                            onChange={(e) => handleUpdateItemValue(item.id, 'weightUnit', e.target.value)}
                            className="bg-transparent text-[10px] text-neutral-400 font-bold focus:outline-none"
                          >
                            <option value="g">g</option>
                            <option value="kg">kg</option>
                            <option value="lb">lb</option>
                            <option value="oz">oz</option>
                          </select>
                        </div>
                      </td>

                      {/* Remove action */}
                      <td className="py-4 px-2 text-right">
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-neutral-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
                          title="Remove item suggestion"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Form parameters for final creation */}
          <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-100 grid grid-cols-1 md:grid-cols-2 gap-6 pt-5">
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-widest text-neutral-500 block">
                Final Packing Document Title
              </label>
              <input
                type="text"
                value={listsName}
                onChange={(e) => setListsName(e.target.value)}
                placeholder="My Packing List Title"
                className="w-full p-3 bg-white border border-neutral-200 rounded-xl focus:border-neutral-900 focus:outline-none text-xs font-bold text-neutral-800"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-widest text-neutral-500 block">
                Description Memo (Optional)
              </label>
              <input
                type="text"
                value={listsDesc}
                onChange={(e) => setListsDesc(e.target.value)}
                placeholder="Notes about client guidelines, weather updates, or locations"
                className="w-full p-3 bg-white border border-neutral-200 rounded-xl focus:border-neutral-900 focus:outline-none text-xs text-neutral-700"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3.5 border-t border-neutral-100 pt-5">
            <button
              onClick={() => setSuggestedItems([])}
              className="px-5 py-2.5 rounded-xl border border-neutral-200 text-neutral-500 text-xs font-bold hover:bg-neutral-50 transition"
            >
              Clear Workspace
            </button>
            <button
              onClick={handleCompilePackingList}
              className="flex items-center gap-2 bg-neutral-900 text-white hover:bg-neutral-800 px-7 py-2.5 rounded-xl text-xs font-extrabold shadow-lg hover:shadow-xl transition"
            >
              <Check size={14} strokeWidth={3} /> Compile Packing List Documents
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
