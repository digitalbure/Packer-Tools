import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, GearItem, BuildItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wrench, 
  Plus, 
  Trash2, 
  Layers, 
  Zap, 
  DollarSign, 
  Weight, 
  Package, 
  Search, 
  CheckCircle2, 
  ChevronDown, 
  TrendingUp, 
  LayoutGrid, 
  Cable, 
  Construction, 
  RefreshCw,
  Copy,
  FolderPlus,
  Play,
  Hammer,
  ShieldAlert,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

interface SystemsBuild {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

const COMMON_CATALOG = [
  { name: 'ATEM Constellation 8K', category: 'Switcher', brand: 'Blackmagic Design', model: 'Constellation 8K', price: 9995, type: 'component' as const },
  { name: 'ATEM 2 M/E Advanced Panel', category: 'Control Panel', brand: 'Blackmagic Design', model: '2 M/E Panel', price: 5995, type: 'component' as const },
  { name: 'vMix Pro Software', category: 'Software', brand: 'vMix', model: 'Pro', price: 1200, type: 'component' as const },
  { name: 'vMix Reference Rack System', category: 'Workstation', brand: 'Custom', model: 'vMix Rack', price: 4500, type: 'component' as const },
  { name: 'Smart Videohub 40x40', category: 'Router', brand: 'Blackmagic Design', model: 'Videohub 40', price: 2995, type: 'component' as const },
  { name: 'HyperDeck Studio 4K Pro', category: 'Recorder', brand: 'Blackmagic Design', model: 'HyperDeck', price: 1595, type: 'component' as const },
  { name: 'DeckLink Quad 2 Card', category: 'Capture', brand: 'Blackmagic Design', model: 'Quad 2', price: 995, type: 'component' as const },
  { name: '12U Shock Mount Rack Case', category: 'Case', brand: 'Roadie', model: '12U Shock', price: 1200, type: 'component' as const },
  { name: 'SDI Cable Loom 5-way 20m', category: 'Cable', brand: 'Generic', model: 'SDI Loom', price: 450, type: 'loom' as const },
  { name: 'BNC to BNC Cable 1m', category: 'Cable', brand: 'Generic', model: 'BNC Short', price: 15, type: 'loom' as const },
  { name: 'Rack Shelf 1U', category: 'Rack Hardware', brand: 'Middle Atlantic', model: 'UTSI', price: 45, type: 'fixture' as const },
  { name: 'V-Mount Battery Plate', category: 'Power', brand: 'Generic', model: 'V-Plate', price: 75, type: 'fixture' as const },
  { name: 'BNC Connector (Pack of 10)', category: 'Consumable', brand: 'Neutrik', model: 'NBNC75', price: 35, type: 'consumable' as const },
  { name: 'Gaffer Tape Black 2"', category: 'Consumable', brand: 'Generic', model: 'Gaff', price: 22, type: 'consumable' as const },
];

export default function SystemsBuilder({ user }: { user: UserProfile }) {
  const [builds, setBuilds] = useState<SystemsBuild[]>([]);
  const [activeBuild, setActiveBuild] = useState<SystemsBuild | null>(null);
  const [buildItems, setBuildItems] = useState<BuildItem[]>([]);
  const [gearLibrary, setGearLibrary] = useState<GearItem[]>([]);
  
  const [loadingBuilds, setLoadingBuilds] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  
  const [catalogSearch, setCatalogSearch] = useState('');
  const [gearSearch, setGearSearch] = useState('');
  const [catalogTab, setCatalogTab] = useState<'catalog' | 'gear' | 'ai'>('catalog');
  
  // Create / Edit spec state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBuildName, setNewBuildName] = useState('');
  const [newBuildDesc, setNewBuildDesc] = useState('');
  
  // Custom build item input
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customItem, setCustomItem] = useState({
    name: '',
    category: 'component',
    brand: '',
    model: '',
    price: 0,
    quantity: 1,
    type: 'component' as 'component' | 'loom' | 'fixture' | 'consumable',
  });
  
