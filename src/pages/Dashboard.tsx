import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useIndustry } from '../context/IndustryContext';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, collectionGroup } from 'firebase/firestore';
import { Plus, Package, Trash2, ChevronRight, Clock, Box, X, Zap, Bell, Calendar, CheckCircle2, AlertCircle, Share2, QrCode, Home, Wrench, Layers, Briefcase, ShoppingBag, Truck, ShieldCheck, Search, Filter, SortAsc, SortDesc, LayoutGrid, List as ListIcon, PanelLeftClose, PanelLeftOpen, ChevronLeft, Menu, TrendingUp, Heart, PieChart, Activity, Users, Building2, Globe, Mail, MapPin, Building, Download, ArrowRightLeft } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, PackingList, Reminder, AdminSettings, FeatureKey, GearItem, Organization, Workspace, INDUSTRIES } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { updateDoc, getDoc } from 'firebase/firestore';
import { isFeatureEnabled } from '../lib/featureUtils';
import { checkLimit } from '../lib/limitUtils';
import { toast } from 'sonner';
import Marketplace from './Marketplace';
import DeveloperTab from '../components/DeveloperTab';
import ShareModal from '../components/ShareModal';
import ManualCheckoutModal from '../components/ManualCheckoutModal';
import { logActivity } from '../services/activityLog';
import ActivityLog from '../components/ActivityLog';

type DashboardTab = 'overview' | 'lists' | 'templates' | 'directories' | 'marketplace' | 'developer' | 'beta_bugs';
type SortField = 'createdAt' | 'name' | 'status';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';

