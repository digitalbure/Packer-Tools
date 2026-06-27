import React, { useState, useEffect, useMemo } from 'react';
import { Box, Package, Plus, Search, Trash2, Edit2, Zap, ArrowRight, Weight as WeightIcon, Ruler, LayoutGrid, List, CheckCircle2, Layout, Lock, Camera, QrCode, Luggage, Briefcase, ChevronDown, ChevronUp, Layers, FileText, Sparkles, Check, X, ClipboardList, FolderPlus, ArrowRightLeft, BookOpen } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
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

// Inline interface for CustomInventory
interface CustomInventory {
  id: string;
  name: string;
  description?: string;
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
}

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
        <div className="min-w-0">
          <p className="font-bold text-sm truncate">{item.name}</p>
          <p className="text-[10px] text-neutral-400 uppercase font-black">{item.category}</p>
        </div>
      </div>
      <div className="p-2 bg-neutral-50 rounded-lg text-neutral-300 group-hover:text-primary transition">
        <ArrowRight size={16} />
      </div>
    </div>
  );
};

// Collapsible Recursive Node for Nested Sub-Organizers
const NestedOrganizerNode = ({
  child,
  containers,
  gear,
  onRemoveItem,
  onAssignItem,
  onOpenLibrary,
  onEdit,
  onDelete,
  packingLists
}: {
  child: Container;
  containers: Container[];
  gear: GearItem[];
  onRemoveItem: (containerId: string, itemId: string) => void;
  onAssignItem: (containerId: string, itemId: string) => void;
  onOpenLibrary: (containerId: string) => void;
  onEdit: (container: Container) => void;
  onDelete: (id: string) => void;
  packingLists: PackingList[];
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const childOfChild = containers.filter(c => c.parentId === child.id);

  return (
    <div className="bg-neutral-50/50 rounded-2xl border border-neutral-200/60 overflow-hidden shadow-sm">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 bg-white hover:bg-neutral-50 flex items-center justify-between cursor-pointer select-none transition"
      >
        <div className="flex items-center gap-3 truncate">
          <span className="text-neutral-500 shrink-0"><Layers size={14} /></span>
          <div className="truncate">
            <span className="text-xs font-black text-neutral-900 truncate block uppercase tracking-tight">{child.name}</span>
            <span className="text-[8px] bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded-full uppercase font-black tracking-wider">
              {child.type} • {child.items.length} Items
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={async () => {
              if (confirm(`Remove "${child.name}" from its parent organizer?`)) {
                try {
                  await updateDoc(doc(db, 'users', child.ownerId || '', 'containers', child.id), {
                    parentId: null,
                    updatedAt: new Date().toISOString()
                  });
                  toast.success("Un-nested organizer!");
                } catch {
                  toast.error("Failed to un-nest organizer");
                }
              }
            }}
            className="text-[8px] font-black uppercase text-amber-600 hover:bg-amber-50 px-2 py-1 rounded-md transition"
          >
            Un-nest
          </button>
          <button
            onClick={() => onEdit(child)}
            className="p-1 hover:bg-neutral-100 rounded text-neutral-500"
            title="Edit"
          >
            <Edit2 size={12} />
          </button>
          <button
            onClick={() => onDelete(child.id)}
            className="p-1 hover:bg-red-50 hover:text-red-600 rounded text-neutral-400"
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
          <div className="text-neutral-400 pl-1" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="p-3 bg-neutral-50 border-t border-neutral-100 space-y-3">
          {/* Sub-sub organizers */}
          {childOfChild.length > 0 && (
            <div className="space-y-2">
              <p className="text-[8px] font-black uppercase text-neutral-400 tracking-widest">Nested Organizers</p>
              <div className="space-y-2 pl-2 border-l border-neutral-200">
                {childOfChild.map(nestedChild => (
                  <NestedOrganizerNode
                    key={nestedChild.id}
                    child={nestedChild}
                    containers={containers}
                    gear={gear}
                    onRemoveItem={onRemoveItem}
                    onAssignItem={onAssignItem}
                    onOpenLibrary={onOpenLibrary}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    packingLists={packingLists}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Items in this sub-organizer */}
          <div className="space-y-1.5">
            <p className="text-[8px] font-black uppercase text-neutral-400 tracking-widest">Organizer Contents</p>
            {child.items.map(itemId => {
              const item = gear.find(g => g.id === itemId);
              return (
                <div key={itemId} className="flex items-center justify-between p-2 bg-white rounded-xl border border-neutral-100 shadow-sm text-xs font-semibold">
                  <span className="text-neutral-700 truncate">{item?.name || 'Unknown Item'}</span>
                  <button
                    onClick={() => onRemoveItem(child.id, itemId)}
                    className="text-neutral-300 hover:text-red-500 transition p-1 rounded hover:bg-neutral-50"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
            {child.items.length === 0 && (
              <p className="text-[10px] text-neutral-400 italic text-center py-2 bg-white rounded-xl border border-neutral-100">No items</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const statusColors: Record<string, string> = {
  storage: 'bg-neutral-100 text-neutral-500',
  transit: 'bg-blue-100 text-blue-600',
  deployed: 'bg-primary/10 text-primary',
  maintenance: 'bg-amber-100 text-amber-600'
};

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

const DroppableOrganizer = ({ 
  container, 
  containers,
  gear, 
  onDelete, 
  onEdit,
  onFocusOrganizer
}: { 
  container: Container, 
  containers: Container[],
  gear: GearItem[], 
  onDelete: (id: string) => void,
  onEdit: (container: Container) => void,
  onFocusOrganizer: (id: string) => void
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `container-${container.id}`,
  });

  const handleHeaderClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) {
      return;
    }
    onFocusOrganizer(container.id);
  };

  return (
    <div 
      ref={setNodeRef}
      onClick={handleHeaderClick}
      className={`bg-white rounded-[2.5rem] border transition-all duration-300 h-48 relative overflow-hidden group select-none cursor-pointer hover:shadow-lg ${
        isOver ? 'border-primary ring-4 ring-primary/10 bg-primary/5 scale-[1.02]' : 'border-neutral-100 shadow-sm'
      }`}
    >
      {container.photoUrls?.[0] ? (
        <img src={container.photoUrls[0]} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-neutral-300 bg-neutral-50 group-hover:bg-neutral-100/75 transition">
          {getContainerIcon(container.type)}
        </div>
      )}

      {/* Action buttons overlay on card */}
      <div className="absolute top-6 right-6 flex gap-2 z-10" onClick={e => e.stopPropagation()}>
        <button 
          onClick={() => onEdit(container)}
          className="p-3 bg-white/15 backdrop-blur-md text-white rounded-xl hover:bg-white/30 transition shadow-sm"
          title="Edit Specifications"
        >
          <Edit2 size={16} />
        </button>
        <button 
          onClick={() => onDelete(container.id)}
          className="p-3 bg-white/15 backdrop-blur-md text-white hover:bg-red-500 transition rounded-xl shadow-sm"
          title="Delete Organizer"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Info overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/90 via-neutral-950/40 to-transparent pointer-events-none" />

      <div className="absolute bottom-6 left-8 right-6 flex flex-col gap-1 z-10 pointer-events-none">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-white text-black shadow-sm">
            {container.type}
          </span>
          {container.status && (
            <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm ${statusColors[container.status] || 'bg-white text-black'}`}>
              {container.status}
            </span>
          )}
          <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-black/40 text-white border border-white/10 backdrop-blur-sm">
            {container.items.length} {container.items.length === 1 ? 'Item' : 'Items'}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter leading-none truncate max-w-[210px]">
            {container.name}
          </h3>
          <span className="text-white/60 text-[9px] font-black uppercase tracking-widest shrink-0">→ OPEN</span>
        </div>
        {container.description && (
          <p className="text-[10px] text-white/70 line-clamp-1 italic">{container.description}</p>
        )}
      </div>
    </div>
  );
};

const OrganizerWorkspacePopover = ({
  container,
  containers,
  gear,
  onClose,
  onDelete,
  onRemoveItem,
  onAssignItem,
  onOpenLibrary,
  onEdit,
  packingLists,
  customDraft,
  onClearDraft,
  onConfirmDraft,
  onSetDraft,
  onSwitchOrganizer
}: {
  container: Container;
  containers: Container[];
  gear: GearItem[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onRemoveItem: (containerId: string, itemId: string) => void;
  onAssignItem: (containerId: string, itemId: string) => void;
  onOpenLibrary: (containerId: string) => void;
  onEdit: (container: Container) => void;
  packingLists: PackingList[];
  customDraft: any | null;
  onClearDraft: (id: string) => void;
  onConfirmDraft: (id: string) => void;
  onSetDraft: (id: string, draft: any) => void;
  onSwitchOrganizer: (id: string) => void;
}) => {
  const [showLoadSelector, setShowLoadSelector] = useState(false);
  const [selectorTab, setSelectorTab] = useState<'kit' | 'list' | 'inventory'>('kit');
  const [localNotes, setLocalNotes] = useState(container.notes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  useEffect(() => {
    setLocalNotes(container.notes || '');
  }, [container.notes]);

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      await updateDoc(doc(db, 'users', container.ownerId || '', 'containers', container.id), {
        notes: localNotes.trim(),
        updatedAt: new Date().toISOString()
      });
      toast.success("Notes saved!");
    } catch {
      toast.error("Failed to save notes");
    } finally {
      setIsSavingNotes(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const rootContainers = containers.filter(c => !c.parentId);
  const currentIndex = rootContainers.findIndex(c => c.id === container.id);

  const handlePrev = () => {
    if (rootContainers.length <= 1) return;
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : rootContainers.length - 1;
    onSwitchOrganizer(rootContainers[prevIndex].id);
  };

  const handleNext = () => {
    if (rootContainers.length <= 1) return;
    const nextIndex = currentIndex < rootContainers.length - 1 ? currentIndex + 1 : 0;
    onSwitchOrganizer(rootContainers[nextIndex].id);
  };

  // Kits and inventories lists for dropdown loading
  const availableKits = useMemo(() => {
    return gear.filter(item => item.isKit || item.category === 'Kit' || item.category === 'Kits');
  }, [gear]);

  const [localInventories, setLocalInventories] = useState<CustomInventory[]>([]);
  useEffect(() => {
    if (!container.ownerId) return;
    const unsub = onSnapshot(query(collection(db, 'inventories'), where('ownerId', '==', container.ownerId)), (snap) => {
      setLocalInventories(snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomInventory)));
    });
    return unsub;
  }, [container.ownerId]);

  const handleSelectSourceToLoad = async (type: 'kit' | 'list' | 'inventory', sourceId: string) => {
    if (!sourceId) return;
    try {
      if (type === 'kit') {
        const kitItem = gear.find(g => g.id === sourceId);
        if (!kitItem) return;
        const subItems = (kitItem.childItemIds || []).map(cid => {
          const matching = gear.find(g => g.id === cid);
          return { name: matching?.name || 'Kit Item', category: matching?.category || 'Kit Part', id: cid };
        });
        
        onSetDraft(container.id, {
          type: 'kit',
          id: sourceId,
          name: kitItem.name,
          items: [{ name: kitItem.name, category: 'Kit Header', id: kitItem.id }, ...subItems]
        });
      } else if (type === 'list') {
        const listDoc = packingLists.find(l => l.id === sourceId);
        if (!listDoc) return;
        toast.info("Fetching packing list items...");
        const snap = await getDocs(collection(db, 'packingLists', sourceId, 'items'));
        const items = snap.docs.map(doc => {
          const data = doc.data();
          return { name: data.name, category: data.category || 'Packing List Item' };
        });
        if (items.length === 0) {
          toast.warning("This packing list has no items!");
          return;
        }
        onSetDraft(container.id, {
          type: 'packing_list',
          id: sourceId,
          name: listDoc.name,
          items
        });
      } else if (type === 'inventory') {
        const invDoc = localInventories.find(i => i.id === sourceId);
        if (!invDoc) return;
        toast.info("Fetching custom inventory items...");
        const snap = await getDocs(collection(db, 'inventories', sourceId, 'items'));
        const items = snap.docs.map(doc => {
          const data = doc.data();
          return { name: data.name, category: data.primaryCategory || data.category || 'Inventory Asset' };
        });
        if (items.length === 0) {
          toast.warning("This inventory has no items!");
          return;
        }
        onSetDraft(container.id, {
          type: 'inventory',
          id: sourceId,
          name: invDoc.name,
          items
        });
      }
      setShowLoadSelector(false);
      toast.success("Loaded proposed draft contents! Verify and confirm below.");
    } catch (err) {
      toast.error("Failed to load source items");
    }
  };

  const childOrganizers = containers.filter(c => c.parentId === container.id);

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-md flex items-center justify-center p-0 md:p-6 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white md:rounded-[2.5rem] w-full max-w-6xl h-full md:h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-neutral-100"
      >
        {/* TOP COMMAND BAR & NAVIGATOR */}
        <div className="bg-neutral-50/70 border-b border-neutral-100 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="p-2.5 bg-neutral-900 text-white rounded-2xl shrink-0">
              {getContainerIcon(container.type)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-neutral-200 text-neutral-600 rounded-full text-[8px] font-black uppercase tracking-widest border border-neutral-300">
                  {container.type}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm ${statusColors[container.status || 'storage']}`}>
                  {container.status || 'storage'}
                </span>
              </div>
              <h2 className="text-sm md:text-base font-black text-neutral-900 uppercase tracking-tight truncate mt-0.5">
                {container.name}
              </h2>
            </div>
          </div>

          {/* INTELLIGENT NAVIGATOR */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-2xl border border-neutral-200 shadow-sm w-full sm:w-auto justify-between sm:justify-start">
            <span className="text-[9px] uppercase tracking-widest font-black text-neutral-400 shrink-0">
              Navigator
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrev}
                disabled={rootContainers.length <= 1}
                className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-500 disabled:opacity-30 disabled:pointer-events-none transition"
                title="Previous Organizer"
              >
                <ChevronDown size={16} className="rotate-90" />
              </button>
              
              <select
                value={container.id}
                onChange={(e) => onSwitchOrganizer(e.target.value)}
                className="bg-transparent text-neutral-800 font-bold text-xs uppercase tracking-tight rounded-lg px-2 py-1 border-none focus:outline-none cursor-pointer max-w-[160px] sm:max-w-[200px]"
              >
                {rootContainers.map((c, i) => (
                  <option key={c.id} value={c.id} className="text-neutral-900 font-bold uppercase text-xs">
                    {c.name.toUpperCase()} ({c.items.length})
                  </option>
                ))}
              </select>

              <button
                onClick={handleNext}
                disabled={rootContainers.length <= 1}
                className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-500 disabled:opacity-30 disabled:pointer-events-none transition"
                title="Next Organizer"
              >
                <ChevronDown size={16} className="-rotate-90" />
              </button>
            </div>
            
            {rootContainers.length > 0 && (
              <span className="text-[9px] font-mono font-black text-neutral-400 border-l border-neutral-200 pl-2">
                {currentIndex + 1}/{rootContainers.length}
              </span>
            )}
          </div>

          {/* EXIT BUTTON */}
          <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
            <button
              onClick={() => onEdit(container)}
              className="p-2.5 bg-neutral-100 text-neutral-600 rounded-2xl hover:bg-neutral-200 transition"
              title="Edit Specifications"
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-neutral-900 text-white hover:bg-black rounded-2xl font-bold text-xs uppercase tracking-widest transition shadow-md"
            >
              <X size={14} />
              <span>Exit</span>
            </button>
          </div>
        </div>

        {/* WORKSPACE BODY */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 md:space-y-0 md:grid md:grid-cols-12 md:gap-8 min-h-0">
          
          {/* LEFT SIDEBAR: CONFIG & SPECIFICATION (4 cols) */}
          <div className="md:col-span-4 space-y-6 md:overflow-y-auto pr-0 md:pr-4 custom-scrollbar md:h-full pb-6">
            
            {/* Visual Header / Showcase Photo */}
            <div className="relative h-44 rounded-3xl overflow-hidden bg-neutral-100 border border-neutral-200/50 shadow-inner shrink-0">
              {container.photoUrls?.[0] ? (
                <img src={container.photoUrls[0]} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-neutral-300 gap-2">
                  {getContainerIcon(container.type)}
                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">No Image Loaded</p>
                </div>
              )}
              {container.description && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <p className="text-xs text-white line-clamp-2 italic">"{container.description}"</p>
                </div>
              )}
            </div>

            {/* Editable Notes Section */}
            <div className="space-y-2 bg-neutral-50 p-5 rounded-3xl border border-neutral-200/60 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
                  <FileText size={12} /> Organizer Notes
                </p>
                {localNotes !== (container.notes || '') && (
                  <button
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes}
                    className="text-[9px] bg-neutral-950 text-white hover:bg-black py-1 px-2.5 rounded-lg transition font-black uppercase tracking-wider flex items-center gap-1"
                  >
                    <Check size={10} /> {isSavingNotes ? 'Saving...' : 'Save'}
                  </button>
                )}
              </div>
              <textarea
                value={localNotes}
                onChange={e => setLocalNotes(e.target.value)}
                placeholder="Type operational notes, setup instructions, or physical locations..."
                rows={4}
                className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-neutral-300 resize-none text-neutral-800"
              />
            </div>

            {/* Sub-Organizers lists (Nesting!) */}
            {childOrganizers.length > 0 && (
              <div className="space-y-3 p-5 bg-neutral-50/50 rounded-3xl border border-neutral-200/40">
                <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">Nested Sub-Organizers ({childOrganizers.length})</p>
                <div className="space-y-3 pl-3 border-l-2 border-neutral-200">
                  {childOrganizers.map(child => (
                    <NestedOrganizerNode
                      key={child.id}
                      child={child}
                      containers={containers}
                      gear={gear}
                      onRemoveItem={onRemoveItem}
                      onAssignItem={onAssignItem}
                      onOpenLibrary={onOpenLibrary}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      packingLists={packingLists}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Quick Portals & Tools Grid */}
            <div className="space-y-2.5">
              <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Operational Portals</p>
              <div className="grid grid-cols-2 gap-2">
                <Link 
                  to={`/organizer/${container.id}/io`}
                  onClick={onClose}
                  className="py-3 bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border border-neutral-200/60 rounded-2xl font-black text-[10px] uppercase tracking-widest transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <ArrowRightLeft size={14} className="text-neutral-500" />
                  <span>Internal I/O</span>
                </Link>
                <Link 
                  to={`/o/${container.id}?owner=${container.ownerId || ''}`}
                  onClick={onClose}
                  className="py-3 bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border border-neutral-200/60 rounded-2xl font-black text-[10px] uppercase tracking-widest transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <BookOpen size={14} className="text-neutral-500" />
                  <span>Public Passport</span>
                </Link>
              </div>
            </div>

          </div>

          {/* RIGHT VIEWPORT: CONTENTS & LOADER (8 cols) */}
          <div className="md:col-span-8 flex flex-col md:h-full min-h-0 space-y-6 pb-6">
            
            {/* Draft Allocation Preview Banner */}
            {customDraft && (
              <div className="p-5 bg-primary/5 rounded-3xl border-2 border-dashed border-primary/30 space-y-3 shrink-0">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-1">
                      <Sparkles size={12} /> Draft Allocation Preview
                    </p>
                    <p className="text-xs font-bold text-neutral-700">Source: "{customDraft.name}" ({customDraft.items.length} items)</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button 
                      onClick={() => onConfirmDraft(container.id)}
                      className="p-2 bg-neutral-900 text-white rounded-xl hover:bg-black transition flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-3"
                    >
                      <Check size={12} /> Confirm Draft
                    </button>
                    <button 
                      onClick={() => onClearDraft(container.id)}
                      className="p-2 bg-neutral-100 text-neutral-500 hover:bg-neutral-200 rounded-xl transition"
                      title="Cancel Draft"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>

                <div className="max-h-36 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {customDraft.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 bg-white/60 border border-dashed border-primary/20 rounded-xl text-xs font-semibold italic text-neutral-500 animate-pulse">
                      <div className="flex items-center gap-2">
                        <Package size={12} className="text-neutral-400" />
                        <span>{item.name}</span>
                      </div>
                      <span className="text-[8px] uppercase tracking-widest font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded">Draft</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contents Listing Section */}
            <div className="flex-1 min-h-0 bg-neutral-50 p-6 rounded-[2rem] border border-neutral-200/50 flex flex-col">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-neutral-400 pb-3 border-b border-neutral-200/60 shrink-0">
                <span>Cargo Contents ({container.items.length} items)</span>
                <span className="text-[9px] text-neutral-400">Scroll to view all</span>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3 mt-4">
                {container.items.map(itemId => {
                  const item = gear.find(g => g.id === itemId);
                  const isKit = item?.isKit || item?.category === 'Kit' || item?.category === 'Kits';
                  
                  return (
                    <div key={itemId} className="space-y-1.5 p-1 bg-white border border-neutral-150 rounded-2xl shadow-sm">
                      <div className="flex items-center justify-between p-3.5 bg-white rounded-xl group/item">
                        <div className="flex items-center gap-3 truncate">
                          {isKit ? <Layers size={14} className="text-primary shrink-0 animate-pulse" /> : <Package size={14} className="text-neutral-400 shrink-0" />}
                          <span className="text-sm font-bold truncate flex items-center gap-1.5 text-neutral-900">
                            {item?.name || 'Unknown Item'}
                            {isKit && (
                              <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-black uppercase tracking-widest">
                                Kit
                              </span>
                            )}
                          </span>
                        </div>
                        <button 
                          onClick={() => onRemoveItem(container.id, itemId)}
                          className="text-neutral-300 hover:text-red-500 transition shrink-0 p-1.5 rounded-lg hover:bg-neutral-50 group-hover/item:opacity-100 opacity-100 sm:opacity-0"
                          title="Remove from Organizer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {isKit && item?.childItemIds && item.childItemIds.length > 0 && (
                        <div className="pl-6 pr-4 pb-3 space-y-1.5 border-t border-neutral-50 pt-2 bg-neutral-50/50 rounded-b-2xl">
                          <p className="text-[8px] font-black uppercase text-neutral-400 tracking-widest">Kit Contents ({item.childItemIds.length})</p>
                          <div className="space-y-1">
                            {item.childItemIds.map(childId => {
                              const child = gear.find(g => g.id === childId);
                              return (
                                <div key={childId} className="flex items-center gap-2 px-2.5 py-1.5 bg-white rounded-lg text-neutral-600 text-xs border border-neutral-100">
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

                {container.items.length === 0 && !customDraft && (
                  <div className="flex flex-col items-center justify-center py-20 text-neutral-300 space-y-2">
                    <Box size={40} strokeWidth={1} />
                    <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">Empty Organizer</p>
                    <p className="text-[10px] text-neutral-400 text-center max-w-xs">Drop items over the card outside, or use the quick loaders below to provision stock.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sourcing Drawer & Quick Actions Bottom Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
              
              {/* Load Contents Inline Panel */}
              <div className="bg-neutral-50 rounded-[2rem] border border-neutral-200/60 p-4.5 space-y-3 shadow-sm">
                <button 
                  onClick={() => setShowLoadSelector(!showLoadSelector)}
                  className="w-full py-2.5 bg-white text-neutral-800 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-neutral-200 hover:bg-neutral-50 transition flex items-center justify-center gap-2 shadow-sm"
                >
                  <FolderPlus size={14} className="text-primary" />
                  <span>Select Item, Kit, Packing List</span>
                </button>

                {showLoadSelector && (
                  <div className="space-y-3">
                    <div className="flex gap-1 bg-white p-1 rounded-xl border border-neutral-200 shadow-sm">
                      {(['kit', 'list', 'inventory'] as const).map(tab => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setSelectorTab(tab)}
                          className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition ${
                            selectorTab === tab ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-50'
                          }`}
                        >
                          {tab === 'kit' ? 'Kits' : tab === 'list' ? 'Packing Lists' : 'Inventories'}
                        </button>
                      ))}
                    </div>

                    <div className="bg-white p-2 rounded-xl border border-neutral-200 max-h-40 overflow-y-auto custom-scrollbar shadow-inner">
                      {selectorTab === 'kit' && (
                        <div className="space-y-1">
                          {availableKits.map(k => (
                            <button
                              key={k.id}
                              type="button"
                              onClick={() => handleSelectSourceToLoad('kit', k.id)}
                              className="w-full text-left p-2.5 hover:bg-neutral-50 rounded-lg text-xs font-bold transition flex justify-between items-center"
                            >
                              <span className="truncate">{k.name}</span>
                              <span className="text-[7px] bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase shrink-0 font-black tracking-widest">Load Kit</span>
                            </button>
                          ))}
                          {availableKits.length === 0 && <p className="text-[10px] text-neutral-400 italic text-center py-2">No kits found</p>}
                        </div>
                      )}

                      {selectorTab === 'list' && (
                        <div className="space-y-1">
                          {packingLists.filter(l => !l.isTemplate).map(l => (
                            <button
                              key={l.id}
                              type="button"
                              onClick={() => handleSelectSourceToLoad('list', l.id)}
                              className="w-full text-left p-2.5 hover:bg-neutral-50 rounded-lg text-xs font-bold transition flex justify-between items-center"
                            >
                              <span className="truncate">{l.name}</span>
                              <span className="text-[7px] bg-neutral-900 text-white px-1.5 py-0.5 rounded uppercase shrink-0 font-black tracking-widest">Load List</span>
                            </button>
                          ))}
                          {packingLists.filter(l => !l.isTemplate).length === 0 && <p className="text-[10px] text-neutral-400 italic text-center py-2">No packing lists found</p>}
                        </div>
                      )}

                      {selectorTab === 'inventory' && (
                        <div className="space-y-1">
                          {localInventories.map(inv => (
                            <button
                              key={inv.id}
                              type="button"
                              onClick={() => handleSelectSourceToLoad('inventory', inv.id)}
                              className="w-full text-left p-2.5 hover:bg-neutral-50 rounded-lg text-xs font-bold transition flex justify-between items-center"
                            >
                              <span className="truncate">{inv.name}</span>
                              <span className="text-[7px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded uppercase shrink-0 font-black tracking-widest">Load Sheet</span>
                            </button>
                          ))}
                          {localInventories.length === 0 && <p className="text-[10px] text-neutral-400 italic text-center py-2">No inventories found</p>}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Pack List Drawer */}
              <div className="bg-neutral-50 rounded-[2rem] border border-neutral-200/60 p-4.5 flex gap-2.5 items-stretch shadow-sm">
                
                <div className="relative group/add flex-1 flex">
                  <button className="w-full bg-neutral-900 text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-black transition flex items-center justify-center gap-2 shadow-sm">
                    <Plus size={14} />
                    <span>Quick Pack Assets</span>
                  </button>
                  <div className="absolute bottom-full left-0 w-full mb-2 bg-white border border-neutral-150 rounded-2xl shadow-2xl p-4 hidden group-hover/add:block z-20 max-h-48 overflow-y-auto custom-scrollbar">
                    <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-2">Nearby Unassigned</p>
                    <div className="space-y-2">
                      {gear.filter(g => !containers.some(c => c.items.includes(g.id))).slice(0, 15).map(item => {
                        const isItemKit = item.isKit || item.category === 'Kit' || item.category === 'Kits';
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => onAssignItem(container.id, item.id)}
                            className="w-full text-left p-2 hover:bg-neutral-50 rounded-lg text-xs font-bold transition flex items-center justify-between gap-2 border-b border-neutral-50 last:border-none"
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
                        <p className="text-[10px] text-neutral-400 italic py-2 text-center">All gear has been assigned!</p>
                      )}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => onOpenLibrary(container.id)}
                  className="px-5 bg-white text-neutral-600 border border-neutral-200 rounded-2xl hover:bg-neutral-50 transition flex items-center justify-center shadow-sm"
                  title="Browse Full Gear Library"
                >
                  <Search size={16} />
                </button>
              </div>

            </div>

          </div>

        </div>

      </motion.div>
    </div>
  );
};

export default function OrganizerModule({ user, adminSettings: propAdminSettings }: { user: UserProfile, adminSettings: AdminSettings | null }) {
  const [containers, setContainers] = useState<Container[]>([]);
  const [gear, setGear] = useState<GearItem[]>([]);
  const [packingLists, setPackingLists] = useState<PackingList[]>([]);
  const [inventories, setInventories] = useState<CustomInventory[]>([]);
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

  // Draft state for individual organizer previews
  const [draftAllocations, setDraftAllocations] = useState<{ [containerId: string]: any }>({});

  // Active focused organizer ID for pop-over overlay workspace
  const [focusedOrganizerId, setFocusedOrganizerId] = useState<string | null>(null);


  // Active right corner dashboard utility panel tab
  const [activeRightTab, setActiveRightTab] = useState<'single' | 'kits' | 'lists' | 'inventories'>('single');

  // Expanded kit ID in the Kits Tab
  const [expandedKitId, setExpandedKitId] = useState<string | null>(null);

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

  const [newContainer, setNewContainer] = useState<Partial<Container> & { parentId?: string | null }>({
    type: 'bag',
    name: '',
    description: '',
    packingListId: '',
    parentId: null,
    status: 'storage',
    locationDetails: { row: '', level: '', bin: '' },
    photoUrls: []
  });

  const [editingContainerId, setEditingContainerId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const qContainers = query(collection(db, 'users', user.uid, 'containers'));
    const unsubscribeContainers = onSnapshot(qContainers, (snapshot) => {
      setContainers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Container)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'containers');
    });

    const qGear = query(collection(db, 'users', user.uid, 'gearLibrary'));
    const unsubscribeGear = onSnapshot(qGear, (snapshot) => {
      setGear(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GearItem)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'gearLibrary');
    });

    const qPackingLists = query(collection(db, 'packingLists'), where('ownerId', '==', user.uid));
    const unsubscribePackingLists = onSnapshot(qPackingLists, (snapshot) => {
      setPackingLists(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PackingList)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'packingLists');
    });

    const qInventories = query(collection(db, 'inventories'), where('ownerId', '==', user.uid));
    const unsubscribeInventories = onSnapshot(qInventories, (snapshot) => {
      setInventories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomInventory)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'inventories');
    });

    return () => {
      unsubscribeContainers();
      unsubscribeGear();
      unsubscribePackingLists();
      unsubscribeInventories();
    };
  }, [user]);

  const smartPackerName = settings?.aiConfig?.smartPackerName || 'Smart Packer';

  const handleAddContainer = async () => {
    if (!newContainer.name) {
      toast.error("Organizer Name is required");
      return;
    }
    try {
      const cleanData = {
        name: newContainer.name,
        type: newContainer.type || 'bag',
        description: newContainer.description || '',
        packingListId: newContainer.packingListId || '',
        parentId: newContainer.parentId || null,
        status: newContainer.status || 'storage',
        locationDetails: {
          row: newContainer.locationDetails?.row || '',
          level: newContainer.locationDetails?.level || '',
          bin: newContainer.locationDetails?.bin || '',
        },
        photoUrls: newContainer.photoUrls || [],
        ownerId: user.uid,
        updatedAt: new Date().toISOString()
      };

      if (editingContainerId) {
        await updateDoc(doc(db, 'users', user.uid, 'containers', editingContainerId), cleanData);
        toast.success("Organizer updated!");
      } else {
        await addDoc(collection(db, 'users', user.uid, 'containers'), {
          ...cleanData,
          createdAt: new Date().toISOString(),
          items: []
        });
        toast.success("Organizer added successfully!");
      }
      setIsAddModalOpen(false);
      setEditingContainerId(null);
      setNewContainer({
        type: 'bag',
        name: '',
        description: '',
        packingListId: '',
        parentId: null,
        status: 'storage',
        locationDetails: { row: '', level: '', bin: '' },
        photoUrls: []
      });
    } catch (error) {
      toast.error("Failed to save organizer specification");
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
    if (!confirm("Are you sure you want to delete this organizer?")) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'containers', id));
      toast.success("Organizer deleted");
    } catch (error) {
      toast.error("Failed to delete organizer");
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
        toast.info("All items are already assigned to organizers!");
        return;
      }

      if (containers.length === 0) {
        toast.error("Please add at least one organizer first");
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
      toast.success("Item removed from organizer");
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
      toast.success(`${itemIds.length} items assigned to organizer`);
    } catch (error) {
      toast.error("Failed to assign items");
    }
  };

  const handleAssignItem = async (containerId: string, itemId: string) => {
    return handleAssignMultipleItems(containerId, [itemId]);
  };

  const handleConfirmDraftAllocation = async (containerId: string) => {
    const draft = draftAllocations[containerId];
    if (!draft) return;

    try {
      toast.loading("Provisioning and finalizing draft items...", { id: 'finalizing' });
      const container = containers.find(c => c.id === containerId);
      if (!container) return;

      const itemIdsToAssign: string[] = [];

      for (const draftItem of draft.items) {
        if (draftItem.id) {
          // Exists already in library
          itemIdsToAssign.push(draftItem.id);
        } else {
          // Check if there's a match by name first to avoid duplicates
          const match = gear.find(g => g.name.trim().toLowerCase() === draftItem.name.trim().toLowerCase());
          if (match) {
            itemIdsToAssign.push(match.id);
          } else {
            // Write a new GearItem document!
            const newDocRef = await addDoc(collection(db, 'users', user.uid, 'gearLibrary'), {
              name: draftItem.name.trim(),
              category: draftItem.category || 'Other',
              assetTag: `AST-${Math.floor(100000 + Math.random() * 900000)}`,
              status: 'storage',
              ownerId: user.uid,
              createdAt: new Date().toISOString()
            });
            itemIdsToAssign.push(newDocRef.id);
          }
        }
      }

      // Merge into organizer items
      const updatedItems = [...new Set([...container.items, ...itemIdsToAssign])];
      const updateData: any = {
        items: updatedItems,
        updatedAt: new Date().toISOString()
      };

      if (draft.type === 'packing_list') {
        updateData.packingListId = draft.id;
      }

      await updateDoc(doc(db, 'users', user.uid, 'containers', containerId), updateData);

      // Clear draft
      setDraftAllocations(prev => {
        const next = { ...prev };
        delete next[containerId];
        return next;
      });

      toast.dismiss('finalizing');
      toast.success(`Successfully committed ${draft.items.length} items to "${container.name}"!`);
    } catch (err) {
      toast.dismiss('finalizing');
      toast.error("Failed to finalize draft contents");
    }
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

    // Check if dropped over an organizer
    if (overId.startsWith('container-')) {
      const containerId = overId.replace('container-', '');
      await handleAssignItem(containerId, itemId);
    }
  };

  // Pre-load items of a packing list or custom inventory dynamically when triggering "Load to..." from the right side panel
  const handleLoadSourceToContainerFromSide = async (
    type: 'kit' | 'list' | 'inventory',
    sourceId: string,
    sourceName: string,
    containerId: string
  ) => {
    try {
      const container = containers.find(c => c.id === containerId);
      if (!container) return;

      if (type === 'kit') {
        const kitItem = gear.find(g => g.id === sourceId);
        if (!kitItem) return;
        const subItems = (kitItem.childItemIds || []).map(cid => {
          const matching = gear.find(g => g.id === cid);
          return { name: matching?.name || 'Kit Item', category: matching?.category || 'Kit Part', id: cid };
        });
        setDraftAllocations(prev => ({
          ...prev,
          [containerId]: {
            type: 'kit',
            id: sourceId,
            name: sourceName,
            items: [{ name: kitItem.name, category: 'Kit Header', id: kitItem.id }, ...subItems]
          }
        }));
      } else if (type === 'list') {
        toast.info("Fetching packing list items...");
        const snap = await getDocs(collection(db, 'packingLists', sourceId, 'items'));
        const items = snap.docs.map(doc => {
          const data = doc.data();
          return { name: data.name, category: data.category || 'Packing List Item' };
        });
        if (items.length === 0) {
          toast.warning("This packing list has no items!");
          return;
        }
        setDraftAllocations(prev => ({
          ...prev,
          [containerId]: {
            type: 'packing_list',
            id: sourceId,
            name: sourceName,
            items
          }
        }));
      } else if (type === 'inventory') {
        toast.info("Fetching custom inventory items...");
        const snap = await getDocs(collection(db, 'inventories', sourceId, 'items'));
        const items = snap.docs.map(doc => {
          const data = doc.data();
          return { name: data.name, category: data.primaryCategory || data.category || 'Inventory Asset' };
        });
        if (items.length === 0) {
          toast.warning("This inventory has no items!");
          return;
        }
        setDraftAllocations(prev => ({
          ...prev,
          [containerId]: {
            type: 'inventory',
            id: sourceId,
            name: sourceName,
            items
          }
        }));
      }

      toast.success(`Loaded items of "${sourceName}" into "${container.name}" as a draft preview! Scroll to the card and click Confirm.`);
    } catch (err) {
      toast.error("Failed to load source items");
    }
  };

  if (loading) return <div className="flex justify-center py-24 animate-spin"><Box size={48} /></div>;

  // Filter root level containers (ones that do not have a parentId)
  const rootContainers = containers.filter(c => !c.parentId);

  // Compute unassigned individual gear
  const unassignedGear = gear.filter(g => !containers.some(c => c.items.includes(g.id)));

  // Filter kits
  const kits = gear.filter(item => item.isKit || item.category === 'Kit' || item.category === 'Kits');

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
              <span>Storage & Organizers</span>
            </h1>
            <p className="text-neutral-500">Track nested cases, pouches, and crates. Rapidly provision with {smartPackerName}.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <button 
              onClick={handleSmartOrganize}
              disabled={isAIProcessing}
              className="flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition shadow-lg disabled:opacity-50 w-full sm:w-auto text-sm"
            >
              <Zap size={20} className={isAIProcessing ? 'animate-pulse' : ''} />
              <span>{isAIProcessing ? `${smartPackerName} Organizing...` : 'Smart Organize'}</span>
            </button>
            <button 
              onClick={() => {
                setEditingContainerId(null);
                setNewContainer({
                  type: 'bag',
                  name: '',
                  description: '',
                  packingListId: '',
                  parentId: null,
                  status: 'storage',
                  locationDetails: { row: '', level: '', bin: '' },
                  photoUrls: []
                });
                setIsAddModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition shadow-lg w-full sm:w-auto text-sm"
            >
              <Plus size={20} />
              <span>Add Organizer</span>
            </button>
          </div>
        </header>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="grid sm:grid-cols-2 gap-6">
              {rootContainers.map((container) => (
                <DroppableOrganizer
                  key={container.id}
                  container={container}
                  containers={containers}
                  gear={gear}
                  onDelete={handleDeleteContainer}
                  onEdit={(c) => {
                    setNewContainer(c);
                    setEditingContainerId(c.id);
                    setIsAddModalOpen(true);
                  }}
                  onFocusOrganizer={(id) => setFocusedOrganizerId(id)}
                />
              ))}
              {rootContainers.length === 0 && (
                <div className="sm:col-span-2 col-span-1 bg-neutral-50 rounded-[2rem] sm:rounded-[2.5rem] border border-dashed border-neutral-300 p-6 sm:p-12 text-center space-y-4">
                  <Luggage size={48} className="text-neutral-300 mx-auto" />
                  <div>
                    <h4 className="font-bold text-lg text-neutral-800">No Organizers Yet</h4>
                    <p className="text-sm text-neutral-500">Create pouches, Pelican cases, or bags to nesting and group your equipment.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-5 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
              <div className="flex flex-col gap-3">
                <h3 className="text-xl font-black uppercase tracking-tight text-neutral-900">Sourcing Dashboard</h3>
                
                {/* 4 Premium Option Tabs based on Dashboard objects */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-neutral-100 rounded-2xl border border-neutral-200/50">
                  <button
                    onClick={() => setActiveRightTab('single')}
                    className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition ${
                      activeRightTab === 'single' ? 'bg-accent text-white shadow-sm shadow-accent/20' : 'text-neutral-500 hover:bg-neutral-200/50'
                    }`}
                  >
                    Assets
                  </button>
                  <button
                    onClick={() => setActiveRightTab('kits')}
                    className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition ${
                      activeRightTab === 'kits' ? 'bg-accent text-white shadow-sm shadow-accent/20' : 'text-neutral-500 hover:bg-neutral-200/50'
                    }`}
                  >
                    Kits
                  </button>
                  <button
                    onClick={() => setActiveRightTab('lists')}
                    className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition ${
                      activeRightTab === 'lists' ? 'bg-accent text-white shadow-sm shadow-accent/20' : 'text-neutral-500 hover:bg-neutral-200/50'
                    }`}
                  >
                    Lists
                  </button>
                  <button
                    onClick={() => setActiveRightTab('inventories')}
                    className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition ${
                      activeRightTab === 'inventories' ? 'bg-accent text-white shadow-sm shadow-accent/20' : 'text-neutral-500 hover:bg-neutral-200/50'
                    }`}
                  >
                    Sheets
                  </button>
                </div>
              </div>

              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {activeRightTab === 'single' && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Unassigned Single Gear</p>
                    {unassignedGear.map(item => (
                      <DraggableGearItem key={item.id} item={item} />
                    ))}
                    {unassignedGear.length === 0 && (
                      <p className="text-sm text-neutral-400 text-center py-8 italic bg-neutral-50 rounded-2xl">All individual gear is assigned!</p>
                    )}
                  </div>
                )}

                {activeRightTab === 'kits' && (
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Workspace Kits ({kits.length})</p>
                    {kits.map(kit => {
                      const isExpanded = expandedKitId === kit.id;
                      return (
                        <div key={kit.id} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/60 space-y-3 transition">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 truncate">
                              <Layers size={16} className="text-primary shrink-0" />
                              <span className="font-bold text-sm text-neutral-800 truncate">{kit.name}</span>
                            </div>
                            <button
                              onClick={() => setExpandedKitId(isExpanded ? null : kit.id)}
                              className="text-[10px] font-black text-primary hover:underline shrink-0"
                            >
                              {isExpanded ? 'Hide' : 'Expand'}
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="pl-6 space-y-1 bg-white p-2 rounded-xl border border-neutral-100">
                              <p className="text-[8px] font-black uppercase text-neutral-400 tracking-wider">Sub-items</p>
                              {(kit.childItemIds || []).map(cid => {
                                const matching = gear.find(g => g.id === cid);
                                return (
                                  <p key={cid} className="text-xs text-neutral-600 truncate">• {matching?.name || 'Kit Asset'}</p>
                                );
                              })}
                              {(kit.childItemIds || []).length === 0 && <p className="text-[9px] text-neutral-400 italic">No sub-items in kit</p>}
                            </div>
                          )}

                          <div className="relative group/load mt-1">
                            <button className="w-full py-1.5 bg-neutral-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-black transition">
                              Load Kit To...
                            </button>
                            <div className="absolute top-full left-0 w-full mt-1 bg-white border border-neutral-200 rounded-xl shadow-xl p-2 hidden group-hover/load:block z-30 max-h-40 overflow-y-auto">
                              {containers.map(c => (
                                <button
                                  key={c.id}
                                  onClick={() => handleLoadSourceToContainerFromSide('kit', kit.id, kit.name, c.id)}
                                  className="w-full text-left p-1.5 hover:bg-neutral-50 rounded-lg text-xs font-semibold truncate"
                                >
                                  {c.name}
                                </button>
                              ))}
                              {containers.length === 0 && <p className="text-[9px] text-neutral-400 italic p-1">No organizers available</p>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {kits.length === 0 && (
                      <p className="text-sm text-neutral-400 text-center py-8 italic bg-neutral-50 rounded-2xl">No kits constructed yet</p>
                    )}
                  </div>
                )}

                {activeRightTab === 'lists' && (
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Active Dispatch Lists</p>
                    {packingLists.filter(l => !l.isTemplate).map(list => (
                      <div key={list.id} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/60 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <FileText size={16} className="text-neutral-500 shrink-0" />
                          <div className="min-w-0">
                            <span className="font-bold text-sm text-neutral-800 truncate block">{list.name}</span>
                            <span className="text-[9px] text-neutral-400">{list.description || 'No description'}</span>
                          </div>
                        </div>

                        <div className="relative group/load">
                          <button className="w-full py-1.5 bg-neutral-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-black transition">
                            Load List To...
                          </button>
                          <div className="absolute top-full left-0 w-full mt-1 bg-white border border-neutral-200 rounded-xl shadow-xl p-2 hidden group-hover/load:block z-30 max-h-40 overflow-y-auto">
                            {containers.map(c => (
                              <button
                                key={c.id}
                                onClick={() => handleLoadSourceToContainerFromSide('list', list.id, list.name, c.id)}
                                className="w-full text-left p-1.5 hover:bg-neutral-50 rounded-lg text-xs font-semibold truncate"
                              >
                                {c.name}
                              </button>
                            ))}
                            {containers.length === 0 && <p className="text-[9px] text-neutral-400 italic p-1">No organizers available</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                    {packingLists.filter(l => !l.isTemplate).length === 0 && (
                      <p className="text-sm text-neutral-400 text-center py-8 italic bg-neutral-50 rounded-2xl">No packing lists created</p>
                    )}
                  </div>
                )}

                {activeRightTab === 'inventories' && (
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Custom Inventory Sheets</p>
                    {inventories.map(inv => (
                      <div key={inv.id} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/60 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <ClipboardList size={16} className="text-neutral-500 shrink-0" />
                          <div className="min-w-0">
                            <span className="font-bold text-sm text-neutral-800 truncate block">{inv.name}</span>
                            <span className="text-[9px] text-neutral-400">{inv.description || 'Corporate inventory template'}</span>
                          </div>
                        </div>

                        <div className="relative group/load">
                          <button className="w-full py-1.5 bg-neutral-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-black transition">
                            Load Sheet To...
                          </button>
                          <div className="absolute top-full left-0 w-full mt-1 bg-white border border-neutral-200 rounded-xl shadow-xl p-2 hidden group-hover/load:block z-30 max-h-40 overflow-y-auto">
                            {containers.map(c => (
                              <button
                                key={c.id}
                                onClick={() => handleLoadSourceToContainerFromSide('inventory', inv.id, inv.name, c.id)}
                                className="w-full text-left p-1.5 hover:bg-neutral-50 rounded-lg text-xs font-semibold truncate"
                              >
                                {c.name}
                              </button>
                            ))}
                            {containers.length === 0 && <p className="text-[9px] text-neutral-400 italic p-1">No organizers available</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                    {inventories.length === 0 && (
                      <p className="text-sm text-neutral-400 text-center py-8 italic bg-neutral-50 rounded-2xl">No inventory sheets constructed</p>
                    )}
                  </div>
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
                  <p className="text-sm text-neutral-500">Select items to add to this organizer.</p>
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

        {/* Add Organizer Modal */}
        <AnimatePresence>
          {isAddModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-lg rounded-[2rem] sm:rounded-[3rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
              >
                {/* Header */}
                <div className="p-6 sm:p-8 border-b border-neutral-100 flex items-center justify-between shrink-0">
                  <h2 className="text-2xl sm:text-3xl font-black">{editingContainerId ? 'Edit Organizer' : 'New Organizer'}</h2>
                  <button onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingContainerId(null);
                    setNewContainer({ type: 'bag', name: '', items: [], locationDetails: { row: '', level: '', bin: '' } });
                  }} className="p-2 hover:bg-neutral-100 rounded-full transition">
                    <Plus className="rotate-45 text-neutral-400" size={24} />
                  </button>
                </div>

                {/* Scrollable Content */}
                <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                  <div className="space-y-4">
                    {/* Photo Section */}
                    <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
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
                      <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Organizer Name</label>
                      <input
                        type="text"
                        value={newContainer.name}
                        onChange={(e) => setNewContainer({ ...newContainer, name: e.target.value })}
                        placeholder="e.g., Lens Bag A, Pelican 1510, Cable Box"
                        className="w-full px-4 py-3 sm:px-6 sm:py-4 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-primary outline-none transition text-sm sm:text-base font-semibold"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Description / Instructions</label>
                      <textarea
                        value={newContainer.description}
                        onChange={(e) => setNewContainer({ ...newContainer, description: e.target.value })}
                        placeholder="Specify how items should be packed or notes for the team..."
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition h-20 resize-none text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Parent (Nesting)</label>
                        <select
                          value={newContainer.parentId || ''}
                          onChange={(e) => setNewContainer({ ...newContainer, parentId: e.target.value || null })}
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition text-sm font-semibold"
                        >
                          <option value="">No Parent (Root Level)</option>
                          {containers.filter(c => c.id !== editingContainerId).map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Linked Packing List</label>
                        <select
                          value={newContainer.packingListId}
                          onChange={(e) => setNewContainer({ ...newContainer, packingListId: e.target.value })}
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition text-sm font-semibold"
                        >
                          <option value="">No Active List</option>
                          {packingLists.filter(list => !list.isTemplate).map(list => (
                            <option key={list.id} value={list.id}>{list.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-2">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Status</label>
                        <select
                          value={newContainer.status}
                          onChange={(e) => setNewContainer({ ...newContainer, status: e.target.value as any })}
                          className="w-full px-3 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition text-xs font-bold"
                        >
                          <option value="storage">Storage</option>
                          <option value="transit">Transit</option>
                          <option value="deployed">Deployed</option>
                          <option value="maintenance">Repair</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Row</label>
                        <input
                          type="text"
                          value={newContainer.locationDetails?.row}
                          onChange={(e) => setNewContainer({ ...newContainer, locationDetails: { ...newContainer.locationDetails, row: e.target.value } })}
                          placeholder="A"
                          className="w-full px-3 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition text-sm text-center font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Level</label>
                        <input
                          type="text"
                          value={newContainer.locationDetails?.level}
                          onChange={(e) => setNewContainer({ ...newContainer, locationDetails: { ...newContainer.locationDetails, level: e.target.value } })}
                          placeholder="1"
                          className="w-full px-3 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition text-sm text-center font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Bin</label>
                        <input
                          type="text"
                          value={newContainer.locationDetails?.bin}
                          onChange={(e) => setNewContainer({ ...newContainer, locationDetails: { ...newContainer.locationDetails, bin: e.target.value } })}
                          placeholder="Box 4"
                          className="w-full px-3 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition text-sm text-center font-bold"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Type</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {['bag', 'case', 'pouch', 'compartment', 'box', 'shelf', 'locker', 'pelican', 'toolbox'].map(type => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setNewContainer({ ...newContainer, type: type as any })}
                            className={`px-2 py-2 rounded-xl font-bold text-[9px] uppercase tracking-widest transition border ${
                              newContainer.type === type 
                                ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm' 
                                : 'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-900'
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer buttons */}
                <div className="p-6 sm:p-8 border-t border-neutral-100 flex gap-4 shrink-0 bg-neutral-50/50">
                  <button 
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-3 bg-neutral-200 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-300 transition text-sm sm:text-base"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleAddContainer}
                    className="flex-1 py-3 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition shadow-lg text-sm sm:text-base"
                  >
                    {editingContainerId ? 'Save Specs' : 'Create'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Organizer Workspace Popover Overlay */}
        <AnimatePresence>
          {focusedOrganizerId && (() => {
            const focusedContainer = containers.find(c => c.id === focusedOrganizerId);
            if (!focusedContainer) return null;
            return (
              <OrganizerWorkspacePopover
                container={focusedContainer}
                containers={containers}
                gear={gear}
                onClose={() => setFocusedOrganizerId(null)}
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
                customDraft={draftAllocations[focusedContainer.id] || null}
                onClearDraft={(cid) => {
                  setDraftAllocations(prev => {
                    const next = { ...prev };
                    delete next[cid];
                    return next;
                  });
                }}
                onConfirmDraft={handleConfirmDraftAllocation}
                onSetDraft={(cid, draft) => {
                  setDraftAllocations(prev => ({ ...prev, [cid]: draft }));
                }}
                onSwitchOrganizer={(id) => setFocusedOrganizerId(id)}
              />
            );
          })()}
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