  // AI onboarding state
  const [aiInput, setAiInput] = useState('');
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

  // Sync Systems builds lists
  useEffect(() => {
    if (!user.uid) return;
    const q = query(collection(db, 'systemsBuilds'), where('ownerId', '==', user.uid));
    const unsub = onSnapshot(q, async (snap) => {
      const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SystemsBuild));
      setBuilds(fetched);
      
      // Auto-initialize a default draft if there are absolutely no system builds
      if (fetched.length === 0 && !loadingBuilds) {
        try {
          await addDoc(collection(db, 'systemsBuilds'), {
            name: 'Broadcast Flypack Rig',
            description: 'A portable modular rack integration for live broadcast and encoding.',
            ownerId: user.uid,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        } catch (err) {
          console.error("Error creating default system build:", err);
        }
      }
      
      // Keep active build or set default active build
      if (fetched.length > 0) {
        if (!activeBuild || !fetched.some(f => f.id === activeBuild.id)) {
          setActiveBuild(fetched[0]);
        } else {
          const freshActive = fetched.find(f => f.id === activeBuild.id);
          if (freshActive) setActiveBuild(freshActive);
        }
      }
      setLoadingBuilds(false);
    }, (error) => {
      console.warn("SystemsBuilder: Error loading builds:", error);
      setLoadingBuilds(false);
    });
    return unsub;
  }, [user.uid, loadingBuilds, activeBuild?.id]);

