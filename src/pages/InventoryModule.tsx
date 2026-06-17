import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, 
  Cpu,
  Search, 
  Filter, 
  Building2, 
  Layers, 
  GitBranch, 
  User, 
  Plus, 
  X, 
  Check, 
  ChevronRight, 
  MoreVertical,
  ArrowRight,
  TrendingUp,
  LayoutGrid,
  List as ListIcon,
  Tag,
  Shield,
  Zap,
  Info,
  ChevronLeft,
  Trash2,
  FileSpreadsheet,
  Globe,
  Database,
  AlertCircle,
  ShieldAlert,
  Sparkles,
  Upload,
  Download,
  Edit2,
  FileText,
  RefreshCw
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  writeBatch, 
  getDocs, 
  orderBy, 
  collectionGroup,
  addDoc,
  deleteDoc,
  setDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, GearItem, Organization, Department, Team, AdminSettings } from '../types';
import { toast } from 'sonner';
import PhysicalLocationMap from '../components/PhysicalLocationMap';
import { offlineSync, OfflineOperation } from '../services/offlineSync';
import { isFeatureEnabled } from '../lib/featureUtils';
import * as PAPA from 'papaparse';
import * as XLSX from 'xlsx';
import { authenticatedFetch } from '../lib/api';

interface InventoryModuleProps {
  user: UserProfile | null;
  adminSettings: AdminSettings | null;
}

export interface CustomInventory {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  ownerEmail?: string;
  visibility: {
    orgIds: string[];
    deptIds: string[];
    teamIds: string[];
  };
  collaborators?: { email: string; role: 'editor' | 'viewer' }[];
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  description?: string;
  brand?: string;
  model?: string;
  modelNumber?: string;
  serialNumber?: string;
  primaryCategory: string;
  weight?: number;
  weightUnit?: string;
  price?: number;
  condition: 'new' | 'good' | 'fair' | 'poor';
  quantity: number;
  status: 'available' | 'in_use' | 'maintenance' | 'retired' | 'missing';
  assetTag: string;
  photoUrls?: string[];
  lastMaintenanceDate?: string;
  maintenanceIntervalDays?: number;
  orgId?: string;
  deptId?: string;
  teamId?: string;
  assignedTo?: string;
  visibility?: 'public' | 'private' | 'team' | 'dept' | 'org';
  createdAt: string;
  updatedAt: string;
  isOfflinePending?: boolean;
  offlineOpId?: string;
}

