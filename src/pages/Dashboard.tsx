import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, collectionGroup } from 'firebase/firestore';
import { Plus, Package, Trash2, ChevronRight, Clock, Box, X, Zap, Bell, Calendar, CheckCircle2, AlertCircle, Share2, QrCode, Home, Wrench, Layers, Briefcase, ShoppingBag, Truck, ShieldCheck, Search, Filter, SortAsc, SortDesc, LayoutGrid, List as ListIcon, PanelLeftClose, PanelLeftOpen, ChevronLeft, Menu, TrendingUp, Heart, PieChart, Activity, Users, Building2, Globe, Mail, MapPin, Building } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, PackingList, Reminder, AdminSettings, FeatureKey, GearItem, Organization } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { updateDoc, getDoc } from 'firebase/firestore';
import { isFeatureEnabled } from '../lib/featureUtils';
import { checkLimit } from '../lib/limitUtils';
import { toast } from 'sonner';
import Marketplace from './Marketplace';

type DashboardTab = 'overview' | 'lists' | 'templates' | 'directories' | 'marketplace';
type SortField = 'createdAt' | 'name' | 'status';
type SortOrder = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';

export default function Dashboard({ user, adminSettings: propAdminSettings }: { user: UserProfile, adminSettings: AdminSettings | null }) {
  const [lists, setLists] = useState<PackingList[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [adminSettings, setAdminSettings] = useState<AdminSettings | null>(propAdminSettings);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [sharingList, setSharingList] = useState<PackingList | null>(null);
  const [gear, setGear] = useState<GearItem[]>([]);
  const [newListName, setNewListName] = useState('');
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [allItems, setAllItems] = useState<any[]>([]);
  
  // Custom public directories & sub-group list states
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [orgsList, setOrgsList] = useState<Organization[]>([]);
  const [isDirectoriesLoading, setIsDirectoriesLoading] = useState(true);
  
  // Search, Sort, Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const navigate = useNavigate();
  const location = useLocation();

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
      const settingsDoc = await getDoc(doc(db, 'adminSettings', 'global'));
      if (settingsDoc.exists()) {
        setAdminSettings(settingsDoc.data() as AdminSettings);
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

    const qAllItems = query(collectionGroup(db, 'items'));
    const unsubscribeAllItems = onSnapshot(qAllItems, (snapshot) => {
      setAllItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'items (collectionGroup)');
    });

    const unsubscribeUsers = onSnapshot(query(collection(db, 'users'), where('isProfilePublic', '==', true)), (snapshot) => {
      const fetchedUsers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[];
      setUsersList(fetchedUsers);
      setIsDirectoriesLoading(false);
    }, (error) => {
      console.error("Error fetching directories users:", error);
      setIsDirectoriesLoading(false);
    });

    const unsubscribeOrgs = onSnapshot(collection(db, 'organizations'), (snapshot) => {
      const fetchedOrgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Organization[];
      setOrgsList(fetchedOrgs);
    }, (error) => {
      console.error("Error fetching directories organizations:", error);
    });

    return () => {
      unsubscribeLists();
      unsubscribeReminders();
      unsubscribeGear();
      unsubscribeAllItems();
      unsubscribeUsers();
      unsubscribeOrgs();
    };
  }, [user.uid]);

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
        shareToken: Math.random().toString(36).substring(2, 15), // Generate token by default
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
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
        await deleteDoc(doc(db, 'packingLists', id));
      } catch (error) {
        console.error("Error deleting list:", error);
      }
    }
  };

  const filteredLists = lists.filter(list => {
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

  const recentLists = lists.slice(0, 4);

  const gearStats = {
    categoryData: Object.entries(
      gear.reduce((acc: Record<string, number>, item) => {
        acc[item.category || 'Other'] = (acc[item.category || 'Other'] || 0) + 1;
        return acc;
      }, {})
    ).map(([name, value]) => ({ name, value })),
    conditionData: [
      { name: 'New', value: gear.filter(i => i.condition === 'new').length, color: '#22c55e' },
      { name: 'Good', value: gear.filter(i => i.condition === 'good').length, color: '#3b82f6' },
      { name: 'Fair', value: gear.filter(i => i.condition === 'fair').length, color: '#f59e0b' },
      { name: 'Poor', value: gear.filter(i => i.condition === 'poor').length, color: '#ef4444' },
    ].filter(d => d.value > 0),
    topUsed: [...gear]
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .slice(0, 5),
    totalValue: gear.reduce((acc, item) => acc + (Number(item.price) || 0), 0),
    totalWeight: gear.reduce((acc, item) => acc + (Number(item.weight) || 0), 0),
    auditScore: gear.length > 0 ? (gear.filter(i => i.photoUrls && i.photoUrls.length > 0).length / gear.length) * 100 : 0,
    usageIntensity: gear.length > 0 ? gear.reduce((acc, i) => acc + (i.usageCount || 0), 0) / gear.length : 0
  };

  const distributionData = React.useMemo(() => {
    return lists.map(list => {
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
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight">Gear Lifecycle Dashboard</h1>
          <p className="text-neutral-500">Visual inventory management, asset tracking, and marketplace listings.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition shadow-lg w-full sm:w-auto"
          >
            <Plus size={20} />
            <span>New List</span>
          </button>
          <button
            onClick={() => navigate('/library?addGear=true')}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition shadow-lg w-full sm:w-auto"
          >
            <Plus size={20} />
            <span>Add Gear</span>
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-2xl w-fit">
        <button
          onClick={() => handleTabChange('overview')}
          className={`px-6 py-2.5 rounded-xl font-bold transition-all ${
            activeTab === 'overview' 
              ? 'bg-white text-primary shadow-sm' 
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => handleTabChange('lists')}
          className={`px-6 py-2.5 rounded-xl font-bold transition-all ${
            activeTab === 'lists' 
              ? 'bg-white text-primary shadow-sm' 
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Packing Lists ({lists.filter(l => !l.isTemplate).length})
        </button>
        <button
          onClick={() => handleTabChange('templates')}
          className={`px-6 py-2.5 rounded-xl font-bold transition-all ${
            activeTab === 'templates' 
              ? 'bg-white text-primary shadow-sm' 
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Templates ({lists.filter(l => l.isTemplate).length})
        </button>
        <button
          onClick={() => handleTabChange('directories')}
          className={`px-6 py-2.5 rounded-xl font-bold transition-all ${
            activeTab === 'directories' 
              ? 'bg-white text-primary shadow-sm' 
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Directories
        </button>
        <button
          onClick={() => handleTabChange('marketplace')}
          className={`px-6 py-2.5 rounded-xl font-bold transition-all ${
            activeTab === 'marketplace' 
              ? 'bg-white text-primary shadow-sm' 
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          Marketplace
        </button>
      </div>

      {activeTab === 'overview' ? (
          <div className="space-y-12">
            {/* Stats Summary Cards */}
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
                        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
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
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Organizations Column */}
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <Building2 size={20} className="text-primary" />
                  <h3 className="text-base font-black uppercase tracking-tight text-neutral-700">Organizations ({orgsList.length})</h3>
                </div>
                
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {orgsList.filter(o => o.name?.toLowerCase().includes(searchQuery.toLowerCase()) || o.slug?.toLowerCase().includes(searchQuery.toLowerCase())).map((org) => (
                    <div key={org.id} className="bg-white p-6 rounded-2xl border border-neutral-150/60 shadow-sm space-y-4 hover:border-neutral-300 transition duration-150">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1 min-w-0">
                          <h4 className="font-extrabold text-neutral-900 truncate text-sm">{org.name}</h4>
                          <span className="inline-block px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded text-[9px] font-mono tracking-widest uppercase">
                            /{org.slug}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${org.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {org.status}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between text-[10px] font-bold text-neutral-400 uppercase tracking-wider pt-2 border-t border-neutral-100">
                        <span>Plan: {org.subscriptionPlan || 'Free Tier'}</span>
                        <span className="text-neutral-500 font-black">ID: {org.id.slice(0, 8)}...</span>
                      </div>
                    </div>
                  ))}
                  {orgsList.length === 0 && (
                    <p className="text-neutral-400 text-xs font-bold uppercase tracking-wider italic text-center py-10 bg-white rounded-2xl border border-dashed border-neutral-200">
                      No organizations available in system.
                    </p>
                  )}
                </div>
              </div>

              {/* Public Users Column */}
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <Users size={20} className="text-[#ff4f3a]" />
                  <h3 className="text-base font-black uppercase tracking-tight text-neutral-700">Public User Profiles ({usersList.length})</h3>
                </div>

                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {usersList.filter(u => u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) || (u.company || '').toLowerCase().includes(searchQuery.toLowerCase()) || (u.bio || '').toLowerCase().includes(searchQuery.toLowerCase())).map((pubUser) => (
                    <div key={pubUser.uid} className="bg-white p-6 rounded-2xl border border-neutral-150/60 shadow-sm hover:border-neutral-300 transition duration-150 flex items-start gap-4">
                      <img
                        src={pubUser.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100'}
                        alt={pubUser.displayName}
                        className="w-12 h-12 rounded-xl object-cover border border-neutral-100 mt-1 shrink-0"
                      />
                      <div className="space-y-2 flex-1 min-w-0 font-sans">
                        <div className="space-y-0.5">
                          <h4 className="font-extrabold text-neutral-900 truncate text-sm">{pubUser.displayName}</h4>
                          <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider truncate">
                            {pubUser.company || 'Independent Contractor'} • {pubUser.location || 'Suva, Fiji'}
                          </p>
                        </div>
                        {pubUser.bio && (
                          <p className="text-xs text-neutral-500 leading-relaxed font-semibold italic line-clamp-2">
                            "{pubUser.bio}"
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-[10px] font-bold text-neutral-400 uppercase tracking-wider pt-2 border-t border-neutral-100">
                          <span className="flex items-center gap-1">
                            <Mail size={12} className="text-neutral-450 shrink-0" />
                            {pubUser.email}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {usersList.length === 0 && (
                    <p className="text-neutral-400 text-xs font-bold uppercase tracking-wider italic text-center py-10 bg-white rounded-2xl border border-dashed border-neutral-200">
                      No public user profiles are currently listed. Go to Profile Settings to make yours public!
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'marketplace' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Embed the rich Marketplace Component inside the dashboard seamlessly */}
            <div className="bg-white p-4 rounded-[2rem] border border-neutral-100 shadow-sm overflow-hidden">
              <Marketplace />
            </div>
          </div>
        )}

      <AnimatePresence>
        {sharingList && (
          <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl relative space-y-8"
            >
              <button
                onClick={() => setSharingList(null)}
                className="absolute top-6 right-6 p-2 text-neutral-400 hover:text-neutral-600 transition"
              >
                <X size={20} />
              </button>
              
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">Share {sharingList.name}</h2>
                <p className="text-sm text-neutral-500">Scan to view the public bio view.</p>
              </div>

              <div className="bg-neutral-50 p-6 rounded-3xl flex justify-center border border-neutral-100">
                <QRCodeCanvas 
                  value={`${window.location.origin}/p/${sharingList.id}${sharingList.shareToken ? `?token=${sharingList.shareToken}` : ''}`} 
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/p/${sharingList.id}${sharingList.shareToken ? `?token=${sharingList.shareToken}` : ''}`;
                    navigator.clipboard.writeText(url);
                    setSharingList(null);
                    toast.success('Link copied to clipboard');
                  }}
                  className="flex-1 py-3 bg-neutral-100 text-neutral-600 rounded-xl font-bold hover:bg-neutral-200 transition"
                >
                  Copy Link
                </button>
                <Link
                  to={`/list/${sharingList.id}`}
                  className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition shadow-lg text-center"
                >
                  View List
                </Link>
              </div>
            </motion.div>
          </div>
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
    </div>
  );
}
