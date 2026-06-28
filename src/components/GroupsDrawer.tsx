import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Folder, 
  Plus, 
  Trash2, 
  X, 
  Layers, 
  FileText, 
  Briefcase, 
  LayoutGrid, 
  Box, 
  Sparkles, 
  Search, 
  Check, 
  ChevronRight, 
  PlusCircle, 
  ExternalLink,
  ChevronLeft
} from 'lucide-react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc,
  getDocs,
  getDoc
} from 'firebase/firestore';
import { UserProfile, Group } from '../types';
import { toast } from 'sonner';

interface GroupsDrawerProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
}

export default function GroupsDrawer({ user, isOpen, onClose }: GroupsDrawerProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Creation state
  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupType, setNewGroupType] = useState<Group['entityType']>('general');

  // Active Group Detail state (null if showing group list)
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  
  // Available items for adding to groups (fetched dynamically based on group type)
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingItems, setLoadingItems] = useState(false);

  // Context item (the item on the current page)
  const [contextItem, setContextItem] = useState<{ id: string; name: string; type: Group['entityType'] } | null>(null);

  // Listen to groups
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'groups'),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Group[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Group);
      });
      // Sort by creation time / updated time
      list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setGroups(list);
      setLoading(false);

      // If activeGroup is currently open, keep it updated
      if (activeGroup) {
        const updated = list.find(g => g.id === activeGroup.id);
        if (updated) {
          setActiveGroup(updated);
        } else {
          setActiveGroup(null);
        }
      }
    }, (error) => {
      console.error("GroupsDrawer: Failed to listen to groups:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, activeGroup?.id]);

  // Detect context item from URL/Hash
  useEffect(() => {
    if (!isOpen) return;

    const handleContextDetection = async () => {
      setContextItem(null);
      const hash = window.location.hash; // e.g. #/list/abc, #/project/xyz
      const parts = hash.split('/');
      
      if (parts.length >= 3) {
        const typePart = parts[1]; // list, project, gear, organizer
        const idPart = parts[2].split('?')[0]; // strip query parameters
        
        if (!idPart) return;

        try {
          if (typePart === 'list') {
            const docRef = doc(db, 'packingLists', idPart);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
              setContextItem({
                id: idPart,
                name: snap.data().name || 'Packing List',
                type: 'packing_lists'
              });
            }
          } else if (typePart === 'project') {
            const docRef = doc(db, 'projects', idPart);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
              setContextItem({
                id: idPart,
                name: snap.data().name || 'Project',
                type: 'projects'
              });
            }
          } else if (typePart === 'gear') {
            const docRef = doc(db, 'users', user.uid, 'gearLibrary', idPart);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
              setContextItem({
                id: idPart,
                name: snap.data().name || 'Gear Item',
                type: snap.data().isKit ? 'kits' : 'gear'
              });
            }
          } else if (typePart === 'organizer') {
            // Check if it's a specific container
            const docRef = doc(db, 'users', user.uid, 'containers', idPart);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
              setContextItem({
                id: idPart,
                name: snap.data().name || 'Container',
                type: 'organizers'
              });
            }
          }
        } catch (e) {
          console.error("Error detecting context item:", e);
        }
      }
    };

    handleContextDetection();
  }, [isOpen, window.location.hash, user.uid]);

  // Fetch items based on active group's entityType to populate search
  useEffect(() => {
    if (!activeGroup) {
      setAvailableItems([]);
      return;
    }

    const fetchItems = async () => {
      setLoadingItems(true);
      try {
        const list: any[] = [];
        const type = activeGroup.entityType;

        if (type === 'packing_lists' || type === 'general') {
          const q = query(collection(db, 'packingLists'), where('ownerId', '==', user.uid));
          const snap = await getDocs(q);
          snap.forEach(doc => {
            list.push({ id: doc.id, name: doc.data().name, type: 'packing_lists' });
          });
        }
        
        if (type === 'projects' || type === 'general') {
          const q = query(collection(db, 'projects'), where('ownerId', '==', user.uid));
          const snap = await getDocs(q);
          snap.forEach(doc => {
            list.push({ id: doc.id, name: doc.data().name, type: 'projects' });
          });
        }

        if (type === 'inventories' || type === 'general') {
          const q = query(collection(db, 'inventories'), where('ownerId', '==', user.uid));
          const snap = await getDocs(q);
          snap.forEach(doc => {
            list.push({ id: doc.id, name: doc.data().name, type: 'inventories' });
          });
        }

        if (type === 'organizers' || type === 'general') {
          const q = query(collection(db, 'users', user.uid, 'containers'));
          const snap = await getDocs(q);
          snap.forEach(doc => {
            list.push({ id: doc.id, name: doc.data().name || `${doc.data().brand} ${doc.data().model}`, type: 'organizers' });
          });
        }

        if (type === 'gear' || type === 'kits' || type === 'general') {
          const q = query(collection(db, 'users', user.uid, 'gearLibrary'));
          const snap = await getDocs(q);
          snap.forEach(doc => {
            const data = doc.data();
            const isKit = !!data.isKit;
            if (type === 'kits' && !isKit) return;
            if (type === 'gear' && isKit) return;
            list.push({ id: doc.id, name: data.name, type: isKit ? 'kits' : 'gear' });
          });
        }

        setAvailableItems(list);
      } catch (err) {
        console.error("Error fetching available items:", err);
      } finally {
        setLoadingItems(false);
      }
    };

    fetchItems();
  }, [activeGroup, user.uid]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      toast.error("Please provide a group name");
      return;
    }

    try {
      const now = new Date().toISOString();
      const payload: Omit<Group, 'id'> = {
        ownerId: user.uid,
        name: newGroupName.trim(),
        description: newGroupDesc.trim(),
        createdAt: now,
        updatedAt: now,
        entityType: newGroupType,
        entityIds: contextItem && (newGroupType === 'general' || newGroupType === contextItem.type) 
          ? [contextItem.id] 
          : []
      };

      const docRef = await addDoc(collection(db, 'groups'), payload);
      toast.success(`Group "${newGroupName}" created successfully!`);
      
      // Reset forms
      setNewGroupName('');
      setNewGroupDesc('');
      setIsCreating(false);
      
      // Automatically open the newly created group details
      setActiveGroup({ id: docRef.id, ...payload } as Group);
    } catch (err) {
      console.error("Error creating group:", err);
      toast.error("Failed to create group.");
    }
  };

  const handleDeleteGroup = async (groupId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the group "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'groups', groupId));
      toast.success(`Group "${name}" deleted`);
      if (activeGroup?.id === groupId) {
        setActiveGroup(null);
      }
    } catch (err) {
      console.error("Error deleting group:", err);
      toast.error("Failed to delete group");
    }
  };

  const handleAddItemToGroup = async (groupId: string, itemId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    if (group.entityIds.includes(itemId)) {
      toast.error("Item is already in this group");
      return;
    }

    try {
      const updatedIds = [...group.entityIds, itemId];
      await updateDoc(doc(db, 'groups', groupId), {
        entityIds: updatedIds,
        updatedAt: new Date().toISOString()
      });
      toast.success("Item added to group!");
    } catch (err) {
      console.error("Error adding item:", err);
      toast.error("Failed to add item to group");
    }
  };

  const handleRemoveItemFromGroup = async (groupId: string, itemId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    try {
      const updatedIds = group.entityIds.filter(id => id !== itemId);
      await updateDoc(doc(db, 'groups', groupId), {
        entityIds: updatedIds,
        updatedAt: new Date().toISOString()
      });
      toast.success("Item removed from group");
    } catch (err) {
      console.error("Error removing item:", err);
      toast.error("Failed to remove item");
    }
  };

  const getEntityTypeLabel = (type: Group['entityType']) => {
    switch (type) {
      case 'packing_lists': return 'Packing Lists';
      case 'kits': return 'Kits';
      case 'projects': return 'Projects';
      case 'inventories': return 'Inventories';
      case 'organizers': return 'Organizer Containers';
      case 'gear': return 'Individual Gear';
      case 'general': return 'Mixed/General';
      default: return 'Mixed';
    }
  };

  const getEntityTypeIcon = (type: Group['entityType'], size = 16) => {
    switch (type) {
      case 'packing_lists': return <FileText size={size} className="text-blue-500" />;
      case 'kits': return <Sparkles size={size} className="text-yellow-500" />;
      case 'projects': return <Briefcase size={size} className="text-green-500" />;
      case 'inventories': return <LayoutGrid size={size} className="text-purple-500" />;
      case 'organizers': return <Box size={size} className="text-indigo-500" />;
      case 'gear': return <Folder size={size} className="text-orange-500" />;
      default: return <Layers size={size} className="text-neutral-500" />;
    }
  };

  const getEntityPageUrl = (id: string, type: string) => {
    switch (type) {
      case 'packing_lists': return `#/list/${id}`;
      case 'projects': return `#/project/${id}`;
      case 'gear': return `#/gear/${id}`;
      case 'kits': return `#/gear/${id}`;
      case 'organizers': return `#/organizer/${id}/io`;
      case 'inventories': return `#/inventory`;
      default: return `#/dashboard`;
    }
  };

  // Filter available items based on search query and already included list
  const filteredAvailableItems = availableItems.filter(item => {
    const nameMatch = item.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const notAlreadyInGroup = activeGroup ? !activeGroup.entityIds.includes(item.id) : true;
    return nameMatch && notAlreadyInGroup;
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-neutral-950 z-[100]"
          />

          {/* Drawer Container */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white border-l border-neutral-200 shadow-2xl z-[101] flex flex-col font-sans text-neutral-800"
          >
            {/* Header */}
            <div className="p-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 bg-neutral-900 text-white rounded-xl flex items-center justify-center">
                  <Layers size={20} className="stroke-[2.5]" />
                </div>
                <div>
                  <h2 className="font-black text-sm tracking-widest uppercase text-neutral-850">Groups Module</h2>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Access & Organize Anywhere</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 text-neutral-400 hover:text-neutral-800 rounded-lg hover:bg-neutral-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Context Action Banner - Show if viewing a specific item */}
              {contextItem && !activeGroup && !isCreating && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-amber-50/75 border border-amber-200/50 rounded-2xl space-y-3"
                >
                  <div className="flex gap-2">
                    {getEntityTypeIcon(contextItem.type, 18)}
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider">Current Resource Detected</span>
                      <p className="font-extrabold text-xs text-amber-950 uppercase line-clamp-1">{contextItem.name}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setNewGroupType(contextItem.type);
                        setIsCreating(true);
                      }}
                      className="flex-1 py-2 bg-neutral-900 hover:bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition"
                    >
                      Create Group for This
                    </button>
                    {groups.length > 0 && (
                      <div className="relative flex-1">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAddItemToGroup(e.target.value, contextItem.id);
                              e.target.value = '';
                            }
                          }}
                          className="w-full py-2 px-3 bg-white border border-neutral-200 text-[10px] font-black uppercase tracking-widest rounded-xl outline-none appearance-none cursor-pointer"
                        >
                          <option value="">Add to Existing Group</option>
                          {groups
                            .filter(g => g.entityType === 'general' || g.entityType === contextItem.type)
                            .map(g => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))
                          }
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                          <PlusCircle size={12} />
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {isCreating ? (
                /* New Group Form */
                <form onSubmit={handleCreateGroup} className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
                    <button 
                      type="button" 
                      onClick={() => setIsCreating(false)}
                      className="p-1.5 text-neutral-400 hover:text-neutral-800 rounded-lg hover:bg-neutral-50 transition"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <h3 className="font-black text-xs uppercase tracking-wider text-neutral-800">Create New Group</h3>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Group Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Production Setup Alpha"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      className="w-full p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:border-black outline-none transition font-black tracking-tight text-xs uppercase"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Description</label>
                    <textarea
                      placeholder="Specify purpose, location, or checklist tags..."
                      value={newGroupDesc}
                      onChange={(e) => setNewGroupDesc(e.target.value)}
                      rows={3}
                      className="w-full p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:border-black outline-none transition font-medium text-xs text-neutral-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Group Resource Type</label>
                    <select
                      value={newGroupType}
                      onChange={(e) => setNewGroupType(e.target.value as Group['entityType'])}
                      className="w-full p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:border-black outline-none transition font-black tracking-tight text-xs uppercase"
                    >
                      <option value="general">Mixed / General (Any resource)</option>
                      <option value="packing_lists">Packing Lists Only</option>
                      <option value="projects">Projects Only</option>
                      <option value="inventories">Inventories Only</option>
                      <option value="organizers">Organizer Containers Only</option>
                      <option value="kits">Kits Only</option>
                      <option value="gear">Individual Gear Only</option>
                    </select>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsCreating(false)}
                      className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-black uppercase tracking-widest rounded-xl transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-3 bg-neutral-950 hover:bg-black text-white text-xs font-black uppercase tracking-widest rounded-xl transition"
                    >
                      Save Group
                    </button>
                  </div>
                </form>
              ) : activeGroup ? (
                /* Group details view */
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                    <button 
                      onClick={() => {
                        setActiveGroup(null);
                        setSearchQuery('');
                      }}
                      className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-400 hover:text-neutral-800 transition"
                    >
                      <ChevronLeft size={14} /> Back to Groups
                    </button>
                    
                    <button 
                      onClick={() => handleDeleteGroup(activeGroup.id, activeGroup.name)}
                      className="p-1.5 text-neutral-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                      title="Delete Group"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* Header summary info */}
                  <div className="space-y-1.5 p-4 bg-neutral-50 rounded-2xl border border-neutral-150">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-widest bg-neutral-200 rounded-md text-neutral-600">
                        {getEntityTypeLabel(activeGroup.entityType)}
                      </span>
                      <span className="text-[10px] font-bold text-neutral-400">{activeGroup.entityIds.length} items</span>
                    </div>
                    <h3 className="font-black text-sm uppercase text-neutral-850 tracking-tight">{activeGroup.name}</h3>
                    {activeGroup.description && (
                      <p className="text-[11px] text-neutral-500 font-medium leading-relaxed">{activeGroup.description}</p>
                    )}
                  </div>

                  {/* Add item search dropdown inside detail view */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Add Items to This Group</label>
                    <div className="relative">
                      <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input
                        type="text"
                        placeholder="Search items to attach..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:border-black outline-none text-xs transition uppercase font-black"
                      />
                    </div>

                    {searchQuery.trim().length > 0 && (
                      <div className="bg-white border border-neutral-200 rounded-xl max-h-48 overflow-y-auto divide-y divide-neutral-100 shadow-lg">
                        {loadingItems ? (
                          <div className="p-3 text-[10px] text-neutral-400 text-center font-bold">LOADING INSTANCES...</div>
                        ) : filteredAvailableItems.length === 0 ? (
                          <div className="p-3 text-[10px] text-neutral-400 text-center font-bold">NO MATCHING ITEMS</div>
                        ) : (
                          filteredAvailableItems.map(item => (
                            <button
                              key={item.id}
                              onClick={() => {
                                handleAddItemToGroup(activeGroup.id, item.id);
                                setSearchQuery('');
                              }}
                              className="w-full p-3 text-left hover:bg-neutral-50 flex items-center justify-between text-xs transition font-black uppercase tracking-tight"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {getEntityTypeIcon(item.type, 14)}
                                <span className="truncate">{item.name}</span>
                              </div>
                              <PlusCircle size={14} className="text-neutral-400 hover:text-black shrink-0" />
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* List of included group items */}
                  <div className="space-y-2.5">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Included Group Members</h4>
                    
                    {activeGroup.entityIds.length === 0 ? (
                      <div className="p-6 bg-dashed border-2 border-neutral-200 rounded-2xl text-center">
                        <Folder size={24} className="mx-auto text-neutral-300 stroke-[1.5] mb-2" />
                        <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">Group is Empty</span>
                        <p className="text-[9px] text-neutral-500 mt-1">Search above or detect page content to populate this group.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* Resolve group items display names */}
                        {activeGroup.entityIds.map(itemId => {
                          const matchingItem = availableItems.find(i => i.id === itemId);
                          const resolvedName = matchingItem?.name || `Resource: ${itemId.substring(0, 8)}...`;
                          const resolvedType = matchingItem?.type || activeGroup.entityType;

                          return (
                            <div 
                              key={itemId}
                              className="p-3 bg-white border border-neutral-200 hover:border-neutral-300 rounded-xl flex items-center justify-between gap-3 group transition"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {getEntityTypeIcon(resolvedType, 16)}
                                <div className="min-w-0">
                                  <span className="font-extrabold text-xs text-neutral-850 truncate block uppercase leading-none">{resolvedName}</span>
                                  <span className="text-[8px] font-black uppercase tracking-wider text-neutral-400 mt-1 block">
                                    {getEntityTypeLabel(resolvedType)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <a 
                                  href={getEntityPageUrl(itemId, resolvedType)}
                                  onClick={onClose}
                                  className="p-1.5 text-neutral-400 hover:text-neutral-800 rounded-lg hover:bg-neutral-50 transition"
                                  title="Navigate to page"
                                >
                                  <ExternalLink size={14} />
                                </a>
                                <button 
                                  onClick={() => handleRemoveItemFromGroup(activeGroup.id, itemId)}
                                  className="p-1.5 text-neutral-400 hover:text-red-500 rounded-lg hover:bg-neutral-50 transition"
                                  title="Remove from group"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Group List Dashboard */
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-1">
                    <h3 className="font-black text-xs uppercase tracking-wider text-neutral-400">All Groups ({groups.length})</h3>
                    <button
                      onClick={() => setIsCreating(true)}
                      className="flex items-center gap-1 text-[10px] font-black bg-neutral-900 hover:bg-black text-white px-3 py-1.5 rounded-lg transition uppercase tracking-widest"
                    >
                      <Plus size={12} /> New Group
                    </button>
                  </div>

                  {loading ? (
                    <div className="py-12 text-center text-xs text-neutral-400 font-bold uppercase tracking-widest">LOADING GROUPS...</div>
                  ) : groups.length === 0 ? (
                    <div className="py-12 bg-neutral-50 border border-neutral-100 rounded-2xl text-center px-4">
                      <Folder size={32} className="mx-auto text-neutral-300 stroke-[1.5] mb-3" />
                      <span className="text-xs font-black text-neutral-850 uppercase tracking-widest">No Groups Found</span>
                      <p className="text-[10px] text-neutral-500 leading-relaxed max-w-[220px] mx-auto mt-2 font-medium">
                        Create custom resource groups to categorize packing checklists, toolings, camera kits, site manifests, or specific project setups!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {groups.map(group => (
                        <div
                          key={group.id}
                          onClick={() => setActiveGroup(group)}
                          className="p-4 bg-white border border-neutral-200 hover:border-neutral-400 rounded-2xl cursor-pointer hover:shadow-sm transition flex items-center justify-between gap-4"
                        >
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {getEntityTypeIcon(group.entityType, 15)}
                              <span className="font-black text-xs uppercase text-neutral-850 truncate block tracking-tight">
                                {group.name}
                              </span>
                            </div>
                            {group.description && (
                              <p className="text-[10px] text-neutral-500 truncate font-medium">{group.description}</p>
                            )}
                            <div className="flex items-center gap-1.5 pt-0.5">
                              <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-neutral-100 text-neutral-500 rounded tracking-wider">
                                {getEntityTypeLabel(group.entityType)}
                              </span>
                              <span className="text-[8px] font-black uppercase text-neutral-400">
                                • {group.entityIds?.length || 0} items
                              </span>
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-neutral-400 shrink-0" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