export default function InventoryModule({ user, adminSettings }: InventoryModuleProps) {
  // Global Active State & Mode switcher
  const [activeTab, setActiveTab] = useState<'custom_inventories' | 'global_allocations' | 'physical_map'>('custom_inventories');
  
  // Data Model states loaded from database
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  
  // Tab 2: General/Global Allocations View data
  const [gear, setGear] = useState<GearItem[]>([]);
  const [loadingAllocations, setLoadingAllocations] = useState(true);
  const [allocationSearch, setAllocationSearch] = useState('');
  const [allocationSelected, setAllocationSelected] = useState<Set<string>>(new Set());
  const [allocationFilterOrg, setAllocationFilterOrg] = useState<string>('all');
  const [allocationFilterDept, setAllocationFilterDept] = useState<string>('all');
  const [allocationFilterTeam, setAllocationFilterTeam] = useState<string>('all');
  const [allocationViewMode, setAllocationViewMode] = useState<'grid' | 'list'>('list');
  const [allocationIsAssigning, setAllocationIsAssigning] = useState(false);
  const [allocationAssignTarget, setAllocationAssignTarget] = useState<{
    orgId?: string;
    deptId?: string;
    teamId?: string;
    assignedTo?: string;
  }>({});

  // Tab 1: Multi-Inventory System states
  const [inventories, setInventories] = useState<CustomInventory[]>([]);
  const [loadingInventories, setLoadingInventories] = useState(true);
  
  // Active Inventory Selection 
  const [selectedInventory, setSelectedInventory] = useState<CustomInventory | null>(null);
  const isSelectedInventoryEditable = !selectedInventory || 
    selectedInventory.ownerId === user?.uid || 
    selectedInventory.ownerEmail?.toLowerCase() === user?.email?.toLowerCase() || 
    selectedInventory.collaborators?.some(c => c.email && c.email.toLowerCase() === user?.email?.toLowerCase() && c.role === 'editor') || 
    user?.role === 'admin' || 
    user?.role === 'owner' ||
    (user?.permissions?.locations && user.permissions.locations[selectedInventory.id] === 'editor') ||
    user?.isSuperAdmin;

  // BOM Lead Time & Supply Chain Risk Analyzer states
  const [bomAnalysisResult, setBomAnalysisResult] = useState<any | null>(null);
  const [isAnalyzingBom, setIsAnalyzingBom] = useState(false);
  const [isBomModalOpen, setIsBomModalOpen] = useState(false);

  const triggerBomAnalysis = async () => {
    if (!selectedInventory || inventoryItems.length === 0) {
      toast.error("Add custom items to your sheet first before running supply chain check.");
      return;
    }
    
    setIsAnalyzingBom(true);
    setBomAnalysisResult(null);
    setIsBomModalOpen(true);

    try {
      const isLiveEnabled = !!adminSettings?.integrationConfig?.bomLeadServiceEnabled;
      const riskThreshold = adminSettings?.integrationConfig?.bomRiskThreshold || 7;

      const targetItems = inventoryItems.map(item => ({
        name: item.name,
        category: item.primaryCategory || "General",
        quantity: item.quantity || 1
      }));

      const res = await authenticatedFetch("/api/services/analyze-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: targetItems,
          isEnabled: isLiveEnabled,
          riskThreshold
        })
      });

      const data = await res.json();
      if (data.status === "success") {
        setBomAnalysisResult(data);
      } else {
        toast.error("Failed to parse analysis results");
      }
    } catch (err) {
      console.error("BOM analysis failure:", err);
      toast.error("BOM lead times analyzer request failed.");
    } finally {
      setIsAnalyzingBom(false);
    }
  };

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<OfflineOperation[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = offlineSync.subscribe((queue, online, syncing) => {
      setOfflineQueue(queue);
      setIsOnline(online);
      setIsSyncing(syncing);
    });
    return () => unsubscribe();
  }, []);
  const [loadingInventoryItems, setLoadingInventoryItems] = useState(false);
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryFilterCondition, setInventoryFilterCondition] = useState<string>('all');
  const [inventoryFilterStatus, setInventoryFilterStatus] = useState<string>('all');

  // Audit Mode states and helper functions for Inventory Items
  const [isAuditMode, setIsAuditMode] = useState(false);
  const [showOnlyAttentionNeeded, setShowOnlyAttentionNeeded] = useState(false);

  const isMaintenanceOutdated = (item: InventoryItem | GearItem) => {
    if (item.status === 'maintenance') return true;
    if (item.condition === 'poor') return true;
    if (item.maintenanceIntervalDays && item.maintenanceIntervalDays > 0) {
      if (!item.lastMaintenanceDate) return true;
      try {
        const last = new Date(item.lastMaintenanceDate).getTime();
        const nextDue = last + (item.maintenanceIntervalDays * 24 * 60 * 60 * 1000);
        return nextDue < Date.now();
      } catch {
        return true;
      }
    }
    return false;
  };

  const isLowInventory = (item: InventoryItem | GearItem) => {
    const qty = item.quantity !== undefined ? item.quantity : 1;
    return qty <= 1;
  };

  // New layout, category filtering and selection states for Custom Inventories
  const [inventoryViewMode, setInventoryViewMode] = useState<'list' | 'grid' | 'compact'>(() => {
    return user?.viewDensity === 'compact' ? 'compact' : 'list';
  });

  useEffect(() => {
    if (user?.viewDensity) {
      setInventoryViewMode(user.viewDensity === 'compact' ? 'compact' : 'list');
    }
  }, [user?.viewDensity]);

  const [selectedInventoryItems, setSelectedInventoryItems] = useState<Set<string>>(new Set());
  const [isInventoryBatchAssignOpen, setIsInventoryBatchAssignOpen] = useState(false);
  const [inventoryBatchAssignTarget, setInventoryBatchAssignTarget] = useState<{
    orgId?: string;
    deptId?: string;
    teamId?: string;
    assignedTo?: string;
  }>({});
  const [selectedInventoryCategory, setSelectedInventoryCategory] = useState<string>('All');
  const [inventoryPage, setInventoryPage] = useState(1);
  const [inventoryItemsPerPage, setInventoryItemsPerPage] = useState(50);
  const [debouncedInventorySearch, setDebouncedInventorySearch] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedInventorySearch(inventorySearch);
      setInventoryPage(1);
    }, 250);
    return () => clearTimeout(handler);
  }, [inventorySearch]);

  useEffect(() => {
    setInventoryPage(1);
  }, [inventoryFilterCondition, inventoryFilterStatus, selectedInventoryCategory]);

  const [isExportToAnotherOpen, setIsExportToAnotherOpen] = useState(false);
  const [targetAnotherInventoryId, setTargetAnotherInventoryId] = useState('');
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);

  // Clear selections on changing inventory
  useEffect(() => {
    setSelectedInventoryItems(new Set());
    setSelectedInventoryCategory('All');
  }, [selectedInventory]);

  const toggleInventoryItemSelection = (itemId: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    setSelectedInventoryItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleBulkDeleteInventoryItems = async () => {
    if (!selectedInventory) return;
    if (selectedInventoryItems.size === 0) return;
    
    const toastId = toast.loading(`Deleting ${selectedInventoryItems.size} items...`);
    try {
      const ids = Array.from(selectedInventoryItems);
      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500);
        const batch = writeBatch(db);
        chunk.forEach(id => {
          const docRef = doc(db, 'inventories', selectedInventory.id, 'items', id);
          batch.delete(docRef);
        });
        await batch.commit();
      }
      toast.success("Successfully deleted selected items!", { id: toastId });
      setSelectedInventoryItems(new Set());
      setIsBulkDeleteConfirmOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete selected items.", { id: toastId });
    }
  };

  const handleInventoryBulkAssign = async () => {
    if (!selectedInventory) return;
    if (selectedInventoryItems.size === 0) {
      toast.error("No items selected");
      return;
    }

    const toastId = toast.loading(`Batch assigning ${selectedInventoryItems.size} custom items...`);
    try {
      const itemsToUpdate = inventoryItems.filter(item => selectedInventoryItems.has(item.id));
      const colRef = collection(db, 'inventories', selectedInventory.id, 'items');

      for (let i = 0; i < itemsToUpdate.length; i += 500) {
        const chunk = itemsToUpdate.slice(i, i + 500);
        const batch = writeBatch(db);
        chunk.forEach(item => {
          const docRef = doc(colRef, item.id);
          batch.update(docRef, {
            orgId: inventoryBatchAssignTarget.orgId || null,
            deptId: inventoryBatchAssignTarget.deptId || null,
            teamId: inventoryBatchAssignTarget.teamId || null,
            assignedTo: inventoryBatchAssignTarget.assignedTo || null,
            updatedAt: new Date().toISOString()
          });
        });
        await batch.commit();
      }

      setSelectedInventoryItems(new Set());
      setIsInventoryBatchAssignOpen(false);
      toast.success(`Successfully batch assigned details to ${itemsToUpdate.length} custom items!`, { id: toastId });
    } catch (error) {
      console.error("Custom inventory batch assign error:", error);
      toast.error("Failed to batch update custom inventory items.", { id: toastId });
    }
  };

  const handleBulkCopyToAnotherInventory = async () => {
    if (!selectedInventory) return;
    if (!targetAnotherInventoryId) {
      toast.error("Please select a target inventory list.");
      return;
    }
    const targetInv = inventories.find(inv => inv.id === targetAnotherInventoryId);
    if (!targetInv) {
      toast.error("Selected target inventory not found.");
      return;
    }

    const toastId = toast.loading(`Copying ${selectedInventoryItems.size} items to ${targetInv.name}...`);
    try {
      const itemsToCopy = inventoryItems.filter(item => selectedInventoryItems.has(item.id));
      const colRef = collection(db, 'inventories', targetAnotherInventoryId, 'items');

      for (let i = 0; i < itemsToCopy.length; i += 500) {
        const chunk = itemsToCopy.slice(i, i + 500);
        const batch = writeBatch(db);
        chunk.forEach(item => {
          const docRef = doc(colRef);
          batch.set(docRef, {
            id: docRef.id,
            name: item.name || '',
            description: item.description || '',
            brand: item.brand || '',
            model: item.model || '',
            modelNumber: item.modelNumber || '',
            serialNumber: item.serialNumber || '',
            primaryCategory: item.primaryCategory || 'Other',
            weight: item.weight || null,
            weightUnit: item.weightUnit || 'g',
            price: item.price || 0,
            condition: item.condition || 'good',
            quantity: item.quantity || 1,
            status: item.status || 'available',
            assetTag: item.assetTag || `ASSET-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            photoUrls: item.photoUrls || ['https://picsum.photos/seed/gear/400/400'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        });
        await batch.commit();
      }

      toast.success(`Successfully copied ${itemsToCopy.length} items to "${targetInv.name}"!`, { id: toastId });
      setSelectedInventoryItems(new Set());
      setIsExportToAnotherOpen(false);
      setTargetAnotherInventoryId('');
    } catch (err) {
      console.error(err);
      toast.error("Failed to copy items.", { id: toastId });
    }
  };

  const handleBulkCopyToGearLibrary = async () => {
    if (!selectedInventory) return;
    if (selectedInventoryItems.size === 0) return;

    const toastId = toast.loading(`Copying ${selectedInventoryItems.size} items to Gear Library...`);
    try {
      const itemsToCopy = inventoryItems.filter(item => selectedInventoryItems.has(item.id));
      const colRef = collection(db, 'users', user.uid, 'gearLibrary');

      for (let i = 0; i < itemsToCopy.length; i += 500) {
        const chunk = itemsToCopy.slice(i, i + 500);
        const batch = writeBatch(db);
        chunk.forEach(item => {
          const docRef = doc(colRef);
          batch.set(docRef, {
            id: docRef.id,
            name: item.name || '',
            description: item.description || '',
            brand: item.brand || '',
            model: item.model || '',
            modelNumber: item.modelNumber || '',
            serialNumber: item.serialNumber || '',
            primaryCategory: item.primaryCategory || 'Other',
            category: item.primaryCategory || 'Other',
            weight: item.weight || null,
            weightUnit: item.weightUnit || 'g',
            price: item.price || 0,
            condition: item.condition || 'good',
            quantity: item.quantity || 1,
            status: item.status || 'available',
            assetTag: item.assetTag || `GEAR-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            photoUrls: item.photoUrls || ['https://picsum.photos/seed/gear/400/400'],
            usageCount: 0,
            ownerId: user.uid,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        });
        await batch.commit();
      }

      toast.success(`Successfully copied ${itemsToCopy.length} items to your central Gear Library!`, { id: toastId });
      setSelectedInventoryItems(new Set());
    } catch (err) {
      console.error(err);
      toast.error("Failed to copy items to Gear Library.", { id: toastId });
    }
  };

  // Multi-selector creation / dialog states
  const [isCreatingInventory, setIsCreatingInventory] = useState(false);
  const [editingInventory, setEditingInventory] = useState<CustomInventory | null>(null);
  const [inventoryFormName, setInventoryFormName] = useState('');
  const [inventoryFormDesc, setInventoryFormDesc] = useState('');
  const [visibilityOrgs, setVisibilityOrgs] = useState<string[]>([]);
  const [visibilityDepts, setVisibilityDepts] = useState<string[]>([]);
  const [visibilityTeams, setVisibilityTeams] = useState<string[]>([]);
  const [inventoryCollaborators, setInventoryCollaborators] = useState<{email: string; role: 'editor' | 'viewer'}[]>([]);
  const [inviteeEmail, setInviteeEmail] = useState('');
  const [inviteeRole, setInviteeRole] = useState<'editor' | 'viewer'>('editor');

  // Individual Manual Item Addition within selected inventory
  const [isAddingItemManually, setIsAddingItemManually] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemForm, setItemForm] = useState<{
    name: string;
    description: string;
    brand: string;
    model: string;
    modelNumber: string;
    serialNumber: string;
    primaryCategory: string;
    price: number;
    quantity: number;
    condition: 'new' | 'good' | 'fair' | 'poor';
    status: 'available' | 'in_use' | 'maintenance' | 'retired' | 'missing';
    photoUrl?: string;
    visibility?: 'public' | 'private' | 'team' | 'dept' | 'org';
  }>({
    name: '',
    description: '',
    brand: '',
    model: '',
    modelNumber: '',
    serialNumber: '',
    primaryCategory: 'Other',
    price: 0,
    quantity: 1,
    condition: 'good',
    status: 'available',
    photoUrl: '',
    visibility: 'public'
  });

  // Spreadsheet Importer and url-loader states
  const [isImporterOpen, setIsImporterOpen] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2>(1);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importData, setImportData] = useState<any[][]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [headerMappings, setHeaderMappings] = useState<Record<string, string>>({});
  const [unmappedHeaders, setUnmappedHeaders] = useState<string[]>([]);
  const [isMappingLoading, setIsMappingLoading] = useState(false);
  const [isSubmittingImport, setIsSubmittingImport] = useState(false);
  const [importProgressPercent, setImportProgressPercent] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canUseInventory = isFeatureEnabled('inventoryManagement', user, adminSettings);

  // Load baseline directory data (organizations, depts, teams, users) & Inventories real-time
  useEffect(() => {
    if (!user) return;

    // Real-time custom inventories subscriber
    const inventoriesQuery = query(collection(db, 'inventories'));
    const unsubInvs = onSnapshot(inventoriesQuery, (snap) => {
      const allInvs = snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomInventory));
      
      // Filter list: user is developer/admin, list owner, or is listed in visibilities targets
      const visible = allInvs.filter(inv => {
        const isOrgAdmin = user?.role === 'owner' || user?.role === 'admin';
        const userLocPermissions = user?.permissions?.locations || {};
        
        // If explicit role is set to none or restricted, filter out (for standard members)
        if (!isOrgAdmin && userLocPermissions[inv.id] === 'none') {
          return false;
        }
        
        // If they have reader, editor, or auditor, always show
        if (!isOrgAdmin && userLocPermissions[inv.id] && ['reader', 'editor', 'auditor'].includes(userLocPermissions[inv.id])) {
          return true;
        }

        if (inv.ownerId === user.uid) return true;
        if (inv.ownerEmail && inv.ownerEmail.toLowerCase() === user.email?.toLowerCase()) return true;
        
        // Collaborator check
        if (inv.collaborators?.some(c => c.email && c.email.toLowerCase() === user.email?.toLowerCase())) return true;

        if (inv.visibility?.orgIds?.includes(user.orgId || '')) return true;
        
        // Find if user is in target departments / teams (Note: check against standard user info)
        const inDept = inv.visibility?.deptIds?.some(did => departments.some(dept => dept.id === did && dept.orgId === user.orgId));
        if (inDept) return true;

        const inTeam = inv.visibility?.teamIds?.some(tid => teams.some(t => t.id === tid && t.orgId === user.orgId));
        if (inTeam) return true;

        return false;
      });
      setInventories(visible);
      setLoadingInventories(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'inventories');
    });

    // Subscriptions to existing organizations, departments, teams, users for multi-selectors
    const unsubOrgs = onSnapshot(query(collection(db, 'organizations'), where('ownerId', '==', user.uid)), (snap) => {
      setOrganizations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Organization)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'organizations');
    });

    let unsubDepts = () => {};
    let unsubTeams = () => {};
    let unsubUsers = () => {};

    if (user.orgId) {
      unsubDepts = onSnapshot(query(collection(db, 'departments'), where('orgId', '==', user.orgId)), (snap) => {
        setDepartments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Department)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'departments');
      });

      unsubTeams = onSnapshot(query(collection(db, 'teams'), where('orgId', '==', user.orgId)), (snap) => {
        setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'teams');
      });

      unsubUsers = onSnapshot(query(collection(db, 'users'), where('orgId', '==', user.orgId)), (snap) => {
        setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
      });
    }

    // Retro-compatible assignment control database feed
    const gearQuery = user.orgId 
      ? query(collectionGroup(db, 'gearLibrary'), where('orgId', '==', user.orgId))
      : query(collection(db, 'users', user.uid, 'gearLibrary'));

    const unsubGear = onSnapshot(gearQuery, (snap) => {
      setGear(snap.docs.map(d => ({ id: d.id, ...d.data() } as GearItem)));
      setLoadingAllocations(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, user.orgId ? 'gearLibrary (collectionGroup)' : 'users/gearLibrary');
      setLoadingAllocations(false);
    });

    return () => {
      unsubInvs();
      unsubOrgs();
      unsubDepts();
      unsubTeams();
      unsubUsers();
      unsubGear();
    };
  }, [user, user?.orgId]);

  // Load active inventory list items real-time
  useEffect(() => {
    if (!selectedInventory) {
      setInventoryItems([]);
      return;
    }

    setLoadingInventoryItems(true);
    const itemCollection = collection(db, 'inventories', selectedInventory.id, 'items');
    const unsubItems = onSnapshot(itemCollection, (snap) => {
      setInventoryItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem)));
      setLoadingInventoryItems(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `inventories/${selectedInventory.id}/items`);
      setLoadingInventoryItems(false);
    });

    return () => unsubItems();
  }, [selectedInventory]);

  // Toggle open inventory editor/creation with baseline visibility targets
  const openCreateInventoryModal = (inv: CustomInventory | null = null) => {
    if (inv) {
      setEditingInventory(inv);
      setInventoryFormName(inv.name);
      setInventoryFormDesc(inv.description);
      setVisibilityOrgs(inv.visibility?.orgIds || []);
      setVisibilityDepts(inv.visibility?.deptIds || []);
      setVisibilityTeams(inv.visibility?.teamIds || []);
      setInventoryCollaborators(inv.collaborators || []);
    } else {
      setEditingInventory(null);
      setInventoryFormName('');
      setInventoryFormDesc('');
      setVisibilityOrgs([]);
      setVisibilityDepts([]);
      setVisibilityTeams([]);
      setInventoryCollaborators([]);
    }
    setInviteeEmail('');
    setInviteeRole('editor');
    setIsCreatingInventory(true);
  };

  // Create / Save Inventory doc
  const handleSaveInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!inventoryFormName.trim()) {
      toast.error("Please enter a valid Inventory Name");
      return;
    }

    const payload = {
      name: inventoryFormName,
      description: inventoryFormDesc,
      ownerId: editingInventory ? editingInventory.ownerId : user.uid,
      ownerEmail: editingInventory ? (editingInventory.ownerEmail || '') : (user.email || ''),
      visibility: {
        orgIds: visibilityOrgs,
        deptIds: visibilityDepts,
        teamIds: visibilityTeams
      },
      collaborators: inventoryCollaborators,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingInventory) {
        // Update
        await updateDoc(doc(db, 'inventories', editingInventory.id), payload);
        toast.success("Inventory configuration updated successfully!");
      } else {
        // Add
        const newDocRef = doc(collection(db, 'inventories'));
        await setDoc(newDocRef, {
          ...payload,
          id: newDocRef.id,
          createdAt: new Date().toISOString()
        });
        toast.success("New Departmental Inventory created successfully!");
      }

      setIsCreatingInventory(false);
    } catch (err) {
      console.error(err);
      toast.error("Could not write inventory details to collection.");
    }
  };

  const addCollaborator = () => {
    if (!inviteeEmail.trim()) {
      toast.error("Please enter a valid email address");
      return;
    }
    const cleanEmail = inviteeEmail.trim().toLowerCase();
    
    // Check if duplicate
    if (inventoryCollaborators.some(c => c.email.toLowerCase() === cleanEmail)) {
      toast.error("This user email is already a collaborator");
      return;
    }

    setInventoryCollaborators([...inventoryCollaborators, { email: cleanEmail, role: inviteeRole }]);
    setInviteeEmail('');
    toast.success("Collaborator added to roster");
  };

  const removeCollaborator = (index: number) => {
    setInventoryCollaborators(inventoryCollaborators.filter((_, idx) => idx !== index));
    toast.success("Collaborator removed");
  };

  // Delete inventory
  const handleDeleteInventory = async (invId: string) => {
    if (!window.confirm("Are you sure you want to delete this inventory sheet? All its nested gear library items will be deleted permanently.")) return;
    try {
      // First, fetch and bundle delete inner subcollection items
      const itemsSnapshot = await getDocs(collection(db, 'inventories', invId, 'items'));
      const docs = itemsSnapshot.docs;
      
      for (let i = 0; i < docs.length; i += 500) {
        const chunk = docs.slice(i, i + 500);
        const batch = writeBatch(db);
        chunk.forEach(d => {
          batch.delete(doc(db, 'inventories', invId, 'items', d.id));
        });
        await batch.commit();
      }

      // Delete core inventory definition doc
      await deleteDoc(doc(db, 'inventories', invId));
      if (selectedInventory?.id === invId) {
        setSelectedInventory(null);
      }
      toast.success("Inventory list wiped and deleted successfully.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete the selected inventory.");
    }
  };

  // Local/Remote spreadsheet file loader mapping trigger
  const handleSpreadsheetFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    parseLocalFile(file);
  };

  // Parse custom binary file
  const parseLocalFile = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const id = toast.loading(`Parsing ${file.name}...`);
    
    if (extension === 'csv') {
      PAPA.parse(file, {
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            const rawRows = results.data as any[][];
            const headers = rawRows[0].map(h => String(h || '').trim());
            const content = rawRows.slice(1);
            setImportHeaders(headers);
            setImportData(content);
            setImportStep(2);
            toast.success("Spreadsheet parsed successfully!", { id });

            // Automatically call AI to suggested columns
            runAiMapping(headers, content.slice(0, 3));
          } else {
            toast.error("Parsed CSV file is empty.", { id });
          }
        },
        header: false,
        skipEmptyLines: true
      });
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const binary = evt.target?.result;
          const workbook = XLSX.read(binary, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
          
          if (rawRows.length > 0) {
            const headers = rawRows[0].map(h => String(h || '').trim());
            const content = rawRows.slice(1);
            setImportHeaders(headers);
            setImportData(content);
            setImportStep(2);
            toast.success("Spreadsheet workbook loaded successfully!", { id });

            runAiMapping(headers, content.slice(0, 3));
          } else {
            toast.error("Sheet contains no record rows.", { id });
          }
        } catch (excelErr) {
          console.error(excelErr);
          toast.error("Failed to parse the uploaded Excel sheet.", { id });
        }
      };
      reader.readAsBinaryString(file);
    }
  };

  // Fetch Excel/CSV via external link and parse 
  const handleURLImport = async () => {
    if (!urlInput.trim()) {
      toast.error("Please enter a valid spreadsheet URL to load");
      return;
    }
    const id = toast.loading("Connecting and requesting sheet from URL...");
    try {
      const response = await fetch(urlInput);
      if (!response.ok) {
        throw new Error(`Cloud request returned status ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const contentData = new Uint8Array(arrayBuffer);
      
      const workbook = XLSX.read(contentData, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      
      if (rawRows.length > 0) {
        const headersList = rawRows[0].map(h => String(h || '').trim());
        const dataRows = rawRows.slice(1);
        setImportHeaders(headersList);
        setImportData(dataRows);
        setImportStep(2);
        toast.success("Remote sheet downloaded and prepared successfully!", { id });
        
        runAiMapping(headersList, dataRows.slice(0, 3));
      } else {
        toast.error("The spreadsheet fetched was empty.", { id });
      }
    } catch (err: any) {
      console.error(err);
      toast.error("CORS blocks direct access. Ensure the CSV is directly accessible via a public URL.", { id });
    }
  };

  // Run AI Column Matching Schema Engine using /api/map-inventory
  const runAiMapping = async (headers: string[], samples: any[][]) => {
    setIsMappingLoading(true);
    try {
      const res = await authenticatedFetch('/api/map-inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ headers, sampleData: samples })
      });
      if (!res.ok) throw new Error("Auto-matching suggestion returned non-OK code.");
      
      const payload = await res.json();
      if (payload.mapping) {
        setHeaderMappings(payload.mapping);
        setUnmappedHeaders(payload.unmappedHeaders || []);
        toast.success("AI has auto-aligned columns with high category accuracy!");
      }
    } catch (err) {
      console.error(err);
      toast.warning("AI automatic column alignment is currently offline. Please configure manual alignment.");
    } finally {
      setIsMappingLoading(false);
    }
  };

  // Bulk Commit parsed lists supporting large quantities of hundreds/thousands of items
  const handleExecuteImport = async () => {
    if (!selectedInventory) return;
    if (importData.length === 0) {
      toast.error("No entries found mock mapped and imported.");
      return;
    }

    setIsSubmittingImport(true);
    setImportProgressPercent(0);
    const id = toast.loading(`Importing ${importData.length} items to ${selectedInventory.name}...`);

    try {
      const parentColRef = collection(db, 'inventories', selectedInventory.id, 'items');
      
      // Perform batch operations (firestore batches support 500 documents max; we write in safety chunks of 400)
      const chunkSize = 400;
      for (let i = 0; i < importData.length; i += chunkSize) {
        const chunk = importData.slice(i, i + chunkSize);
        const batch = writeBatch(db);

        chunk.forEach(row => {
          const getFieldVal = (fieldName: string) => {
            const indexStr = headerMappings[fieldName];
            if (indexStr === undefined || indexStr === null) return undefined;
            const index = parseInt(indexStr);
            if (isNaN(index)) return undefined;
            return row[index];
          };

          const nameVal = String(getFieldVal('name') || '').trim();
          if (!nameVal) return; // Skip records without name

          const parsedPrice = parseFloat(String(getFieldVal('price') || '0'));
          const parsedQuantity = parseInt(String(getFieldVal('quantity') || '1'));

          const finalItemDocRef = doc(parentColRef);
          batch.set(finalItemDocRef, {
            id: finalItemDocRef.id,
            name: nameVal,
            description: String(getFieldVal('description') || ''),
            brand: String(getFieldVal('brand') || ''),
            model: String(getFieldVal('model') || ''),
            modelNumber: String(getFieldVal('modelNumber') || ''),
            serialNumber: String(getFieldVal('serialNumber') || ''),
            primaryCategory: String(getFieldVal('primaryCategory') || 'Other'),
            weight: parseFloat(String(getFieldVal('weight') || '0')) || null,
            weightUnit: String(getFieldVal('weightUnit') || 'g'),
            price: isNaN(parsedPrice) ? 0 : parsedPrice,
            condition: (String(getFieldVal('condition') || 'good').toLowerCase() as any) || 'good',
            quantity: isNaN(parsedQuantity) ? 1 : parsedQuantity,
            status: (String(getFieldVal('status') || 'available').toLowerCase() as any) || 'available',
            assetTag: `ASSET-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        });

        await batch.commit();

        const progressPercent = Math.min(100, Math.round(((i + chunk.length) / importData.length) * 100));
        setImportProgressPercent(progressPercent);
        toast.loading(`Uploading lists: ${progressPercent}% completed (${i + chunk.length}/${importData.length} uploaded)...`, { id });
      }

      toast.success(`Successfully imported ${importData.length} sheet items with AI categories!`, { id });
      setIsImporterOpen(false);
      setImportData([]);
      setImportHeaders([]);
      setImportStep(1);
    } catch (err) {
      console.error(err);
      toast.error("Verification failed during sheet insertions.", { id });
    } finally {
      setIsSubmittingImport(false);
    }
  };

  // Single Manual Item edit / creator save within inventory list
  const handleSaveManualItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInventory) return;
    if (!itemForm.name.trim()) {
      toast.error("Asset Name is required.");
      return;
    }

    try {
      const parentColRef = collection(db, 'inventories', selectedInventory.id, 'items');
      const { photoUrl, ...formRest } = itemForm;
      const photoUrls = photoUrl ? [photoUrl] : [];

      if (editingItem) {
        const itemDocRef = doc(parentColRef, editingItem.id);
        const updatePayload = {
          ...formRest,
          photoUrls,
          updatedAt: new Date().toISOString()
        };

        if (!isOnline) {
          await offlineSync.queueOperation({
            type: 'update',
            collectionPath: ['inventories', selectedInventory.id, 'items', editingItem.id],
            docId: editingItem.id,
            data: updatePayload,
            label: `Update asset: ${formRest.name}`
          });
          toast.success("Saved copy offline. Asset queued for background synchronization!");
        } else {
          await updateDoc(itemDocRef, updatePayload);
          toast.success("Asset details updated successfully.");
        }
      } else {
        const itemDocRef = doc(parentColRef);
        const newAssetData = {
          ...formRest,
          photoUrls,
          id: itemDocRef.id,
          assetTag: `ASSET-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (!isOnline) {
          await offlineSync.queueOperation({
            type: 'set',
            collectionPath: ['inventories', selectedInventory.id, 'items', itemDocRef.id],
            docId: itemDocRef.id,
            data: newAssetData,
            label: `Add asset: ${formRest.name}`
          });
          toast.success("Added asset offline. Queue updated for synchronization!");
        } else {
          await setDoc(itemDocRef, newAssetData);
          toast.success("Asset added to selected inventory list.");
        }
      }
      setIsAddingItemManually(false);
      setEditingItem(null);
    } catch (err) {
      console.error(err);
      toast.error("Oops! Database entry could not be written.");
    }
  };

  const openEditItemModal = (item: InventoryItem) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      description: item.description || '',
      brand: item.brand || '',
      model: item.model || '',
      modelNumber: item.modelNumber || '',
      serialNumber: item.serialNumber || '',
      primaryCategory: item.primaryCategory || 'Other',
      price: item.price || 0,
      quantity: item.quantity || 1,
      condition: item.condition || 'good',
      status: item.status || 'available',
      photoUrl: item.photoUrls?.[0] || '',
      visibility: item.visibility || 'public'
    });
    setIsAddingItemManually(true);
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!selectedInventory) return;
    if (!window.confirm("Perform final deletion of this asset item?")) return;
    try {
      if (!isOnline) {
        const targetItem = effectiveInventoryItems.find(it => it.id === itemId);
        await offlineSync.queueOperation({
          type: 'delete',
          collectionPath: ['inventories', selectedInventory.id, 'items', itemId],
          docId: itemId,
          label: `Delete asset: ${targetItem?.name || 'Asset'}`
        });
        toast.success("Asset flagged for offline deletion. Queue updated.");
      } else {
        await deleteDoc(doc(db, 'inventories', selectedInventory.id, 'items', itemId));
        toast.success("Asset removed from sheet lists.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Deletion failed.");
    }
  };

  // Merge database snapshot with pending offline changes for snappy local rendering
  const effectiveInventoryItems = useMemo(() => {
    if (!selectedInventory) return [];
    
    let items = [...inventoryItems];

    // Filter operations related to this specific inventory sheet's subcollection
    const relevantOps = offlineQueue.filter(op => {
      return op.collectionPath[0] === 'inventories' && 
             op.collectionPath[1] === selectedInventory.id &&
             op.collectionPath[2] === 'items';
    });

    relevantOps.forEach(op => {
      if (op.type === 'delete') {
        items = items.filter(it => it.id !== op.docId);
      } else if (op.type === 'update') {
        const idx = items.findIndex(it => it.id === op.docId);
        if (idx !== -1) {
          items[idx] = { 
            ...items[idx], 
            ...op.data, 
            isOfflinePending: true,
            offlineOpId: op.id 
          };
        }
      } else if (op.type === 'set') {
        if (!items.some(it => it.id === op.docId)) {
          items.push({
            id: op.docId,
            ...op.data,
            isOfflinePending: true,
            offlineOpId: op.id
          });
        }
      }
    });

    return items;
  }, [inventoryItems, offlineQueue, selectedInventory]);

  // Dynamic unique category list in selected inventory
  const inventoryCategories = useMemo(() => {
    const cats = new Set(effectiveInventoryItems.map(i => i.primaryCategory || 'Other'));
    return ['All', ...Array.from(cats)].filter(Boolean);
  }, [effectiveInventoryItems]);

  // Tab 1 UI List filters logic
  const filteredInventoryItems = useMemo(() => {
    return effectiveInventoryItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(debouncedInventorySearch.toLowerCase()) || 
                           item.assetTag?.toLowerCase().includes(debouncedInventorySearch.toLowerCase()) ||
                           item.brand?.toLowerCase().includes(debouncedInventorySearch.toLowerCase()) ||
                           item.model?.toLowerCase().includes(debouncedInventorySearch.toLowerCase()) ||
                           item.serialNumber?.toLowerCase().includes(debouncedInventorySearch.toLowerCase());
      const matchesCondition = inventoryFilterCondition === 'all' || item.condition === inventoryFilterCondition;
      const matchesStatus = inventoryFilterStatus === 'all' || item.status === inventoryFilterStatus;
      const matchesCategory = selectedInventoryCategory === 'All' || (item.primaryCategory || 'Other') === selectedInventoryCategory;
      
      // Audit Mode attention-needed filter wrapper
      if (isAuditMode && showOnlyAttentionNeeded) {
        const needsAttention = isMaintenanceOutdated(item) || isLowInventory(item);
        if (!needsAttention) return false;
      }

      return matchesSearch && matchesCondition && matchesStatus && matchesCategory;
    });
  }, [effectiveInventoryItems, debouncedInventorySearch, inventoryFilterCondition, inventoryFilterStatus, selectedInventoryCategory, isAuditMode, showOnlyAttentionNeeded]);

  const paginatedInventoryItems = useMemo(() => {
    if (inventoryItemsPerPage === -1) return filteredInventoryItems;
    const startIndex = (inventoryPage - 1) * inventoryItemsPerPage;
    return filteredInventoryItems.slice(startIndex, startIndex + inventoryItemsPerPage);
  }, [filteredInventoryItems, inventoryPage, inventoryItemsPerPage]);

  const totalInventoryPages = useMemo(() => {
    if (inventoryItemsPerPage === -1) return 1;
    return Math.max(1, Math.ceil(filteredInventoryItems.length / inventoryItemsPerPage));
  }, [filteredInventoryItems.length, inventoryItemsPerPage]);

  // Tab 1 Valuation stats derived
  const inventoryValueSum = useMemo(() => {
    return filteredInventoryItems.reduce((acc, current) => acc + ((current.price || 0) * (current.quantity || 1)), 0);
  }, [filteredInventoryItems]);

  const toggleFormVisibilityOrg = (id: string) => {
    setVisibilityOrgs(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleFormVisibilityDept = (id: string) => {
    setVisibilityDepts(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleFormVisibilityTeam = (id: string) => {
    setVisibilityTeams(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Tab 2: Retro active allocations control toggle actions
  const filteredGearAllocations = useMemo(() => {
    return gear.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(allocationSearch.toLowerCase()) || 
                           item.assetTag?.toLowerCase().includes(allocationSearch.toLowerCase());
      const matchesOrg = allocationFilterOrg === 'all' || item.orgId === allocationFilterOrg;
      const matchesDept = allocationFilterDept === 'all' || item.deptId === allocationFilterDept;
      const matchesTeam = allocationFilterTeam === 'all' || item.teamId === allocationFilterTeam;
      return matchesSearch && matchesOrg && matchesDept && matchesTeam;
    });
  }, [gear, allocationSearch, allocationFilterOrg, allocationFilterDept, allocationFilterTeam]);

  const toggleAllocationItem = (id: string) => {
    const next = new Set(allocationSelected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setAllocationSelected(next);
  };

  const handleBulkAssign = async () => {
    if (allocationSelected.size === 0) return;
    if (!user) return;

    try {
      const ids = Array.from(allocationSelected);
      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500);
        const batch = writeBatch(db);
        chunk.forEach(id => {
          const gearRef = doc(db, 'users', user.uid, 'gearLibrary', id);
          batch.update(gearRef, {
            orgId: allocationAssignTarget.orgId || null,
            deptId: allocationAssignTarget.deptId || null,
            teamId: allocationAssignTarget.teamId || null,
            assignedTo: allocationAssignTarget.assignedTo || null,
            updatedAt: new Date().toISOString()
          });
        });
        await batch.commit();
      }
      toast.success(`Successfully assigned ${allocationSelected.size} assets`);
      setAllocationSelected(new Set());
      setAllocationIsAssigning(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to map changes on database storage batch.");
    }
  };

  // Export current inventory values as structured CSV
  const handleExportCSV = () => {
    if (filteredInventoryItems.length === 0) {
      toast.error("Nothing to export on the selected table.");
      return;
    }
    const lines = [
      ['Asset Tag', 'Name', 'Brand', 'Model', 'Serial', 'Category', 'Price', 'Qty', 'Condition', 'Status', 'Description'].join(','),
      ...filteredInventoryItems.map(it => [
        `"${it.assetTag}"`,
        `"${it.name.replace(/"/g, '""')}"`,
        `"${(it.brand || '').replace(/"/g, '""')}"`,
        `"${(it.model || '').replace(/"/g, '""')}"`,
        `"${(it.serialNumber || '').replace(/"/g, '""')}"`,
        `"${it.primaryCategory}"`,
        it.price || 0,
        it.quantity || 1,
        `"${it.condition}"`,
        `"${it.status}"`,
        `"${(it.description || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([lines], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${selectedInventory?.name.toLowerCase().replace(/\s+/g, '_')}_inventory.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Successfully exported "${selectedInventory?.name || 'custom'}" inventory list to CSV!`);
  };

  // Export detailed inventory audit report
  const handleExportAudit = () => {
    if (inventoryItems.length === 0) {
      toast.error("No items found in this inventory to audit.");
      return;
    }

    const totalQty = inventoryItems.reduce((acc, it) => acc + (it.quantity || 1), 0);
    const totalValuation = inventoryItems.reduce((acc, it) => acc + ((it.price || 0) * (it.quantity || 1)), 0);
    
    // Status breakdowns
    const statusCounts = inventoryItems.reduce((acc, it) => {
      acc[it.status] = (acc[it.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Condition breakdowns
    const conditionCounts = inventoryItems.reduce((acc, it) => {
      acc[it.condition] = (acc[it.condition] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const timestamp = new Date().toISOString();
    const cleanCSVField = (val: any) => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headerRows = [
      ['"INVENTORY SYSTEM AUDIT STATEMENT"'],
      ['"Inventory Sheet Name:"', cleanCSVField(selectedInventory?.name)],
      ['"Description:"', cleanCSVField(selectedInventory?.description || 'N/A')],
      ['"Audit Reference Date:"', cleanCSVField(timestamp)],
      ['"Auditor of Record:"', cleanCSVField(user?.email || 'N/A')],
      ['"Verification Account Name:"', cleanCSVField(user?.displayName || 'N/A')],
      ['"Total Unique Assets Counted:"', inventoryItems.length],
      ['"Total Stock Unit Count:"', totalQty],
      ['"Total Certified Financial Value:"', `"$${totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}"`],
      [],
      ['"STATUS BREAKDOWNS"'],
      ['"Available/Active:"', statusCounts['available'] || 0],
      ['"In Use/Deployed:"', statusCounts['in_use'] || 0],
      ['"Under Maintenance:"', statusCounts['maintenance'] || 0],
      ['"Retired/Archived:"', statusCounts['retired'] || 0],
      ['"Reported Missing:"', statusCounts['missing'] || 0],
      [],
      ['"CONDITION INDEX"'],
      ['"New Condition:"', conditionCounts['new'] || 0],
      ['"Good Condition:"', conditionCounts['good'] || 0],
      ['"Fair Condition:"', conditionCounts['fair'] || 0],
      ['"Poor Condition:"', conditionCounts['poor'] || 0],
      [], // blank separator line
      ['"Asset Tag"', '"Asset Name"', '"Brand"', '"Model"', '"Model Number"', '"Serial Number"', '"Primary Category"', '"Unit Price"', '"Quantity"', '"Total Asset Value"', '"Condition Rating"', '"Operational Status"', '"Last Logged Date"', '"Description/Notes"']
    ];

    const dataRows = inventoryItems.map(it => {
      const unitPrice = it.price || 0;
      const qty = it.quantity || 1;
      const totalVal = unitPrice * qty;
      return [
        cleanCSVField(it.assetTag),
        cleanCSVField(it.name),
        cleanCSVField(it.brand),
        cleanCSVField(it.model),
        cleanCSVField(it.modelNumber),
        cleanCSVField(it.serialNumber),
        cleanCSVField(it.primaryCategory),
        unitPrice,
        qty,
        totalVal,
        cleanCSVField(it.condition.toUpperCase()),
        cleanCSVField(it.status.toUpperCase()),
        cleanCSVField(it.updatedAt || it.createdAt),
        cleanCSVField(it.description)
      ];
    });

    const allLines = [...headerRows, ...dataRows].map(row => row.join(',')).join('\n');

    const blob = new Blob([allLines], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `AUDIT_${selectedInventory?.name.toUpperCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Professional audit statement exported successfully!");
  };

  if (!canUseInventory) {
    return (
      <div className="max-w-4xl mx-auto py-20 px-6 text-center space-y-6">
        <div className="w-20 h-20 bg-neutral-100 rounded-3xl flex items-center justify-center mx-auto text-neutral-400">
          <Shield size={40} />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-black uppercase tracking-tighter">Inventory Locked</h2>
          <p className="text-neutral-500 font-medium">This professional feature is not included in your current plan.</p>
        </div>
        <button className="px-8 py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-primary/90 transition shadow-xl shadow-primary/20">
          Upgrade to Business
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 select-none">
      
      {/* HEADER SECTION */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-neutral-900 text-white rounded-2xl flex items-center justify-center">
              <Database size={22} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black md:text-5xl tracking-tighter uppercase italic flex items-center gap-2">
                Inventories
              </h1>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-neutral-400">
                Departmental Sheets & Allocations
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic Navigation Mode Tabs */}
        <div className="flex bg-neutral-100 p-1.5 rounded-2xl border border-neutral-200 w-full md:w-auto self-start flex-wrap gap-2 md:gap-0">
          <button 
            onClick={() => { setSelectedInventory(null); setActiveTab('custom_inventories'); }}
            className={`flex-1 md:flex-initial px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${activeTab === 'custom_inventories' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-black'}`}
          >
            📋 Multi-Department Lists
          </button>
          <button 
            onClick={() => setActiveTab('global_allocations')}
            className={`flex-1 md:flex-initial px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${activeTab === 'global_allocations' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-black'}`}
          >
            🌐 Asset Allocations
          </button>
          <button 
            onClick={() => setActiveTab('physical_map')}
            className={`flex-1 md:flex-initial px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${activeTab === 'physical_map' ? 'bg-white text-black shadow-sm' : 'text-neutral-500 hover:text-black'}`}
          >
            🗺️ Racks & Storage Map
          </button>
        </div>
      </header>

      {/* RENDER VIEW ACCORDING TO SWITCHED MODE */}
      {activeTab === 'custom_inventories' ? (
        // ==========================================
        // SYSTEM A: CUSTOM DEPARTMENT INVENTORIES
        // ==========================================
        <div className="space-y-6">
          {!selectedInventory ? (
            /* INVENTORY SHEETS DIRECTORY DASHBOARD */
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-neutral-50 border border-neutral-200 p-6 rounded-[2rem] gap-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold uppercase tracking-tight text-neutral-900">Department inventories</h3>
                  <p className="text-xs text-neutral-500 max-w-lg">
                    Manage isolated lists of broadcast technology and kit pieces separately owned by teams or departments. Map access structures with multi-selectors.
                  </p>
                </div>
                <button
                  onClick={() => openCreateInventoryModal()}
                  className="bg-black hover:bg-neutral-800 text-white font-black uppercase text-[10px] tracking-widest px-6 py-3.5 rounded-full flex items-center gap-2 self-start sm:self-auto transition-all shadow-md"
                >
                  <Plus size={16} />
                  <span>New Inventory List</span>
                </button>
              </div>

              {loadingInventories ? (
                <div className="py-20 flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : inventories.length === 0 ? (
                <div className="bg-white border rounded-[2rem] border-neutral-150 p-12 text-center space-y-4">
                  <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto text-neutral-400">
                    <Database size={28} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-lg font-bold uppercase text-neutral-900">No Multi-Inventories Defined Yet</h4>
                    <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                      Create highly functional custom inventory sets and assign visibility for organizations, departments, or custom teams in your sandbox.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {inventories.map(inv => (
                    <motion.div
                      whileHover={{ scale: 1.01 }}
                      key={inv.id}
                      className="bg-white border border-neutral-200 p-6 rounded-[2.5rem] flex flex-col justify-between hover:shadow-lg transition-all"
                    >
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-100 text-neutral-600 block">
                            <Layers size={20} />
                          </span>
                          <span className="text-[9px] font-bold font-mono tracking-widest text-neutral-400 uppercase">
                            ID: {inv.id.substr(0, 8)}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <h3 
                            onClick={() => setSelectedInventory(inv)}
                            className="text-xl font-bold uppercase tracking-tight text-neutral-900 hover:text-primary transition-colors cursor-pointer"
                          >
                            {inv.name}
                          </h3>
                          <p className="text-xs text-neutral-500 line-clamp-2 min-h-[2.5rem]">
                            {inv.description || "No description loaded."}
                          </p>
                        </div>

                        {/* Badges summarizing Target Scope visibilities */}
                        <div className="space-y-2 pt-2 border-t border-neutral-50">
                          <p className="text-[8px] font-black uppercase tracking-wider text-neutral-400 block">AVAILABLE TARGETS</p>
                          <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
                            {inv.visibility?.orgIds?.map(oid => (
                              <span key={oid} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-bold uppercase tracking-wide rounded-md">
                                {organizations.find(o => o.id === oid)?.name || 'Onboarded Org'}
                              </span>
                            ))}
                            {inv.visibility?.deptIds?.map(did => (
                              <span key={did} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[8px] font-bold uppercase tracking-wide rounded-md">
                                {departments.find(d => d.id === did)?.name || 'Onboarded Dept'}
                              </span>
                            ))}
                            {inv.visibility?.teamIds?.map(tid => (
                              <span key={tid} className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[8px] font-bold uppercase tracking-wide rounded-md">
                                {teams.find(t => t.id === tid)?.name || 'Onboarded Team'}
                              </span>
                            ))}
                            {inv.collaborators && inv.collaborators.length > 0 && (
                              <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-[8px] font-bold uppercase tracking-wide rounded-md">
                                {inv.collaborators.length} COLLABORATOR{inv.collaborators.length > 1 ? 'S' : ''}
                              </span>
                            )}
                            {(!inv.visibility?.orgIds?.length && !inv.visibility?.deptIds?.length && !inv.visibility?.teamIds?.length) && (
                              <span className="text-[9px] text-neutral-400 italic">Private list</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-5 border-t border-neutral-100 mt-5">
                        <button
                          onClick={() => setSelectedInventory(inv)}
                          className="flex-1 px-4 py-2.5 bg-neutral-900 hover:bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
                        >
                          <span>Open List</span>
                          <ArrowRight size={12} />
                        </button>
                        {(inv.ownerId === user?.uid || inv.ownerEmail?.toLowerCase() === user?.email?.toLowerCase() || inv.collaborators?.some(c => c.email.toLowerCase() === user?.email?.toLowerCase() && c.role === 'editor') || user?.role === 'admin' || user?.isSuperAdmin) && (
                          <button
                            onClick={() => openCreateInventoryModal(inv)}
                            className="px-3.5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl transition-colors"
                            title="Edit Details"
                          >
                            <Edit2 size={12} />
                          </button>
                        )}
                        {(inv.ownerId === user?.uid || inv.ownerEmail?.toLowerCase() === user?.email?.toLowerCase() || user?.role === 'admin' || user?.isSuperAdmin) && (
                          <button
                            onClick={() => handleDeleteInventory(inv.id)}
                            className="px-3.5 py-2.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl transition-colors"
                            title="Delete Inventory"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* DETAILED INDIVIDUAL SHEET VIEW & STATS & IMPORTER LINK */
            <div className="space-y-6">
              {/* Back navigation line */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setSelectedInventory(null)}
                  className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-neutral-500 hover:text-black transition-colors"
                >
                  <ChevronLeft size={16} />
                  <span>Back to Custom inventories</span>
                </button>
                <div className="flex flex-wrap items-center gap-4 justify-between w-full">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block">
                      ACTIVE LIST: {selectedInventory.name}
                    </span>
                  </div>
                  <button
                    onClick={triggerBomAnalysis}
                    className="flex items-center gap-2 px-4 py-2 bg-[#ff4f3a]/10 hover:bg-[#ff4f3a]/25 text-[#ff4f3a] rounded-xl text-[9px] font-black uppercase tracking-widest transition"
                  >
                    <Cpu size={12} className="animate-pulse" />
                    <span>Lead-Time & Supply Chain Analyzer</span>
                  </button>
                </div>
              </div>

              {/* Statistics Overview Box */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 bg-neutral-950 text-white rounded-[2.5rem] p-6 lg:p-8">
                <div className="space-y-1 border-r border-neutral-800 p-2">
                  <p className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Total Active Assets</p>
                  <h4 className="text-3xl lg:text-4xl font-black italic tracking-tight font-sans">
                    {filteredInventoryItems.reduce((acc, current) => acc + (current.quantity || 1), 0)}
                  </h4>
                  <p className="text-[9px] text-neutral-400">Total counted equipment units</p>
                </div>

                <div className="space-y-1 border-r border-neutral-800 p-2">
                  <p className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Unique Item Models</p>
                  <h4 className="text-3xl lg:text-4xl font-black italic tracking-tight font-sans text-emerald-400">
                    {filteredInventoryItems.length}
                  </h4>
                  <p className="text-[9px] text-neutral-400">Separately typed categories</p>
                </div>

                <div className="space-y-1 border-r border-neutral-800 p-2">
                  <p className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Total Sheet Capitalization</p>
                  <h4 className="text-3xl lg:text-4xl font-black italic tracking-tight font-mono text-cyan-400">
                    ${inventoryValueSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h4>
                  <p className="text-[9px] text-neutral-400">Assets financial valuation sum</p>
                </div>

                <div className="space-y-1 p-2">
                  <p className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Maintenance Required</p>
                  <h4 className="text-3xl lg:text-4xl font-black italic tracking-tight font-sans text-amber-500">
                    {filteredInventoryItems.filter(i => i.condition === 'poor' || i.status === 'maintenance').length}
                  </h4>
                  <p className="text-[9px] text-neutral-400">Damaged piece checklists</p>
                </div>
              </div>

              {/* Custom Item Search and Action Toolbar */}
              <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 flex-1">
                  <div className="relative">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Search inventory..."
                      value={inventorySearch}
                      onChange={(e) => setInventorySearch(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-xl pl-11 pr-4 py-3 text-xs outline-none focus:ring-1 focus:ring-black h-11"
                    />
                  </div>

                  <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-xl px-4 py-1 h-11">
                    <Filter size={12} className="text-neutral-400" />
                    <select
                      value={inventoryFilterCondition}
                      onChange={(e) => setInventoryFilterCondition(e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-wider h-full"
                    >
                      <option value="all">Every Condition</option>
                      <option value="new">New</option>
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="poor">Poor</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-xl px-4 py-1 h-11">
                    <Tag size={12} className="text-neutral-400" />
                    <select
                      value={inventoryFilterStatus}
                      onChange={(e) => setInventoryFilterStatus(e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-wider h-full"
                    >
                      <option value="all">Every Status</option>
                      <option value="available">Available</option>
                      <option value="in_use">In Use</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="retired">Retired</option>
                      <option value="missing">Missing</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 self-start lg:self-auto shrink-0">
                  <button
                    onClick={() => {
                      if (!isSelectedInventoryEditable) {
                        toast.error("Permission Denied: You do not have edit rights on this inventory list.");
                        return;
                      }
                      setImportStep(1);
                      setImportHeaders([]);
                      setImportData([]);
                      setHeaderMappings({});
                      setIsImporterOpen(true);
                    }}
                    disabled={!isSelectedInventoryEditable}
                    className={`px-4 py-3 border text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition rounded-xl ${
                      isSelectedInventoryEditable
                        ? "bg-neutral-900 border-neutral-900 hover:bg-neutral-800 text-white cursor-pointer"
                        : "bg-neutral-50 border-neutral-200 text-neutral-400 cursor-not-allowed"
                    }`}
                  >
                    <FileSpreadsheet size={14} className={isSelectedInventoryEditable ? "text-emerald-400" : "text-neutral-305 text-neutral-300"} />
                    <span>Import Sheet Data</span>
                  </button>

                  <button
                    onClick={handleExportCSV}
                    className="px-4 py-3 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-800 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Download size={14} />
                    <span>Export CSV</span>
                  </button>

                  <button
                    onClick={handleExportAudit}
                    className="px-4 py-3 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition cursor-pointer"
                    title="Generate detailed inventory audit statement with status and health metrics"
                  >
                    <FileText size={14} className="text-emerald-600" />
                    <span>Audit Export</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsAuditMode(prev => {
                        const next = !prev;
                        if (next) {
                          setShowOnlyAttentionNeeded(true);
                          toast.success("Audit Mode Enabled: Highlighting low stock or overdue maintenance custom items.");
                        } else {
                          setShowOnlyAttentionNeeded(false);
                          toast("Audit Mode Disabled.");
                        }
                        return next;
                      });
                    }}
                    className={`px-4 py-3 border rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition cursor-pointer ${
                      isAuditMode
                        ? "bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-100 h-11"
                        : "bg-white border-neutral-200 hover:bg-neutral-50 text-neutral-800 h-11"
                    }`}
                  >
                    <ShieldAlert size={14} className={isAuditMode ? "text-white animate-bounce" : "text-amber-500"} />
                    <span>{isAuditMode ? "Audit Active" : "Audit Mode"}</span>
                  </button>

                  <button
                    onClick={() => {
                      if (!isSelectedInventoryEditable) {
                        toast.error("Permission Denied: You do not have edit rights on this inventory list.");
                        return;
                      }
                      setEditingItem(null);
                      setItemForm({
                        name: '',
                        description: '',
                        brand: '',
                        model: '',
                        modelNumber: '',
                        serialNumber: '',
                        primaryCategory: 'Other',
                        price: 0,
                        quantity: 1,
                        condition: 'good',
                        status: 'available'
                      });
                      setIsAddingItemManually(true);
                    }}
                    disabled={!isSelectedInventoryEditable}
                    className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition rounded-xl ${
                      isSelectedInventoryEditable
                        ? "bg-black hover:bg-neutral-800 text-white cursor-pointer"
                        : "bg-neutral-50 border border-neutral-200 text-neutral-400 cursor-not-allowed"
                    }`}
                  >
                    <Plus size={14} />
                    <span>Add Manual</span>
                  </button>
                </div>
              </div>

              {/* Dyn Categories and View Mode Switcher */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 pb-4 pt-2">
                {/* Category Buttons List */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide shrink">
                  {inventoryCategories.map(cat => {
                    const catItemsCount = inventoryItems.filter(i => cat === 'All' || (i.primaryCategory || 'Other') === cat).length;
                    return (
                      <button
                        key={cat}
                        onClick={() => setSelectedInventoryCategory(cat)}
                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap border flex items-center gap-2 cursor-pointer ${
                          selectedInventoryCategory === cat
                            ? "bg-black text-white border-black animate-pulse"
                            : "bg-white hover:bg-neutral-50 text-neutral-500 border-neutral-200"
                        }`}
                      >
                        <span>{cat}</span>
                        <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded-md ${
                          selectedInventoryCategory === cat
                            ? "bg-neutral-800 text-white"
                            : "bg-neutral-50 text-neutral-400"
                        }`}>
                          {catItemsCount}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Layout Toggler (List, Grid, Compact) */}
                <div className="flex items-center bg-neutral-100 p-1.5 rounded-xl self-end md:self-auto shrink-0">
                  {[
                    { id: 'list', icon: <ListIcon size={14} />, label: 'Table' },
                    { id: 'grid', icon: <LayoutGrid size={14} />, label: 'Cards' },
                    { id: 'compact', icon: <Package size={14} />, label: 'Compact' }
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setInventoryViewMode(mode.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition cursor-pointer ${
                        inventoryViewMode === mode.id
                          ? "bg-white text-black shadow-sm"
                          : "text-neutral-400 hover:text-neutral-700"
                      }`}
                    >
                      {mode.icon}
                      <span className="hidden sm:inline">{mode.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Audit Mode Active Alert Banner */}
              {isAuditMode && (
                <div className="bg-amber-50/50 border border-amber-200/80 rounded-[2rem] p-6 space-y-4 shadow-sm animate-pulse mb-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-amber-500/15 rounded-2xl text-amber-600 shrink-0 mt-0.5">
                        <ShieldAlert size={20} />
                      </div>
                      <div>
                        <h4 className="font-sans font-black uppercase text-sm text-neutral-900 tracking-tight flex items-center gap-2">
                          Audit Mode Active
                          <span className="bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full tracking-normal uppercase">System Overlord View</span>
                        </h4>
                        <p className="text-xs text-neutral-500 mt-1">
                          Identifying custom listing assets requiring attention, specifically:
                        </p>
                        <ul className="text-xs text-neutral-400 space-y-1 list-disc pl-4 mt-2 font-medium">
                          <li>Outdated Maintenance Dates (<span className="text-amber-600 font-bold">past schedule interval days</span>)</li>
                          <li>Low Inventory Checks (<span className="text-amber-600 font-bold">owned quantity matches or is below 1</span>)</li>
                          <li>Poor Component Conditions (<span className="text-amber-600 font-bold">damaged/critical status conditions</span>)</li>
                        </ul>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-white/85 border border-amber-200/50 px-5 py-3.5 rounded-[1.5rem] shadow-sm shrink-0 self-start md:self-auto">
                      <input 
                        type="checkbox"
                        id="inventoryAuditFilterToggle"
                        checked={showOnlyAttentionNeeded}
                        onChange={(e) => setShowOnlyAttentionNeeded(e.target.checked)}
                        className="w-4 h-4 rounded border-amber-300 text-amber-500 focus:ring-amber-400"
                      />
                      <label htmlFor="inventoryAuditFilterToggle" className="text-xs font-black uppercase text-neutral-700 select-none cursor-pointer">
                        Only show attention items
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* ACTIVE INVENTORY LISTINGS TABLE */}
              {loadingInventoryItems ? (
                <div className="py-20 flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredInventoryItems.length === 0 ? (
                <div className="bg-white border rounded-[2rem] p-16 text-center space-y-4">
                  <div className="w-14 h-14 bg-neutral-50 rounded-full flex items-center justify-center mx-auto text-neutral-400">
                    <FileSpreadsheet size={24} />
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-neutral-900 uppercase">This Inventory List is Empty</p>
                    <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                      Load in broadcast files, drag CSVs, or provide custom file URLs using the Importer to register thousands of pieces with AI categories.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {inventoryViewMode === 'list' ? (
                    <div className="bg-white rounded-[2rem] border border-neutral-200 overflow-hidden shadow-sm">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-neutral-100 bg-neutral-50/50">
                            {isSelectedInventoryEditable && (
                              <th className="p-4 w-12">
                                <button 
                                  onClick={() => {
                                    const allPageSelected = paginatedInventoryItems.length > 0 && paginatedInventoryItems.every(i => selectedInventoryItems.has(i.id));
                                    if (allPageSelected) {
                                      const next = new Set(selectedInventoryItems);
                                      paginatedInventoryItems.forEach(i => next.delete(i.id));
                                      setSelectedInventoryItems(next);
                                    } else {
                                      const next = new Set(selectedInventoryItems);
                                      paginatedInventoryItems.forEach(i => next.add(i.id));
                                      setSelectedInventoryItems(next);
                                    }
                                  }}
                                  className="w-5 h-5 border border-neutral-300 rounded flex items-center justify-center bg-white hover:border-black cursor-pointer"
                                >
                                  {paginatedInventoryItems.length > 0 && paginatedInventoryItems.every(i => selectedInventoryItems.has(i.id)) && <Check size={12} strokeWidth={4} />}
                                </button>
                              </th>
                            )}
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Asset Info</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Specifications</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Status & Core Category</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Qty / Condition</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Financial Value</th>
                            <th className="p-4 text-[10px] font-black uppercase tracking-widest text-neutral-400 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-50">
                          {paginatedInventoryItems.map(item => {
                            const isAttention = isAuditMode && (isMaintenanceOutdated(item) || isLowInventory(item));
                            const isCheckedOut = item.status === 'in_use';
                            return (
                              <tr 
                                key={item.id} 
                                className={`transition-colors ${
                                  isAttention 
                                    ? 'bg-amber-55/40 border-l-4 border-l-amber-500' 
                                    : selectedInventoryItems.has(item.id) ? 'bg-neutral-100' : 'hover:bg-neutral-50/50'
                                }`}
                              >
                                {isSelectedInventoryEditable && (
                                  <td className="p-4">
                                    <button
                                      onClick={(e) => toggleInventoryItemSelection(item.id, e)}
                                      className={`w-5 h-5 border rounded flex items-center justify-center transition-colors cursor-pointer ${
                                        selectedInventoryItems.has(item.id) 
                                          ? 'bg-black border-black text-white shadow' 
                                          : 'bg-white border-neutral-300 hover:border-black'
                                      }`}
                                    >
                                      {selectedInventoryItems.has(item.id) && <Check size={12} strokeWidth={4} />}
                                    </button>
                                  </td>
                                )}
                                <td className="p-4">
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="font-bold text-sm text-neutral-900 leading-tight">{item.name}</p>
                                      {item.isOfflinePending && (
                                        <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500 border border-amber-600 text-white animate-pulse flex items-center gap-1 shrink-0">
                                          <RefreshCw size={8} className="animate-spin" /> Pending Sync
                                        </span>
                                      )}
                                      {item.visibility && item.visibility !== 'public' && (
                                        <span className={`text-[8px] font-extrabold uppercase tracking-widest px-1 py-0.5 rounded text-white ${
                                          item.visibility === 'private' ? 'bg-red-500' :
                                          item.visibility === 'team' ? 'bg-blue-500' :
                                          item.visibility === 'dept' ? 'bg-indigo-500' :
                                          'bg-amber-600'
                                        }`}>
                                          {item.visibility.toUpperCase()}
                                        </span>
                                      )}
                                      {isCheckedOut && (
                                        <span className="text-[8px] font-black uppercase text-rose-600 bg-rose-50 border border-rose-100 px-1 py-0.5 rounded">Checked Out</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <p className="text-[9px] font-mono text-neutral-400 uppercase tracking-widest font-bold">
                                        {item.assetTag}
                                      </p>
                                      {isAuditMode && isMaintenanceOutdated(item) && (
                                        <span className="text-[8px] font-black uppercase text-rose-600 bg-rose-50 border border-rose-100 px-1 py-0.5 rounded">Maint Overdue</span>
                                      )}
                                      {isAuditMode && isLowInventory(item) && (
                                        <span className="text-[8px] font-black uppercase text-amber-600 bg-amber-50 border border-amber-100 px-1 py-0.5 rounded">Low Stock</span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              <td className="p-4 text-xs font-medium text-neutral-600">
                                <div className="space-y-0.5">
                                  {item.brand && <p><span className="font-bold">Brand:</span> {item.brand}</p>}
                                  {item.serialNumber && <p><span className="font-bold">Serial:</span> {item.serialNumber}</p>}
                                  {(!item.brand && !item.serialNumber) && <p className="text-neutral-400 italic">No specifications defined</p>}
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="space-y-1">
                                  <span className={`inline-block px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide rounded-md ${
                                    item.status === 'available' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                    item.status === 'in_use' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                    item.status === 'maintenance' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                    'bg-neutral-100 text-neutral-600'
                                  }`}>
                                    {item.status}
                                  </span>
                                  <div className="text-[10px] font-bold text-neutral-500 uppercase flex items-center gap-1">
                                    <Tag size={10} />
                                    <span>{item.primaryCategory}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="space-y-1">
                                  <p className="text-xs font-bold text-neutral-800">
                                    {item.quantity || 1} units
                                  </p>
                                  <span className={`inline-block px-1.5 py-0.5 text-[8px] font-bold uppercase rounded-md ${
                                    item.condition === 'new' ? 'bg-blue-100 text-blue-800' :
                                    item.condition === 'good' ? 'bg-emerald-100 text-emerald-800' :
                                    item.condition === 'fair' ? 'bg-amber-100 text-amber-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {item.condition}
                                  </span>
                                </div>
                              </td>
                              <td className="p-4 font-mono text-xs font-bold text-neutral-900">
                                ${((item.price || 0) * (item.quantity || 1)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex gap-1 justify-end">
                                  {isSelectedInventoryEditable ? (
                                    <>
                                      <button
                                        onClick={async () => {
                                          const id = toast.loading(`Copying "${item.name}" to Gear Library...`);
                                          try {
                                            await addDoc(collection(db, 'users', user.uid, 'gearLibrary'), {
                                              name: item.name || '',
                                              description: item.description || '',
                                              brand: item.brand || '',
                                              model: item.model || '',
                                              modelNumber: item.modelNumber || '',
                                              serialNumber: item.serialNumber || '',
                                              primaryCategory: item.primaryCategory || 'Other',
                                              category: item.primaryCategory || 'Other',
                                              weight: Number(item.weight) || 0,
                                              weightUnit: (item.weightUnit || 'g'),
                                              price: Number(item.price) || 0,
                                              condition: (item.condition || 'good'),
                                              quantity: Number(item.quantity) || 1,
                                              status: (item.status || 'available'),
                                              ownerId: user.uid,
                                              assetTag: item.assetTag || `GEAR-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
                                              usageCount: 0,
                                              photoUrls: ['https://picsum.photos/seed/gear/400/400'],
                                              createdAt: new Date().toISOString(),
                                              updatedAt: new Date().toISOString()
                                            });
                                            toast.success(`"${item.name}" is now in your Gear Library!`, { id });
                                          } catch (err) {
                                            console.error(err);
                                            toast.error("Failed to copy item to Gear Library.", { id });
                                          }
                                        }}
                                        className="p-2 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                                        title="Copy to central Gear Library"
                                      >
                                        <Layers size={14} />
                                      </button>
                                      <button
                                        onClick={() => openEditItemModal(item)}
                                        className="p-2 text-neutral-500 hover:text-black hover:bg-neutral-100 rounded-lg transition cursor-pointer"
                                        title="Edit Item"
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteItem(item.id)}
                                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                        title="Delete Item"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </>
                                  ) : (
                                    <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400 bg-neutral-50 px-2 py-1 rounded border border-neutral-100 italic">
                                      Read-Only
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        </tbody>
                      </table>
                    </div>
                  ) : inventoryViewMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                      {paginatedInventoryItems.map((item) => {
                        const photoUrl = (item.photoUrls && item.photoUrls[0]) || `https://picsum.photos/seed/${item.id}/400/400`;
                        const isAttention = isAuditMode && (isMaintenanceOutdated(item) || isLowInventory(item));
                        const isCheckedOut = item.status === 'in_use';
                        return (
                          <div
                            key={item.id}
                            className={`group bg-white rounded-[2rem] border shadow-sm transition-all duration-500 overflow-hidden flex flex-col relative h-[380px] ${
                              isAttention 
                                ? 'ring-2 ring-amber-500 border-amber-500 shadow-amber-100 shadow-lg' 
                                : 'border-neutral-200 hover:shadow-2xl'
                            }`}
                          >
                            <div className="relative h-44 overflow-hidden bg-neutral-50 select-none">
                              {isSelectedInventoryEditable && (
                                <div className="absolute top-4 left-4 z-10">
                                  <button 
                                    type="button"
                                    onClick={(e) => toggleInventoryItemSelection(item.id, e)}
                                    className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all cursor-pointer ${
                                      selectedInventoryItems.has(item.id) 
                                        ? 'bg-black border-black text-white shadow-lg scale-110' 
                                        : 'bg-white/80 backdrop-blur border-white/20 text-transparent hover:border-black/20 hover:text-black/10'
                                    }`}
                                  >
                                    <Check size={14} strokeWidth={4} />
                                  </button>
                                </div>
                              )}

                              {isCheckedOut && (
                                <div className="absolute inset-0 bg-neutral-900/65 backdrop-blur-[1px] flex flex-col items-center justify-center p-4 z-10 text-center">
                                  <span className="px-2.5 py-1 bg-red-650 border border-red-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-md flex items-center gap-1">
                                    <X size={10} strokeWidth={3} />
                                    Checked Out / Out
                                  </span>
                                </div>
                              )}

                              <img 
                                src={photoUrl} 
                                referrerPolicy="no-referrer"
                                alt={item.name} 
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                              
                              {item.condition === 'poor' && (
                                <div className="absolute bottom-4 left-4 px-3 py-1 bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg flex items-center gap-1.5">
                                  <AlertCircle size={10} />
                                  Maintenance
                                </div>
                              )}
                            </div>

                            <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                              <div className="space-y-1.5">
                                {isAuditMode && (
                                  <div className="flex flex-wrap gap-1">
                                    {isMaintenanceOutdated(item) && (
                                      <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-rose-50 border border-rose-100 text-rose-700">Maint Overdue</span>
                                    )}
                                    {isLowInventory(item) && (
                                      <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-50 border border-amber-100 text-amber-700">Low Stock</span>
                                    )}
                                  </div>
                                )}
                                <div className="flex items-center justify-between">
                                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0066cc] flex items-center gap-1.5">
                                    {item.primaryCategory}
                                    {item.visibility && item.visibility !== 'public' && (
                                      <span className={`font-extrabold text-[8px] tracking-normal px-1 py-0.5 rounded text-white ${
                                        item.visibility === 'private' ? 'bg-red-500' :
                                        item.visibility === 'team' ? 'bg-blue-500' :
                                        item.visibility === 'dept' ? 'bg-indigo-500' :
                                        'bg-amber-600'
                                      }`}>
                                        {item.visibility.toUpperCase()}
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-[9px] font-mono text-neutral-400 tracking-wider font-bold">#{item.assetTag?.slice(-4)}</p>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <h3 className="font-black text-sm leading-tight text-neutral-900 uppercase tracking-tight line-clamp-1 flex-1">{item.name}</h3>
                                  {item.isOfflinePending && (
                                    <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500 border border-amber-600 text-white animate-pulse flex items-center gap-1 shrink-0">
                                      <RefreshCw size={8} className="animate-spin" /> Pending Sync
                                    </span>
                                  )}
                                </div>
                                {item.brand && <p className="text-[9px] font-black uppercase tracking-widest text-[#a1a1aa]">{item.brand}</p>}
                                <p className="text-[11px] text-neutral-400 line-clamp-2 italic leading-relaxed">{item.description || 'No custom description defined.'}</p>
                              </div>

                              <div className="flex items-center gap-4 text-[10px] text-neutral-400 pt-4 border-t border-neutral-100 mt-auto justify-between">
                                <div className="flex items-center gap-1">
                                  <span className="font-bold text-neutral-800 text-xs">${((item.price || 0) * (item.quantity || 1)).toLocaleString()}</span>
                                </div>
                                
                                <div className="flex gap-1">
                                  {isSelectedInventoryEditable ? (
                                    <>
                                      <button
                                        onClick={() => openEditItemModal(item)}
                                        className="p-1.5 text-neutral-400 hover:text-black hover:bg-neutral-50 rounded-lg transition cursor-pointer"
                                        title="Edit Item"
                                      >
                                        <Edit2 size={13} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteItem(item.id)}
                                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                        title="Delete Item"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </>
                                  ) : (
                                    <span className="text-[8px] font-bold uppercase text-neutral-400">Read Only</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {paginatedInventoryItems.map((item) => {
                        const photoUrl = (item.photoUrls && item.photoUrls[0]) || `https://picsum.photos/seed/${item.id}/400/400`;
                        const isAttention = isAuditMode && (isMaintenanceOutdated(item) || isLowInventory(item));
                        const isCheckedOut = item.status === 'in_use';
                        return (
                          <div
                            key={item.id}
                            className={`group bg-white rounded-2xl border shadow-sm transition-all duration-300 overflow-hidden flex flex-col relative h-[240px] ${
                              isAttention 
                                ? 'ring-2 ring-amber-500 border-amber-500 shadow-md' 
                                : 'border-neutral-200 hover:shadow-md'
                            }`}
                          >
                            <div className="relative aspect-square overflow-hidden bg-neutral-50 select-none">
                              {isSelectedInventoryEditable && (
                                <div className="absolute top-2 left-2 z-10">
                                  <button 
                                    type="button"
                                    onClick={(e) => toggleInventoryItemSelection(item.id, e)}
                                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer ${
                                      selectedInventoryItems.has(item.id) 
                                        ? 'bg-black border-black text-white shadow-md' 
                                        : 'bg-white/80 backdrop-blur border-white/20 text-transparent hover:border-black/20 hover:text-black/10'
                                    }`}
                                  >
                                    <Check size={10} strokeWidth={4} />
                                  </button>
                                </div>
                              )}

                              {isCheckedOut && (
                                <div className="absolute inset-0 bg-neutral-900/65 backdrop-blur-[0.5px] flex flex-col items-center justify-center p-2 z-10 text-center select-none">
                                  <span className="px-1.5 py-0.5 bg-red-600 border border-red-500 text-white text-[7px] font-black uppercase tracking-widest rounded shadow">
                                    OUT
                                  </span>
                                </div>
                              )}

                              <img 
                                src={photoUrl} 
                                referrerPolicy="no-referrer"
                                alt={item.name} 
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                              />
                            </div>

                            <div className="p-3 flex-1 flex flex-col justify-between">
                              <div>
                                {isAuditMode && (
                                  <div className="flex flex-wrap gap-0.5 mb-1">
                                    {isMaintenanceOutdated(item) && (
                                      <span className="text-[6.5px] font-black uppercase tracking-wider px-1 rounded bg-rose-50 border border-rose-100 text-rose-700">Maint</span>
                                    )}
                                    {isLowInventory(item) && (
                                      <span className="text-[6.5px] font-black uppercase tracking-wider px-1 rounded bg-amber-50 border border-amber-100 text-amber-700">Low</span>
                                    )}
                                  </div>
                                )}
                                <div className="flex items-center gap-1 min-w-0">
                                  {item.isOfflinePending && (
                                    <RefreshCw size={8} className="animate-spin text-amber-500 shrink-0" />
                                  )}
                                  <h4 className="font-bold text-[11px] truncate uppercase leading-tight text-neutral-900 flex-1">{item.name}</h4>
                                </div>
                              </div>
                              <div className="flex items-center justify-between mt-1 pt-2 border-t border-neutral-50">
                                <span className="text-[9px] font-mono font-bold text-neutral-400">Qty: {item.quantity || 1}</span>
                                <span className="text-[9px] font-bold text-neutral-900">${(item.price || 0).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Custom Inventory Pagination */}
                  {filteredInventoryItems.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white px-8 py-6 rounded-[2rem] border border-neutral-200 shadow-sm w-full mt-6">
                      <div className="flex items-center gap-3 text-xs text-neutral-500">
                        <span>
                          Showing{' '}
                          <span className="font-mono font-bold text-neutral-800">
                            {inventoryItemsPerPage === -1 ? 1 : (inventoryPage - 1) * inventoryItemsPerPage + 1}
                          </span>{' '}
                          to{' '}
                          <span className="font-mono font-bold text-neutral-800">
                            {inventoryItemsPerPage === -1 ? filteredInventoryItems.length : Math.min(inventoryPage * inventoryItemsPerPage, filteredInventoryItems.length)}
                          </span>{' '}
                          of{' '}
                          <span className="font-mono font-bold text-neutral-800">
                            {filteredInventoryItems.length}
                          </span>{' '}
                          items
                        </span>
                        {filteredInventoryItems.length > 250 && (
                          <span className="text-[9px] font-bold bg-emerald-50 px-2 py-0.5 rounded-full text-emerald-600 uppercase tracking-widest">
                            Optimized Scale
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Items per page:</span>
                          <select
                            value={inventoryItemsPerPage}
                            onChange={(e) => {
                              setInventoryItemsPerPage(Number(e.target.value));
                              setInventoryPage(1);
                            }}
                            className="bg-neutral-50 hover:bg-neutral-100 border border-neutral-250 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer text-neutral-700 shadow-sm"
                          >
                            <option value={24}>24</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={250}>250</option>
                            <option value={-1}>All Items</option>
                          </select>
                        </div>

                        {inventoryItemsPerPage !== -1 && totalInventoryPages > 1 && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setInventoryPage(1)}
                              disabled={inventoryPage === 1}
                              className="p-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 disabled:opacity-30 disabled:hover:bg-white text-neutral-500 transition cursor-pointer text-xs font-semibold flex items-center justify-center min-w-[32px] h-[32px]"
                              type="button"
                              title="First Page"
                            >
                              <ChevronLeft size={14} className="stroke-[2.5]" />
                            </button>
                            <button
                              onClick={() => setInventoryPage(prev => Math.max(1, prev - 1))}
                              disabled={inventoryPage === 1}
                              className="px-3 h-[32px] text-xs font-semibold rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 disabled:opacity-30 disabled:hover:bg-white text-neutral-500 transition cursor-pointer"
                              type="button"
                            >
                              Prev
                            </button>

                            <div className="flex items-center px-3 h-[32px]">
                              <span className="text-xs font-semibold text-neutral-700">
                                <span className="font-mono text-neutral-900 font-bold">{inventoryPage}</span> /{' '}
                                <span className="font-mono text-neutral-500">{totalInventoryPages}</span>
                              </span>
                            </div>

                            <button
                              onClick={() => setInventoryPage(prev => Math.min(totalInventoryPages, prev + 1))}
                              disabled={inventoryPage === totalInventoryPages}
                              className="px-3 h-[32px] text-xs font-semibold rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 disabled:opacity-30 disabled:hover:bg-white text-neutral-500 transition cursor-pointer"
                              type="button"
                            >
                              Next
                            </button>
                            <button
                              onClick={() => setInventoryPage(totalInventoryPages)}
                              disabled={inventoryPage === totalInventoryPages}
                              className="p-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 disabled:opacity-30 disabled:hover:bg-white text-neutral-500 transition cursor-pointer text-xs font-semibold flex items-center justify-center min-w-[32px] h-[32px]"
                              type="button"
                              title="Last Page"
                            >
                              <ChevronRight size={14} className="stroke-[2.5]" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Floating Action Bar for Selected Custom Inventory Items */}
              <AnimatePresence>
                {selectedInventoryItems.size > 0 && (
                  <motion.div 
                    initial={{ y: 100, opacity: 0, x: '-50%' }}
                    animate={{ y: 0, opacity: 1, x: '-50%' }}
                    exit={{ y: 100, opacity: 0, x: '-50%' }}
                    className="fixed bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 z-[90] flex flex-col md:flex-row items-center gap-4 bg-neutral-900 text-white p-4 md:px-8 md:py-5 rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl border border-white/10 w-[min(calc(100%-2rem),48rem)]"
                  >
                    <div className="flex items-center justify-between w-full md:w-auto md:border-r md:border-white/10 md:pr-6 md:mr-2">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] md:text-xs font-black">
                          {selectedInventoryItems.size}
                        </div>
                        <span className="text-xs md:text-sm font-bold text-neutral-300 whitespace-nowrap uppercase tracking-widest">Selected</span>
                      </div>
                      <button 
                        onClick={() => setSelectedInventoryItems(new Set())}
                        className="md:hidden p-2 hover:bg-white/10 rounded-xl transition text-neutral-400 hover:text-white"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-2 overflow-x-auto md:overflow-visible w-full md:w-auto scrollbar-hide pb-1 md:pb-0">
                      <button 
                        onClick={handleBulkCopyToGearLibrary}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-neutral-800 text-white px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-neutral-700 transition shadow-lg whitespace-nowrap border border-white/5"
                        title="Copy selected assets to your main Gear Library list"
                      >
                        <Layers className="w-4 h-4 text-emerald-400" />
                        <span>To Gear Library</span>
                      </button>

                      <button 
                        onClick={() => setIsExportToAnotherOpen(true)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-500 transition shadow-lg whitespace-nowrap"
                        title="Copy selected items to another custom list sheet"
                      >
                        <Upload className="w-4 h-4 text-emerald-200" />
                        <span>Copy Sheets</span>
                      </button>

                      <button 
                        onClick={() => {
                          setInventoryBatchAssignTarget({
                            orgId: '',
                            deptId: '',
                            teamId: '',
                            assignedTo: ''
                          });
                          setIsInventoryBatchAssignOpen(true);
                        }}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-neutral-800 text-white px-4 md:px-5 py-2 md:py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-neutral-750 transition shadow-lg whitespace-nowrap border border-white/5"
                        title="Batch assign Organization, Department, and Team setting to selected items"
                      >
                        <ShieldAlert className="w-4 h-4 text-amber-400" />
                        <span>Assign Batch</span>
                      </button>

                      <button 
                        onClick={() => setIsBulkDeleteConfirmOpen(true)}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 md:px-6 py-2 md:py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition shadow-lg whitespace-nowrap"
                      >
                        <Trash2 className="w-4 h-4 text-red-200" />
                        <span>Delete</span>
                      </button>

                      <button 
                        onClick={() => setSelectedInventoryItems(new Set())}
                        className="hidden md:block p-2 hover:bg-white/10 rounded-xl transition text-neutral-400 hover:text-white"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Copy Selected to Another Custom Inventory Modal */}
              <AnimatePresence>
                {isExportToAnotherOpen && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 15 }}
                      className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-neutral-100"
                    >
                      <div className="p-6 md:p-8 flex items-center justify-between border-b border-[#f4f4f5]">
                        <div className="flex items-center gap-3">
                          <span className="p-3 bg-neutral-900 text-white rounded-2xl">
                            <FileSpreadsheet size={20} />
                          </span>
                          <div>
                            <h3 className="text-lg font-black uppercase tracking-tight text-neutral-900">Copy to Another List</h3>
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#0066cc]">
                              Copy {selectedInventoryItems.size} items to another custom sheet
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setIsExportToAnotherOpen(false)}
                          className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-900 transition"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <div className="p-6 md:p-8 space-y-6">
                        <p className="text-xs text-neutral-500 font-medium leading-relaxed font-sans">
                          Copying these items will copy them completely with their categories, descriptions, specifications, quantities and status conditions to another sheet list chosen below.
                        </p>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block font-sans">
                            Choose Target Inventory List
                          </label>
                          {inventories.filter(inv => inv.id !== selectedInventory.id).length === 0 ? (
                            <div className="text-xs font-bold text-center p-6 bg-neutral-50 border border-neutral-200 text-neutral-400 rounded-2xl">
                              No other custom inventories found. Please create another list first!
                            </div>
                          ) : (
                            <select
                              value={targetAnotherInventoryId}
                              onChange={(e) => setTargetAnotherInventoryId(e.target.value)}
                              className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3.5 text-xs focus:ring-2 focus:ring-neutral-900 outline-none font-bold uppercase tracking-wider transition"
                            >
                              <option value="" disabled>Select Custom List...</option>
                              {inventories
                                .filter(inv => inv.id !== selectedInventory.id)
                                .map((inv) => (
                                  <option key={inv.id} value={inv.id}>
                                    {inv.name} ({inv.ownerEmail || 'Shared'})
                                  </option>
                                ))}
                            </select>
                          )}
                        </div>
                      </div>

                      <div className="p-8 bg-neutral-50 border-t border-neutral-100 flex gap-4">
                        <button
                          onClick={() => setIsExportToAnotherOpen(false)}
                          className="flex-1 py-4 bg-white border border-neutral-200 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-100 transition shadow-sm text-xs uppercase tracking-wider font-sans"
                        >
                          Cancel
                        </button>
                        <button
                          disabled={!targetAnotherInventoryId || inventories.filter(inv => inv.id !== selectedInventory.id).length === 0}
                          onClick={handleBulkCopyToAnotherInventory}
                          className="flex-1 py-4 bg-black text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-black uppercase tracking-widest text-xs transition shadow-lg flex items-center justify-center gap-2"
                        >
                          Confirm Copy ({selectedInventoryItems.size})
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* Bulk Delete Confirm Modal */}
              <AnimatePresence>
                {isBulkDeleteConfirmOpen && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-neutral-100"
                    >
                      <div className="p-8 text-center space-y-4">
                        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
                          <Trash2 size={24} />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-base font-black uppercase tracking-tight text-neutral-900">Bulk Delete Selection</h4>
                          <p className="text-xs text-neutral-500">
                            Are you sure you want to permanently delete {selectedInventoryItems.size} selected items from this custom sheet list? This cannot be undone.
                          </p>
                        </div>
                      </div>
                      <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex gap-4">
                        <button
                          onClick={() => setIsBulkDeleteConfirmOpen(false)}
                          className="flex-1 py-3 bg-white border border-neutral-200 text-neutral-600 rounded-xl font-bold hover:bg-neutral-100 transition text-xs uppercase tracking-wider font-sans"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleBulkDeleteInventoryItems}
                          className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase tracking-widest text-xs transition shadow-md select-none"
                        >
                          Delete ({selectedInventoryItems.size})
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

              {/* Custom Inventories Batch Assignment Modal */}
              <AnimatePresence>
                {isInventoryBatchAssignOpen && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 15 }}
                      className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-neutral-100"
                    >
                      <div className="p-6 md:p-8 flex items-center justify-between border-b border-[#f4f4f5]">
                        <div className="flex items-center gap-3">
                          <span className="p-3 bg-neutral-900 text-white rounded-2xl">
                            <ShieldAlert size={20} className="text-amber-400 animate-pulse" />
                          </span>
                          <div>
                            <h3 className="text-lg font-black uppercase tracking-tight text-neutral-900">Bulk Assignment</h3>
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#0066cc]">
                              Mapping {selectedInventoryItems.size} custom inventory items
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setIsInventoryBatchAssignOpen(false)}
                          className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-900 transition"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <div className="p-6 md:p-8 space-y-4">
                        <p className="text-xs text-neutral-500 font-medium leading-relaxed font-sans">
                          Batch assign organization level and sub-team department designations. Selected items will inherit these visibility, checkout permissions and telemetry targets.
                        </p>

                        <div className="space-y-4">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block ml-1">Target Organization</label>
                            <select 
                              value={inventoryBatchAssignTarget.orgId || ''}
                              onChange={(e) => setInventoryBatchAssignTarget({ ...inventoryBatchAssignTarget, orgId: e.target.value, deptId: '', teamId: '' })}
                              className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3.5 text-xs focus:ring-2 focus:ring-neutral-900 outline-none font-bold uppercase tracking-wider transition"
                            >
                              <option value="">None / Unassigned</option>
                              {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block ml-1">Target Department</label>
                            <select 
                              disabled={!inventoryBatchAssignTarget.orgId}
                              value={inventoryBatchAssignTarget.deptId || ''}
                              onChange={(e) => setInventoryBatchAssignTarget({ ...inventoryBatchAssignTarget, deptId: e.target.value, teamId: '' })}
                              className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3.5 text-xs focus:ring-2 focus:ring-neutral-900 outline-none font-bold uppercase tracking-wider transition disabled:opacity-50"
                            >
                              <option value="">None / Unassigned</option>
                              {departments.filter(d => d.orgId === inventoryBatchAssignTarget.orgId).map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block ml-1">Target Team</label>
                            <select 
                              disabled={!inventoryBatchAssignTarget.deptId}
                              value={inventoryBatchAssignTarget.teamId || ''}
                              onChange={(e) => setInventoryBatchAssignTarget({ ...inventoryBatchAssignTarget, teamId: e.target.value })}
                              className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3.5 text-xs focus:ring-2 focus:ring-neutral-900 outline-none font-bold uppercase tracking-wider transition disabled:opacity-50"
                            >
                              <option value="">None / Unassigned</option>
                              {teams.filter(t => t.deptId === inventoryBatchAssignTarget.deptId).map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block ml-1">Assign to Member</label>
                            <select 
                              value={inventoryBatchAssignTarget.assignedTo || ''}
                              onChange={(e) => setInventoryBatchAssignTarget({ ...inventoryBatchAssignTarget, assignedTo: e.target.value })}
                              className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3.5 text-xs focus:ring-2 focus:ring-neutral-900 outline-none font-bold uppercase tracking-wider transition"
                            >
                              <option value="">None / Open (Float)</option>
                              {users.map(u => <option key={u.uid} value={u.uid}>{u.displayName} ({u.email || u.uid})</option>)}
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="p-8 bg-neutral-50 border-t border-neutral-100 flex gap-4">
                        <button
                          onClick={() => setIsInventoryBatchAssignOpen(false)}
                          className="flex-1 py-4 bg-white border border-neutral-200 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-100 transition shadow-sm text-xs uppercase tracking-wider font-sans"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleInventoryBulkAssign}
                          className="flex-2 py-4 bg-black text-white hover:bg-neutral-800 rounded-2xl font-black uppercase tracking-widest text-xs transition shadow-lg flex items-center justify-center gap-2"
                        >
                          Save Allocations ({selectedInventoryItems.size})
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      ) : activeTab === 'global_allocations' ? (
        // ==========================================
        // SYSTEM B: RETRO ACTIVE GLOBALLY ALLOCATED FLEET
        // ==========================================
        <div className="space-y-6">
          <div className="flex bg-neutral-50 p-6 rounded-[2rem] border border-neutral-150 items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-lg font-bold uppercase tracking-tight">Asset Assignments</h3>
              <p className="text-xs text-neutral-500 max-w-[40rem]">
                Define specific sub-team and organizational level assignments over general database inventory items. Map multiple pieces together in micro groups.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input 
                type="text" 
                placeholder="Search asset tag numbers..." 
                value={allocationSearch}
                onChange={(e) => setAllocationSearch(e.target.value)}
                className="w-full bg-white border border-neutral-200 rounded-xl pl-11 pr-4 py-3 text-xs outline-none focus:ring-1 focus:ring-black h-11"
              />
            </div>

            <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-xl px-4 py-1 h-11">
              <Building2 size={12} className="text-neutral-400" />
              <select 
                value={allocationFilterOrg} 
                onChange={(e) => setAllocationFilterOrg(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-wider h-full"
              >
                <option value="all">Organizations</option>
                {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-xl px-4 py-1 h-11">
              <Layers size={11} className="text-neutral-400" />
              <select 
                value={allocationFilterDept} 
                onChange={(e) => setAllocationFilterDept(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-wider h-full"
              >
                <option value="all">Departments</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-xl px-4 py-1 h-11">
              <GitBranch size={11} className="text-neutral-400" />
              <select 
                value={allocationFilterTeam} 
                onChange={(e) => setAllocationFilterTeam(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-wider h-full"
              >
                <option value="all">Teams</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex justify-between items-center bg-white p-4 border border-neutral-200 rounded-2xl">
            <span className="text-xs text-neutral-500 font-bold">
              {allocationSelected.size} assets chosen for mapping changes
            </span>
            <div className="flex gap-2">
              {allocationSelected.size > 0 && (
                <button
                  onClick={() => setAllocationIsAssigning(true)}
                  className="bg-black hover:bg-neutral-800 text-white font-black uppercase text-[10px] tracking-wider px-5 py-2.5 rounded-lg transition flex items-center gap-1.5"
                >
                  <ArrowRight size={12} />
                  <span>Assign Selected</span>
                </button>
              )}
            </div>
          </div>

          {loadingAllocations ? (
            <div className="py-20 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredGearAllocations.length === 0 ? (
            <div className="bg-white border p-12 text-center text-neutral-400 rounded-lg">
              No general gear assignments loaded into database sandbox workspace.
            </div>
          ) : (
            <div className="bg-white rounded-[2rem] border border-neutral-200 overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/50">
                    <th className="p-4 w-12">
                      <button 
                        onClick={() => {
                          if (allocationSelected.size === filteredGearAllocations.length) setAllocationSelected(new Set());
                          else setAllocationSelected(new Set(filteredGearAllocations.map(g => g.id)));
                        }}
                        className="w-5 h-5 border rounded flex items-center justify-center bg-white"
                      >
                        {allocationSelected.size === filteredGearAllocations.length && <Check size={12} />}
                      </button>
                    </th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Asset</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Owner Unit</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Department</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Team</th>
                    <th className="p-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">User Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {filteredGearAllocations.map(g => (
                    <tr key={g.id} className="hover:bg-neutral-50/50 transition-all">
                      <td className="p-4">
                        <button
                          onClick={() => toggleAllocationItem(g.id)}
                          className={`w-5 h-5 border rounded flex items-center justify-center transition-colors ${allocationSelected.has(g.id) ? 'bg-primary border-primary text-white' : 'bg-white'}`}
                        >
                          {allocationSelected.has(g.id) && <Check size={12} />}
                        </button>
                      </td>
                      <td className="p-4">
                        <div>
                          <p className="font-bold text-sm text-neutral-900 leading-tight">{g.name}</p>
                          <p className="text-[10px] text-neutral-400 font-mono font-bold tracking-wider">{g.assetTag}</p>
                        </div>
                      </td>
                      <td className="p-4 text-xs font-bold text-neutral-700">
                        {organizations.find(o => o.id === g.orgId)?.name || 'Unassigned'}
                      </td>
                      <td className="p-4 text-xs font-bold text-neutral-750">
                        {departments.find(d => d.id === g.deptId)?.name || '--'}
                      </td>
                      <td className="p-4 text-xs font-bold text-neutral-750">
                        {teams.find(t => t.id === g.teamId)?.name || '--'}
                      </td>
                      <td className="p-4 text-xs font-bold text-neutral-800">
                        {users.find(u => u.uid === g.assignedTo)?.displayName || 'Float'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <PhysicalLocationMap 
          user={user} 
          adminSettings={adminSettings} 
          inventoryItems={inventoryItems as any} 
          selectedInventory={selectedInventory} 
          organizations={organizations} 
          departments={departments} 
          teams={teams} 
        />
      )}

      {/* ==============================================
          DIALOUGES & FLOATING OVERLAY VIEWS
          ============================================== */}

      {/* 1. CREATION / MODIFICATION DIALOGUE */}
      <AnimatePresence>
        {isCreatingInventory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreatingInventory(false)}
              className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 md:p-8 flex items-center justify-between border-b border-neutral-100 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-100 text-neutral-900 block">
                    <Database size={20} />
                  </span>
                  <div>
                    <h2 className="text-xl font-bold uppercase tracking-tight">
                      {editingInventory ? 'Update Sheet Details' : 'Create Custom Inventory List'}
                    </h2>
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#0066cc]">Scope availability targets</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsCreatingInventory(false)}
                  className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-900 transition"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveInventory} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block ml-1">
                    Inventory list Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Broadcast Van Alpha, IT Backups"
                    value={inventoryFormName}
                    onChange={(e) => setInventoryFormName(e.target.value)}
                    className="w-full bg-neutral-50 hover:bg-neutral-100/50 border border-neutral-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-black h-12"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block ml-1">
                    Describe Inventory Sheet
                  </label>
                  <textarea
                    placeholder="Write a brief overview describing the purpose of these items..."
                    value={inventoryFormDesc}
                    rows={2}
                    onChange={(e) => setInventoryFormDesc(e.target.value)}
                    className="w-full bg-neutral-50 hover:bg-neutral-100/50 border border-neutral-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-black"
                  />
                </div>

                {/* COLLABORATORS & LIST EDITORS SECTION */}
                <div className="space-y-4 border-t border-neutral-100 pt-6">
                  <div className="space-y-1">
                    <h4 className="text-xs font-black uppercase tracking-wider text-neutral-800">Collaborators & List Editors</h4>
                    <p className="text-[10px] text-neutral-500">
                      Explicitly grant and share reading/editing access with specific user accounts outside organizational boundaries.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input
                        type="email"
                        placeholder="collaborator@example.com"
                        value={inviteeEmail}
                        onChange={(e) => setInviteeEmail(e.target.value)}
                        className="w-full bg-neutral-50 hover:bg-neutral-100/50 border border-neutral-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-black h-10"
                      />
                    </div>
                    <div className="w-32">
                      <select
                        value={inviteeRole}
                        onChange={(e) => setInviteeRole(e.target.value as 'editor' | 'viewer')}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-2 py-2 text-xs outline-none focus:ring-1 focus:ring-black h-10"
                      >
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={addCollaborator}
                      className="px-4 bg-neutral-900 text-white font-black text-[10px] uppercase tracking-wider rounded-xl hover:bg-black transition-colors h-10 shrink-0"
                    >
                      Add
                    </button>
                  </div>

                  {inventoryCollaborators.length > 0 ? (
                    <div className="bg-neutral-50 rounded-2xl border border-neutral-100 p-4 space-y-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-[#0066cc]">Current Collaborators roster</p>
                      <div className="divide-y divide-neutral-100">
                        {inventoryCollaborators.map((c, index) => (
                          <div key={index} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                            <div>
                              <p className="text-[11px] font-bold text-neutral-800 font-mono">{c.email}</p>
                              <span className="text-[9px] font-black uppercase text-neutral-400">{c.role}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeCollaborator(index)}
                              className="p-1 text-red-400 hover:text-red-500 hover:bg-red-50 rounded transition"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-neutral-400 italic">No external collaborators invited to this list yet.</p>
                  )}
                </div>

                {/* VISIBILITY TARGET SELECTOR (Organizations, Departments, Teams) */}
                <div className="space-y-4 border-t border-neutral-100 pt-6">
                  <div className="space-y-1">
                    <h4 className="text-xs font-black uppercase tracking-wider text-neutral-800">Department Availability Assignments</h4>
                    <p className="text-[10px] text-neutral-500">
                      Determine which onboarded entities have visibility and collaborative access to read and modify this asset checklist.
                    </p>
                  </div>

                  {/* A. Organizations selection */}
                  <div className="space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">Target Organizations</p>
                    {organizations.length === 0 ? (
                      <p className="text-[10px] text-neutral-400 italic bg-neutral-50 p-2.5 rounded-lg border border-neutral-100">No organizations currently onboarded.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {organizations.map(o => {
                          const isSel = visibilityOrgs.includes(o.id);
                          return (
                            <button
                              type="button"
                              key={o.id}
                              onClick={() => toggleFormVisibilityOrg(o.id)}
                              className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase transition flex items-center gap-1.5 ${isSel ? 'bg-blue-600 border-blue-600 text-white' : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100'}`}
                            >
                              <Building2 size={12} />
                              <span>{o.name}</span>
                              {isSel && <Check size={10} />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* B. Departments selection */}
                  <div className="space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">Target Departments</p>
                    {departments.length === 0 ? (
                      <p className="text-[10px] text-neutral-400 italic bg-neutral-50 p-2.5 rounded-lg border border-neutral-100">No departments currently onboarded.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {departments.map(d => {
                          const isSel = visibilityDepts.includes(d.id);
                          const orgName = organizations.find(o => o.id === d.orgId)?.name || 'Partner Org';
                          return (
                            <button
                              type="button"
                              key={d.id}
                              onClick={() => toggleFormVisibilityDept(d.id)}
                              className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase transition flex items-center gap-1.5 ${isSel ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100'}`}
                            >
                              <Layers size={11} />
                              <span>{d.name} ({orgName})</span>
                              {isSel && <Check size={10} />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* C. Teams selection */}
                  <div className="space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">Target Teams</p>
                    {teams.length === 0 ? (
                      <p className="text-[10px] text-neutral-400 italic bg-neutral-50 p-2.5 rounded-lg border border-neutral-100">No teams currently onboarded.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {teams.map(t => {
                          const isSel = visibilityTeams.includes(t.id);
                          const orgName = organizations.find(o => o.id === t.orgId)?.name || 'Partner Org';
                          return (
                            <button
                              type="button"
                              key={t.id}
                              onClick={() => toggleFormVisibilityTeam(t.id)}
                              className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase transition flex items-center gap-1.5 ${isSel ? 'bg-emerald-650 bg-emerald-600 border-emerald-600 text-white' : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100'}`}
                            >
                              <GitBranch size={11} />
                              <span>{t.name} ({orgName})</span>
                              {isSel && <Check size={10} />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => setIsCreatingInventory(false)}
                    className="flex-1 px-4 py-4 bg-neutral-150 bg-neutral-100 rounded-xl text-neutral-600 font-bold uppercase tracking-wider text-[10px] transition-colors hover:bg-neutral-250 hover:bg-neutral-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] px-4 py-4 bg-black rounded-xl text-white font-black uppercase tracking-wider text-[10px] transition-colors hover:bg-neutral-800"
                  >
                    {editingInventory ? 'Apply Changes' : 'Initialize Inventory Set'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. EXCEL / CSV / URL IMPORTER DIALOGUE PANEL WITH AI ENGINE COLUMN MAPPING */}
      <AnimatePresence>
        {isImporterOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { if (!isSubmittingImport) setIsImporterOpen(false); }}
              className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-3xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 md:p-8 flex items-center justify-between border-b border-neutral-100 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-100 text-emerald-600 block">
                    <FileSpreadsheet size={22} />
                  </span>
                  <div>
                    <h2 className="text-xl font-bold uppercase tracking-tight">Cloud Inventory Importer</h2>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0066cc]">
                      TARGET: {selectedInventory?.name}
                    </p>
                  </div>
                </div>

                <button
                  disabled={isSubmittingImport}
                  onClick={() => setIsImporterOpen(false)}
                  className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-900 transition disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>

              {/* STEP 1: LOAD SOURCE FILES OR PUBLIC URLs */}
              {importStep === 1 && (
                <div className="p-6 md:p-8 space-y-6 overflow-y-auto">
                  
                  {/* File Drag and Drop container option */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-neutral-250 border-neutral-200 hover:border-black rounded-[2rem] p-8 md:p-12 text-center cursor-pointer transition bg-neutral-50/50 hover:bg-neutral-50 flex flex-col items-center justify-center space-y-3"
                  >
                    <Upload size={36} className="text-neutral-400 animate-pulse" />
                    <div className="space-y-1">
                      <p className="font-bold text-sm text-neutral-800">Drag & Drop Spreadsheet here</p>
                      <p className="text-[10px] text-neutral-450 uppercase font-black">or click to browse local files (CSV, XLS, XLSX)</p>
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleSpreadsheetFileSelect}
                      accept=".csv, .xlsx, .xls"
                      className="hidden"
                    />
                  </div>

                  {/* URL Loader textbox option */}
                  <div className="space-y-3 pt-6 border-t border-neutral-100">
                    <div className="space-y-1">
                      <h4 className="text-xs font-black uppercase tracking-wider text-neutral-800 flex items-center gap-1.5">
                        <Globe size={13} className="text-blue-500" />
                        <span>Remote Spreadsheet link (Public URL)</span>
                      </h4>
                      <p className="text-[10px] text-neutral-500">
                        Paste reference link to direct public XLS or CSV files. (Verify CORS header controls of original file repository if access times out).
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="https://example.com/assets/inventory_sheet.xlsx"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        className="flex-1 bg-neutral-50 hover:bg-neutral-100/50 border border-neutral-200 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-black h-11"
                      />
                      <button
                        onClick={handleURLImport}
                        className="px-5 bg-black hover:bg-neutral-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition shrink-0"
                      >
                        Fetch & Parse
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: CONFIGURE AI COLUMN SCHEMAS MAPPING */}
              {importStep === 2 && (
                <div className="flex-1 overflow-y-auto flex flex-col h-full select-none">
                  
                  {/* AI Mapping Status Box */}
                  <div className="p-4 bg-blue-50/40 border-b border-blue-100/50 px-6 md:px-8 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2 text-neutral-850">
                      <Sparkles size={16} className="text-[#0066cc]" />
                      <span className="text-[10px] font-black uppercase tracking-wide">
                        {isMappingLoading ? "🤖 AI is generating schema matches..." : "🤖 Column alignment schemas set"}
                      </span>
                    </div>
                    <p className="text-[10px] text-neutral-500 font-bold">
                      Parsed {importData.length} records.
                    </p>
                  </div>

                  <div className="p-6 md:p-8 space-y-6 flex-1">
                    <div className="space-y-1">
                      <h4 className="text-xs font-black uppercase tracking-wider text-neutral-800">Assign Schema Header Mapping Pairs</h4>
                      <p className="text-[10px] text-neutral-500">
                        Verify spreadsheet columns map precisely to database Schema parameters. Handlers ignore omitted parameters safely.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { field: 'name', label: 'Asset Name (Required) *' },
                        { field: 'brand', label: 'Manufacturer Brand' },
                        { field: 'model', label: 'Item Model' },
                        { field: 'modelNumber', label: 'Model Number' },
                        { field: 'serialNumber', label: 'Serial Key Value' },
                        { field: 'primaryCategory', label: 'Category Classifier' },
                        { field: 'price', label: 'Asset Valuation Price' },
                        { field: 'quantity', label: 'Count Quantity' },
                      ].map(schemaField => (
                        <div key={schemaField.field} className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-150 flex items-center justify-between gap-4">
                          <label className="text-[10px] font-black uppercase tracking-wider text-neutral-700 min-w-0 truncate block">
                            {schemaField.label}
                          </label>
                          <select
                            value={headerMappings[schemaField.field] || ''}
                            onChange={(e) => setHeaderMappings(prev => ({
                              ...prev,
                              [schemaField.field]: e.target.value
                            }))}
                            className="bg-white border border-neutral-200 rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none max-w-[12rem] truncate"
                          >
                            <option value="">-- Ignore / Omit --</option>
                            {importHeaders.map((headerText, index) => (
                              <option key={index} value={index}>
                                {index + 1}. {headerText || `(Col ${index + 1})`}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>

                    {/* Progress upload box */}
                    {isSubmittingImport && (
                      <div className="space-y-2 p-4 bg-neutral-50 rounded-xl border border-neutral-150">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-neutral-600">
                          <span>Bulk Upload in progress...</span>
                          <span>{importProgressPercent}%</span>
                        </div>
                        <div className="w-full bg-neutral-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full transition-all duration-350"
                            style={{ width: `${importProgressPercent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 pt-4 border-t border-neutral-100 flex-shrink-0">
                      <button
                        type="button"
                        disabled={isSubmittingImport}
                        onClick={() => setImportStep(1)}
                        className="flex-1 px-4 py-4 bg-neutral-100 hover:bg-neutral-250 hover:bg-neutral-200 rounded-xl text-neutral-600 font-bold uppercase tracking-wider text-[10px] transition disabled:opacity-50"
                      >
                        Reset Source
                      </button>

                      <button
                        type="button"
                        disabled={isSubmittingImport || Object.keys(headerMappings).length === 0}
                        onClick={handleExecuteImport}
                        className="flex-[2] px-4 py-4 bg-black select-none text-white font-black uppercase tracking-wider text-[10px] transition flex items-center justify-center gap-2 hover:bg-neutral-800 disabled:opacity-50"
                      >
                        {isSubmittingImport ? (
                          <>
                            <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                            <span>Uploading sheet records...</span>
                          </>
                        ) : (
                          <>
                            <Check size={14} className="text-emerald-400" />
                            <span>Map columns & Save All Items</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. INDIVIDUAL MANUAL ITEM EDIT / CREATOR DIALOGUE BLOCK */}
      <AnimatePresence>
        {isAddingItemManually && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingItemManually(false)}
              className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 md:p-8 flex items-center justify-between border-b border-neutral-100 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <span className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-100 text-neutral-900 block">
                    <Package size={20} />
                  </span>
                  <div>
                    <h2 className="text-xl font-bold uppercase tracking-tight">
                      {editingItem ? "Edit Asset properties" : "Add Asset Item"}
                    </h2>
                    <p className="text-[9px] font-black uppercase tracking-wider text-[#0066cc]">
                      TARGET LIST: {selectedInventory?.name}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsAddingItemManually(false)}
                  className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-900 transition"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveManualItem} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block ml-1">Asset Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sony FX6 Cinema Camera"
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                    className="w-full bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-black h-11"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block ml-1">Brand Manufacturer</label>
                    <input
                      type="text"
                      placeholder="e.g. Sony"
                      value={itemForm.brand}
                      onChange={(e) => setItemForm({ ...itemForm, brand: e.target.value })}
                      className="w-full bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-black h-11"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block ml-1">Model Series</label>
                    <input
                      type="text"
                      placeholder="e.g. Cinema Line"
                      value={itemForm.model}
                      onChange={(e) => setItemForm({ ...itemForm, model: e.target.value })}
                      className="w-full bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-black h-11"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block ml-1">Model Number</label>
                    <input
                      type="text"
                      placeholder="e.g. ILME-FX6V"
                      value={itemForm.modelNumber}
                      onChange={(e) => setItemForm({ ...itemForm, modelNumber: e.target.value })}
                      className="w-full bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-black h-11"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block ml-1">Serial Number key</label>
                    <input
                      type="text"
                      placeholder="e.g. SN-998823"
                      value={itemForm.serialNumber}
                      onChange={(e) => setItemForm({ ...itemForm, serialNumber: e.target.value })}
                      className="w-full bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-black h-11"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block ml-1 font-mono">Original category</label>
                    <select
                      value={itemForm.primaryCategory}
                      onChange={(e) => setItemForm({ ...itemForm, primaryCategory: e.target.value })}
                      className="w-full bg-neutral-50 border border-neutral-100 rounded-xl px-3 py-3 text-xs outline-none focus:ring-1 focus:ring-black h-11"
                    >
                      {['Camera', 'Lens', 'Audio', 'Lighting', 'Support', 'Electronics', 'Cables', 'Power', 'Accessories', 'Other'].map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block ml-1">Purchase Valuation Price ($)</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      min={0}
                      step="any"
                      value={itemForm.price}
                      onChange={(e) => setItemForm({ ...itemForm, price: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-black h-11"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block ml-1">Quantity</label>
                    <input
                      type="number"
                      placeholder="1"
                      min={1}
                      value={itemForm.quantity}
                      onChange={(e) => setItemForm({ ...itemForm, quantity: parseInt(e.target.value) || 1 })}
                      className="w-full bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-black h-11"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block ml-1">Condition</label>
                    <select
                      value={itemForm.condition}
                      onChange={(e) => setItemForm({ ...itemForm, condition: e.target.value as any })}
                      className="w-full bg-neutral-50 border border-neutral-100 rounded-xl px-3 py-3 text-xs outline-none focus:ring-1 focus:ring-black h-11"
                    >
                      <option value="new">New</option>
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="poor">Poor</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block ml-1">Operational Status</label>
                    <select
                      value={itemForm.status}
                      onChange={(e) => {
                        if (e.target.value === 'in_use') {
                          toast.error("Standard catalog items cannot be checked out (set to 'In Use') individually. To check out, include them in an active project Packing List or use Kiosk Terminal Mode.", {
                            duration: 5000
                          });
                          return;
                        }
                        setItemForm({ ...itemForm, status: e.target.value as any });
                      }}
                      className="w-full bg-neutral-50 border border-neutral-100 rounded-xl px-2 py-3 text-xs outline-none focus:ring-1 focus:ring-black h-11"
                    >
                      <option value="available">Available</option>
                      <option value="in_use">In Use (Handover Required)</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="retired">Retired</option>
                      <option value="missing">Missing</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[#0066cc] block">Photo URL / Image Link</label>
                    <span className="text-[8px] font-bold text-neutral-400 uppercase">Interactive direct url</span>
                  </div>
                  <div className="flex gap-3">
                    <input
                      type="url"
                      placeholder="Paste image URL (e.g. Unsplash, Imgur)..."
                      value={itemForm.photoUrl || ''}
                      onChange={(e) => setItemForm({ ...itemForm, photoUrl: e.target.value })}
                      className="flex-1 bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-black h-11"
                    />
                    {itemForm.photoUrl && (
                      <div className="w-11 h-11 rounded-xl overflow-hidden border border-neutral-100 bg-neutral-150 shrink-0 shadow-sm">
                        <img src={itemForm.photoUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Privacy View Layers Selector */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-primary block ml-1 font-bold">Privacy View Layers & Access Mode</label>
                  <select 
                    value={itemForm.visibility || 'public'}
                    onChange={(e) => setItemForm({ ...itemForm, visibility: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-black h-11 font-semibold text-neutral-700"
                  >
                    <option value="private">🔒 Private View Layer (User level - Only me)</option>
                    <option value="team">👥 Team View Layer (Visible only in My Team)</option>
                    <option value="dept">🏢 Department View Layer (Visible only in My Dept)</option>
                    <option value="org">🏛️ Organization View Layer (Visible only in My Org)</option>
                    <option value="public">🌐 Public Access Layer (Visible to everyone)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block ml-1">Asset Description</label>
                  <textarea
                    placeholder="Provide storage position notes, model specifics, or team check-in values..."
                    value={itemForm.description}
                    rows={2}
                    onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                    className="w-full bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-black"
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t border-neutral-100 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsAddingItemManually(false)}
                    className="flex-1 px-4 py-3.5 bg-neutral-100 hover:bg-neutral-200 rounded-xl text-neutral-600 font-bold uppercase tracking-wider text-[10px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] px-4 py-3.5 bg-black hover:bg-neutral-800 text-white font-black uppercase tracking-wider text-[10px]"
                  >
                    {editingItem ? 'Save Asset Details' : 'Add to Checklist'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. GENERAL ASSET ASSIGNMENT TRIGGER PANEL */}
      <AnimatePresence>
        {allocationIsAssigning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAllocationIsAssigning(false)}
              className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-8">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center shadow-lg">
                        <ArrowRight size={22} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold uppercase tracking-tight">Bulk Asset Assignment</h2>
                        <p className="text-neutral-450 text-[9px] font-black uppercase tracking-wider">Mapping {allocationSelected.size} Assets</p>
                      </div>
                   </div>
                   <button onClick={() => setAllocationIsAssigning(false)} className="p-2 hover:bg-neutral-100 rounded-full transition">
                     <X size={18} />
                   </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block ml-1">Target Organization</label>
                    <select 
                      value={allocationAssignTarget.orgId || ''}
                      onChange={(e) => setAllocationAssignTarget({ ...allocationAssignTarget, orgId: e.target.value })}
                      className="w-full bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-black h-12"
                    >
                      <option value="">None / Unassigned</option>
                      {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block ml-1">Target Department</label>
                    <select 
                      disabled={!allocationAssignTarget.orgId}
                      value={allocationAssignTarget.deptId || ''}
                      onChange={(e) => setAllocationAssignTarget({ ...allocationAssignTarget, deptId: e.target.value })}
                      className="w-full bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-black h-12 disabled:opacity-50"
                    >
                      <option value="">None / Unassigned</option>
                      {departments.filter(d => d.orgId === allocationAssignTarget.orgId).map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block ml-1">Target Team</label>
                    <select 
                      disabled={!allocationAssignTarget.deptId}
                      value={allocationAssignTarget.teamId || ''}
                      onChange={(e) => setAllocationAssignTarget({ ...allocationAssignTarget, teamId: e.target.value })}
                      className="w-full bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-black h-12 disabled:opacity-50"
                    >
                      <option value="">None / Unassigned</option>
                      {teams.filter(t => t.deptId === allocationAssignTarget.deptId).map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block ml-1">Assign to Member</label>
                    <select 
                      value={allocationAssignTarget.assignedTo || ''}
                      onChange={(e) => setAllocationAssignTarget({ ...allocationAssignTarget, assignedTo: e.target.value })}
                      className="w-full bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-black h-12"
                    >
                      <option value="">None / Open (Float)</option>
                      {users.map(u => <option key={u.uid} value={u.uid}>{u.displayName} ({u.email})</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-neutral-100">
                  <button 
                    onClick={() => setAllocationIsAssigning(false)}
                    className="flex-1 px-4 py-3.5 bg-neutral-100 hover:bg-neutral-250 hover:bg-neutral-200 rounded-xl text-neutral-600 font-bold uppercase tracking-wider text-[10px]"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleBulkAssign}
                    className="flex-[2] px-4 py-3.5 bg-black text-white rounded-xl font-black uppercase tracking-wider text-[10px] hover:bg-neutral-800 transition"
                  >
                    Save Allocations
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BOM LEAD TIME & RISKS MODAL */}
      <AnimatePresence>
        {isBomModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBomModalOpen(false)}
              className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-8 border-b border-neutral-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center shadow-lg">
                    <Cpu size={22} className="animate-spin text-primary" style={{ animationDuration: '3s' }} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tight">Supply Chain & Lead Time Analyzer</h2>
                    <p className="text-neutral-450 text-[9px] font-black uppercase tracking-wider">
                      Module Status: Active v1.0.8 • System: {adminSettings?.integrationConfig?.bomLeadServiceEnabled ? "Live Gemini AI Scraper" : "Offline Simulation"}
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsBomModalOpen(false)} className="p-2 hover:bg-neutral-100 rounded-full transition">
                  <X size={18} />
                </button>
              </div>

              <div className="p-8 space-y-6 overflow-y-auto flex-1">
                {isAnalyzingBom ? (
                  <div className="py-16 text-center space-y-4">
                    <div className="w-12 h-12 border-4 border-black/10 border-t-black rounded-full animate-spin mx-auto" />
                    <p className="text-xs font-mono font-bold uppercase tracking-widest text-[#ff4f3a]">
                      Querying distributors, calculating backlog queues ...
                    </p>
                  </div>
                ) : bomAnalysisResult ? (
                  <div className="space-y-6">
                    {/* Source Warning Tag */}
                    <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                      bomAnalysisResult.source?.includes("Live") 
                        ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
                        : "bg-amber-50 border-amber-100 text-amber-800"
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 bg-current rounded-full animate-pulse" />
                        <span className="text-[10px] font-mono font-black uppercase tracking-widest">
                          {bomAnalysisResult.source || "Heuristic Engine fallback"}
                        </span>
                      </div>
                      <span className="text-[8px] font-mono font-bold bg-white/60 px-2 py-0.5 rounded-full">
                        THRESHOLD: {adminSettings?.integrationConfig?.bomRiskThreshold || 7} DAYS
                      </span>
                    </div>

                    {/* Summary box */}
                    <div className="bg-neutral-50 p-6 rounded-[1.5rem] border border-neutral-100 space-y-2">
                      <h4 className="text-xs font-black uppercase tracking-tight text-neutral-900">Analysis Summary</h4>
                      <p className="text-xs text-neutral-600 leading-relaxed font-semibold">
                        {bomAnalysisResult.summary}
                      </p>
                    </div>

                    {/* Table / Results */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-tight text-neutral-900">Itemized Lead-Times & Risks</h4>
                      <div className="space-y-3">
                        {bomAnalysisResult.analysis?.map((item: any, idx: number) => (
                          <div key={idx} className="bg-white p-4 rounded-2xl border border-neutral-100 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-md transition">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-neutral-900">{item.itemName}</span>
                                <span className="text-[9px] text-[#ff4f3a] bg-[#ff4f3a]/10 px-2 py-0.5 rounded-full font-bold uppercase">
                                  {item.category}
                                </span>
                              </div>
                              <p className="text-xs text-neutral-500 leading-relaxed">{item.notes}</p>
                              {item.alternativeSupplier && (
                                <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mt-1">
                                  Alt Vendor: {item.alternativeSupplier}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                              <div className="text-right">
                                <p className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest leading-none">EST. READY</p>
                                <p className="text-md font-black">{item.estimatedLeadDays} Days</p>
                              </div>
                              <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest ${
                                item.riskLevel === 'high' 
                                  ? 'bg-rose-100 text-rose-700' 
                                  : item.riskLevel === 'medium' 
                                  ? 'bg-amber-100 text-amber-700' 
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}>
                                {item.riskLevel}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Mitigation Protocols */}
                    {bomAnalysisResult.generalMitigation && (
                      <div className="bg-emerald-50/50 p-6 rounded-[1.5rem] border border-emerald-50 space-y-2">
                        <h4 className="text-xs font-black uppercase tracking-tight text-emerald-900">Mitigation Protocol Recommendations</h4>
                        <p className="text-xs text-emerald-700 leading-relaxed font-semibold">
                          {bomAnalysisResult.generalMitigation}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-16 text-center text-neutral-400 font-bold uppercase tracking-widest text-xs">
                    No results available
                  </div>
                )}
              </div>

              <div className="p-8 border-t border-neutral-100 flex-shrink-0">
                <button 
                  onClick={() => setIsBomModalOpen(false)}
                  className="w-full py-4 bg-neutral-900 hover:bg-black text-white rounded-[1.5rem] font-bold uppercase tracking-widest text-[10px] transition"
                >
                  Close Analysis
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