  // Sync real Gear library
  useEffect(() => {
    if (!user.uid) return;
    const q = query(
      collection(db, 'users', user.uid, 'gearLibrary')
    );
    const unsub = onSnapshot(q, (snap) => {
      setGearLibrary(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as GearItem)));
    }, (error) => {
      console.warn("SystemsBuilder: Error listening to gear library:", error);
    });
    return unsub;
  }, [user.uid]);

  // Sync sandbox items of active build
  useEffect(() => {
    if (!activeBuild) {
      setBuildItems([]);
      return;
    }
    setLoadingItems(true);
    const q = query(
      collection(db, 'buildItems'),
      where('projectId', '==', activeBuild.id),
      where('ownerId', '==', user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      setBuildItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BuildItem)));
      setLoadingItems(false);
    }, (error) => {
      console.warn("SystemsBuilder: Error listening to build items:", error);
      setLoadingItems(false);
    });
    return unsub;
  }, [activeBuild?.id, user.uid]);

  const handleCreateBuild = async () => {
    if (!newBuildName.trim()) {
      toast.error("Please enter a name for the system setup.");
      return;
    }
    try {
      const docRef = await addDoc(collection(db, 'systemsBuilds'), {
        name: newBuildName,
        description: newBuildDesc,
        ownerId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setNewBuildName('');
      setNewBuildDesc('');
      setShowCreateModal(false);
      toast.success("New system build configuration created!");
    } catch (e) {
      toast.error("Failed to create build draft.");
    }
  };

  const handleDeleteBuild = async (buildId: string) => {
    if (!window.confirm("Are you sure you want to delete this systems build configuration? This will lock any sandboxed items inside it.")) return;
    try {
      await deleteDoc(doc(db, 'systemsBuilds', buildId));
      toast.success("Build configuration removed");
      if (activeBuild?.id === buildId) {
        setActiveBuild(null);
      }
    } catch (e) {
      toast.error("Could not delete build.");
    }
  };

  const handleAddItemToSandbox = async (itemData: Partial<BuildItem>) => {
    if (!activeBuild) {
      toast.error("Please select or initialize an active System Build first.");
      return;
    }
    try {
      await addDoc(collection(db, 'buildItems'), {
        name: itemData.name,
        category: itemData.category || 'Other',
        brand: itemData.brand || '',
        model: itemData.model || '',
        price: itemData.price || 0,
        quantity: itemData.quantity || 1,
        type: itemData.type || 'component',
        projectId: activeBuild.id,
        ownerId: user.uid,
        createdAt: new Date().toISOString(),
        isPushed: false
      });
      toast.success(`${itemData.name} added to sandbox build`);
    } catch (err) {
      toast.error("Failed to add component.");
    }
  };

  const handleAddCustomItem = async () => {
    if (!customItem.name.trim()) {
      toast.error("Enterprise component name is required.");
      return;
    }
    await handleAddItemToSandbox(customItem);
    setCustomItem({
      name: '',
      category: 'component',
      brand: '',
      model: '',
      price: 0,
      quantity: 1,
      type: 'component'
    });
    setIsAddingCustom(false);
  };

  const handleUpdateItemQuantity = async (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      await deleteDoc(doc(db, 'buildItems', itemId));
      return;
    }
    await updateDoc(doc(db, 'buildItems', itemId), { quantity: newQty });
  };

  const handleDeleteItem = async (itemId: string) => {
    await deleteDoc(doc(db, 'buildItems', itemId));
    toast.success("Item deleted from virtual rig");
  };

  const handlePushToMainInventory = async (item: BuildItem) => {
    if (item.isPushed) return;
    try {
      const gearRef = await addDoc(collection(db, 'users', user.uid, 'gearLibrary'), {
        ownerId: user.uid,
        orgId: user.orgId || null,
        name: item.name,
        category: item.category,
        brand: item.brand || '',
        model: item.model || '',
        quantity: item.quantity,
        price: item.price || 0,
        currency: 'USD',
        status: 'available',
        photoUrls: [],
        assetTag: `VIRT-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      await updateDoc(doc(db, 'buildItems', item.id), {
        isPushed: true,
        pushedGearId: gearRef.id
      });
      toast.success(`${item.name} permanently pushed to your Gear Library list!`);
    } catch (err) {
      toast.error("Failed to publish virtual item to user library.");
    }
  };

  const handleAIOnboard = async () => {
    if (!aiInput.trim()) return;
    setIsAiAnalyzing(true);
    try {
      const res = await fetch('/api/analyze-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          productName: aiInput.startsWith('http') ? '' : aiInput,
          url: aiInput.startsWith('http') ? aiInput : ''
        })
      });
      const data = await res.json();
      
      const parsedItemSpec: Partial<BuildItem> = {
        name: data.name || (aiInput.startsWith('http') ? 'Analyzed Device Specs' : aiInput),
        brand: data.brand || '',
        model: data.model || '',
        category: data.category || 'Switcher',
        price: data.price || 1500,
        type: 'component',
        quantity: 1,
      };

      await handleAddItemToSandbox(parsedItemSpec);
      setAiInput('');
      toast.success("Intelligence Engine successfully cataloged device payload & specifications!");
    } catch (e) {
      toast.error("Cognitive analysis failed. Added with manual entry fallback.");
      await handleAddItemToSandbox({
        name: aiInput,
        category: 'Auxiliary',
        price: 0,
        quantity: 1,
        type: 'component'
      });
      setAiInput('');
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  const totalCost = buildItems.reduce((acc, item) => acc + (item.price || 0) * (item.quantity || 1), 0);
  const totalCount = buildItems.reduce((acc, item) => acc + (item.quantity || 1), 0);

  const filteredCatalog = COMMON_CATALOG.filter(c => 
    c.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
    c.category.toLowerCase().includes(catalogSearch.toLowerCase())
  );

  const filteredGear = gearLibrary.filter(g => 
    g.name.toLowerCase().includes(gearSearch.toLowerCase()) ||
    (g.category && g.category.toLowerCase().includes(gearSearch.toLowerCase()))
  );

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-16">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center">
              <Wrench size={16} />
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tight">Systems Builder</h1>
          </div>
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest leading-none">
            Virtual integration area for sandbox testing and bills-of-materials drafting.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Active selection dropdown */}
          <div className="relative">
            <select
              value={activeBuild?.id || ''}
              onChange={(e) => {
                const selected = builds.find(b => b.id === e.target.value);
                if (selected) setActiveBuild(selected);
              }}
              className="appearance-none bg-neutral-50 hover:bg-neutral-100/80 text-black border border-neutral-200 pl-4 pr-10 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-neutral-200 font-sans"
            >
              {builds.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-white px-5 py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-md hover:scale-[1.02] active:scale-95 transition"
          >
            <FolderPlus size={14} />
            <span>New Draft</span>
          </button>

          {activeBuild && (
            <button
              onClick={() => handleDeleteBuild(activeBuild.id)}
              className="p-3.5 text-neutral-400 hover:text-red-500 rounded-2xl hover:bg-red-50 border border-neutral-200 hover:border-red-100 transition"
              title="Delete Active Draft"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {activeBuild && (
        <div className="bg-neutral-50/50 p-4 rounded-3xl border border-neutral-100 text-xs">
          <p className="font-bold text-neutral-800">
            <span className="uppercase text-neutral-400 text-[9px] mr-1">Active Concept:</span> 
            {activeBuild.name}
          </p>
          <p className="text-neutral-500 mt-0.5">{activeBuild.description || 'No system configuration notes set.'}</p>
        </div>
      )}

      {/* Metrics Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Total System Valuation</p>
            <p className="text-3xl font-black uppercase tracking-tighter">${totalCost.toLocaleString()}</p>
          </div>
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center">
            <DollarSign size={28} />
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Component Count</p>
            <p className="text-3xl font-black uppercase tracking-tighter">{totalCount}</p>
          </div>
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center">
            <LayoutGrid size={28} />
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Sandbox Compatibility</p>
            <p className="text-3xl font-black uppercase tracking-tighter text-amber-500">STABLE</p>
          </div>
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center">
            <TrendingUp size={28} />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Sandbox Equipment List */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-xl font-black uppercase tracking-tighter">System Blueprint & Rig</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Virtual specifications and build list</p>
            </div>

            <button
              onClick={() => setIsAddingCustom(true)}
              className="flex items-center gap-2 text-neutral-800 border border-neutral-200 bg-white hover:bg-neutral-50 px-4 py-2.5 rounded-xl transition font-black uppercase text-[9px] tracking-widest"
            >
              <Plus size={14} />
              <span>Add Custom Piece</span>
            </button>
          </div>

          {/* Quick Custom Item Drawer/Block */}
          <AnimatePresence>
            {isAddingCustom && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-neutral-100 border border-neutral-200 rounded-[2rem] p-6 space-y-4 overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-neutral-600">Onboard Custom Component Model</h4>
                  <button onClick={() => setIsAddingCustom(false)} className="text-neutral-400 hover:text-black font-bold uppercase text-[9px]">Cancel</button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <input
                    placeholder="COMPONENT DESIGNATION NAME..."
                    value={customItem.name}
                    onChange={(e) => setCustomItem({ ...customItem, name: e.target.value })}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-3 text-[10px] font-semibold outline-none"
                  />
                  <input
                    placeholder="BRAND BRAND..."
                    value={customItem.brand}
                    onChange={(e) => setCustomItem({ ...customItem, brand: e.target.value })}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-3 text-[10px] font-semibold outline-none"
                  />
                  <input
                    placeholder="MODEL/PART NUMBER..."
                    value={customItem.model}
                    onChange={(e) => setCustomItem({ ...customItem, model: e.target.value })}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-3 text-[10px] font-semibold outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-3 border border-neutral-200">
                    <span className="text-[9px] font-bold text-neutral-400">EST. PRICE $</span>
                    <input
                      type="number"
                      value={customItem.price}
                      onChange={(e) => setCustomItem({ ...customItem, price: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-transparent outline-none font-black text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-3 border border-neutral-200">
                    <span className="text-[9px] font-bold text-neutral-400">QTY UNIT</span>
                    <input
                      type="number"
                      value={customItem.quantity}
                      onChange={(e) => setCustomItem({ ...customItem, quantity: parseInt(e.target.value) || 1 })}
                      className="w-full bg-transparent outline-none font-black text-xs"
                    />
                  </div>

                  <select
                    value={customItem.type}
                    onChange={(e: any) => setCustomItem({ ...customItem, type: e.target.value })}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest outline-none"
                  >
                    <option value="component">Hardware Component</option>
                    <option value="loom">Cable / Connection Loom</option>
                    <option value="fixture">Fixture / Mounting Bracket</option>
                    <option value="consumable">Tape / Consumables</option>
                  </select>
                </div>

                <button
                  onClick={handleAddCustomItem}
                  className="w-full bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl py-3 font-black uppercase text-[10px] tracking-widest transition"
                >
                  Confirm and Add Model specifications
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-4">
            {loadingItems ? (
              <div className="py-20 text-center">
                <RefreshCw className="animate-spin text-neutral-400 mx-auto" size={28} />
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-2">Loading Virtual Rig Payload...</p>
              </div>
            ) : buildItems.length === 0 ? (
              <div className="bg-white rounded-[2rem] p-16 text-center border border-neutral-100 shadow-sm space-y-4">
                <div className="w-16 h-16 bg-neutral-50 text-neutral-300 rounded-2xl flex items-center justify-center mx-auto">
                  <Construction size={28} />
                </div>
                <h4 className="text-xl font-black uppercase tracking-tighter text-neutral-400">Empty Virtual Rig</h4>
                <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest max-w-sm mx-auto">
                  Onboard devices via the Systems Catalog, add items from your real Gear Library, or search using the AI Integration Engine.
                </p>
              </div>
            ) : (
              buildItems.map(item => (
                <div
                  key={item.id}
                  className={`bg-white p-6 rounded-[2rem] border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group relative ${item.isPushed ? 'border-neutral-100 opacity-70' : 'hover:border-neutral-200 hover:shadow-md border-neutral-100 shadow-sm'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-neutral-50 flex items-center justify-center text-neutral-500">
                      {item.type === 'loom' ? <Cable size={20} /> : <Package size={20} />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black uppercase tracking-tight">{item.name}</h4>
                        {item.isPushed && (
                          <span className="text-[7px] font-mono font-black uppercase text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                            IN VENTORY
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-neutral-400 font-bold uppercase tracking-wider">
                        <span>{item.brand || 'ANY'}</span>
                        <span>•</span>
                        <span>{item.model || 'GENERIC'}</span>
                        <span>•</span>
                        <span className="lowercase text-neutral-400">[{item.category || 'Other'}]</span>
                      </div>
                    </div>
                  </div>

                  {/* Pricing and Controls */}
                  <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-neutral-50 pt-3 md:pt-0">
                    <div className="text-right">
                      <p className="text-xs font-black uppercase text-neutral-800">
                        ${(item.price || 0).toLocaleString()}
                      </p>
                      <p className="text-[8px] font-semibold text-neutral-400 uppercase tracking-widest">
                        Total: ${((item.price || 0) * (item.quantity || 1)).toLocaleString()}
                      </p>
                    </div>

                    {/* Quantity Selector */}
                    <div className="flex items-center border border-neutral-200 rounded-xl bg-neutral-50/50 p-1">
                      <button
                        onClick={() => handleUpdateItemQuantity(item.id, (item.quantity || 1) - 1)}
                        className="w-7 h-7 bg-white hover:bg-neutral-100 rounded-lg text-xs font-bold transition flex items-center justify-center shadow-sm"
                      >
                        -
                      </button>
                      <span className="px-3 text-xs font-black min-w-6 text-center">{item.quantity || 1}</span>
                      <button
                        onClick={() => handleUpdateItemQuantity(item.id, (item.quantity || 1) + 1)}
                        className="w-7 h-7 bg-white hover:bg-neutral-100 rounded-lg text-xs font-bold transition flex items-center justify-center shadow-sm"
                      >
                        +
                      </button>
                    </div>

                    <div className="flex items-center gap-2.5">
                      {!item.isPushed && (
                        <button
                          onClick={() => handlePushToMainInventory(item)}
                          className="bg-neutral-900 text-white rounded-xl py-2 px-3 hover:bg-primary transition text-[8px] font-black uppercase tracking-widest whitespace-nowrap"
                          title="Generate serial & export to main inventory list"
                        >
                          Push to main Inventory
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-neutral-300 hover:text-red-500 transition p-2"
                        title="Delete Piece"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Search Catalogs, Add virtual models */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-neutral-100 shadow-xl overflow-hidden">
            {/* Header / Tabs */}
            <div className="bg-neutral-50 border-b border-neutral-100 p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <Hammer size={18} className="text-neutral-500" />
                <h4 className="text-xs font-black uppercase tracking-widest">Integration Catalog & Spec sources</h4>
              </div>

              <div className="grid grid-cols-3 bg-neutral-100 p-1 rounded-2xl">
                <button
                  onClick={() => setCatalogTab('catalog')}
                  className={`py-2 px-1 text-center rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${catalogTab === 'catalog' ? 'bg-white text-black shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`}
                >
                  Catalogue
                </button>
                <button
                  onClick={() => setCatalogTab('gear')}
                  className={`py-2 px-1 text-center rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${catalogTab === 'gear' ? 'bg-white text-black shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`}
                >
                  My Inventory
                </button>
                <button
                  onClick={() => setCatalogTab('ai')}
                  className={`py-2 px-1 text-center rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${catalogTab === 'ai' ? 'bg-white text-black shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`}
                >
                  AI Scan Specs
                </button>
              </div>
            </div>

            {/* Catalog tab rendering */}
            <div className="p-6 h-[480px] overflow-y-auto">
              {catalogTab === 'catalog' && (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
                    <input
                      placeholder="SEARCH VIRTUAL REFERENCE CATALOGUE..."
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 pl-11 pr-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:bg-white focus:ring-1 focus:ring-neutral-200 transition-all"
                    />
                  </div>

                  <div className="space-y-2.5 pt-2">
                    {filteredCatalog.map((c, i) => (
                      <div
                        key={i}
                        onClick={() => handleAddItemToSandbox({
                          name: c.name,
                          category: c.category,
                          brand: c.brand,
                          model: c.model,
                          price: c.price,
                          type: c.type,
                          quantity: 1
                        })}
                        className="flex items-center justify-between p-3.5 bg-neutral-50/50 hover:bg-neutral-50 hover:scale-[1.01] transition border border-neutral-100 rounded-2xl cursor-pointer"
                      >
                        <div className="min-w-0">
                          <p className="text-[11px] font-black uppercase text-neutral-800 truncate">{c.name}</p>
                          <p className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5 mt-0.5">
                            {c.brand} • {c.model}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[10px] font-black text-[#0066cc]">${c.price.toLocaleString()}</p>
                          <span className="text-[7px] font-mono font-black uppercase text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">
                            + ADD
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {catalogTab === 'gear' && (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
                    <input
                      placeholder="SEARCH OWNED INVENTORY GEAR..."
                      value={gearSearch}
                      onChange={(e) => setGearSearch(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 pl-11 pr-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:bg-white focus:ring-1 focus:ring-neutral-200 transition-all"
                    />
                  </div>

                  <div className="space-y-2.5 pt-2">
                    {filteredGear.length === 0 ? (
                      <div className="text-center py-12 text-neutral-400 text-[10px] font-black uppercase tracking-widest border-2 border-dashed border-neutral-100 rounded-2xl">
                        No equipment matched your search.
                      </div>
                    ) : (
                      filteredGear.map((g) => (
                        <div
                          key={g.id}
                          onClick={() => handleAddItemToSandbox({
                            name: g.name,
                            category: g.category || 'Gear Item',
                            brand: g.brand || '',
                            model: g.model || '',
                            price: g.price || 0,
                            type: 'component',
                            quantity: 1
                          })}
                          className="flex items-center justify-between p-3.5 bg-neutral-50/50 hover:bg-neutral-50 hover:scale-[1.01] transition border border-neutral-100 rounded-2xl cursor-pointer"
                        >
                          <div className="min-w-0">
                            <p className="text-[11px] font-black uppercase text-neutral-800 truncate">{g.name}</p>
                            <p className="text-[8px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5">
                              Tag: {g.assetTag || 'NO TAG'} • {g.status || 'available'}
                            </p>
                          </div>
                          <div className="text-right shrink-0 font-sans">
                            <p className="text-[10px] font-black text-neutral-700">${(g.price || 0).toLocaleString()}</p>
                            <span className="text-[7px] font-mono font-black uppercase text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">
                              + DEPLOY
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {catalogTab === 'ai' && (
                <div className="space-y-6 flex flex-col justify-between h-full pb-8">
                  <div className="space-y-4">
                    <div className="p-4 bg-amber-50 rounded-2xl text-[10px] font-bold text-amber-800 border border-amber-100 flex items-start gap-2.5">
                      <Zap size={14} className="shrink-0 mt-0.5 text-amber-600" />
                      <div>
                        <p className="uppercase tracking-wider font-extrabold mb-1">Onboarding Intelligence Enabled</p>
                        <p className="leading-relaxed">
                          Paste a standard retail product page URL or specify device description. The AI engine will parse exact specifications, prices, weights, and categories automatically.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Payload Source (URL or Description)</label>
                      <textarea
                        rows={4}
                        placeholder="PASTE RETAIL SPEC URL (e.g., BLACKMAGIC DESIGN...) OR TYPE SPECIFICATIONS MANUAL TEXT..."
                        value={aiInput}
                        onChange={(e) => setAiInput(e.target.value)}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl p-4 text-[10px] font-bold outline-none leading-relaxed focus:bg-white transition"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handleAIOnboard}
                    disabled={isAiAnalyzing || !aiInput.trim()}
                    className="w-full bg-neutral-900 hover:bg-neutral-800 text-white rounded-2xl py-4 font-black uppercase text-[10px] tracking-widest disabled:opacity-40 transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    {isAiAnalyzing ? (
                      <>
                        <RefreshCw className="animate-spin" size={14} />
                        <span>Compiling system blueprint payload...</span>
                      </>
                    ) : (
                      <>
                        <Zap size={14} />
                        <span>Process sandbox specifications payload</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Draft Specification Dialog */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] p-8 border border-neutral-100 shadow-2xl space-y-6 overflow-hidden"
            >
              <div className="space-y-1">
                <h3 className="text-xl font-black uppercase tracking-tighter">New Systems Blueprint</h3>
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Define custom integration parameters</p>
              </div>

              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">System Name</label>
                  <input
                    placeholder="e.g. Broadcast flypack workstation rig..."
                    value={newBuildName}
                    onChange={(e) => setNewBuildName(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3.5 text-xs font-semibold outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Design Purpose & specs</label>
                  <textarea
                    rows={3}
                    placeholder="Describe client targets, connectivity specifications, or hardware targets..."
                    value={newBuildDesc}
                    onChange={(e) => setNewBuildDesc(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-xs font-semibold outline-none leading-relaxed"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl py-3.5 text-[10px] font-black uppercase tracking-widest transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateBuild}
                  className="flex-1 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl py-3.5 text-[10px] font-black uppercase tracking-widest transition"
                >
                  Initialize Concept
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
