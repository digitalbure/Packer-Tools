import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, addDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Project, PackingList, UserProfile, Rack } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Briefcase, ChevronLeft, Plus, Trash2, Package, Calendar, Settings2, Info, Loader2, Search, CheckCircle2, X, MapPin, Flag, AlertCircle, Truck, Building, Target, Server, History, RotateCcw, Zap, Hammer, LayoutDashboard, DollarSign, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import BuildModule from '../components/BuildModule';
import CostWidget from '../components/CostWidget';
import SupplierWidget from '../components/SupplierWidget';
import BOMWidget from '../components/BOMWidget';
import CompatibilityWidget from '../components/CompatibilityWidget';
export default function ProjectDetail({ user }: { user: UserProfile }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [packingLists, setPackingLists] = useState<PackingList[]>([]);
  const [allUserLists, setAllUserLists] = useState<PackingList[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [allUserRacks, setAllUserRacks] = useState<Rack[]>([]);
  const [loading, setLoading] = useState(true);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [projectPhysItems, setProjectPhysItems] = useState<any[]>([]);
  const [gearLibrary, setGearLibrary] = useState<any[]>([]);
  const [isAddingList, setIsAddingList] = useState(false);
  const [isAddingRack, setIsAddingRack] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [rackSearchQuery, setRackSearchQuery] = useState('');
  const [isCreatingNewList, setIsCreatingNewList] = useState(false);
  const [isCreatingNewRack, setIsCreatingNewRack] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newRackName, setNewRackName] = useState('');
  const [newRackUnits, setNewRackUnits] = useState(12);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as any) || 'overview';
  const setActiveTab = (tab: string) => {
    setSearchParams({ tab });
  };

  useEffect(() => {
    if (!id) return;

    const unsubscribe = onSnapshot(doc(db, 'projects', id), (docSnap) => {
      if (docSnap.exists()) {
        setProject({ id: docSnap.id, ...docSnap.data() } as Project);
      } else {
        navigate('/projects');
      }
      setLoading(false);
    }, (error) => {
      console.warn("ProjectDetail: Error listening to project doc:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id, navigate]);

  useEffect(() => {
    if (!project || !project.listIds || project.listIds.length === 0) {
      setPackingLists([]);
      return;
    }

    const q = query(
      collection(db, 'packingLists'),
      where('__name__', 'in', project.listIds)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lists = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PackingList[];
      setPackingLists(lists);
    }, (error) => {
      console.warn("ProjectDetail: Error listening to packing lists:", error);
    });

    return () => unsubscribe();
  }, [project?.listIds]);

  useEffect(() => {
    if (!project || !project.rackIds || project.rackIds.length === 0) {
      setRacks([]);
      return;
    }

    const q = query(
      collection(db, 'racks'),
      where('__name__', 'in', project.rackIds)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRacks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Rack[];
      setRacks(fetchedRacks);
    }, (error) => {
      console.warn("ProjectDetail: Error listening to racks:", error);
    });

    return () => unsubscribe();
  }, [project?.rackIds]);

  useEffect(() => {
    if (!isAddingList) return;

    const fetchAllLists = async () => {
      const q = query(
        collection(db, 'packingLists'),
        where('ownerId', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      const lists = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PackingList[];
      setAllUserLists(lists.filter(l => !(project?.listIds || []).includes(l.id)));
    };

    fetchAllLists();
  }, [isAddingList, user.uid, project?.listIds]);

  useEffect(() => {
    if (!id) return;
    const qSnapshots = query(collection(db, 'projects', id, 'snapshots'));
    const unsubscribeSnaps = onSnapshot(qSnapshots, (snap) => {
      setSnapshots(snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as any)).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    }, (error) => {
      console.warn("ProjectDetail: Error listening to snaps:", error);
    });
    return unsubscribeSnaps;
  }, [id]);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'users', user.uid, 'gearLibrary'));
    const unsub = onSnapshot(q, (snap) => {
      setGearLibrary(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.warn("ProjectDetail: Error listening to gear library:", error);
    });
    return unsub;
  }, [user?.uid]);

  useEffect(() => {
    if (!project) return;
    const listIds = project.listIds || [];
    const rackIds = project.rackIds || [];
    if (listIds.length === 0 && rackIds.length === 0) {
      setProjectPhysItems([]);
      return;
    }

    const unsubscribes: (() => void)[] = [];
    const allItemsMap: { [key: string]: any[] } = {};

    const updateAllItems = () => {
      const flatItems = Object.values(allItemsMap).flat();
      setProjectPhysItems(flatItems);
    };

    listIds.forEach((listId) => {
      const q = collection(db, 'packingLists', listId, 'items');
      const unsub = onSnapshot(q, (snap) => {
        allItemsMap[`list_${listId}`] = snap.docs.map(doc => ({
          id: doc.id,
          sourceType: 'list',
          sourceId: listId,
          ...doc.data()
        }));
        updateAllItems();
      }, (error) => {
        console.warn("ProjectDetail: Error listening to packing list items:", listId, error);
      });
      unsubscribes.push(unsub);
    });

    rackIds.forEach((rackId) => {
      const q = collection(db, 'racks', rackId, 'items');
      const unsub = onSnapshot(q, (snap) => {
        allItemsMap[`rack_${rackId}`] = snap.docs.map(doc => ({
          id: doc.id,
          sourceType: 'rack',
          sourceId: rackId,
          ...doc.data()
        }));
        updateAllItems();
      }, (error) => {
        console.warn("ProjectDetail: Error listening to rack items:", rackId, error);
      });
      unsubscribes.push(unsub);
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [project?.listIds, project?.rackIds]);

  useEffect(() => {
    if (!isAddingRack) return;

    const fetchAllRacks = async () => {
      const q = query(
        collection(db, 'racks'),
        where('ownerId', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      const fetchedRacks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Rack[];
      setAllUserRacks(fetchedRacks.filter(r => !(project?.rackIds || []).includes(r.id)));
    };

    fetchAllRacks();
  }, [isAddingRack, user.uid, project?.rackIds]);

  const handleAddExistingList = async (listId: string) => {
    if (!id) return;
    try {
      // Bidirectional update
      const projectRef = doc(db, 'projects', id);
      const listRef = doc(db, 'packingLists', listId);
      
      await updateDoc(projectRef, {
        listIds: arrayUnion(listId),
        updatedAt: new Date().toISOString()
      });
      
      await updateDoc(listRef, {
        projectId: id,
        updatedAt: new Date().toISOString()
      });
      
      toast.success("List added to project");
    } catch (error) {
      console.error('Error adding list:', error);
      toast.error("Failed to link list to project");
    }
  };

  const handleRemoveList = async (listId: string) => {
    if (!id) return;
    if (confirm('Detach this list from the project?')) {
      try {
        const projectRef = doc(db, 'projects', id);
        const listRef = doc(db, 'packingLists', listId);
        
        await updateDoc(projectRef, {
          listIds: arrayRemove(listId),
          updatedAt: new Date().toISOString()
        });
        
        await updateDoc(listRef, {
          projectId: "", // Clear association
          updatedAt: new Date().toISOString()
        });
        
        toast.success("List detached from project");
      } catch (error) {
        console.error('Error removing list:', error);
        toast.error("Failed to detach list");
      }
    }
  };

  const handleAddExistingRack = async (rackId: string) => {
    if (!id) return;
    try {
      const projectRef = doc(db, 'projects', id);
      const rackRef = doc(db, 'racks', rackId);
      
      await updateDoc(projectRef, {
        rackIds: arrayUnion(rackId),
        updatedAt: new Date().toISOString()
      });
      
      await updateDoc(rackRef, {
        projectId: id,
        updatedAt: new Date().toISOString()
      });
      
      toast.success("Rack added to project");
    } catch (error) {
      console.error('Error adding rack:', error);
      toast.error("Failed to link rack to project");
    }
  };

  const handleRemoveRack = async (rackId: string) => {
    if (!id) return;
    if (confirm('Detach this rack from the project?')) {
      try {
        const projectRef = doc(db, 'projects', id);
        const rackRef = doc(db, 'racks', rackId);
        
        await updateDoc(projectRef, {
          rackIds: arrayRemove(rackId),
          updatedAt: new Date().toISOString()
        });
        
        await updateDoc(rackRef, {
          projectId: "",
          updatedAt: new Date().toISOString()
        });
        
        toast.success("Rack detached from project");
      } catch (error) {
        console.error('Error removing rack:', error);
        toast.error("Failed to detach rack");
      }
    }
  };

  const handleCreateNewList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName || !id) return;

    try {
      const newListRef = await addDoc(collection(db, 'packingLists'), {
        ownerId: user.uid,
        name: newListName,
        items: [],
        projectId: id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'draft'
      });

      await updateDoc(doc(db, 'projects', id), {
        listIds: arrayUnion(newListRef.id),
        updatedAt: new Date().toISOString()
      });

      setNewListName('');
      setIsCreatingNewList(false);
      setIsAddingList(false);
      toast.success("New list created and linked to project");
    } catch (error) {
      console.error('Error creating new list:', error);
    }
  };

  const handleCreateNewRack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRackName || !id) return;

    try {
      const newRackRef = await addDoc(collection(db, 'racks'), {
        ownerId: user.uid,
        name: newRackName,
        totalUnits: Number(newRackUnits),
        projectId: id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      await updateDoc(doc(db, 'projects', id), {
        rackIds: arrayUnion(newRackRef.id),
        updatedAt: new Date().toISOString()
      });

      setNewRackName('');
      setNewRackUnits(12);
      setIsCreatingNewRack(false);
      setIsAddingRack(false);
      toast.success("New rack created and linked to project");
    } catch (error) {
      console.error('Error creating new rack:', error);
    }
  };

  const updateStatus = async (status: Project['status']) => {
    if (!id) return;
    try {
      await updateDoc(doc(db, 'projects', id), {
        status,
        updatedAt: new Date().toISOString()
      });
      toast.success(`Project status updated to ${status}`);
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const updateStage = async (stage: Project['stage']) => {
    if (!id) return;
    try {
      await updateDoc(doc(db, 'projects', id), {
        stage,
        updatedAt: new Date().toISOString(),
      });
      toast.success(`Project stage updated to ${stage}`);
    } catch (error) {
      console.error('Error updating stage:', error);
    }
  };

  const iterateVersion = async () => {
    if (!id || !project) return;
    try {
      const nextVersion = (project.version || 1) + 1;
      await updateDoc(doc(db, 'projects', id), {
        version: nextVersion,
        updatedAt: new Date().toISOString()
      });
      toast.success(`Project iteration v${nextVersion} created`);
    } catch (error) {
      console.error('Error iterating version:', error);
    }
  };

  const updatePriority = async (priority: Project['priority']) => {
    if (!id) return;
    try {
      await updateDoc(doc(db, 'projects', id), {
        priority,
        updatedAt: new Date().toISOString()
      });
      toast.success(`Priority updated to ${priority}`);
    } catch (error) {
      console.error('Error updating priority:', error);
    }
  };

  const toggleBuildMode = async () => {
    if (!id || !project) return;
    try {
      let itemsToSave: any[] = [];
      if (project.isBuildMode) {
        // Build mode is being turned off. Find the sandboxed buildItems and auto create snapshot!
        const buildItemsSnap = await getDocs(
          query(
            collection(db, 'buildItems'),
            where('projectId', '==', id),
            where('ownerId', '==', user.uid)
          )
        );
        itemsToSave = buildItemsSnap.docs.map(d => ({
          name: d.data().name || '',
          brand: d.data().brand || '',
          model: d.data().model || '',
          category: d.data().category || '',
          price: d.data().price || 0,
          quantity: d.data().quantity || 1,
          type: d.data().type || 'component'
        }));

        if (itemsToSave.length > 0) {
          await addDoc(collection(db, 'projects', id, 'snapshots'), {
            projectId: id,
            timestamp: new Date().toISOString(),
            projectName: project.name,
            projectVersion: project.version || 1,
            items: itemsToSave,
            totalCost: itemsToSave.reduce((acc, item) => acc + (Number(item.price || 0) * (Number(item.quantity) || 1)), 0)
          });
          toast.success("Automatic revert snapshot v" + (project.version || 1) + " catalogued");
        }
      }

      await updateDoc(doc(db, 'projects', id), {
        isBuildMode: !project.isBuildMode,
        updatedAt: new Date().toISOString()
      });
      toast.success(project.isBuildMode ? "Build Mode Disabled" : "Build Mode Activated");
    } catch (error) {
      toast.error("Failed to toggle Build Mode");
    }
  };

  const handleRevertSnapshot = async (snapshot: any) => {
    if (!id || !project || !window.confirm(`Are you sure you want to revert your sandbox build state to the snapshot from ${new Date(snapshot.timestamp).toLocaleString()}? This will replace your current build items.`)) return;
    
    try {
      // 1. Fetch current buildItems
      const buildItemsSnap = await getDocs(
        query(
          collection(db, 'buildItems'),
          where('projectId', '==', id),
          where('ownerId', '==', user.uid)
        )
      );

      // 2. Delete all existing buildItems
      const batch = writeBatch(db);
      buildItemsSnap.docs.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });

      // 3. Put snapshot items back in
      snapshot.items.forEach((item: any) => {
        const itemRef = doc(collection(db, 'buildItems'));
        batch.set(itemRef, {
          ...item,
          projectId: id,
          ownerId: user.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      });

      // 4. Update project to enable Build Mode and match the snapshot version if desired
      batch.update(doc(db, 'projects', id), {
        isBuildMode: true,
        version: snapshot.projectVersion,
        updatedAt: new Date().toISOString()
      });

      await batch.commit();
      toast.success("Sandbox state restored successfully!");
    } catch (e) {
      toast.error("Failed to restore sandbox state");
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 size={48} className="text-primary animate-spin" />
        <p className="text-primary/40 font-bold uppercase tracking-widest text-xs">Syncing Project Details...</p>
      </div>
    );
  }

  if (!project) return null;

  const filteredLists = allUserLists.filter(l => 
    l.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredRacks = allUserRacks.filter(r =>
    r.name.toLowerCase().includes(rackSearchQuery.toLowerCase())
  );

  const projectItemsMapped = projectPhysItems.map(item => {
    const gear = item.gearId ? gearLibrary.find((g: any) => g.id === item.gearId) : null;
    return {
      id: item.id,
      name: gear?.name || item.name || 'Unknown Item',
      category: gear?.category || item.category || 'Other',
      type: gear?.type || item.type || 'component',
      brand: gear?.brand || item.brand || '',
      model: gear?.model || item.model || '',
      price: gear?.price || item.price || 0,
      quantity: item.quantity || 1,
      isPushed: true
    };
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-50';
      case 'on_hold': return 'text-amber-600 bg-amber-50';
      case 'completed': return 'text-blue-600 bg-blue-50';
      default: return 'text-neutral-500 bg-neutral-50';
    }
  };

  return (
    <div className="container mx-auto px-6 py-12">
      <Link 
        to="/projects" 
        className="inline-flex items-center gap-2 text-primary/40 hover:text-primary transition font-black uppercase text-[10px] tracking-widest mb-8"
      >
        <ChevronLeft size={16} />
        <span>Back to Projects</span>
      </Link>
      {/* Dynamic Wide Top Bar */}
      <div className="bg-white rounded-[2rem] p-8 sm:p-10 border border-neutral-100 shadow-xl mb-12 relative overflow-hidden flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="space-y-3 max-w-2xl min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusColor(project.status)}`}>
              {project.status.replace('_', ' ')}
            </span>
            <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest leading-none">
              Version v{project.version || 1}
            </span>
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest leading-none border ${project.stage === 'actual' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-neutral-50 text-neutral-500 border-neutral-100'}`}>
              {project.stage || 'proposed'} stage
            </span>
            {project.isBuildMode && (
              <span className="px-3 py-1 bg-amber-500 text-white rounded-full text-[8px] font-black uppercase tracking-widest flex items-center gap-1 animate-pulse">
                <Hammer size={10} />
                <span>Sandbox Active</span>
              </span>
            )}
          </div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-primary leading-none truncate pr-2">
            {project.name}
          </h1>
          <p className="text-neutral-500 font-medium text-sm italic leading-relaxed pr-2">
            {project.description || 'Project details and management hub.'}
          </p>
        </div>

        {/* Top bar controls */}
        <div className="flex flex-wrap items-center gap-6 bg-neutral-50 p-6 rounded-2xl border border-neutral-100/50 shrink-0 self-start xl:self-auto">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block ml-1">Lifecycle Stage</label>
            <div className="flex bg-neutral-100 p-1 rounded-xl">
              <button 
                onClick={() => updateStage('proposed')}
                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                  (project.stage || 'proposed') === 'proposed' ? 'bg-white text-primary shadow-sm' : 'text-neutral-400 hover:text-neutral-600'
                }`}
              >
                Proposed
              </button>
              <button 
                onClick={() => updateStage('actual')}
                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${
                  project.stage === 'actual' ? 'bg-primary text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-600'
                }`}
              >
                Actual
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block ml-1">Priority Elevation</span>
            <select
              value={project.priority}
              onChange={(e) => updatePriority(e.target.value as Project['priority'])}
              className="bg-neutral-100 border-none rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-primary focus:ring-2 focus:ring-primary transition"
            >
              <option value="low">Standard</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block ml-1">Project Status</span>
            <select
              value={project.status}
              onChange={(e) => updateStatus(e.target.value as Project['status'])}
              className="bg-neutral-100 border-none rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest text-primary focus:ring-2 focus:ring-primary transition"
            >
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="space-y-1 self-end">
            <button 
              onClick={iterateVersion}
              className="flex items-center gap-1.5 px-4 py-2 bg-neutral-200 hover:bg-neutral-300 rounded-xl transition text-neutral-800 font-bold text-[10px] uppercase tracking-widest h-[34px]"
              title="Increment Version"
            >
              <RotateCcw size={12} />
              <span>v{project.version || 1}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Project Content Tabs/Sections (Full Width) */}
      <div className="w-full overflow-hidden">
        <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div 
                key="overview"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-12"
              >
                {/* Inventory Lists Section */}
                <section className="space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h2 className="text-3xl font-black uppercase tracking-tighter text-primary">Project Lists</h2>
                      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Attached Gear Lists & Inventories</p>
                    </div>
                    <button
                      onClick={() => setIsAddingList(true)}
                      className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl hover:bg-neutral-900 transition shadow-xl font-black uppercase text-[10px] tracking-widest"
                    >
                      <Plus size={16} />
                      <span>Link List</span>
                    </button>
                  </div>

                  {packingLists.length === 0 ? (
                    <div className="bg-white rounded-2xl sm:rounded-[3rem] p-6 sm:p-12 text-center border border-dashed border-neutral-200">
                      <div className="w-16 h-16 bg-neutral-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-neutral-300">
                        <Package size={32} />
                      </div>
                      <p className="text-neutral-400 font-black uppercase tracking-widest text-[10px] mb-6">No lists currently attached</p>
                      <button
                        onClick={() => setIsAddingList(true)}
                        className="text-primary font-black uppercase text-[10px] tracking-widest hover:underline"
                      >
                        Attach a List
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {packingLists.map((list) => (
                        <div
                          key={list.id}
                          className="bg-white rounded-[2rem] p-8 border border-neutral-100 shadow-sm hover:shadow-xl transition-all group relative"
                        >
                          <button
                            onClick={() => handleRemoveList(list.id)}
                            className="absolute top-6 right-6 p-2 text-neutral-200 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={18} />
                          </button>
                          <div className="w-12 h-12 bg-neutral-50 rounded-2xl flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform">
                            <Package size={24} />
                          </div>
                          <h4 className="text-xl font-black uppercase tracking-tighter mb-2 leading-none">{list.name}</h4>
                          <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-6">
                            {(list.items?.length || 0)} Items • {list.status || 'Active'}
                          </p>
                          <Link
                            to={`/list/${list.id}`}
                            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:gap-3 transition-all"
                          >
                            <span>Open List</span>
                            <ChevronLeft size={14} className="rotate-180" />
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Racks Section */}
                <section className="space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h2 className="text-3xl font-black uppercase tracking-tighter text-primary">Project Racks</h2>
                      <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Deployed & Staged Hardware Racks</p>
                    </div>
                    <button
                      onClick={() => setIsAddingRack(true)}
                      className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl hover:bg-neutral-900 transition shadow-xl font-black uppercase text-[10px] tracking-widest"
                    >
                      <Plus size={16} />
                      <span>Link Rack</span>
                    </button>
                  </div>

                  {racks.length === 0 ? (
                    <div className="bg-white rounded-2xl sm:rounded-[3rem] p-6 sm:p-12 text-center border border-dashed border-neutral-200">
                      <div className="w-16 h-16 bg-neutral-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-neutral-300">
                        <Server size={32} />
                      </div>
                      <p className="text-neutral-400 font-black uppercase tracking-widest text-[10px] mb-6">No racks currently attached</p>
                      <button
                        onClick={() => setIsAddingRack(true)}
                        className="text-primary font-black uppercase text-[10px] tracking-widest hover:underline"
                      >
                        Attach a Rack
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {racks.map((rack) => (
                        <div
                          key={rack.id}
                          className="bg-white rounded-[2rem] p-8 border border-neutral-100 shadow-sm hover:shadow-xl transition-all group relative"
                        >
                          <button
                            onClick={() => handleRemoveRack(rack.id)}
                            className="absolute top-6 right-6 p-2 text-neutral-200 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={18} />
                          </button>
                          <div className="w-12 h-12 bg-neutral-50 rounded-2xl flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform">
                            <Server size={24} />
                          </div>
                          <h4 className="text-xl font-black uppercase tracking-tighter mb-2 leading-none">{rack.name}</h4>
                          <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-6">
                            {rack.totalUnits}U Configuration
                          </p>
                          <Link
                            to={`/rack/${rack.id}`}
                            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:gap-3 transition-all"
                          >
                            <span>Manage Rack</span>
                            <ChevronLeft size={14} className="rotate-180" />
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </motion.div>
            )}

            {activeTab === 'sandbox' && (
              <motion.div 
                key="sandbox"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <div className="bg-white rounded-[2.5rem] p-10 text-center border border-neutral-100 shadow-xl space-y-6 max-w-xl mx-auto">
                  <div className="w-16 h-16 bg-neutral-900 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                    <Hammer size={32} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black uppercase tracking-tight">Sandbox Upgraded & Relocated</h3>
                    <p className="text-neutral-500 text-xs font-semibold leading-relaxed">
                      The virtual Build Sandbox has been moved to its own dedicated powerhouse module: <span className="font-extrabold text-black">Systems Builder</span>.
                    </p>
                    <p className="text-neutral-400 text-[10px] leading-relaxed uppercase tracking-wider">
                      This allows you to construct and design virtual system hierarchies with either reference blueprints, custom components, or your active inventory gear independently of the project's physical scope!
                    </p>
                  </div>
                  <Link
                    to="/systems-builder"
                    className="inline-flex items-center gap-2 bg-neutral-905 hover:bg-neutral-800 text-white bg-neutral-900 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md transition"
                  >
                    <span>Open Systems Builder</span>
                  </Link>
                </div>
              </motion.div>
            )}

            {activeTab === 'compatibility' && (
              <motion.div 
                key="compatibility"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <CompatibilityWidget project={project} user={user} items={projectItemsMapped} />
              </motion.div>
            )}

            {activeTab === 'costs' && (
              <motion.div 
                key="costs"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <CostWidget project={project} user={user} items={projectItemsMapped} />
              </motion.div>
            )}

            {activeTab === 'suppliers' && (
              <motion.div 
                key="suppliers"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <SupplierWidget project={project} user={user} />
              </motion.div>
            )}

            {activeTab === 'bom' && (
              <motion.div 
                key="bom"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <BOMWidget project={project} user={user} items={projectItemsMapped} />
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      {/* Add List Modal */}
      <AnimatePresence>
        {isAddingList && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingList(false)}
              className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl sm:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-5 sm:p-10 border-b border-neutral-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="space-y-1 min-w-0 pr-4">
                  <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tighter truncate">Attach Inventory</h2>
                  <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-neutral-400 truncate">
                    Link existing list or create a new one for this project
                  </p>
                </div>
                <button onClick={() => setIsAddingList(false)} className="p-2 sm:p-3 hover:bg-neutral-50 rounded-full transition shrink-0">
                  <X size={20} className="sm:hidden" />
                  <X size={28} className="hidden sm:block" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 sm:p-10 space-y-6 sm:space-y-10 scrollbar-hide">
                {/* Create New Option */}
                <div className="bg-neutral-50 rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-10 border border-neutral-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="space-y-1">
                      <h3 className="font-black uppercase tracking-tighter text-sm">Create New List</h3>
                      <p className="text-[8px] font-black uppercase tracking-widest text-neutral-400 italic">Start a fresh list in this project</p>
                    </div>
                    <button
                      onClick={() => setIsCreatingNewList(!isCreatingNewList)}
                      className="w-full sm:w-auto px-4 py-2 bg-neutral-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-105 transition flex items-center justify-center"
                    >
                      {isCreatingNewList ? 'Cancel' : 'New List'}
                    </button>
                  </div>
                  
                  {isCreatingNewList && (
                    <form onSubmit={handleCreateNewList} className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="text"
                        autoFocus
                        required
                        value={newListName}
                        onChange={(e) => setNewListName(e.target.value)}
                        placeholder="e.g. LIGHTING KIT"
                        className="flex-1 bg-white border border-neutral-200 rounded-2xl px-4 py-3 sm:px-6 sm:py-4 text-xs font-bold uppercase tracking-widest focus:ring-2 focus:ring-primary transition"
                      />
                      <button
                        type="submit"
                        className="bg-primary text-white px-6 py-3 sm:px-8 sm:py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg hover:bg-neutral-900 transition"
                      >
                        Create & Link
                      </button>
                    </form>
                  )}
                </div>

                {/* Search & List */}
                <div className="space-y-6">
                  <div className="relative text-neutral-900">
                    <Search className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 text-neutral-300" size={18} />
                    <input
                      type="text"
                      placeholder="SEARCH YOUR LISTS..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-neutral-50 border-none rounded-xl sm:rounded-2xl pl-12 pr-4 py-3 sm:pl-16 sm:pr-6 sm:py-5 text-xs font-bold uppercase tracking-widest focus:ring-2 focus:ring-primary transition"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {filteredLists.length === 0 ? (
                      <div className="text-center py-16">
                        <div className="w-16 h-16 bg-neutral-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-neutral-200">
                          <Package size={24} />
                        </div>
                        <p className="text-neutral-400 font-black uppercase tracking-[0.2em] text-[10px]">
                          No available lists detected
                        </p>
                      </div>
                    ) : (
                      filteredLists.map((list) => (
                        <button
                          key={list.id}
                          onClick={() => handleAddExistingList(list.id)}
                          className="flex items-center justify-between p-6 bg-white border border-neutral-100 rounded-3xl hover:border-primary/20 hover:bg-neutral-50 transition-all text-left group"
                        >
                          <div className="flex items-center gap-6">
                            <div className="w-14 h-14 bg-neutral-50 rounded-2xl flex items-center justify-center text-neutral-300 group-hover:text-primary transition group-hover:scale-105">
                              <Package size={28} />
                            </div>
                            <div>
                              <div className="font-black uppercase tracking-tighter text-lg leading-none mb-2 text-neutral-900">{list.name}</div>
                              <div className="text-[9px] font-black text-neutral-400 uppercase tracking-widest italic">
                                {(list.items?.length || 0)} Items
                              </div>
                            </div>
                          </div>
                          <div className="w-10 h-10 rounded-2xl border border-neutral-100 flex items-center justify-center text-neutral-300 group-hover:text-primary group-hover:border-primary group-hover:bg-white transition-all shadow-sm">
                            <Plus size={20} />
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Rack Modal */}
      <AnimatePresence>
        {isAddingRack && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingRack(false)}
              className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl sm:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-5 sm:p-10 border-b border-neutral-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="space-y-1 min-w-0 pr-4">
                  <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tighter truncate">Deploy Rack</h2>
                  <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-neutral-400 truncate">
                    Link existing rack or create a new one for this project
                  </p>
                </div>
                <button onClick={() => setIsAddingRack(false)} className="p-2 sm:p-3 hover:bg-neutral-50 rounded-full transition shrink-0">
                  <X size={20} className="sm:hidden" />
                  <X size={28} className="hidden sm:block" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 sm:p-10 space-y-6 sm:space-y-10 scrollbar-hide">
                {/* Create New Option */}
                <div className="bg-neutral-50 rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-10 border border-neutral-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="space-y-1">
                      <h3 className="font-black uppercase tracking-tighter text-sm">Deploy New Rack</h3>
                      <p className="text-[8px] font-black uppercase tracking-widest text-neutral-400 italic">Initialize a fresh rack container</p>
                    </div>
                    <button
                      onClick={() => setIsCreatingNewRack(!isCreatingNewRack)}
                      className="w-full sm:w-auto px-4 py-2 bg-neutral-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-105 transition"
                    >
                      {isCreatingNewRack ? 'Cancel' : 'Initialize'}
                    </button>
                  </div>
                  
                  {isCreatingNewRack && (
                    <form onSubmit={handleCreateNewRack} className="space-y-4">
                      <div className="flex gap-3">
                        <input
                          type="text"
                          required
                          value={newRackName}
                          onChange={(e) => setNewRackName(e.target.value)}
                          placeholder="RACK NAME (e.g. AMP RACK A)"
                          className="flex-1 bg-white border-neutral-200 rounded-2xl px-6 py-4 text-xs font-bold uppercase tracking-widest focus:ring-2 focus:ring-primary transition"
                        />
                        <input
                          type="number"
                          required
                          min="1"
                          max="48"
                          value={newRackUnits}
                          onChange={(e) => setNewRackUnits(Number(e.target.value))}
                          placeholder="UNITS (e.g. 12)"
                          className="w-24 bg-white border-neutral-200 rounded-2xl px-4 py-4 text-xs font-bold uppercase tracking-widest focus:ring-2 focus:ring-primary transition"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full bg-primary text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg hover:bg-neutral-900 transition"
                      >
                        Create & Deploy Rack
                      </button>
                    </form>
                  )}
                </div>

                {/* Search & List */}
                <div className="space-y-6">
                  <div className="relative text-neutral-900">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-neutral-300" size={20} />
                    <input
                      type="text"
                      placeholder="SEARCH AVAILABLE RACKS..."
                      value={rackSearchQuery}
                      onChange={(e) => setRackSearchQuery(e.target.value)}
                      className="w-full bg-neutral-50 border-none rounded-2xl pl-16 pr-6 py-5 text-xs font-bold uppercase tracking-widest focus:ring-2 focus:ring-primary transition"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {filteredRacks.length === 0 ? (
                      <div className="text-center py-16">
                        <div className="w-16 h-16 bg-neutral-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-neutral-200">
                          <Server size={24} />
                        </div>
                        <p className="text-neutral-400 font-black uppercase tracking-[0.2em] text-[10px]">
                          No available racks detected
                        </p>
                      </div>
                    ) : (
                      filteredRacks.map((rack) => (
                        <button
                          key={rack.id}
                          onClick={() => handleAddExistingRack(rack.id)}
                          className="flex items-center justify-between p-6 bg-white border border-neutral-100 rounded-3xl hover:border-primary/20 hover:bg-neutral-50 transition-all text-left group"
                        >
                          <div className="flex items-center gap-6">
                            <div className="w-14 h-14 bg-neutral-50 rounded-2xl flex items-center justify-center text-neutral-300 group-hover:text-primary transition group-hover:scale-105">
                              <Server size={28} />
                            </div>
                            <div>
                              <div className="font-black uppercase tracking-tighter text-lg leading-none mb-2 text-neutral-900">{rack.name}</div>
                              <div className="text-[9px] font-black text-neutral-400 uppercase tracking-widest italic">
                                {rack.totalUnits}U Configuration
                              </div>
                            </div>
                          </div>
                          <div className="w-10 h-10 rounded-2xl border border-neutral-100 flex items-center justify-center text-neutral-300 group-hover:text-primary group-hover:border-primary group-hover:bg-white transition-all shadow-sm">
                            <Plus size={20} />
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