// Helper to compress and resize images into compact JPEGs to fit Firestore safely (<100KB)
function compressAndResizeImage(file: File, maxWidth = 800, maxHeight = 600, quality = 0.65): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (event) => {
      const img = new window.Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string || '');
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function Dashboard({ user, adminSettings: propAdminSettings }: { user: UserProfile, adminSettings: AdminSettings | null }) {
  const [lists, setLists] = useState<PackingList[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [adminSettings, setAdminSettings] = useState<AdminSettings | null>(propAdminSettings);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [sharingList, setSharingList] = useState<PackingList | null>(null);
  const [checkoutList, setCheckoutList] = useState<PackingList | null>(null);
  const [gear, setGear] = useState<GearItem[]>([]);
  const [newListName, setNewListName] = useState('');
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [allItems, setAllItems] = useState<any[]>([]);
  
  // User's submitted Bug Reports state
  const [userBugs, setUserBugs] = useState<any[]>([]);
  // Form input fields for Bug filing
  const [newBugTitle, setNewBugTitle] = useState('');
  const [newBugDesc, setNewBugDesc] = useState('');
  const [newBugModule, setNewBugModule] = useState('General UI');
  const [newBugSeverity, setNewBugSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('low');
  const [isBugSubmitting, setIsBugSubmitting] = useState(false);
  const [bugScreenshots, setBugScreenshots] = useState<string[]>([]);
  const [isBugUploading, setIsBugUploading] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  
  // Custom public directories & sub-group list states
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [orgsList, setOrgsList] = useState<Organization[]>([]);
  const [isDirectoriesLoading, setIsDirectoriesLoading] = useState(true);
  const [directoryType, setDirectoryType] = useState<'orgs' | 'users'>('orgs');
  
  // Search, Sort, Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [kioskActive, setKioskActive] = useState<boolean>((user as any).kioskModuleActive || false);
  const activePlan = adminSettings?.plans?.find(p => p.id === user.plan || p.name.toLowerCase() === user.plan?.toLowerCase()) || adminSettings?.plans?.[0];

  const navigate = useNavigate();
  const location = useLocation();
  const hasShownMaintenanceToast = React.useRef(false);

  // Multi-Workspace Industry states and custom terms calculations
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceIndustry, setNewWorkspaceIndustry] = useState('production');
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);

  // Specialized safety & fleet simulations
  const [constructionLogs, setConstructionLogs] = useState<any[]>([
    { id: 1, type: 'critical', text: 'OSHA Alert: Grinder safety shield missing (ID: CTR-082) - Action Required', date: 'Just now' },
    { id: 2, type: 'success', text: 'Drop Test: 12 Rigging chains certified & stamped', date: '2 hours ago' },
    { id: 3, type: 'info', text: 'Routine Check: Site Generator GSE-9 fuel & fluid scan passed', date: 'Yesterday' }
  ]);
  const [fleetVehicles, setFleetVehicles] = useState<any[]>([
    { id: 1, name: 'Ford Transit Cargo Van #3', plate: 'CTR-492', status: 'In Use', holder: 'Steve Rogers', mileage: 48500, fuel: 82 },
    { id: 2, name: 'Toyota Hilux Crew Cab #1', plate: 'WLD-091', status: 'Available', holder: '', mileage: 12400, fuel: 100 },
    { id: 3, name: 'Tesla Model Y Delivery #6', plate: 'FLE-205', status: 'In Repair', holder: 'Garage Slot 3', mileage: 84000, fuel: 35 }
  ]);

  const { activeIndustry, customTerms, currentWorkspace, isConstruction, isAutomotive, getAdjustedLabel } = useIndustry();

  const visibleButtons = user.layoutPreferences?.visibleQuickActions || ['packing_list', 'inventory', 'rack', 'system_build', 'listing'];

  const currentWorkspaceId = currentWorkspace?.id || null;

  // Filter lists & gear of standard user fetches by currently active industry workspace sandbox
  const workspaceFilteredLists = React.useMemo(() => {
    if (!currentWorkspaceId) return lists;
    return lists.filter(list => !list.workspaceId || list.workspaceId === currentWorkspaceId);
  }, [lists, currentWorkspaceId]);

  const workspaceFilteredGear = React.useMemo(() => {
    if (!currentWorkspaceId) return gear;
    return gear.filter(item => !item.workspaceId || item.workspaceId === currentWorkspaceId);
  }, [gear, currentWorkspaceId]);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    const currentWorkspaces = user.workspaces || [];
    const maxWorkspacesLimit = activePlan?.maxWorkspaces || 1;

    if (currentWorkspaces.length >= maxWorkspacesLimit) {
      toast.error(
        `Workspace Limit Reached. Your active plan integrates max ${maxWorkspacesLimit} workspace(s). Upgrade to add more industries!`
      );
      return;
    }

    try {
      const newWsId = `ws_${Math.random().toString(36).substring(2, 11)}`;
      const newWsObj = {
        id: newWsId,
        name: newWorkspaceName.trim(),
        industry: newWorkspaceIndustry,
        createdAt: new Date().toISOString()
      };

      const updatedWorkspaces = [...currentWorkspaces, newWsObj];
      await updateDoc(doc(db, 'users', user.uid), {
        workspaces: updatedWorkspaces,
        activeWorkspaceId: newWsId,
        selectedIndustry: newWorkspaceIndustry
      });

      toast.success(`Launched "${newWorkspaceName}" workspace sandbox!`);
      setNewWorkspaceName('');
      setIsWorkspaceModalOpen(false);
    } catch (err) {
      console.error("Error creating workspace:", err);
      toast.error("Failed to create workspace sandbox.");
    }
  };

  const handleSwitchWorkspace = async (wsId: string) => {
    try {
      const targetWs = user.workspaces?.find(w => w.id === wsId);
      await updateDoc(doc(db, 'users', user.uid), {
        activeWorkspaceId: wsId,
        selectedIndustry: targetWs?.industry || 'general'
      });
      toast.success(`Switched active environment to ${targetWs?.name}`);
      setIsWorkspaceDropdownOpen(false);
    } catch (err) {
      console.error("Error toggling workspace active tab:", err);
      toast.error("Failed to switch workspace environment.");
    }
  };

  // Filter gear items that have reached their maintenanceIntervalDays cycle thresholds
  const maintenanceAlerts = React.useMemo(() => {
    return gear.map(item => {
      if (!item.maintenanceIntervalDays || item.maintenanceIntervalDays <= 0) {
        return null;
      }
      
      if (item.status === 'maintenance') {
        return {
          item,
          isOverdue: true,
          status: 'maintenance' as const,
          daysRemaining: 0,
          nextDueText: 'Currently undergoing maintenance'
        };
      }
      
      if (item.condition === 'poor') {
        return {
          item,
          isOverdue: true,
          status: 'overdue' as const,
          daysRemaining: 0,
          nextDueText: 'Poor Condition - Requires service action'
        };
      }
      
      if (!item.lastMaintenanceDate) {
        return {
          item,
          isOverdue: true,
          status: 'overdue' as const,
          daysRemaining: 0,
          nextDueText: 'Never Maintained - Schedule now'
        };
      }
      
      try {
        const last = new Date(item.lastMaintenanceDate).getTime();
        const nextDue = last + (item.maintenanceIntervalDays * 24 * 60 * 60 * 1000);
        const diffMs = nextDue - Date.now();
        const daysRemaining = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
        const isOverdue = diffMs < 0;
        
        // Show if overdue or nearing in next 10 days
        if (daysRemaining <= 10) {
          return {
            item,
            isOverdue,
            status: isOverdue ? ('overdue' as const) : ('soon' as const),
            daysRemaining,
            nextDueText: isOverdue 
              ? `Overdue by ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) !== 1 ? 's' : ''}` 
              : `Due in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`
          };
        }
      } catch (e) {
        return {
          item,
          isOverdue: true,
          status: 'overdue' as const,
          daysRemaining: 0,
          nextDueText: 'Error parsing date'
        };
      }
      return null;
    }).filter((a): a is NonNullable<typeof a> => a !== null);
  }, [gear]);

  // Load-time maintenance UI alert trigger
  useEffect(() => {
    if (loading || gear.length === 0 || hasShownMaintenanceToast.current) return;
    
    const overdueCount = maintenanceAlerts.filter(a => a.isOverdue).length;
    if (overdueCount > 0) {
      hasShownMaintenanceToast.current = true;
      toast.warning(`Maintenance Alert: ${overdueCount} gear item${overdueCount !== 1 ? 's' : ''} overdue for service!`, {
        description: "Review your Gear Maintenance Alerts panel to perform clean & fit or schedule reminders.",
        duration: 6000
      });
    }
  }, [loading, gear, maintenanceAlerts]);

  // App-wide Auto save & disrupted session recovery for newly created list & bug report draft
  useEffect(() => {
    if (user?.uid) {
      const savedListName = localStorage.getItem(`packer_autosave_newlist_${user.uid}`);
      if (savedListName) {
        setNewListName(savedListName);
        toast.info("Resumed disrupted list draft name.");
      }
      const savedBugTitle = localStorage.getItem(`packer_autosave_bugtitle_${user.uid}`);
      if (savedBugTitle) setNewBugTitle(savedBugTitle);

      const savedBugDesc = localStorage.getItem(`packer_autosave_bugdesc_${user.uid}`);
      if (savedBugDesc) setNewBugDesc(savedBugDesc);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (user?.uid) {
      localStorage.setItem(`packer_autosave_newlist_${user.uid}`, newListName);
    }
  }, [newListName, user?.uid]);

  useEffect(() => {
    if (user?.uid) {
      localStorage.setItem(`packer_autosave_bugtitle_${user.uid}`, newBugTitle);
      localStorage.setItem(`packer_autosave_bugdesc_${user.uid}`, newBugDesc);
    }
  }, [newBugTitle, newBugDesc, user?.uid]);

  const handleRecordItemMaintenanceDoc = async (itemId: string, itemName: string) => {
    try {
      await updateDoc(doc(db, 'users', user.uid, 'gearLibrary', itemId), {
        lastMaintenanceDate: new Date().toISOString().split('T')[0],
        status: 'available',
        condition: 'good'
      });
      toast.success(`Logged maintenance complete for "${itemName}". Interval reset!`);
    } catch (err) {
      console.error("Error logging gear item maintenance:", err);
      toast.error(`Failed to register maintenance log for "${itemName}".`);
    }
  };

  const handleCreateMaintenanceReminder = async (item: GearItem) => {
    try {
      const nextDueDate = item.lastMaintenanceDate 
        ? new Date(new Date(item.lastMaintenanceDate).getTime() + (item.maintenanceIntervalDays || 30) * 24 * 60 * 60 * 1000).toISOString()
        : new Date().toISOString();
      
      await addDoc(collection(db, 'reminders'), {
        ownerId: user.uid,
        listId: '',
        itemId: item.id,
        itemName: item.name,
        type: 'maintenance',
        dueDate: nextDueDate,
        status: 'pending',
        message: `Scheduled maintenance check for ${item.name}`,
        createdAt: new Date().toISOString()
      });
      toast.success(`Registered a formal maintenance task for "${item.name}"!`);
    } catch (err) {
      console.error("Error creating maintenance reminder document:", err);
      toast.error("Failed to register reminder task.");
    }
  };

  const handleTabChange = (tab: DashboardTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(location.search);
    params.set('tab', tab);
    navigate({ pathname: '/dashboard', search: `?${params.toString()}` }, { replace: true });
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('create') === 'true') {
      setIsCreating(true);
      params.delete('create');
      const searchStr = params.toString();
      navigate({ pathname: '/dashboard', search: searchStr ? `?${searchStr}` : '' }, { replace: true });
    }

    const tabParam = params.get('tab');
    if (tabParam === 'templates') {
      setActiveTab('templates');
    } else if (tabParam === 'lists') {
      setActiveTab('lists');
    } else if (tabParam === 'overview') {
      setActiveTab('overview');
    } else if (tabParam === 'directories') {
      setActiveTab('directories');
    } else if (tabParam === 'marketplace') {
      setActiveTab('marketplace');
    } else if (tabParam === 'developer') {
      setActiveTab('developer');
    }
  }, [location.search, navigate]);

  useEffect(() => {
    const qLists = query(collection(db, 'packingLists'), where('ownerId', '==', user.uid));
    const unsubscribeLists = onSnapshot(qLists, (snapshot) => {
      const fetchedLists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PackingList[];
      setLists(fetchedLists.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'packingLists');
    });

    const qReminders = query(collection(db, 'reminders'), where('ownerId', '==', user.uid), where('status', '==', 'pending'));
    const unsubscribeReminders = onSnapshot(qReminders, (snapshot) => {
      const fetchedReminders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Reminder[];
      setReminders(fetchedReminders.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reminders');
      setLoading(false);
    });

    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'adminSettings', 'global'));
        if (settingsDoc.exists()) {
          setAdminSettings(settingsDoc.data() as AdminSettings);
        }
      } catch (err) {
        console.warn("Dashboard: Error fetching global admin settings:", err);
      }
    };
    fetchSettings();

    const qGear = query(collection(db, 'users', user.uid, 'gearLibrary'));
    const unsubscribeGear = onSnapshot(qGear, (snapshot) => {
      const fetchedGear = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as GearItem[];
      setGear(fetchedGear);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/gearLibrary`);
    });

    // We replaced the insecure items collectionGroup search with a dynamic and secure lists-level subcollection listener below.
    const unsubscribeAllItems = () => {};

    const unsubscribeUsers = onSnapshot(query(collection(db, 'users'), where('isProfilePublic', '==', true)), (snapshot) => {
      const fetchedUsers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[];
      setUsersList(fetchedUsers);
      setIsDirectoriesLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users (public profiles)');
      setIsDirectoriesLoading(false);
    });

    const unsubscribeOrgs = onSnapshot(collection(db, 'organizations'), (snapshot) => {
      const fetchedOrgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Organization[];
      setOrgsList(fetchedOrgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'organizations');
    });

    const qBugs = query(collection(db, 'bugs'), where('userId', '==', user.uid));
    const unsubscribeBugs = onSnapshot(qBugs, (snapshot) => {
      setUserBugs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'bugs');
    });

    return () => {
      unsubscribeLists();
      unsubscribeReminders();
      unsubscribeGear();
      unsubscribeAllItems();
      unsubscribeUsers();
      unsubscribeOrgs();
      unsubscribeBugs();
    };
  }, [user.uid]);

  // Real-time listener for all items within the user's packing lists
  useEffect(() => {
    if (!lists || lists.length === 0) {
      setAllItems([]);
      return;
    }

    const unsubscribes = lists.map(list => {
      const q = query(collection(db, 'packingLists', list.id, 'items'));
      return onSnapshot(q, (snapshot) => {
        const listItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllItems(prev => {
          // Filter out existing items for this list and append new ones
          const filtered = prev.filter(item => item.listId !== list.id);
          return [...filtered, ...listItems];
        });
      }, (error) => {
        console.warn(`Error listening to items for list ${list.id}:`, error);
      });
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [lists]);

  const handleCompleteReminder = async (id: string) => {
    try {
      await updateDoc(doc(db, 'reminders', id), { status: 'completed' });
    } catch (error) {
      console.error("Error completing reminder:", error);
    }
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    const limitCheck = await checkLimit(user, adminSettings, 'packingLists');
    if (!limitCheck.allowed) {
      toast.error(`Limit reached: You can only have ${limitCheck.limit} packing lists on the ${user.plan} plan.`);
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'packingLists'), {
        ownerId: user.uid,
        ownerEmail: user.email,
        name: newListName,
        description: '',
        isTemplate: activeTab === 'templates',
        workspaceId: currentWorkspaceId,
        shareToken: Math.random().toString(36).substring(2, 15), // Generate token by default
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await logActivity(
        user.uid,
        user.displayName || user.email || 'Platform User',
        'list_add',
        `Created packing list "${newListName}"`,
        { listId: docRef.id, listName: newListName }
      );
      // Clear auto-saved draft list on successful creation
      if (user?.uid) {
        localStorage.removeItem(`packer_autosave_newlist_${user.uid}`);
      }
      setNewListName('');
      setIsCreating(false);
      navigate(`/list/${docRef.id}`);
    } catch (error) {
      console.error("Error creating list:", error);
    }
  };

  const handleDeleteList = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this list?")) {
      try {
        const targetList = lists.find(l => l.id === id);
        await deleteDoc(doc(db, 'packingLists', id));
        await logActivity(
          user.uid,
          user.displayName || user.email || 'Platform User',
          'list_delete',
          `Deleted packing list "${targetList?.name || 'Unknown List'}"`,
          { listId: id, listName: targetList?.name }
        );
      } catch (error) {
        console.error("Error deleting list:", error);
      }
    }
  };

  const filteredLists = workspaceFilteredLists.filter(list => {
    const matchesSearch = list.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || list.status === filterStatus;
    
    let matchesType = true;
    if (activeTab === 'templates') {
      matchesType = list.isTemplate;
    } else if (activeTab === 'lists') {
      // By default in 'lists' tab (Packing Lists), show only non-templates.
      // If user deliberately changed filterType state, honor it.
      if (filterType === 'all') {
        matchesType = !list.isTemplate;
      } else {
        matchesType = 
          (filterType === 'template' && list.isTemplate) || 
          (filterType === 'active' && !list.isTemplate) ||
          (filterType === 'marketplace' && list.marketplaceEnabled);
      }
    } else {
      matchesType = filterType === 'all' || 
        (filterType === 'template' && list.isTemplate) || 
        (filterType === 'active' && !list.isTemplate) ||
        (filterType === 'marketplace' && list.marketplaceEnabled);
    }
    return matchesSearch && matchesStatus && matchesType;
  }).sort((a, b) => {
    let comparison = 0;
    if (sortField === 'createdAt') {
      comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    } else if (sortField === 'name') {
      comparison = a.name.localeCompare(b.name);
    } else if (sortField === 'status') {
      const statusOrder: { [key: string]: number } = {
        'Draft': 0,
        'Active': 1,
        'Sent': 2,
        'Received': 3,
        'Completed': 4
      };
      const statusA = statusOrder[a.status || 'Draft'] || 0;
      const statusB = statusOrder[b.status || 'Draft'] || 0;
      comparison = statusA - statusB;
    }
    return sortOrder === 'desc' ? comparison : -comparison;
  });

  const recentLists = workspaceFilteredLists.slice(0, 4);

  const gearStats = {
    categoryData: Object.entries(
      workspaceFilteredGear.reduce((acc: Record<string, number>, item) => {
        acc[item.category || 'Other'] = (acc[item.category || 'Other'] || 0) + 1;
        return acc;
      }, {})
    ).map(([name, value]) => ({ name, value })),
    conditionData: [
      { name: 'New', value: workspaceFilteredGear.filter(i => i.condition === 'new').length, color: '#22c55e' },
      { name: 'Good', value: workspaceFilteredGear.filter(i => i.condition === 'good').length, color: '#3b82f6' },
      { name: 'Fair', value: workspaceFilteredGear.filter(i => i.condition === 'fair').length, color: '#f59e0b' },
      { name: 'Poor', value: workspaceFilteredGear.filter(i => i.condition === 'poor').length, color: '#ef4444' },
    ].filter(d => d.value > 0),
    topUsed: [...workspaceFilteredGear]
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .slice(0, 5),
    totalValue: workspaceFilteredGear.reduce((acc, item) => acc + (Number(item.price) || 0), 0),
    totalWeight: workspaceFilteredGear.reduce((acc, item) => acc + (Number(item.weight) || 0), 0),
    auditScore: workspaceFilteredGear.length > 0 ? (workspaceFilteredGear.filter(i => i.photoUrls && i.photoUrls.length > 0).length / workspaceFilteredGear.length) * 100 : 0,
    usageIntensity: workspaceFilteredGear.length > 0 ? workspaceFilteredGear.reduce((acc, i) => acc + (i.usageCount || 0), 0) / workspaceFilteredGear.length : 0
  };

  const distributionData = React.useMemo(() => {
    return workspaceFilteredLists.map(list => {
      const listItems = allItems.filter(item => item.listId === list.id);
      
      const totalWeight = listItems.reduce((acc, item) => {
        if (!item.weight) return acc;
        let w = Number(item.weight) || 0;
        const unit = (item.weightUnit || 'g').toLowerCase();
        if (unit === 'g') w = w / 1000;
        else if (unit === 'lb') w = w * 0.453592;
        else if (unit === 'oz') w = w * 0.0283495;
        return acc + w;
      }, 0);

      const totalValue = listItems.reduce((acc, item) => {
        return acc + (Number(item.price) || Number(item.val) || Number(item.cost) || 0);
      }, 0);

      return {
        id: list.id,
        name: list.name,
        weight: Number(totalWeight.toFixed(1)),
        value: Number(totalValue.toFixed(1)),
        itemCount: listItems.length
      };
    }).filter(d => d.itemCount > 0);
  }, [lists, allItems]);

  const COLORS = ['#F27D26', '#3b82f6', '#22c55e', '#a855f7', '#ec4899', '#f59e0b'];

  const projectStarters: { to: string, label: string, icon: React.ReactNode, description: string, feature?: FeatureKey }[] = [
    { to: '/projects', label: 'Projects Dashboard', icon: <ShieldCheck size={18} />, description: 'Essential project logistics' },
    { to: '/racks', label: 'Rack Management', icon: <Package size={18} />, description: 'AV equipment' },
    { to: '/tooling', label: 'Tooling Lists', icon: <Wrench size={18} />, description: 'Trades & mechanics', feature: 'toolingLists' as FeatureKey },
    { to: '/organizer', label: 'Organizer', icon: <Layers size={18} />, description: 'Container packing', feature: 'organizer' as FeatureKey },
    { to: '/travel-cases', label: 'Travel Cases', icon: <Briefcase size={18} />, description: 'Case dimensions', feature: 'travelCases' as FeatureKey },
    { to: '/logistics', label: 'Logistics', icon: <Truck size={18} />, description: 'Team kit tracking' },
  ].filter(item => !item.feature || isFeatureEnabled(item.feature, user, adminSettings));

  return (
    <div className="space-y-12">
      {/* Symmetrical Mode Switcher Bar */}
      <div className="flex justify-center md:justify-start">
        <div className="flex bg-neutral-105 p-1 rounded-2xl border border-neutral-200/60 w-fit shrink-0 shadow-sm">
          <button 
            type="button"
            onClick={() => {
              navigate('/marketplace');
              toast.success("Welcome to Peer-To-Peer Marketplace!");
            }}
            className="px-5 py-2 rounded-xl text-[10px] font-black text-neutral-500 hover:text-neutral-900 uppercase tracking-widest transition-all cursor-pointer"
          >
            Marketplace Hub
          </button>
          <button 
            type="button"
            className="px-5 py-2 rounded-xl text-[10px] font-black bg-[#ff4f3a] text-white shadow-sm uppercase tracking-widest transition-all"
          >
            Packer Tools
          </button>
        </div>
      </div>

      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-neutral-100 pb-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-black tracking-tight text-neutral-900">
              {customTerms.gearLabelPlural} Environment
            </h1>
            
            {/* Active Workspace Switcher */}
            {user.workspaces && user.workspaces.length > 0 && (
              <div className="relative inline-block text-left">
                <button
                  type="button"
                  onClick={() => setIsWorkspaceDropdownOpen(!isWorkspaceDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 border border-neutral-250 rounded-full text-xs font-black text-neutral-800 transition shadow-sm cursor-pointer"
                >
                  <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  <span className="uppercase tracking-wide">{currentWorkspace?.name || 'My Sandbox'}</span>
                  <span className="px-1.5 py-0.5 bg-neutral-200 text-neutral-600 rounded text-[8px] uppercase font-mono font-black shrink-0">
                    {customTerms.name}
                  </span>
                </button>

                {isWorkspaceDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-72 bg-white border border-neutral-200 rounded-2xl shadow-2xl z-50 p-2 space-y-1">
                    <p className="px-3 py-1.5 text-[8px] font-black uppercase text-neutral-400 tracking-widest border-b border-neutral-50 font-sans">
                      Select Workspace Sandbox
                    </p>
                    <div className="max-h-[180px] overflow-y-auto space-y-0.5">
                      {user.workspaces.map((ws: any) => {
                        const wsInd = INDUSTRIES.find(i => i.id === ws.industry) || INDUSTRIES[0];
                        const isActive = ws.id === currentWorkspace?.id;
                        return (
                          <button
                            key={ws.id}
                            type="button"
                            onClick={() => handleSwitchWorkspace(ws.id)}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between ${
                              isActive ? 'bg-primary/5 text-primary' : 'hover:bg-neutral-50 text-neutral-700'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <p className="truncate font-black">{ws.name}</p>
                              <p className="text-[9px] font-bold text-neutral-400 capitalize">{wsInd.name}</p>
                            </div>
                            {isActive && <CheckCircle2 size={12} className="text-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                    <div className="pt-2 border-t border-neutral-100 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsWorkspaceModalOpen(true);
                          setIsWorkspaceDropdownOpen(false);
                        }}
                        className="w-full text-center px-3 py-2 bg-neutral-900 hover:bg-black text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition flex items-center justify-center gap-1.5 shadow"
                      >
                        <Plus size={12} />
                        <span>Add Workspace Sandbox</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="text-neutral-500 text-sm leading-relaxed max-w-2xl">
            {customTerms.description} Dynamic custom settings for **{customTerms.gearLabelPlural}** &amp; **{customTerms.listLabelPlural}** enabled.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-primary text-white rounded-xl font-bold hover:bg-primary/95 transition shadow-lg w-full sm:w-auto text-xs uppercase tracking-wider font-bold"
          >
            <Plus size={16} />
            <span>New {customTerms.listLabelSingular}</span>
          </button>
          <button
            onClick={() => navigate('/library?addGear=true')}
            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition shadow-lg w-full sm:w-auto text-xs uppercase tracking-wider font-bold"
          >
            <Plus size={16} />
            <span>Add {customTerms.gearLabelSingular}</span>
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-neutral-100 p-1.5 rounded-2xl w-full sm:w-fit max-w-full overflow-x-auto whitespace-nowrap scrollbar-thin mb-8">
        <button
          onClick={() => handleTabChange('overview')}
          className={`px-6 py-2.5 rounded-xl font-bold transition-all text-xs uppercase tracking-wider shrink-0 ${
            activeTab === 'overview' 
              ? 'bg-white text-primary shadow-sm' 
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => handleTabChange('lists')}
          className={`px-6 py-2.5 rounded-xl font-bold transition-all text-xs uppercase tracking-wider shrink-0 ${
            activeTab === 'lists' 
              ? 'bg-white text-primary shadow-sm' 
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          {customTerms.listLabelPlural} ({workspaceFilteredLists.filter(l => !l.isTemplate).length})
        </button>
        <button
          onClick={() => handleTabChange('templates')}
          className={`px-6 py-2.5 rounded-xl font-bold transition-all text-xs uppercase tracking-wider shrink-0 ${
            activeTab === 'templates' 
              ? 'bg-white text-primary shadow-sm' 
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Templates ({workspaceFilteredLists.filter(l => l.isTemplate).length})
        </button>
        <button
          onClick={() => handleTabChange('directories')}
          className={`px-6 py-2.5 rounded-xl font-bold transition-all shrink-0 ${
            activeTab === 'directories' 
              ? 'bg-white text-primary shadow-sm' 
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Directories
        </button>
        <button
          onClick={() => handleTabChange('marketplace')}
          className={`px-6 py-2.5 rounded-xl font-bold transition-all shrink-0 ${
            activeTab === 'marketplace' 
              ? 'bg-white text-primary shadow-sm' 
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Marketplace
        </button>
        <button
          onClick={() => handleTabChange('developer')}
          className={`px-6 py-2.5 rounded-xl font-bold transition-all shrink-0 ${
            activeTab === 'developer' 
              ? 'bg-white text-primary shadow-sm' 
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Developer API & Embeds
        </button>
        {user?.isBetaTester && (
          <button
            onClick={() => handleTabChange('beta_bugs')}
            className={`px-6 py-2.5 rounded-xl font-bold transition-all text-xs uppercase tracking-wider flex items-center gap-1.5 shrink-0 ${
              activeTab === 'beta_bugs' 
                ? 'bg-purple-600 text-white shadow-sm' 
                : 'text-purple-600 bg-purple-50 hover:bg-purple-100'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-ping"></span>
            <span>🧪 Beta Bug Finder</span>
          </button>
        )}
      </div>

      {activeTab === 'overview' ? (
        <div className="space-y-12 animate-in fade-in duration-300 font-sans">
          {/* Construction Panel */}
          {isConstruction && user.layoutPreferences?.showSafetyConsole !== false && (
            <div className="bg-neutral-900 text-white rounded-[2rem] p-6 lg:p-8 border border-neutral-800 shadow-xl space-y-6 text-left relative overflow-hidden">
              {/* Background Accent */}
              <div className="absolute right-0 top-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
                <div className="space-y-1.5 font-sans">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      👷 Construction Worksite Sandbox
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-green-500/10 text-green-400">
                      OSHA Compliant
                    </span>
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tight text-neutral-100 flex items-center gap-2">
                    Safety & OSHA Audit Console
                  </h3>
                  <p className="text-xs text-neutral-400 font-semibold leading-relaxed">
                    Active compliance rating, load-bearing drop test logs, and equipment hazard flags.
                  </p>
                </div>

                <div className="bg-neutral-800 p-4 rounded-2xl flex items-center gap-4 border border-neutral-700 w-fit shrink-0">
                  <div className="text-center">
                    <div className="text-2xl font-black text-amber-400">98.4%</div>
                    <div className="text-[9px] uppercase font-black text-neutral-400 tracking-wider">Site Health</div>
                  </div>
                  <div className="h-8 w-px bg-neutral-700" />
                  <div className="text-center">
                    <div className="text-2xl font-black text-green-400">42 / 42</div>
                    <div className="text-[9px] uppercase font-black text-neutral-400 tracking-wider font-sans">Checked OK</div>
                  </div>
                </div>
              </div>

              {/* Simulation Quick Add */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-5 bg-neutral-850 p-5 rounded-2xl border border-neutral-850 space-y-4">
                  <h4 className="text-xs font-black uppercase text-amber-400 tracking-widest font-mono">
                    Log Tool Safety Clearance
                  </h4>
                  <p className="text-[11px] text-neutral-400 leading-normal font-semibold font-sans">
                    Simulate logging an drop-weight & insulation clearance stamp for equipment.
                  </p>
                  
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const toolNameInput = form.elements.namedItem('toolName') as HTMLInputElement;
                    const checkTypeInput = form.elements.namedItem('checkType') as HTMLSelectElement;
                    if (!toolNameInput.value.trim()) return;

                    const isPassed = checkTypeInput.value === 'PASSED';
                    const newLog = {
                      id: Date.now(),
                      type: isPassed ? 'success' : 'critical',
                      text: isPassed 
                        ? `Inspection Cleared: ${toolNameInput.value}`
                        : `Hazard Checked: ${toolNameInput.value} has cracked casing - Action Required`,
                      date: 'Just now'
                    };
                    setConstructionLogs([newLog, ...constructionLogs]);
                    toast.success(`Logged safety event: ${toolNameInput.value}`);
                    toolNameInput.value = '';
                  }} className="space-y-3">
                    <input
                      name="toolName"
                      type="text"
                      placeholder="e.g. Makita Core Rig (ID: CTR-09)"
                      className="w-full bg-neutral-950 max-w-none px-3.5 py-2.5 rounded-xl border border-neutral-700 text-xs focus:ring-1 focus:ring-amber-400 focus:border-amber-400 outline-none text-white font-medium"
                    />
                    <div className="flex gap-2">
                      <select 
                        name="checkType" 
                        className="flex-1 bg-neutral-950 px-3 py-2.5 rounded-xl border border-neutral-700 text-xs text-white focus:ring-1 focus:ring-amber-400 outline-none font-semibold cursor-pointer"
                      >
                        <option value="PASSED">Passed Drop Weight & Insulation Test</option>
                        <option value="FAILED">Flag Cracked / Failed Defect Alert</option>
                      </select>
                      <button
                        type="submit"
                        className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black uppercase text-[10px] tracking-wide px-4 py-2 rounded-xl transition shrink-0"
                      >
                        Add Event
                      </button>
                    </div>
                  </form>
                </div>

                <div className="lg:col-span-7 bg-neutral-850 p-5 rounded-2xl border border-neutral-850 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase text-neutral-400 tracking-widest font-mono">
                      Worksite Safety Compliance Logs
                    </h4>
                    <button
                      onClick={() => {
                        const alerts = [
                          "Simulated OSHA drop audit review completed cleanly.",
                          "Safety DRILL executed: All 12 workers reported hazard zones within 90 seconds.",
                          "Tooling Locker check completed: Ground cable replacements verified."
                        ];
                        const randomAlert = alerts[Math.floor(Math.random() * alerts.length)];
                        setConstructionLogs([
                          { id: Date.now(), type: 'info', text: randomAlert, date: 'Just now' },
                          ...constructionLogs
                        ]);
                        toast.success("Site inspection sweep simulated.");
                      }}
                      className="text-[10px] text-amber-450 hover:text-amber-300 font-bold uppercase tracking-wider"
                    >
                      Trigger Sweep
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-[140px] overflow-y-auto pr-1">
                    {constructionLogs.map((log) => (
                      <div 
                        key={log.id} 
                        className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                          log.type === 'critical' 
                            ? 'bg-red-500/10 border-red-500/20 text-red-300' 
                            : log.type === 'success'
                            ? 'bg-green-500/10 border-green-500/20 text-green-300'
                            : 'bg-neutral-900 border-neutral-800 text-neutral-300'
                        }`}
                      >
                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                        <div className="flex-1 space-y-0.5">
                          <p className="font-semibold leading-relaxed">{log.text}</p>
                          <span className="text-[9px] text-neutral-450 uppercase tracking-wider font-mono block">{log.date}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Automotive Panel */}
          {isAutomotive && user.layoutPreferences?.showFleetDispatch !== false && (
            <div className="bg-indigo-950 text-white rounded-[2rem] p-6 lg:p-8 border border-indigo-900 shadow-xl space-y-6 text-left relative overflow-hidden">
              {/* Background Accent */}
              <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-indigo-900">
                <div className="space-y-1.5 font-sans">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      🚗 Automotive & Fleet Sandbox
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-600 text-indigo-100 font-mono font-sans">
                      76.2% Utilization
                    </span>
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tight text-neutral-100 flex items-center gap-2">
                    Fleet Dispatch & Intake Tracker
                  </h3>
                  <p className="text-xs text-indigo-200 font-semibold leading-relaxed">
                    Live fleet vehicle checks, dispatcher trip route assignments, and mileage logs.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    onClick={() => {
                      const flagged = fleetVehicles.filter(v => v.mileage > 50000);
                      if (flagged.length > 0) {
                        toast.warning(`Service required: ${flagged.length} fleet vehicles have exceeded 50,000 miles service benchmark!`);
                      } else {
                        toast.success("Fleet audit complete. All vehicle milestones within normal operation limits.");
                      }
                    }}
                    className="px-4 py-2.5 bg-indigo-800 hover:bg-indigo-700 text-indigo-100 text-[10px] font-black uppercase tracking-widest rounded-xl transition border border-indigo-700"
                  >
                    Mileage Audit
                  </button>
                </div>
              </div>

              {/* Interactive Fleet Dispatch / Return */}
              <div className="bg-indigo-900/50 p-5 rounded-2xl border border-indigo-805">
                <h4 className="text-xs font-black uppercase text-indigo-300 tracking-widest font-mono mb-4 font-sans">
                  Live Dispatch Inventory Deck
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {fleetVehicles.map((vehicle) => (
                    <div 
                      key={vehicle.id}
                      className="bg-neutral-950 p-4 rounded-xl border border-neutral-900 space-y-4 text-xs font-sans"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-0.5">
                          <p className="font-extrabold text-neutral-100">{vehicle.name}</p>
                          <span className="text-[10px] font-mono text-neutral-400 bg-neutral-900 px-1.5 py-0.5 rounded uppercase">{vehicle.plate}</span>
                        </div>

                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                          vehicle.status === 'Available'
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : vehicle.status === 'In Use'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {vehicle.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] text-neutral-400 font-mono">
                        <div>
                          <span className="block text-neutral-500 text-[9px] uppercase font-bold">Odometer</span>
                          <span className="font-bold text-neutral-200">{vehicle.mileage.toLocaleString()} mi</span>
                        </div>
                        <div>
                          <span className="block text-neutral-500 text-[9px] uppercase font-bold">Fuel Level</span>
                          <span className="font-bold text-neutral-200">{vehicle.fuel}%</span>
                        </div>
                      </div>

                      {vehicle.status === 'In Use' ? (
                        <button
                          onClick={() => {
                            const updated = fleetVehicles.map(v => 
                              v.id === vehicle.id 
                                ? { ...v, status: 'Available', holder: '', mileage: v.mileage + Math.floor(Math.random() * 150) + 20, fuel: 100 }
                                : v
                            );
                            setFleetVehicles(updated);
                            toast.success(`Completed intake checkout for ${vehicle.name}. Vehicle returned with fuel topped off!`);
                          }}
                          className="w-full py-2 bg-indigo-500 text-neutral-950 hover:bg-indigo-400 text-[10px] font-black uppercase tracking-wider rounded-lg transition font-sans"
                        >
                          Verify Intake & Refuel
                        </button>
                      ) : vehicle.status === 'Available' ? (
                        <button
                          onClick={() => {
                            const updated = fleetVehicles.map(v => 
                              v.id === vehicle.id 
                                ? { ...v, status: 'In Use', holder: 'Shift Dispatch Driver' }
                                : v
                            );
                            setFleetVehicles(updated);
                            toast.success(`Dispatched ${vehicle.name} under temporary rental agreement checkout.`);
                          }}
                          className="w-full py-2 bg-neutral-900 text-indigo-450 hover:bg-neutral-850 text-[10px] font-black uppercase tracking-wider rounded-lg transition border border-indigo-950 font-sans"
                        >
                          Dispatch Vehicle
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const updated = fleetVehicles.map(v => 
                              v.id === vehicle.id 
                                ? { ...v, status: 'Available' }
                                : v
                            );
                            setFleetVehicles(updated);
                            toast.success(`${vehicle.name} repairs approved and returned to active service fleet.`);
                          }}
                          className="w-full py-2 bg-neutral-900 text-red-400 hover:bg-neutral-850 text-[10px] font-black uppercase tracking-wider rounded-lg transition border border-red-950 font-sans"
                        >
                          Approve Repairs
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {(user.dashboardMode || 'minimal') === 'minimal' ? (
            <div className="space-y-12">
            {/* Quick Action Grid */}
            {user.layoutPreferences?.showQuickActionGrid !== false && (
              <div className="bg-neutral-50/50 p-8 sm:p-10 rounded-[2.5rem] border border-neutral-100/80 shadow-sm space-y-8">
                <div className="space-y-2 text-left">
                  <span className="micro-label bg-primary/10 text-primary border border-primary/10 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">
                    Minimalist Workspace
                  </span>
                  <h2 className="text-3xl font-black text-neutral-900 tracking-tight">Rapid Action Hub</h2>
                  <p className="text-sm text-neutral-500 font-medium font-sans">Create packing lists, check inventories, publish listings, and configure AV rack gear.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* 1. +Packing List */}
                  {visibleButtons.includes('packing_list') && (
                    <button
                      type="button"
                      onClick={() => setIsCreating(true)}
                      className="p-6 bg-white rounded-3xl border border-neutral-100 shadow-sm hover:shadow-md hover:border-neutral-200 transition-all text-left flex flex-col justify-between h-48 focus:outline-none cursor-pointer group"
                    >
                      <div className="w-10 h-10 bg-[#ff3b30]/10 text-[#ff3b30] rounded-2xl flex items-center justify-center transition-colors group-hover:bg-[#ff3b30] group-hover:text-white">
                        <Plus size={20} className="stroke-[3]" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-neutral-900 block text-lg tracking-tight">+ Packing List</span>
                          <span className="text-[10px] bg-neutral-100 text-neutral-500 font-bold px-2 py-0.5 rounded-full select-none font-mono">
                            {lists.length}/{activePlan?.maxPackingLists || 3}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-450 mt-1.5 leading-relaxed font-semibold">
                          Create new camera gear logs, templates, or travel checklists.
                        </p>
                      </div>
                    </button>
                  )}

                  {/* 2. +Inventory */}
                  {visibleButtons.includes('inventory') && (
                    <button
                      type="button"
                      onClick={() => navigate('/inventory')}
                      className="p-6 bg-white rounded-3xl border border-neutral-100 shadow-sm hover:shadow-md hover:border-neutral-200 transition-all text-left flex flex-col justify-between h-48 focus:outline-none cursor-pointer group"
                    >
                      <div className="w-10 h-10 bg-[#34c759]/10 text-[#34c759] rounded-2xl flex items-center justify-center transition-colors group-hover:bg-[#34c759] group-hover:text-white">
                        <Plus size={20} className="stroke-[3]" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-neutral-900 block text-lg tracking-tight">+ Inventory</span>
                          <span className="text-[10px] bg-neutral-100 text-neutral-500 font-bold px-2 py-0.5 rounded-full select-none font-mono">
                            {gear.length}/{activePlan?.maxGearItems || 50}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-450 mt-1.5 leading-relaxed font-semibold">
                          Add items to your direct departments, storage rooms, or Custom Sheets.
                        </p>
                      </div>
                    </button>
                  )}

                  {/* 3. +Rack */}
                  {visibleButtons.includes('rack') && (
                    <button
                      type="button"
                      onClick={() => navigate('/racks')}
                      className="p-6 bg-white rounded-3xl border border-neutral-100 shadow-sm hover:shadow-md hover:border-neutral-200 transition-all text-left flex flex-col justify-between h-48 focus:outline-none cursor-pointer group"
                    >
                      <div className="w-10 h-10 bg-[#007aff]/10 text-[#007aff] rounded-2xl flex items-center justify-center transition-colors group-hover:bg-[#007aff] group-hover:text-white">
                        <Plus size={20} className="stroke-[3]" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-neutral-900 block text-lg tracking-tight">+ Rack</span>
                          <span className="text-[10px] bg-neutral-100 text-neutral-500 font-bold px-2 py-0.5 rounded-full select-none font-mono">
                            Limit: {activePlan?.maxRacks || 1}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-450 mt-1.5 leading-relaxed font-semibold">
                          Establish vertically-aligned space limits for technical hardware cases.
                        </p>
                      </div>
                    </button>
                  )}

                  {/* 4. +System Build */}
                  {visibleButtons.includes('system_build') && (
                    <button
                      type="button"
                      onClick={() => navigate('/systems-builder')}
                      className="p-6 bg-white rounded-3xl border border-neutral-100 shadow-sm hover:shadow-md hover:border-neutral-200 transition-all text-left flex flex-col justify-between h-48 focus:outline-none cursor-pointer group"
                    >
                      <div className="w-10 h-10 bg-[#5856d6]/15 text-[#5856d6] rounded-2xl flex items-center justify-center transition-colors group-hover:bg-[#5856d6] group-hover:text-white">
                        <Plus size={20} className="stroke-[3]" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-neutral-900 block text-lg tracking-tight">+ System Build</span>
                          <span className="text-[10px] bg-neutral-100 text-neutral-500 font-bold px-2 py-0.5 rounded-full select-none font-mono">
                            Limit: {activePlan?.maxProjects || 3}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-450 mt-1.5 leading-relaxed font-semibold">
                          Construct and test detailed video or hybrid studio rigs.
                        </p>
                      </div>
                    </button>
                  )}

                  {/* 5. +Listing */}
                  {visibleButtons.includes('listing') && (
                    <button
                      type="button"
                      onClick={() => navigate('/listings')}
                      className="p-6 bg-white rounded-3xl border border-neutral-100 shadow-sm hover:shadow-md hover:border-neutral-200 transition-all text-left flex flex-col justify-between h-48 focus:outline-none cursor-pointer group"
                    >
                      <div className="w-10 h-10 bg-[#ff9500]/10 text-[#ff9500] rounded-2xl flex items-center justify-center transition-colors group-hover:bg-[#ff9500] group-hover:text-white">
                        <Plus size={20} className="stroke-[3]" />
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-neutral-900 block text-lg tracking-tight">+ Listing</span>
                          <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-2.5 py-0.5 rounded-full select-none">
                            Market
                          </span>
                        </div>
                        <p className="text-xs text-neutral-450 mt-1.5 leading-relaxed font-semibold">
                          Publish a camera kit to our verification marketplace for rent or sales.
                        </p>
                      </div>
                    </button>
                  )}

                  {/* Info & Settings Link Card */}
                  <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10 flex flex-col justify-between h-48 text-left">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-primary">Need Analytics?</span>
                      <p className="text-xs text-neutral-600 leading-normal font-semibold">
                        To view full billing reports, category piecharts, health ratios and the self-checkout Kiosk terminal, switch your dashboard preset to <strong className="font-bold">Show All</strong>.
                      </p>
                    </div>
                    <Link
                      to="/profile"
                      className="text-xs font-bold text-primary hover:underline flex items-center gap-1.5"
                    >
                      Configure In Settings <ChevronRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Lists and Reminders */}
            {user.layoutPreferences?.showRecentLists !== false && (
              <div className="space-y-12">
                <section className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                      <Package size={24} />
                    </div>
                    <h2 className="text-2xl font-bold">Recent Packing Lists</h2>
                  </div>
                  <button 
                    onClick={() => setActiveTab('lists')}
                    className="text-primary font-bold hover:underline flex items-center gap-1"
                  >
                    View All <ChevronRight size={16} />
                  </button>
                </div>
                {loading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <div key={i} className="h-24 bg-neutral-100 rounded-2xl animate-pulse"></div>
                    ))}
                  </div>
                ) : recentLists.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                    {recentLists.map((list) => (
                      <Link
                        key={list.id}
                        to={`/list/${list.id}`}
                        className="group block bg-white p-4 rounded-2xl border border-neutral-100 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden text-left"
                      >
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleDeleteList(e, list.id)}
                            className="p-1.5 text-neutral-400 hover:text-red-500 transition"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div className="flex flex-col items-center text-center gap-3">
                          <div className="w-10 h-10 bg-neutral-50 rounded-xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                            <Package size={20} />
                          </div>
                          <div className="space-y-1 min-w-0 w-full">
                            <h3 className="text-xs font-bold group-hover:text-primary transition-colors truncate">{list.name}</h3>
                            <div className="flex items-center justify-center gap-1 text-[8px] text-neutral-400">
                              <Clock size={8} />
                              <span>{new Date(list.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-white rounded-[2rem] border border-dashed border-neutral-200">
                    <p className="text-neutral-500">No lists yet. Create one to get started!</p>
                  </div>
                )}
              </section>

              {/* Gear Maintenance Alerts & Reminders Center */}
              {maintenanceAlerts.length > 0 && (
                <section className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#FF5500]/10 text-[#FF5500] rounded-xl flex items-center justify-center">
                        <Wrench size={22} className="animate-pulse" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-black text-neutral-900 tracking-tight text-left">Gear Maintenance Service Center</h2>
                        <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider font-sans text-left">Active notifications based on customized cycle intervals</p>
                      </div>
                    </div>
                    <span className="bg-[#FF5500] text-white text-[10px] font-black px-3 py-1 rounded-full animate-bounce shrink-0">
                      {maintenanceAlerts.length} Action{maintenanceAlerts.length !== 1 ? 's' : ''} Needed
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {maintenanceAlerts.map(({ item, isOverdue, status: alertStatus, daysRemaining, nextDueText }) => {
                      const hasTask = reminders.some(r => r.itemId === item.id && r.type === 'maintenance' && r.status === 'pending');
                      return (
                        <div 
                          key={`maint-${item.id}`} 
                          className="p-6 rounded-3xl border transition-all flex flex-col justify-between gap-5 text-left bg-white shadow-sm border-neutral-100 hover:border-[#FF5500]/40"
                        >
                          <div className="space-y-3.5">
                            <div className="flex items-start justify-between">
                              <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                isOverdue 
                                  ? 'bg-red-50 text-red-600 border border-red-100/50' 
                                  : 'bg-amber-50 text-amber-600 border border-amber-100/50'
                              }`}>
                                {isOverdue ? 'Overdue Service' : 'Service Imminent'}
                              </span>
                              <span className="text-[10px] font-mono text-neutral-400 font-bold">
                                Every {item.maintenanceIntervalDays} Days
                              </span>
                            </div>

                            <div>
                              <h3 className="font-extrabold text-neutral-900 text-base line-clamp-1">
                                {item.name}
                              </h3>
                              <p className="text-xs font-mono text-neutral-400 mt-0.5">
                                {item.brand ? `${item.brand} • ` : ''}{item.category || 'Gear'}
                              </p>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-neutral-50/60 border border-neutral-100 space-y-1">
                              <div className="flex justify-between text-[10px] font-bold text-neutral-500">
                                <span>Last Action:</span>
                                <span>{item.lastMaintenanceDate || 'Never'}</span>
                              </div>
                              <div className={`text-[11px] font-black flex items-center gap-1.5 ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}>
                                <AlertCircle size={13} className="shrink-0" />
                                <span className="tracking-tight">{nextDueText}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => handleRecordItemMaintenanceDoc(item.id, item.name)}
                              className="flex-1 py-2 px-3 bg-neutral-900 hover:bg-[#FF5500] hover:text-white text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5 shadow-sm shadow-neutral-900/10 cursor-pointer"
                              title="Perform full check and reset countdown"
                            >
                              <CheckCircle2 size={12} />
                              <span>Log Service</span>
                            </button>
                            
                            {hasTask ? (
                              <div className="px-3 py-2 bg-green-50 border border-green-100 rounded-xl text-green-600 text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shrink-0">
                                <Clock size={11} />
                                <span>Scheduled</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleCreateMaintenanceReminder(item)}
                                className="py-2 px-3 bg-neutral-50 hover:bg-neutral-150 text-neutral-600 border border-neutral-200/50 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer"
                                title="Add to dashboard pending task list"
                              >
                                <Calendar size={12} />
                                <span>Remind</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {reminders.length > 0 && (
                <section className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                      <Bell size={24} />
                    </div>
                    <h2 className="text-2xl font-bold">Upcoming Reminders</h2>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {reminders.map((reminder) => {
                      const isOverdue = new Date(reminder.dueDate) < new Date();
                      return (
                        <div 
                          key={reminder.id} 
                          className={`p-6 rounded-3xl border transition-all flex flex-col justify-between gap-4 text-left ${
                            isOverdue ? 'bg-red-50 border-red-100' : 'bg-white border-neutral-100 shadow-sm'
                          }`}
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                                reminder.type === 'return' ? 'bg-green-100 text-green-700' :
                                reminder.type === 'pack' ? 'bg-neutral-100 text-neutral-700' :
                                'bg-neutral-100 text-neutral-600'
                              }`}>
                                {reminder.type}
                              </div>
                              <button 
                                onClick={() => handleCompleteReminder(reminder.id)}
                                className="text-neutral-300 hover:text-green-500 transition"
                                title="Mark as Completed"
                              >
                                <CheckCircle2 size={20} />
                              </button>
                            </div>
                            <div>
                              <h3 className="font-bold text-neutral-900 line-clamp-1">
                                {reminder.itemName || 'Packing List Reminder'}
                              </h3>
                              <p className="text-xs text-neutral-500 line-clamp-1">
                                {reminder.recipientName ? `Renter: ${reminder.recipientName}` : `List: ${lists.find(l => l.id === reminder.listId)?.name || 'Unknown List'}`}
                              </p>
                            </div>
                            <div className={`flex items-center gap-2 text-xs font-bold ${isOverdue ? 'text-red-500' : 'text-neutral-400'}`}>
                              {isOverdue ? <AlertCircle size={14} /> : <Calendar size={14} />}
                              <span>{new Date(reminder.dueDate).toLocaleString()}</span>
                            </div>
                            {reminder.message && (
                              <p className="text-xs text-neutral-400 italic line-clamp-2">"{reminder.message}"</p>
                            )}
                          </div>
                          <Link 
                            to={`/list/${reminder.listId}`}
                            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                          >
                            View List <ChevronRight size={12} />
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}
          </div>
          ) : (
            <div className="space-y-12">
             {/* Stats Summary Cards */}
             {user.layoutPreferences?.showStatsCards !== false && (
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                 {[
                   { label: 'Kit Value', value: `$${gearStats.totalValue.toLocaleString()}`, icon: <TrendingUp size={20} />, color: 'bg-green-500' },
                   { label: 'Audit Score', value: `${gearStats.auditScore.toFixed(0)}%`, icon: <ShieldCheck size={20} />, color: 'bg-primary' },
                   { label: 'Intensity', value: `${gearStats.usageIntensity.toFixed(1)}x`, icon: <Activity size={20} />, color: 'bg-accent' },
                   { label: 'Total Weight', value: `${(gearStats.totalWeight / 1000).toFixed(1)}kg`, icon: <TrendingUp size={20} />, color: 'bg-blue-500' },
                 ].map((stat, i) => (
                   <div key={i} className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm space-y-4">
                     <div className={`w-10 h-10 ${stat.color} text-white rounded-xl flex items-center justify-center shadow-lg shadow-${stat.color.split('-')[1]}/20`}>
                       {stat.icon}
                     </div>
                     <div className="space-y-1">
                       <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest truncate">{stat.label}</p>
                       <h3 className="text-xl md:text-2xl font-black">{stat.value}</h3>
                     </div>
                   </div>
                 ))}
               </div>
             )}

             {user.layoutPreferences?.showDistributionChart !== false && (
               <>
                 <section className="space-y-6">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-black">
                         AI
                       </div>
                       <h2 className="text-2xl font-bold">Gear Insights</h2>
                     </div>
                   </div>
              
              <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
                {/* Category Distribution Chart */}
                <div className="lg:col-span-1 bg-white p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg">Categories</h3>
                    <PieChart size={18} className="text-neutral-400" />
                  </div>
                  <div className="h-56 md:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                        <Pie
                          data={gearStats.categoryData}
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {gearStats.categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RePieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {gearStats.categoryData.map((entry, index) => (
                      <div key={entry.name} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="text-[10px] font-bold text-neutral-500 truncate">{entry.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Health Trends */}
                <div className="lg:col-span-1 bg-white p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg">Gear Health</h3>
                    <Heart size={18} className="text-red-400" />
                  </div>
                  <div className="h-56 md:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={gearStats.conditionData}>
                        <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip cursor={{ fill: 'transparent' }} />
                        <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                          {gearStats.conditionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs text-neutral-500 text-center">Maintain kit health over 85% for optimal project readiness.</p>
                  </div>
                </div>

                {/* Top Used Gear / Performance */}
                <div className="lg:col-span-1 bg-white p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg">Utilization</h3>
                    <TrendingUp size={18} className="text-green-500" />
                  </div>
                  <div className="space-y-4">
                    {gearStats.topUsed.map((item, idx) => (
                      <div key={item.id} className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0">#{idx + 1}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{item.name}</p>
                          <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">{item.usageCount || 0} Projects</p>
                        </div>
                        <div className="w-12 md:w-16 h-1 bg-neutral-100 rounded-full overflow-hidden shrink-0">
                          <div 
                            className="h-full bg-primary" 
                            style={{ width: `${Math.min(100, (item.usageCount || 0) * 10)}%` }} 
                          />
                        </div>
                      </div>
                    ))}
                    {gearStats.topUsed.length === 0 && (
                      <p className="text-center py-12 text-neutral-400 text-sm italic">Start logging usage in Gear Library to see travel trends.</p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-6 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                    <TrendingUp size={20} className="text-[#0066cc]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tight">Active Deployments distribution</h2>
                    <p className="text-neutral-500 text-[10px] font-black uppercase tracking-widest">Weight Analytical Logistics & Total Capital Valuation</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-neutral-100 shadow-sm space-y-6">
                {distributionData.length === 0 ? (
                  <div className="py-20 text-center text-neutral-450 space-y-3">
                    <PieChart size={48} className="mx-auto text-neutral-200 animate-pulse" />
                    <p className="font-extrabold uppercase tracking-widest text-[11px]">No active packing items loaded yet</p>
                    <p className="text-xs text-neutral-400 leading-normal max-w-sm mx-auto uppercase">
                      Create items or add gear in physical inventories to trigger live logistics weight distributions.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="h-80 md:h-[350px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={distributionData} margin={{ top: 20, right: 10, left: 10, bottom: 20 }}>
                          <XAxis 
                            dataKey="name" 
                            stroke="#888888" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false}
                          />
                          <YAxis 
                            yAxisId="left" 
                            orientation="left" 
                            stroke="#3b82f6" 
                            fontSize={10} 
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis 
                            yAxisId="right" 
                            orientation="right" 
                            stroke="#10b981" 
                            fontSize={10} 
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#171717', borderRadius: '16px', border: 'none', color: '#f5f5f5', fontSize: '11px' }} 
                            itemStyle={{ color: '#f5f5f5' }}
                          />
                          <Legend 
                            verticalAlign="top" 
                            height={40} 
                            iconType="circle"
                            formatter={(value) => <span className="text-[9px] font-black uppercase tracking-wider text-neutral-500">{value}</span>}
                          />
                          <Bar 
                            yAxisId="left" 
                            dataKey="weight" 
                            name="Total Weight (kg)" 
                            fill="#3b82f6" 
                            radius={[6, 6, 0, 0]} 
                            barSize={32} 
                          />
                          <Bar 
                            yAxisId="right" 
                            dataKey="value" 
                            name="Total Valuation ($)" 
                            fill="#10b981" 
                            radius={[6, 6, 0, 0]} 
                            barSize={32} 
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Numeric dashboard footer ledger */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-neutral-100">
                      {distributionData.slice(0, 6).map((item) => (
                        <div key={item.id} className="p-4 bg-neutral-50 border border-neutral-100 rounded-2xl flex items-center justify-between">
                          <div className="space-y-0.5 min-w-0 pr-2">
                            <h4 className="text-xs font-black text-neutral-800 truncate">{item.name}</h4>
                            <p className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest">{item.itemCount} distinct assets</p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[10px] font-black text-blue-500">{item.weight} kg</div>
                            <div className="text-[10px] font-black text-emerald-500">${item.value.toLocaleString()}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </>
        )}

            {/* Gear Kiosk Terminal Hub */}
            {user.layoutPreferences?.showKioskTerminal !== false && (
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                      <QrCode size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black uppercase tracking-tight">Kiosk Terminal Hub</h2>
                      <p className="text-neutral-500 text-[10px] font-black uppercase tracking-widest font-sans">Self-Service Sign-out station for devices</p>
                    </div>
                  </div>
                </div>

              <div className="bg-white rounded-[2rem] border border-neutral-100 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-12">
                <div className="p-6 sm:p-8 md:col-span-7 space-y-6 flex flex-col justify-between text-left">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        isFeatureEnabled('kioskMode', user, adminSettings)
                          ? (kioskActive ? 'bg-green-100 text-green-700' : 'bg-neutral-150 text-neutral-500')
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {!isFeatureEnabled('kioskMode', user, adminSettings)
                          ? 'Upgrade Plan Required' 
                          : (kioskActive ? '● Kiosk Active & Operational' : 'Deactivated (By Default)')}
                      </span>
                      <span className="text-neutral-400 text-[9px] uppercase font-bold tracking-widest font-mono">Device-Level Suite</span>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-lg font-black uppercase tracking-tight text-neutral-800">Tablet Check-Out & Check-In Kiosk</h3>
                      <p className="text-xs text-neutral-500 leading-relaxed font-semibold">
                        Convert any iPad, Android tablet, or spare phone into a rapid gear sign-out terminal. Users can scan gear tags, verify inventories, pack travel cases, and generate instant checkout receipts right from a physical self-service station.
                      </p>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-neutral-100 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {!isFeatureEnabled('kioskMode', user, adminSettings) ? (
                      <div className="space-y-3 w-full">
                        <div className="flex items-center gap-3 text-amber-600 bg-amber-50 border border-amber-100 p-4 rounded-xl text-xs font-bold uppercase tracking-wide">
                          <AlertCircle size={16} className="shrink-0" />
                          <span>Your active {user.plan || 'Free'} plan does not include Kiosk Station licensing.</span>
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              const userRef = doc(db, 'users', user.uid);
                              await updateDoc(userRef, { plan: 'pro' });
                              toast.success("Simulated upgrade successful! Kiosk Mode is now unlocked. Reloading to apply changes.");
                              window.location.reload();
                            } catch (e) {
                              toast.error("Failed to upgrade plan.");
                            }
                          }}
                          className="px-5 py-3 bg-neutral-900 border border-neutral-800 hover:bg-black text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition duration-150 flex items-center gap-2 shadow-lg"
                        >
                          <Zap size={14} className="text-amber-400 fill-amber-400" />
                          <span>Simulate Instant Upgrade to Pro</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3 w-full">
                        <div className="flex items-center justify-between bg-neutral-50 p-4 border border-neutral-150 rounded-2xl w-full">
                          <div className="space-y-0.5">
                            <span className="text-xs font-black uppercase tracking-wider text-neutral-800">Activate Kiosk Module</span>
                            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wide">Toggle module on or off for your organization</p>
                          </div>
                          <button
                            onClick={async () => {
                              const nextVal = !kioskActive;
                              setKioskActive(nextVal);
                              try {
                                const userRef = doc(db, 'users', user.uid);
                                await updateDoc(userRef, { kioskModuleActive: nextVal });
                                toast.success(nextVal ? "Kiosk module enabled! Standalone app download is now available." : "Kiosk module disabled.");
                              } catch (e) {
                                toast.error("Failed to update status.");
                              }
                            }}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${kioskActive ? 'bg-primary' : 'bg-neutral-200'}`}
                          >
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${kioskActive ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </div>

                        {kioskActive && (
                          <div className="flex flex-wrap gap-3 pt-2">
                            <Link
                              to="/kiosk"
                              target="_blank"
                              className="px-5 py-3 bg-primary hover:bg-primary/95 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition shadow-lg shrink-0 flex items-center gap-2"
                            >
                              <QrCode size={14} />
                              <span>Open Standalone Kiosk App</span>
                            </Link>

                            <button
                              onClick={() => {
                                toast.success("This dedicated Kiosk PWA App is ready! Adding to your tablet device or home screen turns it into a locked Checkout Station.", { duration: 5000 });
                              }}
                              className="px-5 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-200 text-[10px] font-black uppercase tracking-wider rounded-xl transition shrink-0 flex items-center gap-2"
                            >
                              <Download size={14} />
                              <span>Install PWA (Zero Clutter Kiosk)</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className={`p-6 sm:p-8 md:col-span-5 bg-neutral-50/50 border-t md:border-t-0 md:border-l border-neutral-100 flex flex-col items-center justify-center text-center space-y-4 ${!kioskActive ? 'opacity-30 select-none' : ''}`}>
                  {kioskActive ? (
                    <>
                      <div className="bg-white p-4 rounded-2xl border border-neutral-150 shadow-sm">
                        <QRCodeCanvas 
                          value={`${window.location.origin}/#/kiosk?ownerUid=${user.uid}`}
                          size={130}
                          level="H"
                          includeMargin={false}
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-neutral-800">Scan to Launch Kiosk</p>
                        <p className="text-[10px] text-neutral-450 font-bold uppercase tracking-wider leading-relaxed max-w-xs mx-auto">
                          Scan with your tablet or iPad camera to instantly deploy this check-in/out station device.
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="py-8 space-y-2">
                      <QrCode size={48} className="mx-auto text-neutral-300 stroke-[1.5]" />
                      <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest text-[10px]">Kiosk Setup Locked</p>
                      <p className="text-[10px] font-bold text-neutral-400 max-w-xs mx-auto">Activate the kiosk module on the left to reveal unique QR setup codes.</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                    <Package size={24} />
                  </div>
                  <h2 className="text-2xl font-bold">Recent Packing Lists</h2>
                </div>
                <button 
                  onClick={() => setActiveTab('lists')}
                  className="text-primary font-bold hover:underline flex items-center gap-1"
                >
                  View All <ChevronRight size={16} />
                </button>
              </div>
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="h-24 bg-neutral-100 rounded-2xl animate-pulse"></div>
                  ))}
                </div>
              ) : recentLists.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  {recentLists.map((list) => (
                    <Link
                      key={list.id}
                      to={`/list/${list.id}`}
                      className="group block bg-white p-4 rounded-2xl border border-neutral-100 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden"
                    >
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleDeleteList(e, list.id)}
                          className="p-1.5 text-neutral-400 hover:text-red-500 transition"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div className="flex flex-col items-center text-center gap-3">
                        <div className="w-10 h-10 bg-neutral-50 rounded-xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                          <Package size={20} />
                        </div>
                        <div className="space-y-1 min-w-0 w-full">
                          <h3 className="text-xs font-bold group-hover:text-primary transition-colors truncate">{list.name}</h3>
                          <div className="flex items-center justify-center gap-1 text-[8px] text-neutral-400">
                            <Clock size={8} />
                            <span>{new Date(list.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-white rounded-[2rem] border border-dashed border-neutral-200">
                  <p className="text-neutral-500">No lists yet. Create one to get started!</p>
                </div>
              )}
            </section>

            {/* Gear Maintenance Alerts & Reminders Center */}
            {maintenanceAlerts.length > 0 && (
              <section className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#FF5500]/10 text-[#FF5500] rounded-xl flex items-center justify-center">
                      <Wrench size={22} className="animate-pulse" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-neutral-900 tracking-tight text-left">Gear Maintenance Service Center</h2>
                      <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider font-sans text-left">Active notifications based on customized cycle intervals</p>
                    </div>
                  </div>
                  <span className="bg-[#FF5500] text-white text-[10px] font-black px-3 py-1 rounded-full animate-bounce shrink-0">
                    {maintenanceAlerts.length} Action{maintenanceAlerts.length !== 1 ? 's' : ''} Needed
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {maintenanceAlerts.map(({ item, isOverdue, status: alertStatus, daysRemaining, nextDueText }) => {
                    const hasTask = reminders.some(r => r.itemId === item.id && r.type === 'maintenance' && r.status === 'pending');
                    return (
                      <div 
                        key={`maint-det-${item.id}`} 
                        className="p-6 rounded-3xl border transition-all flex flex-col justify-between gap-5 text-left bg-white shadow-sm border-neutral-100 hover:border-[#FF5500]/40"
                      >
                        <div className="space-y-3.5">
                          <div className="flex items-start justify-between">
                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              isOverdue 
                                ? 'bg-red-50 text-red-600 border border-red-100/50' 
                                : 'bg-amber-50 text-amber-600 border border-amber-100/50'
                            }`}>
                              {isOverdue ? 'Overdue Service' : 'Service Imminent'}
                            </span>
                            <span className="text-[10px] font-mono text-neutral-400 font-bold">
                              Every {item.maintenanceIntervalDays} Days
                            </span>
                          </div>

                          <div>
                            <h3 className="font-extrabold text-neutral-900 text-base line-clamp-1">
                              {item.name}
                            </h3>
                            <p className="text-xs font-mono text-neutral-400 mt-0.5">
                              {item.brand ? `${item.brand} • ` : ''}{item.category || 'Gear'}
                            </p>
                          </div>

                          <div className="p-3.5 rounded-2xl bg-neutral-50/60 border border-neutral-100 space-y-1">
                             <div className="flex justify-between text-[10px] font-bold text-neutral-500">
                               <span>Last Action:</span>
                               <span>{item.lastMaintenanceDate || 'Never'}</span>
                             </div>
                             <div className={`text-[11px] font-black flex items-center gap-1.5 ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}>
                               <AlertCircle size={13} className="shrink-0" />
                               <span className="tracking-tight">{nextDueText}</span>
                             </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => handleRecordItemMaintenanceDoc(item.id, item.name)}
                            className="flex-1 py-2 px-3 bg-neutral-900 hover:bg-[#FF5500] hover:text-white text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-1.5 shadow-sm shadow-neutral-900/10 cursor-pointer"
                            title="Perform full check and reset countdown"
                          >
                            <CheckCircle2 size={12} />
                            <span>Log Service</span>
                          </button>
                          
                          {hasTask ? (
                            <div className="px-3 py-2 bg-green-50 border border-green-100 rounded-xl text-green-600 text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shrink-0">
                              <Clock size={11} />
                              <span>Scheduled</span>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleCreateMaintenanceReminder(item)}
                              className="py-2 px-3 bg-neutral-50 hover:bg-neutral-150 text-neutral-600 border border-neutral-200/50 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer"
                              title="Add to dashboard pending task list"
                            >
                              <Calendar size={12} />
                              <span>Remind</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {reminders.length > 0 && (
              <section className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                    <Bell size={24} />
                  </div>
                  <h2 className="text-2xl font-bold">Upcoming Reminders</h2>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {reminders.map((reminder) => {
                    const isOverdue = new Date(reminder.dueDate) < new Date();
                    return (
                      <div 
                        key={reminder.id} 
                        className={`p-6 rounded-3xl border transition-all flex flex-col justify-between gap-4 ${
                          isOverdue ? 'bg-red-50 border-red-100' : 'bg-white border-neutral-100 shadow-sm'
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                              reminder.type === 'return' ? 'bg-green-100 text-green-700' :
                              reminder.type === 'pack' ? 'bg-neutral-100 text-neutral-700' :
                              'bg-neutral-100 text-neutral-600'
                            }`}>
                              {reminder.type}
                            </div>
                            <button 
                              onClick={() => handleCompleteReminder(reminder.id)}
                              className="text-neutral-300 hover:text-green-500 transition"
                              title="Mark as Completed"
                            >
                              <CheckCircle2 size={20} />
                            </button>
                          </div>
                          <div>
                            <h3 className="font-bold text-neutral-900 line-clamp-1">
                              {reminder.itemName || 'Packing List Reminder'}
                            </h3>
                            <p className="text-xs text-neutral-500 line-clamp-1">
                              {reminder.recipientName ? `Renter: ${reminder.recipientName}` : `List: ${lists.find(l => l.id === reminder.listId)?.name || 'Unknown List'}`}
                            </p>
                          </div>
                          <div className={`flex items-center gap-2 text-xs font-bold ${isOverdue ? 'text-red-500' : 'text-neutral-400'}`}>
                            {isOverdue ? <AlertCircle size={14} /> : <Calendar size={14} />}
                            <span>{new Date(reminder.dueDate).toLocaleString()}</span>
                          </div>
                          {reminder.message && (
                            <p className="text-xs text-neutral-400 italic line-clamp-2">"{reminder.message}"</p>
                          )}
                        </div>
                        <Link 
                          to={`/list/${reminder.listId}`}
                          className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                        >
                          View List <ChevronRight size={12} />
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
          )}
          {/* Live Activities Audit Feed */}
          <div className="pt-4">
            <ActivityLog user={user} />
          </div>
        </div>
      ) : (activeTab === 'lists' || activeTab === 'templates') ? (
          <section className="space-y-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
                <input
                  type="text"
                  placeholder="Search packing lists..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                />
              </div>
              
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Filter size={18} className="text-neutral-400" />
                  <select 
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-primary transition"
                  >
                    <option value="all">All Status</option>
                    <option value="Draft">Draft</option>
                    <option value="Active">Active</option>
                    <option value="Sent">Sent</option>
                    <option value="Completed">Completed</option>
                  </select>
                  {activeTab !== 'templates' && (
                    <select 
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-primary transition"
                    >
                      <option value="all">All Types</option>
                      <option value="active">Active Lists</option>
                      <option value="template">Templates</option>
                      <option value="marketplace">Marketplace</option>
                    </select>
                  )}
                </div>

                <div className="flex items-center gap-2 border-l border-neutral-200 pl-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Sort:</span>
                  <button
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className="p-2 bg-neutral-50 border border-neutral-200 rounded-xl hover:bg-neutral-100 transition"
                    title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
                  >
                    {sortOrder === 'asc' ? <SortAsc size={18} /> : <SortDesc size={18} />}
                  </button>
                  <select 
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value as SortField)}
                    className="bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-primary transition"
                  >
                    <option value="createdAt">Date Created</option>
                    <option value="name">Name</option>
                    <option value="status">Status</option>
                  </select>
                </div>

                <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg transition ${viewMode === 'grid' ? 'bg-white text-primary shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`}
                  >
                    <LayoutGrid size={18} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg transition ${viewMode === 'list' ? 'bg-white text-primary shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`}
                  >
                    <ListIcon size={18} />
                  </button>
                </div>
              </div>
            </div>

            {filteredLists.length > 0 ? (
              viewMode === 'grid' ? (
                <motion.div 
                  initial="hidden"
                  animate="show"
                  variants={{
                    hidden: { opacity: 0 },
                    show: {
                      opacity: 1,
                      transition: { staggerChildren: 0.05 }
                    }
                  }}
                  className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
                >
                  {filteredLists.map((list) => (
                    <motion.div
                      key={list.id}
                      variants={{
                        hidden: { opacity: 0, y: 10 },
                        show: { opacity: 1, y: 0 }
                      }}
                    >
                      <Link
                        to={`/list/${list.id}`}
                        className="group block bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden h-full"
                      >
                        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-25 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setCheckoutList(list);
                            }}
                            className={`p-1.5 transition rounded-lg ${list.status === 'Active' ? 'text-rose-600 hover:bg-rose-50' : 'text-primary hover:bg-primary/5'}`}
                            title={list.status === 'Active' ? "Check In / Return" : "Check Out"}
                          >
                            <ArrowRightLeft size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSharingList(list);
                            }}
                            className="p-1.5 text-neutral-400 hover:text-primary transition"
                          >
                            <Share2 size={14} />
                          </button>
                          <button
                            onClick={(e) => handleDeleteList(e, list.id)}
                            className="p-1.5 text-neutral-400 hover:text-red-500 transition"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="space-y-4">
                          <div className="w-10 h-10 bg-neutral-50 rounded-xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                            <Package size={20} />
                          </div>
                          <div className="space-y-1">
                            <h3 className="text-base font-bold group-hover:text-primary transition-colors line-clamp-1">{list.name}</h3>
                            <div className="flex flex-wrap gap-1">
                              {list.status && (
                                <span className="px-1.5 py-0.5 bg-neutral-100 text-neutral-600 rounded-full text-[7px] font-black uppercase tracking-widest">
                                  {list.status}
                                </span>
                              )}
                              {list.isTemplate && (
                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full text-[7px] font-black uppercase tracking-widest">
                                  Template
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-neutral-400">
                              <Clock size={10} />
                              <span>{new Date(list.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-neutral-50 border-bottom border-neutral-100">
                      <tr>
                        <th 
                          className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400 cursor-pointer hover:text-primary transition-colors"
                          onClick={() => {
                            if (sortField === 'name') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                            else { setSortField('name'); setSortOrder('asc'); }
                          }}
                        >
                          <div className="flex items-center gap-1">
                            List Name
                            {sortField === 'name' && (sortOrder === 'asc' ? <SortAsc size={12} /> : <SortDesc size={12} />)}
                          </div>
                        </th>
                        <th 
                          className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400 cursor-pointer hover:text-primary transition-colors"
                          onClick={() => {
                            if (sortField === 'status') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                            else { setSortField('status'); setSortOrder('asc'); }
                          }}
                        >
                          <div className="flex items-center gap-1">
                            Status
                            {sortField === 'status' && (sortOrder === 'asc' ? <SortAsc size={12} /> : <SortDesc size={12} />)}
                          </div>
                        </th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400">Type</th>
                        <th 
                          className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400 cursor-pointer hover:text-primary transition-colors"
                          onClick={() => {
                            if (sortField === 'createdAt') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                            else { setSortField('createdAt'); setSortOrder('desc'); }
                          }}
                        >
                          <div className="flex items-center gap-1">
                            Created
                            {sortField === 'createdAt' && (sortOrder === 'asc' ? <SortAsc size={12} /> : <SortDesc size={12} />)}
                          </div>
                        </th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-400 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {filteredLists.map((list) => (
                        <tr key={list.id} className="group hover:bg-neutral-50 transition-colors">
                          <td className="px-6 py-4">
                            <Link to={`/list/${list.id}`} className="font-bold text-neutral-900 hover:text-primary transition-colors">
                              {list.name}
                            </Link>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 bg-neutral-100 text-neutral-600 rounded-full text-[9px] font-black uppercase tracking-widest">
                              {list.status || 'Draft'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                              list.isTemplate ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                            }`}>
                              {list.isTemplate ? 'Template' : 'Active'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-neutral-500">
                            {new Date(list.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setCheckoutList(list)}
                                className={`p-2 rounded-lg transition ${list.status === 'Active' ? 'text-rose-600 hover:bg-rose-50' : 'text-primary hover:bg-primary/5'}`}
                                title={list.status === 'Active' ? "Check In / Return" : "Check Out"}
                              >
                                <ArrowRightLeft size={16} />
                              </button>
                              <button
                                onClick={() => setSharingList(list)}
                                className="p-2 text-neutral-400 hover:text-primary transition"
                              >
                                <Share2 size={16} />
                              </button>
                              <button
                                onClick={(e) => handleDeleteList(e, list.id)}
                                className="p-2 text-neutral-400 hover:text-red-500 transition"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              <div className="text-center py-10 px-4 sm:py-24 bg-white rounded-2xl sm:rounded-[3rem] border border-dashed border-neutral-200">
                <p className="text-neutral-500">No packing lists match your filters.</p>
                <button 
                  onClick={() => {
                    setSearchQuery('');
                    setFilterStatus('all');
                    setFilterType('all');
                  }}
                  className="mt-4 text-primary font-bold hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </section>
        ) : null}

        {activeTab === 'directories' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Directories Sub-Tabs/Search Headers */}
            <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-neutral-100 shadow-sm space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-xl font-black uppercase tracking-tight text-neutral-800">Public Organization & Professional Directories</h2>
                  <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Search active organizations or contact registered users who chose to expose their profile publicly.</p>
                </div>
                
                {/* Search query input */}
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search directory..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-xs font-bold transition"
                  />
                </div>
              </div>

              {/* Directories Toggle */}
              <div className="flex justify-center pt-2">
                <div className="bg-neutral-100 p-1 rounded-2xl flex gap-1 border border-neutral-200/40">
                  <button
                    type="button"
                    onClick={() => setDirectoryType('orgs')}
                    className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                      directoryType === 'orgs' ? 'bg-neutral-900 text-white shadow-md' : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    <Building2 size={14} />
                    <span>Organizations ({orgsList.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirectoryType('users')}
                    className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                      directoryType === 'users' ? 'bg-neutral-900 text-white shadow-md' : 'text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    <Users size={14} />
                    <span>Users ({usersList.length})</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Directory Cards Grid */}
            {directoryType === 'orgs' ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                  {orgsList.filter(o => o.name?.toLowerCase().includes(searchQuery.toLowerCase()) || o.slug?.toLowerCase().includes(searchQuery.toLowerCase())).map((org) => {
                    const orgLogo = org.settings?.branding?.logo || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=150';
                    return (
                      <div key={org.id} className="bg-white p-6 rounded-[2rem] border border-neutral-100 hover:border-neutral-250 hover:border-neutral-300 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col items-center justify-center text-center group gap-3">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border border-neutral-100 bg-neutral-50 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-300">
                          <img
                            src={orgLogo}
                            alt={org.name}
                            className="w-full h-full object-cover animate-in fade-in"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <h4 className="font-extrabold text-neutral-900 text-xs uppercase tracking-tight line-clamp-2 leading-tight">
                          {org.name}
                        </h4>
                      </div>
                    );
                  })}
                </div>
                {orgsList.length === 0 && (
                  <p className="text-neutral-400 text-xs font-bold uppercase tracking-wider italic text-center py-12 bg-white rounded-[2.5rem] border border-dashed border-neutral-200">
                    No organizations available in system.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                  {usersList.filter(u => u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) || (u.company || '').toLowerCase().includes(searchQuery.toLowerCase()) || (u.bio || '').toLowerCase().includes(searchQuery.toLowerCase())).map((pubUser) => {
                    const profileImg = pubUser.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150';
                    return (
                      <div key={pubUser.uid} className="bg-white p-6 rounded-[2rem] border border-neutral-100 hover:border-neutral-250 hover:border-neutral-300 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col items-center justify-center text-center group gap-3">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border border-neutral-100 bg-neutral-50 flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-300">
                          <img
                            src={profileImg}
                            alt={pubUser.displayName}
                            className="w-full h-full object-cover animate-in fade-in"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <h4 className="font-extrabold text-neutral-900 text-xs uppercase tracking-tight line-clamp-2 leading-tight">
                          {pubUser.displayName}
                        </h4>
                      </div>
                    );
                  })}
                </div>
                {usersList.length === 0 && (
                  <p className="text-neutral-400 text-xs font-bold uppercase tracking-wider italic text-center py-12 bg-white rounded-[2.5rem] border border-dashed border-neutral-200">
                    No public user profiles are currently listed.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'marketplace' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Embed the rich Marketplace Component inside the dashboard seamlessly */}
            <div className="bg-white p-4 rounded-[2rem] border border-neutral-100 shadow-sm overflow-hidden">
              <Marketplace user={user} adminSettings={adminSettings} />
            </div>
          </div>
        )}

        {activeTab === 'developer' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="bg-white p-8 rounded-[2rem] border border-neutral-100 shadow-sm overflow-hidden">
              <DeveloperTab user={user} lists={lists} />
            </div>
          </div>
        )}

        {activeTab === 'beta_bugs' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Split layout: File a Report and list history */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              {/* Form panel: 2 cols */}
              <div className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-neutral-100 shadow-sm space-y-6">
                <div className="space-y-1">
                  <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
                    <Wrench size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-neutral-900 pt-2">File a Beta Bug Report</h3>
                  <p className="text-xs text-neutral-400">Describe the issue clearly. Platform admins will investigate and update you here.</p>
                </div>

                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newBugTitle.trim() || !newBugDesc.trim()) {
                      toast.error("Please fill out both the title and details description.");
                      return;
                    }
                    setIsBugSubmitting(true);
                    try {
                      await addDoc(collection(db, 'bugs'), {
                        userId: user.uid,
                        userName: user.displayName || 'Anonymous Beta Tester',
                        userEmail: user.email,
                        title: newBugTitle.trim(),
                        description: newBugDesc.trim(),
                        module: newBugModule,
                        severity: newBugSeverity,
                        status: 'open',
                        createdAt: new Date().toISOString(),
                        screenshots: bugScreenshots
                      });
                      toast.success("Bug report successfully filed! Admins have been notified.");
                      setNewBugTitle('');
                      setNewBugDesc('');
                      setNewBugModule('General UI');
                      setNewBugSeverity('low');
                      setBugScreenshots([]);
                    } catch (error: any) {
                      console.error("Error creating bug report:", error);
                      toast.error("Failed to submit bug report. Try again.");
                    } finally {
                      setIsBugSubmitting(false);
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">Short Issue Summary</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., Kiosk terminal scan error on Android"
                      value={newBugTitle}
                      onChange={(e) => setNewBugTitle(e.target.value)}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition text-xs font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">Related Module</label>
                      <select
                        value={newBugModule}
                        onChange={(e) => setNewBugModule(e.target.value)}
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none text-xs font-semibold"
                      >
                        <option value="General UI">General UI / Design</option>
                        <option value="AI Packing Wizard">AI Packing Wizard</option>
                        <option value="Gear Library">Gear Library</option>
                        <option value="Reminders & Scheduler">Reminders & Alerts</option>
                        <option value="QR Code Sharing">QR Sharing</option>
                        <option value="Client Portal">Client Portal</option>
                        <option value="Kiosk & Terminal">Kiosk Terminal</option>
                        <option value="Asset Inventory">Asset Inventory</option>
                        <option value="Supplier/BOM">Supplier & BOM</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block font-black">Estimated Severity</label>
                      <select
                        value={newBugSeverity}
                        onChange={(e) => setNewBugSeverity(e.target.value as any)}
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none text-xs font-semibold"
                      >
                        <option value="low">🔵 Low (Design quirk)</option>
                        <option value="medium">🟡 Medium (Workaround exists)</option>
                        <option value="high">🟠 High (Blocks module)</option>
                        <option value="critical">🚨 Critical (Crashes/Major issue)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">Full Reproduction Details</label>
                    <textarea
                      required
                      placeholder="Write reproduction steps, user context environment, and what happened vs what was expected..."
                      rows={5}
                      value={newBugDesc}
                      onChange={(e) => setNewBugDesc(e.target.value)}
                      className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition text-xs font-medium resize-none"
                    />
                  </div>

                  {/* Screenshot Upload with compression */}
                  <div className="space-y-1.5 text-left bg-neutral-50/50 p-3 rounded-2xl border border-neutral-100">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block mb-1">Attach Screenshots ({bugScreenshots.length}/3)</label>
                    <div className="flex flex-wrap gap-2 items-center">
                      {bugScreenshots.map((src, idx) => (
                        <div key={idx} className="relative w-14 h-14 rounded-xl overflow-hidden border border-neutral-200 group bg-neutral-100 flex items-center justify-center">
                          <img src={src} alt="preview" className="object-cover w-full h-full" />
                          <button
                            type="button"
                            onClick={() => setBugScreenshots(prev => prev.filter((_, i) => i !== idx))}
                            className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition rounded-xl text-white font-bold text-xs"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      {bugScreenshots.length < 3 && (
                        <label className={`w-14 h-14 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-neutral-50 border-neutral-300 hover:border-purple-500 transition text-neutral-400 hover:text-purple-600 ${isBugUploading ? 'pointer-events-none opacity-50' : ''}`}>
                          {isBugUploading ? (
                            <span className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></span>
                          ) : (
                            <>
                              <Plus size={16} />
                              <span className="text-[8px] font-bold mt-0.5 uppercase">Add</span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            disabled={isBugUploading}
                            className="hidden"
                            onChange={async (e) => {
                              if (!e.target.files || e.target.files.length === 0) return;
                              setIsBugUploading(true);
                              try {
                                const files = Array.from(e.target.files);
                                const newBase64s: string[] = [];
                                for (const file of files) {
                                  if (bugScreenshots.length + newBase64s.length >= 3) {
                                    toast.error("You can attach up to 3 screenshots.");
                                    break;
                                  }
                                  const compressed = await compressAndResizeImage(file);
                                  newBase64s.push(compressed);
                                }
                                setBugScreenshots(prev => [...prev, ...newBase64s]);
                                toast.success("Screenshot(s) added and optimized!");
                              } catch (err) {
                                console.error("Error processing image:", err);
                                toast.error("Failed to process layout screenshot.");
                              } finally {
                                setIsBugUploading(false);
                                e.target.value = ''; // Reset uploader
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>
                    <p className="text-[9px] text-neutral-400 mt-1">PNG/JPG up to 3 files. High quality visual compression keeps database transactions super light.</p>
                  </div>

                  <button
                    type="submit"
                    disabled={isBugSubmitting || isBugUploading}
                    className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-bold rounded-xl text-xs uppercase tracking-widest transition shadow-md hover:shadow-lg active:scale-[0.98]"
                  >
                    {isBugSubmitting ? 'Filing Issue Statement...' : 'Submit Issue to Administrators'}
                  </button>
                </form>
              </div>

              {/* History list: 3 cols */}
              <div className="lg:col-span-3 bg-white p-8 rounded-[2rem] border border-neutral-100 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-neutral-900">Your Submitted Bugs ({userBugs.length})</h3>
                    <p className="text-xs text-neutral-400">Live progress feedback loop for reports filed by your account.</p>
                  </div>
                </div>

                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {userBugs.length === 0 ? (
                    <div className="text-center py-16 space-y-3">
                      <div className="w-12 h-12 bg-neutral-50 text-neutral-400 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 size={24} />
                      </div>
                      <h4 className="font-bold text-neutral-800 text-sm">No bugs reported yet</h4>
                      <p className="text-xs text-neutral-400 max-w-xs mx-auto">Use the sidebar form to document any platform issues you come across during your testing.</p>
                    </div>
                  ) : (
                    userBugs.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).map(bug => {
                      const severityColor = {
                        critical: 'bg-red-100 text-red-700 border-red-200',
                        high: 'bg-orange-100 text-orange-700 border-orange-200',
                        medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
                        low: 'bg-blue-100 text-blue-700 border-blue-200'
                      }[bug.severity as string || 'low'];

                      const statusBadge = {
                        open: { bg: 'bg-red-50 text-red-600 border-red-100', text: '🔴 Staged/Open' },
                        in_review: { bg: 'bg-amber-50 text-amber-600 border-amber-100', text: '🟡 Staged for fix' },
                        resolved: { bg: 'bg-emerald-55 bg-emerald-50 text-emerald-700 border-emerald-150', text: '🟢 Fixed & Resolved' },
                        fixed: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-150', text: '🟢 Fixed' }
                      }[bug.status as string || 'open'] || { bg: 'bg-emerald-50 text-emerald-700 border-emerald-150', text: '🟢 Fixed' };

                      const isFixed = bug.status === 'fixed' || bug.status === 'resolved';

                      return (
                        <div key={bug.id} className={`p-5 rounded-2xl border transition flex flex-col gap-3 text-left relative overflow-hidden ${isFixed ? 'border-emerald-100 bg-emerald-50/10' : 'border-neutral-100 bg-white hover:bg-neutral-50/50'}`}>
                          {isFixed && (
                            <div className="absolute top-2 right-2 border border-emerald-200 bg-emerald-50 text-emerald-700 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded font-mono select-none">
                              Fixed
                            </div>
                          )}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border font-mono ${severityColor}`}>
                                {bug.severity}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${statusBadge.bg}`}>
                                {statusBadge.text}
                              </span>
                            </div>
                            <span className="text-[10px] text-neutral-400 font-mono">
                              {bug.createdAt ? new Date(bug.createdAt).toLocaleDateString() : 'Just now'}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <h4 className={`font-bold text-sm leading-snug ${isFixed ? 'line-through text-neutral-400 decoration-neutral-400 decoration-2' : 'text-neutral-900'}`}>{bug.title}</h4>
                            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Module: {bug.module || 'General UI'}</p>
                          </div>

                          <p className={`text-xs p-2.5 rounded-lg border font-mono ${isFixed ? 'line-through text-neutral-400/80 bg-neutral-50/50 border-neutral-150' : 'text-neutral-500 bg-neutral-50 border-neutral-100/60 font-medium'}`}>
                            {bug.description}
                          </p>

                          {/* Screenshots display */}
                          {bug.screenshots && bug.screenshots.length > 0 && (
                            <div className="space-y-1.5 mt-1">
                              <p className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">Attached Screenshots ({bug.screenshots.length}):</p>
                              <div className="flex flex-wrap gap-2">
                                {bug.screenshots.map((img: string, sIdx: number) => (
                                  <div 
                                    key={sIdx} 
                                    onClick={() => setZoomedImage(img)}
                                    className="w-16 h-12 rounded-lg overflow-hidden border border-neutral-200 cursor-pointer hover:opacity-85 hover:border-purple-500 transition bg-neutral-100 relative group flex items-center justify-center shrink-0"
                                  >
                                    <img src={img} alt="Screenshot" className="object-cover w-full h-full" />
                                    <div className="absolute inset-0 bg-black/5 group-hover:bg-black/0 transition" />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Admin comment display */}
                          {bug.adminNotes ? (
                            <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100/50 text-xs text-purple-800 space-y-1 mt-1 font-sans">
                              <p className="font-extrabold text-[9px] uppercase tracking-wider text-purple-600">Admin Response Note:</p>
                              <p className="font-medium">{bug.adminNotes}</p>
                            </div>
                          ) : (
                            <div className="text-[10px] text-neutral-400 italic">No admin comments yet. Waiting for review.</div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      <AnimatePresence>
        {sharingList && (
          <ShareModal
            type="list"
            data={sharingList}
            onClose={() => setSharingList(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => setIsCreating(false)}
                className="absolute top-6 right-6 p-2 text-neutral-400 hover:text-neutral-600 transition"
              >
                <X size={20} />
              </button>
              <h2 className="text-2xl font-bold mb-6">Create New List</h2>
              <form onSubmit={handleCreateList} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">List Name</label>
                  <input
                    type="text"
                    autoFocus
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="e.g. Camera Rental Kit #1"
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="flex-1 py-3 bg-neutral-100 text-neutral-600 rounded-xl font-bold hover:bg-neutral-200 transition flex items-center justify-center text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition shadow-lg flex items-center justify-center text-center"
                  >
                    Create
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Workspace Sandbox creation modal layout */}
      <AnimatePresence>
        {isWorkspaceModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-lg w-full border border-neutral-150 shadow-2xl space-y-6 relative text-left"
            >
              <button
                type="button"
                onClick={() => setIsWorkspaceModalOpen(false)}
                className="absolute top-6 right-6 p-2 text-neutral-400 hover:text-neutral-600 transition"
              >
                <X size={20} />
              </button>

              <div className="space-y-2">
                <h3 className="text-xl font-black text-neutral-900 uppercase tracking-tight">Create Workspace Sandbox</h3>
                <p className="text-xs text-neutral-500 font-semibold leading-relaxed font-sans">
                  Setup a customizable industry channel inside your account. Manage independent assets and list workflows cleanly without blending fields.
                </p>
              </div>

              <form onSubmit={handleCreateWorkspace} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400">Workspace Hub Name</label>
                  <input
                    type="text"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    placeholder="e.g. Workshop Fleet, Showroom Stock..."
                    required
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 font-sans">Focus Industry Category</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1">
                    {INDUSTRIES.map((ind) => (
                      <button
                        key={ind.id}
                        type="button"
                        onClick={() => setNewWorkspaceIndustry(ind.id)}
                        className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2 ${
                          newWorkspaceIndustry === ind.id
                            ? 'border-primary bg-primary/[0.02] ring-2 ring-primary/25'
                            : 'border-neutral-200 hover:bg-neutral-50'
                        }`}
                      >
                        <span className="text-xs font-black text-neutral-800 shrink-0">{ind.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsWorkspaceModalOpen(false)}
                    className="flex-1 py-3 border border-neutral-200 rounded-xl text-neutral-700 font-bold hover:bg-neutral-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-primary hover:bg-primary/95 text-white rounded-xl font-bold transition shadow-lg flex items-center justify-center text-center font-bold"
                  >
                    Launch Sandbox
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {checkoutList && (
          <ManualCheckoutModal
            type="list"
            data={checkoutList}
            user={user}
            onClose={() => setCheckoutList(null)}
          />
        )}
      </AnimatePresence>

      {/* Lightbox Screenshot zoom modal */}
      <AnimatePresence>
        {zoomedImage && (
          <div 
            className="fixed inset-0 bg-neutral-950/85 backdrop-blur-md flex items-center justify-center z-[200] p-4 cursor-pointer"
            onClick={() => setZoomedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl max-h-[85vh] overflow-hidden rounded-3xl shadow-2xl bg-black"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setZoomedImage(null)}
                className="absolute top-4 right-4 p-2 bg-neutral-900/60 hover:bg-neutral-800 text-white rounded-full transition shadow z-10"
              >
                <X size={18} />
              </button>
              <img src={zoomedImage} alt="Zoomed preview" className="max-w-full max-h-[85vh] object-contain block" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
