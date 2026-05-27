import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Project, BuildItem, UserProfile, GearItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Hammer, 
  Plus, 
  Trash2, 
  Layers, 
  Zap, 
  Settings2, 
  DollarSign, 
  Weight, 
  Maximize, 
  Package, 
  Search, 
  CheckCircle2, 
  ChevronDown, 
  ChevronRight,
  TrendingUp,
  LayoutGrid,
  Cable,
  Wrench,
  Construction,
  Rocket,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

interface BuildModuleProps {
  project: Project;
  user: UserProfile;
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

export default function BuildModule({ project, user }: BuildModuleProps) {
  const [items, setItems] = useState<BuildItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sourceInput, setSourceInput] = useState('');
  const [newItem, setNewItem] = useState<Partial<BuildItem>>({
    name: '',
    category: '',
    type: 'component',
    quantity: 1,
    price: 0
  });

  useEffect(() => {
    const q = query(
      collection(db, 'buildItems'),
      where('projectId', '==', project.id),
      where('ownerId', '==', user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as BuildItem)));
      setLoading(false);
    });
    return unsub;
  }, [project.id, user.uid]);

  const handleAIOnboard = async () => {
    if (!sourceInput) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/analyze-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          productName: sourceInput.startsWith('http') ? '' : sourceInput,
          url: sourceInput.startsWith('http') ? sourceInput : ''
        })
      });
      const data = await res.json();
      setNewItem(prev => ({
        ...prev,
        name: data.name || prev.name,
        brand: data.brand || prev.brand,
        model: data.model || prev.model,
        category: data.category || prev.category,
        price: data.price || prev.price,
        technicalSpecs: data.specs,
        sourceUrl: sourceInput.startsWith('http') ? sourceInput : ''
      }));
      toast.success("Intelligence engine compiled specs!");
    } catch (e) {
      toast.error("AI Analysis failed. Please enter manually.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddItem = async (itemData: Partial<BuildItem>) => {
    try {
      await addDoc(collection(db, 'buildItems'), {
        ...itemData,
        projectId: project.id,
        ownerId: user.uid,
        createdAt: new Date().toISOString(),
        isPushed: false
      });
      toast.success(`${itemData.name} added to sandbox`);
    } catch (e) {
      toast.error("Failed to add item");
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await deleteDoc(doc(db, 'buildItems', itemId));
      toast.success("Item removed from sandbox");
    } catch (e) {
      toast.error("Failed to remove item");
    }
  };

  const handlePushToInventory = async (item: BuildItem) => {
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
        currency: item.currency || 'USD',
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

      toast.success(`${item.name} pushed to main inventory`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to push item to inventory");
    }
  };

  const totalCost = items.reduce((acc, item) => acc + (item.price || 0) * item.quantity, 0);
  const totalCount = items.reduce((acc, item) => acc + item.quantity, 0);

  const filteredCatalog = COMMON_CATALOG.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-12">
      {/* Metrics Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Total Plan Value</p>
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
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Plan Accuracy</p>
            <p className="text-3xl font-black uppercase tracking-tighter">HIGH</p>
          </div>
          <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-3xl flex items-center justify-center">
            <TrendingUp size={28} />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-12">
        {/* Left Column: Build List */}
        <div className="lg:col-span-12 xl:col-span-8 space-y-8">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="text-2xl font-black uppercase tracking-tighter">Virtual Rig</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Integrator Sandbox Plan</p>
            </div>
            <button 
              onClick={() => setIsAddingCustom(true)}
              className="flex items-center gap-2 bg-neutral-900 text-white px-6 py-3 rounded-2xl hover:scale-105 transition shadow-lg font-black uppercase text-[10px] tracking-widest"
            >
              <Plus size={16} />
              <span>Add Custom Item</span>
            </button>
          </div>

          <div className="space-y-4">
            {items.length === 0 ? (
              <div className="bg-neutral-50 rounded-[3rem] p-20 text-center border-2 border-dashed border-neutral-200">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 text-neutral-300">
                  <Construction size={40} />
                </div>
                <h4 className="text-xl font-black uppercase tracking-tighter text-neutral-400">Empty Sandbox</h4>
                <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest mt-2">Start adding components from the catalog or custom entries</p>
              </div>
            ) : (
              items.map(item => (
                <div 
                  key={item.id}
                  className={`bg-white p-6 rounded-[2rem] border transition-all flex items-center justify-between group overflow-hidden relative ${item.isPushed ? 'opacity-60 grayscale' : 'hover:border-primary/20 hover:shadow-xl shadow-sm'}`}
                >
                  <div className="flex items-center gap-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                      item.type === 'loom' ? 'bg-orange-50 text-orange-500' :
                      item.type === 'peripheral' ? 'bg-indigo-50 text-indigo-500' :
                      item.type === 'consumable' ? 'bg-pink-50 text-pink-500' :
                      'bg-neutral-100 text-neutral-500'
                    }`}>
                      {item.type === 'loom' ? <Cable size={24} /> : 
                       item.type === 'peripheral' ? <Zap size={24} /> :
                       <Package size={24} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-lg font-black uppercase tracking-tight">{item.name}</h4>
                        {item.isPushed && (
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500 text-white rounded-full text-[8px] font-black uppercase tracking-widest leading-none">
                            <CheckCircle2 size={10} />
                            <span>Pushed</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{item.category}</span>
                        <span className="w-1 h-1 bg-neutral-200 rounded-full" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{item.brand} {item.model}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-12">
                    <div className="text-right">
                      <p className="text-lg font-black uppercase tracking-tight">x{item.quantity}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">${((item.price || 0) * item.quantity).toLocaleString()}</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {!item.isPushed && (
                        <button 
                          onClick={() => handlePushToInventory(item)}
                          className="p-3 bg-neutral-900 text-white rounded-xl hover:scale-110 active:scale-95 transition shadow-lg opacity-0 group-hover:opacity-100"
                          title="Push to Core Inventory"
                        >
                          <Rocket size={18} />
                        </button>
                      )}
                      <button 
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-3 bg-red-50 text-red-500 rounded-xl hover:scale-110 active:scale-95 transition opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Catalog/Sidebar */}
        <div className="lg:col-span-12 xl:col-span-4 space-y-8">
           <div className="bg-neutral-900 rounded-[3rem] p-10 text-white space-y-8 shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-48 h-48 bg-primary/20 blur-[100px] -mr-24 -mt-24" />
             
             <div className="space-y-2 relative">
               <h3 className="text-xl font-black uppercase tracking-tighter">Sandbox Catalog</h3>
               <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Quick-start with common components</p>
             </div>

             <div className="relative">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600" size={16} />
               <input 
                 placeholder="SEARCH CATALOG..."
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-3.5 text-[10px] font-black uppercase tracking-widest focus:bg-white/10 focus:ring-1 focus:ring-primary transition-all outline-none"
               />
             </div>

             <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
               {filteredCatalog.map((c, i) => (
                 <button
                   key={i}
                   onClick={() => handleAddItem(c)}
                   className="w-full p-5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-left transition-all group flex items-center justify-between"
                 >
                   <div className="min-w-0">
                     <p className="font-bold text-sm truncate">{c.name}</p>
                     <p className="text-[9px] text-neutral-500 font-black uppercase tracking-widest mt-1">{c.category}</p>
                   </div>
                   <div className="flex items-center gap-4 shrink-0">
                      <span className="text-xs font-black text-neutral-400">${c.price}</span>
                      <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-primary group-hover:scale-110 transition">
                        <Plus size={16} />
                      </div>
                   </div>
                 </button>
               ))}
             </div>
           </div>

           <div className="bg-primary/5 rounded-[2.5rem] p-8 border border-primary/10">
              <div className="flex items-center gap-3 mb-4">
                 <Wrench size={20} className="text-primary" />
                 <h4 className="text-sm font-black uppercase tracking-tighter">Onboarding Tip</h4>
              </div>
              <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest leading-relaxed">
                Items in Build Mode are "virtual". You can analyze sizing, rack space, and total cost before committing to a purchase or inventory entry. Use "Push to Inventory" once the item is physically acquired.
              </p>
           </div>
        </div>
      </div>

      <AnimatePresence>
        {isAddingCustom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => setIsAddingCustom(false)}
               className="absolute inset-0 bg-neutral-900/60 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[3rem] p-10 shadow-2xl space-y-8"
            >
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <div className="w-12 h-12 bg-neutral-900 text-white rounded-2xl flex items-center justify-center">
                     <Hammer size={24} />
                   </div>
                   <h3 className="text-2xl font-black uppercase tracking-tighter">Custom Sandbox Item</h3>
                 </div>
                 <button onClick={() => setIsAddingCustom(false)} className="p-2 hover:bg-neutral-100 rounded-full">
                   <Plus size={24} className="rotate-45" />
                 </button>
              </div>

              <div className="space-y-6">
                <div className="bg-neutral-900 p-6 rounded-[2rem] space-y-4 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-[50px] -mr-16 -mt-16" />
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 relative">Intelligent Onboarding</label>
                  <div className="flex gap-2 relative">
                    <input 
                      value={sourceInput}
                      onChange={e => setSourceInput(e.target.value)}
                      placeholder="PASTE URL OR PRODUCT NAME..."
                      className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black tracking-widest text-white outline-none focus:bg-white/10"
                    />
                    <button 
                      onClick={handleAIOnboard}
                      disabled={isAnalyzing}
                      className="px-6 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 disabled:opacity-50 transition"
                    >
                      {isAnalyzing ? <RefreshCw className="animate-spin" size={14} /> : <Zap size={14} />}
                    </button>
                  </div>
                  {newItem.technicalSpecs && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 bg-white/5 rounded-xl border border-white/10 grid grid-cols-2 gap-2">
                       <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">IO: {newItem.technicalSpecs.ioCount || 'N/A'}</span>
                       <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">V: {newItem.technicalSpecs.voltage || 'N/A'}</span>
                    </motion.div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-4">Item Name</label>
                    <input 
                      value={newItem.name}
                      onChange={e => setNewItem({...newItem, name: e.target.value})}
                      placeholder="e.g. CUSTOM RIG XL"
                      className="w-full px-6 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-4">Type</label>
                    <select 
                      value={newItem.type}
                      onChange={e => setNewItem({...newItem, type: e.target.value as any})}
                      className="w-full px-6 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold outline-none"
                    >
                      <option value="component">Component</option>
                      <option value="loom">Loom</option>
                      <option value="peripheral">Peripheral</option>
                      <option value="consumable">Consumable</option>
                      <option value="fixture">Fixture</option>
                      <option value="fitting">Fitting</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-4">Quantity</label>
                    <input 
                      type="number"
                      value={newItem.quantity}
                      onChange={e => setNewItem({...newItem, quantity: Number(e.target.value)})}
                      className="w-full px-6 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-4">Est. Price (Each)</label>
                  <input 
                    type="number"
                    value={newItem.price}
                    onChange={e => setNewItem({...newItem, price: Number(e.target.value)})}
                    className="w-full px-6 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold outline-none"
                  />
                </div>
              </div>
            </div>

            <button 
                onClick={() => {
                  handleAddItem(newItem);
                  setIsAddingCustom(false);
                  setNewItem({ name: '', category: '', type: 'component', quantity: 1, price: 0 });
                }}
                className="w-full py-5 bg-neutral-900 text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition"
              >
                Onboard to Sandbox
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
