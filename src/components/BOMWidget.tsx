import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Project, UserProfile, BuildItem } from '../types';
import { motion } from 'motion/react';
import { 
  FileStack, 
  Download, 
  Printer, 
  Search, 
  Filter, 
  ShieldCheck, 
  AlertTriangle,
  Layers,
  ArrowRight,
  Package,
  Building2,
  ListOrdered
} from 'lucide-react';

interface BOMItem extends BuildItem {
  supplierName?: string;
  supplierRating?: number;
}

interface BOMWidgetProps {
  project: Project;
  user: UserProfile;
  items?: any[];
}

export default function BOMWidget({ project, user, items: passedItems }: BOMWidgetProps) {
  const [items, setItems] = useState<BOMItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    if (passedItems) {
      setItems(passedItems);
      return;
    }

    const q = query(
      collection(db, 'buildItems'),
      where('projectId', '==', project.id),
      where('ownerId', '==', user.uid)
    );
    
    const unsub = onSnapshot(q, async (snap) => {
      const buildItems = snap.docs.map(d => ({ id: d.id, ...d.data() } as BuildItem));
      
      // Fetch suppliers to correlate (in a real app we'd link via IDs)
      const supSnap = await getDocs(query(
        collection(db, 'suppliers'),
        where('projectId', '==', project.id),
        where('ownerId', '==', user.uid)
      ));
      const suppliers = supSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      const correlateItems = buildItems.map(item => {
        // Mocking supplier correlation logic
        const supplier = suppliers.find((s: any) => s.category?.toLowerCase().includes(item.category?.toLowerCase() || ''));
        return {
          ...item,
          supplierName: supplier?.name || 'Assigned Needed',
          supplierRating: supplier?.rating || 0
        };
      });

      setItems(correlateItems);
    });

    return unsub;
  }, [project.id, user.uid, passedItems]);

  const filteredItems = items.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          i.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === 'all' || i.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const totalValue = items.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 1), 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h3 className="text-2xl font-black uppercase tracking-tighter">Bill of Materials</h3>
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Validated component list and source correlation</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-3 bg-neutral-100 text-neutral-400 rounded-xl hover:bg-neutral-200 transition">
             <Printer size={20} />
          </button>
          <button className="flex items-center gap-2 bg-neutral-900 text-white px-6 py-3 rounded-2xl hover:bg-black transition shadow-xl font-black uppercase text-[10px] tracking-widest">
            <Download size={16} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-12 xl:col-span-9 space-y-6">
          <div className="flex flex-col sm:flex-row gap-4">
             <div className="relative flex-1">
               <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-neutral-300" size={20} />
               <input 
                 value={searchQuery}
                 onChange={e => setSearchQuery(e.target.value)}
                 placeholder="FILTER BOM COMPONENTS..."
                 className="w-full bg-white border border-neutral-100 rounded-3xl pl-16 pr-6 py-5 text-xs font-black uppercase tracking-widest shadow-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
               />
             </div>
             <div className="flex bg-neutral-100 p-1.5 rounded-[1.5rem] self-center">
               {['all', 'component', 'loom', 'consumable'].map(t => (
                 <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition ${filterType === t ? 'bg-white text-primary shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`}
                 >
                   {t}
                 </button>
               ))}
             </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-neutral-100 shadow-xl overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-neutral-900" />
            <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="bg-neutral-50/50 border-b border-neutral-100">
                    <th className="px-8 py-6 text-[9px] font-black uppercase tracking-widest text-neutral-400">Position</th>
                    <th className="px-8 py-6 text-[9px] font-black uppercase tracking-widest text-neutral-400">Component Details</th>
                    <th className="px-8 py-6 text-[9px] font-black uppercase tracking-widest text-neutral-400">Supplier / Source</th>
                    <th className="px-8 py-6 text-[9px] font-black uppercase tracking-widest text-neutral-400 text-right">Value (Sub)</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-neutral-50 font-bold">
                 {filteredItems.map((item, idx) => (
                   <tr key={item.id} className="hover:bg-neutral-50/50 transition-all group">
                      <td className="px-8 py-5">
                         <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center text-[10px] font-black italic">
                           {(idx + 1).toString().padStart(2, '0')}
                         </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 bg-neutral-50 rounded-xl flex items-center justify-center text-primary">
                             <Package size={20} />
                           </div>
                           <div>
                             <p className="text-sm uppercase tracking-tight font-black">{item.name}</p>
                             <div className="flex items-center gap-2 mt-1">
                                <span className="text-[8px] px-2 py-0.5 bg-neutral-100 rounded-full text-neutral-400 uppercase font-black">{item.type}</span>
                                {item.isPushed && <ShieldCheck size={12} className="text-emerald-500" />}
                             </div>
                           </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                           <Building2 size={14} className={item.supplierRating ? "text-primary" : "text-neutral-200"} />
                           <span className={`text-[10px] font-black uppercase underline decoration-neutral-100 underline-offset-4 ${item.supplierRating ? "text-neutral-600" : "text-neutral-300"}`}>
                             {item.supplierName}
                           </span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right font-mono text-xs">
                        <div className="text-neutral-400 text-[9px] font-black mb-0.5">{item.quantity} x ${item.price?.toLocaleString()}</div>
                        <div className="text-primary font-black">${((item.price || 0) * (item.quantity || 1)).toLocaleString()}</div>
                      </td>
                   </tr>
                 ))}
                 {filteredItems.length === 0 && (
                   <tr>
                     <td colSpan={4} className="px-8 py-20 text-center">
                        <div className="text-neutral-300 font-black uppercase tracking-widest text-[10px]">No matches found in inventory index</div>
                     </td>
                   </tr>
                 )}
               </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-12 xl:col-span-3 space-y-6">
           <div className="bg-neutral-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[300px]">
              <div className="absolute top-0 right-0 w-48 h-48 bg-primary/20 blur-[80px] -mr-24 -mt-24" />
              
              <div className="space-y-6 relative">
                 <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-primary">
                    <Layers size={32} />
                 </div>
                 <div className="space-y-1">
                    <p className="text-white/40 text-[9px] font-black uppercase tracking-widest">Gross BOM Value</p>
                    <h4 className="text-4xl font-black tracking-tighter leading-none">${totalValue.toLocaleString()}</h4>
                 </div>
              </div>

              <div className="space-y-4 pt-8 border-t border-white/5 relative">
                <div className="flex items-center justify-between">
                   <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">Linked Assets</p>
                   <p className="text-sm font-bold">{items.filter(i => i.isPushed).length} / {items.length}</p>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                   <div 
                     className="h-full bg-emerald-500 transition-all duration-1000" 
                     style={{ width: `${(items.filter(i => i.isPushed).length / (items.length || 1)) * 100}%` }} 
                   />
                </div>
              </div>
           </div>

           <div className="bg-white rounded-[2.5rem] p-8 border border-neutral-100 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 text-amber-500 font-black text-[10px] uppercase tracking-widest">
                <AlertTriangle size={16} />
                <span>Supply Chain Risk</span>
              </div>
              <p className="text-[10px] font-bold text-neutral-400 leading-relaxed uppercase tracking-widest">
                3 components in your BOM are currently flaggged with extended lead times. Review local suppliers for redundancy.
              </p>
              <button className="w-full py-3 bg-neutral-50 border border-neutral-100 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] hover:bg-neutral-100 transition">Analyze Leads</button>
           </div>
        </div>
      </div>
    </div>
  );
}
