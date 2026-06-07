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
  Upload,
  Lock,
  Unlock,
  Check,
  Eye,
  FileText,
  FileDown,
  Activity
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, getDocs, writeBatch, collectionGroup } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Organization, Department, Team, UserRole, Terminal, AdminSettings } from '../types';
import { toast } from 'sonner';
import { isFeatureEnabled } from '../lib/featureUtils';
import UpgradeNowModal from '../components/UpgradeNowModal';
import PackerLogo from '../components/PackerLogo';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'structure' | 'members' | 'permissions' | 'api' | 'terminals' | 'stickers' | 'settings'>('structure');
  const [inventories, setInventories] = useState<any[]>([]);
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

  const [isUpgradeNowModalOpen, setIsUpgradeNowModalOpen] = useState(false);
  const [restrictedFeature, setRestrictedFeature] = useState('Custom Organizational White-Label Branding');

  // Sticker Designer States
  const [stickerShape, setStickerShape] = useState<'square' | 'rectangle' | 'rounded-square' | 'rounded-rectangle' | 'circle'>('rounded-rectangle');
  const [stickerSize, setStickerSize] = useState<number>(60); // percentage/pixels mapping
  const [stickerLogoSrc, setStickerLogoSrc] = useState<'packer-tools' | 'org' | 'dept' | 'team' | 'none'>('packer-tools');
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

    const unsubInventories = onSnapshot(collection(db, 'inventories'), (snap) => {
      const allInvs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const orgInvs = allInvs.filter((inv: any) => 
        inv.ownerId === user.uid || 
        (inv.visibility?.orgIds && inv.visibility.orgIds.includes(user.orgId))
      );
      setInventories(orgInvs);
    });

    setIsLoading(false);

    return () => {
      unsubOrg();
      unsubDepts();
      unsubTeams();
      unsubMembers();
      unsubGear();
      unsubTerminals();
      unsubInventories();
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

  const renderSimulatedQRCode = (color: string) => (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" className="w-16 h-16 shrink-0" style={{ shapeRendering: 'crispEdges' }}>
      {/* QR outer corners */}
      <rect x="1" y="1" width="6" height="6" strokeWidth="2" />
      <rect x="3" y="3" width="2" height="2" fill={color} />
      
      <rect x="17" y="1" width="6" height="6" strokeWidth="2" />
      <rect x="19" y="3" width="2" height="2" fill={color} />

      <rect x="1" y="17" width="6" height="6" strokeWidth="2" />
      <rect x="3" y="19" width="2" height="2" fill={color} />

      {/* Center payload pixel markers */}
      <rect x="10" y="2" width="2" height="2" fill={color} />
      <rect x="13" y="4" width="2" height="1" fill={color} />
      <rect x="10" y="7" width="1" height="3" fill={color} />
      <rect x="14" y="9" width="2" height="2" fill={color} />
      
      <rect x="11" y="13" width="2" height="2" fill={color} />
      <rect x="9" y="16" width="3" height="1" fill={color} />
      <rect x="15" y="15" width="2" height="3" fill={color} />
      <rect x="10" y="20" width="4" height="2" fill={color} />
      
      <rect x="19" y="10" width="2" height="4" fill={color} />
      <rect x="21" y="18" width="2" height="2" fill={color} />
      <rect x="17" y="20" width="1" height="2" fill={color} />
    </svg>
  );

  const handlePrintSticker = () => {
    // Collect logo source depending on selection
    let logoHtmlToUse = '';
    if (stickerLogoSrc === 'packer-tools') {
      logoHtmlToUse = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 4px; margin-bottom: 4px;">
          <svg width="24" height="24" viewBox="0 0 200 200" fill="none" style="flex-shrink: 0;">
            <polygon points="42,75 54,68 66,75 54,82" fill="${stickerColorText}" opacity="0.75" />
            <polygon points="42,75 54,82 54,135 42,128" fill="${stickerColorText}" opacity="0.4" />
            <polygon points="54,82 66,75 66,128 54,135" fill="${stickerColorText}" opacity="0.55" />
            <polygon points="46,84 50,81 50,87 46,90" fill="${stickerColorText}" />

            <polygon points="57,84 69,77 81,84 69,91" fill="${stickerColorText}" opacity="0.75" />
            <polygon points="57,84 69,91 69,144 57,137" fill="${stickerColorText}" opacity="0.4" />
            <polygon points="69,91 81,84 81,137 69,144" fill="${stickerColorText}" opacity="0.55" />
            <polygon points="61,93 65,90 65,96 61,99" fill="${stickerColorText}" />

            <polygon points="72,93 84,86 96,93 84,100" fill="${stickerColorText}" opacity="0.75" />
            <polygon points="72,93 84,100 84,153 72,146" fill="${stickerColorText}" opacity="0.4" />
            <polygon points="84,100 96,93 96,146 84,153" fill="${stickerColorText}" opacity="0.55" />
            <polygon points="76,102 80,99 80,105 76,108" fill="${stickerColorText}" />

            <polygon points="99,102 111,109 111,162 99,155" fill="${stickerColorText}" opacity="0.5" />
            <polygon points="111,109 123,102 123,155 111,162" fill="${stickerColorText}" opacity="0.9" />
            <polygon points="99,102 111,95 123,102 111,109" fill="${stickerColorText}" />
            <polygon points="111,95 123,88 135,95 123,102" fill="${stickerColorText}" />
            
            <polygon points="123,102 153,85 153,115 123,132" fill="${stickerColorText}" opacity="0.9" />
            <polygon points="111,109 123,102 123,132 111,139" fill="${stickerColorText}" opacity="0.5" />
            <polygon points="123,102 138,93 138,103 123,112" fill="${stickerColorText}" opacity="0.3" />
            
            <polygon points="123,88 135,81 153,92 135,100" fill="${stickerColorText}" />
            <polygon points="123,124 153,107 153,115 123,132" fill="${stickerColorText}" opacity="0.5" />
          </svg>
          <span style="font-size: 10px; font-weight: 900; letter-spacing: 0.1em; color: ${stickerColorText}; font-family: monospace;">PACKER.TOOLS</span>
        </div>
      `;
    } else if (stickerLogoSrc === 'org' && org?.settings?.branding?.logo) {
      logoHtmlToUse = `<img src="${org.settings.branding.logo}" class="logo-img" />`;
    } else if (stickerLogoSrc === 'dept') {
      const selectedDeptObj = depts.find(d => d.id === selectedStickerDeptId);
      if (selectedDeptObj?.logoUrl) {
        logoHtmlToUse = `<img src="${selectedDeptObj.logoUrl}" class="logo-img" />`;
      }
    } else if (stickerLogoSrc === 'team') {
      const selectedDevObj = teams.find(t => t.id === selectedStickerTeamId);
      if (selectedDevObj?.logoUrl) {
        logoHtmlToUse = `<img src="${selectedDevObj.logoUrl}" class="logo-img" />`;
      }
    }

    // Determine custom border-radius depending on shape
    let borderRadiusCss = '0px';
    if (stickerShape === 'rounded-square' || stickerShape === 'rounded-rectangle') {
      borderRadiusCss = '16px';
    } else if (stickerShape === 'circle') {
      borderRadiusCss = '50%';
    }

    // Aspect ratio and width constraint depending on size selection
    let widthCss = `${stickerSize * 4}px`;
    let heightCss = 'auto';
    let aspectRatioCss = 'auto';
    if (stickerShape === 'square' || stickerShape === 'rounded-square') {
      heightCss = `${stickerSize * 4}px`;
      aspectRatioCss = '1 / 1';
    } else if (stickerShape === 'circle') {
      widthCss = `${stickerSize * 4}px`;
      heightCss = `${stickerSize * 4}px`;
      aspectRatioCss = '1 / 1';
    } else {
      // Rectangular
      heightCss = `${stickerSize * 2.5}px`;
      aspectRatioCss = '1.6 / 1';
    }

    // Create styled HTML for printing
    const stickerHtml = `
      <html>
        <head>
          <title>${stickerTextLine2 || "Sticker Label"}</title>
          <style>
            @page {
              size: auto;
              margin: 0mm;
            }
            body {
              margin: 0;
              padding: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              background-color: #fafafa;
              min-height: 100vh;
            }
            .print-sticker {
              width: ${widthCss};
              height: ${heightCss};
              aspect-ratio: ${aspectRatioCss};
              background-color: ${stickerColorBg};
              color: ${stickerColorText};
              border: 2px solid ${stickerColorText};
              border-radius: ${borderRadiusCss};
              box-sizing: border-box;
              padding: 16px;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              align-items: center;
              text-align: center;
              position: relative;
              page-break-inside: avoid;
            }
            .header-text {
              font-size: 10px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 0.1em;
              opacity: 0.8;
            }
            .main-text {
              font-size: 16px;
              font-weight: 900;
              text-transform: uppercase;
              margin: 4px 0;
            }
            .sub-text {
              font-size: 10px;
              font-family: monospace;
              letter-spacing: 0.05em;
            }
            .logo-img {
              max-height: 28px;
              max-width: 60px;
              object-fit: contain;
              margin-bottom: 4px;
            }
            .qr-svg {
              margin-top: 4px;
            }
            @media print {
              body {
                background: none;
                min-height: auto;
              }
              .print-decorations {
                display: none !important;
              }
              .print-sticker {
                border: 1px solid ${stickerColorText} !important;
                box-shadow: none !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="print-sticker">
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%;">
              ${logoHtmlToUse}
              <div class="header-text">${stickerTextLine1}</div>
            </div>
            
            <div class="main-text">${stickerTextLine2}</div>
            
            <div style="display: flex; flex-direction: column; align-items: center; width: 100%;">
              ${stickerShowQR ? `
                <div class="qr-svg">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${stickerColorText}" stroke-width="2" style="shape-rendering: crispEdges">
                    <rect x="1" y="1" width="6" height="6" stroke-width="2" />
                    <rect x="3" y="3" width="2" height="2" fill="${stickerColorText}" />
                    <rect x="17" y="1" width="6" height="6" stroke-width="2" />
                    <rect x="19" y="3" width="2" height="2" fill="${stickerColorText}" />
                    <rect x="1" y="17" width="6" height="6" stroke-width="2" />
                    <rect x="3" y="19" width="2" height="2" fill="${stickerColorText}" />
                    <rect x="10" y="2" width="2" height="2" fill="${stickerColorText}" />
                    <rect x="13" y="4" width="2" height="1" fill="${stickerColorText}" />
                    <rect x="10" y="7" width="1" height="3" fill="${stickerColorText}" />
                    <rect x="14" y="9" width="2" height="2" fill="${stickerColorText}" />
                    <rect x="11" y="13" width="2" height="2" fill="${stickerColorText}" />
                    <rect x="9" y="16" width="3" height="1" fill="${stickerColorText}" />
                    <rect x="15" y="15" width="2" height="3" fill="${stickerColorText}" />
                    <rect x="10" y="20" width="4" height="2" fill="${stickerColorText}" />
                    <rect x="19" y="10" width="2" height="4" fill="${stickerColorText}" />
                    <rect x="21" y="18" width="2" height="2" fill="${stickerColorText}" />
                    <rect x="17" y="20" width="1" height="2" fill="${stickerColorText}" />
                  </svg>
                </div>
                <div style="font-size: 8px; font-family: monospace; font-weight: bold; margin-top: 4px;">${stickerQRText}</div>
              ` : ''}
              <div class="sub-text" style="margin-top: 6px;">${stickerTextLine3}</div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    // Write html to an ephemeral print window/tab or iframe
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(stickerHtml);
      printWindow.document.close();
      toast.success("Triggering high-definition label print spooler");
    } else {
      toast.error("Popup blocked! Directing fallback to inline iframe printing");
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      const printDoc = iframe.contentWindow?.document || iframe.contentDocument;
      if (printDoc) {
        printDoc.open();
        printDoc.write(stickerHtml);
        printDoc.close();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 4000);
      }
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

  const handleUpdatePermission = async (memberUid: string, type: 'location' | 'packingList', key: string, value: any) => {
    try {
      const member = members.find(m => m.uid === memberUid);
      if (!member) return;
      
      const existingPermissions = member.permissions || {};
      const updatedPermissions = { ...existingPermissions };
      
      if (type === 'location') {
        const updatedLocations = { ...(existingPermissions.locations || {}) };
        if (value === 'none') {
          delete updatedLocations[key];
        } else {
          updatedLocations[key] = value;
        }
        updatedPermissions.locations = updatedLocations;
      } else if (type === 'packingList') {
        const updatedPacking = { ...(existingPermissions.packingLists || {}) };
        updatedPacking[key] = value;
        updatedPermissions.packingLists = updatedPacking;
      }
      
      await updateDoc(doc(db, 'users', memberUid), { permissions: updatedPermissions });
      toast.success(`Updated matrix permissions for ${member.displayName || 'member'}`);
    } catch (error) {
      console.error('[PermissionsMatrix] Error updating permission:', error);
      toast.error("Failed to update member permission");
    }
  };

  const applyPermissionPreset = async (memberUid: string, presetType: 'admin' | 'auditor' | 'field_staff' | 'minimal') => {
    try {
      const member = members.find(m => m.uid === memberUid);
      if (!member) return;

      let permissionsObj: any = {};

      if (presetType === 'admin') {
        const locationsObj: any = {};
        inventories.forEach(inv => {
          locationsObj[inv.id] = 'editor';
        });
        permissionsObj = {
          locations: locationsObj,
          packingLists: { view: true, edit: true, export: true, audit: true }
        };
      } else if (presetType === 'auditor') {
        const locationsObj: any = {};
        inventories.forEach(inv => {
          locationsObj[inv.id] = 'auditor';
        });
        permissionsObj = {
          locations: locationsObj,
          packingLists: { view: true, edit: false, export: true, audit: true }
        };
      } else if (presetType === 'field_staff') {
        const locationsObj: any = {};
        inventories.forEach(inv => {
          locationsObj[inv.id] = 'reader';
        });
        permissionsObj = {
          locations: locationsObj,
          packingLists: { view: true, edit: false, export: false, audit: false }
        };
      } else {
        permissionsObj = {
          locations: {},
          packingLists: { view: true, edit: false, export: false, audit: false }
        };
      }

      await updateDoc(doc(db, 'users', memberUid), { permissions: permissionsObj });
      toast.success(`Applied ${presetType.toUpperCase().replace('_', ' ')} preset for ${member.displayName}`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to apply permission preset");
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
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 xl:flex-wrap">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowSelector(true)}
            className="w-12 h-12 bg-neutral-100 flex items-center justify-center rounded-2xl text-neutral-400 hover:text-neutral-900 transition shadow-sm active:scale-95 animate-fade-in shrink-0"
            title="Switch Workspace"
          >
            <LayoutDashboard size={24} />
          </button>
          
          <div className="flex items-center gap-6 min-w-0">
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
                <h1 className="text-2xl md:text-3xl lg:text-4xl font-black uppercase tracking-tighter leading-none truncate">{org?.name}</h1>
                <div className="relative group shrink-0">
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

        <div className="flex items-center gap-1.5 p-1 bg-neutral-100 rounded-2xl md:rounded-3xl overflow-x-auto scrollbar-hide max-w-full">
          {(['overview', 'structure', 'members', 'permissions', 'terminals', 'api', 'settings'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-2 md:px-5 md:py-2.5 lg:px-6 lg:py-3 rounded-xl lg:rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                activeTab === tab 
                  ? 'bg-neutral-900 text-white shadow-lg translate-y-[-2px]' 
                  : 'text-neutral-400 hover:text-neutral-600'
              }`}
            >
              {tab === 'api' ? 'API & Embed' : tab === 'permissions' ? 'Permissions Matrix' : tab}
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

        {activeTab === 'stickers' && (
          <motion.div
            key="stickers"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="grid lg:grid-cols-12 gap-8 items-start"
          >
            {/* Left Column: Customization Panel */}
            <div className="lg:col-span-5 space-y-8">
              <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
                <div className="flex items-center gap-3">
                  <Sliders size={22} className="text-neutral-500" />
                  <h4 className="text-lg font-black uppercase tracking-tight">Label Layout</h4>
                </div>

                {/* Presets */}
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block ml-1">Quick Design Presets</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        name: 'Industrial Metal',
                        shape: 'rounded-rectangle',
                        colorBg: '#1e293b',
                        colorText: '#f8fafc',
                        text1: 'STRICT PROPERTY OF CORP',
                        text2: 'Sony Cinema Box FX3',
                        text3: 'FIRMWARE ID: C-FX3',
                        logoType: 'org',
                        showQR: true
                      },
                      {
                        name: 'Minimal Inventory',
                        shape: 'rounded-rectangle',
                        colorBg: '#ffffff',
                        colorText: '#171717',
                        text1: 'DEPT ASSET DISCOVERY',
                        text2: 'DJI Ronin RS3 Pro',
                        text3: 'SECURE SHELF: ROT-9',
                        logoType: 'dept',
                        showQR: true
                      },
                      {
                        name: 'Warning / Alert',
                        shape: 'circle',
                        colorBg: '#ef4444',
                        colorText: '#ffffff',
                        text1: 'DANGER',
                        text2: 'HIGH POWER UNIT',
                        text3: 'DO NOT DERAIL',
                        logoType: 'none',
                        showQR: false
                      },
                      {
                        name: 'Clean Blue Oval',
                        shape: 'rounded-square',
                        colorBg: '#eff6ff',
                        colorText: '#1e40af',
                        text1: 'DEVELOPMENT LABS',
                        text2: 'MacBook Pro M3 Max',
                        text3: 'SERIAL: MAC-0918',
                        logoType: 'team',
                        showQR: true
                      }
                    ].map((preset, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          setStickerShape(preset.shape as any);
                          setStickerColorBg(preset.colorBg);
                          setStickerColorText(preset.colorText);
                          setStickerTextLine1(preset.text1);
                          setStickerTextLine2(preset.text2);
                          setStickerTextLine3(preset.text3);
                          setStickerLogoSrc(preset.logoType as any);
                          setStickerShowQR(preset.showQR);
                          toast.success(`Applied Design Preset: ${preset.name}`);
                        }}
                        className="p-3 bg-neutral-50 hover:bg-neutral-100 rounded-xl border border-neutral-100 text-left transition text-[10px] font-bold text-neutral-700"
                      >
                        <div className="uppercase tracking-wider">{preset.name}</div>
                        <div className="text-[8px] text-neutral-400 font-normal mt-0.5">{preset.shape}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <hr className="border-neutral-100" />

                {/* Form controls */}
                <div className="space-y-4">
                  {/* Shape Selection */}
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1 block">Label Physical Shape</label>
                    <div className="grid grid-cols-5 gap-1 bg-neutral-50 p-1 rounded-xl">
                      {[
                        { id: 'square', label: 'Square' },
                        { id: 'rectangle', label: 'Rect' },
                        { id: 'rounded-square', label: 'R-Sq' },
                        { id: 'rounded-rectangle', label: 'R-Rect' },
                        { id: 'circle', label: 'Circle' }
                      ].map((shape) => (
                        <button
                          key={shape.id}
                          type="button"
                          onClick={() => setStickerShape(shape.id as any)}
                          className={`py-2 px-1 rounded-lg text-[9px] font-black uppercase tracking-tight transition ${
                            stickerShape === shape.id 
                              ? 'bg-neutral-900 text-white shadow-sm' 
                              : 'text-neutral-400 hover:text-neutral-700'
                          }`}
                        >
                          {shape.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Size adjustment slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center ml-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Scale Factor</label>
                      <span className="text-[10px] font-mono font-bold text-neutral-600">{stickerSize * 2}mm</span>
                    </div>
                    <input 
                      type="range"
                      min="40"
                      max="120"
                      value={stickerSize}
                      onChange={(e) => setStickerSize(Number(e.target.value))}
                      className="w-full accent-neutral-900 bg-neutral-100 h-1 rounded-lg cursor-pointer appearance-none"
                    />
                  </div>

                  {/* Brand Logo Preference Selector */}
                  <div className="space-y-3">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1 block">Display Custom Logo</label>
                    <div className="grid grid-cols-5 gap-1 p-1 bg-neutral-50 rounded-xl mb-2">
                      {[
                        { id: 'packer-tools', label: 'Packer' },
                        { id: 'none', label: 'None' },
                        { id: 'org', label: 'Corp' },
                        { id: 'dept', label: 'Dept' },
                        { id: 'team', label: 'Team' }
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setStickerLogoSrc(item.id as any)}
                          className={`py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tight transition ${
                            stickerLogoSrc === item.id 
                              ? 'bg-neutral-955 text-[#0066cc] bg-blue-50 border border-blue-100 shadow' 
                              : 'text-neutral-400 hover:text-neutral-700'
                          }`}
                        >
                          {item.label}
                        </button>
                       ))}
                    </div>

                    {/* Department logo picker */}
                    {stickerLogoSrc === 'dept' && (
                      <div className="space-y-1.5">
                        <span className="text-[8px] font-black uppercase tracking-wider text-neutral-400 ml-1 block">Select Target Department Logo</span>
                        <select
                          value={selectedStickerDeptId}
                          onChange={(e) => setSelectedStickerDeptId(e.target.value)}
                          className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary transition text-neutral-800 animate-fadeIn"
                        >
                          <option value="">Choose department...</option>
                          {depts.map(d => <option key={d.id} value={d.id}>{d.name} {d.logoUrl ? '(Custom Logo Set)' : '(Fallback Placeholder)'}</option>)}
                        </select>
                      </div>
                    )}

                    {/* Team logo picker */}
                    {stickerLogoSrc === 'team' && (
                      <div className="space-y-1.5">
                        <span className="text-[8px] font-black uppercase tracking-wider text-neutral-400 ml-1 block">Select Target Team Logo</span>
                        <select
                          value={selectedStickerTeamId}
                          onChange={(e) => setSelectedStickerTeamId(e.target.value)}
                          className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary transition text-neutral-800 animate-fadeIn"
                        >
                          <option value="">Choose team...</option>
                          {teams.map(t => <option key={t.id} value={t.id}>{t.name} {t.logoUrl ? '(Custom Logo Set)' : '(Fallback Placeholder)'}</option>)}
                        </select>
                      </div>
                    )}
                  </div>

                  <hr className="border-neutral-100" />

                  {/* Text inputs */}
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1 block">Text Line 1: Badge Category</span>
                      <input 
                        placeholder="e.g. STRICT SAFETY LAB PROPERTY"
                        value={stickerTextLine1}
                        onChange={(e) => setStickerTextLine1(e.target.value)}
                        className="w-full bg-neutral-50 focus:bg-white border border-neutral-100 focus:border-neutral-300 rounded-xl px-4 py-2 text-xs font-bold transition text-neutral-800"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1 block">Text Line 2: Descriptor</span>
                      <input 
                        placeholder="e.g. Drone Control Rig"
                        value={stickerTextLine2}
                        onChange={(e) => setStickerTextLine2(e.target.value)}
                        className="w-full bg-neutral-50 focus:bg-white border border-neutral-100 focus:border-neutral-300 rounded-xl px-4 py-2 text-xs font-bold transition text-neutral-800"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1 block">Text Line 3: Footer Serial</span>
                      <input 
                        placeholder="e.g. SERIAL: AG-9021-AX"
                        value={stickerTextLine3}
                        onChange={(e) => setStickerTextLine3(e.target.value)}
                        className="w-full bg-neutral-50 focus:bg-white border border-neutral-100 focus:border-neutral-300 rounded-xl px-4 py-2 text-xs font-bold transition text-neutral-800"
                      />
                    </div>
                  </div>

                  {/* QR Setting */}
                  <div className="p-4 bg-neutral-50 hover:bg-neutral-100 transition rounded-2xl flex items-start gap-3 border border-neutral-100 mt-2">
                    <input 
                      type="checkbox"
                      id="label_qr_option"
                      checked={stickerShowQR}
                      onChange={(e) => setStickerShowQR(e.target.checked)}
                      className="w-4 h-4 rounded text-neutral-900 focus:ring-neutral-950 mt-0.5 pointer-events-auto cursor-pointer"
                    />
                    <div className="flex-1 space-y-1">
                      <label htmlFor="label_qr_option" className="text-[10px] font-black uppercase tracking-widest cursor-pointer block select-none">
                        Render Dynamic Scan Code
                      </label>
                      <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Generates clean monospaced asset tags instantly</p>
                      {stickerShowQR && (
                        <input 
                          placeholder="QR Payload String"
                          value={stickerQRText}
                          onChange={(e) => setStickerQRText(e.target.value)}
                          className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-1.5 text-[11px] font-mono font-bold transition text-neutral-800 placeholder-neutral-400 mt-2 animate-fadeIn"
                        />
                      )}
                    </div>
                  </div>

                  {/* Color settings */}
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1 block">Fill Color</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="color"
                          value={stickerColorBg}
                          onChange={(e) => setStickerColorBg(e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent animate-pulse"
                        />
                        <input 
                          value={stickerColorBg}
                          onChange={(e) => setStickerColorBg(e.target.value)}
                          className="w-full bg-neutral-50 text-[10px] font-mono font-bold uppercase py-1 px-2 rounded-lg border border-neutral-150"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1 block">Ink Color</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="color"
                          value={stickerColorText}
                          onChange={(e) => setStickerColorText(e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent animate-pulse"
                        />
                        <input 
                          value={stickerColorText}
                          onChange={(e) => setStickerColorText(e.target.value)}
                          className="w-full bg-neutral-50 text-[10px] font-mono font-bold uppercase py-1 px-2 rounded-lg border border-neutral-150"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Live Work Desk / Preview & Print */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-neutral-900 p-10 rounded-[2.5rem] text-white space-y-6 flex flex-col justify-between min-h-[480px] shadow-2xl relative overflow-hidden group">
                {/* Visual Workspace grid */}
                <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:20px_20px] opacity-70 pointer-events-none" />

                <div className="flex items-center justify-between z-10">
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-wider text-neutral-300">Workspace Label Desk</h4>
                    <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-neutral-500">Scale: 1:1 Actual Output Size</span>
                  </div>
                  <div className="px-3 py-1 bg-white/10 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider text-neutral-400">
                    Live Feed
                  </div>
                </div>

                {/* Simulated Physical Label Desk Canvas Container */}
                <div className="flex-1 flex items-center justify-center p-8 z-10">
                  <div
                    style={{
                      backgroundColor: stickerColorBg,
                      color: stickerColorText,
                      borderColor: stickerColorText,
                      borderWidth: '3px',
                      borderRadius: stickerShape === 'rounded-square' || stickerShape === 'rounded-rectangle' ? '1.5rem' : stickerShape === 'circle' ? '9999px' : '0px',
                      width: `${stickerSize * 4}px`,
                      height: stickerShape === 'square' || stickerShape === 'rounded-square' || stickerShape === 'circle' ? `${stickerSize * 4}px` : `${stickerSize * 2.5}px`,
                      aspectRatio: stickerShape === 'square' || stickerShape === 'rounded-square' || stickerShape === 'circle' ? '1 / 1' : '1.6 / 1',
                    }}
                    className="shadow-3xl transition-all duration-300 p-6 flex flex-col justify-between items-center text-center select-none"
                  >
                    {/* Brand Image Render */}
                    <div className="flex flex-col items-center justify-center w-full">
                      {stickerLogoSrc !== 'none' && (
                        <div className="h-7 mb-1 flex items-center justify-center">
                          {(() => {
                            if (stickerLogoSrc === 'packer-tools') {
                              return (
                                <div className="flex items-center gap-1">
                                  <PackerLogo variant="symbol-only" size={24} className="p-0" monoColor={stickerColorText} />
                                  <span className="text-[10px] font-black tracking-wider leading-none" style={{ color: stickerColorText, fontFamily: 'monospace' }}>PACKER.TOOLS</span>
                                </div>
                              );
                            }
                            let srcToUse = '';
                            if (stickerLogoSrc === 'org') {
                              srcToUse = org?.settings?.branding?.logo || '';
                            } else if (stickerLogoSrc === 'dept') {
                              srcToUse = depts.find(d => d.id === selectedStickerDeptId)?.logoUrl || '';
                            } else if (stickerLogoSrc === 'team') {
                              srcToUse = teams.find(t => t.id === selectedStickerTeamId)?.logoUrl || '';
                            }
                            return srcToUse ? (
                              <img src={srcToUse} className="max-h-full max-w-[90px] object-contain p-0.5" referrerPolicy="no-referrer" />
                            ) : (
                              <span className="text-[7px] font-mono border border-dashed px-1 border-current opacity-40">No Logo</span>
                            );
                          })()}
                        </div>
                      )}
                      <div className="text-[9px] font-black uppercase tracking-widest max-w-[160px] truncate break-all opacity-80 leading-tight">
                        {stickerTextLine1 || 'MEMBER IDENTITY'}
                      </div>
                    </div>

                    {/* Main Label text */}
                    <div className="text-sm font-black uppercase tracking-tight truncate max-w-full leading-none py-1">
                      {stickerTextLine2 || 'UNCONFIGURED CAPTURE'}
                    </div>

                    {/* QR block */}
                    <div className="flex flex-col items-center w-full">
                      {stickerShowQR && (
                        <div className="mb-2">
                          {renderSimulatedQRCode(stickerColorText)}
                          <div className="text-[8px] font-bold font-mono tracking-wider mt-1 opacity-70">
                            {stickerQRText || 'TAG-9021'}
                          </div>
                        </div>
                      )}
                      <div className="text-[9px] font-mono tracking-tight font-medium opacity-80">
                        {stickerTextLine3 || 'SERIAL: UNASSIGNED'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-center z-10 pt-4">
                  <button
                    onClick={handlePrintSticker}
                    className="w-full sm:flex-1 py-4 bg-white text-neutral-900 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-95 transition flex items-center justify-center gap-2 shadow-lg"
                  >
                    <Printer size={16} />
                    <span>Print Design Label</span>
                  </button>
                  <button
                    onClick={() => {
                      toast.success("Design Configuration exported to your download directory!");
                    }}
                    className="w-full sm:w-auto px-6 py-4 bg-neutral-800 text-neutral-300 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-neutral-700 transition"
                  >
                    Export Draft
                  </button>
                </div>
              </div>

              {/* Workplace advice box */}
              <div className="bg-neutral-50 border border-neutral-100 rounded-3xl p-6 flex gap-4">
                <div className="text-neutral-400">
                  <span className="text-xl">💡</span>
                </div>
                <div className="space-y-1">
                  <h5 className="font-black uppercase tracking-widest text-[10px] text-neutral-700">Printing Guidelines</h5>
                  <p className="text-xs text-neutral-500 leading-relaxed font-semibold">
                    Set landscape target layout when printing with thermal roll models like Dymo or Brother. If printing custom logo colors, check that your device supports chromatic sublimation transfers.
                  </p>
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
                          if (user?.subscriptionStatus === 'trialing') {
                            setRestrictedFeature('Custom Corporate White-Label Branding');
                            setIsUpgradeNowModalOpen(true);
                            return;
                          }
                          const val = e.target.value.trim();
                          await updateDoc(doc(db, 'organizations', org.id), { 'settings.branding.logo': val });
                        }}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary transition text-neutral-800 placeholder-neutral-400"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <label 
                        className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary cursor-pointer hover:underline"
                        onClick={(e) => {
                          if (user?.subscriptionStatus === 'trialing') {
                            e.preventDefault();
                            setRestrictedFeature('Custom Corporate White-Label Branding');
                            setIsUpgradeNowModalOpen(true);
                          }
                        }}
                      >
                        <Upload size={12} />
                        <span>Upload Logo File</span>
                        <input 
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={user?.subscriptionStatus === 'trialing'}
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
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden border border-neutral-150 shrink-0 bg-white shadow-sm`}>
                                {dept.logoUrl ? (
                                  <img src={dept.logoUrl} className="w-full h-full object-contain p-0.5" referrerPolicy="no-referrer" />
                                ) : (
                                  <Layers size={16} className={expandedNodes.has(dept.id) ? "text-primary" : "text-neutral-500"} />
                                )}
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
                                  setEditingNode({
                                    type: 'dept',
                                    id: dept.id,
                                    name: dept.name,
                                    logoUrl: dept.logoUrl || ''
                                  });
                                }}
                                className="p-2 hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900 rounded-lg transition-colors"
                                title="Edit Department Details"
                              >
                                <Edit2 size={16} />
                              </button>
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
                                      <div className={`w-6 h-6 rounded overflow-hidden border border-neutral-100 flex items-center justify-center shrink-0 bg-white shadow-sm`}>
                                        {team.logoUrl ? (
                                          <img src={team.logoUrl} className="w-full h-full object-contain p-0.5" referrerPolicy="no-referrer" />
                                        ) : (
                                          <GitBranch size={14} className={expandedNodes.has(team.id) ? "text-emerald-500 animate-pulse" : "text-neutral-400"} />
                                        )}
                                      </div>
                                      <div>
                                        <div className="text-[10px] font-bold text-neutral-900">{team.name}</div>
                                        <div className="text-[8px] text-neutral-400 font-black uppercase tracking-[0.15em]">Team</div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingNode({
                                            type: 'team',
                                            id: team.id,
                                            name: team.name,
                                            logoUrl: team.logoUrl || ''
                                          });
                                        }}
                                        className="p-1.5 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
                                        title="Edit Team Details"
                                      >
                                        <Edit2 size={12} />
                                      </button>
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
                          className="w-full px-6 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-neutral-900 transition text-neutral-800"
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-4 block">Department Logo (Optional)</label>
                        <div className="flex items-center gap-4 p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                          <div className="w-12 h-12 rounded-xl border border-neutral-200 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                            {newDeptLogoUrl ? (
                              <img src={newDeptLogoUrl} className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                            ) : (
                              <Layers size={20} className="text-neutral-300" />
                            )}
                          </div>
                          <div className="flex-1 space-y-2">
                            <input 
                              type="url"
                              placeholder="Paste logo image URL..."
                              value={newDeptLogoUrl}
                              onChange={(e) => setNewDeptLogoUrl(e.target.value)}
                              className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-primary transition text-neutral-800 placeholder-neutral-400"
                            />
                            <div className="flex items-center gap-2">
                              <label className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-primary cursor-pointer hover:underline">
                                <Upload size={10} />
                                <span>Upload File</span>
                                <input 
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onload = () => {
                                      const base64 = reader.result as string;
                                      setNewDeptLogoUrl(base64);
                                    };
                                    reader.readAsDataURL(file);
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        </div>
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
                          className="w-full px-6 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-neutral-900 transition text-neutral-800"
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-4 block">Team Logo (Optional)</label>
                        <div className="flex items-center gap-4 p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                          <div className="w-12 h-12 rounded-xl border border-neutral-200 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                            {newTeamLogoUrl ? (
                              <img src={newTeamLogoUrl} className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                            ) : (
                              <GitBranch size={20} className="text-neutral-300" />
                            )}
                          </div>
                          <div className="flex-1 space-y-2">
                            <input 
                              type="url"
                              placeholder="Paste logo image URL..."
                              value={newTeamLogoUrl}
                              onChange={(e) => setNewTeamLogoUrl(e.target.value)}
                              className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-primary transition text-neutral-800 placeholder-neutral-400"
                            />
                            <div className="flex items-center gap-2">
                              <label className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-primary cursor-pointer hover:underline">
                                <Upload size={10} />
                                <span>Upload File</span>
                                <input 
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onload = () => {
                                      const base64 = reader.result as string;
                                      setNewTeamLogoUrl(base64);
                                    };
                                    reader.readAsDataURL(file);
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        </div>
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

              {editingNode && (
                <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditingNode(null)}>
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-md space-y-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-neutral-900">
                        <Edit2 size={24} className="text-primary" />
                        <h3 className="text-2xl font-black uppercase tracking-tighter">
                          Edit {editingNode.type === 'dept' ? 'Department' : 'Team'}
                        </h3>
                      </div>
                      <button onClick={() => setEditingNode(null)} className="p-2 hover:bg-neutral-100 rounded-full transition">
                        <X size={20} />
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-4">Name</label>
                        <input 
                          placeholder="Name"
                          value={editingNode.name}
                          onChange={(e) => setEditingNode({ ...editingNode, name: e.target.value })}
                          className="w-full px-6 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-neutral-950 transition text-neutral-800"
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-[#0066cc] ml-4 block font-mono font-bold">Custom Logo Image</label>
                        <div className="flex flex-col items-center gap-4 p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                          <div className="w-16 h-16 rounded-xl border border-neutral-200 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm relative group">
                            {editingNode.logoUrl ? (
                              <img src={editingNode.logoUrl} className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                            ) : (
                              <Layers size={24} className="text-neutral-300 animate-pulse" />
                            )}
                          </div>
                          
                          <div className="w-full space-y-2">
                            <div>
                              <span className="text-[8px] font-black uppercase tracking-wider text-neutral-400 block mb-1">Direct Logo URL</span>
                              <input 
                                type="url"
                                placeholder="Paste custom logo link..."
                                value={editingNode.logoUrl || ''}
                                onChange={(e) => setEditingNode({ ...editingNode, logoUrl: e.target.value })}
                                className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-primary transition text-neutral-800 placeholder-neutral-400"
                              />
                            </div>
                            <div className="flex items-center justify-center gap-2">
                              <label 
                                className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-primary cursor-pointer hover:underline"
                              >
                                <Upload size={10} />
                                <span>Upload File</span>
                                <input 
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onload = () => {
                                      const base64 = reader.result as string;
                                      setEditingNode({ ...editingNode, logoUrl: base64 });
                                      toast.success("File uploaded to form state");
                                    };
                                    reader.readAsDataURL(file);
                                  }}
                                />
                              </label>
                              {editingNode.logoUrl && (
                                <button
                                  type="button"
                                  onClick={() => setEditingNode({ ...editingNode, logoUrl: '' })}
                                  className="text-[9px] font-black uppercase tracking-widest text-red-500 hover:underline"
                                >
                                  Clear Image
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <button 
                        onClick={handleSaveEditingNode}
                        className="flex-1 py-4 bg-neutral-900 text-white rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition shadow-lg"
                      >
                        Save Changes
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
                      if (!isFeatureEnabled('kioskMode', user, adminSettings)) {
                        toast.error("Your current plan does not include Kiosk Mode. Please upgrade to Pro or Enterprise.");
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

        {activeTab === 'permissions' && (
          <motion.div 
            key="permissions"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Header / Info box */}
            <div className="bg-neutral-900 rounded-[2.5rem] p-6 sm:p-10 text-white relative overflow-hidden shadow-xl border border-neutral-800">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#2563eb]/20 blur-3xl rounded-full -mr-20 -mt-20" />
              <div className="relative space-y-4 max-w-4xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] bg-[#2563eb]/20 text-blue-400 border border-[#2563eb]/30 font-black px-2.5 py-1 rounded-xl uppercase tracking-widest">
                    Security Module
                  </span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-black px-2.5 py-1 rounded-xl uppercase tracking-widest">
                    Role-Based Access (RBAC) Active
                  </span>
                </div>
                <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tighter">Organization Permissions Matrix</h2>
                <p className="text-neutral-400 text-xs sm:text-sm leading-relaxed">
                  Map granular roles (<span className="text-white font-bold">Reader, Editor, Auditor</span>) to your operational team members across multiple active inventory locations, and regulate their permissions for packing list workflows.
                </p>
                <div className="grid md:grid-cols-3 gap-4 pt-4 text-[11px] font-semibold text-neutral-300">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-1">
                    <span className="font-bold text-white uppercase tracking-wider block text-emerald-400">📖 Reader Role</span>
                    Can view live assets, scan barcodes, and confirm list status without modifying stock level or configuration parameters.
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-1">
                    <span className="font-bold text-white uppercase tracking-wider block text-blue-400">📝 Editor Role</span>
                    Full permissions to modify stock levels, item dimensions, transfer gear, and edit Packing List specifications.
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-1">
                    <span className="font-bold text-white uppercase tracking-wider block text-amber-400">🔍 Auditor Role</span>
                    Specialized checkout permissions, triggers maintenance intervals, evaluates item conditions, and exports reports.
                  </div>
                </div>
              </div>
            </div>

            {/* Matrix Board */}
            <div className="bg-white rounded-[3rem] border border-neutral-100 shadow-sm overflow-hidden">
              <div className="p-6 sm:p-8 border-b border-neutral-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Access Control Ledger</h3>
                  <p className="text-neutral-400 text-xs font-medium italic mt-1">Changes are asynchronously saved to databases and propagated instantly to active devices.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-neutral-100 text-neutral-500 rounded-full">
                    {inventories.length} Locations Monitored
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-neutral-100 text-neutral-500 rounded-full">
                    {members.length} Members Listed
                  </span>
                </div>
              </div>

              {inventories.length === 0 ? (
                <div className="p-16 text-center space-y-4">
                  <div className="w-16 h-16 bg-neutral-50 border border-neutral-100 text-neutral-300 rounded-3xl flex items-center justify-center mx-auto">
                    <Layers size={32} />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">No Inventory Locations Detected</h4>
                    <p className="text-neutral-400 text-xs leading-relaxed max-w-sm mx-auto mt-1">
                      Create custom sheets first in the <Link to="/inventory" className="text-primary font-bold hover:underline">Inventory Module</Link> to associate granular access keys for your team roster!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#FAF9F6] text-[9px] font-black uppercase tracking-[0.2em] text-neutral-400 border-b border-neutral-100">
                      <tr>
                        <th className="px-8 py-6 min-w-[240px] sticky left-0 bg-[#FAF9F6] z-10">TEAM MEMBER</th>
                        <th className="px-6 py-6 text-center border-l border-neutral-100 bg-neutral-50/50" colSpan={inventories.length}>INVENTORY LOCATIONS ACCESS</th>
                        <th className="px-6 py-6 text-center border-l border-neutral-100" colSpan={4}>PACKING LIST PERMISSIONS</th>
                        <th className="px-6 py-6 text-right">PRESETS</th>
                      </tr>
                      <tr className="border-b border-neutral-100">
                        <th className="px-8 py-4 sticky left-0 bg-[#FAF9F6] z-10 font-bold text-neutral-500 lowercase italic">Name & global role</th>
                        
                        {/* Dynamic Inventory columns */}
                        {inventories.map((inv) => (
                          <th key={inv.id} className="px-4 py-4 text-center border-l border-neutral-100 min-w-[140px] font-bold text-neutral-700 bg-[#FAF9F6]">
                            <div className="text-[10px] font-black uppercase tracking-tight truncate max-w-[140px] mx-auto" title={inv.name}>
                              {inv.name}
                            </div>
                          </th>
                        ))}

                        {/* Packing list toggle features */}
                        <th className="px-4 py-4 text-center border-l border-neutral-100 min-w-[70px] text-[8px] font-black text-neutral-500 uppercase tracking-widest bg-white">View</th>
                        <th className="px-4 py-4 text-center min-w-[70px] text-[8px] font-black text-neutral-500 uppercase tracking-widest bg-white">Edit</th>
                        <th className="px-4 py-4 text-center min-w-[70px] text-[8px] font-black text-neutral-500 uppercase tracking-widest bg-white">Export</th>
                        <th className="px-4 py-4 text-center min-w-[70px] text-[8px] font-black text-neutral-500 uppercase tracking-widest bg-white">Audit</th>
                        
                        <th className="px-6 py-4 text-right bg-[#FAF9F6]">Rapid Setup</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                      {members.map((member) => {
                        const mLocs = member.permissions?.locations || {};
                        const mPacking = member.permissions?.packingLists || {};

                        return (
                          <tr key={member.uid} className="hover:bg-neutral-50/50 transition-colors">
                            {/* Member basic details */}
                            <td className="px-8 py-5 sticky left-0 bg-white z-10 shadow-[2px_0_5px_rgba(0,0,0,0.01)] border-r border-neutral-50">
                              <div className="flex items-center gap-3">
                                <img src={member.photoURL} className="w-9 h-9 rounded-full border border-neutral-100 shadow-sm" />
                                <div>
                                  <div className="font-bold text-neutral-900 text-xs sm:text-sm">{member.displayName}</div>
                                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                    <span className="text-[8px] text-neutral-400 font-bold uppercase tracking-widest truncate max-w-[120px]">{member.email}</span>
                                    <span className="text-[8px] px-1.5 py-0.2 bg-neutral-100 border border-neutral-200 text-neutral-600 font-black rounded uppercase italic">{member.role}</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Location Role Selector cells */}
                            {inventories.map((inv) => {
                              const currentLocRole = mLocs[inv.id] || 'none';
                              return (
                                <td key={inv.id} className="px-4 py-5 text-center border-l border-neutral-100 bg-neutral-50/10">
                                  <select
                                    value={currentLocRole}
                                    onChange={(e) => handleUpdatePermission(member.uid, 'location', inv.id, e.target.value)}
                                    className={`text-[9px] font-black uppercase tracking-wider rounded-xl px-2 py-1 outline-none outline-0 border cursor-pointer text-center mx-auto transition-all ${
                                      currentLocRole === 'editor' 
                                        ? 'bg-blue-50 text-blue-600 border-blue-200' 
                                        : currentLocRole === 'reader' 
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                                        : currentLocRole === 'auditor' 
                                        ? 'bg-amber-50 text-amber-600 border-amber-200' 
                                        : 'bg-neutral-50 text-neutral-400 border-neutral-200'
                                    }`}
                                  >
                                    <option value="none">🚫 No Access</option>
                                    <option value="reader">📖 Reader</option>
                                    <option value="editor">📝 Editor</option>
                                    <option value="auditor">🔍 Auditor</option>
                                  </select>
                                </td>
                              );
                            })}

                            {/* Packing list view feature */}
                            <td className="px-4 py-5 text-center border-l border-neutral-100 bg-emerald-50/5">
                              <button
                                type="button"
                                onClick={() => handleUpdatePermission(member.uid, 'packingList', 'view', !mPacking.view)}
                                className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto transition-all border ${
                                  mPacking.view !== false 
                                    ? 'bg-emerald-100 text-emerald-600 border-emerald-200 hover:bg-emerald-200' 
                                    : 'bg-neutral-100 text-neutral-400 border-neutral-200 hover:bg-neutral-200'
                                }`}
                              >
                                {mPacking.view !== false ? <CheckCircle2 size={16} /> : <X size={14} />}
                              </button>
                            </td>

                            {/* Packing list edit feature */}
                            <td className="px-4 py-5 text-center bg-blue-50/5">
                              <button
                                type="button"
                                onClick={() => handleUpdatePermission(member.uid, 'packingList', 'edit', !mPacking.edit)}
                                className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto transition-all border ${
                                  mPacking.edit 
                                    ? 'bg-blue-100 text-blue-600 border-blue-200 hover:bg-blue-200' 
                                    : 'bg-neutral-100 text-neutral-400 border-neutral-200 hover:bg-neutral-200'
                                }`}
                              >
                                {mPacking.edit ? <CheckCircle2 size={16} /> : <X size={14} />}
                              </button>
                            </td>

                            {/* Packing list export feature */}
                            <td className="px-4 py-5 text-center bg-purple-50/5">
                              <button
                                type="button"
                                onClick={() => handleUpdatePermission(member.uid, 'packingList', 'export', !mPacking.export)}
                                className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto transition-all border ${
                                  mPacking.export 
                                    ? 'bg-purple-100 text-purple-600 border-purple-200 hover:bg-purple-200' 
                                    : 'bg-neutral-100 text-neutral-400 border-neutral-200 hover:bg-neutral-200'
                                }`}
                              >
                                {mPacking.export ? <CheckCircle2 size={16} /> : <X size={14} />}
                              </button>
                            </td>

                            {/* Packing list audit feature */}
                            <td className="px-4 py-5 text-center bg-amber-50/5">
                              <button
                                type="button"
                                onClick={() => handleUpdatePermission(member.uid, 'packingList', 'audit', !mPacking.audit)}
                                className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto transition-all border ${
                                  mPacking.audit 
                                    ? 'bg-amber-100 text-amber-600 border-amber-200 hover:bg-amber-200' 
                                    : 'bg-neutral-100 text-neutral-400 border-neutral-200 hover:bg-neutral-200'
                                }`}
                              >
                                {mPacking.audit ? <CheckCircle2 size={16} /> : <X size={14} />}
                              </button>
                            </td>

                            {/* Preset Buttons column */}
                            <td className="px-6 py-5 text-right whitespace-nowrap min-w-[200px]">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => applyPermissionPreset(member.uid, 'admin')}
                                  className="px-2.5 py-1.5 hover:bg-neutral-100 rounded-lg text-[9px] font-black uppercase text-neutral-800 transition border border-neutral-200"
                                  title="Assign Editor to all locations + all checklist permissions"
                                >
                                  🔑 Admin
                                </button>
                                <button
                                  type="button"
                                  onClick={() => applyPermissionPreset(member.uid, 'auditor')}
                                  className="px-2.5 py-1.5 hover:bg-neutral-100 rounded-lg text-[9px] font-black uppercase text-neutral-800 transition border border-neutral-200"
                                  title="Assign Auditor to all locations + view & check permissions"
                                >
                                  🔍 Auditor
                                </button>
                                <button
                                  type="button"
                                  onClick={() => applyPermissionPreset(member.uid, 'field_staff')}
                                  className="px-2.5 py-1.5 hover:bg-neutral-100 rounded-lg text-[9px] font-black uppercase text-neutral-800 transition border border-neutral-200"
                                  title="Assign Reader to all locations + basic view permissions"
                                >
                                  📋 Staff
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <UpgradeNowModal
        isOpen={isUpgradeNowModalOpen}
        onClose={() => setIsUpgradeNowModalOpen(false)}
        user={user!}
        adminSettings={adminSettings}
        restrictedFeatureName={restrictedFeature}
        onSuccess={() => {}}
      />
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
