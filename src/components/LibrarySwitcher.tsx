import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  Plus, 
  Folder, 
  MoreVertical, 
  Edit3, 
  Trash2, 
  MapPin, 
  Layers, 
  Check, 
  X, 
  Sparkles, 
  Camera, 
  Video, 
  Wrench, 
  Truck, 
  Shield, 
  Box, 
  Compass, 
  Share2, 
  ArrowRight,
  PackageCheck
} from 'lucide-react';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  writeBatch, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { GearLibraryEntity, GearItem, UserProfile } from '../types';
import { toast } from 'sonner';

interface LibrarySwitcherProps {
  user: UserProfile;
  libraries: GearLibraryEntity[];
  selectedLibraryId: string; // 'all' | 'default' | custom library ID
  onSelectLibrary: (libraryId: string) => void;
  gear: GearItem[];
  onOpenAddGearToLibrary?: (libraryId: string) => void;
  onExportLibraryToPackingList?: (library: GearLibraryEntity) => void;
}

const AVAILABLE_COLORS = [
  { id: 'neutral', name: 'Charcoal', bg: 'bg-neutral-900', border: 'border-neutral-800', text: 'text-neutral-900', badge: 'bg-neutral-100 text-neutral-800' },
  { id: 'blue', name: 'Ocean Blue', bg: 'bg-blue-600', border: 'border-blue-500', text: 'text-blue-600', badge: 'bg-blue-50 text-blue-700' },
  { id: 'emerald', name: 'Emerald', bg: 'bg-emerald-600', border: 'border-emerald-500', text: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700' },
  { id: 'amber', name: 'Amber Gold', bg: 'bg-amber-500', border: 'border-amber-400', text: 'text-amber-600', badge: 'bg-amber-50 text-amber-800' },
  { id: 'purple', name: 'Royal Purple', bg: 'bg-purple-600', border: 'border-purple-500', text: 'text-purple-600', badge: 'bg-purple-50 text-purple-700' },
  { id: 'rose', name: 'Crimson Rose', bg: 'bg-rose-600', border: 'border-rose-500', text: 'text-rose-600', badge: 'bg-rose-50 text-rose-700' },
  { id: 'cyan', name: 'Cyan Teal', bg: 'bg-cyan-600', border: 'border-cyan-500', text: 'text-cyan-600', badge: 'bg-cyan-50 text-cyan-700' },
  { id: 'indigo', name: 'Deep Indigo', bg: 'bg-indigo-600', border: 'border-indigo-500', text: 'text-indigo-600', badge: 'bg-indigo-50 text-indigo-700' },
];

const AVAILABLE_ICONS = [
  { id: 'warehouse', label: 'Warehouse', icon: Building2 },
  { id: 'camera', label: 'Camera', icon: Camera },
  { id: 'video', label: 'Video/Film', icon: Video },
  { id: 'tool', label: 'Tooling', icon: Wrench },
  { id: 'truck', label: 'Mobile Van', icon: Truck },
  { id: 'box', label: 'Gear Box', icon: Box },
  { id: 'shield', label: 'Safety/Rigging', icon: Shield },
  { id: 'folder', label: 'Depot', icon: Folder },
  { id: 'sparkles', label: 'Specialty', icon: Sparkles },
];

export const LibraryIcon = ({ name, size = 16, className = "" }: { name?: string; size?: number; className?: string }) => {
  switch (name) {
    case 'camera': return <Camera size={size} className={className} />;
    case 'video': return <Video size={size} className={className} />;
    case 'tool': return <Wrench size={size} className={className} />;
    case 'truck': return <Truck size={size} className={className} />;
    case 'box': return <Box size={size} className={className} />;
    case 'shield': return <Shield size={size} className={className} />;
    case 'sparkles': return <Sparkles size={size} className={className} />;
    case 'folder': return <Folder size={size} className={className} />;
    case 'warehouse':
    default:
      return <Building2 size={size} className={className} />;
  }
};

export default function LibrarySwitcher({
  user,
  libraries,
  selectedLibraryId,
  onSelectLibrary,
  gear,
  onOpenAddGearToLibrary,
  onExportLibraryToPackingList,
}: LibrarySwitcherProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingLibrary, setEditingLibrary] = useState<GearLibraryEntity | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [libraryToDelete, setLibraryToDelete] = useState<GearLibraryEntity | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [color, setColor] = useState('blue');
  const [icon, setIcon] = useState('warehouse');
  const [isSaving, setIsSaving] = useState(false);

  // Calculate item count per library
  const getItemCount = (libId: string) => {
    if (libId === 'all') return gear.length;
    if (libId === 'default') {
      return gear.filter(i => !i.libraryId || i.libraryId === 'default').length;
    }
    return gear.filter(i => i.libraryId === libId).length;
  };

  const activeLibrary = libraries.find(l => l.id === selectedLibraryId);
  const isCustomActive = selectedLibraryId !== 'all' && selectedLibraryId !== 'default' && activeLibrary;

  const handleOpenCreate = () => {
    setName('');
    setDescription('');
    setLocation('');
    setColor('blue');
    setIcon('warehouse');
    setEditingLibrary(null);
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (lib: GearLibraryEntity, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingLibrary(lib);
    setName(lib.name);
    setDescription(lib.description || '');
    setLocation(lib.location || '');
    setColor(lib.color || 'blue');
    setIcon(lib.icon || 'warehouse');
    setIsCreateModalOpen(true);
  };

  const handleOpenDelete = (lib: GearLibraryEntity, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setLibraryToDelete(lib);
    setIsDeleteModalOpen(true);
  };

  const handleSaveLibrary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter a library name.');
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading(editingLibrary ? 'Updating library...' : 'Creating new gear library...');

    try {
      if (editingLibrary) {
        // Update existing library
        await updateDoc(doc(db, 'gearLibraries', editingLibrary.id), {
          name: name.trim(),
          description: description.trim(),
          location: location.trim(),
          color,
          icon,
          updatedAt: new Date().toISOString(),
        });
        toast.success(`Library "${name}" updated successfully!`, { id: toastId });
      } else {
        // Create new library
        const newDocRef = await addDoc(collection(db, 'gearLibraries'), {
          name: name.trim(),
          description: description.trim(),
          location: location.trim(),
          color,
          icon,
          ownerId: user.uid,
          ownerEmail: user.email || '',
          orgId: user.orgId || '',
          deptId: user.deptId || '',
          isDefault: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Automatically switch to the newly created library
        onSelectLibrary(newDocRef.id);
        toast.success(`New library "${name}" created!`, { id: toastId });
      }

      setIsCreateModalOpen(false);
      setEditingLibrary(null);
    } catch (err: any) {
      console.error('Error saving gear library:', err);
      toast.error(`Failed to save library: ${err.message || 'Unknown error'}`, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLibrary = async () => {
    if (!libraryToDelete) return;
    setIsSaving(true);
    const toastId = toast.loading(`Deleting library "${libraryToDelete.name}"...`);

    try {
      // Find all gear items assigned to this library and reassign them to 'default'
      const itemsToReassign = gear.filter(i => i.libraryId === libraryToDelete.id);
      if (itemsToReassign.length > 0) {
        for (let i = 0; i < itemsToReassign.length; i += 400) {
          const chunk = itemsToReassign.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach(item => {
            batch.update(doc(db, 'gear', item.id), { libraryId: 'default' });
          });
          await batch.commit();
        }
      }

      // Delete the library doc
      await deleteDoc(doc(db, 'gearLibraries', libraryToDelete.id));

      if (selectedLibraryId === libraryToDelete.id) {
        onSelectLibrary('all');
      }

      toast.success(`Library deleted. ${itemsToReassign.length} item(s) moved to Main Depot.`, { id: toastId });
      setIsDeleteModalOpen(false);
      setLibraryToDelete(null);
    } catch (err: any) {
      console.error('Error deleting library:', err);
      toast.error(`Failed to delete library: ${err.message || 'Unknown error'}`, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full space-y-3" id="gear-library-switcher-container">
      {/* Top Bar: Switcher Tabs & Quick Create */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/70 backdrop-blur-md p-2 rounded-2xl md:rounded-3xl border border-neutral-200/80 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-0.5 px-1 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 shrink-0 text-neutral-400 font-mono text-[9px] uppercase tracking-widest font-black mr-1 hidden lg:flex">
            <Layers size={13} className="text-neutral-500" />
            <span>Depots:</span>
          </div>

          {/* All Gear Tab */}
          <button
            type="button"
            onClick={() => onSelectLibrary('all')}
            className={`shrink-0 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-150 flex items-center gap-2 border ${
              selectedLibraryId === 'all'
                ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm'
                : 'bg-neutral-50 text-neutral-600 border-neutral-200/70 hover:bg-neutral-100 hover:text-neutral-900'
            }`}
          >
            <Layers size={13} className={selectedLibraryId === 'all' ? 'text-neutral-300' : 'text-neutral-400'} />
            <span>All Gear</span>
            <span className={`text-[9px] px-1.5 py-0.2 rounded-md font-mono ${
              selectedLibraryId === 'all' ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700'
            }`}>
              {getItemCount('all')}
            </span>
          </button>

          {/* Main / Primary Depot Tab */}
          <button
            type="button"
            onClick={() => onSelectLibrary('default')}
            className={`shrink-0 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-150 flex items-center gap-2 border ${
              selectedLibraryId === 'default'
                ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm'
                : 'bg-neutral-50 text-neutral-600 border-neutral-200/70 hover:bg-neutral-100 hover:text-neutral-900'
            }`}
          >
            <Building2 size={13} className={selectedLibraryId === 'default' ? 'text-amber-400' : 'text-neutral-400'} />
            <span>Main Depot</span>
            <span className={`text-[9px] px-1.5 py-0.2 rounded-md font-mono ${
              selectedLibraryId === 'default' ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700'
            }`}>
              {getItemCount('default')}
            </span>
          </button>

          {/* Custom User Libraries */}
          {libraries.map(lib => {
            const isSelected = selectedLibraryId === lib.id;
            const colorConfig = AVAILABLE_COLORS.find(c => c.id === lib.color) || AVAILABLE_COLORS[1];
            const count = getItemCount(lib.id);

            return (
              <div key={lib.id} className="relative group shrink-0">
                <button
                  type="button"
                  onClick={() => onSelectLibrary(lib.id)}
                  className={`px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-150 flex items-center gap-2 border ${
                    isSelected
                      ? `${colorConfig.bg} text-white ${colorConfig.border} shadow-sm`
                      : 'bg-neutral-50 text-neutral-700 border-neutral-200/70 hover:bg-neutral-100 hover:text-neutral-900'
                  }`}
                >
                  <LibraryIcon name={lib.icon} size={13} className={isSelected ? 'text-white' : colorConfig.text} />
                  <span className="max-w-[120px] truncate">{lib.name}</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded-md font-mono ${
                    isSelected ? 'bg-black/25 text-white' : 'bg-neutral-200 text-neutral-700'
                  }`}>
                    {count}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Add Library Button */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-3 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition active:scale-95 shadow-xs cursor-pointer"
            title="Create a dedicated new gear library or depot"
            id="create-gear-library-button"
          >
            <Plus size={13} className="text-amber-400" />
            <span>New Library</span>
          </button>
        </div>
      </div>

      {/* Active Custom Library Context Deck */}
      {isCustomActive && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="bg-white rounded-2xl md:rounded-3xl border border-neutral-200/90 p-4 md:p-5 shadow-xs"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start md:items-center gap-3.5">
              <div className={`p-3 rounded-2xl ${AVAILABLE_COLORS.find(c => c.id === activeLibrary.color)?.bg || 'bg-neutral-900'} text-white shadow-sm shrink-0`}>
                <LibraryIcon name={activeLibrary.icon} size={20} />
              </div>
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base md:text-lg font-black uppercase tracking-tight text-neutral-900 truncate">
                    {activeLibrary.name}
                  </h2>
                  <span className="px-2 py-0.5 rounded-md bg-neutral-100 border border-neutral-200 text-neutral-600 text-[9px] font-mono font-bold uppercase tracking-wider">
                    {getItemCount(activeLibrary.id)} Assets
                  </span>
                  {activeLibrary.location && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-neutral-500 bg-neutral-50 border border-neutral-200/60 px-2 py-0.5 rounded-md">
                      <MapPin size={11} className="text-neutral-400" />
                      <span>{activeLibrary.location}</span>
                    </span>
                  )}
                </div>
                {activeLibrary.description ? (
                  <p className="text-xs text-neutral-500 font-medium line-clamp-1">{activeLibrary.description}</p>
                ) : (
                  <p className="text-[10px] text-neutral-400 font-mono uppercase tracking-wider">Dedicated Gear Depot & Equipment Registry</p>
                )}
              </div>
            </div>

            {/* Quick Actions for active library */}
            <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
              {onExportLibraryToPackingList && (
                <button
                  type="button"
                  onClick={() => onExportLibraryToPackingList(activeLibrary)}
                  className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-[9.5px] font-black uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer"
                  title="Generate packing manifest from this library"
                >
                  <Share2 size={12} className="text-neutral-500" />
                  <span>Push to List</span>
                </button>
              )}
              {onOpenAddGearToLibrary && (
                <button
                  type="button"
                  onClick={() => onOpenAddGearToLibrary(activeLibrary.id)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[9.5px] font-black uppercase tracking-wider flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                  title={`Add a new gear item directly to ${activeLibrary.name}`}
                >
                  <Plus size={12} />
                  <span>Add Item to Library</span>
                </button>
              )}
              <button
                type="button"
                onClick={(e) => handleOpenEdit(activeLibrary, e)}
                className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl transition cursor-pointer"
                title="Edit library settings"
              >
                <Edit3 size={13} />
              </button>
              <button
                type="button"
                onClick={(e) => handleOpenDelete(activeLibrary, e)}
                className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition cursor-pointer"
                title="Delete this library"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Modal: Create or Edit Gear Library */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-neutral-100"
            >
              <div className="p-6 md:p-8 flex items-center justify-between border-b border-neutral-100 bg-neutral-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-neutral-900 text-white rounded-2xl">
                    <Building2 size={20} className="text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight text-neutral-900">
                      {editingLibrary ? 'Edit Gear Library' : 'Create Gear Library'}
                    </h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#0066cc]">
                      Multi-Depot Inventory Organization
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-2 hover:bg-neutral-100 rounded-xl text-neutral-400 hover:text-neutral-900 transition"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveLibrary} className="p-6 md:p-8 space-y-5">
                {/* Library Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block font-sans">
                    Library / Depot Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Camera Department Locker, Stage A Lighting, Van #1"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-neutral-900 outline-none"
                  />
                </div>

                {/* Location */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block font-sans">
                    Physical Location or Station (Optional)
                  </label>
                  <div className="relative">
                    <MapPin size={15} className="absolute left-3.5 top-3.5 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="e.g. Main Warehouse - Bay 4, Stage 3 Lockup, Truck A"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-10 pr-4 py-3 text-xs font-bold focus:ring-2 focus:ring-neutral-900 outline-none"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block font-sans">
                    Description & Purpose (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Brief summary of assets or gear types stored in this library..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-neutral-900 outline-none resize-none"
                  />
                </div>

                {/* Icon Selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block font-sans">
                    Depot Icon
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {AVAILABLE_ICONS.map(ic => {
                      const IconComp = ic.icon;
                      const isSelected = icon === ic.id;
                      return (
                        <button
                          key={ic.id}
                          type="button"
                          onClick={() => setIcon(ic.id)}
                          className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition ${
                            isSelected
                              ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm'
                              : 'bg-neutral-50 text-neutral-600 border-neutral-200 hover:border-neutral-400'
                          }`}
                        >
                          <IconComp size={16} />
                          <span className="text-[8px] font-bold uppercase truncate max-w-full">{ic.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Color Selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block font-sans">
                    Color Accent
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_COLORS.map(c => {
                      const isSelected = color === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setColor(c.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border transition ${
                            isSelected
                              ? `${c.bg} text-white ${c.border} ring-2 ring-neutral-900/20`
                              : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${c.bg}`} />
                          <span>{c.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-4 border-t border-neutral-100 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="flex-1 py-3.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl font-bold uppercase text-[10px] tracking-wider transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !name.trim()}
                    className="flex-1 py-3.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSaving ? 'Saving...' : editingLibrary ? 'Update Library' : 'Create Library'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Delete Library Confirmation */}
      <AnimatePresence>
        {isDeleteModalOpen && libraryToDelete && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-neutral-100 p-6 md:p-8 space-y-5"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 size={24} />
              </div>
              <div className="text-center space-y-1.5">
                <h3 className="text-lg font-black uppercase tracking-tight text-neutral-900">
                  Delete "{libraryToDelete.name}"?
                </h3>
                <p className="text-xs text-neutral-500 leading-relaxed font-medium">
                  Any gear items currently in this library will be automatically moved to your <strong>Main Depot</strong> so no equipment records are lost.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setLibraryToDelete(null);
                  }}
                  className="flex-1 py-3.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl font-bold uppercase text-[10px] tracking-wider transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleDeleteLibrary}
                  className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSaving ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
