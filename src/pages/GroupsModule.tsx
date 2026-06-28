import React, { useState, useEffect } from 'react';
import { useIndustry } from '../context/IndustryContext';
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
  getDocs
} from 'firebase/firestore';
import { 
  Folder, 
  Plus, 
  Trash2, 
  Edit3, 
  Layers, 
  FileText, 
  Briefcase, 
  LayoutGrid, 
  Box, 
  Sparkles, 
  Search, 
  X, 
  Check, 
  ChevronRight, 
  ArrowRight,
  ExternalLink,
  PlusCircle,
  HelpCircle,
  Grid,
  List as ListIcon,
  Filter,
  Calendar,
  Clock
} from 'lucide-react';
import { UserProfile, Group, PackingList, Project } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface GroupsModuleProps {
  user: UserProfile;
  adminSettings: any;
}

export default function GroupsModule({ user, adminSettings }: GroupsModuleProps) {
  const { getAdjustedLabel } = useIndustry();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Selected Group details modal state
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  // Form Creation / Editing Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupType, setGroupType] = useState<Group['entityType']>('general');

  // Available items for addition to groups
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [loadingItems, setLoadingItems] = useState(false);

  // Listen to Groups collection
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
      list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setGroups(list);
      setLoading(false);

      // Keep selected group updated
      if (selectedGroup) {
        const updated = list.find(g => g.id === selectedGroup.id);
        if (updated) setSelectedGroup(updated);
        else setSelectedGroup(null);
      }
    }, (error) => {
      console.error("GroupsModule: Error loading groups:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, selectedGroup?.id]);

  // Fetch all potential group items so we can show their real names and support autocomplete
  useEffect(() => {
    const fetchAllAvailableItems = async () => {
      setLoadingItems(true);
      try {
        const itemsList: any[] = [];

        // 1. Fetch Packing Lists
        const qLists = query(collection(db, 'packingLists'), where('ownerId', '==', user.uid));
        const snapLists = await getDocs(qLists);
        snapLists.forEach(doc => {
          itemsList.push({ id: doc.id, name: doc.data().name, type: 'packing_lists' });
        });

        // 2. Fetch Projects
        const qProjects = query(collection(db, 'projects'), where('ownerId', '==', user.uid));
        const snapProjects = await getDocs(qProjects);
        snapProjects.forEach(doc => {
          itemsList.push({ id: doc.id, name: doc.data().name, type: 'projects' });
        });

        // 3. Fetch Inventories
        const qInventories = query(collection(db, 'inventories'), where('ownerId', '==', user.uid));
        const snapInventories = await getDocs(qInventories);
        snapInventories.forEach(doc => {
          itemsList.push({ id: doc.id, name: doc.data().name, type: 'inventories' });
        });

        // 4. Fetch Containers
        const qContainers = query(collection(db, 'users', user.uid, 'containers'));
        const snapContainers = await getDocs(qContainers);
        snapContainers.forEach(doc => {
          itemsList.push({ id: doc.id, name: doc.data().name || `${doc.data().brand} ${doc.data().model}`, type: 'organizers' });
        });

        // 5. Fetch Gear Library (including Kits)
        const qGear = query(collection(db, 'users', user.uid, 'gearLibrary'));
        const snapGear = await getDocs(qGear);
        snapGear.forEach(doc => {
          const data = doc.data();
          itemsList.push({ id: doc.id, name: data.name, type: data.isKit ? 'kits' : 'gear' });
        });

        setAvailableItems(itemsList);
      } catch (err) {
        console.error("GroupsModule: Error loading entities map:", err);
      } finally {
        setLoadingItems(false);
      }
    };

    fetchAllAvailableItems();
  }, [user.uid]);

  const handleOpenCreateForm = () => {
    setEditingGroup(null);
    setGroupName('');
    setGroupDesc('');
    setGroupType('general');
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (group: Group, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingGroup(group);
    setGroupName(group.name);
    setGroupDesc(group.description || '');
    setGroupType(group.entityType);
    setIsFormOpen(true);
  };

  const handleSaveGroupForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      toast.error("Please provide a group name");
      return;
    }

    try {
      const now = new Date().toISOString();
      if (editingGroup) {
        // Update existing group
        await updateDoc(doc(db, 'groups', editingGroup.id), {
          name: groupName.trim(),
          description: groupDesc.trim(),
          entityType: groupType,
          updatedAt: now
        });
        toast.success(`Group "${groupName}" updated!`);
      } else {
        // Create new group
        const payload: Omit<Group, 'id'> = {
          ownerId: user.uid,
          name: groupName.trim(),
          description: groupDesc.trim(),
          entityType: groupType,
          createdAt: now,
          updatedAt: now,
          entityIds: []
        };
        await addDoc(collection(db, 'groups'), payload);
        toast.success(`Group "${groupName}" created successfully!`);
      }

      setIsFormOpen(false);
      setEditingGroup(null);
    } catch (err) {
      console.error("Error saving group:", err);
      toast.error("An error occurred while saving the group.");
    }
  };

  const handleDeleteGroup = async (groupId: string, name: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete the group "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'groups', groupId));
      toast.success(`Group "${name}" deleted`);
      if (selectedGroup?.id === groupId) {
        setSelectedGroup(null);
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
      toast.error("This item is already a member of this group");
      return;
    }

    try {
      const updatedIds = [...group.entityIds, itemId];
      await updateDoc(doc(db, 'groups', groupId), {
        entityIds: updatedIds,
        updatedAt: new Date().toISOString()
      });
      toast.success("Item successfully linked to group!");
      setItemSearchQuery('');
    } catch (err) {
      console.error("Error adding item:", err);
      toast.error("Failed to link item");
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
      toast.success("Item link removed");
    } catch (err) {
      console.error("Error removing item:", err);
      toast.error("Failed to remove link");
    }
  };

  // Helper selectors and labels
  const getEntityTypeLabel = (type: Group['entityType']) => {
    switch (type) {
      case 'packing_lists': return getAdjustedLabel('lists') || 'Packing Lists';
      case 'kits': return 'Equipment Kits';
      case 'projects': return 'Projects';
      case 'inventories': return getAdjustedLabel('inventory') || 'Inventories';
      case 'organizers': return 'Organizer Containers';
      case 'gear': return 'Individual Gear';
      default: return 'Mixed / General';
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

  // Filtering groups list
  const filteredGroups = groups.filter(g => {
    const matchesSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (g.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || g.entityType === typeFilter;
    return matchesSearch && matchesType;
  });

  // Calculate stats
  const totalCount = groups.length;
  const listGroupsCount = groups.filter(g => g.entityType === 'packing_lists').length;
  const kitGroupsCount = groups.filter(g => g.entityType === 'kits' || g.entityType === 'gear').length;
  const projectGroupsCount = groups.filter(g => g.entityType === 'projects').length;

  // Filter available items forselected group's dropdown
  const filteredAvailableItems = availableItems.filter(item => {
    if (!selectedGroup) return false;
    const isMatchingType = selectedGroup.entityType === 'general' || selectedGroup.entityType === item.type;
    const isNotIncluded = !selectedGroup.entityIds.includes(item.id);
    const matchesSearch = item.name?.toLowerCase().includes(itemSearchQuery.toLowerCase());
    return isMatchingType && isNotIncluded && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-neutral-900">
            Groups Module
          </h1>
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mt-1">
            Categorize, tag, and bulk aggregate workspace resources across all modules
          </p>
        </div>
        <button
          onClick={handleOpenCreateForm}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-neutral-900 hover:bg-black text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-md transition-all shrink-0 hover:scale-[1.02] active:scale-95"
        >
          <Plus size={16} /> Create Resource Group
        </button>
      </div>

      {/* Bento Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white border border-neutral-200 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Total Groups</span>
          <span className="text-2xl font-black text-neutral-900 mt-2">{totalCount}</span>
        </div>
        <div className="p-5 bg-white border border-neutral-200 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">{getAdjustedLabel('lists') || 'Packing Lists'} Groups</span>
          <span className="text-2xl font-black text-neutral-900 mt-2">{listGroupsCount}</span>
        </div>
        <div className="p-5 bg-white border border-neutral-200 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Kits / Gear Groups</span>
          <span className="text-2xl font-black text-neutral-900 mt-2">{kitGroupsCount}</span>
        </div>
        <div className="p-5 bg-white border border-neutral-200 rounded-2xl flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Project Groups</span>
          <span className="text-2xl font-black text-neutral-900 mt-2">{projectGroupsCount}</span>
        </div>
      </div>

      {/* Controls & Search */}
      <div className="p-4 bg-white border border-neutral-200 rounded-2xl flex flex-col md:flex-row md:items-center gap-4 justify-between shadow-sm">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search group names or descriptions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:border-black outline-none transition uppercase text-xs font-black"
          />
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5 bg-neutral-50 border border-neutral-200 p-1.5 rounded-xl">
            <Filter size={14} className="text-neutral-400 ml-2" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent text-xs font-black uppercase tracking-tight text-neutral-700 outline-none pr-3 cursor-pointer"
            >
              <option value="all">All Resource Types</option>
              <option value="general">Mixed / General Only</option>
              <option value="packing_lists">{getAdjustedLabel('lists') || 'Packing Lists'}</option>
              <option value="projects">Projects</option>
              <option value="inventories">{getAdjustedLabel('inventory') || 'Inventories'}</option>
              <option value="organizers">Organizer Containers</option>
              <option value="kits">Equipment Kits</option>
              <option value="gear">Individual Gear</option>
            </select>
          </div>

          <div className="flex items-center gap-1 bg-neutral-50 border border-neutral-200 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition ${viewMode === 'grid' ? 'bg-white shadow text-neutral-900' : 'text-neutral-400 hover:text-neutral-600'}`}
              title="Grid View"
            >
              <Grid size={15} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition ${viewMode === 'list' ? 'bg-white shadow text-neutral-900' : 'text-neutral-400 hover:text-neutral-600'}`}
              title="List View"
            >
              <ListIcon size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Group Items Display */}
      {loading ? (
        <div className="py-24 text-center font-black uppercase text-xs text-neutral-400 tracking-widest">
          Loading resource groups...
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="p-12 text-center bg-white border border-neutral-200 rounded-3xl max-w-xl mx-auto space-y-4 shadow-sm">
          <Folder className="mx-auto text-neutral-300 stroke-[1.2]" size={48} />
          <h2 className="text-lg font-black text-neutral-850 uppercase tracking-tight">No Resource Groups Found</h2>
          <p className="text-xs text-neutral-500 leading-relaxed max-w-[340px] mx-auto font-medium">
            Keep your lists, projects, inventories, custom camera kits, and storage cases fully categorized by setting up your first high-volume group folder.
          </p>
          <button
            onClick={handleOpenCreateForm}
            className="px-5 py-2.5 bg-neutral-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-widest transition"
          >
            Create a Group Folder
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid Layout */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGroups.map(group => (
            <motion.div
              key={group.id}
              layout
              onClick={() => setSelectedGroup(group)}
              className="p-5 bg-white border border-neutral-200 hover:border-neutral-400 hover:shadow-md rounded-2xl cursor-pointer transition flex flex-col justify-between h-52 group relative"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {getEntityTypeIcon(group.entityType, 16)}
                    <span className="text-[10px] font-black uppercase tracking-widest bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-md">
                      {getEntityTypeLabel(group.entityType)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleOpenEditForm(group, e)}
                      className="p-1.5 text-neutral-400 hover:text-neutral-950 rounded-lg hover:bg-neutral-50 transition"
                      title="Edit Group"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteGroup(group.id, group.name, e)}
                      className="p-1.5 text-neutral-400 hover:text-red-600 rounded-lg hover:bg-neutral-50 transition"
                      title="Delete Group"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="font-black text-base uppercase text-neutral-850 tracking-tight group-hover:text-primary transition-colors truncate">
                    {group.name}
                  </h3>
                  {group.description ? (
                    <p className="text-xs text-neutral-500 font-medium leading-relaxed line-clamp-2">
                      {group.description}
                    </p>
                  ) : (
                    <p className="text-xs text-neutral-400 font-medium italic">No description provided.</p>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-100/60 flex items-center justify-between">
                <div className="flex items-center gap-1 text-[10px] font-bold text-neutral-400">
                  <Clock size={12} />
                  <span>UPDATED {new Date(group.updatedAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-black uppercase text-neutral-700">
                  <span>{group.entityIds?.length || 0} ITEMS</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        /* List Layout */
        <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm divide-y divide-neutral-100">
          {filteredGroups.map(group => (
            <div
              key={group.id}
              onClick={() => setSelectedGroup(group)}
              className="p-4 hover:bg-neutral-50 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group transition"
            >
              <div className="flex items-start md:items-center gap-3 min-w-0 flex-1">
                <div className="p-3 bg-neutral-100 rounded-xl text-neutral-600 shrink-0">
                  {getEntityTypeIcon(group.entityType, 20)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-sm uppercase text-neutral-850 tracking-tight group-hover:text-primary transition-colors truncate">
                      {group.name}
                    </h3>
                    <span className="text-[8px] font-black uppercase tracking-widest bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded">
                      {getEntityTypeLabel(group.entityType)}
                    </span>
                  </div>
                  {group.description && (
                    <p className="text-xs text-neutral-500 font-medium truncate mt-0.5">{group.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-6 shrink-0 justify-between md:justify-end">
                <div className="text-right hidden sm:block">
                  <span className="text-xs font-black text-neutral-800 uppercase block">{group.entityIds?.length || 0} MEMBERS</span>
                  <span className="text-[9px] font-bold text-neutral-400 uppercase">UPDATED {new Date(group.updatedAt).toLocaleDateString()}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => handleOpenEditForm(group, e)}
                    className="p-2 text-neutral-400 hover:text-neutral-950 hover:bg-neutral-100 rounded-xl transition"
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    onClick={(e) => handleDeleteGroup(group.id, group.name, e)}
                    className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Dialog Modal for Create/Edit */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFormOpen(false)}
              className="fixed inset-0 bg-neutral-950"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-neutral-200 rounded-3xl w-full max-w-md p-6 relative z-10 font-sans text-neutral-800 shadow-2xl"
            >
              <button
                onClick={() => setIsFormOpen(false)}
                className="absolute right-4 top-4 p-2 text-neutral-400 hover:text-neutral-800 rounded-xl hover:bg-neutral-100 transition"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-2.5 mb-6">
                <div className="p-2.5 bg-neutral-900 text-white rounded-xl">
                  <Layers size={18} />
                </div>
                <h2 className="font-black text-sm tracking-widest uppercase text-neutral-850">
                  {editingGroup ? 'Configure Resource Group' : 'New Resource Group'}
                </h2>
              </div>

              <form onSubmit={handleSaveGroupForm} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Group Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Broadcast Setup Delta"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="w-full p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:border-black outline-none transition font-black tracking-tight text-xs uppercase"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Description</label>
                  <textarea
                    placeholder="Provide purpose or scope context for this group folder..."
                    value={groupDesc}
                    onChange={(e) => setGroupDesc(e.target.value)}
                    rows={3}
                    className="w-full p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:border-black outline-none transition font-medium text-xs text-neutral-700"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Group Resource Type Filter</label>
                  <select
                    value={groupType}
                    onChange={(e) => setGroupType(e.target.value as Group['entityType'])}
                    className="w-full p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:border-black outline-none transition font-black tracking-tight text-xs uppercase"
                  >
                    <option value="general">Mixed / General (Any resource)</option>
                    <option value="packing_lists">Packing Lists Only</option>
                    <option value="projects">Projects Only</option>
                    <option value="inventories">Inventories Only</option>
                    <option value="organizers">Organizer Containers Only</option>
                    <option value="kits">Equipment Kits Only</option>
                    <option value="gear">Individual Gear Only</option>
                  </select>
                  <span className="text-[9px] text-neutral-400 italic block mt-1 ml-1 leading-normal">
                    Filtering the type enforces that only resources of this matching category can be linked.
                  </span>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="flex-1 py-3.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-black uppercase tracking-widest rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3.5 bg-neutral-900 hover:bg-black text-white text-xs font-black uppercase tracking-widest rounded-xl transition"
                  >
                    {editingGroup ? 'Update Group' : 'Save Group'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Group Detail Sidebar Modal View */}
      <AnimatePresence>
        {selectedGroup && (
          <div className="fixed inset-0 z-50 flex items-center justify-end p-0">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSelectedGroup(null);
                setItemSearchQuery('');
              }}
              className="fixed inset-0 bg-neutral-950"
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white border-l border-neutral-200 w-full max-w-lg h-full p-6 relative z-10 flex flex-col justify-between font-sans text-neutral-800 shadow-2xl"
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-neutral-100 mb-6">
                  <div className="flex items-center gap-2.5">
                    {getEntityTypeIcon(selectedGroup.entityType, 22)}
                    <div>
                      <span className="text-[8px] font-black uppercase tracking-widest bg-neutral-150 text-neutral-600 px-2 py-0.5 rounded-md block w-fit">
                        {getEntityTypeLabel(selectedGroup.entityType)}
                      </span>
                      <h2 className="font-black text-base uppercase text-neutral-850 tracking-tight mt-1 truncate max-w-[280px]">
                        {selectedGroup.name}
                      </h2>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => {
                      setSelectedGroup(null);
                      setItemSearchQuery('');
                    }}
                    className="p-2 text-neutral-400 hover:text-neutral-800 rounded-xl hover:bg-neutral-100 transition"
                  >
                    <X size={18} />
                  </button>
                </div>

                {selectedGroup.description && (
                  <p className="text-xs text-neutral-500 font-medium leading-relaxed pb-4 border-b border-neutral-100/60 mb-6">
                    {selectedGroup.description}
                  </p>
                )}

                {/* Add Item Trigger */}
                <div className="space-y-3 mb-6">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                    Add Items to This Group ({getEntityTypeLabel(selectedGroup.entityType)})
                  </label>
                  <div className="relative">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Search to bind a workspace resource..."
                      value={itemSearchQuery}
                      onChange={(e) => setItemSearchQuery(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:border-black outline-none text-xs transition uppercase font-black"
                    />
                  </div>

                  {itemSearchQuery.trim().length > 0 && (
                    <div className="bg-white border border-neutral-200 rounded-xl max-h-56 overflow-y-auto divide-y divide-neutral-100 shadow-xl relative z-20">
                      {loadingItems ? (
                        <div className="p-3 text-[10px] text-neutral-400 text-center font-bold">LOADING INSTANCES...</div>
                      ) : filteredAvailableItems.length === 0 ? (
                        <div className="p-3 text-[10px] text-neutral-400 text-center font-bold">NO UNASSIGNED MATCHING ITEMS</div>
                      ) : (
                        filteredAvailableItems.map(item => (
                          <button
                            key={item.id}
                            onClick={() => handleAddItemToGroup(selectedGroup.id, item.id)}
                            className="w-full p-3.5 text-left hover:bg-neutral-50 flex items-center justify-between text-xs transition font-black uppercase tracking-tight"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {getEntityTypeIcon(item.type, 14)}
                              <span className="truncate">{item.name}</span>
                            </div>
                            <PlusCircle size={15} className="text-neutral-400 hover:text-black shrink-0" />
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Members List */}
                <div className="space-y-3 overflow-y-auto max-h-[50vh] pr-1">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                    Linked Resources ({selectedGroup.entityIds.length})
                  </h4>

                  {selectedGroup.entityIds.length === 0 ? (
                    <div className="p-8 bg-dashed border-2 border-neutral-200 rounded-2xl text-center">
                      <Folder size={26} className="mx-auto text-neutral-300 stroke-[1.5] mb-2" />
                      <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">No Linked Resources</span>
                      <p className="text-[9px] text-neutral-500 mt-1">Bind equipment, manifests, or checklists using the lookup above.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {selectedGroup.entityIds.map(itemId => {
                        const matchingItem = availableItems.find(i => i.id === itemId);
                        const resolvedName = matchingItem?.name || `Resource: ${itemId.substring(0, 8)}...`;
                        const resolvedType = matchingItem?.type || selectedGroup.entityType;

                        return (
                          <div 
                            key={itemId}
                            className="p-3 bg-neutral-50 border border-neutral-200 hover:border-neutral-300 rounded-xl flex items-center justify-between gap-3 group transition"
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
                                className="p-1.5 text-neutral-400 hover:text-neutral-800 rounded-lg hover:bg-neutral-200 transition"
                                title="Open Custom View"
                              >
                                <ExternalLink size={14} />
                              </a>
                              <button 
                                onClick={() => handleRemoveItemFromGroup(selectedGroup.id, itemId)}
                                className="p-1.5 text-neutral-400 hover:text-red-500 rounded-lg hover:bg-neutral-200 transition"
                                title="Remove Link"
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

              {/* Action Buttons */}
              <div className="pt-4 border-t border-neutral-100 flex gap-3 mt-6">
                <button
                  onClick={(e) => handleOpenEditForm(selectedGroup, e)}
                  className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-black uppercase tracking-widest rounded-xl transition"
                >
                  Edit Metadata
                </button>
                <button
                  onClick={() => {
                    setSelectedGroup(null);
                    setItemSearchQuery('');
                  }}
                  className="flex-1 py-3 bg-neutral-900 hover:bg-black text-white text-xs font-black uppercase tracking-widest rounded-xl transition"
                >
                  Close Panel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
