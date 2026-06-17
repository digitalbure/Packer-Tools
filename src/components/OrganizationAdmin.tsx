import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  GitBranch, 
  Layers, 
  Search, 
  ChevronDown, 
  Plus, 
  Trash2, 
  Edit2, 
  Shield, 
  X, 
  HelpCircle, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  CheckCircle2, 
  ShoppingBag,
  RefreshCw
} from 'lucide-react';
import { 
  collection, 
  query, 
  doc, 
  updateDoc, 
  getDocs, 
  limit, 
  addDoc, 
  deleteDoc, 
  where, 
  serverTimestamp, 
  writeBatch, 
  startAfter, 
  orderBy, 
  getCountFromServer 
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { db } from '../firebase';
import { Organization, Department, Team, UserProfile } from '../types';

export default function OrganizationAdmin({ 
  users 
}: { 
  users: UserProfile[]
}) {
  const [activeLayout, setActiveLayout] = useState<'tree' | 'cascade'>('tree');
  const [searchTerm, setSearchTerm] = useState('');
  
  // High-Scale On-Demand state engine
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadedDepts, setLoadedDepts] = useState<Record<string, Department[]>>({});
  const [loadedTeams, setLoadedTeams] = useState<Record<string, Team[]>>({});
  
  // Server-Calculated Totals
  const [totalOrgsCount, setTotalOrgsCount] = useState<number | null>(null);
  const [totalDeptsCount, setTotalDeptsCount] = useState<number | null>(null);
  const [totalTeamsCount, setTotalTeamsCount] = useState<number | null>(null);

  // Pagination cursor support for hundreds of thousands of orgs
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [hasMoreOrgs, setHasMoreOrgs] = useState(true);
  const [lastVisibleOrgDoc, setLastVisibleOrgDoc] = useState<any>(null);

  // Loading states for lazy expansions
  const [loadingDeptsMap, setLoadingDeptsMap] = useState<Record<string, boolean>>({});
  const [loadingTeamsMap, setLoadingTeamsMap] = useState<Record<string, boolean>>({});

  // Tree Expand/Collapse triggers
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  // Cascade Column Selections
  const [selectedOrgIdCascade, setSelectedOrgIdCascade] = useState('');
  const [selectedDeptIdCascade, setSelectedDeptIdCascade] = useState('');

  // Modals / Inline Add Creators
  const [isAddingOrg, setIsAddingOrg] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  
  const [isAddingDept, setIsAddingDept] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [newDeptName, setNewDeptName] = useState('');

  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [newTeamName, setNewTeamName] = useState('');

  // 1. Initialize stats and load first page
  useEffect(() => {
    fetchGlobalStats();
    fetchOrganizations(true);
  }, []);

  // 2. Load more handler
  const handleLoadMoreOrgs = () => {
    if (searchTerm || loadingOrgs) return;
    fetchOrganizations(false);
  };

  // 3. Main Organizations Fetcher supporting paging & filtering
  const fetchOrganizations = async (isNewSearch: boolean) => {
    if (loadingOrgs) return;
    setLoadingOrgs(true);
    try {
      let q;
      const orgsCol = collection(db, 'organizations');
      const term = searchTerm.trim();

      if (term !== '') {
        // High-scale prefix search matching the user typed prefix
        // We handle standard query bounds correctly to ensure perfect performance search indexes
        q = query(
          orgsCol,
          where('name', '>=', term),
          where('name', '<=', term + '\uf8ff'),
          limit(30)
        );
      } else {
        if (isNewSearch) {
          q = query(orgsCol, orderBy('name'), limit(15));
        } else {
          if (!lastVisibleOrgDoc) {
            setLoadingOrgs(false);
            return;
          }
          q = query(orgsCol, orderBy('name'), startAfter(lastVisibleOrgDoc), limit(15));
        }
      }

      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Organization));
      
      if (isNewSearch) {
        setOrganizations(list);
        setHasMoreOrgs(snap.docs.length === 15 && term === '');
        
        // Auto-select starting organization cascade details
        if (list.length > 0) {
          const firstId = list[0].id;
          setSelectedOrgIdCascade(firstId);
          await fetchDepartmentsForOrg(firstId);
        }
      } else {
        setOrganizations(prev => {
          const existingIds = new Set(prev.map(o => o.id));
          const filteredList = list.filter(o => !existingIds.has(o.id));
          return [...prev, ...filteredList];
        });
        setHasMoreOrgs(snap.docs.length === 15);
      }

      if (snap.docs.length > 0) {
        setLastVisibleOrgDoc(snap.docs[snap.docs.length - 1]);
      } else {
        setLastVisibleOrgDoc(null);
      }
    } catch (err) {
      console.error("Error fetching organizations range:", err);
      toast.error("Cloud quota exceeded or indexing unavailable. Check Firestore logs.");
    } finally {
      setLoadingOrgs(false);
    }
  };

  // 4. Run stats aggregate counts
  const fetchGlobalStats = async () => {
    try {
      const orgsCountSnap = await getCountFromServer(collection(db, 'organizations'));
      setTotalOrgsCount(orgsCountSnap.data().count);
      
      const deptsCountSnap = await getCountFromServer(collection(db, 'departments'));
      setTotalDeptsCount(deptsCountSnap.data().count);
      
      const teamsCountSnap = await getCountFromServer(collection(db, 'teams'));
      setTotalTeamsCount(teamsCountSnap.data().count);
    } catch (e) {
      console.warn("Aggregate counts not supported or loading:", e);
    }
  };

  // Trigger search prefix match query immediately upon search entry
  useEffect(() => {
    fetchOrganizations(true);
  }, [searchTerm]);

  // 5. Query Departments on-demand when expanded or clicked
  const fetchDepartmentsForOrg = async (orgId: string) => {
    if (loadedDepts[orgId]) return;
    setLoadingDeptsMap(prev => ({ ...prev, [orgId]: true }));
    try {
      const q = query(collection(db, 'departments'), where('orgId', '==', orgId));
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department));
      setLoadedDepts(prev => ({ ...prev, [orgId]: list }));
    } catch (e) {
      console.error("Failed fetching departments:", e);
      toast.error("Failed to load departments.");
    } finally {
      setLoadingDeptsMap(prev => ({ ...prev, [orgId]: false }));
    }
  };

  // 6. Query Teams on-demand when expanded or clicked
  const fetchTeamsForDept = async (deptId: string) => {
    if (loadedTeams[deptId]) return;
    setLoadingTeamsMap(prev => ({ ...prev, [deptId]: true }));
    try {
      const q = query(collection(db, 'teams'), where('deptId', '==', deptId));
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team));
      setLoadedTeams(prev => ({ ...prev, [deptId]: list }));
    } catch (e) {
      console.error("Failed fetching operational teams:", e);
      toast.error("Failed to load operational teams.");
    } finally {
      setLoadingTeamsMap(prev => ({ ...prev, [deptId]: false }));
    }
  };

  // Sync departments cascading views on selection changes
  useEffect(() => {
    if (selectedOrgIdCascade) {
      fetchDepartmentsForOrg(selectedOrgIdCascade);
    }
  }, [selectedOrgIdCascade]);

  // Sync teams cascading views on selection changes
  useEffect(() => {
    if (selectedDeptIdCascade) {
      fetchTeamsForDept(selectedDeptIdCascade);
    }
  }, [selectedDeptIdCascade]);

  // Handle auto-selected cascade matching on org selection swap
  useEffect(() => {
    if (selectedOrgIdCascade) {
      const depts = loadedDepts[selectedOrgIdCascade] || [];
      if (depts.length > 0) {
        const hasDeptMatch = depts.some(d => d.id === selectedDeptIdCascade);
        if (!hasDeptMatch) {
          setSelectedDeptIdCascade(depts[0].id);
        }
      } else {
        setSelectedDeptIdCascade('');
      }
    } else {
      setSelectedDeptIdCascade('');
    }
  }, [selectedOrgIdCascade, loadedDepts]);

  const toggleOrgExpand = async (orgId: string) => {
    if (!expandedOrgs.has(orgId)) {
      await fetchDepartmentsForOrg(orgId);
    }
    setExpandedOrgs(prev => {
      const next = new Set(prev);
      if (next.has(orgId)) {
        next.delete(orgId);
      } else {
        next.add(orgId);
      }
      return next;
    });
  };

  const toggleDeptExpand = async (deptId: string) => {
    if (!expandedDepts.has(deptId)) {
      await fetchTeamsForDept(deptId);
    }
    setExpandedDepts(prev => {
      const next = new Set(prev);
      if (next.has(deptId)) {
        next.delete(deptId);
      } else {
        next.add(deptId);
      }
      return next;
    });
  };

  const expandAllLoaded = () => {
    setExpandedOrgs(new Set(organizations.map(o => o.id)));
    const allDeptIds: string[] = [];
    Object.values(loadedDepts).forEach(arr => {
      arr.forEach(d => allDeptIds.push(d.id));
    });
    setExpandedDepts(new Set(allDeptIds));
    toast.success("Expanded active loaded structural nodes");
  };

  const collapseAll = () => {
    setExpandedOrgs(new Set());
    setExpandedDepts(new Set());
    toast.success("Collapsed all categories");
  };

  const handleCreateOrg = async () => {
    if (!newOrgName) {
      toast.error("Organization name is required");
      return;
    }

    const slug = (newOrgSlug || newOrgName).toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    if (!slug) {
      toast.error("A valid identifier (slug) is required");
      return;
    }

    try {
      const nameCheck = await getDocs(query(collection(db, 'organizations'), where('name', '==', newOrgName)));
      const slugCheck = await getDocs(query(collection(db, 'organizations'), where('slug', '==', slug)));
      
      if (!nameCheck.empty || !slugCheck.empty) {
        toast.error("This organization name or identifier is already taken.");
        return;
      }

      const docRef = await addDoc(collection(db, 'organizations'), {
        name: newOrgName,
        slug: slug,
        ownerId: '',
        settings: {
          branding: { primaryColor: '#2563eb' },
          kioskSettings: { requireSignature: false, allowManualSearch: true, autoLogoutMinutes: 5 }
        },
        subscriptionPlan: 'free',
        status: 'active',
        createdAt: serverTimestamp()
      });

      const newO: Organization = {
        id: docRef.id,
        name: newOrgName,
        slug: slug,
        ownerId: '',
        settings: {
          branding: { primaryColor: '#2563eb' },
          kioskSettings: { requireSignature: false, allowManualSearch: true, autoLogoutMinutes: 5 }
        },
        subscriptionPlan: 'free',
        status: 'active'
      };

      setOrganizations(prev => [newO, ...prev]);
      if (totalOrgsCount !== null) setTotalOrgsCount(totalOrgsCount + 1);

      setNewOrgName('');
      setNewOrgSlug('');
      setIsAddingOrg(false);
      toast.success("Enterprise organization successfully added!");
    } catch (e) {
      toast.error("Failed to register organization.");
    }
  };

  const handleUpdateOrg = async () => {
    if (!editingOrg || !editingOrg.name || !editingOrg.slug) return;
    try {
      await updateDoc(doc(db, 'organizations', editingOrg.id), {
        name: editingOrg.name,
        slug: editingOrg.slug.toLowerCase().replace(/\s+/g, '-'),
        updatedAt: serverTimestamp()
      });

      setOrganizations(prev => prev.map(o => o.id === editingOrg.id ? { ...o, name: editingOrg.name, slug: editingOrg.slug } : o));
      setEditingOrg(null);
      toast.success("Organization details updated successfully!");
    } catch (e) {
      toast.error("Failed to apply organization changes.");
    }
  };

  const handleCreateDept = async () => {
    const parentId = selectedOrgId || selectedOrgIdCascade;
    if (!newDeptName || !parentId) {
      toast.error("Please provide department name and parent organization");
      return;
    }
    try {
      const docRef = await addDoc(collection(db, 'departments'), {
        name: newDeptName,
        orgId: parentId,
        createdAt: serverTimestamp()
      });

      const newD: Department = {
        id: docRef.id,
        name: newDeptName,
        orgId: parentId
      };

      setLoadedDepts(prev => ({
        ...prev,
        [parentId]: [...(prev[parentId] || []), newD]
      }));

      setExpandedOrgs(prev => {
        const next = new Set(prev);
        next.add(parentId);
        return next;
      });

      if (totalDeptsCount !== null) setTotalDeptsCount(totalDeptsCount + 1);

      setNewDeptName('');
      setIsAddingDept(false);
      toast.success("Structural department created successfully!");
    } catch (e) {
      toast.error("Failed to build department.");
    }
  };

  const handleCreateTeam = async () => {
    const parentDeptId = selectedDeptId || selectedDeptIdCascade;
    if (!newTeamName || !parentDeptId) {
      toast.error("Please provide team name and parent department");
      return;
    }

    let parentOrgId = '';
    for (const orgId in loadedDepts) {
      const match = loadedDepts[orgId].find(d => d.id === parentDeptId);
      if (match) {
        parentOrgId = match.orgId;
        break;
      }
    }

    try {
      const docRef = await addDoc(collection(db, 'teams'), {
        name: newTeamName,
        orgId: parentOrgId,
        deptId: parentDeptId,
        createdAt: serverTimestamp()
      });

      const newT: Team = {
        id: docRef.id,
        name: newTeamName,
        orgId: parentOrgId,
        deptId: parentDeptId
      };

      setLoadedTeams(prev => ({
        ...prev,
        [parentDeptId]: [...(prev[parentDeptId] || []), newT]
      }));

      setExpandedDepts(prev => {
        const next = new Set(prev);
        next.add(parentDeptId);
        return next;
      });

      if (totalTeamsCount !== null) setTotalTeamsCount(totalTeamsCount + 1);

      setNewTeamName('');
      setIsAddingTeam(false);
      toast.success("Operational tracking team deployed!");
    } catch (e) {
      toast.error("Failed to deploy operational team.");
    }
  };

  const handleDelete = async (coll: string, id: string) => {
    if (!window.confirm(`Delete this ${coll.slice(0, -1)}? This will also purge all nested departments and operations records.`)) return;
    try {
      if (coll === 'organizations') {
        const batch = writeBatch(db);
        
        const teamsColl = collection(db, 'teams');
        const teamsQuery = query(teamsColl, where('orgId', '==', id));
        const teamsSnap = await getDocs(teamsQuery);
        teamsSnap.docs.forEach(d => batch.delete(doc(db, 'teams', d.id)));

        const deptsColl = collection(db, 'departments');
        const deptsQuery = query(deptsColl, where('orgId', '==', id));
        const deptsSnap = await getDocs(deptsQuery);
        deptsSnap.docs.forEach(d => batch.delete(doc(db, 'departments', d.id)));

        batch.delete(doc(db, 'organizations', id));
        await batch.commit();

        setOrganizations(prev => prev.filter(org => org.id !== id));
        setLoadedDepts(prev => {
          const c = { ...prev };
          delete c[id];
          return c;
        });

        if (totalOrgsCount !== null) setTotalOrgsCount(Math.max(0, totalOrgsCount - 1));
        if (totalDeptsCount !== null) setTotalDeptsCount(Math.max(0, totalDeptsCount - deptsSnap.size));
        if (totalTeamsCount !== null) setTotalTeamsCount(Math.max(0, totalTeamsCount - teamsSnap.size));

        if (selectedOrgIdCascade === id) setSelectedOrgIdCascade('');
      } else if (coll === 'departments') {
        const batch = writeBatch(db);
        
        let parentOrgId = '';
        for (const orgId in loadedDepts) {
          if (loadedDepts[orgId].some(d => d.id === id)) {
            parentOrgId = orgId;
            break;
          }
        }

        const teamsColl = collection(db, 'teams');
        const teamsQuery = query(teamsColl, where('deptId', '==', id));
        const teamsSnap = await getDocs(teamsQuery);
        teamsSnap.docs.forEach(d => batch.delete(doc(db, 'teams', d.id)));

        batch.delete(doc(db, 'departments', id));
        await batch.commit();

        if (parentOrgId) {
          setLoadedDepts(prev => ({
            ...prev,
            [parentOrgId]: prev[parentOrgId].filter(dept => dept.id !== id)
          }));
        }
        setLoadedTeams(prev => {
          const c = { ...prev };
          delete c[id];
          return c;
        });

        if (totalDeptsCount !== null) setTotalDeptsCount(Math.max(0, totalDeptsCount - 1));
        if (totalTeamsCount !== null) setTotalTeamsCount(Math.max(0, totalTeamsCount - teamsSnap.size));

        if (selectedDeptIdCascade === id) setSelectedDeptIdCascade('');
      } else {
        let parentDeptId = '';
        for (const deptId in loadedTeams) {
          if (loadedTeams[deptId].some(t => t.id === id)) {
            parentDeptId = deptId;
            break;
          }
        }

        await deleteDoc(doc(db, coll, id));

        if (parentDeptId) {
          setLoadedTeams(prev => ({
            ...prev,
            [parentDeptId]: prev[parentDeptId].filter(team => team.id !== id)
          }));
        }

        if (totalTeamsCount !== null) setTotalTeamsCount(Math.max(0, totalTeamsCount - 1));
      }
      toast.success(`${coll.charAt(0).toUpperCase() + coll.slice(1, -1)} removed successfully.`);
    } catch (e) {
      toast.error("Operation failed. Access denied.");
    }
  };

  const lowerSearch = searchTerm.toLowerCase().trim();

  // Metric displays
  const displayTotalOrgs = totalOrgsCount !== null ? totalOrgsCount : organizations.length;
  const displayTotalDepts = totalDeptsCount !== null ? totalDeptsCount : Object.values(loadedDepts).flat().length;
  const displayTotalTeams = totalTeamsCount !== null ? totalTeamsCount : Object.values(loadedTeams).flat().length;

  return (
    <div className="space-y-6">
      
      {/* SECTION HEADER BLOCK */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-neutral-50 p-6 rounded-3xl border border-neutral-150">
        <div>
          <h2 className="text-xl font-black text-neutral-800 tracking-tight uppercase flex items-center gap-2">
            <Building2 className="text-primary" size={20} />
            Corporate Space Setup
          </h2>
          <p className="text-xs text-neutral-400 font-bold uppercase mt-1 tracking-wider">
            Configure infinite organizations, nested structural departments, and operations teams in real-time.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Active Layout Switcher tab bar */}
          <div className="bg-neutral-200/50 p-1.5 rounded-full flex gap-1 border border-neutral-200">
            <button 
              onClick={() => setActiveLayout('tree')}
              className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition ${
                activeLayout === 'tree' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Family Tree Map
            </button>
            <button 
              onClick={() => setActiveLayout('cascade')}
              className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition ${
                activeLayout === 'cascade' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Cascading Columns
            </button>
          </div>

          <button 
            onClick={() => setIsAddingOrg(true)}
            className="bg-neutral-950 text-white hover:bg-neutral-900 border border-neutral-800 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-wider shadow transition"
          >
            + Create Org
          </button>
        </div>
      </div>

      {/* METRIC CARD PANELS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Card 1: Organizations */}
        <div className="bg-white border border-neutral-150/80 p-5 rounded-[2rem] flex items-center justify-between shadow-2xs hover:border-neutral-200 transition">
          <div className="space-y-1.5">
            <span className="text-[10px] text-neutral-400 font-black uppercase tracking-widest block">1. Active Organizations</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-neutral-800 tracking-tight">
                {totalOrgsCount !== null ? displayTotalOrgs.toLocaleString() : "..."}
              </span>
              <span className="text-[9px] font-black uppercase tracking-widest text-[#FF5500]">Infinite Index Scale</span>
            </div>
          </div>
          <span className="p-3.5 bg-neutral-50 text-neutral-500 rounded-2xl border border-neutral-100">
            <Building2 size={18} />
          </span>
        </div>

        {/* Card 2: Departments */}
        <div className="bg-white border border-neutral-150/80 p-5 rounded-[2rem] flex items-center justify-between shadow-2xs hover:border-neutral-200 transition">
          <div className="space-y-1.5">
            <span className="text-[10px] text-neutral-400 font-black uppercase tracking-widest block">2. Structural Departments</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-neutral-800 tracking-tight">
                {totalDeptsCount !== null ? displayTotalDepts.toLocaleString() : "..."}
              </span>
              <span className="text-[9px] font-black uppercase tracking-widest text-primary">On-Demand Sync</span>
            </div>
          </div>
          <span className="p-3.5 bg-neutral-100/30 text-primary rounded-2xl border border-neutral-100/50">
            <Layers size={18} />
          </span>
        </div>

        {/* Card 3: Teams */}
        <div className="bg-[#FFFDF4] border border-[#FBEFCD] p-5 rounded-[2rem] flex items-center justify-between shadow-2xs">
          <div className="space-y-1.5">
            <span className="text-[10px] text-amber-600/80 font-black uppercase tracking-widest block">3. Operational Teams</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-800 tracking-tight">
                {totalTeamsCount !== null ? displayTotalTeams.toLocaleString() : "..."}
              </span>
              <span className="text-[9px] font-black uppercase tracking-widest text-amber-600">Dynamic Gateway Active</span>
            </div>
          </div>
          <span className="p-3.5 bg-amber-500/10 text-amber-600 rounded-2xl border border-amber-500/20">
            <GitBranch size={18} />
          </span>
        </div>
      </div>

      {/* SEARCH AND STRUCTURAL CONTROLS */}
      <div className="bg-white border border-neutral-150 rounded-[2rem] p-5 space-y-4 shadow-sm">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 pb-4">
          
          <div className="relative w-full md:max-w-md shrink-0">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400">
              <Search size={14} />
            </span>
            <input 
              type="text" 
              placeholder="Filter by organization name or index prefix..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-full pl-11 pr-4 py-2.5 text-xs font-medium focus:bg-white focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 transition outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={fetchGlobalStats}
              title="Refresh Global Aggregates"
              className="p-2 bg-neutral-50 hover:bg-neutral-100 text-neutral-500 rounded-full border border-neutral-200 transition"
            >
              <RefreshCw size={12} className={loadingOrgs ? "animate-spin" : ""} />
            </button>
            <button 
              onClick={expandAllLoaded}
              className="text-[10px] font-black uppercase tracking-widest bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 hover:border-neutral-300 text-neutral-700 rounded-full px-4 py-2 transition"
            >
              Expand Loaded Nodes
            </button>
            <button 
              onClick={collapseAll}
              className="text-[10px] font-black uppercase tracking-widest bg-white hover:bg-neutral-100 border border-neutral-200 hover:border-neutral-300 text-neutral-700 rounded-full px-4 py-2 transition"
            >
              Collapse Maps
            </button>
          </div>
        </div>

        {/* LAYOUT 1: EXPANDABLE FAMILY TREE MAP */}
        {activeLayout === 'tree' ? (
          <div className="space-y-3 pt-2">
            {organizations.length > 0 ? (
              organizations.map(org => {
                const orgDepts = loadedDepts[org.id] || [];
                const isOrgExpanded = expandedOrgs.has(org.id);
                const isLoadingDepts = loadingDeptsMap[org.id];

                return (
                  <div key={org.id} className="border border-neutral-200/70 rounded-2xl bg-white overflow-hidden shadow-2xs">
                    
                    {/* Organization Row Segment Header */}
                    <div className="bg-neutral-50/70 px-4 py-3 flex items-center justify-between gap-4 border-b border-neutral-100">
                      
                      <div className="flex items-center gap-3 min-w-0">
                        <button 
                          onClick={() => toggleOrgExpand(org.id)}
                          className="p-1 hover:bg-neutral-200 rounded-md transition"
                        >
                          <ChevronDown 
                            size={14} 
                            className={`text-neutral-500 transition-transform duration-200 ${isOrgExpanded ? '' : '-rotate-90'}`}
                          />
                        </button>
                        
                        <span className="p-2 bg-neutral-950 text-white rounded-xl shrink-0">
                          <Building2 size={13} />
                        </span>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-neutral-800 text-xs uppercase tracking-wide truncate">{org.name}</h4>
                            <span className="px-1.5 py-0.5 bg-neutral-200 text-neutral-600 rounded text-[8px] font-black uppercase tracking-wide">
                              /{org.slug}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 text-[9px] text-neutral-400 font-extrabold uppercase mt-0.5 tracking-wider">
                            <span>Plan: {org.subscriptionPlan || 'enterprise'}</span>
                            <span>•</span>
                            <span>Status: {org.status || 'active'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Control Operations panel */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button 
                          onClick={() => {
                            setSelectedOrgId(org.id);
                            setIsAddingDept(true);
                          }}
                          className="p-1.5 text-neutral-500 hover:text-neutral-900 bg-white border border-neutral-200 rounded-lg transition"
                          title="Assign a new operational department"
                        >
                          <Plus size={12} />
                        </button>

                        <button 
                          onClick={() => setEditingOrg(org)}
                          className="p-1.5 text-neutral-500 hover:text-neutral-900 bg-white border border-neutral-200 rounded-lg transition"
                          title="Modify corporate parameters"
                        >
                          <Edit2 size={12} />
                        </button>

                        <button 
                          onClick={() => handleDelete('organizations', org.id)}
                          className="p-1.5 text-neutral-500 hover:text-red-600 bg-white border border-neutral-200 rounded-lg hover:border-red-200 transition"
                          title="Decommission organization"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Collapsible Departments Sub-Branches */}
                    <AnimatePresence>
                      {isOrgExpanded && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="px-6 py-4 bg-white space-y-4 border-t border-neutral-50"
                        >
                          {isLoadingDepts ? (
                            <div className="flex items-center gap-2 py-2 pl-4 text-neutral-400 text-xs font-semibold">
                              <RefreshCw size={12} className="animate-spin" />
                              <span>Lazy indexing active subdepartments...</span>
                            </div>
                          ) : orgDepts.length > 0 ? (
                            orgDepts.map(dept => {
                              const deptTeams = loadedTeams[dept.id] || [];
                              const isDeptExpanded = expandedDepts.has(dept.id);
                              const isLoadingTeams = loadingTeamsMap[dept.id];

                              return (
                                <div key={dept.id} className="relative pl-6 border-l border-dashed border-neutral-200 ml-3">
                                  
                                  {/* Connector Line Element */}
                                  <div className="absolute -left-px top-0 bottom-0 w-px border-l border-dashed border-neutral-200" />
                                  <div className="absolute left-0 top-5 w-4 border-t border-dashed border-neutral-200" />

                                  <div className="space-y-3">
                                    
                                    {/* Department Node Header Panel */}
                                    <div className="bg-neutral-50 border border-neutral-200/50 rounded-xl px-4 py-2 px-3 flex items-center justify-between gap-3 shadow-3xs max-w-3xl">
                                      
                                      <div className="flex items-center gap-2 min-w-0">
                                        <button 
                                          onClick={() => toggleDeptExpand(dept.id)}
                                          className="p-0.5 hover:bg-neutral-200 rounded transition"
                                        >
                                          <ChevronDown 
                                            size={12} 
                                            className={`text-neutral-500 transition-transform duration-200 ${isDeptExpanded ? '' : '-rotate-90'}`}
                                          />
                                        </button>
                                        
                                        <span className="p-1 bg-neutral-200 text-neutral-700 rounded-md shrink-0">
                                          <Layers size={11} />
                                        </span>

                                        <span className="font-extrabold text-[11px] text-neutral-700 uppercase tracking-wide truncate">
                                          {dept.name}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0">
                                        <button 
                                          onClick={() => {
                                            setSelectedDeptId(dept.id);
                                            setIsAddingTeam(true);
                                          }}
                                          className="p-1 text-neutral-400 hover:text-neutral-800 transition"
                                          title="Configure operational sub-team branch"
                                        >
                                          <Plus size={11} />
                                        </button>
                                        <button 
                                          onClick={() => handleDelete('departments', dept.id)}
                                          className="p-1 text-neutral-400 hover:text-red-500 transition"
                                          title="Decommission department"
                                        >
                                          <Trash2 size={11} />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Collapsible Teams List */}
                                    <AnimatePresence>
                                      {isDeptExpanded && (
                                        <motion.div 
                                          initial={{ opacity: 0, height: 0 }}
                                          animate={{ opacity: 1, height: 'auto' }}
                                          exit={{ opacity: 0, height: 0 }}
                                          className="relative pt-3 pl-6 ml-3 space-y-2 overflow-hidden border-t border-neutral-200/30"
                                        >
                                          <div className="absolute left-[3px] top-0 bottom-4 w-px border-l border-dashed border-neutral-200" />

                                          {isLoadingTeams ? (
                                            <div className="flex items-center gap-2 py-1 text-neutral-400 text-[10px] font-bold uppercase">
                                              <RefreshCw size={10} className="animate-spin" />
                                              <span>Querying team subnodes...</span>
                                            </div>
                                          ) : deptTeams.length > 0 ? (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 py-1">
                                              {deptTeams.map(team => (
                                                <div key={team.id} className="relative pl-4">
                                                  <div className="absolute -left-[20px] top-4 w-4 border-t border-dashed border-neutral-200" />
                                                  
                                                  <div className="bg-white border border-neutral-200/60 rounded-xl px-3 py-2 flex items-center justify-between gap-2 shadow-2xs hover:border-neutral-300 transition">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                      <span className="p-1 bg-amber-50 text-amber-600 rounded-md shrink-0">
                                                        <GitBranch size={11} />
                                                      </span>
                                                      <span className="font-extrabold text-neutral-700 text-[11px] uppercase tracking-wide truncate">
                                                        {team.name}
                                                      </span>
                                                    </div>
                                                    
                                                    <button 
                                                      onClick={() => handleDelete('teams', team.id)}
                                                      className="p-1 text-neutral-300 hover:text-red-500 rounded hover:bg-neutral-50 transition shrink-0"
                                                    >
                                                      <Trash2 size={11} />
                                                    </button>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <div className="relative pl-4 py-2 text-left">
                                              <div className="absolute -left-[20px] top-4 w-4 border-t border-dashed border-neutral-200" />
                                              <span className="text-[10px] text-neutral-400 italic font-medium">
                                                No functional teams mapped under department. 
                                                <button 
                                                  onClick={() => {
                                                    setSelectedDeptId(dept.id);
                                                    setIsAddingTeam(true);
                                                  }}
                                                  className="text-primary hover:underline ml-1 font-bold"
                                                >
                                                  Initialize one now →
                                                </button>
                                              </span>
                                            </div>
                                          )}
                                        </motion.div>
                                      )}
                                    </AnimatePresence>

                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="relative pl-6 py-2">
                              <p className="text-[11px] text-neutral-400 font-bold uppercase tracking-wider italic">
                                No departments registered under this organization.
                              </p>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                  </div>
                );
              })
            ) : (
              <div className="bg-white p-12 text-center rounded-[2rem] border border-neutral-150">
                <Building2 className="mx-auto text-neutral-300 mb-3" size={36} />
                <p className="text-neutral-500 text-xs font-semibold uppercase tracking-wider">No matching hierarchies found</p>
                <p className="text-neutral-400 text-[10px] mt-1 uppercase font-bold">Try adjusting your search filters or create a brand new corporate entity layout.</p>
              </div>
            )}

            {/* Pagination Load More Button */}
            {hasMoreOrgs && !searchTerm && (
              <div className="text-center pt-4">
                <button 
                  onClick={handleLoadMoreOrgs}
                  disabled={loadingOrgs}
                  className="bg-white border border-neutral-250 text-neutral-700 rounded-full px-6 py-2.5 text-[10px] font-black uppercase tracking-widest hover:bg-neutral-50 hover:border-neutral-350 shadow-xs transition"
                >
                  {loadingOrgs ? "Loading enterprise batch..." : "Load More Organizations"}
                </button>
              </div>
            )}
          </div>
          
        ) : (
          
          /* LAYOUT 2: CASCADING COLUMN SELECTORS */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Column A: Organizations (4 cols) */}
            <div className="lg:col-span-4 bg-white rounded-[2rem] border border-neutral-150/70 p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
                  <h3 className="font-extrabold text-[11px] uppercase tracking-wider text-neutral-400 block truncate">1. Organizations</h3>
                </div>
              </div>

              <div className="space-y-2 max-h-120 overflow-y-auto pr-1">
                {organizations.map(org => (
                  <div 
                    key={org.id} 
                    onClick={() => {
                      setSelectedOrgIdCascade(org.id);
                      toast.success(`Context bounds set to: ${org.name}`);
                    }}
                    className={`p-4 rounded-2xl border transition text-left cursor-pointer relative ${
                      selectedOrgIdCascade === org.id 
                        ? 'border-neutral-900 bg-neutral-950 text-white shadow' 
                        : 'border-neutral-200 bg-neutral-50/70 hover:bg-neutral-100/70 text-neutral-800'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="min-w-0 pr-2">
                        <p className="font-black text-xs uppercase tracking-wide truncate">{org.name}</p>
                        <span className={`font-mono text-[9px] block ${selectedOrgIdCascade === org.id ? 'text-neutral-400' : 'text-neutral-400'}`}>
                          /{org.slug}
                        </span>
                      </div>

                      <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-wider shrink-0 ${
                        org.status === 'active' 
                          ? (selectedOrgIdCascade === org.id ? 'bg-emerald-800/80 text-emerald-200' : 'bg-emerald-100 text-emerald-700')
                          : 'bg-red-100 text-red-600'
                      }`}>
                        {org.status || 'active'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center border-t border-neutral-100/10 pt-2 text-[8px] uppercase tracking-widest font-black text-neutral-400">
                      <span>Depts: {loadedDepts[org.id]?.length ?? 'Click to Sync'}</span>
                      <div className="flex gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setEditingOrg(org); }}
                          className="hover:text-primary transition font-bold"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete('organizations', org.id); }}
                          className="hover:text-red-500 transition font-bold"
                        >
                          Del
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Direct Column Cursor */}
                {hasMoreOrgs && !searchTerm && (
                  <button 
                    onClick={handleLoadMoreOrgs}
                    className="w-full py-2.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-[9px] font-black uppercase text-neutral-500 tracking-wider rounded-xl transition"
                  >
                    {loadingOrgs ? "Paging..." : "Load More"}
                  </button>
                )}
              </div>
            </div>

            {/* Column B: Selected Departments List (4 cols) */}
            <div className="lg:col-span-4 bg-white rounded-[2rem] border border-neutral-150/70 p-5 shadow-sm space-y-4">
              
              <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <h3 className="font-extrabold text-[11px] uppercase tracking-wider text-neutral-400">2. Active Departments</h3>
                </div>
                {selectedOrgIdCascade && (
                  <button 
                    onClick={() => setIsAddingDept(true)}
                    className="text-[9px] font-black uppercase text-primary hover:underline"
                  >
                    + Add Dept
                  </button>
                )}
              </div>

              {selectedOrgIdCascade ? (
                <div className="space-y-2 max-h-120 overflow-y-auto pr-1">
                  {loadingDeptsMap[selectedOrgIdCascade] ? (
                    <div className="flex items-center justify-center p-8 gap-2 text-neutral-400 text-xs font-semibold">
                      <RefreshCw size={13} className="animate-spin" />
                    </div>
                  ) : (loadedDepts[selectedOrgIdCascade] || []).length > 0 ? (
                    (loadedDepts[selectedOrgIdCascade] || []).map(dept => (
                      <div 
                        key={dept.id}
                        onClick={() => setSelectedDeptIdCascade(dept.id)}
                        className={`p-3.5 rounded-xl border text-left cursor-pointer transition ${
                          selectedDeptIdCascade === dept.id
                            ? 'border-neutral-800 bg-neutral-900 text-white shadow'
                            : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100/50 text-neutral-700'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-extrabold text-xs uppercase tracking-wide truncate">{dept.name}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete('departments', dept.id); }}
                            className="text-neutral-400 hover:text-red-500 p-1 shrink-0 transition font-black"
                          >
                            ✕
                          </button>
                        </div>
                        
                        <div className="flex justify-between items-center text-[8px] font-bold uppercase tracking-wider text-neutral-400">
                          <span>Teams: {loadedTeams[dept.id]?.length ?? 'Click'}</span>
                          <span className="font-normal italic">Mapped</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                      <p className="text-[10px] text-neutral-400 uppercase font-black">No departments mapped</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center bg-neutral-50 rounded-2xl border border-dashed border-neutral-200 py-12">
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider leading-relaxed">
                    ← Choose an organization category from the left column to populate active departments.
                  </p>
                </div>
              )}
            </div>

            {/* Column C: Assigned Teams List (4 cols) */}
            <div className="lg:col-span-4 bg-white rounded-[2rem] border border-neutral-150/70 p-5 shadow-sm space-y-4">
              
              <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <h3 className="font-extrabold text-[11px] uppercase tracking-wider text-neutral-400">3. Operational Teams</h3>
                </div>
                {selectedDeptIdCascade && (
                  <button 
                    onClick={() => setIsAddingTeam(true)}
                    className="text-[9px] font-black uppercase text-amber-600 hover:underline"
                  >
                    + Add Team
                  </button>
                )}
              </div>

              {selectedDeptIdCascade ? (
                <div className="space-y-2 max-h-120 overflow-y-auto pr-1">
                  {loadingTeamsMap[selectedDeptIdCascade] ? (
                    <div className="flex items-center justify-center p-8 gap-2 text-neutral-400 text-xs font-semibold">
                      <RefreshCw size={13} className="animate-spin" />
                    </div>
                  ) : (loadedTeams[selectedDeptIdCascade] || []).length > 0 ? (
                    (loadedTeams[selectedDeptIdCascade] || []).map(team => (
                      <div 
                        key={team.id}
                        className="p-3.5 bg-neutral-50/75 hover:bg-neutral-100/50 border border-neutral-200 rounded-xl flex items-center justify-between gap-3 text-left"
                      >
                        <div className="min-w-0">
                          <h5 className="font-extrabold text-neutral-800 text-xs truncate uppercase tracking-widest">{team.name}</h5>
                          <span className="text-[7.5px] font-black uppercase tracking-widest text-[#FF5500] block mt-0.5">
                            Operational Namespace Active
                          </span>
                        </div>
                        <button
                          onClick={() => handleDelete('teams', team.id)}
                          className="p-1 text-neutral-400 hover:text-red-500 rounded hover:bg-white border border-transparent hover:border-neutral-200 transition shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                      <p className="text-[10px] text-neutral-400 uppercase font-black">No operational teams deployed</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center bg-neutral-50 rounded-2xl border border-dashed border-neutral-200 py-12">
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider leading-relaxed">
                    ← Choose a sub-department namespace to inspect and manage operational teams.
                  </p>
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* CREATION MODAL OVERLAYS */}
      
      {/* Overlay 1: Create Organization */}
      {isAddingOrg && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-55">
          <div className="bg-white rounded-[2.5rem] border border-neutral-200/80 p-7 max-w-md w-full shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsAddingOrg(false)}
              className="absolute right-5 top-5 p-1 bg-neutral-50 rounded-full text-neutral-400 hover:text-black hover:bg-neutral-100 transition"
            >
              <X size={14} />
            </button>
            
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-primary tracking-widest block">System Wizard</span>
              <h3 className="text-lg font-black uppercase text-neutral-800 tracking-tight">Generate Corporate Workspace</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider block mb-1">Enterprise Name</label>
                <input 
                  type="text" 
                  placeholder="e.g., Summit Logistic Solutions"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-2.5 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 transition outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider block mb-1">Custom Namespace slug (Optional)</label>
                <input 
                  type="text" 
                  placeholder="e.g., summit-logistics"
                  value={newOrgSlug}
                  onChange={(e) => setNewOrgSlug(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-2.5 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 transition outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                onClick={handleCreateOrg}
                className="flex-1 bg-neutral-950 hover:bg-neutral-900 text-white rounded-full py-2.5 text-xs font-black uppercase tracking-wider shadow-sm transition"
              >
                Initialize Workspace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay 2: Modify Organization */}
      {editingOrg && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-55">
          <div className="bg-white rounded-[2.5rem] border border-neutral-200 p-7 max-w-md w-full shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setEditingOrg(null)}
              className="absolute right-5 top-5 p-1 bg-neutral-50 rounded-full text-neutral-400 hover:text-black hover:bg-neutral-100 transition"
            >
              <X size={14} />
            </button>

            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-amber-600 tracking-widest block font-bold">System Modify</span>
              <h3 className="text-lg font-black uppercase text-neutral-800 tracking-tight">Edit Corporate Parameters</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider block mb-1">Corporate Name</label>
                <input 
                  type="text"
                  value={editingOrg.name}
                  onChange={(e) => setEditingOrg({ ...editingOrg, name: e.target.value })}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-2.5 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 transition outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider block mb-1">System namespace slug</label>
                <input 
                  type="text"
                  value={editingOrg.slug}
                  onChange={(e) => setEditingOrg({ ...editingOrg, slug: e.target.value })}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-2.5 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 transition outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                onClick={handleUpdateOrg}
                className="flex-1 bg-neutral-950 hover:bg-neutral-900 text-white rounded-full py-2.5 text-xs font-black uppercase tracking-wider shadow-sm transition"
              >
                Apply Updates
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay 3: Create Structural Department */}
      {isAddingDept && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-55">
          <div className="bg-white rounded-[2.5rem] border border-neutral-200 p-7 max-w-sm w-full shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsAddingDept(false)}
              className="absolute right-5 top-5 p-1 bg-neutral-50 rounded-full text-neutral-400 hover:text-black hover:bg-neutral-100 transition"
            >
              <X size={14} />
            </button>

            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-primary tracking-widest block font-bold">Workspace Hierarchy</span>
              <h3 className="text-lg font-black uppercase text-neutral-800 tracking-tight">Create Department Group</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider block mb-1">Parent Corporate Target</label>
                <select 
                  value={selectedOrgId || selectedOrgIdCascade}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wide focus:bg-white focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 transition outline-none"
                >
                  <option value="">-- Choose Corporate parent --</option>
                  {organizations.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider block mb-1">Department Identifier Name</label>
                <input 
                  type="text" 
                  placeholder="e.g., Fleet Maintenance Operations"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-2.5 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 transition outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                onClick={handleCreateDept}
                className="flex-1 bg-neutral-950 hover:bg-neutral-900 text-white rounded-full py-2.5 text-xs font-black uppercase tracking-wider shadow-sm transition"
              >
                Register Department
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay 4: Create Operational Team */}
      {isAddingTeam && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-55">
          <div className="bg-white rounded-[2.5rem] border border-neutral-200 p-7 max-w-sm w-full shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsAddingTeam(false)}
              className="absolute right-5 top-5 p-1 bg-neutral-50 rounded-full text-neutral-400 hover:text-black hover:bg-neutral-100 transition"
            >
              <X size={14} />
            </button>

            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-amber-600 tracking-widest block font-bold">Process Gateway</span>
              <h3 className="text-lg font-black uppercase text-neutral-800 tracking-tight">Deploy Operational Team</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider block mb-1">Parent Department Gateway</label>
                <select 
                  value={selectedDeptId || selectedDeptIdCascade}
                  onChange={(e) => setSelectedDeptId(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-2.5 text-xs font-black uppercase tracking-wide focus:bg-white focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 transition outline-none"
                >
                  <option value="">-- Choose Department parent --</option>
                  {Object.entries(loadedDepts).map(([orgId, depts]) => {
                    const orgName = organizations.find(o => o.id === orgId)?.name || 'Index Org';
                    return depts.map(d => (
                      <option key={d.id} value={d.id}>{orgName} &gt; {d.name}</option>
                    ));
                  })}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider block mb-1">Team Namespace Name</label>
                <input 
                  type="text" 
                  placeholder="e.g., Heavy Transport Crew A"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-2.5 text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 transition outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                onClick={handleCreateTeam}
                className="flex-1 bg-neutral-950 hover:bg-neutral-900 text-white rounded-full py-2.5 text-xs font-black uppercase tracking-wider shadow-sm transition"
              >
                Deploy Team Node
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
