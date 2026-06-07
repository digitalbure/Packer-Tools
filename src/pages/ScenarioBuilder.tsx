import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, getDocs, addDoc, doc } from 'firebase/firestore';
import { 
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  Sparkles, 
  ChevronRight, 
  Briefcase, 
  Package, 
  Check, 
  Minus, 
  Plus, 
  Trash2, 
  Clock, 
  AlertTriangle,
  Flame,
  Wrench,
  Compass,
  ArrowRight,
  Info,
  GripVertical,
  Search,
  RotateCcw,
  Save,
  FileCheck,
  AlertCircle
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

interface SortableGridItemProps {
  item: RecommendedListItem;
  gearLibrary: GearItem[];
  onToggleInclude: (id: string) => void;
  onUpdateField: (id: string, field: keyof RecommendedListItem, value: any) => void;
  onRemove: (id: string) => void;
}

// 🌐 Draggable item component declared outside to preserve input focus during typing
function SortableGridItem({
  item,
  gearLibrary,
  onToggleInclude,
  onUpdateField,
  onRemove
}: SortableGridItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
  };

  const activeMatchedGear = gearLibrary.find(g => g.id === item.matchedGearId);
  const isAssetInUse = activeMatchedGear?.status === 'in_use';

  const matchingGear = gearLibrary.filter(gl => {
    const cName = gl.name.toLowerCase();
    const sName = item.name.toLowerCase();
    const cCategory = (gl.primaryCategory || gl.category || '').toLowerCase();
    const sCat = item.category.toLowerCase();
    return cName.includes(sName) || sName.includes(cName) || 
           (sCat.includes(cCategory) && cCategory.length > 2);
  });

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-3xl border transition-all duration-200 relative p-5 flex flex-col justify-between space-y-4 ${
        isDragging 
          ? 'border-neutral-900 shadow-2xl scale-[1.02] ring-2 ring-neutral-900/5 z-50' 
          : !item.included 
            ? 'border-neutral-200 opacity-60 bg-neutral-50/50 shadow-sm' 
            : 'border-neutral-200 hover:border-neutral-400 hover:shadow shadow-sm'
      }`}
    >
      {/* Card Header controls */}
      <div className="flex items-start justify-between gap-2.5">
        <button
          type="button"
          onClick={() => onToggleInclude(item.id)}
          className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all cursor-pointer select-none ${
            item.included
              ? 'bg-neutral-900 border-neutral-900 text-white'
              : 'border-neutral-300 hover:border-neutral-900 bg-white'
          }`}
        >
          {item.included && <Check size={14} strokeWidth={3} />}
        </button>

        <span className="text-[9px] bg-neutral-100 text-neutral-600 px-2 py-1 rounded-md font-black uppercase tracking-wider block truncate max-w-[130px]" title={item.category}>
          {item.category}
        </span>

        {/* Grab Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg shrink-0 transition"
          title="Drag and drop to reorder"
        >
          <GripVertical size={16} />
        </div>
      </div>

      {/* Inputs Section */}
      <div className="space-y-3 flex-1">
        <div className="text-left space-y-1">
          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block font-sans">Equipment Name</label>
          <input
            type="text"
            value={item.name}
            onChange={(e) => onUpdateField(item.id, 'name', e.target.value)}
            className="font-bold text-neutral-900 bg-neutral-50 hover:bg-neutral-100 focus:bg-white border-0 ring-1 ring-neutral-200 focus:ring-2 focus:ring-neutral-900 focus:outline-none rounded-xl w-full p-2.5 text-xs transition"
          />
        </div>

        <div className="text-left space-y-1">
          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block font-sans">AI Sourcing Context</label>
          <p className="text-[11px] text-neutral-500 leading-normal italic line-clamp-2 px-1">
            {item.reason}
          </p>
        </div>

        {/* Database Match Section */}
        <div className="text-left pt-2.5 border-t border-dashed border-neutral-100 space-y-1.5">
          <label className="block text-[9px] font-black uppercase tracking-widest text-neutral-400 font-sans">Physical Asset Link</label>
          
          {item.matchedGearId ? (
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                <Check size={10} strokeWidth={3} /> Linked
              </span>
              <select
                value={item.matchedGearId}
                onChange={(e) => onUpdateField(item.id, 'matchedGearId', e.target.value)}
                className="block w-full text-xs bg-emerald-50/50 border border-emerald-200 rounded-xl p-2.5 focus:outline-none text-emerald-900 font-semibold cursor-pointer"
              >
                <option value="">-- Disconnect model mapping --</option>
                {gearLibrary.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.brand ? `[${g.brand}] ` : ''}{g.name}
                  </option>
				))}
              </select>

              {/* Status constraints check (from AGENTS.md instructions!) */}
              {isAssetInUse && (
                <div className="text-[10px] text-orange-700 bg-orange-50 border border-orange-150 p-2.5 rounded-xl flex items-start gap-1.5 font-bold font-sans">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  <span>
                    OUT / Checked Out {activeMatchedGear?.currentHolder ? `to: ${activeMatchedGear.currentHolder}` : ''}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              {matchingGear.length > 0 ? (
                <div className="space-y-1.5">
                  <select
                    onChange={(e) => onUpdateField(item.id, 'matchedGearId', e.target.value)}
                    className="block w-full text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-2.5 font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                    defaultValue=""
                  >
                    <option value="">-- Registry Matches Found ({matchingGear.length}) --</option>
                    {matchingGear.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.brand ? `[${g.brand}] ` : ''}{g.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="text-[10px] text-neutral-400 bg-neutral-50 border border-neutral-100 p-2 rounded-xl text-center font-bold">
                  Missing from Library Registry
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer controls */}
      <div className="pt-3 border-t border-neutral-100 flex items-center justify-between gap-1.5">
        {/* Quantity Toggle Widgets */}
        <div className="flex items-center gap-1 bg-neutral-50 border border-neutral-200 rounded-xl p-1 shrink-0">
          <button
            type="button"
            disabled={item.quantity <= 1}
            onClick={() => onUpdateField(item.id, 'quantity', Math.max(1, item.quantity - 1))}
            className="w-6 h-6 rounded-lg text-neutral-500 hover:text-neutral-800 hover:bg-neutral-200 flex items-center justify-center disabled:opacity-30 transition font-black cursor-pointer"
          >
            <Minus size={10} />
          </button>
          <span className="w-6 text-center text-xs font-black text-neutral-800">{item.quantity}</span>
          <button
            type="button"
            onClick={() => onUpdateField(item.id, 'quantity', item.quantity + 1)}
            className="w-6 h-6 rounded-lg text-neutral-500 hover:text-neutral-800 hover:bg-neutral-200 flex items-center justify-center transition font-black cursor-pointer"
          >
            <Plus size={10} />
          </button>
        </div>

        {/* Estimated weight controller */}
        <div className="flex items-center gap-1 overflow-hidden shrink-0">
          <input
            type="number"
            placeholder="0"
            value={item.estimatedWeight || ''}
            onChange={(e) => onUpdateField(item.id, 'estimatedWeight', Math.max(0, parseFloat(e.target.value)) || undefined)}
            className="w-11 bg-neutral-50 border border-neutral-200 rounded-xl p-1 text-center font-black text-xs focus:ring-1 focus:ring-neutral-400 outline-none"
          />
          <select
            value={item.weightUnit || 'g'}
            onChange={(e) => onUpdateField(item.id, 'weightUnit', e.target.value)}
            className="bg-transparent text-[10px] text-neutral-500 font-bold focus:outline-none cursor-pointer"
          >
            <option value="g">g</option>
            <option value="kg">kg</option>
            <option value="lb">lb</option>
            <option value="oz">oz</option>
          </select>
        </div>

        {/* Garbage button */}
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition shrink-0 cursor-pointer"
          title="Delete suggestion"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
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

  // Search filter for inserting missing gear library assets
  const [libAddSearch, setLibAddSearch] = useState('');
  const [libCategorySelect, setLibCategorySelect] = useState('All');

  // DnD Activation constraints to prevent swallowing text cursor focus clicks (8px threshold)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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

  // App-Wide Auto Save / Resume Disrupted Lists & Projects
  useEffect(() => {
    if (user?.uid) {
      const draftKey = `packer_draft_scenario_${user.uid}`;
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.brief || parsed.suggestedItems?.length > 0) {
            setBrief(parsed.brief || '');
            setSuggestedItems(parsed.suggestedItems || []);
            setListsName(parsed.listsName || 'Gig Packing: New List');
            setListsDesc(parsed.listsDesc || '');
            toast.success("Resumed your disrupted Scenario Builder workspace draft.");
          }
        } catch (e) {
          console.error("Failed to restore scenario auto-save state:", e);
        }
      }
    }
  }, [user?.uid]);

  // Persist autosaved state to local storage to protect against disrupted sessions
  useEffect(() => {
    if (user?.uid) {
      const draftKey = `packer_draft_scenario_${user.uid}`;
      localStorage.setItem(draftKey, JSON.stringify({
        brief,
        suggestedItems,
        listsName,
        listsDesc,
        updatedAt: new Date().toISOString()
      }));
    }
  }, [brief, suggestedItems, listsName, listsDesc, user?.uid]);

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

      const parsed: RecommendedListItem[] = (data.recommendedItems || []).map((item: any, i: number) => {
        // Run smart pre-matching client-side to automatically pair library items
        let defaultMatchId = item.matchedGearId || '';
        if (!defaultMatchId) {
          const sName = (item.name || '').toLowerCase();
          const bestFit = gearLibrary.find(gl => {
            const glName = gl.name.toLowerCase();
            return glName === sName || glName.includes(sName) || sName.includes(glName);
          });
          if (bestFit) {
            defaultMatchId = bestFit.id;
          }
        }

        return {
          id: `rec_${Date.now()}_${i}`,
          name: item.name || '',
          category: item.category || 'Gear',
          reason: item.reason || 'Requested item matches the brief specifics.',
          quantity: typeof item.quantity === 'number' ? item.quantity : 1,
          estimatedWeight: item.estimatedWeight,
          weightUnit: item.weightUnit || 'g',
          matchedGearId: defaultMatchId,
          included: true
        };
      });

      setSuggestedItems(parsed);
      toast.success("AI suggested packing list generated! Proceeding to payload confirmation.");
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
      reason: 'Manual addition to confirmed checklist.',
      quantity: 1,
      estimatedWeight: 100,
      weightUnit: 'g',
      matchedGearId: '',
      included: true
    };
    setSuggestedItems(prev => [...prev, newItem]);
    toast.success("Custom item added into draggable selection grid.");
  };

  const handleAddSelectedGearFromLibrary = (gear: GearItem) => {
    // Add specifically selected physical gear as suggested list item
    const newItem: RecommendedListItem = {
      id: `library_add_${Date.now()}_${gear.id}`,
      name: gear.name,
      category: gear.primaryCategory || gear.category || 'Gear',
      reason: `Manually added physical asset from Library (${gear.brand || 'No brand'})`,
      quantity: 1,
      estimatedWeight: gear.weight || 0,
      weightUnit: gear.weightUnit || 'g',
      matchedGearId: gear.id,
      included: true
    };
    setSuggestedItems(prev => [...prev, newItem]);
    toast.success(`Injected physical "${gear.name}" directly into payload confirm grid.`);
  };

  const handleRemoveItem = (itemId: string) => {
    setSuggestedItems(prev => prev.filter(item => item.id !== itemId));
    toast.info("Item suggestion removed.");
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSuggestedItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
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

      // 2. Insert items sequentially inside subcollection
      for (let i = 0; i < activeItems.length; i++) {
        const rec = activeItems[i];
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

      // Clear Draft from local saving once list created successfully!
      if (user?.uid) {
        localStorage.removeItem(`packer_draft_scenario_${user.uid}`);
      }

      toast.success("Packing List fully compiled! Loading detail dashboard...");
      navigate(`/list/${newListId}`);
    } catch (err) {
      console.error("Error compiling packing list:", err);
      toast.error("An error occurred during database list write. Please try again.");
    }
  };

  // Filter gear library options for injecting missing items directly
  const filteredLibraryOptions = useMemo(() => {
    return gearLibrary.filter(g => {
      const gName = g.name.toLowerCase();
      const gBrand = (g.brand || '').toLowerCase();
      const gCat = (g.primaryCategory || g.category || '').toLowerCase();
      const queryStr = libAddSearch.toLowerCase();
      
      const searchMatch = gName.includes(queryStr) || gBrand.includes(queryStr) || gCat.includes(queryStr);
      const catMatch = libCategorySelect === 'All' || gCat === libCategorySelect.toLowerCase() || (g.primaryCategory || g.category || '').toLowerCase() === libCategorySelect.toLowerCase();
      
      // Do not suggest items that are already matched to avoid duplicate clutter
      const alreadyMatched = suggestedItems.some(rec => rec.matchedGearId === g.id && rec.included);
      
      return searchMatch && catMatch && !alreadyMatched;
    });
  }, [gearLibrary, libAddSearch, libCategorySelect, suggestedItems]);

  const uniqueLibraryCategories = useMemo(() => {
    const cats = new Set<string>();
    gearLibrary.forEach(g => {
      const c = g.primaryCategory || g.category;
      if (c) cats.add(c);
    });
    return ['All', ...Array.from(cats)];
  }, [gearLibrary]);

  return (
    <div id="scenario-builder-workspace" className="max-w-7xl mx-auto px-4 py-8 space-y-8 text-neutral-800">
      
      {/* Visual Header & Active Auto Save state */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 pb-6 text-left">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="p-0.5 px-2 bg-neutral-900 text-white rounded-full text-[9px] font-black uppercase tracking-widest leading-none">
              AI Intelligent Sandbox
            </span>
            <span className="flex items-center gap-1 text-[11px] text-green-700 font-extrabold bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Auto-save Shield Active
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-neutral-900 font-sans">
            Scenario Packing Builder
          </h1>
          <p className="text-sm text-neutral-500 mt-1 max-w-2xl font-sans">
            Input custom operational targets or remote shoot briefs. Our engine evaluates library constraints and designs customized, low-drag payloads.
          </p>
        </div>
        
        <div className="flex items-center gap-2.5 bg-neutral-50 border border-neutral-100 px-4 py-3 rounded-2xl shrink-0">
          <Package className="text-neutral-400" size={18} />
          <div className="flex flex-col text-xs text-left">
            <span className="font-bold text-neutral-700 leading-none">
              {loadingGear ? 'Loading...' : `${gearLibrary.length} Registered`}
            </span>
            <span className="text-neutral-400 font-black text-[9px] uppercase tracking-wider mt-0.5">
              Available Gear Assets
            </span>
          </div>
        </div>
      </div>

      {/* Progress Wizard tracker */}
      <div className="border border-neutral-100 bg-white rounded-2xl p-4 flex items-center justify-center gap-2 md:gap-8 text-xs font-sans font-bold select-none text-left shadow-sm">
        <div className="flex items-center gap-2">
          <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] ${
            suggestedItems.length > 0 ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-neutral-900 text-white'
          }`}>
            {suggestedItems.length > 0 ? <Check size={12} strokeWidth={3} /> : '1'}
          </span>
          <span className={suggestedItems.length > 0 ? 'text-neutral-400' : 'text-neutral-900'}>
            Define Brief / Preset
          </span>
        </div>
        <ChevronRight size={16} className="text-neutral-300" />
        <div className="flex items-center gap-2">
          <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] ${
            suggestedItems.length > 0 ? 'bg-neutral-900 text-white animate-pulse' : 'bg-neutral-100 text-neutral-400'
          }`}>
            2
          </span>
          <span className={suggestedItems.length > 0 ? 'text-neutral-900 font-black' : 'text-neutral-400'}>
            Confirm Draggable Payload Selection
          </span>
        </div>
      </div>

      {/* Step 1: Scenario Configuration (Collapsible if list generated) */}
      {suggestedItems.length === 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
          
          {/* Presets Column Selector - 4 grid layout */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400">
                Preset Field Scenarios
              </h3>
              <span className="text-[10px] text-neutral-400 font-medium">4 configurations</span>
            </div>

            <div className="grid grid-cols-1 gap-3.5">
              {PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectPreset(p.brief, p.title)}
                  className="group text-left p-4.5 bg-white border border-neutral-200 rounded-2xl hover:border-neutral-900 shadow-sm hover:shadow transition-all duration-200 cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-black tracking-tight text-neutral-900 group-hover:text-neutral-600 transition-colors block">
                      {p.title}
                    </span>
                    <ArrowRight size={14} className="text-neutral-300 group-hover:text-neutral-900 transition-colors group-hover:translate-x-1 duration-200" />
                  </div>
                  <p className="text-[11px] text-neutral-500 leading-relaxed font-sans line-clamp-1">
                    {p.desc}
                  </p>
                </button>
              ))}
            </div>

            <div className="p-4.5 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-2">
              <div className="flex items-center gap-2 text-neutral-800">
                <Info size={16} className="text-neutral-400 shrink-0" />
                <h4 className="text-[10px] font-black uppercase tracking-widest leading-none font-sans">Adaptive Registry Mapping</h4>
              </div>
              <p className="text-[11px] text-neutral-500 leading-normal italic font-sans">
                Our database scanner matches AI items to exact equipment tag entries, keeping warranty, checkout queues, and safety status fully aligned.
              </p>
            </div>
          </div>

          {/* AI Input Brief Area - 8 grid layout */}
          <div className="lg:col-span-8 bg-white border border-neutral-200 rounded-3xl p-6.5 shadow-sm space-y-6">
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-widest text-neutral-500 block">
                Enter Custom Gig Specifications or Operation Target
              </label>
              <p className="text-[11px] text-neutral-400 leading-relaxed font-sans mt-0.5">
                Outline location climate, media formats, drone rules, auxiliary redundancy expectations, or timeline limits.
              </p>
            </div>

            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Example: Solo outdoor photo campaign. Mountain high-wind climate. Focuses on robust stabilizers, battery buffers, water-resistant bags, and multiple zoom pairings."
              className="w-full min-h-[160px] p-4 bg-neutral-100/50 border border-neutral-200 focus:bg-white focus:border-neutral-900 focus:outline-none rounded-2xl text-xs leading-relaxed transition scrollbar-hide font-sans"
            />

            <div className="flex items-center justify-between border-t border-neutral-100 pt-5">
              <span className="text-[10px] text-neutral-400 italic">
                {brief.length} characters written
              </span>

              <button
                type="button"
                onClick={handleGenerateList}
                disabled={isGenerating || loadingGear}
                className="flex items-center gap-2.5 bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-100 disabled:text-neutral-400 px-7 py-3 rounded-xl font-bold text-xs shadow hover:shadow-md transition cursor-pointer select-none"
              >
                {isGenerating ? (
                  <>
                    <span className="h-3.5 w-3.5 border-2 border-neutral-300 border-t-neutral-800 animate-spin rounded-full inline-block shrink-0" />
                    Assembling Blueprint Rules...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    Generate Payload Checklist
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Action buttons to go back & modify */
        <div className="flex justify-between items-center bg-neutral-50 p-4 border border-neutral-200 rounded-2xl text-left shadow-sm">
          <div className="flex items-center gap-2.5">
            <Sparkles className="text-neutral-500 shrink-0" size={18} />
            <div className="text-xs">
              <span className="text-neutral-500">Currently Confirmed: </span>
              <span className="font-extrabold text-neutral-900 uppercase tracking-tight">{suggestedItems.length} proposed items</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Wipe current selections and modify your briefing specifications? This will reset custom counts.")) {
                setSuggestedItems([]);
              }
            }}
            className="px-4 py-2 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-neutral-700 transition cursor-pointer"
          >
            Modify Briefing Specs
          </button>
        </div>
      )}

      {/* Step 2: Confirm Selection Stage with Draggable Grid */}
      {suggestedItems.length > 0 && (
        <div className="space-y-8 text-left animate-fade-in">
          
          <div className="bg-white border border-neutral-200 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 pb-5">
              <div>
                <h2 className="text-lg font-black tracking-tight text-neutral-900 uppercase">
                  Verify Payload confirmation & Grid Reordering
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5 font-sans">
                  Use the dot drag handles to visually reorder items, customize quantities directly, and pair correct asset tags prior to compiler storage.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddManualItem}
                  className="flex items-center gap-2 text-neutral-700 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl px-4 py-2 font-black text-xs transition cursor-pointer"
                >
                  <Plus size={14} strokeWidth={3} /> Add Custom Rows
                </button>
              </div>
            </div>

            {aiWarningMessage && (
              <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-start gap-3">
                <AlertCircle className="text-orange-500 shrink-0 mt-0.5" size={18} />
                <div className="text-xs text-orange-850 font-medium leading-relaxed font-sans">
                  <span className="font-bold underline block mb-0.5">Payload Registry Constraints:</span>
                  {aiWarningMessage}
                </div>
              </div>
            )}

            {/* Draggable grid integration */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={suggestedItems.map(item => item.id)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {suggestedItems.map((item) => (
                    <SortableGridItem
                      key={item.id}
                      item={item}
                      gearLibrary={gearLibrary}
                      onToggleInclude={handleToggleInclude}
                      onUpdateField={handleUpdateItemValue}
                      onRemove={handleRemoveItem}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {/* Interactive "Add Missing Gear" from user's physical Gear Library directly */}
            <div className="border border-neutral-150 bg-neutral-50/50 rounded-[2rem] p-6 space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-black uppercase tracking-wider text-neutral-800">
                    Add Missing Gear Directly from Registry
                  </h3>
                  <p className="text-[11px] text-neutral-400 font-sans leading-none">
                    Select unmatched assets inside your real workspace registry to inject them as active validated cards.
                  </p>
                </div>

                {/* Filter tools inline */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-neutral-400" size={14} />
                    <input
                      type="text"
                      placeholder="Search Registry..."
                      value={libAddSearch}
                      onChange={(e) => setLibAddSearch(e.target.value)}
                      className="bg-white border border-neutral-200 focus:outline-none rounded-xl text-[11px] py-1.5 pl-8.5 pr-3 text-neutral-700 w-44"
                    />
                  </div>

                  <select
                    value={libCategorySelect}
                    onChange={(e) => setLibCategorySelect(e.target.value)}
                    className="bg-white border border-neutral-200 text-[11px] font-bold text-neutral-600 rounded-xl py-1.5 px-3 focus:outline-none cursor-pointer"
                  >
                    {uniqueLibraryCategories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {filteredLibraryOptions.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredLibraryOptions.map((g) => {
                    const isInUse = g.status === 'in_use';
                    return (
                      <div
                        key={g.id}
                        className="p-3 bg-white border border-neutral-150 rounded-xl flex items-center justify-between gap-3 text-xs shadow-sm hover:border-neutral-400 transition"
                      >
                        <div className="space-y-0.5 truncate text-left">
                          <span className="font-bold text-neutral-900 block truncate leading-tight">
                            {g.name}
                          </span>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[9px] text-neutral-400 font-black uppercase tracking-wider">
                              {g.primaryCategory || g.category}
                            </span>
                            {isInUse && (
                              <span className="text-[8px] bg-red-50 text-red-650 px-1 py-0.2 rounded font-bold font-sans">
                                OUT
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddSelectedGearFromLibrary(g)}
                          className="px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-[10px] font-bold transition whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          + Add Included
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center p-6 bg-white border border-dashed border-neutral-200 rounded-2xl text-[11px] font-bold text-neutral-400 font-sans">
                  No matching registered assets available inside your search filters.
                </div>
              )}
            </div>

            {/* Document metadata parameters block */}
            <div className="bg-neutral-50 p-6 rounded-[2rem] border border-neutral-100 grid grid-cols-1 md:grid-cols-2 gap-6 pt-5">
              <div className="space-y-1.5 text-left">
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

              <div className="space-y-1.5 text-left">
                <label className="text-xs font-black uppercase tracking-widest text-neutral-500 block">
                  Description Memo (Optional)
                </label>
                <input
                  type="text"
                  value={listsDesc}
                  onChange={(e) => setListsDesc(e.target.value)}
                  placeholder="Notes about location climates, team allocations, or customer targets"
                  className="w-full p-3 bg-white border border-neutral-200 rounded-xl focus:border-neutral-900 focus:outline-none text-xs text-neutral-700 font-sans"
                />
              </div>
            </div>

            {/* Final execution block */}
            <div className="flex justify-between items-center border-t border-neutral-100 pt-5">
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Standardize workspace list back to draft specs? This resets selection changes.")) {
                    setSuggestedItems([]);
                    if (user?.uid) {
                      localStorage.removeItem(`packer_draft_scenario_${user.uid}`);
                    }
                  }
                }}
                className="flex items-center gap-1 px-4 py-2 border border-neutral-200 rounded-xl text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50 font-bold text-xs transition cursor-pointer"
              >
                <RotateCcw size={14} /> Reset and Restart
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSuggestedItems([])}
                  className="px-5 py-2.5 rounded-xl border border-neutral-200 text-neutral-500 text-xs font-bold hover:bg-neutral-50 transition cursor-pointer"
                >
                  Close Confirmation View
                </button>
                <button
                  type="button"
                  onClick={handleCompilePackingList}
                  className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-white px-7 py-3 rounded-xl text-xs font-extrabold shadow-lg hover:shadow-xl transition cursor-pointer select-none"
                >
                  <FileCheck size={14} strokeWidth={2.5} /> Compile Packing List Documents
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
