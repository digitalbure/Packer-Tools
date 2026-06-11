import React, { useState, useEffect, useMemo } from 'react';
import { Box, Package, Plus, Search, Trash2, Edit2, Zap, ArrowRight, Weight as WeightIcon, Ruler, LayoutGrid, List, CheckCircle2, Layout, Lock, Camera, QrCode, Luggage, Briefcase, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { collection, query, onSnapshot, doc, addDoc, updateDoc, deleteDoc, getDocs, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Container, GearItem, UserProfile, AdminSettings, PackingList } from '../types';
import { compressImage } from '../lib/imageUtils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { suggestPackingPlan } from '../services/geminiService';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { canUseAI, trackAIUsage } from '../lib/limitUtils';

const DraggableGearItem = ({ item, isOverlay = false }: { item: GearItem, isOverlay?: boolean }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: item.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`flex items-center justify-between p-4 bg-white rounded-2xl border border-neutral-100 group hover:border-primary transition cursor-grab active:cursor-grabbing ${isOverlay ? 'shadow-2xl' : 'shadow-sm'}`}
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-neutral-50 rounded-xl flex items-center justify-center text-neutral-400 group-hover:text-primary transition shadow-sm">
          <Package size={20} />
        </div>
        <div>
          <p className="font-bold text-sm">{item.name}</p>
          <p className="text-[10px] text-neutral-400 uppercase font-black">{item.category}</p>
        </div>
      </div>
      <div className="p-2 bg-neutral-50 rounded-lg text-neutral-300 group-hover:text-primary transition">
        <ArrowRight size={16} />
      </div>
    </div>
  );
};

