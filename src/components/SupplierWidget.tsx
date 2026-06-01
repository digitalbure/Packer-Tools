import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Project, UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  Search, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Truck, 
  DollarSign, 
  Phone, 
  Mail, 
  Globe,
  Star,
  ShieldCheck,
  Package,
  ArrowRight,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';

interface Supplier {
  id: string;
  projectId: string;
  name: string;
  category: string;
  website?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  rating: number;
  isPreferred: boolean;
  notes?: string;
  createdAt: string;
}

interface SupplierWidgetProps {
  project: Project;
  user: UserProfile;
}

const MOCK_SUPPLIERS_CATALOG = [
  { name: 'B&H Photo Video', category: 'AV Gear', website: 'bhphotovideo.com', email: 'sales@bhphoto.com' },
  { name: 'Markertek', category: 'Cables & Parts', website: 'markertek.com', email: 'support@markertek.com' },
  { name: 'Sweetwater', category: 'Audio Gear', website: 'sweetwater.com', email: 'sales@sweetwater.com' },
  { name: 'Full Compass', category: 'AV Equipment', website: 'fullcompass.com', email: 'sales@fullcompass.com' },
  { name: 'Thomann', category: 'Audio/Light', website: 'thomann.de', email: 'sales@thomann.de' },
];

export default function SupplierWidget({ project, user }: SupplierWidgetProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newSupplier, setNewSupplier] = useState<Partial<Supplier>>({
    name: '',
    category: '',
    rating: 5,
    isPreferred: false
  });

  const [scraperEnabled, setScraperEnabled] = useState(false);
  const [scraperModel, setScraperModel] = useState("gemini-3.5-flash");
  const [vendorsCatalog, setVendorsCatalog] = useState<any[]>([]);
  const [catalogSource, setCatalogSource] = useState("Loading...");
  const [isSearchingCatalog, setIsSearchingCatalog] = useState(false);

  // Sync settings
  useEffect(() => {
    // Import doc from firebase/firestore safely
    const { doc } = require('firebase/firestore');
    const unsub = onSnapshot(doc(db, 'adminSettings', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data?.integrationConfig) {
          setScraperEnabled(!!data.integrationConfig.supplierScraperServiceEnabled);
          setScraperModel(data.integrationConfig.supplierScraperModel || "gemini-3.5-flash");
        }
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'suppliers'),
      where('projectId', '==', project.id),
      where('ownerId', '==', user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)));
    });
    return unsub;
  }, [project.id, user.uid]);

  // Fetch catalog from live API or fall back local
  useEffect(() => {
    let active = true;
    const fetchCatalog = async () => {
      setIsSearchingCatalog(true);
      try {
        const res = await fetch("/api/services/suppliers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: searchQuery,
            isEnabled: scraperEnabled,
            modelName: scraperModel
          })
        });
        const data = await res.json();
        if (active && data.status === "success") {
          setVendorsCatalog(data.suppliers || []);
          setCatalogSource(data.source || "Static Catalog");
        }
      } catch (err) {
        console.error("Supplier search fail:", err);
      } finally {
        if (active) setIsSearchingCatalog(false);
      }
    };

    const handler = setTimeout(() => {
      fetchCatalog();
    }, 450);

    return () => {
      active = false;
      clearTimeout(handler);
    };
  }, [searchQuery, scraperEnabled, scraperModel]);

  const handleAddSupplier = async (data: Partial<Supplier>) => {
    try {
      await addDoc(collection(db, 'suppliers'), {
        ...data,
        projectId: project.id,
        ownerId: user.uid,
        createdAt: new Date().toISOString()
      });
      toast.success(`${data.name} added to suppliers`);
    } catch (e) {
      toast.error("Failed to add supplier");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'suppliers', id));
      toast.success("Supplier removed");
    } catch (e) {
      toast.error("Failed to remove supplier");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-black uppercase tracking-tighter">Project Suppliers</h3>
            <span className="font-mono text-[9px] text-[#ff4f3a] bg-[#ff4f3a]/10 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">v1.0.5</span>
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Manage vendors and search marketplace</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 bg-neutral-900 text-white px-6 py-3 rounded-2xl hover:bg-black transition shadow-lg font-black uppercase text-[10px] tracking-widest"
        >
          <Plus size={16} />
          <span>Add Custom Vendor</span>
        </button>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Active Suppliers List */}
        <div className="lg:col-span-12 xl:col-span-8 space-y-4">
          {suppliers.length === 0 ? (
            <div className="bg-neutral-50 rounded-[2.5rem] p-16 text-center border-2 border-dashed border-neutral-200">
               <div className="w-20 h-20 bg-white rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-neutral-300 shadow-sm">
                  <Building2 size={40} />
               </div>
               <h4 className="text-xl font-black uppercase tracking-tighter text-neutral-400">No Dedicated Suppliers</h4>
               <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest mt-2">Start adding vendors from the catalog or search below</p>
            </div>
          ) : (
            suppliers.map(s => (
              <div key={s.id} className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm hover:shadow-xl transition-all group flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${s.isPreferred ? 'bg-amber-50 text-amber-500' : 'bg-neutral-50 text-neutral-400'}`}>
                    <Building2 size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                       <h4 className="text-lg font-black uppercase tracking-tight">{s.name}</h4>
                       {s.isPreferred && <ShieldCheck size={16} className="text-amber-500" />}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{s.category}</span>
                      <span className="w-1 h-1 bg-neutral-200 rounded-full" />
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={10} className={i < s.rating ? "text-amber-400 fill-amber-400" : "text-neutral-200"} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    {s.website && (
                      <a href={`https://${s.website}`} target="_blank" rel="noreferrer" className="p-3 bg-neutral-50 text-neutral-400 rounded-xl hover:bg-neutral-100 transition">
                        <Globe size={18} />
                      </a>
                    )}
                    {s.email && (
                      <a href={`mailto:${s.email}`} className="p-3 bg-neutral-50 text-neutral-400 rounded-xl hover:bg-neutral-100 transition">
                        <Mail size={18} />
                      </a>
                    )}
                  </div>
                  <button 
                    onClick={() => handleDelete(s.id)}
                    className="p-3 text-neutral-200 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Global Marketplace Search */}
        <div className="lg:col-span-12 xl:col-span-4 space-y-6">
          <div className="bg-neutral-900 rounded-[3rem] p-8 text-white space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-[60px] -mr-16 -mt-16" />
            
            <div className="space-y-1 relative">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black uppercase tracking-tighter italic">Vendor Scraper</h3>
                <span className="font-mono text-[8px] bg-white/10 text-white/80 px-2 py-0.5 rounded-full">{scraperEnabled ? "LIVE SCAPE AI" : "LOCAL CACHE"}</span>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Source: {catalogSource}</p>
            </div>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600" size={16} />
              <input 
                placeholder="SEARCH MARKETPLACE..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-[10px] font-black uppercase tracking-widest focus:bg-white/10 outline-none transition-all"
              />
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
              {isSearchingCatalog ? (
                <div className="py-8 text-center text-neutral-500 font-mono text-[10px]">
                  <span className="animate-pulse">CRAWLING GLOBAL DIRECTORIES...</span>
                </div>
              ) : vendorsCatalog.length === 0 ? (
                <div className="py-8 text-center text-neutral-500 font-mono text-[10px]">
                  NO VENDORS FOUND
                </div>
              ) : (
                vendorsCatalog.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => handleAddSupplier({ ...c, rating: c.rating || 5, isPreferred: false })}
                    className="w-full p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-left transition-all group flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-sm truncate">{c.name}</p>
                      <p className="text-[9px] text-neutral-500 font-black uppercase tracking-widest mt-1">{c.category}</p>
                      {c.notes && <p className="text-[9px] text-neutral-400 mt-1 italic line-clamp-1">{c.notes}</p>}
                    </div>
                    <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-primary group-hover:scale-110 transition shrink-0">
                      <Plus size={16} />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="bg-emerald-50 rounded-[2.5rem] p-8 border border-emerald-100 flex items-start gap-4">
             <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-500 shrink-0 shadow-sm">
                <Truck size={24} />
             </div>
             <div className="space-y-1">
               <h4 className="text-xs font-black uppercase tracking-tighter text-emerald-900">Shipping Analyzer</h4>
               <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest leading-relaxed">
                 Intelligently calculates estimated shipping based on supplier location and project requirements.
               </p>
             </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               onClick={() => setIsAdding(false)}
               className="absolute inset-0 bg-neutral-900/40 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[3rem] p-10 shadow-2xl space-y-8"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black uppercase tracking-tighter">Add Vendor</h3>
                <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-neutral-100 rounded-full transition">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-4">Supplier Name</label>
                  <input 
                    value={newSupplier.name}
                    onChange={e => setNewSupplier({...newSupplier, name: e.target.value})}
                    placeholder="e.g. CUSTOM FAB"
                    className="w-full px-6 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-4">Website</label>
                  <input 
                    value={newSupplier.website}
                    onChange={e => setNewSupplier({...newSupplier, website: e.target.value})}
                    placeholder="example.com"
                    className="w-full px-6 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-4">Category</label>
                    <input 
                      value={newSupplier.category}
                      onChange={e => setNewSupplier({...newSupplier, category: e.target.value})}
                      placeholder="e.g. Cables"
                      className="w-full px-6 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-4">Rating (1-5)</label>
                    <input 
                      type="number" min="1" max="5"
                      value={newSupplier.rating}
                      onChange={e => setNewSupplier({...newSupplier, rating: Number(e.target.value)})}
                      className="w-full px-6 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold outline-none"
                    />
                  </div>
                </div>
              </div>

              <button 
                onClick={() => {
                  handleAddSupplier(newSupplier);
                  setIsAdding(false);
                }}
                className="w-full py-5 bg-neutral-900 text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition"
              >
                Onboard Vendor
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const X = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
