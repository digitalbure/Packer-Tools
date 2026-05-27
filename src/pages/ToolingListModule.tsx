import React, { useState, useEffect } from 'react';
import { Wrench, Hammer, Plus, Search, Trash2, Edit2, Zap, Package, Tag, Filter, ChevronRight, ChevronDown, CheckCircle2, Circle, RotateCcw, GripVertical, X, Info } from 'lucide-react';
import { collection, query, onSnapshot, doc, addDoc, updateDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { PackingList, PackingItem, UserProfile, AdminSettings } from '../types';
import { toast } from 'sonner';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { suggestToolboxPackout } from '../services/geminiService';

import { canUseAI, trackAIUsage } from '../lib/limitUtils';

export default function ToolingListModule({ user, adminSettings: propAdminSettings }: { user: UserProfile, adminSettings: AdminSettings | null }) {
  const [lists, setLists] = useState<PackingList[]>([]);
  const [settings, setSettings] = useState<AdminSettings | null>(propAdminSettings);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPackoutModalOpen, setIsPackoutModalOpen] = useState(false);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [packoutPlan, setPackoutPlan] = useState<{ groups: { name: string; itemIds: string[]; reasoning: string }[] } | null>(null);
  const [selectedListForPackout, setSelectedListForPackout] = useState<PackingList | null>(null);
  const [listItems, setListItems] = useState<PackingItem[]>([]);
  const [newList, setNewList] = useState<Partial<PackingList>>({
    name: '',
    description: '',
    jobType: 'Construction',
    isTemplate: false
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'packingLists'), (snapshot) => {
      setLists(snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as PackingList))
        .filter(l => l.ownerId === user.uid && l.jobType) // Only lists with jobType (Tooling Lists)
      );
    });

    setLoading(false);
    const unsubscribeSettings = onSnapshot(doc(db, 'adminSettings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as AdminSettings);
      }
    });

    return () => {
      unsubscribe();
      unsubscribeSettings();
    };
  }, [user.uid]);

  const smartPackerName = settings?.aiConfig?.smartPackerName || 'Smart Packer';

  const handleAddList = async () => {
    if (!newList.name) return;
    try {
      await addDoc(collection(db, 'packingLists'), {
        ...newList,
        ownerId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      setIsAddModalOpen(false);
      setNewList({ name: '', description: '', jobType: 'Construction', isTemplate: false });
      toast.success("Tooling list created!");
    } catch (error) {
      toast.error("Failed to create list");
    }
  };

  const handleDeleteList = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'packingLists', id));
      toast.success("List deleted");
    } catch (error) {
      toast.error("Failed to delete list");
    }
  };

  const handleSmartPackout = async (list: PackingList) => {
    const aiCheck = await canUseAI(user, settings);
    if (!aiCheck.allowed) {
      toast.error(aiCheck.reason);
      return;
    }

    setIsAIProcessing(true);
    setSelectedListForPackout(list);
    setIsPackoutModalOpen(true);
    setPackoutPlan(null);
    
    try {
      const itemsSnap = await getDocs(collection(db, 'packingLists', list.id, 'items'));
      const items = itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PackingItem));
      setListItems(items);
      
      if (items.length === 0) {
        toast.error("No items in this list to organize");
        setIsPackoutModalOpen(false);
        return;
      }

      const plan = await suggestToolboxPackout(items);
      await trackAIUsage(user.uid);
      setPackoutPlan(plan);
      toast.success(`${smartPackerName} Packout plan generated!`);
    } catch (error) {
      toast.error(`${smartPackerName} failed to generate packout plan`);
      setIsPackoutModalOpen(false);
    } finally {
      setIsAIProcessing(false);
    }
  };

  if (loading) return <div className="flex justify-center py-24 animate-spin"><Wrench size={48} /></div>;

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
            <Wrench className="text-primary" size={40} />
            <span>{smartPackerName} Tooling Lists</span>
          </h1>
          <p className="text-neutral-500">Specialized packing lists for mechanics, tradies, and construction.</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition shadow-lg"
        >
          <Plus size={20} />
          <span>New Tooling List</span>
        </button>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {lists.map((list) => (
          <div key={list.id} className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 flex items-center gap-2">
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSmartPackout(list);
                }}
                className="p-2 text-primary hover:bg-primary/10 rounded-xl transition"
                title={`${smartPackerName} Packout`}
              >
                <Zap size={18} />
              </button>
              <button 
                onClick={() => handleDeleteList(list.id)}
                className="p-2 text-neutral-300 hover:text-red-500 transition"
              >
                <Trash2 size={18} />
              </button>
            </div>

            <div className="flex items-start justify-between mb-6">
              <div className="space-y-1">
                <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest">
                  {list.jobType}
                </span>
                <h3 className="text-2xl font-bold group-hover:text-primary transition pr-12">{list.name}</h3>
              </div>
            </div>

            <p className="text-sm text-neutral-500 line-clamp-2 mb-6">{list.description}</p>

            <div className="flex items-center justify-between pt-6 border-t border-neutral-50">
              <div className="flex -space-x-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-neutral-100 flex items-center justify-center text-neutral-400">
                    <Package size={14} />
                  </div>
                ))}
              </div>
              <a 
                href={`/packing-list/${list.id}`}
                className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl font-bold text-xs hover:bg-neutral-800 transition"
              >
                <span>Open List</span>
                <ChevronRight size={14} />
              </a>
            </div>
          </div>
        ))}

        {lists.length === 0 && (
          <div className="col-span-full bg-white rounded-2xl sm:rounded-[3rem] p-6 sm:p-20 text-center border border-dashed border-neutral-200 space-y-6">
            <div className="w-24 h-24 bg-neutral-50 rounded-full flex items-center justify-center mx-auto">
              <Hammer size={48} className="text-neutral-200" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold">No tooling lists yet</h3>
              <p className="text-neutral-500 max-w-md mx-auto">
                Create a specialized list for your toolbox or job site packout.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Add List Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-2xl sm:rounded-[3rem] overflow-hidden shadow-2xl"
            >
              <div className="p-5 sm:p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-black">New Tooling List</h2>
                  <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition">
                    <Trash2 size={24} className="text-neutral-400" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest">List Name</label>
                    <input
                      type="text"
                      value={newList.name}
                      onChange={(e) => setNewList({ ...newList, name: e.target.value })}
                      placeholder="e.g., HVAC Service Kit, Electrical Packout"
                      className="w-full px-6 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-primary outline-none transition"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Job Type</label>
                    <select
                      value={newList.jobType}
                      onChange={(e) => setNewList({ ...newList, jobType: e.target.value })}
                      className="w-full px-6 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-primary outline-none transition"
                    >
                      <option>Construction</option>
                      <option>Electrical</option>
                      <option>Plumbing</option>
                      <option>HVAC</option>
                      <option>Mechanic</option>
                      <option>Audio/Visual</option>
                      <option>Other</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Description</label>
                    <textarea
                      value={newList.description}
                      onChange={(e) => setNewList({ ...newList, description: e.target.value })}
                      placeholder="What is this list for?"
                      className="w-full px-6 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-primary outline-none transition h-32"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-4 bg-neutral-100 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-200 transition"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleAddList}
                    className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition shadow-lg"
                  >
                    Create List
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Smart Packout Modal */}
      <AnimatePresence>
        {isPackoutModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-2xl sm:rounded-[3rem] overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            >
              <div className="p-5 sm:p-8 border-b border-neutral-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
                    <Zap size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black">{smartPackerName} Packout Plan</h2>
                    <p className="text-sm text-neutral-500">{selectedListForPackout?.name}</p>
                  </div>
                </div>
                <button onClick={() => setIsPackoutModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition">
                  <X size={24} className="text-neutral-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 sm:space-y-8">
                {isAIProcessing ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="font-bold text-neutral-500 animate-pulse">{smartPackerName} is analyzing your tools...</p>
                  </div>
                ) : packoutPlan ? (
                  <div className="space-y-6">
                    {packoutPlan.groups.map((group, idx) => (
                      <div key={idx} className="bg-neutral-50 rounded-[2rem] p-6 border border-neutral-100 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-bold flex items-center gap-2">
                            <Package className="text-primary" size={20} />
                            {group.name}
                          </h3>
                          <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                            {group.itemIds.length} Items
                          </span>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          {group.itemIds.map(itemId => {
                            const item = listItems.find(i => i.id === itemId);
                            return (
                              <div key={itemId} className="px-3 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-medium shadow-sm">
                                {item?.name || 'Unknown Tool'}
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex items-start gap-2 p-3 bg-white/50 rounded-xl border border-neutral-100 text-xs text-neutral-500 italic">
                          <Info size={14} className="flex-shrink-0 mt-0.5" />
                          <p>{group.reasoning}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20">
                    <p className="text-neutral-400">Failed to generate plan. Please try again.</p>
                  </div>
                )}
              </div>

              <div className="p-8 border-t border-neutral-100 bg-neutral-50/50">
                <button 
                  onClick={() => setIsPackoutModalOpen(false)}
                  className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition shadow-lg"
                >
                  Got it, thanks!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