const DroppableContainer = ({ 
  container, 
  containers,
  gear, 
  onDelete, 
  onRemoveItem, 
  onAssignItem, 
  onOpenLibrary,
  onEdit,
  packingLists
}: { 
  container: Container, 
  containers: Container[],
  gear: GearItem[], 
  onDelete: (id: string) => void,
  onRemoveItem: (containerId: string, itemId: string) => void,
  onAssignItem: (containerId: string, itemId: string) => void,
  onOpenLibrary: (containerId: string) => void,
  onEdit: (container: Container) => void,
  packingLists: PackingList[]
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { isOver, setNodeRef } = useDroppable({
    id: `container-${container.id}`,
  });

  const getContainerIcon = (type: string) => {
    switch (type) {
      case 'shelf': return <Layout size={24} />;
      case 'locker': return <Lock size={24} />;
      case 'bag': return <Luggage size={24} />;
      case 'case':
      case 'pelican':
      case 'nanuk': return <Briefcase size={24} />;
      case 'pouch': return <Package size={24} />;
      case 'compartment': return <LayoutGrid size={24} />;
      case 'box': return <Box size={24} />;
      default: return <Box size={24} />;
    }
  };

  const statusColors: Record<string, string> = {
    storage: 'bg-neutral-100 text-neutral-500',
    transit: 'bg-blue-100 text-blue-600',
    deployed: 'bg-primary/10 text-primary',
    maintenance: 'bg-amber-100 text-amber-600'
  };

  const linkedList = packingLists.find(l => l.id === container.packingListId);

  const handleHeaderClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    setIsOpen(!isOpen);
  };

  return (
    <div 
      ref={setNodeRef}
      className={`bg-white rounded-[2.5rem] border transition-all duration-300 space-y-0 group overflow-hidden flex flex-col ${
        isOpen ? 'h-full' : 'h-48 shadow-sm hover:shadow-md'
      } ${
        isOver ? 'border-primary ring-4 ring-primary/10 bg-primary/5 scale-[1.02]' : 'border-neutral-100 shadow-sm'
      }`}
    >
      <div 
        onClick={handleHeaderClick}
        className="h-48 relative overflow-hidden bg-neutral-100 shrink-0 cursor-pointer select-none"
      >
        {container.photoUrls?.[0] ? (
          <img src={container.photoUrls[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-300">
            {getContainerIcon(container.type)}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30" />
        
        <div className="absolute top-6 left-6 flex gap-2">
          {linkedList && (
            <div className="px-3 py-1.5 bg-neutral-900/70 backdrop-blur-md rounded-xl flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${linkedList.stage === 'actual' ? 'bg-green-500' : 'bg-neutral-400'}`} />
              <span className="text-[8px] font-black uppercase tracking-widest text-white">
                {linkedList.stage || 'proposed'} v{linkedList.version || 1}
              </span>
            </div>
          )}
        </div>

        <div className="absolute top-6 right-6 flex gap-2 z-10">
          <button 
            onClick={() => onEdit(container)}
            className="p-3 bg-white/15 backdrop-blur-md text-white rounded-xl hover:bg-white/30 transition shadow-sm"
            title="Edit specifications"
          >
            <Edit2 size={18} />
          </button>
          <button 
            onClick={() => onDelete(container.id)}
            className="p-3 bg-white/15 backdrop-blur-md text-white hover:bg-red-500 transition rounded-xl shadow-sm"
            title="Delete Container"
          >
            <Trash2 size={18} />
          </button>
        </div>

        <div className="absolute bottom-6 left-8 flex flex-col gap-1 pr-6 w-full">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-white text-black shadow-sm">
              {container.type}
            </span>
            {container.status && (
              <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm ${statusColors[container.status] || 'bg-white text-black'}`}>
                {container.status}
              </span>
            )}
            <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-black/40 text-white backdrop-blur-sm border border-white/10">
              {container.items.length} {container.items.length === 1 ? 'Item' : 'Items'}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 mr-8">
            <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter leading-none truncate max-w-[210px]">
              {container.name}
            </h3>
            <div className="text-white/80 shrink-0">
              {isOpen ? <ChevronUp size={22} /> : <ChevronDown size={22} />}
            </div>
          </div>
          <p className="text-[8px] font-black uppercase tracking-wider text-white/50">
            {isOpen ? 'Click head to collapse contents' : 'Click head to expand contents'}
          </p>
        </div>
      </div>

      {isOpen && (
        <div className="p-6 md:p-8 space-y-6 flex-1 flex flex-col min-h-0">
          {container.description && (
            <p className="text-xs text-neutral-500 line-clamp-2 italic leading-relaxed">"{container.description}"</p>
          )}

          <div className="space-y-4 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-neutral-400">
              <span>Case Contents</span>
              <button 
                onClick={() => onEdit(container)} 
                className="text-xs text-primary font-bold hover:underline normal-case tracking-normal"
              >
                Edit Case Spec
              </button>
            </div>
            
            <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
              {container.items.map(itemId => {
                const item = gear.find(g => g.id === itemId);
                const isKit = item?.isKit || item?.category === 'Kit' || item?.category === 'Kits';
                
                return (
                  <div key={itemId} className="space-y-1.5 p-1 bg-neutral-50/70 border border-neutral-100 rounded-2xl">
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-neutral-100 shadow-sm group/item">
                      <div className="flex items-center gap-3 truncate">
                        {isKit ? <Layers size={14} className="text-primary shrink-0 animate-pulse" /> : <Package size={14} className="text-neutral-400 shrink-0" />}
                        <span className="text-sm font-bold truncate flex items-center gap-1.5">
                          {item?.name || 'Unknown Item'}
                          {isKit && (
                            <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase font-black tracking-widest">
                              Kit
                            </span>
                          )}
                        </span>
                      </div>
                      <button 
                        onClick={() => onRemoveItem(container.id, itemId)}
                        className="text-neutral-300 hover:text-red-500 transition shrink-0 opacity-0 group-hover/item:opacity-100 p-1 rounded hover:bg-neutral-50"
                        title="Remove from Container"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {isKit && item?.childItemIds && item.childItemIds.length > 0 && (
                      <div className="pl-6 pr-3 pb-3 space-y-1.5">
                        <p className="text-[8px] font-black uppercase text-neutral-400 tracking-widest">Kit Contents ({item.childItemIds.length})</p>
                        <div className="space-y-1">
                          {item.childItemIds.map(childId => {
                            const child = gear.find(g => g.id === childId);
                            return (
                              <div key={childId} className="flex items-center gap-2 px-2.5 py-1.5 bg-neutral-100/50 rounded-lg text-neutral-600 text-xs">
                                <Package size={10} className="text-neutral-400" />
                                <span className="font-semibold truncate">{child?.name || 'Loading sub-item...'}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {container.items.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-neutral-300 space-y-2">
                  <Box size={32} strokeWidth={1} />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Empty Container</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t border-neutral-50 shrink-0">
            <div className="relative group/add flex-1">
              <button className="w-full py-3 bg-neutral-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-black transition flex items-center justify-center gap-2">
                <Plus size={14} />
                <span>Quick Pack</span>
              </button>
              <div className="absolute bottom-full left-0 w-full mb-2 bg-white border border-neutral-100 rounded-2xl shadow-2xl p-4 hidden group-hover/add:block z-20 max-h-48 overflow-y-auto custom-scrollbar">
                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">Nearby Unassigned</p>
                <div className="space-y-2">
                  {gear.filter(g => !containers.some(c => c.items.includes(g.id))).slice(0, 10).map(item => {
                    const isItemKit = item.isKit || item.category === 'Kit' || item.category === 'Kits';
                    return (
                      <button
                        key={item.id}
                        onClick={() => onAssignItem(container.id, item.id)}
                        className="w-full text-left p-2 hover:bg-neutral-50 rounded-lg text-xs font-bold transition flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 truncate">
                          {isItemKit ? <Layers size={12} className="text-primary shrink-0" /> : <Package size={12} className="text-neutral-300 shrink-0" />}
                          <span className="truncate">{item.name}</span>
                        </div>
                        {isItemKit && (
                          <span className="text-[7px] bg-primary/10 text-primary px-1 rounded font-black uppercase scale-90">Kit</span>
                        )}
                      </button>
                    );
                  })}
                  {gear.filter(g => !containers.some(c => c.items.includes(g.id))).length === 0 && (
                    <p className="text-[10px] text-neutral-400 italic py-2">No unassigned gear</p>
                  )}
                </div>
              </div>
            </div>
            <button 
              onClick={() => onOpenLibrary(container.id)}
              className="px-4 py-3 bg-neutral-100 text-neutral-600 rounded-xl hover:bg-neutral-200 transition flex items-center justify-center"
              title="Browse Gear Library"
            >
              <Search size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default function OrganizerModule({ user, adminSettings: propAdminSettings }: { user: UserProfile, adminSettings: AdminSettings | null }) {
  const [containers, setContainers] = useState<Container[]>([]);
  const [gear, setGear] = useState<GearItem[]>([]);
  const [packingLists, setPackingLists] = useState<PackingList[]>([]);
  const [settings, setSettings] = useState<AdminSettings | null>(propAdminSettings);
  const [loading, setLoading] = useState(true);
  const [isAIProcessing, setIsAIProcessing] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [libraryCategoryFilter, setLibraryCategoryFilter] = useState('All');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedLibraryItems, setSelectedLibraryItems] = useState<string[]>([]);
  const [packingSuggestions, setPackingSuggestions] = useState<{ containerId: string; itemIds: string[]; reasoning: string }[] | null>(null);
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const filteredLibraryItems = useMemo(() => {
    return gear.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(librarySearchQuery.toLowerCase()) ||
                          (item.assetTag || '').toLowerCase().includes(librarySearchQuery.toLowerCase());
      
      const isKit = item.isKit || item.category === 'Kit' || item.category === 'Kits';
      
      if (libraryCategoryFilter === 'Kits') {
        return matchesSearch && isKit;
      }
      
      const matchesCategory = libraryCategoryFilter === 'All' || item.category === libraryCategoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [gear, librarySearchQuery, libraryCategoryFilter]);

  const [newContainer, setNewContainer] = useState<Partial<Container>>({
    type: 'toolbox',
    name: '',
    items: [],
    locationDetails: {
      row: '',
      level: '',
      bin: ''
    }
  });
  const [editingContainerId, setEditingContainerId] = useState<string | null>(null);

  useEffect(() => {
    const containersPath = `users/${user.uid}/containers`;
    const unsubscribeContainers = onSnapshot(collection(db, 'users', user.uid, 'containers'), (snapshot) => {
      setContainers(snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Container))
      );
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, containersPath);
    });

    const gearPath = `users/${user.uid}/gearLibrary`;
    const unsubscribeGear = onSnapshot(collection(db, 'users', user.uid, 'gearLibrary'), (snapshot) => {
      setGear(snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as GearItem))
      );
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, gearPath);
    });

    const unsubscribeLists = onSnapshot(query(collection(db, 'packingLists'), where('ownerId', '==', user.uid)), (snapshot) => {
      setPackingLists(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PackingList)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'packingLists');
    });

    setLoading(false);
    const unsubscribeSettings = onSnapshot(doc(db, 'adminSettings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as AdminSettings);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'adminSettings/global');
    });

    return () => {
      unsubscribeContainers();
      unsubscribeGear();
      unsubscribeLists();
      unsubscribeSettings();
    };
  }, [user.uid]);

  const smartPackerName = settings?.aiConfig?.smartPackerName || 'Smart Packer';

  const handleAddContainer = async () => {
    if (!newContainer.name) return;
    try {
      const containerData = {
        ...newContainer,
        ownerId: user.uid,
        updatedAt: new Date().toISOString()
      };

      // Sanitize properties that shouldn't be updated as document properties (like document id)
      const { id, createdAt, ...cleanData } = containerData as any;

      if (editingContainerId) {
        await updateDoc(doc(db, 'users', user.uid, 'containers', editingContainerId), cleanData);
        toast.success("Case updated!");
      } else {
        await addDoc(collection(db, 'users', user.uid, 'containers'), {
          ...cleanData,
          createdAt: new Date().toISOString(),
          items: []
        });
        toast.success("Case added successfully!");
      }
      setIsAddModalOpen(false);
      setEditingContainerId(null);
      setNewContainer({ 
        type: 'bag', 
        name: '', 
        items: [],
        status: 'storage',
        locationDetails: { row: '', level: '', bin: '' },
        photoUrls: []
      });
    } catch (error) {
      toast.error("Failed to save case");
    }
  };

  const handleRemoveRecommendedItem = (containerId: string, itemId: string) => {
    if (!packingSuggestions) return;
    setPackingSuggestions(prev => {
      if (!prev) return null;
      return prev.map(s => {
        if (s.containerId === containerId) {
          return {
            ...s,
            itemIds: s.itemIds.filter(id => id !== itemId)
          };
        }
        return s;
      }).filter(s => s.itemIds.length > 0);
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const compressed = await compressImage(file);
      setNewContainer(prev => ({
        ...prev,
        photoUrls: [compressed, ...(prev.photoUrls || [])]
      }));
      toast.success("Photo added!");
    } catch (err) {
      toast.error("Photo upload failed");
    }
  };

  const handleDeleteContainer = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'containers', id));
      toast.success("Container deleted");
    } catch (error) {
      toast.error("Failed to delete container");
    }
  };

  const handleSmartOrganize = async () => {
    const aiCheck = await canUseAI(user, settings);
    if (!aiCheck.allowed) {
      toast.error(aiCheck.reason);
      return;
    }

    setIsAIProcessing(true);
    try {
      const unassignedItems = gear.filter(g => !containers.some(c => c.items.includes(g.id)));
      if (unassignedItems.length === 0) {
        toast.info("All items are already assigned to containers!");
        return;
      }

      if (containers.length === 0) {
        toast.error("Please add at least one container first");
        return;
      }

      const plan = await suggestPackingPlan(unassignedItems, containers);
      await trackAIUsage(user.uid);
      
      setPackingSuggestions(plan);
      setShowSuggestionsModal(true);
    } catch (error) {
      toast.error(`${smartPackerName} failed to organize items`);
    } finally {
      setIsAIProcessing(false);
    }
  };

  const handleApplySuggestions = async () => {
    if (!packingSuggestions) return;
    
    setIsAIProcessing(true);
    try {
      const batch = [];
      for (const containerPlan of packingSuggestions) {
        const container = containers.find(c => c.id === containerPlan.containerId);
        if (container) {
          const updatedItems = [...new Set([...container.items, ...containerPlan.itemIds])];
          batch.push(updateDoc(doc(db, 'users', user.uid, 'containers', container.id), {
            items: updatedItems,
            updatedAt: new Date().toISOString()
          }));
        }
      }

      await Promise.all(batch);
      toast.success(`${smartPackerName} suggested packing plan applied!`);
      setShowSuggestionsModal(false);
      setPackingSuggestions(null);
    } catch (error) {
      toast.error("Failed to apply suggestions");
    } finally {
      setIsAIProcessing(false);
    }
  };

  const handleRemoveItemFromContainer = async (containerId: string, itemId: string) => {
    try {
      const container = containers.find(c => c.id === containerId);
      if (!container) return;
      
      const updatedItems = container.items.filter(id => id !== itemId);
      await updateDoc(doc(db, 'users', user.uid, 'containers', containerId), {
        items: updatedItems,
        updatedAt: new Date().toISOString()
      });
      toast.success("Item removed from container");
    } catch (error) {
      toast.error("Failed to remove item");
    }
  };

  const handleAssignMultipleItems = async (containerId: string, itemIds: string[]) => {
    try {
      const batch = [];
      const container = containers.find(c => c.id === containerId);
      if (!container) return;

      let updatedItems = [...container.items];

      for (const itemId of itemIds) {
        const previousContainer = containers.find(c => c.items.includes(itemId));
        if (previousContainer && previousContainer.id !== containerId) {
          const updatedPreviousItems = previousContainer.items.filter(id => id !== itemId);
          batch.push(updateDoc(doc(db, 'users', user.uid, 'containers', previousContainer.id), {
            items: updatedPreviousItems,
            updatedAt: new Date().toISOString()
          }));
        }
        updatedItems.push(itemId);
      }

      updatedItems = [...new Set(updatedItems)];
      batch.push(updateDoc(doc(db, 'users', user.uid, 'containers', containerId), {
        items: updatedItems,
        updatedAt: new Date().toISOString()
      }));

      await Promise.all(batch);
      toast.success(`${itemIds.length} items assigned to container`);
    } catch (error) {
      toast.error("Failed to assign items");
    }
  };

  const handleAssignItem = async (containerId: string, itemId: string) => {
    return handleAssignMultipleItems(containerId, [itemId]);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const itemId = active.id as string;
    const overId = over.id as string;

    // Check if dropped over a container
    if (overId.startsWith('container-')) {
      const containerId = overId.replace('container-', '');
      await handleAssignItem(containerId, itemId);
    }
  };

  if (loading) return <div className="flex justify-center py-24 animate-spin"><Box size={48} /></div>;

  const unassignedGear = gear.filter(g => !containers.some(c => c.items.includes(g.id)));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
            <Luggage className="text-primary" size={40} />
            <span>Bags, Cases & Organizer</span>
          </h1>
          <p className="text-neutral-500">Track your bags, cases and storage units. Scan and organize with {smartPackerName}.</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleSmartOrganize}
            disabled={isAIProcessing}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition shadow-lg disabled:opacity-50"
          >
            <Zap size={20} className={isAIProcessing ? 'animate-pulse' : ''} />
            <span>{isAIProcessing ? `${smartPackerName} Organizing...` : 'Smart Organize'}</span>
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition shadow-lg"
          >
            <Plus size={20} />
            <span>Add Container</span>
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="grid sm:grid-cols-2 gap-6">
            {containers.map((container) => (
              <DroppableContainer
                key={container.id}
                container={container}
                containers={containers}
                gear={gear}
                onDelete={handleDeleteContainer}
                onRemoveItem={handleRemoveItemFromContainer}
                onAssignItem={handleAssignItem}
                onOpenLibrary={(id) => {
                  setSelectedContainerId(id);
                  setShowLibraryModal(true);
                }}
                onEdit={(c) => {
                  setNewContainer(c);
                  setEditingContainerId(c.id);
                  setIsAddModalOpen(true);
                }}
                packingLists={packingLists}
              />
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
            <h3 className="text-xl font-bold">Unassigned Gear</h3>
            <div className="space-y-3">
              {unassignedGear.map(item => (
                <DraggableGearItem key={item.id} item={item} />
              ))}
              {unassignedGear.length === 0 && (
                <p className="text-sm text-neutral-400 text-center py-8">All gear is assigned!</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Library Browser Modal */}
      {showLibraryModal && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-6">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold">Gear Library</h2>
                <p className="text-sm text-neutral-500">Select items to add to this container.</p>
              </div>
              <button 
                onClick={() => {
                  setShowLibraryModal(false);
                  setSelectedContainerId(null);
                  setSelectedLibraryItems([]);
                }} 
                className="text-neutral-400 hover:text-neutral-600"
              >
                <Plus className="rotate-45" size={24} />
              </button>
            </div>

            <div className="mb-6 space-y-4">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-primary transition-colors" size={18} />
                <input
                  type="text"
                  placeholder="Search library..."
                  value={librarySearchQuery}
                  onChange={(e) => setLibrarySearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition"
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 flex-1">
                  {['All', 'Kits', 'Camera', 'Lens', 'Audio', 'Lighting', 'Support', 'Power', 'Cables', 'Other'].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setLibraryCategoryFilter(cat)}
                      className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                        libraryCategoryFilter === cat
                          ? 'bg-primary text-white shadow-md'
                          : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                {selectedLibraryItems.length > 0 && (
                  <button
                    onClick={() => {
                      if (selectedContainerId) {
                        handleAssignMultipleItems(selectedContainerId, selectedLibraryItems);
                        setShowLibraryModal(false);
                        setSelectedContainerId(null);
                        setSelectedLibraryItems([]);
                      }
                    }}
                    className="px-6 py-2 bg-primary text-white rounded-xl font-bold text-sm shadow-lg hover:bg-primary/90 transition flex items-center gap-2"
                  >
                    <CheckCircle2 size={16} />
                    <span>Add {selectedLibraryItems.length} Items</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {filteredLibraryItems.length > 0 ? (
                filteredLibraryItems.map((item) => {
                  const currentContainer = containers.find(c => c.items.includes(item.id));
                  const isAlreadyInThisContainer = selectedContainerId && containers.find(c => c.id === selectedContainerId)?.items.includes(item.id);
                  const isSelected = selectedLibraryItems.includes(item.id);
                  const isKit = item.isKit || item.category === 'Kit' || item.category === 'Kits';

                  return (
                    <button 
                      key={item.id} 
                      disabled={!!isAlreadyInThisContainer}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedLibraryItems(prev => prev.filter(id => id !== item.id));
                        } else {
                          setSelectedLibraryItems(prev => [...prev, item.id]);
                        }
                      }}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all group text-left ${
                        isAlreadyInThisContainer 
                          ? 'bg-neutral-50 opacity-50 cursor-not-allowed border-neutral-100' 
                          : isSelected
                            ? 'bg-primary/5 border-primary shadow-md'
                            : 'bg-neutral-50 border-neutral-100 hover:border-primary/50 hover:bg-white'
                      }`}
                    >
                      <div className="w-16 h-16 bg-white rounded-xl overflow-hidden border border-neutral-200 flex-shrink-0 group-hover:scale-105 transition-transform flex items-center justify-center text-neutral-300">
                        {item.photoUrls && item.photoUrls.length > 0 ? (
                          <img src={item.photoUrls[0]} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : isKit ? (
                          <Layers size={24} className="text-primary" />
                        ) : (
                          <Package size={24} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold truncate group-hover:text-primary transition-colors flex items-center gap-2">
                          {item.name}
                          {isKit && (
                            <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-black uppercase">Kit</span>
                          )}
                        </h4>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-black">{item.assetTag}</p>
                          <span className="text-[10px] px-2 py-0.5 bg-neutral-100 text-neutral-500 rounded-full font-bold">{item.category}</span>
                        </div>
                        {currentContainer && !isAlreadyInThisContainer && (
                          <p className="text-[10px] text-amber-600 font-bold mt-1">Currently in: {currentContainer.name}</p>
                        )}
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isSelected ? 'bg-primary border-primary text-white' : 'border-neutral-200'
                      }`}>
                        {isSelected && <CheckCircle2 size={16} />}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-12">
                  <p className="text-neutral-400">No matching items found in your library.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Container Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[3rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-black">{editingContainerId ? 'Edit Container' : 'New Container'}</h2>
                  <button onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingContainerId(null);
                    setNewContainer({ type: 'toolbox', name: '', items: [], locationDetails: { row: '', level: '', bin: '' } });
                  }} className="p-2 hover:bg-neutral-100 rounded-full transition">
                    <Trash2 size={24} className="text-neutral-400" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Photo Section */}
                  <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                    <label className="shrink-0 w-24 h-24 bg-neutral-50 rounded-2xl border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-neutral-100 transition">
                      <Camera size={20} className="text-neutral-400" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-neutral-400">Add Photo</span>
                      <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                    </label>
                    {newContainer.photoUrls?.map((url, idx) => (
                      <div key={idx} className="shrink-0 w-24 h-24 rounded-2xl overflow-hidden relative group">
                        <img src={url} className="w-full h-full object-cover" />
                        <button 
                          onClick={() => setNewContainer(prev => ({ ...prev, photoUrls: prev.photoUrls?.filter((_, i) => i !== idx) }))}
                          className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                        >
                          <Plus size={10} className="rotate-45" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Case/Bag Name</label>
                    <input
                      type="text"
                      value={newContainer.name}
                      onChange={(e) => setNewContainer({ ...newContainer, name: e.target.value })}
                      placeholder="e.g., Sony FX3 Production Kit, Lens Bag A"
                      className="w-full px-6 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-primary outline-none transition"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Description / Packing Instructions</label>
                    <textarea
                      value={newContainer.description}
                      onChange={(e) => setNewContainer({ ...newContainer, description: e.target.value })}
                      placeholder="Specify how items should be packed or notes for the team..."
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition h-24 resize-none text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Linked Packing List</label>
                      <select
                        value={newContainer.packingListId}
                        onChange={(e) => setNewContainer({ ...newContainer, packingListId: e.target.value })}
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition text-sm"
                      >
                        <option value="">No Active List</option>
                        {packingLists.filter(list => !list.isTemplate).map(list => (
                          <option key={list.id} value={list.id}>{list.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Current Status</label>
                      <select
                        value={newContainer.status}
                        onChange={(e) => setNewContainer({ ...newContainer, status: e.target.value as any })}
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition text-sm"
                      >
                        <option value="storage">In Storage</option>
                        <option value="transit">In Transit</option>
                        <option value="deployed">Deployed (On Site)</option>
                        <option value="maintenance">Maintenance</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Row</label>
                      <input
                        type="text"
                        value={newContainer.locationDetails?.row}
                        onChange={(e) => setNewContainer({ ...newContainer, locationDetails: { ...newContainer.locationDetails, row: e.target.value } })}
                        placeholder="A, B..."
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Level</label>
                        <input
                          type="text"
                          value={newContainer.locationDetails?.level}
                          onChange={(e) => setNewContainer({ ...newContainer, locationDetails: { ...newContainer.locationDetails, level: e.target.value } })}
                          placeholder="1, 2..."
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition text-sm"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Bin</label>
                        <input
                          type="text"
                          value={newContainer.locationDetails?.bin}
                          onChange={(e) => setNewContainer({ ...newContainer, locationDetails: { ...newContainer.locationDetails, bin: e.target.value } })}
                          placeholder="Box 4"
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition text-sm"
                        />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Type</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {['bag', 'case', 'pouch', 'compartment', 'box', 'shelf', 'locker', 'pelican', 'nanuk', 'toolbox', 'custom'].map(type => (
                        <button
                          key={type}
                          onClick={() => setNewContainer({ ...newContainer, type: type as any })}
                          className={`px-3 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition border ${
                            newContainer.type === type 
                              ? 'bg-neutral-900 text-white border-neutral-900 shadow-lg' 
                              : 'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-900'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
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
                    onClick={handleAddContainer}
                    className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition shadow-lg"
                  >
                    {editingContainerId ? 'Save Changes' : 'Add Container'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Suggestions Modal */}
      <AnimatePresence>
        {showSuggestionsModal && packingSuggestions && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-4xl rounded-[3rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-neutral-100 flex items-center justify-between shrink-0">
                <div className="space-y-1">
                  <h2 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-3">
                    <Zap className="text-primary" size={32} />
                    <span>Packing Suggestions</span>
                  </h2>
                  <p className="text-neutral-500 font-medium">Review {smartPackerName}'s optimized organization strategy.</p>
                </div>
                <button 
                  onClick={() => setShowSuggestionsModal(false)}
                  className="p-3 hover:bg-neutral-50 rounded-2xl transition text-neutral-400"
                >
                  <Plus className="rotate-45" size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {packingSuggestions.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-6">
                    {packingSuggestions.map((suggestion, idx) => {
                      const container = containers.find(c => c.id === suggestion.containerId);
                      if (!container) return null;
                      
                      return (
                        <motion.div 
                          key={suggestion.containerId}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          className="bg-neutral-50 rounded-3xl border border-neutral-100 overflow-hidden flex flex-col"
                        >
                          <div className="p-6 bg-white border-b border-neutral-100">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-black uppercase tracking-tight text-lg">{container.name}</h3>
                              <span className="px-2 py-1 bg-neutral-100 text-neutral-500 rounded-lg text-[8px] font-black uppercase tracking-widest leading-none">
                                {container.type}
                              </span>
                            </div>
                            <p className="text-xs text-neutral-500 font-medium leading-relaxed italic">
                              "{suggestion.reasoning}"
                            </p>
                          </div>
                          
                          <div className="p-6 space-y-3 flex-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Items to Pack ({suggestion.itemIds.length})</p>
                            <div className="space-y-2">
                              {suggestion.itemIds.map(itemId => {
                                const item = gear.find(g => g.id === itemId);
                                const isKit = item?.isKit || item?.category === 'Kit' || item?.category === 'Kits';
                                return (
                                  <div key={itemId} className="flex items-center justify-between p-3 bg-white rounded-xl border border-neutral-200/50 shadow-sm group/recitem">
                                    <div className="flex items-center gap-3 truncate">
                                      {isKit ? <Layers size={14} className="text-primary shrink-0" /> : <Package size={14} className="text-neutral-400 shrink-0" />}
                                      <span className="text-sm font-bold truncate flex items-center gap-1.5">
                                        {item?.name || 'Unknown Item'}
                                        {isKit && (
                                          <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-black uppercase">Kit</span>
                                        )}
                                      </span>
                                    </div>
                                    <button
                                      onClick={() => handleRemoveRecommendedItem(suggestion.containerId, itemId)}
                                      className="text-neutral-300 hover:text-red-500 transition p-1 hover:bg-neutral-50 rounded-md shrink-0"
                                      title="Remove recommendation"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-20 text-center space-y-4">
                    <div className="w-20 h-20 bg-neutral-50 rounded-full flex items-center justify-center mx-auto text-neutral-300">
                      <Box size={40} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xl font-bold uppercase tracking-tight">No Suggestions Generated</p>
                      <p className="text-neutral-500">{smartPackerName} couldn't find a better way to pack your gear.</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-8 bg-neutral-50 border-t border-neutral-100 flex items-center gap-6 shrink-0">
                <button 
                  onClick={() => setShowSuggestionsModal(false)}
                  className="flex-1 py-5 bg-white text-neutral-600 rounded-[2rem] font-black uppercase text-xs tracking-widest hover:bg-neutral-100 transition border border-neutral-200"
                >
                  Dismiss
                </button>
                <button 
                  onClick={handleApplySuggestions}
                  disabled={isAIProcessing || packingSuggestions.length === 0}
                  className="flex-[2] py-5 bg-neutral-900 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest hover:bg-black transition shadow-xl shadow-neutral-900/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isAIProcessing ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : <CheckCircle2 size={18} />}
                  <span>Apply Packing Plan</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <DragOverlay>
        {activeId ? (
          <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-primary shadow-2xl opacity-90 scale-105">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <Package size={20} />
            </div>
            <div>
              <p className="font-bold text-sm">{gear.find(g => g.id === activeId)?.name}</p>
              <p className="text-[10px] text-neutral-400 uppercase font-black">{gear.find(g => g.id === activeId)?.category}</p>
            </div>
          </div>
        ) : null}
      </DragOverlay>
      </div>
    </DndContext>
  );
}
