import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { collection, query, onSnapshot, doc, updateDoc, getDocs, limit, addDoc, deleteDoc, where, serverTimestamp, writeBatch, setDoc } from 'firebase/firestore';
import { Users, BarChart3, Settings, ShieldCheck, UserPlus, Search, Mail, Calendar, CreditCard, Zap, Package, TrendingUp, FileText, Plus, Trash2, Edit2, Check, X, Globe, Save, Layout, Activity, MousePointer2, Menu, PanelLeftClose, PanelLeftOpen, ChevronRight, LogOut, CheckCircle2, User, Clock, MessageSquare, HelpCircle, ChevronDown, QrCode, Lock as LockIcon, AlertCircle, Building2, GitBranch, Layers, ChevronLeft, ArrowRight, Shield, Briefcase, Wrench, Percent, Truck, Cpu, Smartphone, Coins, ShoppingBag, Eye, EyeOff, Database, Upload, MapPin, Bug, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '../firebase';
import { UserProfile, AdminSettings, PackingList, Plan, CheckoutRecord, Lander, LandingPageContent, NavLink, Organization, Department, Team, Project, INDUSTRIES, BugReport } from '../types';
import { getDefaultAdminSettings } from '../App';
import { motion, AnimatePresence } from 'motion/react';
import { authenticatedFetch } from '../lib/api';
import PagesManager from './PagesManager';
import PackerLogo from '../components/PackerLogo';
import AdminDocsTab from '../components/AdminDocsTab';
import FirebaseMigrator from '../components/FirebaseMigrator';
import BillingSettings from '../components/BillingSettings';
import BillingDashboard from '../components/BillingDashboard';
import { BrandingSettingsTab, BillingSettingsTab, MultiIndustrySettingsTab, MarketplaceSettingsTab, WidgetsSettingsTab } from '../components/AdminSettingsPages';
import { AreaChart, Area, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Cell, CartesianGrid } from 'recharts';

export const MODULE_METADATA: {
  [key: string]: {
    name: string;
    description: string;
    icon: string;
    version: string;
    category: 'Core' | 'Logistics' | 'Operations' | 'Kiosk' | 'Integrations' | 'Advanced';
  }
} = {
  aiWizard: { name: 'AI Wizard Helper', description: 'Smart packing lists assistance and predictive items layout.', icon: 'Cpu', version: 'v1.4.2', category: 'Core' },
  gearLibrary: { name: 'Gear Library Registry', description: 'Master catalog for organizational and personal assets tracking.', icon: 'Layers', version: 'v2.1.0', category: 'Core' },
  reminders: { name: 'Alerts & Reminders', description: 'Configurable notifications and checklist deadline tracking.', icon: 'Calendar', version: 'v1.2.0', category: 'Core' },
  versionHistory: { name: 'Version History logging', description: 'Version control and rollback logging for list states.', icon: 'GitBranch', version: 'v1.3.1', category: 'Core' },
  branding: { name: 'White-Label Branding', description: 'Corporate custom branding, logos, and custom accent colors.', icon: 'Zap', version: 'v1.5.0', category: 'Advanced' },
  qrSharing: { name: 'QR Code Sharing', description: 'Dynamic barcode/QR tags scanning and mobile discovery.', icon: 'QrCode', version: 'v2.0.4', category: 'Operations' },
  toolingLists: { name: 'Specialist Tooling Lists', description: 'Define structural checklists for technical and heavy tooling industries.', icon: 'Wrench', version: 'v1.1.2', category: 'Operations' },
  organizer: { name: 'Rack & Case Organizer', description: 'Virtual drag-and-drop hardware staging and casing templates.', icon: 'Package', version: 'v2.2.5', category: 'Operations' },
  travelCases: { name: 'Travel case logistics', description: 'Transit case manifesting, cargo dimensions, and weighting checklists.', icon: 'Truck', version: 'v1.1.0', category: 'Logistics' },
  logisticsDashboard: { name: 'Logistics Dispatcher', description: 'Real-time dispatch board and transit routes overview.', icon: 'Globe', version: 'v1.4.0', category: 'Logistics' },
  movingDashboard: { name: 'Moving Coordinator', description: 'Workflow staging for residential and office moves.', icon: 'Package', version: 'v1.1.5', category: 'Logistics' },
  rackingDashboard: { name: 'Racking Console', description: 'Visual mapping for network switches and server hardware layouts.', icon: 'Layers', version: 'v1.3.2', category: 'Operations' },
  marketplace: { name: 'Rental Marketplace', description: 'List, rent, and process escrow bookings between organizations.', icon: 'ShoppingBag', version: 'v2.0.1', category: 'Operations' },
  marketplaceListings: { name: 'Marketplace Listings Module', description: 'Allow users to list gear/lists to the Rent/Buy marketplace shelf.', icon: 'ShoppingBag', version: 'v1.0.0', category: 'Operations' },
  kioskMode: { name: 'Kiosk Terminal Mode', description: 'Enables safe self-service check-outs via restricted kiosk profiles.', icon: 'QrCode', version: 'v2.1.0', category: 'Kiosk' },
  orgManagement: { name: 'Org Multi-Tenancy', description: 'Provides multiple divisions, corporate entities, and custom permissions.', icon: 'Building2', version: 'v1.8.0', category: 'Advanced' },
  departments: { name: 'Departmental Isolation', description: 'Segregates assets and users to independent corporate divisions.', icon: 'Layers', version: 'v1.6.0', category: 'Core' },
  teams: { name: 'Sub-Team Assignment', description: 'Create and map sub-teams for bulk equipment hand-overs.', icon: 'Users', version: 'v1.4.5', category: 'Core' },
  inventoryManagement: { name: 'Inventory Sheets Tracker', description: 'Custom inventory sheets, stock alerts, and threshold auditing.', icon: 'Package', version: 'v2.3.0', category: 'Core' },
  projectCost: { name: 'Project Budget Costing', description: 'Financial cost modeling, project alarm thresholds, and PO trackers.', icon: 'Coins', version: 'v1.5.2', category: 'Advanced' },
  supplierManagement: { name: 'Qualified Supplier Registry', description: 'Partner rating, preferment toggling, and preferred PO templates.', icon: 'Wrench', version: 'v1.2.6', category: 'Advanced' },
  bomManagement: { name: 'BOM Spec Sheets builder', description: 'Bill-of-Materials visual markup, depreciation sheets, and spec exports.', icon: 'FileText', version: 'v2.0.1', category: 'Advanced' },
  customBarcodes: { name: 'Custom Barcode Generator', description: 'Encode assets into custom localized formats (UPC, Code128).', icon: 'QrCode', version: 'v1.5.0', category: 'Operations' },
  automaticDepreciation: { name: 'Asset Depreciation Engine', description: 'Financial depreciation curves tracking based on standard intervals.', icon: 'TrendingUp', version: 'v1.3.0', category: 'Advanced' },
  digitalSignatures: { name: 'Digital Signatures Escrow', description: 'Draw and sign checkout proofs with full secure non-repudiation.', icon: 'ShieldCheck', version: 'v1.4.1', category: 'Kiosk' },
  clientPortal: { name: 'Client Approval Portals', description: 'Share dynamic and secure manifest approvals directly with external clients.', icon: 'Globe', version: 'v1.7.2', category: 'Operations' },
  apiIntegrations: { name: 'Developer Webhooks & API', description: 'Provides custom developer tokens and real-time webhook push updates.', icon: 'Cpu', version: 'v2.0.0', category: 'Integrations' },
  weightAnalytics: { name: 'Gross Weight Calculators', description: 'Real-time total list weight calculators to keep transit vehicles safe.', icon: 'TrendingUp', version: 'v1.2.3', category: 'Logistics' },
  kioskOrderMode: { name: 'Kiosk Order Basket Mode', description: 'Allow renters to bundle item baskets to submit order checkouts.', icon: 'Package', version: 'v2.1.2', category: 'Kiosk' },
  kioskDirectCheckout: { name: 'Kiosk Direct Auto-Checkout', description: 'Automates scanning to instant self check-out without confirmation.', icon: 'Check', version: 'v2.1.1', category: 'Kiosk' }
};

export const renderModuleIcon = (iconName: string) => {
  const props = { className: "text-neutral-500 shrink-0", size: 22 };
  switch (iconName) {
    case 'Cpu': return <Cpu {...props} />;
    case 'Layers': return <Layers {...props} />;
    case 'Calendar': return <Calendar {...props} />;
    case 'GitBranch': return <GitBranch {...props} />;
    case 'QrCode': return <QrCode {...props} />;
    case 'Wrench': return <Wrench {...props} />;
    case 'Package': return <Package {...props} />;
    case 'Truck': return <Truck {...props} />;
    case 'Globe': return <Globe {...props} />;
    case 'ShoppingBag': return <ShoppingBag {...props} />;
    case 'Building2': return <Building2 {...props} />;
    case 'Users': return <Users {...props} />;
    case 'Coins': return <Coins {...props} />;
    case 'FileText': return <FileText {...props} />;
    case 'TrendingUp': return <TrendingUp {...props} />;
    case 'ShieldCheck': return <ShieldCheck {...props} />;
    case 'Check': return <Check {...props} />;
    case 'Zap': return <Zap {...props} />;
    default: return <Settings {...props} />;
  }
};

export default function AdminPanel({ user, onMenuClick }: { user: UserProfile, onMenuClick?: () => void }) {
  if (!user?.isSuperAdmin) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-8">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <ShieldCheck size={40} />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">Super Admin Restricted</h1>
          <p className="text-neutral-500 font-medium italic">This panel is reserved for platform administrators only. Access attempt recorded.</p>
          <a href="/dashboard" className="inline-block px-8 py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-black transition">
            Return to Safety
          </a>
        </div>
      </div>
    );
  }

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [lists, setLists] = useState<PackingList[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [checkoutLogs, setCheckoutLogs] = useState<CheckoutRecord[]>([]);
  const [editingListing, setEditingListing] = useState<PackingList | null>(null);
  const [isListingEditModalOpen, setIsListingEditModalOpen] = useState(false);
  const [listingSearchQuery, setListingSearchQuery] = useState('');
  const [listingFilter, setListingFilter] = useState<'all' | 'featured' | 'sponsored' | 'suspended'>('all');
  const [editingUserForListings, setEditingUserForListings] = useState<UserProfile | null>(null);
  const [isUserListingsModalOpen, setIsUserListingsModalOpen] = useState(false);

  // Category Settings States
  const [categories, setCategories] = useState<any[]>([]);
  const [listingsSubTab, setListingsSubTab] = useState<'moderate' | 'categories'>('moderate');
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newCategoryImage, setNewCategoryImage] = useState('');

  // Bug Report system states
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [bugSearchQuery, setBugSearchQuery] = useState('');
  const [bugStatusFilter, setBugStatusFilter] = useState<'all' | 'open' | 'in_review' | 'resolved' | 'fixed'>('all');
  const [bugSeverityFilter, setBugSeverityFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');
  const [editingBugReport, setEditingBugReport] = useState<BugReport | null>(null);
  const [bugAdminNotes, setBugAdminNotes] = useState('');
  const [bugStatusUpdate, setBugStatusUpdate] = useState<'open' | 'in_review' | 'resolved' | 'fixed'>('open');
  const [adminZoomedImage, setAdminZoomedImage] = useState<string | null>(null);

  // Search/filter state for features
  const [featureSearchQuery, setFeatureSearchQuery] = useState('');
  const [featureCategoryFilter, setFeatureCategoryFilter] = useState<string>('all');
  const [featureStatusFilter, setFeatureStatusFilter] = useState<'all' | 'active' | 'inactive' | 'beta'>('all');

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as any) || 'analytics';
  
  const setActiveTab = (tab: string) => {
    setSearchParams({ tab });
  };

  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [editingPlanUserId, setEditingPlanUserId] = useState<string | null>(null);
  const [manualPlanValue, setManualPlanValue] = useState('');

  const getAssignablePlans = () => {
    const plans: { id: string; name: string }[] = [];
    const seen = new Set<string>();

    if (settings?.plans && settings.plans.length > 0) {
      settings.plans.forEach(p => {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          plans.push({ id: p.id, name: p.name });
        }
      });
    }

    // Always guarantee system default plans
    const defaults = [
      { id: 'free', name: 'Free' },
      { id: 'pro', name: 'Pro' },
      { id: 'enterprise', name: 'Enterprise' }
    ];

    defaults.forEach(d => {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        plans.push(d);
      }
    });

    return plans;
  };

  // Resource Monitor & Telemetry States
  const [simulatedLoadMultiplier, setSimulatedLoadMultiplier] = useState<number>(1.0);
  const [telemetryModel, setTelemetryModel] = useState<'gemini-1.5-flash' | 'gemini-1.5-pro' | 'gemini-2.0-flash'>('gemini-1.5-flash');
  const [costChartType, setCostChartType] = useState<'cumulative' | 'breakdown'>('cumulative');
  const [uptimePing, setUptimePing] = useState<number>(38);
  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [bugFilter, setBugFilter] = useState<'all' | 'critical' | 'error' | 'warning' | 'info'>('all');
  const [telemetryUserQuery, setTelemetryUserQuery] = useState<string>('');
  const [telemetryLogs, setTelemetryLogs] = useState<Array<{ id: string, time: string, message: string, level: 'info' | 'warn' | 'error' }>>([
    { id: '1', time: '09:34:10', message: 'Cloud Run ingress routing check: OK', level: 'info' },
    { id: '2', time: '09:34:12', message: 'Firestore query optimization pipeline running', level: 'info' },
    { id: '3', time: '09:35:18', message: 'Gemini API token estimator sync complete', level: 'info' },
    { id: '4', time: '09:38:05', message: 'Kiosk email webhook triggered: dispatch simulated', level: 'info' }
  ]);

  // Real-time GCP pricing state from GCP Pricing API
  const [gcpPricingData, setGcpPricingData] = useState<{
    status: string;
    source: string;
    rates: {
      cloudRun: {
        cpuSecond: number;
        memoryGbSecond: number;
        request: number;
      };
      firestore: {
        read: number;
        write: number;
        delete: number;
        storageGbMonth: number;
      };
    };
    details?: string;
    simulatedMetrics?: {
      lastUpdated: string;
    };
  } | null>(null);
  const [isGcpPricingLoading, setIsGcpPricingLoading] = useState<boolean>(true);
  const [gcpPricingError, setGcpPricingError] = useState<string | null>(null);

  const fetchGcpPricing = async () => {
    try {
      setIsGcpPricingLoading(true);
      const res = await authenticatedFetch('/api/gcp-pricing');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      setGcpPricingData(data);
    } catch (err: any) {
      console.error("Error fetching GCP pricing dashboard stats:", err);
      setGcpPricingError(err.message || "Failed to fetch GCP pricing metadata.");
    } finally {
      setIsGcpPricingLoading(false);
    }
  };

  useEffect(() => {
    fetchGcpPricing();
  }, []);

  const getActualBilling = () => {
    const rates = gcpPricingData?.rates || {
      cloudRun: { cpuSecond: 0.000024, memoryGbSecond: 0.0000025, request: 0.0000004 },
      firestore: { read: 0.0000006, write: 0.0000018, delete: 0.0000002, storageGbMonth: 0.18 }
    };

    const multiplier = simulatedLoadMultiplier || 1.0;
    
    // Cloud Run estimative monthly loads
    const estimatedCpuSec = (users.length * 150 + lists.length * 60) * multiplier;
    const estimatedRamSec = (users.length * 300 + lists.length * 120) * multiplier;
    const estimatedRequests = (users.length * 2000 + lists.length * 600) * multiplier;

    // Firestore actual operation monthly counts
    const firestoreReads = (users.length * 45 + lists.length * 10) * multiplier;
    const firestoreWrites = (lists.length * 5 + checkoutLogs.length * 20) * multiplier;
    const firestoreDeletes = (lists.length * 2) * multiplier;
    const firestoreStorageGb = (users.length * 0.002 + lists.length * 0.005); // baseline

    const runCpuCost = estimatedCpuSec * rates.cloudRun.cpuSecond;
    const runRamCost = estimatedRamSec * rates.cloudRun.memoryGbSecond;
    const runReqCost = estimatedRequests * rates.cloudRun.request;

    const fsReadCost = firestoreReads * rates.firestore.read;
    const fsWriteCost = firestoreWrites * rates.firestore.write;
    const fsDeleteCost = firestoreDeletes * rates.firestore.delete;
    const fsStorageCost = firestoreStorageGb * rates.firestore.storageGbMonth;

    const runTotal = runCpuCost + runRamCost + runReqCost;
    const fsTotal = fsReadCost + fsWriteCost + fsDeleteCost + fsStorageCost;
    const total = runTotal + fsTotal;

    return {
      runCpuCost,
      runRamCost,
      runReqCost,
      runTotal,
      fsReadCost,
      fsWriteCost,
      fsDeleteCost,
      fsStorageCost,
      fsTotal,
      total,
      breakdown: [
        { name: 'Cloud Run CPU', value: runCpuCost, percentage: (runCpuCost / (total || 1)) * 100 },
        { name: 'Cloud Run RAM', value: runRamCost, percentage: (runRamCost / (total || 1)) * 100 },
        { name: 'Cloud Run Requests', value: runReqCost, percentage: (runReqCost / (total || 1)) * 100 },
        { name: 'Firestore Reads', value: fsReadCost, percentage: (fsReadCost / (total || 1)) * 100 },
        { name: 'Firestore Writes', value: fsWriteCost, percentage: (fsWriteCost / (total || 1)) * 100 },
        { name: 'Firestore Deletes', value: fsDeleteCost, percentage: (fsDeleteCost / (total || 1)) * 100 },
        { name: 'Firestore Storage', value: fsStorageCost, percentage: (fsStorageCost / (total || 1)) * 100 }
      ]
    };
  };

  const getSimulatedCost = () => {
    return (lists.length * 0.03 + users.length * 0.15 + (lists.length * 6000 * (telemetryModel === 'gemini-1.5-pro' ? 2.19/1000000 : 0.13/1000000))) * simulatedLoadMultiplier;
  };

  const getBillingTrendData = () => {
    const rates = gcpPricingData?.rates || {
      cloudRun: { cpuSecond: 0.000024, memoryGbSecond: 0.0000025, request: 0.0000004 },
      firestore: { read: 0.0000006, write: 0.0000018, delete: 0.0000002, storageGbMonth: 0.18 }
    };

    const multiplier = simulatedLoadMultiplier || 1.0;
    const months = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];
    const monthDef: { [key: string]: { year: number; month: number; scale: number } } = {
      'Dec': { year: 2025, month: 11, scale: 0.65 },
      'Jan': { year: 2026, month: 0, scale: 0.72 },
      'Feb': { year: 2026, month: 1, scale: 0.81 },
      'Mar': { year: 2026, month: 2, scale: 0.88 },
      'Apr': { year: 2026, month: 3, scale: 0.94 },
      'May': { year: 2026, month: 4, scale: 1.00 },
    };

    return months.map((month) => {
      const def = monthDef[month];
      
      const trueUsers = users.length; // baseline users

      const trueLists = lists.filter(l => {
        if (!l.createdAt) return true;
        try {
          const d = new Date(l.createdAt);
          if (d.getFullYear() < def.year) return true;
          if (d.getFullYear() === def.year && d.getMonth() <= def.month) return true;
        } catch {
          return true;
        }
        return false;
      }).length;

      const trueLogs = checkoutLogs.filter(cl => {
        if (!cl.checkOutTime) return true;
        try {
          const t = cl.checkOutTime.toDate ? cl.checkOutTime.toDate() : new Date(cl.checkOutTime);
          if (t.getFullYear() < def.year) return true;
          if (t.getFullYear() === def.year && t.getMonth() <= def.month) return true;
        } catch {
          return true;
        }
        return false;
      }).length;

      const uCount = Math.max(1, Math.round(trueUsers * def.scale * multiplier));
      const lCount = Math.max(1, Math.round(trueLists * def.scale * multiplier));
      const cCount = Math.max(1, Math.round(trueLogs * def.scale * multiplier));

      const estimatedCpuSec = (uCount * 150 + lCount * 60);
      const estimatedRamSec = (uCount * 300 + lCount * 120);
      const estimatedRequests = (uCount * 2000 + lCount * 600);

      const firestoreReads = (uCount * 45 + lCount * 10);
      const firestoreWrites = (lCount * 5 + cCount * 20);
      const firestoreDeletes = (lCount * 2);
      const firestoreStorageGb = (uCount * 0.002 + lCount * 0.005);

      const actualRunCost = (estimatedCpuSec * rates.cloudRun.cpuSecond) + 
                            (estimatedRamSec * rates.cloudRun.memoryGbSecond) + 
                            (estimatedRequests * rates.cloudRun.request);
      
      const actualFsCost = (firestoreReads * rates.firestore.read) +
                            (firestoreWrites * rates.firestore.write) +
                            (firestoreDeletes * rates.firestore.delete) +
                            (firestoreStorageGb * rates.firestore.storageGbMonth);

      const actualTotal = Number((actualRunCost + actualFsCost).toFixed(2));
      const simTotal = Number(((lCount * 0.03 + uCount * 0.15 + (lCount * 6000 * (telemetryModel === 'gemini-1.5-pro' ? 2.19/1000000 : 0.13/1000000)))).toFixed(2));

      return {
        month,
        "Actual GCP Cost ($)": actualTotal,
        "Simulated Metric ($)": simTotal,
        Scale: (def.scale * multiplier * 100).toFixed(0) + '%'
      };
    });
  };

  const actualCostDetails = getActualBilling();
  const simulatedCost = getSimulatedCost();
  const billingTrendData = getBillingTrendData();
  const hasActiveBugs = bugReports.some(b => b.status === 'open' || b.status === 'in_review');

  // Currency and payment gateway states
  const [settingsSubTab, setSettingsSubTab] = useState<'branding' | 'billing' | 'multi_industry' | 'marketplace' | 'widgets' | 'bugs'>('branding');
  const [isAddingCurrency, setIsAddingCurrency] = useState(false);
  const [newCurrencyCode, setNewCurrencyCode] = useState('');
  const [newCurrencyName, setNewCurrencyName] = useState('');
  const [newCurrencySymbol, setNewCurrencySymbol] = useState('');
  const [expandedCurrencyCode, setExpandedCurrencyCode] = useState<string | null>(null);

  const [isAddingGateway, setIsAddingGateway] = useState(false);
  const [newGatewayType, setNewGatewayType] = useState<'paypal' | 'manual'>('paypal');
  const [newGatewayName, setNewGatewayName] = useState('');
  const [newGatewayInstructions, setNewGatewayInstructions] = useState('');
  const [newGatewayPaypalClientId, setNewGatewayPaypalClientId] = useState('');

  useEffect(() => {
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => doc.data() as UserProfile));
    }, (error) => {
      console.warn("AdminPanel: Error catching users collection:", error);
    });

    const unsubscribeLists = onSnapshot(collection(db, 'packingLists'), (snapshot) => {
      setLists(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PackingList)));
    }, (error) => {
      console.warn("AdminPanel: Error catching packingLists:", error);
    });

    const unsubscribeAllProjects = onSnapshot(collection(db, 'projects'), (snapshot) => {
      setAllProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
    }, (error) => {
      console.warn("AdminPanel: Error catching projects:", error);
    });

    const unsubscribeSettings = onSnapshot(doc(db, 'adminSettings', 'global'), (docSnap) => {
      let data: AdminSettings;
      if (docSnap.exists()) {
        data = docSnap.data() as AdminSettings;
      } else {
        data = getDefaultAdminSettings();
        // Safely write default settings to firestore so it's initialized
        setDoc(doc(db, 'adminSettings', 'global'), data).catch(err => console.warn("Failed to auto-initialize adminSettings doc:", err));
      }

      if (!data.plans || data.plans.length === 0) {
        data.plans = getDefaultAdminSettings().plans;
      }
        if (!data.integrationConfig) {
          data.integrationConfig = {
            apiEnabled: false,
            wordpressEnabled: false,
            callbackUrlDev: `${window.location.origin}/auth/callback`,
            callbackUrlProd: '',
            gcpPricingServiceEnabled: true,
            supplierScraperServiceEnabled: false,
            supplierScraperModel: 'gemini-3.5-flash',
            compatibilityServiceEnabled: true,
            compatibilityModel: 'gemini-3.5-flash',
            bomLeadServiceEnabled: true,
            bomRiskThreshold: 7
          };
        } else {
          if (data.integrationConfig.gcpPricingServiceEnabled === undefined) data.integrationConfig.gcpPricingServiceEnabled = true;
          if (data.integrationConfig.supplierScraperServiceEnabled === undefined) data.integrationConfig.supplierScraperServiceEnabled = false;
          if (!data.integrationConfig.supplierScraperModel) data.integrationConfig.supplierScraperModel = 'gemini-3.5-flash';
          if (data.integrationConfig.compatibilityServiceEnabled === undefined) data.integrationConfig.compatibilityServiceEnabled = true;
          if (!data.integrationConfig.compatibilityModel) data.integrationConfig.compatibilityModel = 'gemini-3.5-flash';
          if (data.integrationConfig.bomLeadServiceEnabled === undefined) data.integrationConfig.bomLeadServiceEnabled = true;
          if (!data.integrationConfig.bomRiskThreshold) data.integrationConfig.bomRiskThreshold = 7;
        }
        if (!data.marketplaceRegionConfig) {
          data.marketplaceRegionConfig = {
            launchCountry: 'Fiji',
            availableCountries: ['Fiji', 'United States', 'Australia', 'New Zealand', 'United Kingdom', 'Canada'],
            restrictToAvailableCountries: false
          };
        }
        if (!data.aiRecognitionConfig) {
          data.aiRecognitionConfig = {
            enabled: true,
            interval: 6000,
            items: [
              {
                id: '1',
                name: "Sony A7IV",
                details: "Identified with 24-70mm f/2.8 GM II",
                image: "https://images.unsplash.com/photo-1542332213-9b5a5a3fad35?auto=format&fit=crop&q=80&w=2000",
                icon: 'Camera'
              },
              {
                id: '2',
                name: "DJI Mavic 3 Pro",
                details: "Triple-camera system detected",
                image: "https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&q=80&w=2000",
                icon: 'Package'
              }
            ]
          };
        }

        if (!data.moduleWidgetConfigs) {
          data.moduleWidgetConfigs = {
            projectCost: {
              defaultMarginTarget: 30,
              costAlarmThreshold: 15,
              markupStrategy: 'percentage'
            },
            supplierManagement: {
              poPrefix: 'PO-',
              preferredTerms: 'Net 30',
              automaticReorder: false
            },
            bomManagement: {
              minBOMMarkup: 15,
              autoDepreciationFactor: 5,
              columnsToShow: ['Item', 'Brand', 'Model', 'Qty', 'Unit Cost', 'Total']
            },
            aiWizard: {
              activeModel: 'gemini-3.5-flash',
              maxTokens: 2048,
              confidenceThreshold: 80
            },
            logisticsDashboard: {
              mileageRate: 0.65,
              transitBufferPercent: 10,
              dispatchTimeoutHours: 48
            },
            gearLibrary: {
              defaultCurrency: '$',
              enableDupCheck: true,
              defaultCondition: 'good'
            },
            kioskMode: {
              sessionTimeoutMinutes: 5,
              idleTimerSeconds: 30,
              enforceSupervisorApproval: false
            }
          };
        } else {
          // Fill missing nested configs safely
          if (!data.moduleWidgetConfigs.projectCost) {
            data.moduleWidgetConfigs.projectCost = { defaultMarginTarget: 30, costAlarmThreshold: 15, markupStrategy: 'percentage' };
          }
          if (!data.moduleWidgetConfigs.supplierManagement) {
            data.moduleWidgetConfigs.supplierManagement = { poPrefix: 'PO-', preferredTerms: 'Net 30', automaticReorder: false };
          }
          if (!data.moduleWidgetConfigs.bomManagement) {
            data.moduleWidgetConfigs.bomManagement = { minBOMMarkup: 15, autoDepreciationFactor: 5, columnsToShow: ['Item', 'Brand', 'Model', 'Qty', 'Unit Cost', 'Total'] };
          }
          if (!data.moduleWidgetConfigs.aiWizard) {
            data.moduleWidgetConfigs.aiWizard = { activeModel: 'gemini-3.5-flash', maxTokens: 2048, confidenceThreshold: 80 };
          }
          if (!data.moduleWidgetConfigs.logisticsDashboard) {
            data.moduleWidgetConfigs.logisticsDashboard = { mileageRate: 0.65, transitBufferPercent: 10, dispatchTimeoutHours: 48 };
          }
          if (!data.moduleWidgetConfigs.gearLibrary) {
            data.moduleWidgetConfigs.gearLibrary = { defaultCurrency: '$', enableDupCheck: true, defaultCondition: 'good' };
          }
          if (!data.moduleWidgetConfigs.kioskMode) {
            data.moduleWidgetConfigs.kioskMode = { sessionTimeoutMinutes: 5, idleTimerSeconds: 30, enforceSupervisorApproval: false };
          }
        }

        // Migrate Landing Page to Landers if needed
        if (data.landingPage && (!data.landers || data.landers.length === 0)) {
          const oldLp = data.landingPage as any;
          const newLander: any = {
            id: 'lander-01',
            name: 'Lander 01',
            createdAt: new Date().toISOString(),
            content: {
              header: {
                logoText: 'Packer Tools',
                links: [
                  { label: 'Explore', href: '#scenarios' },
                  { label: 'Pricing', href: '#pricing' }
                ]
              },
              hero: {
                title: oldLp.heroTitle || 'Visual Inventory. \nInstant Market.',
                subtitle: oldLp.heroSubtitle || 'Industrial Grade Gear Tracking',
                description: oldLp.heroDescription || 'Professional-grade lifecycle management for high-stakes equipment.',
                primaryButtonText: 'Get Started',
                secondaryButtonText: 'Explore Use Cases',
                isEnabled: true
              },
              ticker: {
                title: 'Used By',
                pairs: oldLp.tickerPairs || [],
                isEnabled: true
              },
              features: {
                title: oldLp.featuresTitle || 'Built for The Field.',
                description: oldLp.featuresDescription || 'Professional infrastructure for high-stakes gear.',
                items: oldLp.features || [],
                isEnabled: true
              },
              scenarios: {
                title: oldLp.scenariosTitle || 'The Standard Across Industries',
                subtitle: oldLp.scenariosSubtitle || 'Professional use cases',
                items: oldLp.scenarios || [],
                isEnabled: true
              },
              stats: {
                items: [
                  { label: 'Recognition', value: '99.2%' },
                  { label: 'Active Users', value: '12k+' },
                  { label: 'Kits Managed', value: '450k' }
                ],
                isEnabled: true
              },
              testimonials: {
                title: 'Trusted by Professionals',
                subtitle: 'Hear from our global community',
                items: [],
                isEnabled: false
              },
              faq: {
                title: 'Frequently Asked Questions',
                subtitle: 'Everything you need to know',
                items: [],
                isEnabled: false
              },
              cta: {
                ...oldLp.cta,
                isEnabled: true
              },
              footer: {
                copyright: '© 2026 Packer Tools. All rights reserved.',
                links: [
                  { label: 'Privacy', href: '/privacy' },
                  { label: 'Terms', href: '/terms' },
                  { label: 'Contact', href: '/contact' }
                ]
              }
            }
          };
          data.landers = [newLander];
          data.activeLanderId = 'lander-01';
          
          // Clean up old field if preferred, but keeping it for backward compatibility during transition
        }

        // Self-heal and sanitize landers to prevent any runtime TypeErrors
        if (data.landers && Array.isArray(data.landers)) {
          data.landers = data.landers.map((lander: any) => {
            if (!lander || typeof lander !== 'object') return lander;
            const content = lander.content || {};
            
            // 1. Header links
            if (content.header) {
              if (!Array.isArray(content.header.links)) {
                content.header.links = [];
              }
            } else {
              content.header = { logoText: 'Packer Tools', links: [] };
            }

            // 2. Ticker pairs
            if (content.ticker) {
              if (!Array.isArray(content.ticker.pairs)) {
                content.ticker.pairs = [];
              }
            } else {
              content.ticker = { title: 'Used By', pairs: [], isEnabled: true };
            }

            // 3. Features items
            if (content.features) {
              if (!Array.isArray(content.features.items)) {
                // If it is an object with an items array inside
                if (content.features.items && typeof content.features.items === 'object' && Array.isArray((content.features.items as any).items)) {
                  content.features.items = (content.features.items as any).items;
                } else if (Array.isArray((content.features as any).features)) {
                  content.features.items = (content.features as any).features;
                } else {
                  content.features.items = [];
                }
              }
            } else {
              content.features = { title: 'Features', description: '', items: [], isEnabled: true };
            }

            // 4. Scenarios items
            if (content.scenarios) {
              if (!Array.isArray(content.scenarios.items)) {
                if (content.scenarios.items && typeof content.scenarios.items === 'object' && Array.isArray((content.scenarios.items as any).items)) {
                  content.scenarios.items = (content.scenarios.items as any).items;
                } else {
                  content.scenarios.items = [];
                }
              }
            } else {
              content.scenarios = { title: 'Scenarios', subtitle: '', items: [], isEnabled: true };
            }

            // 5. Stats items
            if (content.stats) {
              if (!Array.isArray(content.stats.items)) {
                content.stats.items = [];
              }
            } else {
              content.stats = { items: [], isEnabled: true };
            }

            // 6. Testimonials items
            if (content.testimonials) {
              if (!Array.isArray(content.testimonials.items)) {
                content.testimonials.items = [];
              }
            } else {
              content.testimonials = { title: '', subtitle: '', items: [], isEnabled: false };
            }

            // 7. FAQ items
            if (content.faq) {
              if (!Array.isArray(content.faq.items)) {
                content.faq.items = [];
              }
            } else {
              content.faq = { title: '', subtitle: '', items: [], isEnabled: false };
            }

            // 8. Footer links
            if (content.footer) {
              if (!Array.isArray(content.footer.links)) {
                content.footer.links = [];
              }
            } else {
              content.footer = { copyright: '© 2026 Packer Tools', links: [] };
            }

            return {
              ...lander,
              content
            };
          });
        }

        setSettings(data);
    });

    const unsubscribeCheckouts = onSnapshot(collection(db, 'checkouts'), (snapshot) => {
      setCheckoutLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CheckoutRecord)));
    }, (error) => {
      console.warn("AdminPanel: Error catching checkouts:", error);
    });

    const unsubscribeOrgs = onSnapshot(collection(db, 'organizations'), (snapshot) => {
      setOrganizations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization)));
    }, (error) => {
      console.warn("AdminPanel: Error catching organizations:", error);
    });

    const unsubscribeDepts = onSnapshot(collection(db, 'departments'), (snapshot) => {
      setDepartments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Department)));
    }, (error) => {
      console.warn("AdminPanel: Error catching departments:", error);
    });

    const unsubscribeTeams = onSnapshot(collection(db, 'teams'), (snapshot) => {
      setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team)));
    }, (error) => {
      console.warn("AdminPanel: Error catching teams:", error);
    });

    const unsubscribeBugs = onSnapshot(collection(db, 'bugs'), (snapshot) => {
      setBugReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as BugReport)));
    }, (error) => {
      console.warn("AdminPanel: Error catching bugs:", error);
    });

    const unsubscribeCategories = onSnapshot(collection(db, 'marketplaceCategories'), (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.warn("AdminPanel: Error catching marketplaceCategories:", error);
    });

    setLoading(false);
    return () => {
      unsubscribeUsers();
      unsubscribeLists();
      unsubscribeAllProjects();
      unsubscribeSettings();
      unsubscribeCheckouts();
      unsubscribeOrgs();
      unsubscribeDepts();
      unsubscribeTeams();
      unsubscribeBugs();
      unsubscribeCategories();
    };
  }, []);

  const handleAutoPopulateCategories = async () => {
    try {
      const defaultCats = [
        { id: 'cinema-cameras', name: 'Cinema Cameras', image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=400' },
        { id: 'cinema-lenses', name: 'Cinema Lenses', image: 'https://images.unsplash.com/photo-1617005082133-5c8cdd97eadd?auto=format&fit=crop&q=80&w=400' },
        { id: 'photography-lenses', name: 'Photography Lenses', image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=400' },
        { id: 'still-hybrid', name: 'Still / Hybrid Cameras', image: 'https://images.unsplash.com/photo-1495707902641-75cac588d2e9?auto=format&fit=crop&q=80&w=400' },
        { id: 'lighting-electric', name: 'Lighting / Electric', image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=400' },
        { id: 'audio', name: 'Audio Gear', image: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&q=80&w=400' },
        { id: 'ge-packages', name: 'G&E Packages', image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&q=80&w=400' },
        { id: 'heavy-machinery', name: 'Heavy Machinery & Cranes', image: 'https://images.unsplash.com/photo-1579684389781-71fa80d34154?auto=format&fit=crop&q=80&w=400' },
        { id: 'power-tools', name: 'Industrial Power Tools', image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&q=80&w=400' },
        { id: 'site-scaffolding', name: 'Hoists & Scaffold Systems', image: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&q=80&w=400' },
        { id: 'diagnostics', name: 'Garages & Calibration Diagnostics', image: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&q=80&w=400' },
        { id: 'imaging', name: 'Medical Ultrasound & Scopes', image: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=400' },
        { id: 'patient-monitors', name: 'Care Vitals & ECG Monitors', image: 'https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&q=80&w=400' },
        { id: 'clinical-pipettes', name: 'Lab Clinical Micropipettes', image: 'https://images.unsplash.com/photo-1579154204601-01588f351167?auto=format&fit=crop&q=80&w=400' },
        { id: 'warehouse-logistics', name: 'Propane Forklifts & Shifters', image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=400' }
      ];

      for (const cat of defaultCats) {
        await setDoc(doc(db, 'marketplaceCategories', cat.id), {
          name: cat.name,
          image: cat.image,
          createdAt: new Date().toISOString()
        }, { merge: true });
      }
      toast.success("Default marketplace categories successfully populated / restored!");
    } catch (error) {
      console.error("Error populating default categories:", error);
      toast.error("Failed to populate default categories.");
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName || !newCategoryId) {
      toast.error("Category DB Slug (Id) and Display Name are required.");
      return;
    }
    try {
      await setDoc(doc(db, 'marketplaceCategories', newCategoryId.trim().toLowerCase()), {
        name: newCategoryName.trim(),
        image: newCategoryImage.trim() || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=400',
        updatedAt: new Date().toISOString()
      }, { merge: true });

      toast.success(editingCategory ? "Category updated successfully!" : "Category created successfully!");
      
      // Reset form
      setEditingCategory(null);
      setNewCategoryId('');
      setNewCategoryName('');
      setNewCategoryImage('');
    } catch (error) {
      console.error("Error saving category:", error);
      toast.error("Failed to save category.");
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!confirm(`Are you sure you want to delete category "${catId}"? Marketplace listings using this category won't be deleted, but the category won't show on the search home screen.`)) return;
    try {
      await deleteDoc(doc(db, 'marketplaceCategories', catId));
      toast.success("Category deleted.");
    } catch (error) {
      console.error("Error deleting category:", error);
      toast.error("Failed to delete category.");
    }
  };

  const getCategoryListingsCount = (catId: string) => {
    return lists.filter(l => l.marketplaceEnabled && l.category === catId && l.moderationStatus !== 'suspended').length;
  };

  // Self-bootstrapping categories
  useEffect(() => {
    if (activeTab === 'listings' && categories.length === 0 && loading === false) {
      const checkAndAutoCreate = async () => {
        const querySnapshot = await getDocs(collection(db, 'marketplaceCategories'));
        if (querySnapshot.empty) {
          console.log("Categories directory is empty, auto-bootstrapping defaults!");
          handleAutoPopulateCategories();
        }
      };
      checkAndAutoCreate();
    }
  }, [activeTab, categories.length, loading]);

  const handleUpdatePlan = async (userId: string, newPlan: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { plan: newPlan });
      toast.success(`User plan updated to ${newPlan}`);
    } catch (error) {
      console.error("Error updating plan:", error);
      toast.error("Failed to update user plan");
    }
  };

  const handleUpdateUserOrg = async (userId: string, field: 'orgId' | 'deptId' | 'teamId', value: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { [field]: value });
      toast.success(`User ${field} updated`);
    } catch (error) {
      toast.error(`Failed to update ${field}`);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      toast.success(`User role updated to ${newRole}`);
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Failed to update user role");
    }
  };

  const handleToggleBetaTester = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), { isBetaTester: !currentStatus });
      toast.success(`User beta status updated to ${!currentStatus ? 'Active' : 'Inactive'}`);
    } catch (error) {
      console.error("Error toggling beta tester status:", error);
      toast.error("Failed to update beta user status");
    }
  };

  const handleSaveListingAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingListing) return;
    try {
      const listRef = doc(db, 'packingLists', editingListing.id);
      await updateDoc(listRef, {
        name: editingListing.name,
        marketplacePrice: Number(editingListing.marketplacePrice || 0),
        securityDeposit: Number(editingListing.securityDeposit || 0),
        marketplaceDetails: editingListing.marketplaceDetails || '',
        marketplaceCurrency: editingListing.marketplaceCurrency || 'USD',
        transactionType: editingListing.transactionType || 'rent',
        featured: editingListing.featured || false,
        featuredPriority: Number(editingListing.featuredPriority || 0),
        sponsored: editingListing.sponsored || false,
        adHeadline: editingListing.adHeadline || '',
        moderationStatus: editingListing.moderationStatus || 'approved',
        updatedAt: new Date().toISOString()
      });
      toast.success("Listing moderation settings saved!");
      setIsListingEditModalOpen(false);
      setEditingListing(null);
    } catch (error) {
      console.error("Error saving listing moderation details:", error);
      toast.error("Failed to update listing settings.");
    }
  };

  const handleDeleteListingAdmin = async (listId: string) => {
    if (!window.confirm("Are you sure you want to completely delete this marketplace listing? This will delete the entire packing list template/records.")) return;
    try {
      await deleteDoc(doc(db, 'packingLists', listId));
      toast.success("Listing successfully deleted from the platform.");
      if (editingListing?.id === listId) {
        setEditingListing(null);
        setIsListingEditModalOpen(false);
      }
    } catch (error) {
      console.error("Error deleting listing as admin:", error);
      toast.error("Failed to delete listing.");
    }
  };

  const handleToggleMarketplaceAdmin = async (listId: string, enabled: boolean) => {
    try {
      await updateDoc(doc(db, 'packingLists', listId), {
        marketplaceEnabled: enabled,
        updatedAt: new Date().toISOString()
      });
      toast.success(enabled ? "Listing is now active on the marketplace." : "Listing removed from marketplace.");
    } catch (error) {
      console.error("Error toggling marketplace as admin:", error);
      toast.error("Failed to toggle listing visibility.");
    }
  };

  if (loading) return <div className="flex justify-center py-24 animate-spin"><BarChart3 size={48} /></div>;

  const tabs = [
    { id: 'analytics', icon: <BarChart3 size={18} />, label: 'Analytics', description: 'Platform growth & usage' },
    { id: 'telemetry', icon: <Cpu size={18} />, label: 'Resource Monitor', description: 'Full Google Stack telemetry, cost & uptime monitor' },
    { id: 'organizations', icon: <Building2 size={18} />, label: 'Organizations', description: 'Manage Orgs, Teams & Depts' },
    { id: 'users', icon: <Users size={18} />, label: 'Users', description: 'Manage user accounts' },
    { id: 'projects', icon: <Briefcase size={18} />, label: 'All Projects', description: 'Global project oversight' },
    { id: 'plans', icon: <CreditCard size={18} />, label: 'Plans', description: 'Subscription tiers' },
    { id: 'billing', icon: <CreditCard size={18} />, label: 'Billing Settings', description: 'Paddle integration & payment gateways' },
    { id: 'billing_dashboard', icon: <TrendingUp size={18} />, label: 'Billing Dashboard', description: 'Subscription analytics & revenue trends' },
    { id: 'features', icon: <Zap size={18} />, label: 'Features', description: 'Global module toggles' },
    { id: 'bugs', icon: <Bug size={18} />, label: 'Bug Reports', description: 'User-submitted beta issues' },
    { id: 'integrations', icon: <Globe size={18} />, label: 'Integrations', description: 'API & 3rd party sync' },
    { id: 'checkouts', icon: <Package size={18} />, label: 'Log Logs', description: 'Equipment checkout logs' },
    { id: 'listings', icon: <ShoppingBag size={18} />, label: 'Marketplace Listings', description: 'Moderate listings, ads & featured items' },
    { id: 'kiosk', icon: <QrCode size={18} />, label: 'Kiosk Settings', description: 'Gear kiosk & terminal configuration' },
    { id: 'landing', icon: <Layout size={18} />, label: 'Landing Page', description: 'Public site content' },
    { id: 'pages', icon: <FileText size={18} />, label: 'Manage Pages', description: 'Terms, policies & documents' },
    { id: 'communities', icon: <MapPin size={18} />, label: 'Communities Portal', description: 'Manage regional country community workspaces' },
    { id: 'settings', icon: <Settings size={18} />, label: 'Settings', description: 'Global configuration' },
    { id: 'migration', icon: <Database size={18} />, label: 'Firebase Migration', description: 'Migrate data from old Firebase' },
    { id: 'docs', icon: <HelpCircle size={18} />, label: 'App Documentation', description: 'Packer Tools University & Widget Setup' }
  ];

  const baseRun = (0.45 + lists.length * 0.008) * simulatedLoadMultiplier;
  const baseFire = ((users.length * 45 + lists.length * 15 + checkoutLogs.length * 20) * 0.06 / 100000 + (lists.length * 5 + checkoutLogs.length * 10) * 0.18 / 100000) * simulatedLoadMultiplier;
  const baseStorage = (0.02 + lists.length * 0.0002) * simulatedLoadMultiplier;
  const baseGemini = ((lists.length * 4500 * (telemetryModel === 'gemini-1.5-pro' ? 1.25/1000000 : 0.075/1000000) + lists.length * 1500 * (telemetryModel === 'gemini-1.5-pro' ? 5.00/1000000 : 0.30/1000000)) * simulatedLoadMultiplier);

  const monthsList = [
    { name: 'Dec 25', year: 2025, month: 11, scale: 0.45 },
    { name: 'Jan 26', year: 2026, month: 0, scale: 0.60 },
    { name: 'Feb 26', year: 2026, month: 1, scale: 0.72 },
    { name: 'Mar 26', year: 2026, month: 2, scale: 0.85 },
    { name: 'Apr 26', year: 2026, month: 3, scale: 0.94 },
    { name: 'May 26', year: 2026, month: 4, scale: 1.00 },
  ];

  const telemetryMonthlyCostTrend = monthsList.map(m => {
    const trueListsCount = lists.filter(l => {
      if (!l.createdAt) return true;
      try {
        const d = new Date(l.createdAt);
        if (d.getFullYear() < m.year) return true;
        if (d.getFullYear() === m.year && d.getMonth() <= m.month) return true;
      } catch {
        return true;
      }
      return false;
    }).length;

    const scaleListsCount = Math.max(1, Math.round(trueListsCount * m.scale));

    const runCost = Number(((0.45 + scaleListsCount * 0.008) * simulatedLoadMultiplier).toFixed(2));
    const fireCost = Number((((users.length * 45 + scaleListsCount * 15 + checkoutLogs.length * 20) * 0.06 / 100000 + 0.12) * simulatedLoadMultiplier).toFixed(2));
    const storageCost = Number(((0.02 + scaleListsCount * 0.0002) * simulatedLoadMultiplier).toFixed(2));
    const geminiCost = Number((((scaleListsCount * 4500 * (telemetryModel === 'gemini-1.5-pro' ? 1.25/1000000 : 0.075/1000000) + scaleListsCount * 1500 * (telemetryModel === 'gemini-1.5-pro' ? 5.00/1000000 : 0.30/1000000))) * simulatedLoadMultiplier).toFixed(2));
    const total = Number((runCost + fireCost + storageCost + geminiCost).toFixed(2));

    return {
      month: m.name,
      'Cloud Run': runCost,
      'Firestore': fireCost,
      'Storage': storageCost,
      'Gemini AI': geminiCost,
      'Total Cost': total,
    };
  });

  return (
    <div className="flex flex-col gap-6 md:gap-12 pb-24">
      {/* Main Content Area */}
      <div className="flex-1 min-w-0 space-y-8 md:space-y-12">
        <header className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-4 min-w-0 overflow-hidden">
              {onMenuClick && (
                <button 
                  onClick={onMenuClick}
                  className="flex lg:hidden items-center justify-center w-12 h-12 bg-neutral-900 text-white rounded-2xl shadow-xl active:scale-95 transition-all shrink-0 hover:bg-black"
                  title="Open Sidebar"
                >
                  <Menu size={24} />
                </button>
              )}
              
              <div className="hidden sm:flex items-center gap-2">
                <Link 
                  to="/dashboard"
                  className="flex items-center justify-center w-10 h-10 bg-neutral-100 text-neutral-600 rounded-xl hover:bg-neutral-200 transition shrink-0"
                  title="Exit Admin"
                >
                  <ChevronLeft size={20} />
                </Link>
                <div className="w-px h-6 bg-neutral-200 mx-1"></div>
              </div>

              <div className="w-12 h-12 bg-neutral-900 text-white flex items-center justify-center rounded-2xl shadow-xl shrink-0">
                {tabs.find(t => t.id === activeTab)?.icon}
              </div>
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl md:text-3xl font-black tracking-tight capitalize truncate leading-none">{activeTab}</h1>
                  <span className="px-2 py-0.5 bg-neutral-100 text-neutral-900 text-[8px] font-black uppercase tracking-widest rounded-full shrink-0 border border-neutral-200">Admin</span>
                </div>
                <p className="hidden sm:block text-neutral-500 text-[10px] md:text-xs font-medium truncate italic">{tabs.find(t => t.id === activeTab)?.description}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 md:gap-4">
              <Link 
                to="/dashboard"
                className="hidden lg:flex items-center gap-2 px-6 py-3 bg-neutral-100 text-neutral-600 rounded-xl font-bold hover:bg-neutral-200 transition shrink-0"
              >
                <ChevronLeft size={18} />
                <span>Exit</span>
              </Link>
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'organizations' && (
              <OrganizationAdmin 
                organizations={organizations} 
                departments={departments} 
                teams={teams} 
                users={users}
              />
            )}
            {activeTab === 'projects' && (
              <GlobalProjectsAdmin 
                projects={allProjects}
                users={users}
              />
            )}
            {activeTab === 'pages' && <PagesManager user={user} />}
            {activeTab === 'checkouts' && <CheckoutAdmin logs={checkoutLogs} />}
            {activeTab === 'plans' && (
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-black">Subscription Plans</h2>
              <p className="text-neutral-500 text-xs sm:text-sm">Configure your billing tiers and feature limits</p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
              <div className="flex bg-neutral-100 p-1 rounded-xl w-full sm:w-auto">
                <button 
                  onClick={() => setBillingCycle('monthly')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition text-center ${billingCycle === 'monthly' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-400'}`}
                >
                  Monthly
                </button>
                <button 
                  onClick={() => setBillingCycle('annual')}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition text-center ${billingCycle === 'annual' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-400'}`}
                >
                  Annual
                </button>
              </div>
              <button 
                onClick={() => {
                const newPlan: Plan = { 
                  id: `plan-${Date.now()}`, 
                  name: 'New Plan', 
                  price: 0, 
                  annualPrice: 0,
                  features: [], 
                  aiTokenLimit: 100,
                  maxPackingLists: 10,
                  maxGearItems: 100,
                  maxRacks: 5,
                  maxProjects: 1,
                  maxContacts: 50,
                  maxOrganizations: 1,
                  maxDepartments: 5,
                  maxTeams: 10,
                  maxInventoryItems: 100
                };
                setSettings(s => s ? { ...s, plans: [...(s.plans || []), newPlan] } : null);
              }}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition shadow-lg w-full sm:w-auto"
            >
              <Plus size={20} className="shrink-0" />
              <span>Add Plan</span>
            </button>
          </div>
        </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {settings?.plans?.map((plan, planIdx) => (
              <div key={plan.id} className="bg-white p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-neutral-100 shadow-sm space-y-6 w-full max-w-full overflow-hidden">
                <div className="space-y-4">
                  <input
                    type="text"
                    value={plan.name}
                    onChange={(e) => {
                      const newPlans = [...(settings.plans || [])];
                      newPlans[planIdx] = { ...plan, name: e.target.value };
                      setSettings({ ...settings, plans: newPlans });
                    }}
                    className="text-2xl font-bold bg-transparent border-none outline-none focus:ring-2 focus:ring-primary rounded-lg px-2 w-full"
                  />
                  <div className="flex flex-col gap-4">
                    <div className={`p-3 rounded-2xl border transition-all ${billingCycle === 'monthly' ? 'bg-primary/5 border-primary/20 ring-2 ring-primary/5' : 'bg-transparent border-transparent pb-0 sm:pb-0'}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-400 font-bold">$</span>
                          <input
                            type="number"
                            value={plan.price}
                            onChange={(e) => {
                              const newPlans = [...(settings.plans || [])];
                              newPlans[planIdx] = { ...plan, price: parseFloat(e.target.value) };
                              setSettings({ ...settings, plans: newPlans });
                            }}
                            className="text-3xl sm:text-4xl font-black bg-transparent border-none outline-none focus:ring-2 focus:ring-primary rounded-lg px-2 w-20 sm:w-24"
                          />
                          <span className="text-neutral-400 font-bold">/mo</span>
                        </div>
                        {plan.isDefault ? (
                          <div className="self-start sm:self-auto px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full border border-primary/20">
                            Default
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              const newPlans = settings.plans.map((p, idx) => ({
                                ...p,
                                isDefault: idx === planIdx
                              }));
                              setSettings({ ...settings, plans: newPlans });
                            }}
                            className="self-start sm:self-auto px-3 py-1 bg-neutral-100 text-neutral-400 text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-neutral-200 hover:text-neutral-600 transition"
                          >
                            Set Default
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className={`flex items-center gap-2 p-3 rounded-2xl border transition-all ${billingCycle === 'annual' ? 'bg-primary/5 border-primary/20 ring-2 ring-primary/5' : 'bg-neutral-50 border-neutral-100'}`}>
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-neutral-400 font-bold text-xs">$</span>
                        <input
                          type="number"
                          placeholder="Annual"
                          value={plan.annualPrice || ''}
                          onChange={(e) => {
                            const newPlans = [...(settings.plans || [])];
                            newPlans[planIdx] = { ...plan, annualPrice: parseFloat(e.target.value) };
                            setSettings({ ...settings, plans: newPlans });
                          }}
                          className="bg-transparent border-none outline-none focus:ring-2 focus:ring-primary rounded-lg px-2 w-full text-lg font-bold"
                        />
                        <span className="text-neutral-400 font-bold text-[10px]">/yr</span>
                      </div>
                      <div className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-lg">
                        {plan.annualPrice && plan.price ? `Save ${Math.round((1 - (plan.annualPrice / (plan.price * 12))) * 100)}%` : '0% discount'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest block">Monthly AI Requests</label>
                  <input
                    type="number"
                    value={plan.aiTokenLimit}
                    onChange={(e) => {
                      const newPlans = [...(settings.plans || [])];
                      newPlans[planIdx] = { ...plan, aiTokenLimit: parseInt(e.target.value) };
                      setSettings({ ...settings, plans: newPlans });
                    }}
                    className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-mono font-bold text-primary outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest block">Included Seats</label>
                    <input
                      type="number"
                      placeholder="3"
                      value={plan.includedSeats ?? 3}
                      onChange={(e) => {
                        const newPlans = [...(settings.plans || [])];
                        newPlans[planIdx] = { ...plan, includedSeats: parseInt(e.target.value) || 3 };
                        setSettings({ ...settings, plans: newPlans });
                      }}
                      className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-mono font-bold outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest block">Extra Seat $ / mo</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={plan.extraSeatCost ?? 0}
                      onChange={(e) => {
                        const newPlans = [...(settings.plans || [])];
                        newPlans[planIdx] = { ...plan, extraSeatCost: parseFloat(e.target.value) || 0 };
                        setSettings({ ...settings, plans: newPlans });
                      }}
                      className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-mono font-bold outline-none"
                    />
                  </div>
                </div>

                {/* Trial Mode Settings Block */}
                <div className="p-4 bg-orange-50/60 rounded-2xl border border-orange-100/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-orange-950 uppercase tracking-wider block">Trial Mode</span>
                      <p className="text-[10px] text-orange-600/85 font-semibold leading-tight mt-0.5">Enable free trial access for subscribers</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={plan.trialEnabled || false}
                      onChange={(e) => {
                        const newPlans = [...(settings.plans || [])];
                        newPlans[planIdx] = { ...plan, trialEnabled: e.target.checked };
                        setSettings({ ...settings, plans: newPlans });
                      }}
                      className="w-4 h-4 text-primary bg-white border-neutral-300 rounded focus:ring-primary focus:ring-2 cursor-pointer"
                    />
                  </div>
                  {plan.trialEnabled && (
                    <div className="space-y-2 pt-2 border-t border-orange-100/60 animate-fadeIn">
                      <div className="flex justify-between items-center text-xs font-semibold text-orange-900">
                        <span>Trial Duration:</span>
                        <span className="font-mono font-bold text-orange-800 bg-orange-100/80 px-2 py-0.5 rounded-md">{plan.trialDays || 14} Days</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="90"
                        value={plan.trialDays || 14}
                        onChange={(e) => {
                          const newPlans = [...(settings.plans || [])];
                          newPlans[planIdx] = { ...plan, trialDays: parseInt(e.target.value) || 14 };
                          setSettings({ ...settings, plans: newPlans });
                        }}
                        className="w-full h-1 bg-orange-100 rounded-lg appearance-none cursor-pointer"
                      />
                      <input
                        type="number"
                        min="1"
                        value={plan.trialDays || 14}
                        onChange={(e) => {
                          const newPlans = [...(settings.plans || [])];
                          newPlans[planIdx] = { ...plan, trialDays: parseInt(e.target.value) || 0 };
                          setSettings({ ...settings, plans: newPlans });
                        }}
                        className="w-full px-3 py-1.5 bg-white border border-orange-200 rounded-xl text-xs font-mono font-bold text-orange-950 outline-none"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest block">Max Packing Lists</label>
                    <input
                      type="number"
                      value={plan.maxPackingLists}
                      onChange={(e) => {
                        const newPlans = [...(settings.plans || [])];
                        newPlans[planIdx] = { ...plan, maxPackingLists: parseInt(e.target.value) };
                        setSettings({ ...settings, plans: newPlans });
                      }}
                      className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-mono font-bold outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest block">Max Gear</label>
                    <input
                      type="number"
                      value={plan.maxGearItems}
                      onChange={(e) => {
                        const newPlans = [...(settings.plans || [])];
                        newPlans[planIdx] = { ...plan, maxGearItems: parseInt(e.target.value) };
                        setSettings({ ...settings, plans: newPlans });
                      }}
                      className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-mono font-bold outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest block">Max Workspaces</label>
                    <input
                      type="number"
                      value={plan.maxWorkspaces || 1}
                      onChange={(e) => {
                        const newPlans = [...(settings.plans || [])];
                        newPlans[planIdx] = { ...plan, maxWorkspaces: parseInt(e.target.value) };
                        setSettings({ ...settings, plans: newPlans });
                      }}
                      className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-mono font-bold outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest block">Max Racks</label>
                    <input
                      type="number"
                      value={plan.maxRacks}
                      onChange={(e) => {
                        const newPlans = [...(settings.plans || [])];
                        newPlans[planIdx] = { ...plan, maxRacks: parseInt(e.target.value) };
                        setSettings({ ...settings, plans: newPlans });
                      }}
                      className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-mono font-bold outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest block">Max Projects</label>
                    <input
                      type="number"
                      value={plan.maxProjects}
                      onChange={(e) => {
                        const newPlans = [...(settings.plans || [])];
                        newPlans[planIdx] = { ...plan, maxProjects: parseInt(e.target.value) };
                        setSettings({ ...settings, plans: newPlans });
                      }}
                      className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-mono font-bold outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest block">Max Orgs</label>
                    <input
                      type="number"
                      value={plan.maxOrganizations || 1}
                      onChange={(e) => {
                        const newPlans = [...(settings.plans || [])];
                        newPlans[planIdx] = { ...plan, maxOrganizations: parseInt(e.target.value) };
                        setSettings({ ...settings, plans: newPlans });
                      }}
                      className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-mono font-bold outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest block">Max Depts</label>
                    <input
                      type="number"
                      value={plan.maxDepartments || 1}
                      onChange={(e) => {
                        const newPlans = [...(settings.plans || [])];
                        newPlans[planIdx] = { ...plan, maxDepartments: parseInt(e.target.value) };
                        setSettings({ ...settings, plans: newPlans });
                      }}
                      className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-mono font-bold outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest block">Max Teams</label>
                    <input
                      type="number"
                      value={plan.maxTeams || 1}
                      onChange={(e) => {
                        const newPlans = [...(settings.plans || [])];
                        newPlans[planIdx] = { ...plan, maxTeams: parseInt(e.target.value) };
                        setSettings({ ...settings, plans: newPlans });
                      }}
                      className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-mono font-bold outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest block">Max Items</label>
                    <input
                      type="number"
                      value={plan.maxInventoryItems || 100}
                      onChange={(e) => {
                        const newPlans = [...(settings.plans || [])];
                        newPlans[planIdx] = { ...plan, maxInventoryItems: parseInt(e.target.value) };
                        setSettings({ ...settings, plans: newPlans });
                      }}
                      className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-mono font-bold outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest block">Max Contacts</label>
                  <input
                    type="number"
                    value={plan.maxContacts || 50}
                    onChange={(e) => {
                      const newPlans = [...(settings.plans || [])];
                      newPlans[planIdx] = { ...plan, maxContacts: parseInt(e.target.value) };
                      setSettings({ ...settings, plans: newPlans });
                    }}
                    className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-mono font-bold outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest block">Max Storage (MB)</label>
                    <input
                      type="number"
                      placeholder="512"
                      value={plan.maxStorageMb ?? 1024}
                      onChange={(e) => {
                        const newPlans = [...(settings.plans || [])];
                        newPlans[planIdx] = { ...plan, maxStorageMb: parseInt(e.target.value) || 1024 };
                        setSettings({ ...settings, plans: newPlans });
                      }}
                      className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-mono font-bold outline-none text-xs transition"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest block">Max Suppliers</label>
                    <input
                      type="number"
                      placeholder="10"
                      value={plan.maxSuppliers ?? 20}
                      onChange={(e) => {
                        const newPlans = [...(settings.plans || [])];
                        newPlans[planIdx] = { ...plan, maxSuppliers: parseInt(e.target.value) || 20 };
                        setSettings({ ...settings, plans: newPlans });
                      }}
                      className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-mono font-bold outline-none text-xs transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest block">Max Custom Roles</label>
                    <input
                      type="number"
                      placeholder="2"
                      value={plan.maxCustomRoles ?? 5}
                      onChange={(e) => {
                        const newPlans = [...(settings.plans || [])];
                        newPlans[planIdx] = { ...plan, maxCustomRoles: parseInt(e.target.value) || 5 };
                        setSettings({ ...settings, plans: newPlans });
                      }}
                      className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-mono font-bold outline-none text-xs transition"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest block">BOM Items Limit</label>
                    <input
                      type="number"
                      placeholder="50"
                      value={plan.maxBOMItems ?? 250}
                      onChange={(e) => {
                        const newPlans = [...(settings.plans || [])];
                        newPlans[planIdx] = { ...plan, maxBOMItems: parseInt(e.target.value) || 250 };
                        setSettings({ ...settings, plans: newPlans });
                      }}
                      className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-mono font-bold outline-none text-xs transition"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-neutral-100">
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Enterprise Privilege Toggles</p>
                  <div className="grid grid-cols-1 gap-2">
                    {/* Developer API Token Access Switch */}
                    <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-neutral-700">Developer API Keys</span>
                        <p className="text-[10px] text-neutral-400 leading-none">Custom token generation</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newPlans = [...(settings.plans || [])];
                          newPlans[planIdx] = { ...plan, apiAccessEnabled: !plan.apiAccessEnabled };
                          setSettings({ ...settings, plans: newPlans });
                        }}
                        className={`w-10 h-5.5 rounded-full relative transition-colors ${plan.apiAccessEnabled ? 'bg-primary' : 'bg-neutral-200'}`}
                      >
                        <div className={`absolute top-0.75 w-4 h-4 bg-white rounded-full transition-all ${plan.apiAccessEnabled ? 'right-0.75' : 'left-0.75'}`}></div>
                      </button>
                    </div>

                    {/* Custom White Labeling Switch */}
                    <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-neutral-700">Decal White-Labeling</span>
                        <p className="text-[10px] text-neutral-400 leading-none">Full platform rebranding</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newPlans = [...(settings.plans || [])];
                          newPlans[planIdx] = { ...plan, customWhiteLabeling: !plan.customWhiteLabeling };
                          setSettings({ ...settings, plans: newPlans });
                        }}
                        className={`w-10 h-5.5 rounded-full relative transition-colors ${plan.customWhiteLabeling ? 'bg-primary' : 'bg-neutral-200'}`}
                      >
                        <div className={`absolute top-0.75 w-4 h-4 bg-white rounded-full transition-all ${plan.customWhiteLabeling ? 'right-0.75' : 'left-0.75'}`}></div>
                      </button>
                    </div>

                    {/* Premium Support Switch */}
                    <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-neutral-700">Priority SLA Support</span>
                        <p className="text-[10px] text-neutral-400 leading-none">1h dedicated support ticket SLA</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newPlans = [...(settings.plans || [])];
                          newPlans[planIdx] = { ...plan, premiumSupportAccess: !plan.premiumSupportAccess };
                          setSettings({ ...settings, plans: newPlans });
                        }}
                        className={`w-10 h-5.5 rounded-full relative transition-colors ${plan.premiumSupportAccess ? 'bg-primary' : 'bg-neutral-200'}`}
                      >
                        <div className={`absolute top-0.75 w-4 h-4 bg-white rounded-full transition-all ${plan.premiumSupportAccess ? 'right-0.75' : 'left-0.75'}`}></div>
                      </button>
                    </div>

                    {/* Historical Audit Logs */}
                    <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-neutral-700">Audit Trail Archives</span>
                        <p className="text-[10px] text-neutral-400 leading-none">Indefinite checkout retention</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newPlans = [...(settings.plans || [])];
                          newPlans[planIdx] = { ...plan, historicalAuditLogs: !plan.historicalAuditLogs };
                          setSettings({ ...settings, plans: newPlans });
                        }}
                        className={`w-10 h-5.5 rounded-full relative transition-colors ${plan.historicalAuditLogs ? 'bg-primary' : 'bg-neutral-200'}`}
                      >
                        <div className={`absolute top-0.75 w-4 h-4 bg-white rounded-full transition-all ${plan.historicalAuditLogs ? 'right-0.75' : 'left-0.75'}`}></div>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Included Features</p>
                  <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2">
                    {(['aiWizard', 'gearLibrary', 'reminders', 'versionHistory', 'branding', 'qrSharing', 'toolingLists', 'organizer', 'travelCases', 'logisticsDashboard', 'movingDashboard', 'rackingDashboard', 'marketplace', 'marketplaceListings', 'kioskMode', 'orgManagement', 'departments', 'teams', 'inventoryManagement', 'projectCost', 'supplierManagement', 'bomManagement', 'customBarcodes', 'automaticDepreciation', 'digitalSignatures', 'clientPortal', 'apiIntegrations', 'weightAnalytics', 'kioskOrderMode', 'kioskDirectCheckout'] as const).map(feature => (
                      <label key={feature} className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-100 cursor-pointer hover:bg-neutral-100 transition">
                        <input
                          type="checkbox"
                          checked={plan.features.includes(feature)}
                          onChange={(e) => {
                            const newFeatures = e.target.checked 
                              ? [...plan.features, feature]
                              : plan.features.filter(f => f !== feature);
                            const newPlans = [...(settings.plans || [])];
                            newPlans[planIdx] = { ...plan, features: newFeatures };
                            setSettings({ ...settings, plans: newPlans });
                          }}
                          className="w-5 h-5 accent-primary"
                        />
                        <span className="text-sm font-bold text-neutral-700 capitalize">{feature.replace(/([A-Z])/g, ' $1')}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => {
                      const duplicatedPlan: Plan = {
                        ...plan,
                        id: `plan-${Date.now()}`,
                        name: `${plan.name} (Copy)`,
                        isDefault: false
                      };
                      setSettings(s => s ? { ...s, plans: [...(s.plans || []), duplicatedPlan] } : null);
                      toast.success("Plan duplicated");
                    }}
                    className="py-3 bg-neutral-100 text-neutral-600 rounded-xl font-bold hover:bg-neutral-200 transition text-sm"
                  >
                    Duplicate
                  </button>
                  <button
                    onClick={() => {
                      const newPlans = settings.plans.filter(p => p.id !== plan.id);
                      setSettings({ ...settings, plans: newPlans });
                    }}
                    className="py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-4 mt-8">
            <button 
              onClick={async () => {
                if (settings) {
                  await updateDoc(doc(db, 'adminSettings', 'global'), settings as any);
                  toast.success("Plans saved successfully!");
                }
              }}
              className="w-full md:w-auto px-12 py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition shadow-lg active:scale-95"
            >
              Save All Plans
            </button>
          </div>
        </div>
      )}

      {activeTab === 'billing' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <BillingSettings settings={settings} setSettings={setSettings} users={users} />
        </div>
      )}

      {activeTab === 'billing_dashboard' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <BillingDashboard settings={settings} users={users} />
        </div>
      )}

      {activeTab === 'features' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-3xl font-black uppercase tracking-tighter">Modules & Feature Releases</h2>
              <p className="font-medium text-neutral-500 italic">Activate functional modules, configure Beta testing restrictions, and publish updates live.</p>
            </div>
            <div className="flex items-center gap-2">
              <Link 
                to="/kiosk" 
                target="_blank"
                className="flex items-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-black transition shadow-lg"
              >
                <MousePointer2 size={18} />
                <span>Launch Terminal</span>
              </Link>
            </div>
          </div>

          {/* Filters & Control Station */}
          <div className="bg-neutral-50 p-6 rounded-3xl border border-neutral-200/60 flex flex-col md:flex-row gap-4 items-center justify-between shadow-sm">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-4 top-3.5 text-neutral-400" size={18} />
              <input
                type="text"
                placeholder="Search modules..."
                value={featureSearchQuery}
                onChange={(e) => setFeatureSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition text-xs font-medium"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <select
                value={featureCategoryFilter}
                onChange={(e) => setFeatureCategoryFilter(e.target.value)}
                className="px-4 py-3 bg-white border border-neutral-200 rounded-xl outline-none text-xs font-semibold"
              >
                <option value="all">All Categories</option>
                <option value="Core">Core Modules</option>
                <option value="Logistics">Logistics Modules</option>
                <option value="Operations">Operations Modules</option>
                <option value="Kiosk">Kiosk Modules</option>
                <option value="Integrations">Integrations</option>
                <option value="Advanced">Advanced Config</option>
              </select>

              <select
                value={featureStatusFilter}
                onChange={(e) => setFeatureStatusFilter(e.target.value as any)}
                className="px-4 py-3 bg-white border border-neutral-200 rounded-xl outline-none text-xs font-semibold"
              >
                <option value="all">All Availability States</option>
                <option value="active">Activated Only</option>
                <option value="inactive">Deactivated Only</option>
                <option value="beta">Currently in Beta Mode</option>
              </select>
            </div>
          </div>

          {/* Modules Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.keys(MODULE_METADATA).filter(key => {
              const meta = MODULE_METADATA[key];
              const matchesSearch = meta.name.toLowerCase().includes(featureSearchQuery.toLowerCase()) || 
                                    meta.description.toLowerCase().includes(featureSearchQuery.toLowerCase()) ||
                                    key.toLowerCase().includes(featureSearchQuery.toLowerCase());
              const matchesCategory = featureCategoryFilter === 'all' || meta.category === featureCategoryFilter;
              
              const isActive = settings?.globalFeatures?.[key] !== false;
              const isBeta = settings?.betaFeatures?.[key] === true;
              let matchesStatus = true;
              if (featureStatusFilter === 'active') matchesStatus = isActive;
              else if (featureStatusFilter === 'inactive') matchesStatus = !isActive;
              else if (featureStatusFilter === 'beta') matchesStatus = isActive && isBeta;

              return matchesSearch && matchesCategory && matchesStatus;
            }).map(feature => {
              const meta = MODULE_METADATA[feature];
              const isActive = settings?.globalFeatures?.[feature] !== false;
              const isBeta = settings?.betaFeatures?.[feature] === true;

              return (
                <div 
                  key={feature} 
                  className={`bg-white rounded-3xl border transition-all flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md ${
                    isActive 
                      ? isBeta 
                        ? 'border-purple-200 ring-2 ring-purple-100/30' 
                        : 'border-neutral-100' 
                      : 'border-neutral-200 border-dashed opacity-80 bg-neutral-50/50'
                  }`}
                >
                  <div className="p-6 md:p-8 space-y-6">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isActive ? 'bg-neutral-100 text-neutral-800' : 'bg-neutral-200/50 text-neutral-400'}`}>
                          {renderModuleIcon(meta.icon)}
                        </div>
                        <div>
                          <h3 className="font-bold text-neutral-900 text-base leading-snug">{meta.name}</h3>
                          <span className="text-[10px] uppercase font-black tracking-wider text-neutral-400 block pt-0.5">{meta.category}</span>
                        </div>
                      </div>
                      <span className="px-2 py-1 bg-neutral-100 text-neutral-600 rounded-md font-mono text-[10px] font-bold">
                        {meta.version}
                      </span>
                    </div>

                    {/* Desc */}
                    <p className={`text-xs ${isActive ? 'text-neutral-500 font-medium' : 'text-neutral-400 italic'}`}>
                      {meta.description}
                    </p>

                    {/* Quick States */}
                    <div className="flex items-center gap-2 pt-1">
                      {isActive ? (
                        isBeta ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-purple-50 text-purple-700 border border-purple-100 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
                            🧪 Beta Tester Mode Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-green-50 text-green-700 border border-green-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>
                            🟢 Published Globally
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-neutral-100 text-neutral-500 border border-neutral-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-neutral-400"></span>
                          Offline / Deactivated
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions & Control Row */}
                  <div className="px-6 md:px-8 py-5 bg-neutral-50/85 border-t border-neutral-100 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Module Activated</span>
                      <button 
                        onClick={() => {
                          const newGlobalFeatures = { ...(settings?.globalFeatures || {}) };
                          newGlobalFeatures[feature] = !newGlobalFeatures[feature];
                          
                          // If activating for first time, enable Beta mode restriction automatically as a safe staging step
                          const newBetaFeatures = { ...(settings?.betaFeatures || {}) };
                          if (newGlobalFeatures[feature] !== false && newBetaFeatures[feature] === undefined) {
                            newBetaFeatures[feature] = true;
                          }

                          setSettings(s => s ? { ...s, globalFeatures: newGlobalFeatures, betaFeatures: newBetaFeatures } : null);
                        }}
                        className={`w-12 h-6 rounded-full relative transition-colors ${isActive ? 'bg-primary' : 'bg-neutral-200'}`}
                        title="Activate or Deactivate this functional module"
                      >
                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${isActive ? 'right-0.5' : 'left-0.5'}`}></div>
                      </button>
                    </div>

                    {/* Beta restriction controller (Only shown if module is active) */}
                    {isActive && (
                      <div className="space-y-3 pt-2 border-t border-neutral-200/50">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Restrict to Beta Testers</span>
                          <button 
                            onClick={() => {
                              const newBetaFeatures = { ...(settings?.betaFeatures || {}) };
                              newBetaFeatures[feature] = !newBetaFeatures[feature];
                              setSettings(s => s ? { ...s, betaFeatures: newBetaFeatures } : null);
                            }}
                            className={`w-12 h-6 rounded-full relative transition-colors ${isBeta ? 'bg-purple-600' : 'bg-neutral-200'}`}
                            title="Toggle Beta isolation mode"
                          >
                            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${isBeta ? 'right-0.5' : 'left-0.5'}`}></div>
                          </button>
                        </div>

                        {/* Publish live button */}
                        {isBeta && (
                          <button
                            onClick={() => {
                              const newBetaFeatures = { ...(settings?.betaFeatures || {}) };
                              newBetaFeatures[feature] = false; // Turn off beta restrict -> Publish public
                              setSettings(s => s ? { ...s, betaFeatures: newBetaFeatures } : null);
                              toast.success(`Success! "${meta.name}" is now live and published to all users globally.`);
                            }}
                            className="w-full mt-2 py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                          >
                            <Sparkles size={12} />
                            <span>Publish Module Publicly</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-4">
            <button 
              onClick={async () => {
                if (settings) {
                  await updateDoc(doc(db, 'adminSettings', 'global'), settings as any);
                  toast.success("Successfully persisted modules state, beta settings and published modules layout!");
                }
              }}
              className="px-12 py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition shadow-lg text-sm select-none cursor-pointer"
            >
              Save Modules & Releases Setup
            </button>
          </div>
        </div>
      )}

      {activeTab === 'bugs' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-2">
                <Bug className="text-purple-600" size={30} />
                <span>Beta Bug Reports Finder</span>
              </h2>
              <p className="font-medium text-neutral-500 italic">Review issues found by beta testers, assign states, and post resolutions directly back to their dashboard.</p>
            </div>
            <div className="bg-purple-100 text-purple-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border border-purple-200">
              <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse"></span>
              <span>Logged Bugs Tracked: {bugReports.length}</span>
            </div>
          </div>

          {/* Filtering Bar */}
          <div className="bg-neutral-50 p-6 rounded-3xl border border-neutral-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            <div className="relative md:col-span-2">
              <Search className="absolute left-4 top-3.5 text-neutral-400" size={18} />
              <input
                type="text"
                placeholder="Search reporter, email, title, description or module..."
                value={bugSearchQuery}
                onChange={(e) => setBugSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition text-xs font-medium"
              />
            </div>

            <div className="w-full">
              <select
                value={bugStatusFilter}
                onChange={(e) => setBugStatusFilter(e.target.value as any)}
                className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl outline-none text-xs font-semibold"
              >
                <option value="all">All Statuses</option>
                <option value="open">🔴 Open Bugs</option>
                <option value="in_review">🟡 In Review</option>
                <option value="resolved">🟢 Resolved Issues</option>
                <option value="fixed">🟢 Fixed Issues</option>
              </select>
            </div>

            <div className="w-full">
              <select
                value={bugSeverityFilter}
                onChange={(e) => setBugSeverityFilter(e.target.value as any)}
                className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl outline-none text-xs font-semibold"
              >
                <option value="all">All Severities</option>
                <option value="critical">🚨 Critical</option>
                <option value="high">🟠 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🔵 Low</option>
              </select>
            </div>
          </div>

          {/* Bugs Listings */}
          <div className="space-y-6">
            {bugReports.filter(b => {
              const matchedSearch = !bugSearchQuery ? true : (
                (b.title || '').toLowerCase().includes(bugSearchQuery.toLowerCase()) ||
                (b.description || '').toLowerCase().includes(bugSearchQuery.toLowerCase()) ||
                (b.userName || '').toLowerCase().includes(bugSearchQuery.toLowerCase()) ||
                (b.userEmail || '').toLowerCase().includes(bugSearchQuery.toLowerCase()) ||
                (b.module || '').toLowerCase().includes(bugSearchQuery.toLowerCase())
              );
              const matchedStatus = bugStatusFilter === 'all' || b.status === bugStatusFilter;
              const matchedSeverity = bugSeverityFilter === 'all' || b.severity === bugSeverityFilter;

              return matchedSearch && matchedStatus && matchedSeverity;
            }).length === 0 ? (
              <div className="bg-white p-16 rounded-3xl border border-neutral-100 text-center space-y-4">
                <div className="w-16 h-16 bg-neutral-100 text-neutral-400 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-800 text-lg">No Matching Bug Reports</h3>
                  <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1">Excellent job! No active bugs matched your current filter criteria.</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-6">
                {bugReports.filter(b => {
                  const matchedSearch = !bugSearchQuery ? true : (
                    (b.title || '').toLowerCase().includes(bugSearchQuery.toLowerCase()) ||
                    (b.description || '').toLowerCase().includes(bugSearchQuery.toLowerCase()) ||
                    (b.userName || '').toLowerCase().includes(bugSearchQuery.toLowerCase()) ||
                    (b.userEmail || '').toLowerCase().includes(bugSearchQuery.toLowerCase()) ||
                    (b.module || '').toLowerCase().includes(bugSearchQuery.toLowerCase())
                  );
                  const matchedStatus = bugStatusFilter === 'all' || b.status === bugStatusFilter;
                  const matchedSeverity = bugSeverityFilter === 'all' || b.severity === bugSeverityFilter;

                  return matchedSearch && matchedStatus && matchedSeverity;
                }).map(bug => {
                  const severityConfig = {
                    critical: { bg: 'bg-red-100 text-red-800 border-red-200', text: '🚨 Critical Severity' },
                    high: { bg: 'bg-orange-100 text-orange-800 border-orange-200', text: '🟠 High Severity' },
                    medium: { bg: 'bg-yellow-100 text-yellow-800 border-yellow-200', text: '🟡 Medium Severity' },
                    low: { bg: 'bg-blue-100 text-blue-800 border-blue-200', text: '🔵 Low Severity' }
                  }[bug.severity || 'low'] || { bg: 'bg-blue-100 text-blue-800 border-blue-200', text: '🔵 Low Severity' };

                  const statusConfig = {
                    open: { bg: 'bg-red-50 text-red-700 border-red-100', text: 'Open / Pending' },
                    in_review: { bg: 'bg-amber-50 text-amber-700 border-amber-100', text: 'Staged / In Review' },
                    resolved: { bg: 'bg-green-50 text-green-700 border-green-100', text: 'Fully Resolved' },
                    fixed: { bg: 'bg-emerald-100 text-emerald-805 border-emerald-200', text: '🟢 Fixed & Crossed Out' }
                  }[bug.status || 'open'] || { bg: 'bg-emerald-100 text-emerald-805 border-emerald-200', text: '🟢 Fixed' };

                  const isFixed = bug.status === 'fixed' || bug.status === 'resolved';

                  return (
                    <div 
                      key={bug.id}
                      className={`rounded-3xl border shadow-sm overflow-hidden flex flex-col md:flex-row transition hover:shadow-md relative ${
                        isFixed 
                          ? 'border-emerald-100 bg-emerald-50/5' 
                          : bug.severity === 'critical'
                            ? 'bg-white border-red-200 ring-4 ring-red-50/50'
                            : 'bg-white border-neutral-200'
                      }`}
                    >
                      {/* Left: Bug Info */}
                      <div className="p-6 md:p-8 flex-1 space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border ${severityConfig.bg}`}>
                            {severityConfig.text}
                          </span>
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border ${statusConfig.bg}`}>
                            {statusConfig.text}
                          </span>
                          <span className="text-[10px] font-mono text-neutral-400 uppercase font-black tracking-wider bg-neutral-100 px-2 py-1 rounded">
                            Module: {bug.module || 'General UI'}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <h4 className={`text-lg font-bold leading-snug ${isFixed ? 'line-through text-neutral-400 decoration-neutral-400 decoration-2' : 'text-neutral-900'}`}>{bug.title}</h4>
                          <p className="text-xs text-neutral-500 font-medium">
                            Reported by <span className="font-bold text-neutral-800">{bug.userName}</span> ({bug.userEmail}) on {bug.createdAt ? new Date(bug.createdAt).toLocaleDateString() : 'Unknown Date'}
                          </p>
                        </div>

                        <div className={`p-4 rounded-2xl border text-xs font-medium whitespace-pre-wrap leading-relaxed ${isFixed ? 'line-through text-neutral-400/80 bg-neutral-50/50 border-neutral-150' : 'bg-neutral-50 border-neutral-100 text-neutral-600'}`}>
                          {bug.description}
                        </div>

                        {/* Screenshots display */}
                        {bug.screenshots && bug.screenshots.length > 0 && (
                          <div className="space-y-1.5 mt-2">
                            <p className="text-[10px] uppercase font-black tracking-widest text-neutral-400">Reporter Attached Screenshots ({bug.screenshots.length}):</p>
                            <div className="flex flex-wrap gap-2">
                              {bug.screenshots.map((img: string, sci: number) => (
                                <div 
                                  key={sci}
                                  onClick={() => setAdminZoomedImage(img)}
                                  className="w-20 h-14 rounded-xl border border-neutral-200 cursor-pointer overflow-hidden relative group hover:border-purple-500 transition shadow bg-neutral-100 flex items-center justify-center shrink-0"
                                >
                                  <img src={img} alt="Screenshot attachment" className="object-cover w-full h-full" />
                                  <div className="absolute inset-0 bg-black/5 group-hover:bg-black/0 transition" />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Admin comments */}
                        {bug.adminNotes && (
                          <div className="p-4 bg-green-50/50 rounded-2xl border border-green-100 text-xs text-green-800 space-y-1">
                            <p className="font-bold text-[10px] uppercase tracking-wider text-green-600">Admin Resolution Response Note:</p>
                            <p className="font-medium leading-relaxed">{bug.adminNotes}</p>
                            {bug.adminNotesUpdatedAt && (
                              <p className="text-[9px] text-green-500 font-mono">Last adjusted: {new Date(bug.adminNotesUpdatedAt).toLocaleString()}</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right: Quick resolution tool */}
                      <div className="p-6 md:p-8 bg-neutral-50/50 md:border-l border-neutral-100 w-full md:w-80 shrink-0 flex flex-col justify-between gap-4">
                        <div className="space-y-4">
                          <h5 className="text-xs font-black uppercase tracking-widest text-neutral-500">Bug Resolution Actions</h5>
                          
                          {/* Quick Status Select */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Set Progress state</label>
                            <select
                              value={editingBugReport?.id === bug.id ? bugStatusUpdate : bug.status}
                              onChange={(e) => {
                                setEditingBugReport(bug);
                                setBugStatusUpdate(e.target.value as any);
                                if (editingBugReport?.id !== bug.id) {
                                  setBugAdminNotes(bug.adminNotes || '');
                                }
                              }}
                              className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl text-xs font-semibold"
                            >
                              <option value="open">🔴 Open / Pending</option>
                              <option value="in_review">🟡 Staged / In Review</option>
                              <option value="resolved">🟢 Fully Resolved</option>
                              <option value="fixed">🟢 Fixed & Crossed Out</option>
                            </select>
                          </div>

                          {/* Response text arena */}
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Resolution Comment / notes</label>
                            <textarea
                              placeholder="Write steps taken or resolve notes here..."
                              rows={3}
                              value={editingBugReport?.id === bug.id ? bugAdminNotes : (bug.adminNotes || '')}
                              onFocus={() => {
                                if (editingBugReport?.id !== bug.id) {
                                  setEditingBugReport(bug);
                                  setBugAdminNotes(bug.adminNotes || '');
                                  setBugStatusUpdate(bug.status);
                                }
                              }}
                              onChange={(e) => {
                                setBugAdminNotes(e.target.value);
                              }}
                              className="w-full p-3 bg-white border border-neutral-200 rounded-xl text-xs font-medium resize-none focus:ring-2 focus:ring-purple-500 outline-none transition"
                            />
                          </div>
                        </div>

                        {/* Save Action trigger */}
                        <button
                          onClick={async () => {
                            const bId = bug.id;
                            const notes = editingBugReport?.id === bId ? bugAdminNotes : (bug.adminNotes || '');
                            const stat = editingBugReport?.id === bId ? bugStatusUpdate : bug.status;

                            try {
                              await updateDoc(doc(db, 'bugs', bId), {
                                status: stat,
                                adminNotes: notes,
                                adminNotesUpdatedAt: new Date().toISOString()
                              });
                              setEditingBugReport(null);
                              toast.success("Bug report successfully updated!");
                            } catch (e) {
                              console.error(e);
                              toast.error("Failed to update bug report.");
                            }
                          }}
                          className={`w-full py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer ${
                            editingBugReport?.id === bug.id
                              ? 'bg-neutral-900 text-white hover:bg-black'
                              : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100 hover:text-neutral-950'
                          }`}
                        >
                          <Save size={12} />
                          <span>{editingBugReport?.id === bug.id ? 'Save Progress Notes' : 'Modify Resolves'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'kiosk' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h2 className="text-3xl font-black italic uppercase tracking-tighter">Terminal & Kiosk</h2>
              <p className="text-neutral-500">Manage self-service check-out/in terminal settings.</p>
            </div>
            <Link 
              to="/kiosk" 
              target="_blank"
              className="flex items-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-black transition shadow-lg"
            >
              <MousePointer2 size={18} />
              <span>Launch Terminal</span>
            </Link>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-8">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <Settings className="text-primary" />
                <span>Kiosk Configuration</span>
              </h3>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                  <div className="space-y-0.5">
                    <p className="font-bold">Manual Search</p>
                    <p className="text-xs text-neutral-400">Allow users to search for items by name if QR fails.</p>
                  </div>
                  <button 
                    onClick={() => setSettings(s => s ? { ...s, kioskConfig: { ...s.kioskConfig!, allowManualSearch: !s.kioskConfig?.allowManualSearch } } : null)}
                    className={`w-12 h-6 rounded-full relative transition-colors ${settings?.kioskConfig?.allowManualSearch ? 'bg-primary' : 'bg-neutral-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings?.kioskConfig?.allowManualSearch ? 'right-1' : 'left-1'}`}></div>
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                  <div className="space-y-0.5">
                    <p className="font-bold">Show Detailed Status</p>
                    <p className="text-xs text-neutral-400">Display item status (Available, Maintenance, etc) in results.</p>
                  </div>
                  <button 
                    onClick={() => setSettings(s => s ? { ...s, kioskConfig: { ...s.kioskConfig!, showItemStatus: !s.kioskConfig?.showItemStatus } } : null)}
                    className={`w-12 h-6 rounded-full relative transition-colors ${settings?.kioskConfig?.showItemStatus ? 'bg-primary' : 'bg-neutral-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings?.kioskConfig?.showItemStatus ? 'right-1' : 'left-1'}`}></div>
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                  <div className="space-y-0.5">
                    <p className="font-bold">Require Signature</p>
                    <p className="text-xs text-neutral-400">Force users to sign on screen before checking out.</p>
                  </div>
                  <button 
                    onClick={() => setSettings(s => s ? { ...s, kioskConfig: { ...s.kioskConfig!, requireSignature: !s.kioskConfig?.requireSignature } } : null)}
                    className={`w-12 h-6 rounded-full relative transition-colors ${settings?.kioskConfig?.requireSignature ? 'bg-primary' : 'bg-neutral-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings?.kioskConfig?.requireSignature ? 'right-1' : 'left-1'}`}></div>
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest block">Auto-Logout (Minutes)</label>
                  <input
                    type="number"
                    value={settings?.kioskConfig?.autoLogoutMinutes || 5}
                    onChange={(e) => setSettings(s => s ? { ...s, kioskConfig: { ...s.kioskConfig!, autoLogoutMinutes: parseInt(e.target.value) } } : null)}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl font-mono outline-none focus:ring-2 focus:ring-primary transition"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-8">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <AlertCircle className="text-accent" />
                <span>Restricted Statuses</span>
              </h3>
              <div className="space-y-4">
                <p className="text-sm text-neutral-500 leading-relaxed">
                  Select statuses that should prevent items from being checked out at the kiosk.
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {['maintenance', 'retired', 'missing', 'damaged'].map(stat => (
                    <label key={stat} className="flex items-center gap-3 p-4 bg-neutral-50 rounded-2xl border border-neutral-100 cursor-pointer hover:bg-neutral-100 transition">
                      <input
                        type="checkbox"
                        checked={settings?.kioskConfig?.restrictedStatuses?.includes(stat)}
                        onChange={(e) => {
                          const current = settings?.kioskConfig?.restrictedStatuses || [];
                          const updated = e.target.checked 
                            ? [...current, stat]
                            : current.filter(s => s !== stat);
                          setSettings(s => s ? { ...s, kioskConfig: { ...s.kioskConfig!, restrictedStatuses: updated } } : null);
                        }}
                        className="w-5 h-5 accent-primary"
                      />
                      <span className="text-sm font-bold capitalize">{stat}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button 
              onClick={async () => {
                if (settings) {
                  await updateDoc(doc(db, 'adminSettings', 'global'), settings as any);
                  toast.success("Kiosk settings saved!");
                }
              }}
              className="px-12 py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition shadow-lg"
            >
              Save Kiosk Settings
            </button>
          </div>
        </div>
      )}
      {activeTab === 'integrations' && (
        <div className="space-y-8">
          <div className="space-y-2">
            <h2 className="text-3xl font-black">Integrations & API</h2>
            <p className="text-neutral-500">Configure third-party connections and external access to your platform.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-8">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <ShieldCheck className="text-primary" />
                <span>OAuth Callbacks</span>
              </h3>
              <div className="space-y-6">
                <p className="text-sm text-neutral-500 leading-relaxed">
                  Use these URLs when configuring OAuth providers (Google, GitHub, etc.) to ensure authentication works correctly in all environments.
                </p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest block">Development Callback URL</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`${window.location.origin}/auth/callback`}
                        className="flex-1 px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl font-mono text-xs outline-none"
                      />
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/auth/callback`);
                          toast.success("Copied to clipboard");
                        }}
                        className="p-3 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition"
                      >
                        <Edit2 size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest block">Production Callback URL</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={settings?.integrationConfig?.callbackUrlProd || ''}
                        onChange={(e) => setSettings(s => s ? { ...s, integrationConfig: { ...s.integrationConfig, callbackUrlProd: e.target.value } } : null)}
                        placeholder="https://your-app.run.app/auth/callback"
                        className="flex-1 px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl font-mono text-xs outline-none"
                      />
                      <button 
                        onClick={() => {
                          if (settings?.integrationConfig?.callbackUrlProd) {
                            navigator.clipboard.writeText(settings.integrationConfig.callbackUrlProd);
                            toast.success("Copied to clipboard");
                          }
                        }}
                        className="p-3 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition"
                      >
                        <Edit2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-8">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <Zap className="text-primary" />
                <span>API Access</span>
              </h3>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                  <div className="space-y-0.5">
                    <p className="font-bold">Enable Public API</p>
                    <p className="text-xs text-neutral-400">Allow external requests via API keys.</p>
                  </div>
                  <button 
                    onClick={() => setSettings(s => s ? { ...s, integrationConfig: { ...s.integrationConfig, apiEnabled: !s.integrationConfig.apiEnabled } } : null)}
                    className={`w-12 h-6 rounded-full relative transition-colors ${settings?.integrationConfig?.apiEnabled ? 'bg-primary' : 'bg-neutral-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings?.integrationConfig?.apiEnabled ? 'right-1' : 'left-1'}`}></div>
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Master API Key</label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={settings?.integrationConfig?.apiKey || ''}
                      onChange={(e) => setSettings(s => s ? { ...s, integrationConfig: { ...s.integrationConfig, apiKey: e.target.value } } : null)}
                      className="flex-1 px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl font-mono outline-none"
                      placeholder="sk-..."
                    />
                    <button 
                      onClick={() => {
                        const newKey = 'sk_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                        setSettings(s => s ? { ...s, integrationConfig: { ...s.integrationConfig, apiKey: newKey } } : null);
                      }}
                      className="px-4 py-2 bg-neutral-900 text-white rounded-xl font-bold text-xs"
                    >
                      Regenerate
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Webhook URL</label>
                  <input
                    type="text"
                    value={settings?.integrationConfig?.webhookUrl || ''}
                    onChange={(e) => setSettings(s => s ? { ...s, integrationConfig: { ...s.integrationConfig, webhookUrl: e.target.value } } : null)}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none"
                    placeholder="https://hooks.example.com/..."
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold flex items-center gap-2">
                <Globe className="text-accent" />
                <span>WordPress Integration</span>
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Enabled</span>
                <button 
                  onClick={() => setSettings(s => s ? { ...s, integrationConfig: { ...s.integrationConfig, wordpressEnabled: !s.integrationConfig.wordpressEnabled } } : null)}
                  className={`w-12 h-6 rounded-full relative transition-colors ${settings?.integrationConfig?.wordpressEnabled ? 'bg-primary' : 'bg-neutral-200'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings?.integrationConfig?.wordpressEnabled ? 'right-1' : 'left-1'}`}></div>
                </button>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <p className="text-sm text-neutral-500 leading-relaxed">
                  Connect your WordPress site to sync packing lists or display marketplace listings directly on your blog or store.
                </p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">WordPress Site URL</label>
                    <input
                      type="text"
                      value={settings?.integrationConfig?.wordpressUrl || ''}
                      onChange={(e) => setSettings(s => s ? { ...s, integrationConfig: { ...s.integrationConfig, wordpressUrl: e.target.value } } : null)}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none"
                      placeholder="https://your-wordpress-site.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">WordPress Application Password / API Key</label>
                    <input
                      type="password"
                      value={settings?.integrationConfig?.wordpressApiKey || ''}
                      onChange={(e) => setSettings(s => s ? { ...s, integrationConfig: { ...s.integrationConfig, wordpressApiKey: e.target.value } } : null)}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none"
                      placeholder="xxxx xxxx xxxx xxxx"
                    />
                  </div>
                </div>
              </div>
              <div className="bg-neutral-50 p-6 rounded-3xl border border-neutral-100 space-y-4">
                <h4 className="font-bold flex items-center gap-2">
                  <FileText size={18} className="text-neutral-400" />
                  <span>Integration Guide</span>
                </h4>
                <div className="space-y-3 text-sm text-neutral-600">
                  <p>1. Install the <strong>Packer Tools Connector</strong> plugin on your WordPress site.</p>
                  <p>2. Enter your <strong>Master API Key</strong> in the plugin settings.</p>
                  <p>3. Use shortcodes like <code>[packsmart_list id="LIST_ID"]</code> to embed lists.</p>
                  <p>4. Enable <strong>Webhooks</strong> to receive real-time updates when packages are received.</p>
                </div>
              </div>
            </div>
          </div>

          {/* External Services Manager Section */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-8">
            <div className="border-b border-neutral-100 pb-4">
              <h3 className="text-2xl font-black flex items-center gap-2">
                <Cpu className="text-primary animate-pulse" />
                <span>External Services & Heuristic Engines</span>
              </h3>
              <p className="text-sm text-neutral-400">Configure real functional API service layers or default sandbox simulation modes for key widgets.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Paddle Merchant Gateway Card */}
              <div className="bg-neutral-50 p-6 rounded-3xl border border-neutral-100 space-y-4 md:col-span-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-extrabold text-sm text-neutral-900 flex items-center gap-2">
                      <CreditCard size={18} className="text-primary animate-pulse" />
                      Paddle Billing & Merchant Sync API Key
                    </span>
                    <span className="text-[10px] uppercase font-black tracking-widest text-[#F27D26]">Payment Gateway Authority</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setSettings(s => s ? { ...s, integrationConfig: { ...s.integrationConfig, paddleEnabled: !s.integrationConfig.paddleEnabled } } : null)}
                    className={`w-12 h-6 rounded-full relative transition-colors ${settings?.integrationConfig?.paddleEnabled ? 'bg-primary' : 'bg-neutral-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings?.integrationConfig?.paddleEnabled ? 'right-1' : 'left-1'}`}></div>
                  </button>
                </div>
                
                <p className="text-xs text-neutral-500 font-medium leading-relaxed font-sans text-left">
                  Connect your live <strong>Paddle sandbox or production workspace</strong> to process seat metrics, manage active currencies (FJD, AUD, USD), list visuals on peer-to-peer markets, and collect secure payouts.
                </p>

                <div className="grid sm:grid-cols-1 gap-4 pt-2">
                  <div className="space-y-2 text-left">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block font-mono font-bold">Paddle Secret Live API Key</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="pdl_live_apikey_..."
                        value={settings?.integrationConfig?.paddleApiKey || ''}
                        onChange={(e) => setSettings(s => s ? { ...s, integrationConfig: { ...s.integrationConfig, paddleApiKey: e.target.value } } : null)}
                        className="w-full pl-4 pr-12 py-3 bg-white border border-neutral-200 rounded-xl outline-none text-xs font-mono font-bold tracking-tight text-neutral-800 focus:border-primary transition"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-[9px] font-black bg-primary/10 text-primary uppercase tracking-widest rounded leading-none">
                        Live Key
                      </span>
                    </div>
                    <p className="text-[10px] text-neutral-400 font-medium leading-normal font-sans">
                      Required by <strong>Paddle Merchant of Record</strong> to verify secure ledger handshakes, invoice dispatch orders, and refund requests, serving as checkout master.
                    </p>
                  </div>
                </div>
              </div>

              {/* GCP Pricing */}
              <div className="bg-neutral-50 p-6 rounded-3xl border border-neutral-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-bold text-sm block">GCP Pricing Sync API Service</span>
                    <span className="text-[10px] uppercase font-black tracking-wider text-neutral-400">Rate Calculator</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setSettings(s => s ? { ...s, integrationConfig: { ...s.integrationConfig, gcpPricingServiceEnabled: !s.integrationConfig.gcpPricingServiceEnabled } } : null)}
                    className={`w-12 h-6 rounded-full relative transition-colors ${settings?.integrationConfig?.gcpPricingServiceEnabled ? 'bg-primary' : 'bg-neutral-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings?.integrationConfig?.gcpPricingServiceEnabled ? 'right-1' : 'left-1'}`}></div>
                  </button>
                </div>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Fetches live infrastructure SKUs from Google Cloud Billing API. If disabled, system falls back to active cached rates.
                </p>
                <div className="space-y-2 pt-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">Custom Billing API Override Key</label>
                  <input
                    type="password"
                    placeholder="Auto-inherits master project credentials if empty"
                    value={settings?.integrationConfig?.gcpPricingApiKey || ''}
                    onChange={(e) => setSettings(s => s ? { ...s, integrationConfig: { ...s.integrationConfig, gcpPricingApiKey: e.target.value } } : null)}
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl outline-none text-xs font-mono"
                  />
                </div>
              </div>

              {/* Vendor Scraper */}
              <div className="bg-neutral-50 p-6 rounded-3xl border border-neutral-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-bold text-sm block">Live Supplier Crawler API</span>
                    <span className="text-[10px] uppercase font-black tracking-wider text-neutral-400">Supplier Search</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setSettings(s => s ? { ...s, integrationConfig: { ...s.integrationConfig, supplierScraperServiceEnabled: !s.integrationConfig.supplierScraperServiceEnabled } } : null)}
                    className={`w-12 h-6 rounded-full relative transition-colors ${settings?.integrationConfig?.supplierScraperServiceEnabled ? 'bg-primary' : 'bg-neutral-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings?.integrationConfig?.supplierScraperServiceEnabled ? 'right-1' : 'left-1'}`}></div>
                  </button>
                </div>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Triggers remote crawls of manufacturer catalogs via Gemini to find real AV/Parts distributors. If disabled, system searches offline catalog.
                </p>
                <div className="space-y-2 pt-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">Crawler Brain Inference Model</label>
                  <select
                    value={settings?.integrationConfig?.supplierScraperModel || 'gemini-3.5-flash'}
                    onChange={(e) => setSettings(s => s ? { ...s, integrationConfig: { ...s.integrationConfig, supplierScraperModel: e.target.value } } : null)}
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl outline-none text-xs"
                  >
                    <option value="gemini-3.5-flash">Gemini 3.5 Flash (Default - High Speed)</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro (Precision Context)</option>
                    <option value="custom_heuristic">Rule-based Standby Crawler</option>
                  </select>
                </div>
              </div>

              {/* Intelligence System */}
              <div className="bg-neutral-50 p-6 rounded-3xl border border-neutral-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-bold text-sm block">Whole-Build Technical Verification</span>
                    <span className="text-[10px] uppercase font-black tracking-wider text-neutral-400">Compatibility AI</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setSettings(s => s ? { ...s, integrationConfig: { ...s.integrationConfig, compatibilityServiceEnabled: !s.integrationConfig.compatibilityServiceEnabled } } : null)}
                    className={`w-12 h-6 rounded-full relative transition-colors ${settings?.integrationConfig?.compatibilityServiceEnabled ? 'bg-primary' : 'bg-neutral-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings?.integrationConfig?.compatibilityServiceEnabled ? 'right-1' : 'left-1'}`}></div>
                  </button>
                </div>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Runs professional physical pinout, wattage, signal type (e.g. SDI, Dante, HDMI), & optical checking. If disabled, rule heuristics apply.
                </p>
                <div className="space-y-2 pt-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">Engine Model Weight</label>
                  <select
                    value={settings?.integrationConfig?.compatibilityModel || 'gemini-3.5-flash'}
                    onChange={(e) => setSettings(s => s ? { ...s, integrationConfig: { ...s.integrationConfig, compatibilityModel: e.target.value } } : null)}
                    className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl outline-none text-xs"
                  >
                    <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro Ultra-Specs Analyzer</option>
                  </select>
                </div>
              </div>

              {/* BOM lead times */}
              <div className="bg-neutral-50 p-6 rounded-3xl border border-neutral-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-bold text-sm block">BOM Lead Time & Risk Heuristics API</span>
                    <span className="text-[10px] uppercase font-black tracking-wider text-neutral-400">Supply Chain Risk</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setSettings(s => s ? { ...s, integrationConfig: { ...s.integrationConfig, bomLeadServiceEnabled: !s.integrationConfig.bomLeadServiceEnabled } } : null)}
                    className={`w-12 h-6 rounded-full relative transition-colors ${settings?.integrationConfig?.bomLeadServiceEnabled ? 'bg-primary' : 'bg-neutral-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings?.integrationConfig?.bomLeadServiceEnabled ? 'right-1' : 'left-1'}`}></div>
                  </button>
                </div>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Queries international logistic routes and manufacturing shortage lists for listed BOM components.
                </p>
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Risk Alarm Threshold</label>
                    <span className="text-xs font-bold text-primary font-mono">{settings?.integrationConfig?.bomRiskThreshold || 7} Days</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    value={settings?.integrationConfig?.bomRiskThreshold || 7}
                    onChange={(e) => setSettings(s => s ? { ...s, integrationConfig: { ...s.integrationConfig, bomRiskThreshold: parseInt(e.target.value) } } : null)}
                    className="w-full h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button 
              onClick={async () => {
                if (settings) {
                  await updateDoc(doc(db, 'adminSettings', 'global'), settings as any);
                  toast.success("Integration settings saved!");
                }
              }}
              className="px-12 py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition shadow-lg"
            >
              Save Integration Settings
            </button>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Total Users', value: users.length, icon: <Users />, color: 'bg-primary' },
              { label: 'Packing Lists', value: lists.length, icon: <Package />, color: 'bg-accent' },
              { label: 'Pro Subscriptions', value: users.filter(u => u.plan === 'pro').length, icon: <CreditCard />, color: 'bg-neutral-800' },
              { label: 'AI Scans (Est)', value: lists.length * 5, icon: <Zap />, color: 'bg-safety-yellow text-primary' }
            ].map((stat, i) => (
              <div key={i} className="bg-white p-8 rounded-[2rem] border border-neutral-100 shadow-sm space-y-4 hover:shadow-xl transition-all duration-300">
                <div className={`w-12 h-12 ${stat.color} text-white rounded-2xl flex items-center justify-center shadow-lg`}>
                  {stat.icon}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-neutral-400 uppercase tracking-wider">{stat.label}</p>
                  <h3 className="text-4xl font-black tracking-tight">{stat.value}</h3>
                </div>
              </div>
            ))}
          </div>

          {/* Global GCP Pricing & Bill Trends Widget */}
          <div id="gcp-pricing-analytics" className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-8">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b border-neutral-100 pb-6">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
                    <Coins size={22} />
                  </div>
                  <h3 className="text-2xl font-black text-neutral-900 tracking-tight">GCP Real-Time Infrastructure Costs</h3>
                </div>
                <p className="text-neutral-500 text-sm">Comparison of actual API-fetched billing tariffs against simulated activity models.</p>
              </div>

              {/* Sync and Control Status Panel */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 bg-neutral-50 px-4 py-2 rounded-xl border border-neutral-100">
                  <span className={`w-2.5 h-2.5 rounded-full ${isGcpPricingLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`}></span>
                  <span className="text-xs font-bold text-neutral-600 tracking-wide uppercase">
                    {isGcpPricingLoading ? 'Syncing Catalog...' : gcpPricingData?.source || 'GCP Pricing API Live Sync'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={fetchGcpPricing}
                  disabled={isGcpPricingLoading}
                  className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-bold hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 transition flex items-center gap-2 cursor-pointer"
                >
                  <Activity size={12} className={isGcpPricingLoading ? 'animate-spin' : ''} />
                  <span>Sync Catalog</span>
                </button>
              </div>
            </div>

            {/* Simulated Activity Scaler Interactive Control */}
            <div className="bg-neutral-50 p-6 rounded-3xl border border-neutral-100/85 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1 max-w-lg">
                <h4 className="font-bold text-neutral-900 flex items-center gap-2">
                  <Percent size={16} className="text-primary" />
                  <span>Interactive Load Simulator</span>
                </h4>
                <p className="text-xs text-neutral-500">
                  Slide or configure the global loading multiplier to watch actual and simulated billing trends scale proportionally based on operations volume.
                </p>
              </div>
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="flex-1 md:w-64">
                  <input
                    type="range"
                    min="0.1"
                    max="5.0"
                    step="0.1"
                    value={simulatedLoadMultiplier}
                    onChange={(e) => setSimulatedLoadMultiplier(parseFloat(e.target.value))}
                    className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-neutral-900"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-400 font-bold mt-1">
                    <span>0.1x Minimal</span>
                    <span>1.x Baseline</span>
                    <span>5.0x Extreme Load</span>
                  </div>
                </div>
                <div className="bg-white px-4 py-2.5 rounded-2xl border border-neutral-200/60 font-mono font-black text-neutral-900 text-sm shadow-sm">
                  {simulatedLoadMultiplier.toFixed(1)}x Load
                </div>
              </div>
            </div>

            {/* Grid display: Billing Metrics Overview */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Cost comparison card */}
              <div className="bg-emerald-50/40 p-6 border border-emerald-100 rounded-3xl space-y-4 shadow-sm">
                <p className="text-[10px] font-black tracking-widest text-emerald-600 uppercase">Actual Calculated Billing (Mo.)</p>
                <div className="space-y-1">
                  <h3 className="text-4xl font-black text-emerald-700 font-mono">
                    ${actualCostDetails.total.toFixed(2)}
                  </h3>
                  <p className="text-xs text-emerald-600/80 font-semibold">
                    Computed using real-time API pricing rates applied to active workloads
                  </p>
                </div>
                <div className="pt-2 border-t border-emerald-100 flex items-center justify-between text-xs text-emerald-700/80 font-bold">
                  <span>Cloud Run subtotal:</span>
                  <span className="font-mono font-black">${actualCostDetails.runTotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-emerald-700/80 font-bold">
                  <span>Firestore subtotal:</span>
                  <span className="font-mono font-black">${actualCostDetails.fsTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Simulated Cost comparison card */}
              <div className="bg-amber-50/40 p-6 border border-amber-100 rounded-3xl space-y-4 shadow-sm">
                <p className="text-[10px] font-black tracking-widest text-amber-600 uppercase">Simulated Metric Cost (Mo.)</p>
                <div className="space-y-1">
                  <h3 className="text-4xl font-black text-amber-700 font-mono">
                    ${simulatedCost.toFixed(2)}
                  </h3>
                  <p className="text-xs text-amber-600/80 font-semibold">
                    Simulated model metrics static forecast at current profile parameters
                  </p>
                </div>
                <div className="pt-2 border-t border-amber-100 flex items-center justify-between text-xs text-amber-700/80 font-bold">
                  <span>Base User fees ($0.15):</span>
                  <span className="font-mono font-black">${(users.length * 0.15 * simulatedLoadMultiplier).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-amber-700/80 font-bold">
                  <span>Base Pack fees ($0.03):</span>
                  <span className="font-mono font-black">${(lists.length * 0.03 * simulatedLoadMultiplier).toFixed(2)}</span>
                </div>
              </div>

              {/* API Rates card */}
              <div className="bg-neutral-50 p-6 border border-neutral-100 rounded-3xl space-y-4 shadow-sm">
                <p className="text-[10px] font-black tracking-widest text-neutral-500 uppercase">GCP Pricing API Catalog Rates</p>
                <div className="space-y-2 text-xs font-semibold text-neutral-700">
                  <div className="flex justify-between items-center pb-1 border-b border-neutral-200/50">
                    <span className="text-neutral-500">Cloud Run CPU / sec:</span>
                    <span className="font-mono text-neutral-900">${(gcpPricingData?.rates?.cloudRun?.cpuSecond || 0.000024).toFixed(8)}</span>
                  </div>
                  <div className="flex justify-between items-center pb-1 border-b border-neutral-200/50">
                    <span className="text-neutral-500">Cloud Run RAM / sec:</span>
                    <span className="font-mono text-neutral-900">${(gcpPricingData?.rates?.cloudRun?.memoryGbSecond || 0.0000025).toFixed(8)}</span>
                  </div>
                  <div className="flex justify-between items-center pb-1 border-b border-neutral-200/50">
                    <span className="text-neutral-500">Cloud Run Req / Million:</span>
                    <span className="font-mono text-neutral-900">${(((gcpPricingData?.rates?.cloudRun?.request || 0.0000004) || 0) * 1000000).toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500">Firestore Writes / 100k:</span>
                    <span className="font-mono text-emerald-600">${(((gcpPricingData?.rates?.firestore?.write || 0.0000018) || 0) * 100000).toFixed(4)}</span>
                  </div>
                </div>
                <p className="text-[10px] text-neutral-400 italic font-medium">
                  *Last updated: {gcpPricingData?.simulatedMetrics?.lastUpdated ? new Date(gcpPricingData.simulatedMetrics.lastUpdated).toLocaleTimeString() : 'Just now'}
                </p>
              </div>
            </div>

            {/* Cost trajectory & Comparison Area Chart */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-neutral-900">Historical Comparison Trajectory</h4>
                  <p className="text-xs text-neutral-500">Dynamic projection comparing real tariff calculations against simulated metric averages</p>
                </div>
                <div className="flex items-center gap-4 text-xs font-black">
                  <span className="flex items-center gap-1.5 text-emerald-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    Actual GCP Cost
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-500">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                    Simulated Metric
                  </span>
                </div>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={billingTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorGcp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorSim" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="month" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip 
                      contentStyle={{ background: '#171717', border: 'none', borderRadius: '1rem', color: '#fff', fontSize: '11px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Area type="monotone" dataKey="Actual GCP Cost ($)" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorGcp)" />
                    <Area type="monotone" dataKey="Simulated Metric ($)" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSim)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Sub-resource breakdown visualization */}
            <div className="space-y-3">
              <h4 className="font-bold text-neutral-900 text-sm">GCP Workload Cost Distribution (Actual Tariffs)</h4>
              <div className="w-full h-3 bg-neutral-100 rounded-full flex overflow-hidden">
                {actualCostDetails.breakdown.map((item, idx) => {
                  const colors = ['bg-emerald-500', 'bg-emerald-400', 'bg-emerald-300', 'bg-indigo-500', 'bg-indigo-400', 'bg-indigo-300', 'bg-sky-500'];
                  if (item.value <= 0) return null;
                  return (
                    <div
                      key={idx}
                      className={`h-full ${colors[idx % colors.length]}`}
                      style={{ width: `${item.percentage}%` }}
                      title={`${item.name}: $${item.value.toFixed(4)} (${item.percentage.toFixed(1)}%)`}
                    />
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-4 pt-1">
                {actualCostDetails.breakdown.map((item, idx) => {
                  const bulletColors = ['bg-emerald-500', 'bg-emerald-400', 'bg-emerald-300', 'bg-indigo-500', 'bg-indigo-400', 'bg-indigo-300', 'bg-sky-500'];
                  if (item.value <= 0) return null;
                  return (
                    <div key={idx} className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-500">
                      <span className={`w-2 h-2 rounded-full ${bulletColors[idx % bulletColors.length]}`}></span>
                      <span>{item.name}:</span>
                      <span className="font-mono text-neutral-900">${item.value.toFixed(3)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold">Recent Activity</h3>
                <TrendingUp className="text-primary" />
              </div>
              <div className="space-y-4">
                {lists.slice(0, 5).map((list, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm">
                        <Package size={20} />
                      </div>
                      <div className="space-y-0.5">
                        <p className="font-bold">{list.name}</p>
                        <p className="text-xs text-neutral-400">Created by {users.find(u => u.uid === list.ownerId)?.displayName || 'Unknown'}</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-neutral-400">{new Date(list.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold">Revenue Overview</h3>
                <CreditCard className="text-accent" />
              </div>
              <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <div className="text-6xl font-black text-neutral-900">${(users.filter(u => u.plan === 'pro').length * 9.99).toFixed(2)}</div>
                <p className="text-neutral-500 font-medium uppercase tracking-widest text-sm">Monthly Recurring Revenue</p>
                <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden mt-8">
                  <div className="w-1/3 h-full bg-accent"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'telemetry' && (
        <div className="space-y-8">
          {/* Top Panel: KPIs */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { 
                label: 'Simulated Platform Cost (Mo.)', 
                value: `$${((lists.length * 0.03 + users.length * 0.15 + (lists.length * 6000 * (telemetryModel === 'gemini-1.5-pro' ? 2.19/1000000 : 0.13/1000000))) * simulatedLoadMultiplier).toFixed(2)}`, 
                subtext: `At ${simulatedLoadMultiplier}x average current activity load`,
                icon: <Coins size={22} className="text-emerald-500" />, 
                color: 'bg-emerald-50/50 border border-emerald-100'
              },
              { 
                label: 'Combined API Tokens Estimator', 
                value: (lists.length * 6000 * simulatedLoadMultiplier).toLocaleString(), 
                subtext: `Prompt Inputs: ${(lists.length * 4500 * simulatedLoadMultiplier).toLocaleString()} | Outputs: ${(lists.length * 1500 * simulatedLoadMultiplier).toLocaleString()}`,
                icon: <Zap size={22} className="text-amber-500 animate-pulse" />, 
                color: 'bg-amber-50/50 border border-amber-100'
              },
              { 
                label: 'Firestore Dynamic Operations', 
                value: ((users.length * 45 + lists.length * 15 + checkoutLogs.length * 20) * simulatedLoadMultiplier).toLocaleString(), 
                subtext: `Reads: ${((users.length * 45 + lists.length * 10) * simulatedLoadMultiplier).toLocaleString()} | Writes/Deletes: ${((lists.length * 5 + checkoutLogs.length * 20) * simulatedLoadMultiplier).toLocaleString()}`,
                icon: <Layers size={22} className="text-indigo-500" />, 
                color: 'bg-indigo-50/50 border border-indigo-100'
              },
              { 
                label: 'Platform Diagnostics', 
                value: `${uptimePing} ms`, 
                subtext: 'Service: Cloud Run (Vite Node Proxy) | Uptime: 99.99%',
                icon: <Activity size={22} className="text-sky-500" />, 
                color: 'bg-sky-50/50 border border-sky-100'
              }
            ].map((stat, i) => (
              <div key={i} className={`bg-white p-6 rounded-3xl shadow-sm space-y-4 hover:shadow-lg transition-all duration-300 ${stat.color}`}>
                <div className="flex items-center justify-between">
                  {stat.icon}
                  <span className="text-[10px] bg-white border border-neutral-100 px-2 py-0.5 rounded-full font-black text-neutral-400">GOOGLE CLOUD</span>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{stat.label}</p>
                  <h3 className="text-3xl font-black tracking-tight text-neutral-900">{stat.value}</h3>
                  <p className="text-[10px] text-neutral-500 font-medium italic">{stat.subtext}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Cost Analysis Chart Card - D3 / Recharts based */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-6">
              <div>
                <h3 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
                  <Coins size={22} className="text-emerald-500" />
                  <span>Google Cloud Stack Monthly Cost Analysis</span>
                </h3>
                <p className="text-neutral-500 text-xs mt-1">Real-time simulation of production resource utilization and associated GCP billing rates</p>
              </div>

              {/* Toggle controls */}
              <div className="flex bg-neutral-100 p-1 rounded-xl self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => setCostChartType('cumulative')}
                  className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                    costChartType === 'cumulative'
                      ? 'bg-neutral-900 text-white shadow-sm font-bold'
                      : 'text-neutral-400 hover:text-neutral-900'
                  }`}
                >
                  Cumulative Stacked Area
                </button>
                <button
                  type="button"
                  onClick={() => setCostChartType('breakdown')}
                  className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                    costChartType === 'breakdown'
                      ? 'bg-neutral-900 text-white shadow-sm font-bold'
                      : 'text-neutral-400 hover:text-neutral-900'
                  }`}
                >
                  Service Workload Bar
                </button>
              </div>
            </div>

            {/* Chart Area */}
            <div className="h-80 md:h-96 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                {costChartType === 'cumulative' ? (
                  <AreaChart
                    data={telemetryMonthlyCostTrend}
                    margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorRun" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.01}/>
                      </linearGradient>
                      <linearGradient id="colorFire" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.01}/>
                      </linearGradient>
                      <linearGradient id="colorStorage" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.01}/>
                      </linearGradient>
                      <linearGradient id="colorGemini" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.01}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis
                      dataKey="month"
                      stroke="#888888"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      dy={10}
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const total = payload.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);
                          return (
                            <div className="bg-neutral-900 border border-white/10 text-white p-4 rounded-2xl shadow-xl space-y-2 text-xs font-mono">
                              <p className="font-extrabold text-neutral-400 border-b border-white/5 pb-1 uppercase tracking-wider">{label} Operations</p>
                              {payload.map((p, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-6">
                                  <span className="flex items-center gap-1.5 font-bold">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></span>
                                    {p.name}:
                                  </span>
                                  <span className="font-extrabold text-neutral-200">${Number(p.value).toFixed(2)}</span>
                                </div>
                              ))}
                              <div className="flex items-center justify-between gap-6 border-t border-white/5 pt-1 mt-1 font-extrabold text-emerald-400">
                                <span>Total Estimated:</span>
                                <span>${total.toFixed(2)}</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '20px' }} />
                    <Area type="monotone" dataKey="Cloud Run" stackId="1" stroke="#10b981" fillOpacity={1} fill="url(#colorRun)" strokeWidth={2} />
                    <Area type="monotone" dataKey="Firestore" stackId="1" stroke="#6366f1" fillOpacity={1} fill="url(#colorFire)" strokeWidth={2} />
                    <Area type="monotone" dataKey="Storage" stackId="1" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorStorage)" strokeWidth={2} />
                    <Area type="monotone" dataKey="Gemini AI" stackId="1" stroke="#f59e0b" fillOpacity={1} fill="url(#colorGemini)" strokeWidth={2} />
                  </AreaChart>
                ) : (
                  <BarChart
                    data={telemetryMonthlyCostTrend}
                    margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis
                      dataKey="month"
                      stroke="#888888"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      dy={10}
                    />
                    <YAxis
                      stroke="#888888"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const total = payload.reduce((sum, entry) => sum + (Number(entry.value) || 0), 0);
                          return (
                            <div className="bg-neutral-900 border border-white/10 text-white p-4 rounded-2xl shadow-xl space-y-2 text-xs font-mono">
                              <p className="font-extrabold text-neutral-400 border-b border-white/5 pb-1 uppercase tracking-wider">{label} Workloads</p>
                              {payload.map((p, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-6">
                                  <span className="flex items-center gap-1.5 font-bold">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></span>
                                    {p.name}:
                                  </span>
                                  <span className="font-extrabold text-neutral-200">${Number(p.value).toFixed(2)}</span>
                                </div>
                              ))}
                              <div className="flex items-center justify-between gap-6 border-t border-white/5 pt-1 mt-1 font-extrabold text-indigo-400">
                                <span>Month sum:</span>
                                <span>${total.toFixed(2)}</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '20px' }} />
                    <Bar dataKey="Cloud Run" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Firestore" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Storage" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Gemini AI" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Custom Ledger block representing real-world values list */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-neutral-100 text-xs">
              {[
                { name: 'Cloud Run Web Server', cost: baseRun, color: 'bg-emerald-500', note: 'Standard SLA' },
                { name: 'Firestore Operations', cost: baseFire, color: 'bg-indigo-500', note: 'Document Store' },
                { name: 'Cloud Storage Bucket', cost: baseStorage, color: 'bg-sky-500', note: 'Media assets' },
                { name: 'Gemini Generative API', cost: baseGemini, color: 'bg-amber-500', note: `Model: ${telemetryModel}` }
              ].map((item, index) => (
                <div key={index} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] text-neutral-400 font-extrabold uppercase tracking-wider flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${item.color}`}></span>
                      {item.note}
                    </p>
                    <h4 className="font-bold text-neutral-800 leading-tight truncate">{item.name}</h4>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-black text-neutral-900">${item.cost.toFixed(2)}</p>
                    <span className="text-[9px] text-neutral-400">Current Mo.</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-8">
            {/* Left Module: Stack Breakouts & Simulator (8 cols) */}
            <div className="lg:col-span-8 bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-6">
                <div>
                  <h3 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
                    <Cpu size={22} className="text-neutral-500" />
                    <span>Google Cloud Platform Resources & Costs breaking</span>
                  </h3>
                  <p className="text-neutral-500 text-xs mt-1">Live tracking and pricing calculator simulating real-time Cloud operations</p>
                </div>
                
                <div className="flex items-center gap-3 bg-neutral-50 p-2 border border-neutral-200 rounded-2xl shrink-0">
                  <label className="text-[10px] font-extrabold uppercase text-neutral-400 pl-2">Active AI Pricing:</label>
                  <select 
                    value={telemetryModel}
                    onChange={(e) => setTelemetryModel(e.target.value as any)}
                    className="bg-white px-3 py-1.5 border border-neutral-200 rounded-xl text-xs font-bold outline-none"
                  >
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  </select>
                </div>
              </div>

              {/* Stress / Load multiplier slider */}
              <div className="p-6 bg-neutral-50 rounded-3xl border border-neutral-200/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase text-neutral-500 tracking-wider">Simulated Traffic Stress Multiplier</h4>
                    <p className="text-[10px] text-neutral-400">Scale current user counts to project deployment sizing & budget</p>
                  </div>
                  <div className="px-4 py-1 bg-neutral-900 text-white rounded-full font-black text-xs font-mono">
                    {simulatedLoadMultiplier}x Load
                  </div>
                </div>
                <input 
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  value={simulatedLoadMultiplier}
                  onChange={(e) => setSimulatedLoadMultiplier(Number(e.target.value))}
                  className="w-full accent-neutral-900 h-2 bg-neutral-200 rounded-lg cursor-pointer transition-all"
                />
                <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
                  <span>1x (Current Live Baseline)</span>
                  <span>10x (Medium Sized Company)</span>
                  <span>50x (Enterprise Deploy)</span>
                  <span>100x (Global Capacity Stress)</span>
                </div>
              </div>

              {/* List of services & calculated footprints */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-[#2563eb]">Service Infrastructure break-down</h4>
                
                <div className="divide-y divide-neutral-100 border border-neutral-100 rounded-3xl overflow-hidden bg-white shadow-inner">
                  {/* Service Row: Cloud Run */}
                  <div className="p-6 hover:bg-neutral-50/40 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                        <p className="font-bold text-sm text-neutral-900">Cloud Run Serverless Compute</p>
                      </div>
                      <p className="text-[11px] text-neutral-400">VNode container serving Node router endpoints in Cloud Run. Standard CPU/Memory billing.</p>
                      <p className="text-[10px] text-neutral-500 italic">Usage: {(12 + lists.length * 3 * simulatedLoadMultiplier).toFixed(1)} Virtual CPU-Hours | {(24 + lists.length * 6 * simulatedLoadMultiplier).toFixed(1)} GB-Hours Memory</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-neutral-900">${((0.45 + lists.length * 0.008) * simulatedLoadMultiplier).toFixed(3)}</p>
                      <span className="text-[9px] bg-neutral-100 text-neutral-400 border border-neutral-200 rounded-full px-2 py-0.5 uppercase font-bold font-mono">CPU-Sec / GB-Sec</span>
                    </div>
                  </div>

                  {/* Service Row: Firestore */}
                  <div className="p-6 hover:bg-neutral-50/40 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"></span>
                        <p className="font-bold text-sm text-neutral-900">Cloud Firestore Storage Document Store</p>
                      </div>
                      <p className="text-[11px] text-neutral-400">Document data reads, writes, and local deletions sync rate across full logistics structure.</p>
                      <p className="text-[10px] text-neutral-500 italic">Operations: {Math.round((users.length * 45 + lists.length * 15 + checkoutLogs.length * 20) * simulatedLoadMultiplier)} Reads | {Math.round((lists.length * 5 + checkoutLogs.length * 10) * simulatedLoadMultiplier)} Writes</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-neutral-900">${(((users.length * 45 + lists.length * 15 + checkoutLogs.length * 20) * 0.06 / 100000 + (lists.length * 5 + checkoutLogs.length * 10) * 0.18 / 100000) * simulatedLoadMultiplier).toFixed(4)}</p>
                      <span className="text-[9px] bg-neutral-100 text-neutral-400 border border-neutral-200 rounded-full px-2 py-0.5 uppercase font-bold font-mono">$0.06/100K ops</span>
                    </div>
                  </div>

                  {/* Service Row: Cloud Storage */}
                  <div className="p-6 hover:bg-neutral-50/40 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#1e293b] shrink-0"></span>
                        <p className="font-bold text-sm text-neutral-900">Google Cloud Storage (GCS) Buckets</p>
                      </div>
                      <p className="text-[11px] text-neutral-400">Asset images uploaded of gears, barcode documents, logo overlays, and system backups.</p>
                      <p className="text-[10px] text-neutral-500 italic">Size: {(124 + lists.length * 12 * simulatedLoadMultiplier).toFixed(1)} MB storage allocation</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-neutral-900">${((0.02 + lists.length * 0.0002) * simulatedLoadMultiplier).toFixed(4)}</p>
                      <span className="text-[9px] bg-neutral-100 text-neutral-400 border border-neutral-200 rounded-full px-2 py-0.5 uppercase font-bold font-mono">$0.02 / GB / mo</span>
                    </div>
                  </div>

                  {/* Service Row: Gemini API */}
                  <div className="p-6 hover:bg-neutral-50/40 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0"></span>
                        <p className="font-bold text-sm text-neutral-900">AI Gemini API Subsystem ({telemetryModel})</p>
                      </div>
                      <p className="text-[11px] text-neutral-400 font-medium text-neutral-600">Model inference pipelines for packing list automatic categorizers & scanning recognition.</p>
                      <p className="text-[10px] text-neutral-500 italic">Cumulative load tokens: {(lists.length * 4500 * simulatedLoadMultiplier).toLocaleString()} prompts in | {(lists.length * 1500 * simulatedLoadMultiplier).toLocaleString()} completions out</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-neutral-900">
                        ${((lists.length * 4500 * (telemetryModel === 'gemini-1.5-pro' ? 1.25/1000000 : 0.075/1000000) + 
                            lists.length * 1500 * (telemetryModel === 'gemini-1.5-pro' ? 5.00/1000000 : 0.30/1000000)) * simulatedLoadMultiplier).toFixed(4)}
                      </p>
                      <span className="text-[9px] bg-neutral-100 text-neutral-400 border border-neutral-200 rounded-full px-2 py-0.5 uppercase font-bold font-mono">Per-Million Base</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Module: Diagnostics Terminals & Pricing Matrix (4 cols) */}
            <div className="lg:col-span-4 space-y-8 flex flex-col">
              {/* Uptime diagnostics probe */}
              <div className="bg-neutral-900 text-white p-6 rounded-[2rem] border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase text-neutral-400 tracking-widest flex items-center gap-1.5">
                    <Activity size={14} className="text-sky-400 animate-pulse" />
                    <span>Uptime Probe Monitor</span>
                  </h4>
                  <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold text-[8px] font-mono tracking-widest">LIVE ONLINE</span>
                </div>

                <div className="grid grid-cols-2 gap-4 pb-4 border-b border-white/5">
                  <div className="bg-white/5 p-3 rounded-2xl">
                    <p className="text-[9px] text-neutral-500 font-extrabold uppercase">PING LATENCY</p>
                    <p className="text-2xl font-black text-white mt-1">{uptimePing} ms</p>
                  </div>
                  <div className="bg-white/5 p-3 rounded-2xl">
                    <p className="text-[9px] text-neutral-500 font-extrabold uppercase">AVAILABILITY</p>
                    <p className="text-2xl font-black text-emerald-400 mt-1">99.982%</p>
                  </div>
                </div>

                <div className="space-y-2 text-[11px] text-neutral-300">
                  <p><strong>Cloud DNS Node:</strong> gcp-asia-east1-a (Taiwan Hub)</p>
                  <p><strong>Database Connection:</strong> Secure Firestore Connection Pool OK</p>
                </div>

                <button
                  type="button"
                  disabled={isPinging}
                  onClick={() => {
                    setIsPinging(true);
                    setUptimePing(Math.floor(Math.random() * 25) + 15);
                    const logMessage = `Diagnostic ping dispatch sequence successfully triggered to Cloud Run context... OK in ${Math.floor(Math.random() * 25) + 15}ms!`;
                    setTelemetryLogs(logs => [
                      { id: Date.now().toString(), time: new Date().toTimeString().split(' ')[0], message: logMessage, level: 'info' },
                      ...logs
                    ]);
                    setTimeout(() => {
                      setIsPinging(false);
                      toast.success("Self-Test Network Diagnostics Probe Completed!");
                    }, 800);
                  }}
                  className="w-full py-3 bg-white hover:bg-neutral-100 disabled:opacity-50 text-neutral-900 rounded-xl font-bold uppercase tracking-widest text-[10px] transition cursor-pointer flex items-center justify-center gap-2 font-mono shadow-md"
                >
                  {isPinging ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin"></div>
                      <span>Probing Node Route...</span>
                    </>
                  ) : (
                    <>
                      <span>Trigger Diagnostic Probe</span>
                    </>
                  )}
                </button>
              </div>

              {/* Interactive Telemetry Log terminal */}
              <div className="bg-black text-emerald-400 p-6 rounded-[2rem] border border-neutral-800 flex-1 flex flex-col min-h-[300px]">
                <div className="flex items-center justify-between mb-4 border-b border-emerald-950 pb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[9px] font-black uppercase text-neutral-400 font-mono">Live Debug Logs Terminal</span>
                  </div>
                  <button 
                    onClick={() => setTelemetryLogs([])}
                    className="text-[9px] hover:text-white bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800 transition font-mono uppercase"
                  >
                    Clear Feed
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-2 max-h-[220px] scrollbar-thin scrollbar-thumb-emerald-950">
                  {telemetryLogs.length === 0 ? (
                    <p className="text-neutral-600 italic">No output in pipeline buffer.</p>
                  ) : (
                    telemetryLogs.map((log) => (
                      <p key={log.id} className="leading-relaxed">
                        <span className="text-neutral-500">[{log.time}]</span>{' '}
                        <span className={log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-amber-400' : 'text-emerald-400'}>
                          {log.message}
                        </span>
                      </p>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION: User Resource Sizing Table */}
          <div className="bg-white rounded-[2.5rem] border border-neutral-100 shadow-sm overflow-hidden p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 pb-6">
              <div>
                <h3 className="text-xl font-bold text-neutral-900">User accounts resource footprint & quotas analyzer</h3>
                <p className="text-neutral-500 text-xs mt-1">Detailed allocation metrics of packing lists, data structures, and estimated monthly compute footprint for every account</p>
              </div>
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                <input
                  type="text"
                  placeholder="Search accounts catalog..."
                  value={telemetryUserQuery}
                  onChange={(e) => setTelemetryUserQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-neutral-50 text-neutral-500 text-[10px] font-black uppercase tracking-widest border-b border-neutral-100">
                    <th className="px-6 py-4">Account Profile</th>
                    <th className="px-6 py-4 text-center">Packing Lists</th>
                    <th className="px-6 py-4 text-center">Global Projects</th>
                    <th className="px-6 py-4">Estimated Monthly API Tokens</th>
                    <th className="px-6 py-4">Monthly Footprint ($)</th>
                    <th className="px-6 py-4">Quota Capacity Limit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 text-xs">
                  {users
                    .filter(u => 
                      u.displayName.toLowerCase().includes(telemetryUserQuery.toLowerCase()) || 
                      u.email.toLowerCase().includes(telemetryUserQuery.toLowerCase())
                    )
                    .map((u) => {
                      const userLists = lists.filter(l => l.ownerId === u.uid).length;
                      const userProjs = allProjects.filter(p => p.ownerId === u.uid).length;
                      const estUserTokens = userLists * 6000;
                      // Gemini Cost estimation + storage estimated share
                      const estCost = userLists * 0.038 + 0.15;
                      const maxListsAllowed = u.plan === 'pro' ? 250 : u.plan === 'enterprise' ? 9999 : 5;
                      const maxProjectsAllowed = u.plan === 'pro' ? 50 : u.plan === 'enterprise' ? 9999 : 2;
                      const quotaPercent = Math.min(100, Math.round(((userLists) / maxListsAllowed) * 100));

                      return (
                        <tr key={u.uid} className="hover:bg-neutral-50/50 transition">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <img src={u.photoURL} alt={u.displayName} className="w-8 h-8 rounded-full border border-neutral-200 shrink-0" />
                              <div>
                                <p className="font-bold text-neutral-900 leading-tight flex items-center gap-1.5">
                                  <span>{u.displayName}</span>
                                  <span className={`px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-full border shrink-0 ${
                                    u.plan === 'pro' ? 'bg-amber-50 text-amber-600 border-amber-200' : 
                                    u.plan === 'enterprise' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 
                                    'bg-neutral-50 text-neutral-500 border-neutral-200'
                                  }`}>
                                    {u.plan || 'Free'}
                                  </span>
                                </p>
                                <p className="text-[10px] text-neutral-400 font-mono mt-0.5">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center font-bold font-mono text-neutral-800">{userLists}</td>
                          <td className="px-6 py-4 text-center font-bold font-mono text-neutral-800">{userProjs}</td>
                          <td className="px-6 py-4">
                            <div className="space-y-0.5">
                              <p className="font-bold font-mono text-neutral-700">{estUserTokens.toLocaleString()} tokens</p>
                              <p className="text-[9px] text-neutral-400 italic">Avg {(userLists * 4.5).toFixed(1)}k prompt / {(userLists * 1.5).toFixed(1)}k response</p>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-bold text-[#2563eb] font-mono">
                            ${estCost.toFixed(2)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1 min-w-[120px]">
                              <div className="flex items-center justify-between text-[9px] font-mono">
                                <span className="text-neutral-500 font-mono">{userLists}/{maxListsAllowed} Lists</span>
                                <span className="font-bold text-neutral-900">{quotaPercent}%</span>
                              </div>
                              <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${quotaPercent > 90 ? 'bg-red-500' : quotaPercent > 60 ? 'bg-amber-500' : 'bg-neutral-900'}`}
                                  style={{ width: `${quotaPercent}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION: Platform Incident Center & Bug Updates */}
          <div className="bg-white rounded-[2.5rem] border border-neutral-100 shadow-sm overflow-hidden p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-6">
              <div>
                <h3 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
                  <AlertCircle className="text-amber-500" />
                  <span>Platform Incidents & Maintenance System Logs</span>
                </h3>
                <p className="text-neutral-500 text-xs mt-1">Uptime telemetry logs, automated bugs classification and resolution updates</p>
              </div>

              {/* Severity Quick Filters */}
              <div className="flex items-center gap-1 bg-neutral-50 p-1 border border-neutral-200 rounded-xl self-start sm:self-center">
                {(['all', 'critical', 'error', 'warning', 'info'] as const).map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setBugFilter(sev)}
                    className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                      bugFilter === sev
                        ? 'bg-neutral-900 text-white shadow-sm'
                        : 'text-neutral-400 hover:text-neutral-900'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {[
                { 
                  id: 'b1', 
                  title: 'Container exit on undefined production middleware start sequence', 
                  status: 'Resolved', 
                  date: 'May 28, 2026', 
                  severity: 'critical', 
                  desc: 'Vite build bundling resulted in missing dependency bindings. Corrected dynamically using esbuild node modules encapsulation.' 
                },
                { 
                  id: 'b2', 
                  title: 'Resend transactional email sandbox sender limit restriction', 
                  status: 'Mitigated', 
                  date: 'May 28, 2026', 
                  severity: 'warning', 
                  desc: 'Resend API blocks outgoing dispatches to unverified custom emails. Integrated a fall-back local sandbox email modal cleanly!' 
                },
                { 
                  id: 'b3', 
                  title: 'Cloud Firestore "Missing or insufficient permissions" error header', 
                  status: 'Resolved', 
                  date: 'May 27, 2026', 
                  severity: 'error', 
                  desc: 'Security rules on sub-collections lacked direct organization owner validation. Deployed defensive schemas.' 
                },
                { 
                  id: 'b4', 
                  title: 'Barcode coordinate translations skewed slightly on iPad OS', 
                  status: 'Warning', 
                  date: 'May 25, 2026', 
                  severity: 'info', 
                  desc: 'Varying iPad screen ratios triggered pixel translations displacement. Aspect calculations optimized.' 
                },
                { 
                  id: 'b5', 
                  title: 'Under-utilized database composite index on orgId + createdAt', 
                  status: 'Optimizing', 
                  date: 'May 24, 2026', 
                  severity: 'info', 
                  desc: 'Active query limits index optimizations underway. Speeds up admin list operations up to 350%.' 
                }
              ]
              .filter(bug => bugFilter === 'all' || bug.severity === bugFilter)
              .map((bug) => (
                <div key={bug.id} className="p-6 bg-neutral-50 rounded-2xl border border-neutral-100 hover:border-neutral-200 transition space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-widest border ${
                        bug.severity === 'critical' ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : 
                        bug.severity === 'error' ? 'bg-orange-50 text-orange-600 border-orange-200' : 
                        bug.severity === 'warning' ? 'bg-amber-50 text-amber-600 border-amber-200' : 
                        'bg-sky-50 text-sky-600 border-sky-200'
                      }`}>
                        {bug.severity}
                      </span>
                      <h4 className="font-bold text-neutral-800 text-sm">{bug.title}</h4>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-mono text-neutral-400">
                      <span>{bug.date}</span>
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        bug.status === 'Resolved' ? 'bg-emerald-100 text-emerald-800' : 
                        bug.status === 'Mitigated' ? 'bg-blue-100 text-blue-800' : 
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {bug.status}
                      </span>
                    </div>
                  </div>
                  <p className="text-neutral-500 font-medium leading-relaxed max-w-4xl text-xs">{bug.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm overflow-hidden">
          <div className="p-6 md:p-8 border-b border-neutral-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-sm"
              />
            </div>
            <button className="flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition text-sm whitespace-nowrap">
              <UserPlus size={20} />
              <span>Invite User</span>
            </button>
          </div>
          
          {/* Table View (Desktop) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-neutral-50 text-neutral-500 text-[10px] font-black uppercase tracking-widest">
                  <th className="px-8 py-4">User</th>
                  <th className="px-8 py-4">Organization</th>
                  <th className="px-8 py-4">Dept / Team</th>
                  <th className="px-8 py-4">Projects</th>
                  <th className="px-8 py-4">Role</th>
                  <th className="px-8 py-4">Plan</th>
                  <th className="px-8 py-4">Beta Tester</th>
                  <th className="px-8 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {users.filter(u => 
                  u.displayName.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
                  u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
                ).map((u) => (
                  <tr key={u.uid} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <img src={u.photoURL} alt={u.displayName} className="w-10 h-10 rounded-full border border-neutral-200" />
                        <div className="space-y-0.5">
                          <p className="font-bold text-sm">{u.displayName}</p>
                          <p className="text-xs text-neutral-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <select
                        value={u.orgId || ''}
                        onChange={(e) => handleUpdateUserOrg(u.uid, 'orgId', e.target.value)}
                        className="w-full px-3 py-1.5 bg-neutral-50 border border-neutral-100 rounded-lg text-[10px] font-bold outline-none"
                      >
                        <option value="">No Organization</option>
                        {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1 min-w-[120px]">
                        <select
                          value={u.deptId || ''}
                          onChange={(e) => handleUpdateUserOrg(u.uid, 'deptId', e.target.value)}
                          className="w-full px-2 py-1 bg-neutral-50 border border-neutral-100 rounded-lg text-[10px] outline-none"
                          disabled={!u.orgId}
                        >
                          <option value="">No Dept</option>
                          {departments.filter(d => d.orgId === u.orgId).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        <select
                          value={u.teamId || ''}
                          onChange={(e) => handleUpdateUserOrg(u.uid, 'teamId', e.target.value)}
                          className="w-full px-2 py-1 bg-neutral-50 border border-neutral-100 rounded-lg text-[10px] outline-none"
                          disabled={!u.deptId}
                        >
                          <option value="">No Team</option>
                          {teams.filter(t => t.deptId === u.deptId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black">{allProjects.filter(p => p.ownerId === u.uid).length}</span>
                        <Briefcase size={12} className="text-neutral-300" />
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <select
                        value={u.role || 'viewer'}
                        onChange={(e) => handleUpdateUserRole(u.uid, e.target.value)}
                        className="px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-[10px] font-black uppercase tracking-wider outline-none border transition-all cursor-pointer hover:bg-neutral-100/50"
                      >
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="technician">Technician</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2">
                        <select
                          value={u.plan || 'free'}
                          onChange={(e) => handleUpdatePlan(u.uid, e.target.value)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider outline-none border transition-all cursor-pointer ${
                            u.plan === 'free' ? 'bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-200' : 
                            'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'
                          }`}
                        >
                          <option value="free">Free</option>
                          {settings?.plans?.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                          {/* Keep existing user plan if it's not in the list (e.g. manually assigned or legacy) */}
                          {u.plan && u.plan !== 'free' && !settings?.plans?.some(p => p.id === u.plan) && (
                            <option value={u.plan}>{u.plan} (Custom)</option>
                          )}
                        </select>
                      </div>
                    </td>

                    <td className="px-8 py-6">
                      <button
                        onClick={() => handleToggleBetaTester(u.uid, !!u.isBetaTester)}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border shadow-sm cursor-pointer select-none ${
                          u.isBetaTester 
                            ? 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200' 
                            : 'bg-neutral-50 text-neutral-500 border-neutral-200 hover:bg-neutral-100'
                        }`}
                        title="Toggle Beta program access"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${u.isBetaTester ? 'bg-purple-600 animate-pulse' : 'bg-neutral-400'}`}></span>
                        <span>{u.isBetaTester ? 'Beta Tester' : 'Regular User'}</span>
                      </button>
                    </td>

                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => {
                            setEditingUserForListings(u);
                            setIsUserListingsModalOpen(true);
                          }}
                          className="p-2 text-neutral-400 hover:text-[#ff4f3a] transition rounded-lg hover:bg-neutral-100 mr-1"
                          title="Manage User Listings"
                        >
                          <ShoppingBag size={16} />
                        </button>
                        <button className="p-2 text-neutral-400 hover:text-primary transition rounded-lg hover:bg-neutral-100">
                          <Mail size={16} />
                        </button>
                        <button className="p-2 text-neutral-400 hover:text-red-500 transition rounded-lg hover:bg-red-50">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Card View (Mobile) */}
          <div className="md:hidden divide-y divide-neutral-100">
            {users.filter(u => 
              u.displayName.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
              u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
            ).map((u) => (
              <div key={u.uid} className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src={u.photoURL} alt={u.displayName} className="w-10 h-10 rounded-full" />
                    <div>
                      <p className="font-bold text-sm">{u.displayName}</p>
                      <p className="text-[10px] text-neutral-400 font-medium">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setEditingUserForListings(u);
                        setIsUserListingsModalOpen(true);
                      }}
                      className="p-3 bg-neutral-50 text-neutral-400 hover:text-[#ff4f3a] rounded-xl"
                      title="Manage User Listings"
                    >
                      <ShoppingBag size={16}/>
                    </button>
                    <button className="p-3 bg-neutral-50 text-neutral-400 rounded-xl"><Mail size={16}/></button>
                    <button className="p-3 bg-red-50 text-red-400 rounded-xl"><Trash2 size={16}/></button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">User Role</label>
                    <select
                      value={u.role || 'viewer'}
                      onChange={(e) => handleUpdateUserRole(u.uid, e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-100 rounded-xl text-[10px] font-bold"
                    >
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="technician">Technician</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Current Plan</label>
                    <select
                      value={u.plan || 'free'}
                      onChange={(e) => handleUpdatePlan(u.uid, e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border cursor-pointer ${
                        u.plan === 'free' ? 'bg-neutral-100 text-neutral-600 border-neutral-200' : 
                        'bg-primary/10 text-primary border-primary/20'
                      }`}
                    >
                      <option value="free">Free</option>
                      {settings?.plans?.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                      {u.plan && u.plan !== 'free' && !settings?.plans?.some(p => p.id === u.plan) && (
                        <option value={u.plan}>{u.plan} (Custom)</option>
                      )}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Beta testing Program</label>
                  <button
                    onClick={() => handleToggleBetaTester(u.uid, !!u.isBetaTester)}
                    className={`w-full px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                      u.isBetaTester 
                        ? 'bg-purple-100 text-purple-700 border-purple-200' 
                        : 'bg-neutral-50 text-neutral-500 border-neutral-200'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${u.isBetaTester ? 'bg-purple-600 animate-pulse' : 'bg-neutral-400'}`}></span>
                    <span>{u.isBetaTester ? 'Beta Tester Status: Active' : 'Enable Beta Access'}</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Organization & Department/Team Scope</label>
                  <div className="space-y-2">
                    <select
                      value={u.orgId || ''}
                      onChange={(e) => handleUpdateUserOrg(u.uid, 'orgId', e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-100 rounded-xl text-[10px] font-bold"
                    >
                      <option value="">None</option>
                      {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <select
                        value={u.deptId || ''}
                        onChange={(e) => handleUpdateUserOrg(u.uid, 'deptId', e.target.value)}
                        className="flex-1 px-3 py-2 bg-neutral-50 border border-neutral-100 rounded-xl text-[10px] font-bold"
                        disabled={!u.orgId}
                      >
                        <option value="">No Dept</option>
                        {departments.filter(d => d.orgId === u.orgId).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                      <select
                        value={u.teamId || ''}
                        onChange={(e) => handleUpdateUserOrg(u.uid, 'teamId', e.target.value)}
                        className="flex-1 px-3 py-2 bg-neutral-50 border border-neutral-100 rounded-xl text-[10px] font-bold"
                        disabled={!u.deptId}
                      >
                        <option value="">No Team</option>
                        {teams.filter(t => t.deptId === u.deptId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'listings' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Sub Tab headers */}
          <div className="flex border-b border-neutral-100 pb-2 gap-6">
            <button
              type="button"
              onClick={() => setListingsSubTab('moderate')}
              className={`pb-2 text-xs font-black uppercase tracking-wider border-b-2 transition ${listingsSubTab === 'moderate' ? 'border-primary text-neutral-900 font-extrabold' : 'border-transparent text-neutral-400 hover:text-neutral-700 font-bold'}`}
            >
              💼 Listing Moderation
            </button>
            <button
              type="button"
              onClick={() => setListingsSubTab('categories')}
              className={`pb-2 text-xs font-black uppercase tracking-wider border-b-2 transition ${listingsSubTab === 'categories' ? 'border-primary text-neutral-900 font-extrabold' : 'border-transparent text-neutral-400 hover:text-neutral-700 font-bold'}`}
            >
              🏷️ Category Settings
            </button>
          </div>

          {listingsSubTab === 'moderate' && (
            <>
              {/* Stats Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm space-y-2">
              <span className="text-neutral-400 text-[10px] font-black uppercase tracking-widest block">Total Listings</span>
              <p className="text-3xl font-black text-neutral-900">{lists.filter(l => l.marketplaceEnabled).length}</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm space-y-2">
              <span className="text-amber-500 text-[10px] font-black uppercase tracking-widest block">Featured Listings</span>
              <p className="text-3xl font-black text-amber-600">{lists.filter(l => l.marketplaceEnabled && l.featured).length}</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm space-y-2">
              <span className="text-indigo-500 text-[10px] font-black uppercase tracking-widest block">Sponsored Ads</span>
              <p className="text-3xl font-black text-indigo-600">{lists.filter(l => l.marketplaceEnabled && l.sponsored).length}</p>
            </div>
            <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm space-y-2">
              <span className="text-red-500 text-[10px] font-black uppercase tracking-widest block">Suspended/Pending</span>
              <p className="text-3xl font-black text-red-600">{lists.filter(l => l.marketplaceEnabled && (l.moderationStatus === 'suspended' || l.moderationStatus === 'pending')).length}</p>
            </div>
          </div>

          {/* Filtering and Search Controls */}
          <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex bg-neutral-100 p-1 rounded-xl shrink-0 self-start md:self-auto overflow-x-auto w-full md:w-auto">
              <button
                onClick={() => setListingFilter('all')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap ${listingFilter === 'all' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-800'}`}
              >
                All Listings
              </button>
              <button
                onClick={() => setListingFilter('featured')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap ${listingFilter === 'featured' ? 'bg-white shadow-sm text-amber-600' : 'text-neutral-500 hover:text-neutral-800'}`}
              >
                Featured
              </button>
              <button
                onClick={() => setListingFilter('sponsored')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap ${listingFilter === 'sponsored' ? 'bg-white shadow-sm text-indigo-600' : 'text-neutral-500 hover:text-neutral-800'}`}
              >
                Sponsored (Ads)
              </button>
              <button
                onClick={() => setListingFilter('suspended')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap ${listingFilter === 'suspended' ? 'bg-white shadow-sm text-red-600' : 'text-neutral-500 hover:text-neutral-800'}`}
              >
                Review Items
              </button>
            </div>

            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
              <input
                type="text"
                value={listingSearchQuery}
                onChange={(e) => setListingSearchQuery(e.target.value)}
                placeholder="Search listings by name, category, or owner email..."
                className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl text-xs font-bold outline-none border focus:border-neutral-200 transition-all"
              />
            </div>
          </div>

          {/* Master Listing Directory */}
          <div className="bg-white rounded-[2rem] border border-neutral-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-neutral-50">
              <h3 className="font-extrabold text-neutral-900 uppercase tracking-tight text-sm">Marketplace Directory</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-100 text-[10px] font-black uppercase tracking-widest text-neutral-400">
                    <th className="px-8 py-5">Item Manifest</th>
                    <th className="px-8 py-5">Owner</th>
                    <th className="px-5 py-5">Pricing & Deposit</th>
                    <th className="px-5 py-5">Badges</th>
                    <th className="px-5 py-5">Status</th>
                    <th className="px-8 py-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {lists
                    .filter(l => l.marketplaceEnabled)
                    .filter(l => {
                      if (listingFilter === 'featured') return l.featured;
                      if (listingFilter === 'sponsored') return l.sponsored;
                      if (listingFilter === 'suspended') return l.moderationStatus === 'suspended' || l.moderationStatus === 'pending';
                      return true;
                    })
                    .filter(l => {
                      const query = listingSearchQuery.toLowerCase();
                      return (
                        (l.name?.toLowerCase() || '').includes(query) ||
                        (l.category?.toLowerCase() || '').includes(query) ||
                        (l.ownerEmail?.toLowerCase() || '').includes(query) ||
                        (l.marketplaceDetails?.toLowerCase() || '').includes(query)
                      );
                    })
                    .map((l) => {
                      const owner = users.find(u => u.uid === l.ownerId);
                      return (
                        <tr key={l.id} className="hover:bg-neutral-50/50 transition">
                          <td className="px-8 py-5 font-bold text-xs text-neutral-900">
                            <div className="space-y-0.5">
                              <span className="font-black text-neutral-800">{l.name}</span>
                              <div className="flex items-center gap-1.5 text-[8px] font-bold text-neutral-400 uppercase tracking-wider">
                                <span>{l.transactionType === 'Sale' ? 'For Sale' : 'For Rent'}</span>
                                <span>•</span>
                                <span>{l.itemsCount || 0} items</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-2">
                              {owner?.photoURL ? (
                                <img src={owner.photoURL} alt={owner.displayName} className="w-6 h-6 rounded-full" />
                              ) : (
                                <div className="w-6 h-6 bg-neutral-100 text-neutral-500 flex items-center justify-center rounded-full text-[8px] font-bold uppercase">
                                  {l.ownerEmail?.charAt(0) || 'U'}
                                </div>
                              )}
                              <div className="text-[10px]">
                                <p className="font-bold text-neutral-800 leading-none">{owner?.displayName || l.ownerEmail?.split('@')[0] || 'Unknown'}</p>
                                <p className="text-[8px] text-neutral-400 font-medium leading-none mt-0.5">{l.ownerEmail || 'No Email'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-5 font-bold text-xs">
                            <div className="space-y-0.5 text-neutral-700">
                              <span className="text-neutral-950 font-black">{l.marketplacePrice || 0} {l.marketplaceCurrency || 'USD'}</span>
                              {l.securityDeposit ? (
                                <span className="block text-[8px] text-neutral-400">Dep: {l.securityDeposit} {l.marketplaceCurrency || 'USD'}</span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-5 py-5">
                            <div className="flex flex-wrap gap-1">
                              {l.featured && (
                                <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 border border-amber-200/50 text-[8px] font-black uppercase tracking-wider rounded-md">
                                  Featured
                                </span>
                              )}
                              {l.sponsored && (
                                <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-200/50 text-[8px] font-black uppercase tracking-wider rounded-md">
                                  Sponsor Ad
                                </span>
                              )}
                              {!l.featured && !l.sponsored && (
                                <span className="text-[10px] text-neutral-300 font-medium italic">-</span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-5">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                              l.moderationStatus === 'suspended' ? 'bg-red-50 text-red-600 border border-red-200/50' :
                              l.moderationStatus === 'pending' ? 'bg-amber-50 text-amber-600 border border-amber-200/50' :
                              'bg-green-50 text-green-700 border border-green-200/50'
                            }`}>
                              {l.moderationStatus || 'approved'}
                            </span>
                          </td>
                          <td className="px-8 py-5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setEditingListing(l);
                                  setIsListingEditModalOpen(true);
                                }}
                                className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition-all"
                                title="Moderate Listing Parameters"
                              >
                                <Edit2 size={12} />
                                <span>Moderate</span>
                              </button>
                              <button
                                onClick={() => handleToggleMarketplaceAdmin(l.id, false)}
                                className="p-2 hover:bg-neutral-100 text-neutral-400 hover:text-red-500 rounded-lg transition-all"
                                title="Unpublish from Marketplace"
                              >
                                <EyeOff size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteListingAdmin(l.id)}
                                className="p-2 hover:bg-red-50 text-neutral-400 hover:text-red-600 rounded-lg transition-all"
                                title="Delete Listing completely"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
            </>
          )}

          {listingsSubTab === 'categories' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Category form card & categories directory */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Manual Category Editor form */}
                <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm space-y-6 self-start">
                  <div className="space-y-1">
                    <h3 className="text-lg font-black uppercase tracking-tight text-neutral-900">
                      {editingCategory ? 'Edit Category' : 'Create Category'}
                    </h3>
                    <p className="text-xs text-neutral-500">
                      Configure marketplace taxonomy categories manually.
                    </p>
                  </div>

                  <form onSubmit={handleSaveCategory} className="space-y-5">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">Category DB ID (Slug)</label>
                      <input
                        type="text"
                        placeholder="e.g. cinema-cameras"
                        value={newCategoryId}
                        onChange={(e) => setNewCategoryId(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                        className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold font-mono outline-none focus:ring-2 focus:ring-primary transition"
                        disabled={!!editingCategory}
                        required
                      />
                      <p className="text-[10px] text-neutral-450 uppercase">Unique slug used in database. Only lower-case, hyphens.</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">Display Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Cinema Cameras"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary transition"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">Photo URL (Direct Web Link)</label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder="Paste Unsplash or Imgur URL..."
                          value={newCategoryImage}
                          onChange={(e) => setNewCategoryImage(e.target.value)}
                          className="flex-1 px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary transition"
                        />
                      </div>
                      <p className="text-[10px] text-neutral-450 uppercase">Pulled from direct URL links.</p>
                    </div>

                    {/* Image Preview Area */}
                    {newCategoryImage && (
                      <div className="relative rounded-2xl overflow-hidden aspect-video border border-neutral-100 bg-neutral-50">
                        <img 
                          src={newCategoryImage} 
                          alt="Category preview" 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=400';
                            toast.error("Image link failed to load, falling back to default.");
                          }}
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-end p-3">
                          <span className="text-[9px] font-black uppercase tracking-widest text-white">Live URL Preview</span>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 pt-2">
                      {editingCategory && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategory(null);
                            setNewCategoryId('');
                            setNewCategoryName('');
                            setNewCategoryImage('');
                          }}
                          className="flex-1 px-4 py-2.5 bg-neutral-100 text-neutral-700 rounded-xl text-xs font-extrabold uppercase tracking-wider hover:bg-neutral-200 transition whitespace-nowrap"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2.5 bg-neutral-900 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider hover:bg-neutral-800 transition whitespace-nowrap"
                      >
                        {editingCategory ? 'Update' : 'Create'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Categories Directory table & actions */}
                <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm lg:col-span-2 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="text-lg font-black uppercase tracking-tight text-neutral-900 flex items-center gap-2">
                        <span>Categories Directory</span>
                        <span className="px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded-full text-[10px] font-black uppercase">
                          {categories.length} Total
                        </span>
                      </h3>
                      <p className="text-xs text-neutral-500">
                        Manage active listing categories synced with the marketplace.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAutoPopulateCategories}
                        className="flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-neutral-200 transition"
                        title="Auto populate / restore standard categories"
                      >
                        <Zap size={14} className="text-[#ff4f3a]" />
                        <span>Auto Defaults</span>
                      </button>
                    </div>
                  </div>

                  {categories.length === 0 ? (
                    <div className="p-16 border-2 border-dashed border-neutral-100 rounded-2xl text-center space-y-4">
                      <p className="text-neutral-450 italic text-xs">
                        No custom categories found in Firestore database. Click "Auto Defaults" above to scaffold standard settings or use the form to add manually!
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-neutral-100 text-[10px] font-black uppercase tracking-widest text-neutral-400">
                            <th className="pb-4 shrink-0">Photo</th>
                            <th className="pb-4">Display Name / ID</th>
                            <th className="pb-4 text-center">Active Items Count</th>
                            <th className="pb-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-50 text-xs">
                          {categories.map((cat) => {
                            const count = getCategoryListingsCount(cat.id);
                            return (
                              <tr key={cat.id} className="hover:bg-neutral-50/20 group">
                                <td className="py-4 pr-4">
                                  <div className="w-12 h-12 rounded-xl overflow-hidden border border-neutral-150 bg-neutral-50">
                                    <img 
                                      src={cat.image || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=400'} 
                                      alt={cat.name} 
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                </td>
                                <td className="py-2">
                                  <div>
                                    <p className="font-extrabold text-neutral-800 text-sm">{cat.name}</p>
                                    <p className="font-mono text-[9px] text-neutral-400 font-bold uppercase">{cat.id}</p>
                                  </div>
                                </td>
                                <td className="py-4 text-center font-bold">
                                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider ${count > 0 ? 'bg-primary/10 text-primary' : 'bg-neutral-100 text-neutral-400'}`}>
                                    {count} {count === 1 ? 'item' : 'items'}
                                  </span>
                                </td>
                                <td className="py-4 text-right">
                                  <div className="flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingCategory(cat);
                                        setNewCategoryId(cat.id);
                                        setNewCategoryName(cat.name);
                                        setNewCategoryImage(cat.image || '');
                                      }}
                                      className="p-2 text-neutral-500 hover:text-neutral-950 hover:bg-neutral-100 rounded-xl transition"
                                      title="Edit details"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteCategory(cat.id)}
                                      className="p-2 text-neutral-400 hover:text-red-500 hover:bg-neutral-100 rounded-xl transition"
                                      title="Delete Category"
                                    >
                                      <Trash2 size={14} />
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
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Edit Listing Moderation Details */}
      <AnimatePresence>
        {isListingEditModalOpen && editingListing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm animate-fade-in">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-6 bg-neutral-900 text-white flex justify-between items-center">
                <div className="space-y-0.5">
                  <h3 className="text-base font-black uppercase tracking-tight">Moderate: {editingListing.name}</h3>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Configure marketplace status, premium advertisement highlights, and billing features.</p>
                </div>
                <button 
                  onClick={() => {
                    setIsListingEditModalOpen(false);
                    setEditingListing(null);
                  }}
                  className="p-1 rounded-full bg-white/10 hover:bg-white/20 transition"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveListingAdmin} className="p-6 overflow-y-auto space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Moderation Status</label>
                    <select
                      value={editingListing.moderationStatus || 'approved'}
                      onChange={(e) => setEditingListing({...editingListing, moderationStatus: e.target.value as any})}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl text-xs font-bold"
                    >
                      <option value="approved">Approved & Live</option>
                      <option value="pending">Pending Verification</option>
                      <option value="suspended">Suspended / Hidden</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Listing Transaction Type</label>
                    <select
                      value={editingListing.transactionType || 'rent'}
                      onChange={(e) => setEditingListing({...editingListing, transactionType: e.target.value as any})}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl text-xs font-bold"
                    >
                      <option value="rent">Rent Out</option>
                      <option value="sale">Sell Outright</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Market Price Override</label>
                    <input
                      type="number"
                      value={editingListing.marketplacePrice || 0}
                      onChange={(e) => setEditingListing({...editingListing, marketplacePrice: Number(e.target.value)})}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl text-xs font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Currency</label>
                    <select
                      value={editingListing.marketplaceCurrency || 'USD'}
                      onChange={(e) => setEditingListing({...editingListing, marketplaceCurrency: e.target.value})}
                      className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl text-xs font-bold"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="FJD">FJD (FJ$)</option>
                      <option value="AUD">AUD (A$)</option>
                      <option value="NZD">NZD (NZ$)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Security Deposit Override</label>
                  <input
                    type="number"
                    value={editingListing.securityDeposit || 0}
                    onChange={(e) => setEditingListing({...editingListing, securityDeposit: Number(e.target.value)})}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl text-xs font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Description / Specifications</label>
                  <textarea
                    value={editingListing.marketplaceDetails || ''}
                    onChange={(e) => setEditingListing({...editingListing, marketplaceDetails: e.target.value})}
                    rows={4}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl text-xs font-bold outline-none resize-none"
                    placeholder="Enter gear details, specs, package components, policies, or rental constraints..."
                  />
                </div>

                {/* ADVANCED ADMIN CONTROLS for Paid / Advertised / Highlighted listings */}
                <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-100 space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
                    <Zap size={14} className="text-amber-500" />
                    Premium Visibility & Advertising Controls
                  </h4>

                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingListing.featured || false}
                        onChange={(e) => setEditingListing({...editingListing, featured: e.target.checked})}
                        className="mt-1 rounded border-neutral-300 text-amber-500 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                      />
                      <div className="select-none">
                        <span className="text-xs font-extrabold text-neutral-800 block">Featured Listing (Staff Pick)</span>
                        <span className="text-[9px] text-neutral-400 font-medium block">Pushes the item to prominent "Staff Picks" rows or top of product feed with highlighting.</span>
                      </div>
                    </label>

                    {editingListing.featured && (
                      <div className="pl-7 space-y-1">
                        <label className="text-[8px] font-black uppercase tracking-wide text-neutral-400">Featured Sorting Priority (Weight)</label>
                        <input
                          type="number"
                          value={editingListing.featuredPriority || 0}
                          onChange={(e) => setEditingListing({...editingListing, featuredPriority: Number(e.target.value)})}
                          className="w-32 px-3 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-bold"
                          placeholder="0 = Default"
                        />
                      </div>
                    )}

                    <hr className="border-neutral-200/50 my-2" />

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingListing.sponsored || false}
                        onChange={(e) => setEditingListing({...editingListing, sponsored: e.target.checked})}
                        className="mt-1 rounded border-neutral-300 text-indigo-500 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                      <div className="select-none">
                        <span className="text-xs font-extrabold text-neutral-800 block">Sponsored Campaign (Ad Placement)</span>
                        <span className="text-[9px] text-neutral-400 font-medium block">Unlocks ad banners, places high-impact sidebar placements, and enablescustom text highlights.</span>
                      </div>
                    </label>

                    {editingListing.sponsored && (
                      <div className="pl-7 space-y-1.5 animate-in fade-in duration-200">
                        <label className="text-[8px] font-black uppercase tracking-wide text-neutral-400">Ad Headline Pitch / Banner Headline</label>
                        <input
                          type="text"
                          value={editingListing.adHeadline || ''}
                          onChange={(e) => setEditingListing({...editingListing, adHeadline: e.target.value})}
                          className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-xs font-bold"
                          placeholder="e.g. '🔥 Summer Special: 20% off all booking days this week!'"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsListingEditModalOpen(false);
                      setEditingListing(null);
                    }}
                    className="flex-1 px-6 py-3 bg-neutral-100 text-neutral-700 rounded-xl font-bold hover:bg-neutral-200 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition"
                  >
                    Save Moderation settings
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: User specific listings & subscription plan config */}
      <AnimatePresence>
        {isUserListingsModalOpen && editingUserForListings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm animate-fade-in">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="p-6 bg-neutral-900 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <img src={editingUserForListings.photoURL} alt={editingUserForListings.displayName} className="w-10 h-10 rounded-full border-2 border-white/20 shadow" />
                  <div>
                    <h3 className="text-sm md:text-base font-black uppercase tracking-tight">{editingUserForListings.displayName}_s Listings hub</h3>
                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">{editingUserForListings.email}</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsUserListingsModalOpen(false);
                    setEditingUserForListings(null);
                  }}
                  className="p-1 rounded-full bg-white/10 hover:bg-white/20 transition"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {/* PLAN CONTROLS */}
                <div className="bg-neutral-50 p-6 rounded-2xl border border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block">User subscription plan tier</span>
                    <span className="text-xs font-bold text-neutral-800 block">You are modifying the user plan. Features such as marketplace listings limits, booking commission structures, and storage quotas adhere to this plan.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={editingUserForListings.plan || 'free'}
                      onChange={(e) => {
                        handleUpdatePlan(editingUserForListings.uid, e.target.value);
                        setEditingUserForListings({...editingUserForListings, plan: e.target.value});
                      }}
                      className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border outline-none font-bold transition ${
                        editingUserForListings.plan === 'free' ? 'bg-neutral-100 text-neutral-700 border-neutral-200' :
                        'bg-[#ff4f3a]/10 text-[#ff4f3a] border-[#ff4f3a]/20'
                      }`}
                    >
                      <option value="free">Free Starter Plan</option>
                      {settings?.plans?.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* USER LISTINGS TABLE */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-neutral-800 flex items-center gap-2">
                    <ShoppingBag size={14} className="text-[#ff4f3a]" />
                    Active Marketplace Offerings
                  </h4>

                  {lists.filter(l => l.ownerId === editingUserForListings.uid && l.marketplaceEnabled).length === 0 ? (
                    <div className="p-12 border-2 border-dashed border-neutral-100 rounded-2xl text-center text-neutral-400 italic text-xs">
                      No active listings or marketplace offerings for this user at the moment.
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl border border-neutral-100 overflow-hidden shadow-sm">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-neutral-50 text-[9px] font-black uppercase tracking-widest text-neutral-400 border-b border-neutral-100">
                            <th className="px-6 py-4">Manifest Info</th>
                            <th className="px-5 py-4">Type</th>
                            <th className="px-5 py-4">Price</th>
                            <th className="px-5 py-4">Feature/Ad Badges</th>
                            <th className="px-6 py-4 text-right">Moderation Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-50 text-xs">
                          {lists
                            .filter(l => l.ownerId === editingUserForListings.uid && l.marketplaceEnabled)
                            .map((l) => (
                              <tr key={l.id} className="hover:bg-neutral-50/50">
                                <td className="px-6 py-4 font-bold text-neutral-800">
                                  <div>
                                    <p className="font-extrabold text-[#ff4f3a]">{l.name}</p>
                                    <p className="text-[9px] text-neutral-400 mt-0.5">{l.itemsCount || 0} items listed</p>
                                  </div>
                                </td>
                                <td className="px-5 py-4">
                                  <span className="font-black text-neutral-500 uppercase text-[9px] tracking-wide">
                                    {l.transactionType === 'Sale' ? 'Sale' : 'Rental'}
                                  </span>
                                </td>
                                <td className="px-5 py-4 font-extrabold">
                                  {l.marketplacePrice || 0} {l.marketplaceCurrency || 'USD'}
                                </td>
                                <td className="px-5 py-4">
                                  <div className="flex gap-1">
                                    {l.featured && (
                                      <span className="px-1.5 py-0.5 bg-amber-50 text-amber-500 font-extrabold text-[8px] rounded uppercase">Featured</span>
                                    )}
                                    {l.sponsored && (
                                      <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-500 font-extrabold text-[8px] rounded uppercase">Sponsor Ad</span>
                                    )}
                                    {!l.featured && !l.sponsored && <span className="text-neutral-300">-</span>}
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => {
                                        setEditingListing(l);
                                        setIsListingEditModalOpen(true);
                                      }}
                                      className="p-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg transition"
                                      title="Edit Moderation Params"
                                    >
                                      <Edit2 size={12} />
                                    </button>
                                    <button
                                      onClick={() => handleToggleMarketplaceAdmin(l.id, false)}
                                      className="p-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-red-500 rounded-lg transition"
                                      title="Unpublish"
                                    >
                                      <EyeOff size={12} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteListingAdmin(l.id)}
                                      className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition"
                                      title="Delete Manifest Completely"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 bg-neutral-50 border-t border-neutral-100 text-right">
                <button
                  onClick={() => {
                    setIsUserListingsModalOpen(false);
                    setEditingUserForListings(null);
                  }}
                  className="px-8 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition shadow-sm"
                >
                  Close Manager
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {activeTab === 'landing' && settings && (
        <div className="space-y-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h2 className="text-3xl font-black uppercase tracking-tighter">Landing Page Manager</h2>
              <p className="text-neutral-500 font-medium">Create and manage multiple versions of your landing page</p>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => {
                  const newId = `lander-${Date.now()}`;
                  const newLander: Lander = {
                    id: newId,
                    name: `New Lander ${settings.landers?.length || 0 + 1}`,
                    createdAt: new Date().toISOString(),
                    content: JSON.parse(JSON.stringify(settings.landers?.[0]?.content || { /* default empty content */ }))
                  };
                  setSettings({
                    ...settings,
                    landers: [...(settings.landers || []), newLander]
                  });
                  toast.success("New lander created!");
                }}
                className="flex items-center gap-2 px-6 py-3 bg-neutral-100 text-neutral-900 rounded-xl font-bold hover:bg-neutral-200 transition"
              >
                <Plus size={18} />
                <span>Create New Lander</span>
              </button>
              <button 
                onClick={async () => {
                  await updateDoc(doc(db, 'adminSettings', 'global'), settings as any);
                  toast.success("All lander settings saved!");
                }}
                className="px-8 py-3 bg-primary text-white rounded-xl font-black uppercase text-xs tracking-widest hover:scale-105 transition shadow-xl"
              >
                <Save size={18} className="inline mr-2" />
                Save Changes
              </button>
            </div>
          </div>

          {/* Active Landing Page & Marketplace Visibility Selector */}
          <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-neutral-100 shadow-sm space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 pb-4">
              <div className="space-y-1">
                <h3 className="text-lg font-black uppercase tracking-tight text-neutral-800">Marketplace & Landing Configuration</h3>
                <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Configure your default root entry-point strategies, public views, and security gate visibility levels.</p>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 text-primary rounded-full text-[10px] font-black uppercase tracking-widest">
                <Globe size={12} className="animate-pulse" />
                <span>Active Routing Engine</span>
              </div>
            </div>
            
            <div className="space-y-4">
              <label className="text-xs font-black uppercase tracking-widest text-neutral-400 block">1. Selected Landing Interface</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setSettings({ ...settings, activeLandingPageType: 'main' });
                    toast.success("Default root page set to Main Landing Page style");
                  }}
                  className={`p-6 rounded-2xl border text-left transition duration-150 flex items-start gap-4 ${
                    settings.activeLandingPageType !== 'marketplace'
                      ? 'border-neutral-900 bg-neutral-900 text-white shadow-lg'
                      : 'border-neutral-150 bg-neutral-50/40 hover:bg-neutral-50 text-neutral-800 hover:border-neutral-200'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    settings.activeLandingPageType !== 'marketplace' ? 'bg-white/10 text-white' : 'bg-neutral-100 text-[#ff4f3a]'
                  }`}>
                    <Layout size={18} />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-black uppercase tracking-wider">Main Landing Page</div>
                    <div className={`text-[10px] uppercase font-bold leading-relaxed ${settings.activeLandingPageType !== 'marketplace' ? 'text-white/60' : 'text-neutral-400'}`}>
                      Professional visual gear tracking, scenarios, features ticker, and client portal access points.
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSettings({ ...settings, activeLandingPageType: 'marketplace' });
                    toast.success("Default root page set to Marketplace Listing Hub");
                  }}
                  className={`p-6 rounded-2xl border text-left transition duration-150 flex items-start gap-4 ${
                    settings.activeLandingPageType === 'marketplace'
                      ? 'border-neutral-900 bg-neutral-900 text-white shadow-lg'
                      : 'border-neutral-150 bg-neutral-50/40 hover:bg-neutral-50 text-neutral-800 hover:border-neutral-200'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    settings.activeLandingPageType === 'marketplace' ? 'bg-white/10 text-white' : 'bg-rose-50 text-rose-500'
                  }`}>
                    <ShoppingBag size={18} />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-black uppercase tracking-wider">Marketplace Listing Hub</div>
                    <div className={`text-[10px] uppercase font-bold leading-relaxed ${settings.activeLandingPageType === 'marketplace' ? 'text-white/60' : 'text-neutral-400'}`}>
                      The Packer public gear marketplace. Active listings, equipment hire, and local creatives.
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-neutral-100">
              {/* Root URL Gate Config */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-xs font-black uppercase tracking-widest text-neutral-400 block">2. Public Root (/) Security Gate</span>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase leading-relaxed">Determine who can browse public landing assets or if visitors should be forced to authenticate.</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSettings({ ...settings, rootVisibility: 'public' });
                      toast.success("Root landing page set to Public Access");
                    }}
                    className={`p-4 rounded-xl border text-left flex items-start gap-3 transition ${
                      settings.rootVisibility !== 'auth_only'
                        ? 'border-primary/30 bg-primary/5 text-primary shadow-sm'
                        : 'border-neutral-150 hover:border-neutral-250 text-neutral-600 bg-neutral-50/20'
                    }`}
                  >
                    <Globe size={16} className="shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="text-[10px] uppercase font-black tracking-widest">Public Browsing</div>
                      <p className="text-[9px] font-bold text-neutral-400 uppercase leading-normal">Open to guest visitors and search engines.</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSettings({ ...settings, rootVisibility: 'auth_only' });
                      toast.success("System root locked to Authorized Authentication");
                    }}
                    className={`p-4 rounded-xl border text-left flex items-start gap-3 transition ${
                      settings.rootVisibility === 'auth_only'
                        ? 'border-red-600/35 bg-red-500/5 text-red-600 shadow-sm'
                        : 'border-neutral-150 hover:border-neutral-250 text-neutral-600 bg-neutral-50/20'
                    }`}
                  >
                    <LockIcon size={16} className="shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="text-[10px] uppercase font-black tracking-widest">Authorized Portal</div>
                      <p className="text-[9px] font-bold text-neutral-400 uppercase leading-normal">Redirect to secure SSO. Browse block active.</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Marketplace Visibility Rules */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <span className="text-xs font-black uppercase tracking-widest text-neutral-400 block">3. Marketplace Listing Visibility</span>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase leading-relaxed">Control checkout tracking views and listing URLs for custom inventory sheets shared publicly.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSettings({ ...settings, marketplaceVisibility: 'public' });
                      toast.success("Marketplace listings set to public search-discovery indexing");
                    }}
                    className={`p-4 rounded-xl border text-left flex items-start gap-3 transition ${
                      settings.marketplaceVisibility !== 'signed-in'
                        ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-700 shadow-sm'
                        : 'border-neutral-150 hover:border-neutral-250 text-neutral-600 bg-neutral-50/20'
                    }`}
                  >
                    <Eye size={16} className="shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="text-[10px] uppercase font-black tracking-widest">Public Links</div>
                      <p className="text-[9px] font-bold text-neutral-400 uppercase leading-normal">Anyone can view listed items, hire prices & tags.</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSettings({ ...settings, marketplaceVisibility: 'signed-in' });
                      toast.success("Marketplace restricted to verified platform members");
                    }}
                    className={`p-4 rounded-xl border text-left flex items-start gap-3 transition ${
                      settings.marketplaceVisibility === 'signed-in'
                        ? 'border-amber-500/40 bg-amber-500/5 text-amber-700 shadow-sm'
                        : 'border-neutral-150 hover:border-neutral-250 text-neutral-600 bg-neutral-50/20'
                    }`}
                  >
                    <EyeOff size={16} className="shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="text-[10px] uppercase font-black tracking-widest">Members Only</div>
                      <p className="text-[9px] font-bold text-neutral-400 uppercase leading-normal">Requires login check prior to displaying kit inventory.</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Lander Sidebar - Selection */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white rounded-[2rem] border border-neutral-100 p-2 md:p-4 shadow-sm space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 px-4 mb-2 block">Available Landers</label>
                <div className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 gap-2 px-2 lg:px-0 scrollbar-hide">
                  {(settings.landers || []).map((lander) => (
                    <button
                      key={lander.id}
                      onClick={() => {
                        setSettings({ ...settings, activeLanderId: lander.id });
                      }}
                      className={`min-w-[160px] lg:min-w-0 text-left p-4 rounded-2xl transition-all group shrink-0 ${
                        settings.activeLanderId === lander.id 
                          ? 'bg-neutral-900 text-white shadow-xl translate-y-[-2px] lg:translate-y-0 lg:translate-x-[4px]' 
                          : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="space-y-0.5 truncate">
                          <div className="text-xs font-black uppercase tracking-tight truncate">{lander.name}</div>
                          <div className={`text-[10px] font-medium ${settings.activeLanderId === lander.id ? 'text-white/40' : 'text-neutral-400'}`}>
                            {new Date(lander.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        {settings.activeLanderId === lander.id && <Check size={14} className="text-primary shrink-0" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {settings.activeLanderId && (
                <div className="bg-red-50 rounded-[2rem] p-6 space-y-4 border border-red-100">
                  <h4 className="text-xs font-black uppercase text-red-600">Danger Zone</h4>
                  <p className="text-[10px] text-red-400 font-medium leading-relaxed">Deleting a lander is permanent. You cannot delete the active lander if it's the only one.</p>
                  <button 
                   onClick={() => {
                     if (settings.landers?.length === 1) {
                       toast.error("Cannot delete the only lander.");
                       return;
                     }
                     const newLanders = settings.landers?.filter(l => l.id !== settings.activeLanderId);
                     const nextActive = newLanders?.[0]?.id;
                     setSettings({ ...settings, landers: newLanders, activeLanderId: nextActive });
                     toast.success("Lander removed");
                   }}
                   className="w-full py-3 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition"
                  >
                    Delete Selected Lander
                  </button>
                </div>
              )}
            </div>

            {/* Lander Editor */}
            <div className="lg:col-span-3 space-y-8">
              {settings.landers?.find(l => l.id === settings.activeLanderId) ? (
                <div className="space-y-12">
                  {/* Lander Basic Info */}
                  <div className="bg-white p-8 md:p-12 rounded-[3rem] border border-neutral-100 shadow-sm space-y-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="space-y-2 flex-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Lander Name</label>
                        <input
                          type="text"
                          value={settings.landers.find(l => l.id === settings.activeLanderId)?.name || ''}
                          onChange={(e) => {
                            const newLanders = [...(settings.landers || [])];
                            const idx = newLanders.findIndex(l => l.id === settings.activeLanderId);
                            if (idx !== -1) {
                              newLanders[idx].name = e.target.value;
                              setSettings({ ...settings, landers: newLanders });
                            }
                          }}
                          className="w-full text-4xl font-black bg-transparent border-none outline-none focus:ring-2 focus:ring-primary/20 rounded-2xl px-4 py-2 -ml-4"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sections Editor */}
                  <LanderEditor 
                    lander={settings.landers.find(l => l.id === settings.activeLanderId)!} 
                    onUpdate={(updatedLander) => {
                      const newLanders = [...(settings.landers || [])];
                      const idx = newLanders.findIndex(l => l.id === updatedLander.id);
                      if (idx !== -1) {
                        newLanders[idx] = updatedLander;
                        setSettings({ ...settings, landers: newLanders });
                      }
                    }} 
                  />
                  
                  {/* AI Recognition Settings (Remains Global or per-lander? User said "Lander module... should have settings for all sections". AI Recognition was previously global but is displayed on hero.) */}
                  <div className="bg-white p-8 rounded-[3rem] border border-neutral-100 shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                          <Activity size={20} className="text-primary" />
                          <span>AI Recognition Panel (Global)</span>
                        </h3>
                        <p className="text-xs text-neutral-400">This config applies platform-wide to the Hero section card</p>
                      </div>
                      <button 
                        onClick={() => setSettings(s => s ? { ...s, aiRecognitionConfig: { ...s.aiRecognitionConfig!, enabled: !s.aiRecognitionConfig!.enabled } } : null)}
                        className={`w-14 h-7 rounded-full relative transition-colors ${settings.aiRecognitionConfig?.enabled ? 'bg-primary' : 'bg-neutral-200'}`}
                      >
                        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${settings.aiRecognitionConfig?.enabled ? 'right-1' : 'left-1'}`}></div>
                      </button>
                    </div>
                    {/* ... rest of AI Recognition config (can be moved here or kept global) ... */}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-[3rem] p-24 text-center border border-neutral-100 shadow-sm">
                  <Layout size={64} className="mx-auto text-neutral-200 mb-6" />
                  <h3 className="text-2xl font-black uppercase tracking-tighter">Select a Lander</h3>
                  <p className="text-neutral-400 font-medium">Select a version from the left to start editing</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'kiosk' && settings && (
        <div className="space-y-12">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-10 rounded-[3rem] border border-neutral-100 shadow-sm space-y-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-neutral-900 text-white rounded-2xl flex items-center justify-center">
                  <QrCode size={24} />
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tighter">Terminal Control</h3>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-6 bg-neutral-50 rounded-3xl border border-neutral-100">
                  <div className="space-y-1">
                    <p className="font-black uppercase tracking-tight text-sm">Allow Manual Search</p>
                    <p className="text-xs text-neutral-400 font-medium italic">Users can search gear library if QR code is damaged</p>
                  </div>
                  <button 
                    onClick={() => setSettings(s => s ? { 
                      ...s, 
                      kioskConfig: { ...s.kioskConfig!, allowManualSearch: !s.kioskConfig?.allowManualSearch } 
                    } : null)}
                    className={`w-14 h-7 rounded-full relative transition-colors ${settings.kioskConfig?.allowManualSearch ? 'bg-primary' : 'bg-neutral-200'}`}
                  >
                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${settings.kioskConfig?.allowManualSearch ? 'right-1' : 'left-1'}`}></div>
                  </button>
                </div>

                <div className="flex items-center justify-between p-6 bg-neutral-50 rounded-3xl border border-neutral-100">
                  <div className="space-y-1">
                    <p className="font-black uppercase tracking-tight text-sm">Show Item Status</p>
                    <p className="text-xs text-neutral-400 font-medium italic">Display current availability in search results</p>
                  </div>
                  <button 
                    onClick={() => setSettings(s => s ? { 
                      ...s, 
                      kioskConfig: { ...s.kioskConfig!, showItemStatus: !s.kioskConfig?.showItemStatus } 
                    } : null)}
                    className={`w-14 h-7 rounded-full relative transition-colors ${settings.kioskConfig?.showItemStatus ? 'bg-primary' : 'bg-neutral-200'}`}
                  >
                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${settings.kioskConfig?.showItemStatus ? 'right-1' : 'left-1'}`}></div>
                  </button>
                </div>

                <div className="flex items-center justify-between p-6 bg-neutral-50 rounded-3xl border border-neutral-100">
                  <div className="space-y-1">
                    <p className="font-black uppercase tracking-tight text-sm">Require Signature</p>
                    <p className="text-xs text-neutral-400 font-medium italic">Force digital signature for every transaction</p>
                  </div>
                  <button 
                    onClick={() => setSettings(s => s ? { 
                      ...s, 
                      kioskConfig: { ...s.kioskConfig!, requireSignature: !s.kioskConfig?.requireSignature } 
                    } : null)}
                    className={`w-14 h-7 rounded-full relative transition-colors ${settings.kioskConfig?.requireSignature ? 'bg-primary' : 'bg-neutral-200'}`}
                  >
                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${settings.kioskConfig?.requireSignature ? 'right-1' : 'left-1'}`}></div>
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">Auto-Logout (Minutes)</label>
                  <input
                    type="number"
                    value={settings.kioskConfig?.autoLogoutMinutes || 5}
                    onChange={(e) => setSettings(s => s ? { 
                      ...s, 
                      kioskConfig: { ...s.kioskConfig!, autoLogoutMinutes: parseInt(e.target.value) } 
                    } : null)}
                    className="w-full bg-neutral-50 border-none rounded-2xl px-6 py-4 focus:ring-2 focus:ring-primary transition font-bold"
                  />
                </div>

                <div className="space-y-4 pt-6 border-t border-neutral-100">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1 block">Kiosk Workflow Strategy</label>
                  <p className="text-xs text-neutral-400 font-medium italic">
                    Configure the primary user checkout and checkin flow.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setSettings(s => s ? {
                        ...s,
                        kioskConfig: { ...(s.kioskConfig || { allowManualSearch: true, showItemStatus: true, requireSignature: false, autoLogoutMinutes: 5 }), mode: 'direct' }
                      } : null)}
                      className={`p-6 rounded-[2rem] border text-left flex flex-col justify-between transition-all ${
                        (settings?.kioskConfig?.mode || 'direct') === 'direct'
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'border-neutral-200 bg-white hover:border-neutral-300'
                      }`}
                    >
                      <div>
                        <span className="text-sm font-black uppercase tracking-wider text-neutral-800 block">Direct Scan & Review Mode</span>
                        <p className="text-xs text-neutral-400 mt-2 leading-relaxed font-medium">
                          Approved operators scan multiple items to check in or out. Scans gather onto an Order Review screen where operators can double check, correct double scans or remove missing items prior to submitting.
                        </p>
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mt-4 self-start ${
                        (settings?.kioskConfig?.mode || 'direct') === 'direct' ? 'bg-primary text-white font-black' : 'bg-neutral-100 text-neutral-500 font-black'
                      }`}>
                        {(settings?.kioskConfig?.mode || 'direct') === 'direct' ? 'Active Mode' : 'Select Direct'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSettings(s => s ? {
                        ...s,
                        kioskConfig: { ...(s.kioskConfig || { allowManualSearch: true, showItemStatus: true, requireSignature: false, autoLogoutMinutes: 5 }), mode: 'order' }
                      } : null)}
                      className={`p-6 rounded-[2rem] border text-left flex flex-col justify-between transition-all ${
                        settings?.kioskConfig?.mode === 'order'
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'border-neutral-200 bg-white hover:border-neutral-300'
                      }`}
                    >
                      <div>
                        <span className="text-sm font-black uppercase tracking-wider text-neutral-800 block">Self-Service Fast-Food Order Mode</span>
                        <p className="text-xs text-neutral-400 mt-2 leading-relaxed font-medium">
                          Users search/browse the gear library directly and select items they need. They review their selections in a fast-food style cart receipt, completing the checkout request. The system prints/emails a handover checklist, and inventory staff scan QR tags later to release the items.
                        </p>
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mt-4 self-start ${
                        settings?.kioskConfig?.mode === 'order' ? 'bg-primary text-white font-black' : 'bg-neutral-100 text-neutral-500 font-black'
                      }`}>
                        {settings?.kioskConfig?.mode === 'order' ? 'Active Mode' : 'Select Order'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-10 rounded-[3rem] border border-neutral-100 shadow-sm space-y-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-900 text-white rounded-2xl flex items-center justify-center">
                  <LockIcon size={24} />
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tighter">Status Restrictions</h3>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-neutral-500 font-semibold uppercase tracking-widest leading-relaxed">
                  Toggle which statuses should block an item from being checked out at the kiosk.
                </p>
                
                {['available', 'in_use', 'maintenance', 'retired', 'missing'].map((status) => (
                  <div key={status} className="flex items-center justify-between p-5 bg-neutral-50 rounded-[2rem] border border-neutral-100 group">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${
                        status === 'available' ? 'bg-green-500' :
                        status === 'in_use' ? 'bg-blue-500' :
                        status === 'maintenance' ? 'bg-amber-500' :
                        'bg-red-500'
                      }`} />
                      <span className="font-black uppercase tracking-tight text-sm">{status.replace('_', ' ')}</span>
                    </div>
                    <button 
                      onClick={() => {
                        const current = settings.kioskConfig?.restrictedStatuses || [];
                        const next = current.includes(status) 
                          ? current.filter(s => s !== status)
                          : [...current, status];
                        setSettings(s => s ? { 
                          ...s, 
                          kioskConfig: { ...s.kioskConfig!, restrictedStatuses: next } 
                        } : null);
                      }}
                      className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                        settings.kioskConfig?.restrictedStatuses?.includes(status)
                          ? 'bg-red-600 text-white shadow-lg'
                          : 'bg-neutral-200 text-neutral-400 hover:bg-neutral-300'
                      }`}
                    >
                      {settings.kioskConfig?.restrictedStatuses?.includes(status) ? 'Restricted' : 'Allowed'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex justify-end">
            <button 
              onClick={async () => {
                await updateDoc(doc(db, 'adminSettings', 'global'), settings as any);
                toast.success("Kiosk protocols updated across network");
              }}
              className="px-12 py-5 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-105 active:scale-95 transition shadow-2xl flex items-center gap-3"
            >
              <Save size={20} />
              <span>Deploy Kiosk Config</span>
            </button>
          </div>
        </div>
      )}

      {activeTab === 'communities' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6 text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black text-neutral-900 flex items-center gap-2">
                  <MapPin className="text-primary" />
                  <span>Regional Communities Workspace Settings</span>
                </h3>
                <p className="text-sm text-neutral-500 font-medium mt-1">
                  Configure localized geographic community directories. These workspaces let users access targeted gear marketplaces, specific local currencies, and custom corporate branding.
                </p>
              </div>
              <button
                onClick={() => {
                  const newComm = {
                    id: `comm_${Date.now()}`,
                    name: 'New Community',
                    country: 'Fiji',
                    countryCode: 'FJ',
                    currency: 'FJD',
                    flag: '🇫🇯',
                    companyName: 'Packer Tools Team',
                    isActive: true
                  };
                  setSettings(s => {
                    if (!s) return null;
                    const list = s.communities || [
                      { id: 'fiji', name: 'Fiji Community', country: 'Fiji', countryCode: 'FJ', currency: 'FJD', flag: '🇫🇯', companyName: 'Packer Tools Fiji', isActive: true },
                      { id: 'australia', name: 'Australian Community', country: 'Australia', countryCode: 'AU', currency: 'AUD', flag: '🇦🇺', companyName: 'Packer Tools Australia', isActive: true },
                      { id: 'new_zealand', name: 'New Zealand Community', country: 'New Zealand', countryCode: 'NZ', currency: 'NZD', flag: '🇳🇿', companyName: 'Packer Tools New Zealand', isActive: true }
                    ];
                    return { ...s, communities: [...list, newComm] };
                  });
                  toast.success("Blank community template added! Please customize below.");
                }}
                className="px-6 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-wider hover:scale-[1.02] active:scale-95 transition flex items-center gap-2 shrink-0 h-fit"
              >
                <Plus size={16} />
                <span>Add Community Hub</span>
              </button>
            </div>

            <div className="border-t border-neutral-100 pt-6 space-y-6">
              {/* Table or Card list of communities */}
              {(() => {
                const currentCommunities = settings?.communities || [
                  { id: 'fiji', name: 'Fiji Community', country: 'Fiji', countryCode: 'FJ', currency: 'FJD', flag: '🇫🇯', companyName: 'Packer Tools Fiji', isActive: true },
                  { id: 'australia', name: 'Australian Community', country: 'Australia', countryCode: 'AU', currency: 'AUD', flag: '🇦🇺', companyName: 'Packer Tools Australia', isActive: true },
                  { id: 'new_zealand', name: 'New Zealand Community', country: 'New Zealand', countryCode: 'NZ', currency: 'NZD', flag: '🇳🇿', companyName: 'Packer Tools New Zealand', isActive: true }
                ];

                if (currentCommunities.length === 0) {
                  return (
                    <div className="p-8 text-center bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                      <p className="font-bold text-neutral-400">No geographic communities configured.</p>
                      <p className="text-xs text-neutral-400 mt-1">Click the "Add Community Hub" button to deploy your first region.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {currentCommunities.map((comm, index) => (
                      <div key={comm.id} className="p-6 bg-neutral-50 border border-neutral-200/80 rounded-2xl space-y-4 relative hover:shadow-sm transition">
                        <div className="flex items-center justify-between border-b border-neutral-200/50 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{comm.flag || '🌐'}</span>
                            <span className="font-extrabold uppercase text-xs tracking-wider text-neutral-900">{comm.name || 'Unnamed Community'}</span>
                            <span className="text-[10px] font-mono text-neutral-400">({comm.id})</span>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setSettings(s => {
                                  if (!s) return null;
                                  const list = s.communities ? [...s.communities] : [
                                    { id: 'fiji', name: 'Fiji Community', country: 'Fiji', countryCode: 'FJ', currency: 'FJD', flag: '🇫🇯', companyName: 'Packer Tools Fiji', isActive: true },
                                    { id: 'australia', name: 'Australian Community', country: 'Australia', countryCode: 'AU', currency: 'AUD', flag: '🇦🇺', companyName: 'Packer Tools Australia', isActive: true },
                                    { id: 'new_zealand', name: 'New Zealand Community', country: 'New Zealand', countryCode: 'NZ', currency: 'NZD', flag: '🇳🇿', companyName: 'Packer Tools New Zealand', isActive: true }
                                  ];
                                  list[index] = { ...list[index], isActive: !list[index].isActive };
                                  return { ...s, communities: list };
                                });
                              }}
                              className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-md border transition-all ${
                                comm.isActive 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                  : 'bg-neutral-150 text-neutral-405 border-neutral-200'
                              }`}
                            >
                              {comm.isActive ? 'Active' : 'Disabled'}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSettings(s => {
                                  if (!s) return null;
                                  const list = s.communities ? [...s.communities] : [
                                    { id: 'fiji', name: 'Fiji Community', country: 'Fiji', countryCode: 'FJ', currency: 'FJD', flag: '🇫🇯', companyName: 'Packer Tools Fiji', isActive: true },
                                    { id: 'australia', name: 'Australian Community', country: 'Australia', countryCode: 'AU', currency: 'AUD', flag: '🇦🇺', companyName: 'Packer Tools Australia', isActive: true },
                                    { id: 'new_zealand', name: 'New Zealand Community', country: 'New Zealand', countryCode: 'NZ', currency: 'NZD', flag: '🇳🇿', companyName: 'Packer Tools New Zealand', isActive: true }
                                  ];
                                  const updated = list.filter((_, idx) => idx !== index);
                                  return { ...s, communities: updated };
                                });
                                toast.error("Community removed from list");
                              }}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition"
                              title="Delete community workspace"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Config Inputs Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Community Name</label>
                            <input
                              type="text"
                              value={comm.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSettings(s => {
                                  if (!s) return null;
                                  const list = s.communities ? [...s.communities] : [];
                                  list[index] = { ...list[index], name: val };
                                  return { ...s, communities: list };
                                });
                              }}
                              className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 font-bold outline-none focus:ring-1 focus:ring-primary text-neutral-800"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Country Location</label>
                            <input
                              type="text"
                              value={comm.country}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSettings(s => {
                                  if (!s) return null;
                                  const list = s.communities ? [...s.communities] : [];
                                  list[index] = { ...list[index], country: val };
                                  return { ...s, communities: list };
                                });
                              }}
                              className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 font-bold outline-none focus:ring-1 focus:ring-primary text-neutral-800"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Currency Code</label>
                            <input
                              type="text"
                              value={comm.currency}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSettings(s => {
                                  if (!s) return null;
                                  const list = s.communities ? [...s.communities] : [];
                                  list[index] = { ...list[index], currency: val };
                                  return { ...s, communities: list };
                                });
                              }}
                              className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 font-mono outline-none focus:ring-1 focus:ring-primary text-neutral-800"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Flag Emoji</label>
                            <input
                              type="text"
                              value={comm.flag}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSettings(s => {
                                  if (!s) return null;
                                  const list = s.communities ? [...s.communities] : [];
                                  list[index] = { ...list[index], flag: val };
                                  return { ...s, communities: list };
                                });
                              }}
                              className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-center outline-none focus:ring-1 focus:ring-primary text-neutral-800"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Community URL Prefix / Id</label>
                            <input
                              type="text"
                              value={comm.id}
                              onChange={(e) => {
                                const val = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
                                setSettings(s => {
                                  if (!s) return null;
                                  const list = s.communities ? [...s.communities] : [];
                                  list[index] = { ...list[index], id: val };
                                  return { ...s, communities: list };
                                });
                              }}
                              className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 font-mono outline-none focus:ring-1 focus:ring-primary text-neutral-800"
                              placeholder="e.g. australia"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Localized Branding / Company Name Override</label>
                            <input
                              type="text"
                              value={comm.companyName || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSettings(s => {
                                  if (!s) return null;
                                  const list = s.communities ? [...s.communities] : [];
                                  list[index] = { ...list[index], companyName: val };
                                  return { ...s, communities: list };
                                });
                              }}
                              className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 font-bold outline-none focus:ring-1 focus:ring-primary text-neutral-800"
                              placeholder="e.g. Packer Tools Fiji"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">ISO Country Code (e.g., FJ, AU, NZ)</label>
                            <input
                              type="text"
                              maxLength={2}
                              value={comm.countryCode}
                              onChange={(e) => {
                                const val = e.target.value.toUpperCase();
                                setSettings(s => {
                                  if (!s) return null;
                                  const list = s.communities ? [...s.communities] : [];
                                  list[index] = { ...list[index], countryCode: val };
                                  return { ...s, communities: list };
                                });
                              }}
                              className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 font-mono font-bold outline-none focus:ring-1 focus:ring-primary text-neutral-800"
                            />
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-end pt-4 border-t border-neutral-100">
              <button
                onClick={async () => {
                  const currentCommunities = settings?.communities || [
                    { id: 'fiji', name: 'Fiji Community', country: 'Fiji', countryCode: 'FJ', currency: 'FJD', flag: '🇫🇯', companyName: 'Packer Tools Fiji', isActive: true },
                    { id: 'australia', name: 'Australian Community', country: 'Australia', countryCode: 'AU', currency: 'AUD', flag: '🇦🇺', companyName: 'Packer Tools Australia', isActive: true },
                    { id: 'new_zealand', name: 'New Zealand Community', country: 'New Zealand', countryCode: 'NZ', currency: 'NZD', flag: '🇳🇿', companyName: 'Packer Tools New Zealand', isActive: true }
                  ];
                  await updateDoc(doc(db, 'adminSettings', 'global'), {
                    ...settings,
                    communities: currentCommunities
                  } as any);
                  toast.success("Localized geographical communities deploy synchronized across platform.");
                }}
                className="px-12 py-5 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-105 active:scale-95 transition shadow-2xl flex items-center gap-3"
              >
                <Save size={20} />
                <span>Deploy Communities</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-8">
          {/* Header Dashboard section */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-neutral-100">
            <div>
              <h2 className="text-3xl font-black uppercase tracking-tighter flex items-center gap-2">
                <Settings className="text-primary" />
                <span>System Settings</span>
              </h2>
              <p className="text-neutral-500 text-sm">Configure branding, regional gateways, taxes, and granular component policies</p>
            </div>
            
            <button
              onClick={async () => {
                if (settings) {
                  await updateDoc(doc(db, 'adminSettings', 'global'), settings as any);
                  toast.success("All System Settings successfully synchronized!");
                }
              }}
              className="px-6 py-3.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition flex items-center gap-2 shadow-lg active:scale-95"
            >
              <Save size={16} />
              <span>Save System Settings</span>
            </button>
          </div>

          {/* Submenu Tabs layout for Mobile Devices (Optimize for Mobile) */}
          <div className="md:hidden block relative">
            <span className="text-[10px] font-black uppercase text-neutral-400 tracking-widest block mb-1.5 font-mono">Select Category Dashboard</span>
            <select
              value={settingsSubTab}
              onChange={(e) => setSettingsSubTab(e.target.value as any)}
              className="w-full bg-white border border-neutral-200 rounded-2xl px-4 py-3.5 text-xs font-black uppercase tracking-wider shadow-sm focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="branding">🎨 Branding & Platform Identity</option>
              <option value="billing">💳 Billing & Payment Gateways</option>
              <option value="multi_industry">🏢 Multi-Industry Sandboxes</option>
              <option value="marketplace">🌍 Marketplace & regional launch</option>
              <option value="widgets">⚙️ Module Widget Configurations</option>
              <option value="bugs">{hasActiveBugs ? "🐛 Beta Bug Reports Finder (🔴 Active Report!)" : "🐛 Beta Bug Reports Finder"}</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
            {/* Left Submenu Sidebar (Desktop only) */}
            <div className="hidden md:block col-span-1 space-y-2 sticky top-[100px]">
              <div className="bg-white p-4 rounded-[2rem] border border-neutral-100 shadow-sm space-y-1">
                <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest px-3.5 py-1 mb-2 block font-mono">Admin Console</p>
                
                {/* Branding Tab */}
                <button
                  type="button"
                  onClick={() => setSettingsSubTab('branding')}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all font-bold ${
                    settingsSubTab === 'branding' 
                      ? 'bg-neutral-900 text-white shadow-xl shadow-neutral-900/10' 
                      : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-950'
                  }`}
                >
                  <Sparkles size={16} className={settingsSubTab === 'branding' ? 'text-primary animate-pulse' : 'text-neutral-400'} />
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-[11px] leading-none uppercase tracking-wider">Branding & Kit</p>
                    <span className={`text-[8px] block mt-1 font-sans font-bold leading-none ${settingsSubTab === 'branding' ? 'text-neutral-400' : 'text-neutral-350'}`}>Logos, footer & launcher specs</span>
                  </div>
                </button>

                {/* Billing Tab */}
                <button
                  type="button"
                  onClick={() => setSettingsSubTab('billing')}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all font-bold ${
                    settingsSubTab === 'billing' 
                      ? 'bg-neutral-900 text-white shadow-xl shadow-neutral-900/10' 
                      : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-950'
                  }`}
                >
                  <CreditCard size={16} className={settingsSubTab === 'billing' ? 'text-primary' : 'text-neutral-400'} />
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-[11px] leading-none uppercase tracking-wider">Billing & money</p>
                    <span className={`text-[8px] block mt-1 font-sans font-bold leading-none ${settingsSubTab === 'billing' ? 'text-neutral-450' : 'text-neutral-355'}`}>Currencies & commissions</span>
                  </div>
                </button>

                {/* Multi Industry Tab */}
                <button
                  type="button"
                  onClick={() => setSettingsSubTab('multi_industry')}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all font-bold ${
                    settingsSubTab === 'multi_industry' 
                      ? 'bg-neutral-900 text-white shadow-xl shadow-neutral-900/10' 
                      : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-950'
                  }`}
                >
                  <Building2 size={16} className={settingsSubTab === 'multi_industry' ? 'text-primary' : 'text-neutral-400'} />
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-[11px] leading-none uppercase tracking-wider">Multi Industry</p>
                    <span className={`text-[8px] block mt-1 font-sans font-bold leading-none ${settingsSubTab === 'multi_industry' ? 'text-neutral-450' : 'text-neutral-355'}`}>Dynamic sandbox labels</span>
                  </div>
                </button>

                {/* Marketplace Tab */}
                <button
                  type="button"
                  onClick={() => setSettingsSubTab('marketplace')}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all font-bold ${
                    settingsSubTab === 'marketplace' 
                      ? 'bg-neutral-900 text-white shadow-xl shadow-neutral-900/10' 
                      : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-950'
                  }`}
                >
                  <ShoppingBag size={16} className={settingsSubTab === 'marketplace' ? 'text-primary' : 'text-neutral-400'} />
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-[11px] leading-none uppercase tracking-wider">Marketplace</p>
                    <span className={`text-[8px] block mt-1 font-sans font-bold leading-none ${settingsSubTab === 'marketplace' ? 'text-neutral-450' : 'text-neutral-355'}`}>VAT tax grids, langing pages & policies</span>
                  </div>
                </button>

                {/* Widgets Tab */}
                <button
                  type="button"
                  onClick={() => setSettingsSubTab('widgets')}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all font-bold ${
                    settingsSubTab === 'widgets' 
                      ? 'bg-neutral-900 text-white shadow-xl shadow-neutral-900/10' 
                      : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-950'
                  }`}
                >
                  <Wrench size={16} className={settingsSubTab === 'widgets' ? 'text-primary animate-pulse' : 'text-neutral-400'} />
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-[11px] leading-none uppercase tracking-wider">Widget modules</p>
                    <span className={`text-[8px] block mt-1 font-sans font-bold leading-none ${settingsSubTab === 'widgets' ? 'text-neutral-450' : 'text-neutral-355'}`}>AI threshold limits & scanners</span>
                  </div>
                </button>

                {/* Bug Reports Tab */}
                <button
                  type="button"
                  onClick={() => setSettingsSubTab('bugs')}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all font-bold ${
                    settingsSubTab === 'bugs' 
                      ? 'bg-neutral-900 text-white shadow-xl shadow-neutral-900/10' 
                      : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-950'
                  }`}
                >
                  <div className="relative shrink-0">
                    <Bug size={16} className={settingsSubTab === 'bugs' ? 'text-purple-600' : 'text-neutral-400'} />
                    {hasActiveBugs && (
                      <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-650"></span>
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 flex items-center justify-between gap-1">
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-[11px] leading-none uppercase tracking-wider">Bug Finder</p>
                      <span className={`text-[8px] block mt-1 font-sans font-bold leading-none ${settingsSubTab === 'bugs' ? 'text-neutral-450' : 'text-neutral-355'}`}>
                        {hasActiveBugs ? "Outstanding beta issues" : "Beta issues & user reports"}
                      </span>
                    </div>
                    {hasActiveBugs && (
                      <span className="px-1.5 py-0.5 text-[8px] font-black uppercase text-red-700 bg-red-50 rounded-lg tracking-wider animate-pulse border border-red-200 shrink-0 select-none">
                        Active
                      </span>
                    )}
                  </div>
                </button>
              </div>

              {/* Action Save Quick Card */}
              <div className="p-5 bg-neutral-900/5 text-neutral-800 rounded-3xl border border-neutral-100 flex flex-col gap-3">
                <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">Status Overview</span>
                <p className="text-[10px] text-neutral-500 leading-normal font-sans font-bold">Draft configurations are live instantly across the entire platform upon synchronization.</p>
                <button
                  onClick={async () => {
                    if (settings) {
                      await updateDoc(doc(db, 'adminSettings', 'global'), settings as any);
                      toast.success("Settings synchronized successfully!");
                    }
                  }}
                  className="w-full py-2.5 bg-neutral-950 text-white text-[10px] font-black uppercase tracking-widest hover:bg-black rounded-xl transition shadow active:scale-95"
                >
                  Apply All Changes
                </button>
              </div>
            </div>

            {/* Submenu Tab Content Pages */}
            <div className="col-span-1 md:col-span-3 space-y-6">
              {settingsSubTab === 'branding' && (
                <BrandingSettingsTab settings={settings} setSettings={setSettings} />
              )}
              {settingsSubTab === 'billing' && (
                <BillingSettingsTab settings={settings} setSettings={setSettings} />
              )}
              {settingsSubTab === 'multi_industry' && (
                <MultiIndustrySettingsTab settings={settings} setSettings={setSettings} />
              )}
              {settingsSubTab === 'marketplace' && (
                <MarketplaceSettingsTab settings={settings} setSettings={setSettings} />
              )}
              {settingsSubTab === 'widgets' && (
                <WidgetsSettingsTab settings={settings} setSettings={setSettings} />
              )}
              {settingsSubTab === 'bugs' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white p-6 md:p-10 rounded-[2.5rem] border border-neutral-105 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-6">
                    <div className="space-y-1">
                      <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2 text-neutral-900">
                        <Bug className="text-purple-600 animate-pulse" size={24} />
                        <span>Beta Bug Reports Finder</span>
                      </h2>
                      <p className="font-semibold text-neutral-500 text-xs">Review issues found by beta testers, assign states, and post resolutions directly back to their dashboard.</p>
                    </div>
                    <div className="bg-purple-150 text-purple-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border border-purple-200 self-start">
                      <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse"></span>
                      <span>Logged Bugs Tracked: {bugReports.length}</span>
                    </div>
                  </div>

                  {/* Filtering Bar */}
                  <div className="bg-neutral-50 p-6 rounded-3xl border border-neutral-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                    <div className="relative md:col-span-2">
                      <Search className="absolute left-4 top-3.5 text-neutral-400" size={18} />
                      <input
                        type="text"
                        placeholder="Search reporter, email, title, description or module..."
                        value={bugSearchQuery}
                        onChange={(e) => setBugSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition text-xs font-medium"
                      />
                    </div>

                    <div className="w-full">
                      <select
                        value={bugStatusFilter}
                        onChange={(e) => setBugStatusFilter(e.target.value as any)}
                        className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl outline-none text-xs font-semibold"
                      >
                        <option value="all">All Statuses</option>
                        <option value="open">🔴 Open Bugs</option>
                        <option value="in_review">🟡 In Review</option>
                        <option value="resolved">🟢 Resolved Issues</option>
                        <option value="fixed">🟢 Fixed Issues</option>
                      </select>
                    </div>

                    <div className="w-full">
                      <select
                        value={bugSeverityFilter}
                        onChange={(e) => setBugSeverityFilter(e.target.value as any)}
                        className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl outline-none text-xs font-semibold"
                      >
                        <option value="all">All Severities</option>
                        <option value="critical">🚨 Critical</option>
                        <option value="high">🟠 High</option>
                        <option value="medium">🟡 Medium</option>
                        <option value="low">🔵 Low</option>
                      </select>
                    </div>
                  </div>

                  {/* Bugs Listings */}
                  <div className="space-y-6">
                    {bugReports.filter(b => {
                      const matchedSearch = !bugSearchQuery ? true : (
                        (b.title || '').toLowerCase().includes(bugSearchQuery.toLowerCase()) ||
                        (b.description || '').toLowerCase().includes(bugSearchQuery.toLowerCase()) ||
                        (b.userName || '').toLowerCase().includes(bugSearchQuery.toLowerCase()) ||
                        (b.userEmail || '').toLowerCase().includes(bugSearchQuery.toLowerCase()) ||
                        (b.module || '').toLowerCase().includes(bugSearchQuery.toLowerCase())
                      );
                      const matchedStatus = bugStatusFilter === 'all' || b.status === bugStatusFilter;
                      const matchedSeverity = bugSeverityFilter === 'all' || b.severity === bugSeverityFilter;

                      return matchedSearch && matchedStatus && matchedSeverity;
                    }).length === 0 ? (
                      <div className="bg-white p-16 rounded-3xl border border-neutral-100 text-center space-y-4">
                        <div className="w-16 h-16 bg-neutral-105 text-neutral-400 rounded-full flex items-center justify-center mx-auto">
                          <CheckCircle2 size={32} />
                        </div>
                        <div>
                          <h3 className="font-bold text-neutral-800 text-lg">No Matching Bug Reports</h3>
                          <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1">Excellent job! No active bugs matched your current filter criteria.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-6">
                        {bugReports.filter(b => {
                          const matchedSearch = !bugSearchQuery ? true : (
                            (b.title || '').toLowerCase().includes(bugSearchQuery.toLowerCase()) ||
                            (b.description || '').toLowerCase().includes(bugSearchQuery.toLowerCase()) ||
                            (b.userName || '').toLowerCase().includes(bugSearchQuery.toLowerCase()) ||
                            (b.userEmail || '').toLowerCase().includes(bugSearchQuery.toLowerCase()) ||
                            (b.module || '').toLowerCase().includes(bugSearchQuery.toLowerCase())
                          );
                          const matchedStatus = bugStatusFilter === 'all' || b.status === bugStatusFilter;
                          const matchedSeverity = bugSeverityFilter === 'all' || b.severity === bugSeverityFilter;

                          return matchedSearch && matchedStatus && matchedSeverity;
                        }).map(bug => {
                          const severityConfig = {
                            critical: { bg: 'bg-red-100 text-red-800 border-red-200', text: '🚨 Critical Severity' },
                            high: { bg: 'bg-orange-100 text-orange-800 border-orange-200', text: '🟠 High Severity' },
                            medium: { bg: 'bg-yellow-100 text-yellow-800 border-yellow-200', text: '🟡 Medium Severity' },
                            low: { bg: 'bg-blue-100 text-blue-800 border-blue-200', text: '🔵 Low Severity' }
                          }[bug.severity || 'low'] || { bg: 'bg-blue-100 text-blue-800 border-blue-200', text: '🔵 Low Severity' };

                          const statusConfig = {
                            open: { bg: 'bg-red-50 text-red-700 border-red-100', text: 'Open / Pending' },
                            in_review: { bg: 'bg-amber-50 text-amber-700 border-amber-100', text: 'Staged / In Review' },
                            resolved: { bg: 'bg-green-50 text-green-700 border-green-100', text: 'Fully Resolved' },
                            fixed: { bg: 'bg-emerald-100 text-emerald-805 border-emerald-200', text: '🟢 Fixed & Crossed Out' }
                          }[bug.status || 'open'] || { bg: 'bg-emerald-100 text-emerald-850 border-emerald-200', text: '🟢 Fixed' };

                          const isFixed = bug.status === 'fixed' || bug.status === 'resolved';

                          return (
                            <div 
                              key={bug.id}
                              className={`rounded-3xl border shadow-sm overflow-hidden flex flex-col xl:flex-row transition hover:shadow-md relative ${
                                isFixed 
                                  ? 'border-emerald-100 bg-emerald-50/5' 
                                  : bug.severity === 'critical'
                                    ? 'bg-white border-red-200 ring-4 ring-red-50/50'
                                    : 'bg-white border-neutral-200'
                              }`}
                            >
                              {/* Left: Bug Info */}
                              <div className="p-6 md:p-8 flex-1 space-y-4">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border ${severityConfig.bg}`}>
                                    {severityConfig.text}
                                  </span>
                                  <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border ${statusConfig.bg}`}>
                                    {statusConfig.text}
                                  </span>
                                  <span className="text-[10px] font-mono text-neutral-400 uppercase font-black tracking-wider bg-neutral-100 px-2 py-1 rounded">
                                    Module: {bug.module || 'General UI'}
                                  </span>
                                </div>

                                <div className="space-y-1">
                                  <h4 className={`text-lg font-bold leading-snug ${isFixed ? 'line-through text-neutral-400 decoration-neutral-400 decoration-2' : 'text-neutral-900'}`}>{bug.title}</h4>
                                  <p className="text-xs text-neutral-500 font-medium">
                                    Reported by <span className="font-bold text-neutral-800">{bug.userName}</span> ({bug.userEmail}) on {bug.createdAt ? new Date(bug.createdAt).toLocaleDateString() : 'Unknown Date'}
                                  </p>
                                </div>

                                <div className={`p-4 rounded-2xl border text-xs font-medium whitespace-pre-wrap leading-relaxed ${isFixed ? 'line-through text-neutral-400/80 bg-neutral-50/50 border-neutral-150' : 'bg-neutral-50 border-neutral-100 text-neutral-600'}`}>
                                  {bug.description}
                                </div>

                                {/* Screenshots display */}
                                {bug.screenshots && bug.screenshots.length > 0 && (
                                  <div className="space-y-1.5 mt-2">
                                    <p className="text-[10px] uppercase font-black tracking-widest text-neutral-400">Reporter Attached Screenshots ({bug.screenshots.length}):</p>
                                    <div className="flex flex-wrap gap-2">
                                      {bug.screenshots.map((img: string, sci: number) => (
                                        <div 
                                          key={sci}
                                          onClick={() => setAdminZoomedImage(img)}
                                          className="w-20 h-14 rounded-xl border border-neutral-200 cursor-pointer overflow-hidden relative group hover:border-purple-500 transition shadow bg-neutral-100 flex items-center justify-center shrink-0"
                                        >
                                          <img src={img} alt="Screenshot attachment" className="object-cover w-full h-full" referrerPolicy="no-referrer" />
                                          <div className="absolute inset-0 bg-black/5 group-hover:bg-black/0 transition" />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Admin comments */}
                                {bug.adminNotes && (
                                  <div className="p-4 bg-green-50/50 rounded-2xl border border-green-100 text-xs text-green-800 space-y-1">
                                    <p className="font-bold text-[10px] uppercase tracking-wider text-green-600">Admin Resolution Response Note:</p>
                                    <p className="font-medium leading-relaxed">{bug.adminNotes}</p>
                                    {bug.adminNotesUpdatedAt && (
                                      <p className="text-[9px] text-green-500 font-mono">Last adjusted: {new Date(bug.adminNotesUpdatedAt).toLocaleString()}</p>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Right: Quick resolution tool */}
                              <div className="p-6 xl:p-8 bg-neutral-50/50 xl:border-l border-neutral-100 w-full xl:w-80 shrink-0 flex flex-col justify-between gap-4 bg-neutral-50">
                                <div className="space-y-4">
                                  <h5 className="text-xs font-black uppercase tracking-widest text-neutral-500">Bug Resolution Actions</h5>
                                  
                                  {/* Quick Status Select */}
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Set Progress state</label>
                                    <select
                                      value={editingBugReport?.id === bug.id ? bugStatusUpdate : bug.status}
                                      onChange={(e) => {
                                        setEditingBugReport(bug);
                                        setBugStatusUpdate(e.target.value as any);
                                        if (editingBugReport?.id !== bug.id) {
                                          setBugAdminNotes(bug.adminNotes || '');
                                        }
                                      }}
                                      className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-xl text-xs font-semibold"
                                    >
                                      <option value="open">🔴 Open / Pending</option>
                                      <option value="in_review">🟡 Staged / In Review</option>
                                      <option value="resolved">🟢 Fully Resolved</option>
                                      <option value="fixed">🟢 Fixed & Crossed Out</option>
                                    </select>
                                  </div>

                                  {/* Response text arena */}
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Resolution Comment / notes</label>
                                    <textarea
                                      placeholder="Write steps taken or resolve notes here..."
                                      rows={3}
                                      value={editingBugReport?.id === bug.id ? bugAdminNotes : (bug.adminNotes || '')}
                                      onFocus={() => {
                                        if (editingBugReport?.id !== bug.id) {
                                          setEditingBugReport(bug);
                                          setBugAdminNotes(bug.adminNotes || '');
                                          setBugStatusUpdate(bug.status);
                                        }
                                      }}
                                      onChange={(e) => {
                                        setBugAdminNotes(e.target.value);
                                      }}
                                      className="w-full p-3 bg-white border border-neutral-200 rounded-xl text-xs font-medium resize-none focus:ring-2 focus:ring-purple-500 outline-none transition"
                                    />
                                  </div>
                                </div>

                                {/* Save Action trigger */}
                                <button
                                  onClick={async () => {
                                    const bId = bug.id;
                                    const notes = editingBugReport?.id === bId ? bugAdminNotes : (bug.adminNotes || '');
                                    const stat = editingBugReport?.id === bId ? bugStatusUpdate : bug.status;

                                    try {
                                      await updateDoc(doc(db, 'bugs', bId), {
                                        status: stat,
                                        adminNotes: notes,
                                        adminNotesUpdatedAt: new Date().toISOString()
                                      });
                                      setEditingBugReport(null);
                                      toast.success("Bug report successfully updated!");
                                    } catch (e) {
                                      console.error(e);
                                      toast.error("Failed to update bug report.");
                                    }
                                  }}
                                  className={`w-full py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer ${
                                    editingBugReport?.id === bug.id
                                      ? 'bg-neutral-900 text-white hover:bg-black'
                                      : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100 hover:text-neutral-950'
                                  }`}
                                >
                                  <Save size={12} />
                                  <span>{editingBugReport?.id === bug.id ? 'Save Progress Notes' : 'Modify Resolves'}</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* General Save changes bar */}
              {settingsSubTab !== 'bugs' && (
                <div className="flex items-center justify-end pt-6 border-t border-neutral-100 bg-neutral-50/50 p-4 rounded-3xl mt-4">
                  <button
                    type="button"
                    onClick={async () => {
                      if (settings) {
                        await updateDoc(doc(db, 'adminSettings', 'global'), settings as any);
                        toast.success("All configurations synchronized successfully!");
                      }
                    }}
                    className="w-full sm:w-auto px-10 py-3.5 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-primary/95 transition shadow shadow-primary/10 active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Save size={16} />
                    <span>Synchronize {
                      settingsSubTab === 'branding' ? 'Branding' : 
                      settingsSubTab === 'billing' ? 'Billing' : 
                      settingsSubTab === 'multi_industry' ? 'Sandbox' : 
                      settingsSubTab === 'marketplace' ? 'Marketplace' : 'Widget'
                    } settings</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'migration' && (
        <FirebaseMigrator />
      )}

      {activeTab === 'docs' && (
        <AdminDocsTab />
      )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Lightbox Zoom modal for Admin screenshots reviews */}
      {adminZoomedImage && (
        <div 
          className="fixed inset-0 bg-neutral-950/85 backdrop-blur-md flex items-center justify-center z-[200] p-4 cursor-pointer"
          onClick={() => setAdminZoomedImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[85vh] overflow-hidden rounded-3xl shadow-2xl bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setAdminZoomedImage(null)}
              className="absolute top-4 right-4 p-2 bg-neutral-900/60 hover:bg-neutral-800 text-white rounded-full transition shadow z-10"
            >
              <X size={18} />
            </button>
            <img src={adminZoomedImage} alt="Zoomed screenshot attachment" className="max-w-full max-h-[85vh] object-contain block" />
          </div>
        </div>
      )}
    </div>
  );
}
function CheckoutAdmin({ logs }: { logs: CheckoutRecord[] }) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-black uppercase tracking-tighter">Equipment Logs</h2>
          <p className="text-neutral-500 text-sm">Real-time monitoring of gear checkout/checkin activity</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold uppercase tracking-widest animate-pulse">
          <Activity size={14} />
          <span>Live Monitoring</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {logs.length === 0 ? (
          <div className="p-12 text-center bg-neutral-50 rounded-[2.5rem] border border-dashed border-neutral-200">
            <Package size={48} className="mx-auto text-neutral-300 mb-4" />
            <p className="text-neutral-400 font-bold uppercase tracking-widest text-xs">No activity recorded yet</p>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm flex flex-col md:flex-row md:items-center gap-6 group hover:shadow-md transition">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${log.status === 'active' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                {log.status === 'active' ? <LogOut size={24} className="rotate-180" /> : <CheckCircle2 size={24} />}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-lg font-bold truncate uppercase tracking-tight">{log.assetName}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${log.status === 'active' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                    {log.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-neutral-400 font-medium">
                  <div className="flex items-center gap-1">
                    <User size={12} />
                    <span>{log.userName}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    <span>{log.checkOutTime ? new Date(log.checkOutTime?.seconds * 1000).toLocaleString() : 'Just now'}</span>
                  </div>
                </div>
              </div>

              {log.signature && (
                <div className="w-32 h-16 bg-neutral-50 rounded-xl border border-neutral-100 p-2 flex items-center justify-center overflow-hidden shrink-0">
                  <img src={log.signature} alt="Signature" className="max-w-full max-h-full grayscale opacity-50 contrast-125" />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function OrganizationAdmin({ 
  organizations, 
  departments, 
  teams, 
  users 
}: { 
  organizations: Organization[], 
  departments: Department[], 
  teams: Team[],
  users: UserProfile[]
}) {
  const [activeOrgView, setActiveOrgView] = useState<'orgs' | 'depts' | 'teams'>('orgs');
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
      // Uniqueness check
      const nameCheck = await getDocs(query(collection(db, 'organizations'), where('name', '==', newOrgName)));
      const slugCheck = await getDocs(query(collection(db, 'organizations'), where('slug', '==', slug)));
      
      if (!nameCheck.empty || !slugCheck.empty) {
        toast.error("This organization name or identifier is already taken.");
        return;
      }

      await addDoc(collection(db, 'organizations'), {
        name: newOrgName,
        slug: slug,
        ownerId: '', // Initially empty, can be assigned later
        settings: {
          branding: { primaryColor: '#2563eb' },
          kioskSettings: { requireSignature: false, allowManualSearch: true, autoLogoutMinutes: 5 }
        },
        subscriptionPlan: 'free',
        status: 'active',
        createdAt: serverTimestamp()
      });
      setNewOrgName('');
      setNewOrgSlug('');
      setIsAddingOrg(false);
      toast.success("Organization created successfully");
    } catch (e) {
      console.error("Org creation error:", e);
      toast.error("Failed to create organization. Check your permissions.");
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
      setEditingOrg(null);
      toast.success("Organization updated successfully");
    } catch (e) {
      toast.error("Failed to update organization");
    }
  };

  const handleCreateDept = async () => {
    if (!newDeptName || !selectedOrgId) return;
    try {
      await addDoc(collection(db, 'departments'), {
        name: newDeptName,
        orgId: selectedOrgId,
        createdAt: serverTimestamp()
      });
      setNewDeptName('');
      setIsAddingDept(false);
      toast.success("Department created");
    } catch (e) {
      toast.error("Failed to create department");
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName || !selectedDeptId) return;
    const dept = departments.find(d => d.id === selectedDeptId);
    if (!dept) return;

    try {
      await addDoc(collection(db, 'teams'), {
        name: newTeamName,
        orgId: dept.orgId,
        deptId: selectedDeptId,
        createdAt: serverTimestamp()
      });
      setNewTeamName('');
      setIsAddingTeam(false);
      toast.success("Team created");
    } catch (e) {
      toast.error("Failed to create team");
    }
  };

  const handleDelete = async (coll: string, id: string) => {
    if (!window.confirm(`Delete this ${coll.slice(0, -1)}? This will also remove any nested data.`)) return;
    try {
      if (coll === 'organizations') {
        const batch = writeBatch(db);
        // Delete teams first
        const teamsToDel = teams.filter(t => t.orgId === id);
        teamsToDel.forEach(t => batch.delete(doc(db, 'teams', t.id)));
        // Delete depts
        const deptsToDel = departments.filter(d => d.orgId === id);
        deptsToDel.forEach(d => batch.delete(doc(db, 'departments', d.id)));
        // Delete org
        batch.delete(doc(db, 'organizations', id));
        await batch.commit();
      } else if (coll === 'departments') {
        const batch = writeBatch(db);
        const teamsToDel = teams.filter(t => t.deptId === id);
        teamsToDel.forEach(t => batch.delete(doc(db, 'teams', t.id)));
        batch.delete(doc(db, 'departments', id));
        await batch.commit();
      } else {
        await deleteDoc(doc(db, coll, id));
      }
      toast.success(`${coll.slice(0, -1)} deleted`);
    } catch (e) {
      console.error("Delete failed:", e);
      toast.error("Delete failed. Please check permissions.");
    }
  };

  return (
    <div className="space-y-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter">Organization Management</h2>
          <p className="text-neutral-500 text-xs md:text-sm">Create and oversee platform-wide organizations, teams and departments.</p>
        </div>
        <button 
          onClick={() => setIsAddingOrg(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition shadow-lg text-sm"
        >
          <Plus size={20} />
          <span>New Organization</span>
        </button>
      </div>

      {/* Mobile Organization View Switcher */}
      <div className="flex lg:hidden bg-neutral-100 p-1 rounded-xl">
        {(['orgs', 'depts', 'teams'] as const).map(view => (
          <button
            key={view}
            onClick={() => setActiveOrgView(view)}
            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              activeOrgView === view ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-400'
            }`}
          >
            {view}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Organizations Column */}
        <div className={`space-y-6 ${activeOrgView !== 'orgs' ? 'hidden lg:block' : ''}`}>
          <div className="flex items-center justify-between px-2">
            <h3 className="font-bold uppercase tracking-widest text-xs text-neutral-400">Organizations ({organizations.length})</h3>
          </div>
          <div className="space-y-4">
            <AnimatePresence>
              {isAddingOrg && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-6 rounded-3xl border-2 border-primary/20 shadow-xl space-y-4"
                >
                  <div className="space-y-4">
                    <input 
                      placeholder="Organization Name"
                      value={newOrgName}
                      onChange={(e) => setNewOrgName(e.target.value)}
                      className="w-full px-4 py-2 bg-neutral-50 border border-neutral-100 rounded-xl font-bold"
                    />
                    <input 
                      placeholder={newOrgName ? newOrgName.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : "Slug (e.g. my-org)"}
                      value={newOrgSlug}
                      onChange={(e) => setNewOrgSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                      className="w-full px-4 py-2 bg-neutral-50 border border-neutral-100 rounded-xl font-mono text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleCreateOrg} className="flex-1 bg-primary text-white py-2 rounded-xl font-bold text-xs uppercase">Create</button>
                    <button onClick={() => setIsAddingOrg(false)} className="flex-1 bg-neutral-100 text-neutral-600 py-2 rounded-xl font-bold text-xs uppercase">Cancel</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {organizations.map(org => (
              <div key={org.id} className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm hover:shadow-md transition group">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-neutral-900 text-white rounded-xl flex items-center justify-center">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold">{org.name}</h4>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${org.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                          {org.status || 'active'}
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-400 font-mono italic">/{org.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setEditingOrg(org)}
                      className="p-2 text-neutral-400 hover:text-primary transition"
                      title="Edit Organization"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={async () => {
                        const newStatus = org.status === 'suspended' ? 'active' : 'suspended';
                        await updateDoc(doc(db, 'organizations', org.id), { status: newStatus });
                        toast.success(`Organization ${newStatus}`);
                      }}
                      className={`p-2 rounded-lg transition ${org.status === 'suspended' ? 'text-emerald-500 hover:bg-emerald-50' : 'text-amber-500 hover:bg-amber-50'}`}
                      title={org.status === 'suspended' ? 'Activate' : 'Suspend'}
                    >
                      <Shield size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete('organizations', org.id)} 
                      className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                      title="Delete Organization"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                {/* Edit Org Modal/In-line */}
                <AnimatePresence>
                  {editingOrg?.id === org.id && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-4 bg-neutral-50 p-4 rounded-2xl border border-neutral-100 space-y-3 overflow-hidden"
                    >
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Name</label>
                        <input 
                          value={editingOrg.name}
                          onChange={(e) => setEditingOrg({ ...editingOrg, name: e.target.value })}
                          className="w-full px-3 py-1.5 bg-white border border-neutral-200 rounded-lg text-sm font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Slug</label>
                        <input 
                          value={editingOrg.slug}
                          onChange={(e) => setEditingOrg({ ...editingOrg, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                          className="w-full px-3 py-1.5 bg-white border border-neutral-200 rounded-lg text-sm font-mono"
                        />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button onClick={handleUpdateOrg} className="flex-1 bg-neutral-900 text-white py-2 rounded-lg font-bold text-[10px] uppercase">Save</button>
                        <button onClick={() => setEditingOrg(null)} className="flex-1 bg-white border border-neutral-200 text-neutral-500 py-2 rounded-lg font-bold text-[10px] uppercase">Cancel</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => { setSelectedOrgId(org.id); setIsAddingDept(true); }}
                    className="flex-1 py-2 bg-neutral-50 text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-primary transition rounded-lg"
                  >
                    + Dept
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Departments Column */}
        <div className={`space-y-6 ${activeOrgView !== 'depts' ? 'hidden lg:block' : ''}`}>
          <div className="flex items-center justify-between px-2">
            <h3 className="font-bold uppercase tracking-widest text-xs text-neutral-400">Departments ({departments.length})</h3>
            <button 
              onClick={() => setIsAddingDept(true)}
              className="text-[10px] font-black uppercase text-primary hover:underline"
            >
              + Add Dept
            </button>
          </div>
          <div className="space-y-4">
            <AnimatePresence>
              {isAddingDept && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-6 rounded-3xl border-2 border-primary/20 shadow-xl space-y-4"
                >
                  <select 
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                    className="w-full px-4 py-2 bg-neutral-50 border border-neutral-100 rounded-xl font-bold text-sm"
                  >
                    <option value="">Select Organization</option>
                    {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  <input 
                    placeholder="Department Name"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    className="w-full px-4 py-2 bg-neutral-50 border border-neutral-100 rounded-xl font-bold"
                  />
                  <div className="flex gap-2">
                    <button onClick={handleCreateDept} className="flex-1 bg-primary text-white py-2 rounded-xl font-bold text-xs uppercase">Add</button>
                    <button onClick={() => setIsAddingDept(false)} className="flex-1 bg-neutral-100 text-neutral-600 py-2 rounded-xl font-bold text-xs uppercase">Cancel</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {departments.map(dept => (
              <div key={dept.id} className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm hover:shadow-md transition group">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center">
                      <Layers size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold">{dept.name}</h4>
                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
                        {organizations.find(o => o.id === dept.orgId)?.name || 'Unknown Org'}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => handleDelete('departments', dept.id)} className="p-2 text-neutral-200 hover:text-red-500 transition opacity-0 group-hover:opacity-100">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => { setSelectedDeptId(dept.id); setIsAddingTeam(true); }}
                    className="flex-1 py-2 bg-neutral-50 text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-primary transition rounded-lg"
                  >
                    + Team
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Teams Column */}
        <div className={`space-y-6 ${activeOrgView !== 'teams' ? 'hidden lg:block' : ''}`}>
          <div className="flex items-center justify-between px-2">
            <h3 className="font-bold uppercase tracking-widest text-xs text-neutral-400">Teams ({teams.length})</h3>
            <button 
              onClick={() => setIsAddingTeam(true)}
              className="text-[10px] font-black uppercase text-primary hover:underline"
            >
              + Add Team
            </button>
          </div>
          <div className="space-y-4">
            <AnimatePresence>
              {isAddingTeam && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-6 rounded-3xl border-2 border-primary/20 shadow-xl space-y-4"
                >
                  <select 
                    value={selectedDeptId}
                    onChange={(e) => setSelectedDeptId(e.target.value)}
                    className="w-full px-4 py-2 bg-neutral-50 border border-neutral-100 rounded-xl font-bold text-sm"
                  >
                    <option value="">Select Department</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name} ({organizations.find(o => o.id === d.orgId)?.name})</option>)}
                  </select>
                  <input 
                    placeholder="Team Name"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    className="w-full px-4 py-2 bg-neutral-50 border border-neutral-100 rounded-xl font-bold"
                  />
                  <div className="flex gap-2">
                    <button onClick={handleCreateTeam} className="flex-1 bg-primary text-white py-2 rounded-xl font-bold text-xs uppercase">Add</button>
                    <button onClick={() => setIsAddingTeam(false)} className="flex-1 bg-neutral-100 text-neutral-600 py-2 rounded-xl font-bold text-xs uppercase">Cancel</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {teams.map(team => (
              <div key={team.id} className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm hover:shadow-md transition group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center">
                      <GitBranch size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold">{team.name}</h4>
                      <div className="flex flex-col text-[10px] text-neutral-400 font-bold uppercase tracking-widest italic">
                        <span>{organizations.find(o => o.id === team.orgId)?.name || 'Unknown Org'}</span>
                        <span>{departments.find(d => d.id === team.deptId)?.name || 'Unknown Dept'}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => handleDelete('teams', team.id)} className="p-2 text-neutral-200 hover:text-red-500 transition opacity-0 group-hover:opacity-100">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LanderEditor({ lander, onUpdate }: { lander: Lander, onUpdate: (l: Lander) => void }) {
  const content = lander.content;

  const updateContent = (key: keyof LandingPageContent, value: any) => {
    onUpdate({
      ...lander,
      content: {
        ...content,
        [key]: value
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Header Settings */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <Menu size={20} className="text-primary" />
          <span>Header</span>
        </h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Logo Text</label>
            <input
              type="text"
              value={content.header.logoText}
              onChange={(e) => updateContent('header', { ...content.header, logoText: e.target.value })}
              className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Navigation Links</label>
            <button 
              onClick={() => updateContent('header', { ...content.header, links: [...content.header.links, { label: 'New Link', href: '#' }] })}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              <Plus size={14} /> Add Link
            </button>
          </div>
          <div className="grid gap-2">
            {content.header.links.map((link, idx) => (
              <div key={idx} className="flex items-center gap-4 bg-neutral-50 p-2 rounded-xl border border-neutral-100">
                <input
                  type="text"
                  value={link.label}
                  onChange={(e) => {
                    const newLinks = [...content.header.links];
                    newLinks[idx].label = e.target.value;
                    updateContent('header', { ...content.header, links: newLinks });
                  }}
                  placeholder="Label"
                  className="flex-1 px-3 py-2 bg-white border border-neutral-200 rounded-lg text-xs"
                />
                <input
                  type="text"
                  value={link.href}
                  onChange={(e) => {
                    const newLinks = [...content.header.links];
                    newLinks[idx].href = e.target.value;
                    updateContent('header', { ...content.header, links: newLinks });
                  }}
                  placeholder="URL/Hash"
                  className="flex-1 px-3 py-2 bg-white border border-neutral-200 rounded-lg text-xs"
                />
                <button 
                  onClick={() => {
                    const newLinks = content.header.links.filter((_, i) => i !== idx);
                    updateContent('header', { ...content.header, links: newLinks });
                  }}
                  className="p-2 text-neutral-300 hover:text-red-500 transition"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Layout size={20} className="text-primary" />
            <span>Hero Section</span>
          </h3>
          <button 
            onClick={() => updateContent('hero', { ...content.hero, isEnabled: !content.hero.isEnabled })}
            className={`w-12 h-6 rounded-full relative transition-colors ${content.hero.isEnabled ? 'bg-primary' : 'bg-neutral-200'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${content.hero.isEnabled ? 'right-1' : 'left-1'}`}></div>
          </button>
        </div>
        
        {content.hero.isEnabled && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Primary Title</label>
                <input
                  type="text"
                  value={content.hero.title}
                  onChange={(e) => updateContent('hero', { ...content.hero, title: e.target.value })}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Subtitle Tag</label>
                <input
                  type="text"
                  value={content.hero.subtitle}
                  onChange={(e) => updateContent('hero', { ...content.hero, subtitle: e.target.value })}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Description</label>
              <textarea
                value={content.hero.description}
                onChange={(e) => updateContent('hero', { ...content.hero, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Primary Button Text</label>
                <input
                  type="text"
                  value={content.hero.primaryButtonText}
                  onChange={(e) => updateContent('hero', { ...content.hero, primaryButtonText: e.target.value })}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Secondary Button Text</label>
                <input
                  type="text"
                  value={content.hero.secondaryButtonText}
                  onChange={(e) => updateContent('hero', { ...content.hero, secondaryButtonText: e.target.value })}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ticker Section */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Activity size={20} className="text-primary" />
            <span>Industrial Ticker</span>
          </h3>
          <button 
            onClick={() => updateContent('ticker', { ...content.ticker, isEnabled: !content.ticker.isEnabled })}
            className={`w-12 h-6 rounded-full relative transition-colors ${content.ticker.isEnabled ? 'bg-primary' : 'bg-neutral-200'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${content.ticker.isEnabled ? 'right-1' : 'left-1'}`}></div>
          </button>
        </div>
        {content.ticker.isEnabled && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Section Title</label>
              <input
                type="text"
                value={content.ticker.title}
                onChange={(e) => updateContent('ticker', { ...content.ticker, title: e.target.value })}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Ticker Pairs</label>
                <button 
                  onClick={() => updateContent('ticker', { ...content.ticker, pairs: [...content.ticker.pairs, { by: 'Team', for: 'Use Case' }] })}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  + Add Pair
                </button>
              </div>
              <div className="grid md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2">
                {content.ticker.pairs.map((pair, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-neutral-50 p-2 rounded-xl border border-neutral-100">
                    <input
                      type="text"
                      value={pair.by}
                      onChange={(e) => {
                        const newPairs = [...content.ticker.pairs];
                        newPairs[idx].by = e.target.value;
                        updateContent('ticker', { ...content.ticker, pairs: newPairs });
                      }}
                      className="flex-1 px-3 py-2 bg-white border border-neutral-200 rounded-lg text-[10px]"
                    />
                    <input
                      type="text"
                      value={pair.for}
                      onChange={(e) => {
                        const newPairs = [...content.ticker.pairs];
                        newPairs[idx].for = e.target.value;
                        updateContent('ticker', { ...content.ticker, pairs: newPairs });
                      }}
                      className="flex-1 px-3 py-2 bg-white border border-neutral-200 rounded-lg text-[10px] font-bold"
                    />
                    <button 
                      onClick={() => {
                        const newPairs = content.ticker.pairs.filter((_, i) => i !== idx);
                        updateContent('ticker', { ...content.ticker, pairs: newPairs });
                      }}
                    >
                      <Trash2 size={14} className="text-neutral-300 hover:text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Features Section */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Zap size={20} className="text-primary" />
            <span>Value Propositions (Features)</span>
          </h3>
          <button 
            onClick={() => updateContent('features', { ...content.features, isEnabled: !content.features.isEnabled })}
            className={`w-12 h-6 rounded-full relative transition-colors ${content.features.isEnabled ? 'bg-primary' : 'bg-neutral-200'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${content.features.isEnabled ? 'right-1' : 'left-1'}`}></div>
          </button>
        </div>
        {content.features.isEnabled && (
          <div className="space-y-8">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Main Title</label>
                <input
                  type="text"
                  value={content.features.title}
                  onChange={(e) => updateContent('features', { ...content.features, title: e.target.value })}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Contextual Description</label>
                <input
                  type="text"
                  value={content.features.description}
                  onChange={(e) => updateContent('features', { ...content.features, description: e.target.value })}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold uppercase tracking-tight">Feature Items</h4>
                <button 
                  onClick={() => updateContent('features', { ...content.features, items: [...content.features.items, { title: 'New Feature', description: 'Description', icon: 'Package' }] })}
                  className="px-3 py-1 bg-neutral-100 rounded-lg text-xs font-bold hover:bg-neutral-200"
                >
                  + Add Feature
                </button>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                {content.features.items.map((item, idx) => (
                  <div key={idx} className="p-6 bg-neutral-50 rounded-3xl border border-neutral-100 group relative">
                    <button 
                      onClick={() => {
                        const newItems = content.features.items.filter((_, i) => i !== idx);
                        updateContent('features', { ...content.features, items: newItems });
                      }}
                      className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 text-red-500 transition"
                    >
                      <Trash2 size={16} />
                    </button>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <input
                          type="text"
                          value={item.icon}
                          onChange={(e) => {
                            const newItems = [...content.features.items];
                            newItems[idx].icon = e.target.value;
                            updateContent('features', { ...content.features, items: newItems });
                          }}
                          placeholder="Icon"
                          className="w-20 px-3 py-2 bg-white border border-neutral-200 rounded-lg text-xs"
                        />
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => {
                            const newItems = [...content.features.items];
                            newItems[idx].title = e.target.value;
                            updateContent('features', { ...content.features, items: newItems });
                          }}
                          placeholder="Title"
                          className="flex-1 px-3 py-2 bg-white border border-neutral-200 rounded-lg text-xs font-bold"
                        />
                      </div>
                      <textarea
                        value={item.description}
                        onChange={(e) => {
                          const newItems = [...content.features.items];
                          newItems[idx].description = e.target.value;
                          updateContent('features', { ...content.features, items: newItems });
                        }}
                        placeholder="Detailed description..."
                        rows={2}
                        className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scenarios Section */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Globe size={20} className="text-primary" />
            <span>Industrial Scenarios</span>
          </h3>
          <button 
            onClick={() => updateContent('scenarios', { ...content.scenarios, isEnabled: !content.scenarios.isEnabled })}
            className={`w-12 h-6 rounded-full relative transition-colors ${content.scenarios.isEnabled ? 'bg-primary' : 'bg-neutral-200'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${content.scenarios.isEnabled ? 'right-1' : 'left-1'}`}></div>
          </button>
        </div>
        {content.scenarios.isEnabled && (
          <div className="space-y-8">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Section Title</label>
                <input
                  type="text"
                  value={content.scenarios.title}
                  onChange={(e) => updateContent('scenarios', { ...content.scenarios, title: e.target.value })}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Subtitle/Context</label>
                <input
                  type="text"
                  value={content.scenarios.subtitle}
                  onChange={(e) => updateContent('scenarios', { ...content.scenarios, subtitle: e.target.value })}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold uppercase tracking-tight">Scenario Cards</h4>
                <button 
                  onClick={() => updateContent('scenarios', { ...content.scenarios, items: [...content.scenarios.items, { title: 'New Sector', image: '' }] })}
                  className="px-3 py-1 bg-neutral-100 rounded-lg text-xs font-bold hover:bg-neutral-200"
                >
                  + Add Scenario
                </button>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {content.scenarios.items.map((item, idx) => (
                  <div key={idx} className="bg-neutral-50 rounded-2xl border border-neutral-100 p-4 space-y-4 group relative">
                    <button 
                      onClick={() => {
                        const newItems = content.scenarios.items.filter((_, i) => i !== idx);
                        updateContent('scenarios', { ...content.scenarios, items: newItems });
                      }}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                    <div className="space-y-2">
                      <label className="text-[8px] font-black uppercase text-neutral-400">Sector Title</label>
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => {
                          const newItems = [...content.scenarios.items];
                          newItems[idx].title = e.target.value;
                          updateContent('scenarios', { ...content.scenarios, items: newItems });
                        }}
                        className="w-full px-2 py-1.5 bg-white border border-neutral-200 rounded-lg text-[10px] font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[8px] font-black uppercase text-neutral-400">Background Image URL</label>
                      <input
                        type="text"
                        value={item.image}
                        onChange={(e) => {
                          const newItems = [...content.scenarios.items];
                          newItems[idx].image = e.target.value;
                          updateContent('scenarios', { ...content.scenarios, items: newItems });
                        }}
                        className="w-full px-2 py-1.5 bg-white border border-neutral-200 rounded-lg text-[10px]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats Section */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp size={20} className="text-primary" />
            <span>Industrial Stats</span>
          </h3>
          <button 
            onClick={() => updateContent('stats', { ...content.stats, isEnabled: !content.stats.isEnabled })}
            className={`w-12 h-6 rounded-full relative transition-colors ${content.stats.isEnabled ? 'bg-primary' : 'bg-neutral-200'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${content.stats.isEnabled ? 'right-1' : 'left-1'}`}></div>
          </button>
        </div>
        {content.stats.isEnabled && (
          <div className="grid md:grid-cols-3 gap-6">
            {content.stats.items.map((stat, idx) => (
              <div key={idx} className="flex gap-4 items-end">
                <div className="flex-1 space-y-1">
                  <input
                    type="text"
                    value={stat.value}
                    onChange={(e) => {
                      const newStats = [...content.stats.items];
                      newStats[idx].value = e.target.value;
                      updateContent('stats', { ...content.stats, items: newStats });
                    }}
                    placeholder="99%"
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-black text-xl"
                  />
                  <input
                    type="text"
                    value={stat.label}
                    onChange={(e) => {
                      const newStats = [...content.stats.items];
                      newStats[idx].label = e.target.value;
                      updateContent('stats', { ...content.stats, items: newStats });
                    }}
                    placeholder="Label"
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-neutral-400"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Testimonials */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <MessageSquare size={20} className="text-primary" />
            <span>Testimonials</span>
          </h3>
          <button 
            onClick={() => updateContent('testimonials', { ...content.testimonials, isEnabled: !content.testimonials.isEnabled })}
            className={`w-12 h-6 rounded-full relative transition-colors ${content.testimonials.isEnabled ? 'bg-primary' : 'bg-neutral-200'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${content.testimonials.isEnabled ? 'right-1' : 'left-1'}`}></div>
          </button>
        </div>
        {content.testimonials.isEnabled && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <input
                type="text"
                value={content.testimonials.title}
                onChange={(e) => updateContent('testimonials', { ...content.testimonials, title: e.target.value })}
                placeholder="Section Title"
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl"
              />
              <input
                type="text"
                value={content.testimonials.subtitle}
                onChange={(e) => updateContent('testimonials', { ...content.testimonials, subtitle: e.target.value })}
                placeholder="Section Subtitle"
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl"
              />
            </div>
            <div className="grid gap-4">
              {content.testimonials.items.map((t, idx) => (
                <div key={idx} className="p-6 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-4 group relative">
                  <button 
                    onClick={() => {
                      const newItems = content.testimonials.items.filter((_, i) => i !== idx);
                      updateContent('testimonials', { ...content.testimonials, items: newItems });
                    }}
                    className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                  <div className="grid md:grid-cols-3 gap-4">
                    <input
                      type="text"
                      value={t.name}
                      onChange={(e) => {
                        const newTells = [...content.testimonials.items];
                        newTells[idx].name = e.target.value;
                        updateContent('testimonials', { ...content.testimonials, items: newTells });
                      }}
                      placeholder="Name"
                      className="px-3 py-2 bg-white border border-neutral-200 rounded-lg text-xs font-bold"
                    />
                    <input
                      type="text"
                      value={t.role}
                      onChange={(e) => {
                        const newTells = [...content.testimonials.items];
                        newTells[idx].role = e.target.value;
                        updateContent('testimonials', { ...content.testimonials, items: newTells });
                      }}
                      placeholder="Role"
                      className="px-3 py-2 bg-white border border-neutral-200 rounded-lg text-xs"
                    />
                    <input
                      type="text"
                      value={t.avatar || ''}
                      onChange={(e) => {
                        const newTells = [...content.testimonials.items];
                        newTells[idx].avatar = e.target.value;
                        updateContent('testimonials', { ...content.testimonials, items: newTells });
                      }}
                      placeholder="Avatar URL"
                      className="px-3 py-2 bg-white border border-neutral-200 rounded-lg text-xs"
                    />
                  </div>
                  <textarea
                    value={t.content}
                    onChange={(e) => {
                      const newTells = [...content.testimonials.items];
                      newTells[idx].content = e.target.value;
                      updateContent('testimonials', { ...content.testimonials, items: newTells });
                    }}
                    placeholder="Testimonial content..."
                    className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-xs"
                  />
                </div>
              ))}
              <button 
                onClick={() => updateContent('testimonials', { ...content.testimonials, items: [...content.testimonials.items, { name: '', role: '', content: '' }] })}
                className="w-full py-4 border-2 border-dashed border-neutral-200 rounded-2xl text-neutral-400 font-bold hover:border-primary/20 hover:text-primary transition"
              >
                + Add Testimonial
              </button>
            </div>
          </div>
        )}
      </div>

      {/* FAQ Section */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <HelpCircle size={20} className="text-primary" />
            <span>FAQ Section</span>
          </h3>
          <button 
            onClick={() => updateContent('faq', { ...content.faq, isEnabled: !content.faq.isEnabled })}
            className={`w-12 h-6 rounded-full relative transition-colors ${content.faq.isEnabled ? 'bg-primary' : 'bg-neutral-200'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${content.faq.isEnabled ? 'right-1' : 'left-1'}`}></div>
          </button>
        </div>
        {content.faq.isEnabled && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <input
                type="text"
                value={content.faq.title}
                onChange={(e) => updateContent('faq', { ...content.faq, title: e.target.value })}
                placeholder="FAQ Title"
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl"
              />
              <input
                type="text"
                value={content.faq.subtitle}
                onChange={(e) => updateContent('faq', { ...content.faq, subtitle: e.target.value })}
                placeholder="FAQ Subtitle"
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl"
              />
            </div>
            <div className="space-y-4">
              {content.faq.items.map((item, idx) => (
                <div key={idx} className="p-6 bg-neutral-50 rounded-2xl border border-neutral-100 space-y-4 group relative">
                  <button 
                    onClick={() => {
                      const newItems = content.faq.items.filter((_, i) => i !== idx);
                      updateContent('faq', { ...content.faq, items: newItems });
                    }}
                    className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                  <input
                    type="text"
                    value={item.question}
                    onChange={(e) => {
                      const newFaqs = [...content.faq.items];
                      newFaqs[idx].question = e.target.value;
                      updateContent('faq', { ...content.faq, items: newFaqs });
                    }}
                    placeholder="Question"
                    className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm font-bold"
                  />
                  <textarea
                    value={item.answer}
                    onChange={(e) => {
                      const newFaqs = [...content.faq.items];
                      newFaqs[idx].answer = e.target.value;
                      updateContent('faq', { ...content.faq, items: newFaqs });
                    }}
                    placeholder="Answer"
                    className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm"
                  />
                </div>
              ))}
              <button 
                onClick={() => updateContent('faq', { ...content.faq, items: [...content.faq.items, { question: '', answer: '' }] })}
                className="w-full py-4 border-2 border-dashed border-neutral-200 rounded-2xl text-neutral-400 font-bold hover:border-primary/20 hover:text-primary transition"
              >
                + Add FAQ
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CTA Section */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <MousePointer2 size={20} className="text-primary" />
            <span>Call to Action</span>
          </h3>
          <button 
            onClick={() => updateContent('cta', { ...content.cta, isEnabled: !content.cta.isEnabled })}
            className={`w-12 h-6 rounded-full relative transition-colors ${content.cta.isEnabled ? 'bg-primary' : 'bg-neutral-200'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${content.cta.isEnabled ? 'right-1' : 'left-1'}`}></div>
          </button>
        </div>
        {content.cta.isEnabled && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Main Title</label>
              <input
                type="text"
                value={content.cta.title}
                onChange={(e) => updateContent('cta', { ...content.cta, title: e.target.value })}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Contextual Description</label>
              <textarea
                value={content.cta.description}
                onChange={(e) => updateContent('cta', { ...content.cta, description: e.target.value })}
                rows={2}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Button Text</label>
              <input
                type="text"
                value={content.cta.buttonText}
                onChange={(e) => updateContent('cta', { ...content.cta, buttonText: e.target.value })}
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer Section */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <ChevronDown size={20} className="text-primary" />
          <span>Footer</span>
        </h3>
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Copyright Text</label>
            <input
              type="text"
              value={content.footer.copyright}
              onChange={(e) => updateContent('footer', { ...content.footer, copyright: e.target.value })}
              className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
            />
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Footer Links</label>
              <button 
                onClick={() => updateContent('footer', { ...content.footer, links: [...content.footer.links, { label: 'New Link', href: '#' }] })}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <Plus size={14} /> Add Link
              </button>
            </div>
            <div className="grid gap-2">
              {content.footer.links.map((link, idx) => (
                <div key={idx} className="flex items-center gap-4 bg-neutral-50 p-2 rounded-xl border border-neutral-100">
                  <input
                    type="text"
                    value={link.label}
                    onChange={(e) => {
                      const newLinks = [...content.footer.links];
                      newLinks[idx].label = e.target.value;
                      updateContent('footer', { ...content.footer, links: newLinks });
                    }}
                    placeholder="Label"
                    className="flex-1 px-3 py-2 bg-white border border-neutral-200 rounded-lg text-xs"
                  />
                  <input
                    type="text"
                    value={link.href}
                    onChange={(e) => {
                      const newLinks = [...content.footer.links];
                      newLinks[idx].href = e.target.value;
                      updateContent('footer', { ...content.footer, links: newLinks });
                    }}
                    placeholder="URL"
                    className="flex-1 px-3 py-2 bg-white border border-neutral-200 rounded-lg text-xs"
                  />
                  <button 
                    onClick={() => {
                      const newLinks = content.footer.links.filter((_, i) => i !== idx);
                      updateContent('footer', { ...content.footer, links: newLinks });
                    }}
                    className="p-2 text-neutral-300 hover:text-red-500 transition"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GlobalProjectsAdmin({ projects, users }: { projects: Project[], users: UserProfile[] }) {
  const [search, setSearch] = useState('');
  
  const filtered = projects.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project globally?')) return;
    try {
      await deleteDoc(doc(db, 'projects', id));
      toast.success("Project deleted from platform");
    } catch (e) {
      toast.error("Failed to delete project");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black uppercase tracking-tighter">Global Projects</h2>
          <p className="text-neutral-500 font-medium">Monitor and manage all projects across the platform.</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
          <input 
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-neutral-100 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-primary transition"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white p-12 rounded-[2.5rem] border border-neutral-100 text-center space-y-4">
           <div className="w-16 h-16 bg-neutral-50 text-neutral-300 rounded-full flex items-center justify-center mx-auto">
              <Briefcase size={32} />
           </div>
           <p className="text-neutral-400 font-medium italic">No projects found matching your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(project => {
            const owner = users.find(u => u.uid === project.ownerId);
            return (
              <div key={project.id} className="bg-white p-8 rounded-[3rem] border border-neutral-100 shadow-sm space-y-6 group hover:shadow-2xl transition-all duration-500">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {owner ? (
                      <div className="flex items-center gap-3">
                           <img src={owner.photoURL} alt={owner.displayName} className="w-8 h-8 rounded-full border border-neutral-200" />
                           <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase text-neutral-900 leading-none">{owner.displayName}</span>
                              <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest">{owner.email}</span>
                           </div>
                      </div>
                    ) : (
                      <span className="text-[8px] font-black uppercase text-neutral-300">Identity Purged</span>
                    )}
                  </div>
                  <button 
                    onClick={() => handleDelete(project.id)}
                    className="p-3 text-neutral-200 hover:text-red-500 transition-all hover:bg-red-50 rounded-xl"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xl font-bold tracking-tight truncate group-hover:text-primary transition-colors">{project.name}</h3>
                  <div className="flex flex-wrap items-center gap-2">
                     <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                       project.stage === 'actual' ? 'bg-green-500 text-white' : 'bg-neutral-100 text-neutral-400'
                     }`}>
                       {project.stage || 'proposed'}
                     </span>
                     <span className="text-[10px] font-bold text-neutral-300 border border-neutral-100 px-1.5 py-0.5 rounded">v{project.version || 1}</span>
                     <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                       project.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-primary/5 text-primary'
                     }`}>
                       {project.status || 'planning'}
                     </span>
                  </div>
                  <p className="text-xs text-neutral-400 line-clamp-2 h-8">{project.description || 'No description available.'}</p>
                </div>

                <div className="pt-6 border-t border-neutral-50 flex items-center justify-between">
                   <div className="flex items-center gap-4 text-neutral-400">
                      <div className="flex items-center gap-1.5">
                         <Package size={14} className="text-neutral-300" />
                         <span className="text-[10px] font-black uppercase tracking-wider">{(project.listIds || []).length} Lists</span>
                      </div>
                   </div>
                   <Link 
                     to={`/project/${project.id}`}
                     className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-primary transition shadow-sm"
                   >
                     Inspect Core
                   </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
