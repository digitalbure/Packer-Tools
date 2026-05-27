import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  Users, 
  GitBranch, 
  Plus, 
  Settings, 
  Shield, 
  UserPlus, 
  Trash2, 
  Search,
  MoreVertical,
  Briefcase,
  Layers,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  X,
  Code2,
  Copy,
  Zap,
  LayoutGrid,
  Clock,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  Palette,
  LayoutDashboard,
  ShieldCheck,
  QrCode,
  Edit2,
  Printer,
  Sliders,
  Info,
  Upload
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, getDocs, writeBatch, collectionGroup } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Organization, Department, Team, UserRole, Terminal, AdminSettings } from '../types';
import { toast } from 'sonner';
import { isFeatureEnabled } from '../lib/featureUtils';

interface OrganizationModuleProps {
  user: UserProfile | null;
  adminSettings: AdminSettings | null;
}

const OrganizationModule: React.FC<OrganizationModuleProps> = ({ user, adminSettings }) => {
  const [org, setOrg] = useState<Organization | null>(null);
  const [myOrgs, setMyOrgs] = useState<Organization[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [gear, setGear] = useState<any[]>([]);
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'structure' | 'members' | 'api' | 'terminals' | 'stickers' | 'settings'>('structure');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));
  const [isLoading, setIsLoading] = useState(true);
  const [showSelector, setShowSelector] = useState(false);
  
  // Creation States
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  
  // Internal Management States
  const [isAddingDept, setIsAddingDept] = useState(false);
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [activeParentDeptId, setActiveParentDeptId] = useState<string | null>(null);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptLogoUrl, setNewDeptLogoUrl] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamLogoUrl, setNewTeamLogoUrl] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [pairingCodeInput, setPairingCodeInput] = useState('');
  const [searchParams] = useSearchParams();

  // Editing structures
  const [editingNode, setEditingNode] = useState<{
    type: 'dept' | 'team';
    id: string;
    name: string;
    logoUrl?: string;
  } | null>(null);

  // Sticker Designer States
  const [stickerShape, setStickerShape] = useState<'square' | 'rectangle' | 'rounded-square' | 'rounded-rectangle' | 'circle'>('rounded-rectangle');
  const [stickerSize, setStickerSize] = useState<number>(60); // percentage/pixels mapping
  const [stickerLogoSrc, setStickerLogoSrc] = useState<'org' | 'dept' | 'team' | 'none'>('org');
  const [stickerTextLine1, setStickerTextLine1] = useState('PROPERTY OF ORGANIZATION');
  const [stickerTextLine2, setStickerTextLine2] = useState('Sony FX3 Cinema Camera');
  const [stickerTextLine3, setStickerTextLine3] = useState('TAG ID: ASSET-87291');
  const [stickerShowQR, setStickerShowQR] = useState(true);
  const [stickerQRText, setStickerQRText] = useState('ASSET-FX3');
  const [stickerColorBg, setStickerColorBg] = useState('#ffffff');
  const [stickerColorText, setStickerColorText] = useState('#000000');
  const [selectedStickerDeptId, setSelectedStickerDeptId] = useState('');
  const [selectedStickerTeamId, setSelectedStickerTeamId] = useState('');

  useEffect(() => {
    const pairCode = searchParams.get('pair') || searchParams.get('code');
    if (pairCode) {
      setActiveTab('terminals');
      setPairingCodeInput(pairCode.toUpperCase());
      toast.info(`Enter the activation code or click Authorize to pair code "${pairCode.toUpperCase()}"`);
    }
  }, [searchParams]);

  const toggleNode = (id: string) => {
    const newSet = new Set(expandedNodes);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedNodes(newSet);
  };

  const getInventoryForNode = (type: 'org' | 'dept' | 'team', id: string) => {
    return gear.filter(g => {
      if (type === 'org') return g.orgId === id;
      if (type === 'dept') return g.deptId === id;
      if (type === 'team') return g.teamId === id;
      return false;
    });
  };

  const renderInventorySummary = (type: 'org' | 'dept' | 'team', id: string) => {
    const nodeGear = getInventoryForNode(type, id);
    if (nodeGear.length === 0) return null;

    return (
      <div className="mt-4 p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-neutral-400">Assigned Inventory ({nodeGear.length})</span>
          <Link to="/inventory" className="text-[8px] font-black uppercase tracking-widest text-primary hover:underline">View Assets</Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {nodeGear.slice(0, 5).map(g => (
            <div key={g.id} className="w-8 h-8 rounded-lg border border-white/10 overflow-hidden bg-white/5 group relative" title={g.name}>
              <img src={g.photoUrls[0]} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition" />
            </div>
          ))}
          {nodeGear.length > 5 && (
            <div className="w-8 h-8 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-[10px] font-black text-neutral-400">
              +{nodeGear.length - 5}
            </div>
          )}
        </div>
      </div>
    );
  };

  const userPlan = useMemo(() => adminSettings?.plans.find(p => p.id === user?.plan), [user?.plan, adminSettings?.plans]);
  const canManageOrgs = isFeatureEnabled('orgManagement', user, adminSettings);
  const canUseDepts = isFeatureEnabled('departments', user, adminSettings);
  const canUseTeams = isFeatureEnabled('teams', user, adminSettings);

  const generateApiKey = async () => {
    if (!user) return;
    const newKey = 'pk_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    try {
      await updateDoc(doc(db, 'users', user.uid), { apiKey: newKey });
      toast.success("New API Key Generated");
    } catch (e) {
      toast.error("Failed to generate key");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  // Fetch Organizations owned by the user
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'organizations'), where('ownerId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setMyOrgs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization)));
    });
    return () => unsub();
  }, [user?.uid]);

  // Main UI Data Fetching
  useEffect(() => {
    if (!user?.orgId) {
      setIsLoading(false);
      return;
    }

    const unsubOrg = onSnapshot(doc(db, 'organizations', user.orgId), (snap) => {
      if (snap.exists()) setOrg({ id: snap.id, ...snap.data() } as Organization);
    });

    const unsubDepts = onSnapshot(query(collection(db, 'departments'), where('orgId', '==', user.orgId)), (snap) => {
      setDepts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Department)));
    });

    const unsubTeams = onSnapshot(query(collection(db, 'teams'), where('orgId', '==', user.orgId)), (snap) => {
      setTeams(snap.docs.map(t => ({ id: t.id, ...t.data() } as Team)));
    });

    const unsubMembers = onSnapshot(query(collection(db, 'users'), where('orgId', '==', user.orgId)), (snap) => {
      setMembers(snap.docs.map(m => m.data() as UserProfile));
    });

    const unsubGear = onSnapshot(query(collectionGroup(db, 'gearLibrary'), where('orgId', '==', user.orgId)), (snap) => {
      setGear(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubTerminals = onSnapshot(query(collection(db, 'terminals'), where('ownerUid', '==', user.uid)), (snap) => {
      setTerminals(snap.docs.map(d => ({ id: d.id, ...d.data() } as Terminal)));
    });

    setIsLoading(false);

    return () => {
      unsubOrg();
      unsubDepts();
      unsubTeams();
      unsubMembers();
      unsubGear();
      unsubTerminals();
    };
  }, [user?.orgId]);

  const handleCreateOrg = async () => {
    if (!user) return;
    
    if (!newOrgName) {
      toast.error("Organization name is required");
      return;
    }

    const slug = (newOrgSlug || newOrgName).toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    if (!slug) {
      toast.error("A valid identifier (slug) is required");
      return;
    }
    
    // Plan Guard
    const limit = userPlan?.maxOrganizations || 1;
    if (myOrgs.length >= limit) {
      toast.error(`Plan Limit Reached: ${limit} Organization${limit > 1 ? 's' : ''}. Upgrade for more.`);
      return;
    }

    try {
      // Uniqueness check
      const nameCheck = await getDocs(query(collection(db, 'organizations'), where('name', '==', newOrgName)));
      const slugCheck = await getDocs(query(collection(db, 'organizations'), where('slug', '==', slug)));
      
      if (!nameCheck.empty || !slugCheck.empty) {
        toast.error("This organization name or identifier is already taken. Please choose another.");
        return;
      }

      const orgRef = await addDoc(collection(db, 'organizations'), {
        name: newOrgName,
        slug: slug,
        ownerId: user.uid,
        status: 'active',
        settings: {
          branding: { primaryColor: '#2563eb' },
          kioskSettings: { requireSignature: false, allowManualSearch: true, autoLogoutMinutes: 5 }
        },
        subscriptionPlan: user.plan || 'free',
        createdAt: serverTimestamp()
      });

      // Automatically set as active org if none set
      if (!user.orgId) {
        await updateDoc(doc(db, 'users', user.uid), { 
          orgId: orgRef.id,
          role: 'owner'
        });
      }

      setNewOrgName('');
      setNewOrgSlug('');
      setIsCreatingOrg(false);
      toast.success("Organization successfully created!");
    } catch (e) {
      console.error("Org creation error:", e);
      toast.error("Failed to create organization. Check your permissions.");
    }
  };

  const handleSwitchOrg = async (orgId: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { orgId });
      setShowSelector(false);
      toast.success("Switched Organization Context");
    } catch (e) {
      toast.error("Switch failed");
    }
  };

  const handleUpdateBranding = async (color: string) => {
    if (!org || !user) return;
    try {
      await updateDoc(doc(db, 'organizations', org.id), {
        'settings.branding.primaryColor': color
      });
      toast.success("Theme color updated");
    } catch (e) {
      toast.error("Failed to update theme");
    }
  };

  const handleAddDept = async () => {
    if (!newDeptName || !user?.orgId) return;
    
    // Plan & Feature Guard
    if (!canUseDepts) {
      toast.error("Department management is disabled for your plan.");
      return;
    }
    const limit = userPlan?.maxDepartments || 1;
    if (depts.length >= limit) {
      toast.error(`Plan Limit Reached: ${limit} Department${limit > 1 ? 's' : ''}. Upgrade for more.`);
      return;
    }

    try {
      await addDoc(collection(db, 'departments'), {
        name: newDeptName,
        orgId: user.orgId,
        logoUrl: newDeptLogoUrl || '',
        createdAt: serverTimestamp()
      });
      setNewDeptName('');
      setNewDeptLogoUrl('');
      setIsAddingDept(false);
      toast.success("Department created");
    } catch (e) {
      toast.error("Failed to create department");
    }
  };

  const handleAddTeam = async () => {
    if (!newTeamName || !selectedDeptId || !user?.orgId) return;

    // Plan & Feature Guard
    if (!canUseTeams) {
      toast.error("Team management is disabled for your plan.");
      return;
    }
    const limit = userPlan?.maxTeams || 1;
    if (teams.length >= limit) {
      toast.error(`Plan Limit Reached: ${limit} Team${limit > 1 ? 's' : ''}. Upgrade for more.`);
      return;
    }

    try {
      await addDoc(collection(db, 'teams'), {
        name: newTeamName,
        orgId: user.orgId,
        deptId: selectedDeptId,
        logoUrl: newTeamLogoUrl || '',
        createdAt: serverTimestamp()
      });
      setNewTeamName('');
      setNewTeamLogoUrl('');
      setSelectedDeptId('');
      setIsAddingTeam(false);
      toast.success("Team created");
    } catch (e) {
      toast.error("Failed to create team");
    }
  };

  const handleSaveEditingNode = async () => {
    if (!editingNode) return;
    try {
      const collectionName = editingNode.type === 'dept' ? 'departments' : 'teams';
      await updateDoc(doc(db, collectionName, editingNode.id), {
        name: editingNode.name,
        logoUrl: editingNode.logoUrl || ''
      });
      setEditingNode(null);
      toast.success(`${editingNode.type === 'dept' ? 'Department' : 'Team'} updated successfully`);
    } catch (e) {
      toast.error("Failed to update details");
    }
  };

  const handleUpdateRole = async (memberUid: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', memberUid), { role: newRole });
      toast.success("Member role updated");
    } catch (e) {
      toast.error("Failed to update role");
    }
  };

  if (!canManageOrgs) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="w-24 h-24 bg-neutral-100 rounded-[2.5rem] flex items-center justify-center text-amber-500 shadow-inner">
          <ShieldAlert size={48} />
        </div>
        <div className="space-y-2 max-w-sm">
          <h2 className="text-3xl font-black uppercase tracking-tighter">Feature Restricted</h2>
          <p className="text-neutral-500 font-medium italic">
            Organization management requires a higher subscription tier. Learn more about the <span className="font-bold text-primary">Pro Plan</span>.
          </p>
        </div>
        <button className="px-8 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-black transition">
           View Plans
        </button>
      </div>
    );
  }

  if (isLoading) return <div className="flex justify-center py-24 animate-spin text-primary"><LayoutGrid size={48} /></div>;

  // Suspended State
  if (org && org.status === 'suspended') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center space-y-8">
        <div className="w-24 h-24 bg-red-100 rounded-[2.5rem] flex items-center justify-center text-red-500 shadow-xl shadow-red-500/10">
          <Shield size={48} />
        </div>
        <div className="space-y-3 max-w-md">
          <div className="flex items-center justify-center gap-2 text-red-500">
            <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-red-50 border border-red-100 rounded-full">Suspended</span>
          </div>
          <h2 className="text-4xl font-black uppercase tracking-tighter leading-none">{org.name}</h2>
          <p className="text-neutral-500 font-medium italic">
            This organization has been suspended by a platform administrator. Access to its data and modules is restricted until further notice.
          </p>
          {org.suspendedReason && (
             <div className="mt-4 p-4 bg-neutral-50 rounded-2xl border border-neutral-100 text-sm text-neutral-400 font-mono">
                Reason: {org.suspendedReason}
             </div>
          )}
        </div>
        <button 
           onClick={() => setOrg(null)}
           className="px-8 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-black transition"
        >
          Exit Organization View
        </button>
      </div>
    );
  }

  // No Org Selection View or Selector View
  if (!user?.orgId || isCreatingOrg || showSelector) {
    return (
      <div className="max-w-6xl mx-auto space-y-12 pb-24">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-black uppercase tracking-tighter leading-tight">
            Select Your <br/><span className="text-primary italic">Workspace</span>
          </h1>
          <p className="text-neutral-500 font-medium">Switch between your active organizations or initialize a new core.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Selector Grid */}
          <div className="lg:col-span-8 space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
               {myOrgs.map(o => {
                  const isActive = user.orgId === o.id;
                  const orgColor = o.settings?.branding?.primaryColor || '#2563eb';
                  
                  return (
                    <motion.button 
                      key={o.id}
                      whileHover={{ scale: 1.02, y: -4 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSwitchOrg(o.id)}
                      className={`relative overflow-hidden p-8 rounded-[2.5rem] border transition-all text-left group ${
                        isActive 
                          ? 'bg-neutral-900 border-neutral-800 text-white shadow-2xl' 
                          : 'bg-white border-neutral-100 text-neutral-900 hover:border-neutral-200 shadow-sm'
                      }`}
                    >
                      {/* Visual Cue Shade */}
                      <div 
                        className="absolute top-0 right-0 w-32 h-32 blur-[60px] opacity-20 -mr-16 -mt-16 transition-opacity group-hover:opacity-40"
                        style={{ backgroundColor: orgColor }}
                      />
                      
                      <div className="space-y-6 relative">
                        <div className="flex items-center justify-between">
                          <div 
                            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg"
                            style={{ backgroundColor: orgColor }}
                          >
                             {o.settings?.branding?.logo ? (
                               <img src={o.settings.branding.logo} className="w-8 h-8 object-contain" />
                             ) : (
                               <Building2 size={24} />
                             )}
                          </div>
                          {isActive && (
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 bg-white/10 rounded-full text-white">Active</div>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                             <h3 className="text-xl font-black uppercase tracking-tight truncate">{o.name}</h3>
                             {o.status === 'suspended' && (
                               <span className="text-[8px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded uppercase">Suspended</span>
                             )}
                          </div>
                          <p className="text-[10px] text-neutral-400 font-mono italic">/{o.slug}</p>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-black/5">
                           <div className="flex -space-x-2">
                              {/* Representative members/items count placeholder */}
                              <div className="w-6 h-6 rounded-full bg-neutral-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-neutral-500">M</div>
                              <div className="w-6 h-6 rounded-full bg-neutral-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-neutral-500">G</div>
                           </div>
                           <ArrowRight size={18} className={isActive ? 'text-white' : 'text-neutral-300'} />
                        </div>
                      </div>
                    </motion.button>
                  );
               })}

               <motion.button 
                 whileHover={{ scale: 1.02 }}
                 onClick={() => setIsCreatingOrg(true)}
                 className="p-8 rounded-[2.5rem] border-2 border-dashed border-neutral-100 hover:border-neutral-200 transition-all flex flex-col items-center justify-center gap-4 text-neutral-400 group"
               >
                 <div className="w-14 h-14 rounded-2xl bg-neutral-50 flex items-center justify-center group-hover:bg-neutral-100 transition">
                   <Plus size={24} />
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-widest">Create New Core</span>
               </motion.button>
            </div>
          </div>

          {/* Create Section / Info Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <AnimatePresence mode="wait">
              {isCreatingOrg ? (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-white p-10 rounded-[3rem] border border-neutral-100 shadow-sm space-y-8"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-neutral-900 text-white rounded-xl flex items-center justify-center">
                        <Building2 size={20} />
                      </div>
                      <h3 className="text-xl font-black uppercase tracking-tighter">New Org</h3>
                    </div>
                    <button onClick={() => setIsCreatingOrg(false)} className="p-2 hover:bg-neutral-100 rounded-full">
                      <X size={16} />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-4">Org Name</label>
                      <input 
                        placeholder="Apex Production"
                        value={newOrgName}
                        onChange={(e) => setNewOrgName(e.target.value)}
                        className="w-full px-5 py-3.5 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-primary/20 transition"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-4">Identifier</label>
                      <input 
                        placeholder="apex-prod"
                        value={newOrgSlug}
                        onChange={(e) => setNewOrgSlug(e.target.value)}
                        className="w-full px-5 py-3.5 bg-neutral-50 border border-neutral-100 rounded-2xl font-mono text-sm outline-none focus:ring-2 focus:ring-primary/20 transition italic"
                      />
                    </div>
                  </div>

                  <button 
                    onClick={handleCreateOrg}
                    className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition shadow-lg"
                  >
                    Initialize
                  </button>
                </motion.div>
              ) : (
                <div className="bg-neutral-900 p-8 rounded-[3rem] text-white space-y-6">
                  <div className="flex items-center gap-3">
                    <ShieldCheck size={24} className="text-primary" />
                    <h3 className="text-lg font-black uppercase tracking-tighter">Workspace Sync</h3>
                  </div>
                  <p className="text-xs text-neutral-500 font-medium leading-relaxed">
                    Organizations allow you to cluster gear, people, and projects under a unified operational umbrella.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="text-neutral-500">Usage</span>
                      <span>{myOrgs.length} / {userPlan?.maxOrganizations}</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${(myOrgs.length / (userPlan?.maxOrganizations || 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  }

  const orgColor = org?.settings?.branding?.primaryColor || '#2563eb';

  return (
    <div className="space-y-12 pb-24 relative">
      {/* Background Visual Cue Shade */}
      <div 
        className="fixed top-0 right-0 w-[500px] h-[500px] blur-[150px] opacity-5 -z-10 transition-colors duration-1000"
        style={{ backgroundColor: orgColor }}
      />

      {/* Header with Switcher */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowSelector(true)}
            className="w-12 h-12 bg-neutral-100 flex items-center justify-center rounded-2xl text-neutral-400 hover:text-neutral-900 transition shadow-sm active:scale-95"
            title="Switch Workspace"
          >
            <LayoutDashboard size={24} />
          </button>
          
          <div className="flex items-center gap-6">
            <div 
              className="w-16 h-16 md:w-20 md:h-20 text-white rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-center shadow-2xl relative group cursor-pointer shrink-0"
              style={{ backgroundColor: orgColor }}
            >
              {org?.settings.branding.logo ? (
                <img src={org.settings.branding.logo} className="w-10 h-10 md:w-12 md:h-12 object-contain" />
              ) : (
                <Building2 size={28} className="md:size-[32px]" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tighter leading-none truncate">{org?.name}</h1>
                <div className="relative group">
                  <button 
                    onClick={() => setShowSelector(!showSelector)}
                    className="p-1.5 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition"
                  >
                    <ChevronDown size={16} />
                  </button>
                  
                  {/* Quick Switcher dropdown would go here */}
                </div>
              </div>
              <p className="text-neutral-500 font-bold uppercase tracking-widest text-[9px] md:text-xs mt-1 md:mt-2">Organization Console</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 p-1 bg-neutral-100 rounded-2xl md:rounded-3xl overflow-x-auto scrollbar-hide shrink-0 max-w-full">
          {(['overview', 'structure', 'members', 'terminals', 'api', 'settings'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                activeTab === tab 
                  ? 'bg-neutral-900 text-white shadow-lg translate-y-[-2px]' 
                  : 'text-neutral-400 hover:text-neutral-600'
              }`}
            >
              {tab === 'api' ? 'API & Embed' : tab}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div 
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {/* Quick Metrics */}
            {[
              { label: 'Active Assets', value: gear.length, icon: <LayoutGrid size={20} />, color: 'bg-blue-500' },
              { label: 'Units/Teams', value: `${depts.length} / ${teams.length}`, icon: <Layers size={20} />, color: 'bg-emerald-500' },
              { label: 'Force Size', value: members.length, icon: <Users size={20} />, color: 'bg-purple-500' },
              { label: 'Live Terminals', value: terminals.length, icon: <QrCode size={20} />, color: 'bg-amber-500' },
            ].map((stat, i) => (
              <div key={i} className="bg-white p-6 rounded-[2.5rem] border border-neutral-100 shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{stat.label}</p>
                  <p className="text-2xl font-black uppercase tracking-tight">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 ${stat.color} text-white rounded-2xl flex items-center justify-center shadow-lg shadow-black/5`}>
                  {stat.icon}
                </div>
              </div>
            ))}

            <div className="md:col-span-2 lg:col-span-3 bg-white p-8 rounded-[3rem] border border-neutral-100 shadow-sm">
                <h3 className="text-lg font-black uppercase tracking-tighter mb-6">Recent Activity</h3>
                <div className="space-y-4">
                  {members.slice(0, 3).map((m, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-neutral-900 text-white rounded-xl flex items-center justify-center font-bold">
                          {m.displayName?.[0] || 'U'}
                        </div>
                        <div>
                          <p className="text-sm font-bold">{m.displayName}</p>
                          <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">{m.role}</p>
                        </div>
                      </div>
                      <div className="text-[10px] font-bold text-neutral-400">Active now</div>
                    </div>
                  ))}
                </div>
            </div>
            
            <div className="lg:col-span-1 bg-neutral-900 rounded-[3rem] p-8 text-white flex flex-col justify-between">
               <div className="space-y-2">
                  <h3 className="text-xl font-black uppercase tracking-tighter">System Pulse</h3>
                  <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest">Global Status</p>
               </div>
               <div className="space-y-6">
                 <div className="flex items-center gap-3">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="text-xs font-black uppercase tracking-widest">Core Online</span>
                 </div>
                 <div 
                   className="h-1 bg-white/10 rounded-full overflow-hidden"
                 >
                   <motion.div 
                     initial={{ width: 0 }}
                     animate={{ width: '85%' }}
                     className="h-full bg-primary"
                   />
                 </div>
               </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'settings' && (
          <motion.div 
            key="settings"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto bg-white p-10 rounded-[3rem] border border-neutral-100 shadow-sm space-y-10"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-neutral-100 text-neutral-900 rounded-2xl flex items-center justify-center shadow-inner">
                 <Palette size={28} />
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tighter">Visual Identity</h3>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#0066cc] ml-4 block font-mono">Workspace Corporate Logo</label>
                <div className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-neutral-50 rounded-[2rem] border border-neutral-100">
                  <div className="w-20 h-20 rounded-2xl border border-neutral-200 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm relative group">
                    {org?.settings?.branding?.logo ? (
                      <>
                        <img src={org.settings.branding.logo} className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                        <button 
                          onClick={async () => {
                            if (window.confirm("Remove organization logo?")) {
                              await updateDoc(doc(db, 'organizations', org.id), { 'settings.branding.logo': '' });
                              toast.success("Logo removed");
                            }
                          }}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-red-400 text-[10px] font-black uppercase tracking-widest"
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <Building2 size={32} className="text-neutral-300 animate-pulse" />
                    )}
                  </div>
                  <div className="flex-1 w-full space-y-3">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400 block mb-1">Direct Logo Link</span>
                      <input 
                        type="url"
                        placeholder="Paste logo image URL (e.g. Unsplash, company asset)..."
                        value={org?.settings?.branding?.logo || ''}
                        onChange={async (e) => {
                          const val = e.target.value.trim();
                          await updateDoc(doc(db, 'organizations', org.id), { 'settings.branding.logo': val });
                        }}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary transition text-neutral-800 placeholder-neutral-400"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <label 
                        className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary cursor-pointer hover:underline"
                      >
                        <Upload size={12} />
                        <span>Upload Logo File</span>
                        <input 
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = async () => {
                              const base64 = reader.result as string;
                              await updateDoc(doc(db, 'organizations', org.id), { 'settings.branding.logo': base64 });
                              toast.success("Logo file processed and saved");
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>
                      <span className="text-[9px] text-neutral-400 font-bold">• Converts to secure base64 string</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-4">Workspace Shade</label>
                <div className="flex flex-wrap gap-3">
                  {['#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#db2777', '#0f172a'].map(color => (
                    <button
                      key={color}
                      onClick={() => handleUpdateBranding(color)}
                      className={`w-12 h-12 rounded-2xl transition-all ${orgColor === color ? 'ring-4 ring-neutral-100 ring-offset-2 scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <div className="relative group">
                    <input 
                      type="color"
                      value={orgColor}
                      onChange={(e) => handleUpdateBranding(e.target.value)}
                      className="w-12 h-12 rounded-2xl cursor-pointer bg-white border border-neutral-200 overflow-hidden"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-neutral-400 font-medium ml-4 italic">Customize the visual cue color for this workspace dashboard.</p>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-4">Core Identifier</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-6 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-mono text-xs text-neutral-400">
                    /{org?.slug}
                  </div>
                  <button className="p-4 bg-neutral-900 text-white rounded-2xl">
                     <Settings size={20} />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-8 bg-red-50 rounded-[2.5rem] border border-red-100 space-y-4">
               <h4 className="text-sm font-black uppercase tracking-widest text-red-500">Danger Zone</h4>
               <p className="text-xs text-red-400 font-medium">Permanently dismantle this core organization. All data will be purged.</p>
               <button className="px-6 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition shadow-lg shadow-red-500/20 uppercase tracking-widest text-[10px]">
                  Dismantle Core
               </button>
            </div>
          </motion.div>
        )}
        {activeTab === 'structure' && (
          <motion.div 
            key="structure"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* Legend / Info */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tighter">Organizational Node</h3>
                <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest">Manage your hierarchical structure</p>
              </div>
              <div className="flex gap-4">
                {canUseDepts && (
                  <button 
                    onClick={() => setIsAddingDept(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-black transition text-[10px] uppercase tracking-widest"
                  >
                    <X size={14} className="rotate-45" />
                    <span>Add Dept</span>
                  </button>
                )}
              </div>
            </div>

            {/* The Tree Structure */}
            <div className="bg-white p-8 rounded-[3rem] border border-neutral-100 shadow-sm space-y-4">
              {/* Root Organization Node */}
              <div className="space-y-4">
                <div 
                  className={`flex items-center justify-between p-6 rounded-3xl border transition-all cursor-pointer ${
                    expandedNodes.has('root') ? 'bg-neutral-900 text-white border-neutral-800' : 'bg-neutral-50 border-neutral-100 text-neutral-900 hover:bg-neutral-100'
                  }`}
                  onClick={() => toggleNode('root')}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${expandedNodes.has('root') ? 'bg-white/10' : 'bg-white shadow-sm'}`}>
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h4 className="font-black uppercase tracking-widest text-sm">{org?.name}</h4>
                      <p className="text-[10px] opacity-50 font-bold uppercase tracking-widest">Root Organization</p>
                    </div>
                  </div>
                  {expandedNodes.has('root') ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </div>
                {expandedNodes.has('root') && renderInventorySummary('org', org?.id || '')}

                {/* Departments (Children) */}
                <AnimatePresence>
                  {expandedNodes.has('root') && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="ml-8 pl-8 border-l-2 border-neutral-100 space-y-4 overflow-hidden"
                    >
                      {depts.map(dept => (
                        <div key={dept.id} className="space-y-4">
                          <div 
                            className={`flex items-center justify-between p-5 rounded-2xl border transition-all cursor-pointer ${
                              expandedNodes.has(dept.id) ? 'bg-primary/5 border-primary/20 text-primary' : 'bg-neutral-50 border-neutral-100 text-neutral-600 hover:bg-neutral-100'
                            }`}
                            onClick={() => toggleNode(dept.id)}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${expandedNodes.has(dept.id) ? 'bg-primary/10' : 'bg-white'}`}>
                                <Layers size={16} />
                              </div>
                              <div>
                                <h5 className="font-bold uppercase tracking-widest text-xs">{dept.name}</h5>
                                <p className="text-[8px] opacity-70 font-black uppercase tracking-[0.2em]">Department</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm('Delete this department? All child teams must be removed first.')) {
                                     const hasTeams = teams.some(t => t.deptId === dept.id);
                                     if (hasTeams) {
                                       toast.error("Remove all teams before deleting department");
                                       return;
                                     }
                                     deleteDoc(doc(db, 'departments', dept.id));
                                     toast.success("Department removed");
                                  }
                                }}
                                className="p-2 hover:bg-red-50 text-neutral-200 hover:text-red-400 rounded-lg transition-colors"
                                title="Delete Department"
                              >
                                <Trash2 size={16} />
                              </button>
                              {canUseTeams && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDeptId(dept.id);
                                    setIsAddingTeam(true);
                                  }}
                                  className="p-2 hover:bg-primary/10 rounded-lg transition-colors text-primary"
                                  title="Add Team to this Department"
                                >
                                  <X size={16} className="rotate-45" />
                                  <span>Add Team</span>
                                </button>
                              )}
                              {expandedNodes.has(dept.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </div>
                          </div>
                          {expandedNodes.has(dept.id) && renderInventorySummary('dept', dept.id)}

                          {/* Teams (Grandchildren) */}
                          <AnimatePresence>
                            {expandedNodes.has(dept.id) && (
                              <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="ml-6 pl-6 border-l-2 border-neutral-50 space-y-2 overflow-hidden"
                              >
                                {teams.filter(t => t.deptId === dept.id).map(team => (
                                <div key={team.id} className="space-y-2">
                                  <div 
                                    className="flex items-center justify-between p-4 bg-white border border-neutral-50 rounded-xl hover:border-neutral-200 transition-colors group cursor-pointer"
                                    onClick={() => toggleNode(team.id)}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={`w-6 h-6 rounded flex items-center justify-center ${expandedNodes.has(team.id) ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-500'}`}>
                                        <GitBranch size={14} />
                                      </div>
                                      <div>
                                        <div className="text-[10px] font-bold text-neutral-900">{team.name}</div>
                                        <div className="text-[8px] text-neutral-400 font-black uppercase tracking-[0.15em]">Team</div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button 
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          if (window.confirm('Remove this team?')) {
                                            await deleteDoc(doc(db, 'teams', team.id));
                                            toast.success("Team dismantled");
                                          }
                                        }}
                                        className="p-1.5 text-neutral-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                      {expandedNodes.has(team.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    </div>
                                  </div>
                                  {expandedNodes.has(team.id) && renderInventorySummary('team', team.id)}
                                </div>
                                ))}

                                {teams.filter(t => t.deptId === dept.id).length === 0 && (
                                  <div className="p-4 bg-neutral-50/50 rounded-xl border border-dashed border-neutral-100 text-[10px] text-neutral-400 font-bold italic text-center">
                                    No teams registered in this department
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}

                      {depts.length === 0 && (
                        <div className="p-8 bg-neutral-50/50 rounded-[2rem] border border-dashed border-neutral-100 text-center space-y-3">
                          <p className="text-neutral-400 font-bold italic text-sm">No departments initialized yet.</p>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setIsAddingDept(true); }}
                            className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
                          >
                            Add your first department
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Creation Modals */}
            <AnimatePresence>
              {isAddingDept && (
                <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-md space-y-6"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-neutral-900">
                        <Layers size={24} />
                        <h3 className="text-2xl font-black uppercase tracking-tighter">New Department</h3>
                      </div>
                      <button onClick={() => setIsAddingDept(false)} className="p-2 hover:bg-neutral-100 rounded-full transition">
                        <X size={20} />
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-4">Department Name</label>
                        <input 
                          autoFocus
                          placeholder="e.g. Technical Operations"
                          value={newDeptName}
                          onChange={(e) => setNewDeptName(e.target.value)}
                          className="w-full px-6 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-neutral-900 transition"
                        />
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <button 
                        onClick={handleAddDept}
                        className="flex-1 py-4 bg-neutral-900 text-white rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition shadow-lg"
                      >
                        Create Dept
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}

              {isAddingTeam && (
                <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-md space-y-6"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-emerald-500">
                        <GitBranch size={24} />
                        <h3 className="text-2xl font-black uppercase tracking-tighter text-neutral-900">New Team</h3>
                      </div>
                      <button 
                        onClick={() => {
                          setIsAddingTeam(false);
                          setSelectedDeptId('');
                        }} 
                        className="p-2 hover:bg-neutral-100 rounded-full transition"
                      >
                        <X size={20} />
                      </button>
                    </div>
                    <div className="space-y-4">
                      {selectedDeptId && (
                        <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Layers size={12} className="text-neutral-400" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Target Dept:</span>
                            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-900">
                              {depts.find(d => d.id === selectedDeptId)?.name}
                            </span>
                          </div>
                          <button 
                            onClick={() => setSelectedDeptId('')}
                            className="text-[8px] font-black uppercase tracking-widest text-primary hover:underline"
                          >
                            Change
                          </button>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-4">Team Name</label>
                        <input 
                          autoFocus
                          placeholder="e.g. Field Engineering"
                          value={newTeamName}
                          onChange={(e) => setNewTeamName(e.target.value)}
                          className="w-full px-6 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-neutral-900 transition"
                        />
                      </div>
                      {!selectedDeptId && (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-4">Select Department</label>
                          <select
                            value={selectedDeptId}
                            onChange={(e) => setSelectedDeptId(e.target.value)}
                            className="w-full px-6 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-neutral-900 transition"
                          >
                            <option value="">Select Target...</option>
                            {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-4">
                      <button 
                        onClick={handleAddTeam}
                        className="flex-1 py-4 bg-neutral-900 text-white rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition shadow-lg"
                      >
                        Launch Team
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {activeTab === 'api' && (
          <motion.div
            key="api"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="grid lg:grid-cols-2 gap-8"
          >
            <div className="bg-white p-10 rounded-[3rem] border border-neutral-100 shadow-sm space-y-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-neutral-900 text-white rounded-2xl flex items-center justify-center shadow-lg">
                  <Zap size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter">Your API Key</h3>
                  <p className="text-neutral-400 text-xs font-bold uppercase tracking-widest">Personal Identification Key</p>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-neutral-500 leading-relaxed font-medium">
                  Use this key to authenticate requests to the Packer Tools public API. Keep it secret and never expose it in client-side code.
                </p>

                <div className="relative group">
                  <input
                    type="password"
                    readOnly
                    value={user?.apiKey || 'No key generated'}
                    className="w-full bg-neutral-50 border border-neutral-100 rounded-2xl px-6 py-4 font-mono text-sm outline-none"
                  />
                  <div className="absolute right-2 top-2 flex gap-2">
                    <button
                      onClick={() => user?.apiKey && copyToClipboard(user.apiKey)}
                      className="p-2 bg-white border border-neutral-100 rounded-xl hover:bg-neutral-50 transition shadow-sm"
                      title="Copy Key"
                    >
                      <Copy size={18} />
                    </button>
                    <button
                      onClick={generateApiKey}
                      className="p-2 bg-neutral-900 text-white rounded-xl hover:bg-black transition shadow-lg"
                      title="Regenerate Key"
                    >
                      <Code2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-neutral-900 p-10 rounded-[3rem] text-white space-y-10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] -mr-32 -mt-32" />
              
              <div className="space-y-2 relative">
                <h3 className="text-3xl font-black uppercase tracking-tighter">Website Embedding</h3>
                <p className="text-neutral-500 font-bold uppercase tracking-widest text-xs">Integrate into your own site</p>
              </div>

              <div className="grid grid-cols-1 gap-6 relative">
                <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold flex items-center gap-2">
                       <Shield size={16} className="text-primary" />
                       <span>Lite Version</span>
                    </h4>
                    <button onClick={() => copyToClipboard(`<iframe src="${window.location.origin}/embed/${user?.uid}?lite=true" width="100%" height="600" frameborder="0"></iframe>`)} className="p-2 hover:bg-white/10 rounded-lg transition">
                      <Copy size={16} />
                    </button>
                  </div>
                  <p className="text-xs text-neutral-400">Perfect for view-only public gear lists on your portfolio.</p>
                  <pre className="bg-black/50 p-4 rounded-xl text-[10px] font-mono text-neutral-300 overflow-x-auto">
                    {`<iframe src="${window.location.origin}/embed/${user?.uid}?lite=true" ... />`}
                  </pre>
                </div>

                <div className="bg-white/5 border border-white/10 p-6 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold flex items-center gap-2 text-primary">
                       <Zap size={16} />
                       <span>Pro Version</span>
                    </h4>
                    <button onClick={() => copyToClipboard(`<iframe src="${window.location.origin}/embed/${user?.uid}" width="100%" height="800" frameborder="0"></iframe>`)} className="p-2 hover:bg-white/10 rounded-lg transition">
                      <Copy size={16} />
                    </button>
                  </div>
                  <p className="text-xs text-neutral-400">Full interactive experience with booking and login sync (Pro Plan only).</p>
                  <pre className="bg-black/50 p-4 rounded-xl text-[10px] font-mono text-neutral-300 overflow-x-auto">
                    {`<iframe src="${window.location.origin}/embed/${user?.uid}" ... />`}
                  </pre>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'terminals' && (
          <motion.div 
            key="terminals"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Pairing Panel */}
              <div className="lg:col-span-1 bg-neutral-900 text-white p-10 rounded-[3rem] space-y-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-[60px] -mr-16 -mt-16" />
                <div className="space-y-2 relative">
                  <h3 className="text-2xl font-black uppercase tracking-tighter">Pair New Terminal</h3>
                  <p className="text-neutral-500 font-bold uppercase tracking-widest text-[10px]">Connect a tablet or kiosk device</p>
                </div>
                
                <div className="space-y-4 relative">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Handshake Code</label>
                    <input 
                      type="text"
                      placeholder="ENTER 6-DIGIT CODE"
                      value={pairingCodeInput}
                      onChange={(e) => setPairingCodeInput(e.target.value.toUpperCase())}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-mono text-xl tracking-[0.3em] outline-none focus:border-primary transition uppercase"
                      maxLength={6}
                    />
                  </div>
                  <button 
                    onClick={async () => {
                      if (pairingCodeInput.length !== 6) {
                        toast.error("Please enter a valid 6-digit code");
                        return;
                      }
                      try {
                        const q = query(collection(db, 'terminals'), where('pairingCode', '==', pairingCodeInput), where('status', '==', 'pending'));
                        const snap = await getDocs(q);
                        if (snap.empty) {
                          toast.error("Invalid or expired pairing code");
                          return;
                        }
                        const terminalDoc = snap.docs[0];
                        await updateDoc(doc(db, 'terminals', terminalDoc.id), {
                          status: 'active',
                          ownerUid: user?.uid,
                          lastActive: new Date().toISOString()
                        });
                        setPairingCodeInput('');
                        toast.success("Terminal Paired Successfully!");
                      } catch (e) {
                        toast.error("Pairing failed");
                      }
                    }}
                    className="w-full py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] transition"
                  >
                    Authorize Device
                  </button>
                </div>

                <div className="p-6 bg-white/5 rounded-2xl border border-white/5">
                  <h4 className="font-bold text-xs flex items-center gap-2 mb-2">
                    <Settings size={14} className="text-primary" />
                    <span>How it works</span>
                  </h4>
                  <p className="text-[10px] text-neutral-400 leading-relaxed italic">
                    1. Open the app on your kiosk tablet.<br/>
                    2. Go to /kiosk to see the activation code.<br/>
                    3. Enter that code here to link the device to your gear library.
                  </p>
                </div>
              </div>

              {/* Terminals Grid */}
              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black uppercase tracking-tighter">Active Terminals</h3>
                  <span className="px-3 py-1 bg-neutral-100 text-neutral-400 rounded-full text-[10px] font-black uppercase tracking-widest">{terminals.length} Running</span>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {terminals.map(terminal => (
                    <div key={terminal.id} className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm relative group">
                      <button 
                        onClick={async () => {
                          if (window.confirm('Deauthorize this terminal?')) {
                            await updateDoc(doc(db, 'terminals', terminal.id), { status: 'pending', ownerUid: null });
                            toast.success("Terminal deauthorized");
                          }
                        }}
                        className="absolute top-6 right-6 p-2 text-neutral-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={18} />
                      </button>

                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 bg-neutral-100 rounded-2xl flex items-center justify-center text-neutral-900 shadow-inner">
                          <LayoutGrid size={28} />
                        </div>
                        <div>
                          <h4 className="text-xl font-black uppercase tracking-tighter">{terminal.deviceName}</h4>
                          <span className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-emerald-500">
                             <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                             Online
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3 pt-6 border-t border-neutral-50">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                            <Clock size={12} /> Last Heartbeat
                          </span>
                          <span className="font-mono text-neutral-600">{new Date(terminal.lastActive).toLocaleTimeString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                            <Settings size={12} /> Operation Mode
                          </span>
                          <span className="font-black uppercase tracking-widest text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded italic">
                            {terminal.settings?.mode || 'Hybrid'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-8 flex gap-2">
                        <button className="flex-1 py-3 bg-neutral-50 hover:bg-neutral-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-neutral-600 transition">
                           Logs
                        </button>
                        <button className="flex-1 py-3 bg-neutral-50 hover:bg-neutral-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-neutral-600 transition">
                           Config
                        </button>
                      </div>
                    </div>
                  ))}

                  {terminals.length === 0 && (
                    <div className="md:col-span-2 py-24 text-center bg-neutral-50 rounded-[3rem] border border-dashed border-neutral-200 space-y-4">
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto text-neutral-300">
                        <Shield size={32} />
                      </div>
                      <p className="text-neutral-400 font-bold italic">No active hardware connected. Pair a device to get started.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'members' && (
          <motion.div 
            key="members"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white rounded-[3rem] border border-neutral-100 overflow-hidden"
          >
            <div className="p-8 border-b border-neutral-50 flex items-center justify-between">
              <h2 className="text-2xl font-black uppercase tracking-tight">Organization Roster</h2>
              <button className="flex items-center gap-2 px-6 py-3 bg-neutral-100 text-neutral-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-neutral-200 transition">
                <UserPlus size={16} />
                <span>Invite Member</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-neutral-50 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                  <tr>
                    <th className="px-8 py-6">Member</th>
                    <th className="px-8 py-6">Role</th>
                    <th className="px-8 py-6">Dept / Team</th>
                    <th className="px-8 py-6">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {members.map(member => (
                    <tr key={member.uid} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <img src={member.photoURL} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
                          <div>
                            <div className="font-bold text-neutral-900">{member.displayName}</div>
                            <div className="text-xs text-neutral-400">{member.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <select 
                          value={member.role}
                          onChange={(e) => handleUpdateRole(member.uid, e.target.value as UserRole)}
                          className="bg-neutral-100 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-neutral-900 border-none cursor-pointer"
                        >
                          <option value="owner">Owner</option>
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                          <option value="technician">Technician</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      </td>
                      <td className="px-8 py-6 italic text-neutral-400 text-sm">
                        {depts.find(d => d.id === member.deptId)?.name || 'Direct'} / {teams.find(t => t.id === member.teamId)?.name || 'None'}
                      </td>
                      <td className="px-8 py-6">
                        <button className="p-2 hover:bg-neutral-200 rounded-lg transition text-neutral-400">
                          <MoreVertical size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

function StatCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: number, color: string }) {
  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm flex items-center gap-6">
      <div className={`w-16 h-16 ${color} text-white rounded-2xl flex items-center justify-center shadow-lg shadow-black/5 shrink-0`}>
        {icon}
      </div>
      <div>
        <div className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-1">{label}</div>
        <div className="text-4xl font-black tracking-tighter leading-none">{value}</div>
      </div>
    </div>
  );
}

export default OrganizationModule;
