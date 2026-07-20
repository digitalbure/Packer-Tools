import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, GearItem, FeatureKey } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Zap, 
  X, 
  Download, 
  Printer, 
  ClipboardCheck, 
  ShieldAlert, 
  TrendingUp, 
  Activity, 
  Info,
  CalendarCheck,
  CheckCircle2,
  Package,
  PlusCircle,
  ArrowUpRight,
  ShoppingBag,
  Globe,
  Percent,
  BookOpen,
  Sliders,
  Check,
  Plus,
  Trash2,
  Settings,
  HelpCircle,
  SlidersHorizontal,
  Eye,
  LayoutGrid,
  Bot
} from 'lucide-react';
import { toast } from 'sonner';
import QRPrintModal from './QRPrintModal';
import DukeyAssistant from './DukeyAssistant';

interface QuickActionsDrawerProps {
  user: UserProfile;
}

export default function QuickActionsDrawer({ user }: QuickActionsDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [gearList, setGearList] = useState<GearItem[]>([]);
  const [activeModal, setActiveModal] = useState<'none' | 'tags' | 'maintenance' | 'insurance'>('none');
  
  // Custom Workspace presets Tab configurations state
  const [activeTab, setActiveTab] = useState<'utilities' | 'calibration'>('utilities');
  const [customPresetName, setCustomPresetName] = useState('');

  // Dukey AI Custom modes and resizable drawer dimensions
  const [isDukeyMode, setIsDukeyMode] = useState(false);
  const [drawerWidth, setDrawerWidth] = useState(385);
  const [isResizing, setIsResizing] = useState(false);

  // Handle drawer resize dragging
  useEffect(() => {
    const handleMove = (clientX: number) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - clientX;
      // Constraint drawer width between 350px and 950px
      if (newWidth >= 340 && newWidth <= 950) {
        setDrawerWidth(newWidth);
      }
    };

    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches[0]) {
        handleMove(e.touches[0].clientX);
      }
    };

    const handleStop = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleStop);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleStop);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleStop);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleStop);
    };
  }, [isResizing]);

  // Expand width nicely for chat assistant and revert back for utilities
  useEffect(() => {
    if (isDukeyMode && drawerWidth === 385) {
      setDrawerWidth(480);
    } else if (!isDukeyMode && drawerWidth === 480) {
      setDrawerWidth(385);
    }
  }, [isDukeyMode]);
  
  const CALIBRATION_FEATURES: { key: FeatureKey; label: string; desc: string }[] = [
    { key: 'gearLibrary', label: 'Gear Library', desc: 'Central items checklist & history logs' },
    { key: 'inventoryManagement', label: 'Inventory Sheets', desc: 'Multi-location inventory tracking sheets' },
    { key: 'toolingLists', label: 'Packing Checklists', desc: 'Slick packing specs & item cases' },
    { key: 'aiWizard', label: 'Gemini Assistant', desc: 'AI smart suggestions & weight optimization' },
    { key: 'marketplace', label: 'Hire Marketplace', desc: 'Share, rent, or lease gear with peers' },
    { key: 'kioskMode', label: 'Checkout Terminal', desc: 'Secure kiosk terminals & signed receipts' },
    { key: 'reminders', label: 'Inspections & Alerts', desc: 'Set service logs & inspection schedules' },
    { key: 'travelCases', label: 'Case Packs & Containers', desc: 'Hardcase flight containers & logs' },
    { key: 'organizer', label: 'Systems Builder', desc: 'Graphic system setup schematics' },
    { key: 'bomManagement', label: 'BOM Composers', desc: 'Define nested hardware parts & units' },
    { key: 'supplierManagement', label: 'Vendor Directory', desc: 'Supplier warranties & representative contacts' }
  ];

  const [selectedCustomFeatures, setSelectedCustomFeatures] = useState<Set<FeatureKey>>(
    new Set(CALIBRATION_FEATURES.map(f => f.key))
  );

  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  if (user?.disableQuickActions) {
    return null;
  }
  
  // Interactive Maintenance State
  const [selectedGearId, setSelectedGearId] = useState('');
  const [maintenanceNotes, setMaintenanceNotes] = useState('');
  const [isSavingMaintenance, setIsSavingMaintenance] = useState(false);

  // Sync Master Inventory Gear List
  useEffect(() => {
    if (!user.uid) return;
    const q = query(collection(db, 'users', user.uid, 'gearLibrary'));
    const unsub = onSnapshot(q, (snap) => {
      setGearList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as GearItem)));
    }, (error) => {
      console.warn("QuickActionsDrawer: Error listening to gear:", error);
    });
    return unsub;
  }, [user.uid]);

  // Handle global trigger for opening the Label Studio modal
  useEffect(() => {
    const handleOpenLabelStudio = () => {
      setActiveModal('tags');
    };
    window.addEventListener('open-label-studio', handleOpenLabelStudio);
    return () => window.removeEventListener('open-label-studio', handleOpenLabelStudio);
  }, []);

  // ACTION 1: Real export to CSV
  const handleExportCSV = () => {
    if (gearList.length === 0) {
      toast.error("Your inventory list is empty. There is nothing to export.");
      return;
    }

    try {
      // Create CSV Headers
      const headers = ['Asset Tag', 'Item Name', 'Brand', 'Model', 'Category', 'Price', 'Quantity', 'Status', 'Last Maintenance'];
      
      // Map rows
      const rows = gearList.map(item => [
        `"${item.assetTag || ''}"`,
        `"${item.name || ''}"`,
        `"${item.brand || ''}"`,
        `"${item.model || ''}"`,
        `"${item.category || ''}"`,
        item.price || 0,
        item.quantity || 1,
        `"${item.status || 'available'}"`,
        `"${item.lastMaintenanceDate || ''}"`
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      
      // Trigger browser download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Packer_Tools_Inventory_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("CSV file compiled and downloaded successfully!");
    } catch (e) {
      toast.error("Error exporting inventory to CSV spreadsheet.");
    }
  };

  // ACTION 3: Log dynamic maintenance to Firestore
  const handleLogMaintenanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGearId) {
      toast.error("Please pick a piece of equipment to record maintenance for.");
      return;
    }
    setIsSavingMaintenance(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const gearRef = doc(db, 'users', user.uid, 'gearLibrary', selectedGearId);
      
      // Update gear document
      await updateDoc(gearRef, {
        lastMaintenanceDate: today,
        maintenanceNotes: maintenanceNotes || 'Standard test and verification inspection complete.'
      });

      // Optionally log audit trail
      await addDoc(collection(db, 'users', user.uid, 'maintenanceLogs'), {
        gearId: selectedGearId,
        date: today,
        notes: maintenanceNotes || 'Completed periodic physical checkup and testing.',
        recordedBy: user.displayName || 'System Integrator'
      });

      toast.success("Maintenance verification logged successfully!");
      setMaintenanceNotes('');
      setSelectedGearId('');
      setActiveModal('none');
    } catch (err) {
      toast.error("Failed to log audit checkup details.");
    } finally {
      setIsSavingMaintenance(false);
    }
  };

  // Preset Layout calibration database updates
  const applyPresetLayout = async (presetType: 'packing' | 'inventory' | 'tagging' | 'max') => {
    try {
      let disabled: FeatureKey[] = [];
      const allKeys = CALIBRATION_FEATURES.map(f => f.key);
      
      if (presetType === 'packing') {
        const keep: FeatureKey[] = ['toolingLists', 'travelCases', 'organizer', 'aiWizard', 'gearLibrary'];
        disabled = allKeys.filter(k => !keep.includes(k));
      } else if (presetType === 'inventory') {
        const keep: FeatureKey[] = ['inventoryManagement', 'reminders', 'bomManagement', 'supplierManagement', 'gearLibrary'];
        disabled = allKeys.filter(k => !keep.includes(k));
      } else if (presetType === 'tagging') {
        const keep: FeatureKey[] = ['gearLibrary', 'customBarcodes', 'qrSharing'];
        disabled = allKeys.filter(k => !keep.includes(k));
      } else if (presetType === 'max') {
        disabled = [];
      }

      await updateDoc(doc(db, 'users', user.uid), {
        disabledFeatures: disabled,
        activeWorkspacePreset: presetType
      });

      toast.success(`Setup calibrated! ${presetType.toUpperCase()} preset applied.`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to calibrate workspace.");
    }
  };

  const toggleCustomFeatureItem = (key: FeatureKey) => {
    const updated = new Set(selectedCustomFeatures);
    if (updated.has(key)) {
      updated.delete(key);
    } else {
      updated.add(key);
    }
    setSelectedCustomFeatures(updated);
  };

  const handleCreateCustomPreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPresetName.trim()) {
      toast.error("Please supply a recognizable shortcut name.");
      return;
    }

    try {
      const allKeys = CALIBRATION_FEATURES.map(f => f.key);
      const disabled = allKeys.filter(k => !selectedCustomFeatures.has(k));
      const presetId = 'preset_' + Date.now();
      const newPreset = {
        id: presetId,
        name: customPresetName.trim(),
        disabledFeatures: disabled
      };

      const existingPresets = user.customPresets || [];
      const updatedPresets = [...existingPresets, newPreset];

      await updateDoc(doc(db, 'users', user.uid), {
        customPresets: updatedPresets,
        disabledFeatures: disabled,
        activeWorkspacePreset: presetId
      });

      setCustomPresetName('');
      toast.success(`Custom Preset "${newPreset.name}" created & applied!`);
    } catch (err) {
      console.error(err);
      toast.error("Could not write customized preset to database.");
    }
  };

  const handleDeleteCustomPreset = async (presetId: string, presetName: string) => {
    try {
      const updatedPresets = (user.customPresets || []).filter(p => p.id !== presetId);
      await updateDoc(doc(db, 'users', user.uid), {
        customPresets: updatedPresets
      });
      toast.success(`Removed layout shortcut "${presetName}".`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove custom preset.");
    }
  };

  const applyCustomPreset = async (preset: { id: string; name: string; disabledFeatures: FeatureKey[] }) => {
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        disabledFeatures: preset.disabledFeatures,
        activeWorkspacePreset: preset.id
      });
      toast.success(`Custom Layout "${preset.name}" applied!`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to activate custom layout.");
    }
  };

  // Pricing calculations
  const totalValuation = gearList.reduce((acc, item) => acc + (item.price || 0) * (item.quantity || 1), 0);
  const totalItemCount = gearList.reduce((acc, item) => acc + (item.quantity || 1), 0);
  const averageValue = totalItemCount > 0 ? totalValuation / totalItemCount : 0;
  const maxPriceItem = gearList.reduce((max, item) => (item.price || 0) > (max.price || 0) ? item : max, { name: 'None', price: 0 });

  // Page-specific Context configuration
  let contextTitle = "Global Operations";
  let contextDesc = "Manage spreadsheets, generate QR codes, and audit system configurations instantly.";
  let contextActions: {
    title: string;
    description: string;
    icon: React.ReactNode;
    onClick: () => void;
    colorClass: string;
  }[] = [];

  const handleNavigate = (path: string) => {
    setIsOpen(false);
    navigate(path);
  };

  const isLibrary = currentPath.includes('/library') || currentPath.includes('/gear');
  const isMarketplace = currentPath.includes('/marketplace');
  const isDashboard = currentPath === '/dashboard' || currentPath === '/';
  const isInventory = currentPath.includes('/inventory') || currentPath.includes('/list') || currentPath.includes('/p/');
  const isProjects = currentPath.includes('/projects') || currentPath.includes('/project/');

  if (isLibrary) {
    contextTitle = "Gear Library Actions";
    contextDesc = "Currently in your master Gear Library. Print adhesive tags, perform audits, or trigger inspections.";
    contextActions = [
      {
        title: "Label Studio (Visual Designer)",
        description: "Open the high-fidelity label designer. Craft custom adhesive tags, cable wrap layouts, and print batch templates.",
        icon: <Printer size={18} />,
        onClick: () => {
          setIsOpen(false);
          setActiveModal('tags');
        },
        colorClass: "bg-[#0066cc]/10 text-[#0066cc]"
      },
      {
        title: "Log Fleet Inspection",
        description: "Update calibration dates, cleanliness, or test results.",
        icon: <ClipboardCheck size={18} />,
        onClick: () => {
          setIsOpen(false);
          setActiveModal('maintenance');
        },
        colorClass: "bg-amber-50 text-amber-600"
      },
      {
        title: "Export Spreadsheet (.CSV)",
        description: "Construct and download localized CSV archives of your entire inventory library.",
        icon: <Download size={18} />,
        onClick: handleExportCSV,
        colorClass: "bg-emerald-50 text-emerald-600"
      }
    ];
  } else if (isMarketplace) {
    contextTitle = "Marketplace Actions";
    contextDesc = "Currently searching peer gear. Navigate directly to listings optimization profiles or back to administrative centers.";
    contextActions = [
      {
        title: "My Active Listings",
        description: "Direct tracking of rental availability rates and user listing orders.",
        icon: <ShoppingBag size={18} />,
        onClick: () => handleNavigate('/listings'),
        colorClass: "bg-rose-50 text-[#ff4f3a]"
      },
      {
        title: "Deploy Spare Assets",
        description: "Configure spare items to list them on the global B2B checkout marketplace.",
        icon: <PlusCircle size={18} />,
        onClick: () => handleNavigate('/library'),
        colorClass: "bg-purple-50 text-purple-600"
      },
      {
        title: "Administrative Dashboard",
        description: "Return to the general operations workspace central control panel.",
        icon: <CalendarCheck size={18} />,
        onClick: () => handleNavigate('/dashboard'),
        colorClass: "bg-neutral-50 text-neutral-800"
      }
    ];
  } else if (isDashboard) {
    contextTitle = "Nerve Center Actions";
    contextDesc = "Direct controls from primary workspace dashboards. Execute quick setups or review storage setups.";
    contextActions = [
      {
        title: "Marketplace Portals",
        description: "Explore hire equipment and connect directly with local organizations.",
        icon: <ShoppingBag size={18} />,
        onClick: () => handleNavigate('/marketplace'),
        colorClass: "bg-rose-50 text-[#ff4f3a]"
      },
      {
        title: "Custom Systems Builder",
        description: "Combine standard list items into complex flight rigs or customized assemblies.",
        icon: <Activity size={18} />,
        onClick: () => handleNavigate('/systems-builder'),
        colorClass: "bg-blue-50 text-blue-600"
      },
      {
        title: "Inspect Storage Racks",
        description: "Track shelving maps, compartment counts, and regional dispatch lockers.",
        icon: <TrendingUp size={18} />,
        onClick: () => handleNavigate('/racks'),
        colorClass: "bg-purple-50 text-purple-600"
      }
    ];
  } else if (isInventory) {
    contextTitle = "Sheet Tracking Actions";
    contextDesc = "Analyzing packing lists or customized sheet collections. Execute high-level insurance audits.";
    contextActions = [
      {
        title: "Insurance Valuation Audit",
        description: "Generate aggregate financial underwriting totals and unit pricing statistics.",
        icon: <TrendingUp size={18} />,
        onClick: () => {
          setIsOpen(false);
          setActiveModal('insurance');
        },
        colorClass: "bg-purple-50 text-purple-600"
      },
      {
        title: "Backup Inventory Registries",
        description: "Pull localized spreadsheet databases tracking every listed piece.",
        icon: <Download size={18} />,
        onClick: handleExportCSV,
        colorClass: "bg-emerald-50 text-emerald-600"
      },
      {
        title: "Inspect Equipment Log",
        description: "Review physical wear or update service intervals on assets.",
        icon: <ClipboardCheck size={18} />,
        onClick: () => {
          setIsOpen(false);
          setActiveModal('maintenance');
        },
        colorClass: "bg-amber-50 text-amber-600"
      }
    ];
  } else if (isProjects) {
    contextTitle = "Project Booking Actions";
    contextDesc = "Reviewing project tracking databases. Update team listings or summon artificial templates.";
    contextActions = [
      {
        title: "Launch Gemini Assistant",
        description: "Summon the interactive template engine to construct checklists dynamically.",
        icon: <Zap size={18} />,
        onClick: () => handleNavigate('/ai-wizard'),
        colorClass: "bg-amber-50 text-amber-600"
      },
      {
        title: "Coordinate Teams / Contacts",
        description: "Adjust operator profiles, organization structures, and communication logs.",
        icon: <CheckCircle2 size={18} />,
        onClick: () => handleNavigate('/organization'),
        colorClass: "bg-indigo-50 text-indigo-600"
      }
    ];
  } else {
    // Default Fallbacks
    contextActions = [
      {
        title: "Export Master Inventory (CSV)",
        description: "Verify physical registries by generating immediate localized spreadsheets.",
        icon: <Download size={18} />,
        onClick: handleExportCSV,
        colorClass: "bg-emerald-50 text-emerald-600"
      },
      {
        title: "Print Adhesive Tags (QR)",
        description: "Construct grid sheets matching physical barcodes and scan codes.",
        icon: <Printer size={18} />,
        onClick: () => {
          setIsOpen(false);
          setActiveModal('tags');
        },
        colorClass: "bg-blue-50 text-blue-600"
      },
      {
        title: "Maintenance Performance Audit",
        description: "Document periodic visual checks and update certification marks.",
        icon: <ClipboardCheck size={18} />,
        onClick: () => {
          setIsOpen(false);
          setActiveModal('maintenance');
        },
        colorClass: "bg-amber-50 text-amber-600"
      }
    ];
  }

  return (
    <>
      {/* Persistently floating, compact, and non-obtrusive round Zap toggle trigger */}
      <div className="fixed right-4 top-1/2 -translate-y-1/2 z-[40]">
        <button
          onClick={() => setIsOpen(true)}
          className="bg-neutral-950 border border-neutral-800 text-white hover:text-white p-3 rounded-full shadow-2xl hover:bg-neutral-855 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center group relative h-11 w-11"
        >
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          >
            <Zap size={16} className="text-[#ff4f3a] group-hover:rotate-12 transition-transform" />
          </motion.div>
          <span className="absolute right-full mr-3.5 bg-neutral-950 text-white text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap shadow-xl pointer-events-none border border-neutral-800 translate-x-3 group-hover:translate-x-0 leading-none">
            Quick Actions
          </span>
        </button>
      </div>

      {/* Slide out Drawer Overlay and Side drawer container */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[500] flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-neutral-900/40 backdrop-blur-xs cursor-pointer"
            />

            {/* Slide drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              style={{ width: `${drawerWidth}px`, maxWidth: '100vw' }}
              className={`relative h-full flex flex-col justify-between overflow-hidden transition-colors duration-300 ${
                isDukeyMode 
                  ? 'bg-neutral-950 border-l border-neutral-850' 
                  : 'bg-white border-l border-neutral-100 shadow-2xl'
              }`}
            >
              {/* Drag handle to resize width from left */}
              <div 
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsResizing(true);
                }}
                onTouchStart={(e) => {
                  setIsResizing(true);
                }}
                className="absolute left-0 top-0 bottom-0 w-1.5 bg-transparent hover:bg-[#ff4f3a]/30 active:bg-[#ff4f3a]/50 transition cursor-ew-resize z-[600] flex items-center justify-center group"
                title="Drag to resize drawer width"
              >
                <div className="w-[1.5px] h-10 bg-neutral-300 group-hover:bg-[#ff4f3a] rounded transition opacity-0 group-hover:opacity-100" />
              </div>

              {isDukeyMode ? (
                <DukeyAssistant 
                  user={user} 
                  fullHeight={true} 
                  onBack={() => setIsDukeyMode(false)}
                  activeSection={contextTitle} 
                  activePath={currentPath} 
                />
              ) : (
                <>
                  {/* Drawer Header */}
              <div className="bg-neutral-50 px-6 py-5 border-b border-neutral-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-neutral-900 text-white rounded-lg flex items-center justify-center">
                    <Zap size={14} className="text-[#ff4f3a]" />
                  </div>
                  <div>
                    <h3 className="font-black text-xs uppercase tracking-wider text-neutral-800 leading-none">Quick Actions</h3>
                    <p className="text-[7.5px] font-mono leading-none tracking-widest text-[#ff4f3a] uppercase mt-1">Contextual operations active</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button className="text-neutral-300 hover:text-neutral-500 transition" title="Context Info">
                    <Info size={14} />
                  </button>
                  <button 
                    onClick={() => setIsOpen(false)} 
                    className="p-1 px-1.5 bg-white border border-neutral-200 hover:bg-neutral-100 rounded-lg text-neutral-500 transition"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Tab Selector */}
              <div className="flex border-b border-neutral-150 bg-neutral-100 p-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('utilities')}
                  className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${
                    activeTab === 'utilities'
                      ? 'bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-250/20'
                      : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  Adaptive Utilities
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('calibration')}
                  className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1 ${
                    activeTab === 'calibration'
                      ? 'bg-neutral-950 text-white shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  <Sliders size={10} className={activeTab === 'calibration' ? "text-[#ff4f3a]" : ""} />
                  Workspace Setup
                </button>
              </div>

              {/* Drawer Body content (scrollable) */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {activeTab === 'utilities' ? (
                  <>
                    {/* Launch Card for Page-Aware Dukey Assistant with customized rounded square icon preset */}
                    <div className="bg-neutral-50/70 border border-neutral-200/60 rounded-2xl p-4.5 flex items-center gap-4 hover:bg-neutral-100/60 transition duration-150 group">
                      {/* Vibrant modern rounded-square AI icon representing Dukey AI */}
                      <button
                        onClick={() => setIsDukeyMode(true)}
                        className="w-13 h-13 bg-gradient-to-tr from-orange-500 to-red-500 hover:scale-110 active:scale-95 transition-all duration-300 rounded-[20px] flex items-center justify-center shrink-0 text-white shadow-lg hover:shadow-orange-500/10 group-hover:rotate-3 cursor-pointer relative"
                        title="Open Dukey AI Advisor Dialog"
                      >
                        <Bot size={24} className="text-white" />
                        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border border-white animate-pulse" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 leading-none">
                          <span className="font-extrabold text-[11px] uppercase tracking-wider text-neutral-800">Dukey AI Advisor</span>
                          <span className="text-[7px] bg-[#ff4f3a]/10 text-[#ff4f3a] px-1 py-0.2 rounded font-black uppercase tracking-widest animate-pulse leading-none">Page Aware</span>
                        </div>
                        <p className="text-[9px] text-neutral-400 font-bold uppercase mt-1">
                          Analyzing: <span className="text-neutral-750 normal-case font-bold">{contextTitle || 'System Workspace'}</span>
                        </p>
                        <button
                          onClick={() => setIsDukeyMode(true)}
                          className="text-[9px] font-black uppercase tracking-widest text-[#ff4f3a] hover:text-[#e04532] transition mt-2 flex items-center gap-1 cursor-pointer leading-none"
                        >
                          Launch AI Advisor &rarr;
                        </button>
                      </div>
                    </div>

                    {/* Primary Large Buttons (rendered dynamically based on location context!) */}
                    <div className="space-y-3.5">
                      <h4 className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Localized Utilities</h4>
                      
                      {contextActions.map((act, idx) => (
                        <button
                          key={idx}
                          onClick={act.onClick}
                          className="w-full bg-neutral-50 hover:bg-neutral-100/90 hover:scale-[1.01] active:scale-95 text-neutral-905 border border-neutral-200/60 p-4 rounded-2xl transition text-left flex items-start gap-4 shadow-sm"
                        >
                          <div className={`w-10 h-10 ${act.colorClass} rounded-xl flex items-center justify-center shrink-0 shadow-inner`}>
                            {act.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-black uppercase tracking-tight text-neutral-800 line-clamp-1">{act.title}</p>
                            <p className="text-[9px] text-neutral-400 font-medium leading-relaxed uppercase mt-0.5 line-clamp-2">
                              {act.description}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="space-y-5 animate-fade-in">
                    {/* Calibration Presets Section */}
                    <div className="space-y-2.5">
                      <h4 className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Layout Preset Presets</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'packing', label: 'Packing View', desc: 'Preps, checklists, container cases', color: 'border-orange-100 hover:bg-orange-50/10' },
                          { id: 'inventory', label: 'Inventory Mode', desc: 'Multi-warehouse sheets, vendor directory', color: 'border-teal-100 hover:bg-teal-50/10' },
                          { id: 'tagging', label: 'Tagging View', desc: 'Barcodes sheets, check-outs, calibration', color: 'border-rose-100 hover:bg-rose-50/10' },
                          { id: 'max', label: 'Max (All Enabled)', desc: 'Full-featured enterprise setup workspace', color: 'border-neutral-200 hover:bg-neutral-55/10' }
                        ].map((pres) => {
                          const active = user.activeWorkspacePreset === pres.id;
                          return (
                            <button
                              key={pres.id}
                              type="button"
                              onClick={() => applyPresetLayout(pres.id as any)}
                              className={`p-3 text-left border rounded-xl transition-all relative ${pres.color} ${
                                active ? 'ring-2 ring-neutral-900 bg-neutral-90 px-3 border-neutral-700' : ''
                              }`}
                            >
                              {active && (
                                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#ff4f3a]" />
                              )}
                              <p className="text-[10px] font-black uppercase text-neutral-800 tracking-tight">{pres.label}</p>
                              <p className="text-[8px] leading-tight text-neutral-400 font-bold mt-1 uppercase">{pres.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Dynamic Custom Shortcuts list */}
                    <div className="space-y-2">
                      <h4 className="text-[9px] font-black uppercase tracking-widest text-neutral-400 font-bold">My Custom Setup Buttons</h4>
                      {(user.customPresets && user.customPresets.length > 0) ? (
                        <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                          {user.customPresets.map((preset) => {
                            const active = user.activeWorkspacePreset === preset.id;
                            return (
                              <div 
                                key={preset.id}
                                className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                                  active ? 'border-[#ff4f3a] bg-rose-50/10' : 'border-neutral-200 bg-white hover:bg-neutral-50'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => applyCustomPreset(preset)}
                                  className="flex-1 text-left min-w-0"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <LayoutGrid size={11} className="text-neutral-500 shrink-0" />
                                    <span className="text-[10px] font-black uppercase tracking-tight text-neutral-800 truncate">
                                      {preset.name}
                                    </span>
                                  </div>
                                  <p className="text-[8px] font-mono uppercase text-neutral-400 font-bold ml-4">
                                    {11 - (preset.disabledFeatures?.length || 0)} modules active
                                  </p>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCustomPreset(preset.id, preset.name)}
                                  className="p-1 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded transition shrink-0"
                                  title="Remove customized button shortcut"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-3 bg-neutral-50 rounded-xl border border-dashed border-neutral-150 text-center text-[8.5px] font-semibold text-neutral-400 leading-normal">
                          No custom presets defined yet. Compile your chosen deck using checkout form below.
                        </div>
                      )}
                    </div>

                    {/* Composite Custom Preset constructor form */}
                    <form onSubmit={handleCreateCustomPreset} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-150 space-y-3.5">
                      <div className="space-y-1">
                        <h5 className="text-[9px] font-black uppercase tracking-widest text-[#ff4f3a]">Create Action Custom Button</h5>
                        <p className="text-[8px] font-semibold text-neutral-400 leading-normal">Construct customized modules configurations presets and add to dynamic tabs list.</p>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[8px] font-black uppercase tracking-wider text-neutral-400">Preset Tab Title</label>
                        <input
                          type="text"
                          value={customPresetName}
                          onChange={(e) => setCustomPresetName(e.target.value)}
                          placeholder="e.g. Field Supervisor View"
                          className="w-full px-3 py-2 bg-white border border-neutral-200 rounded-lg text-[10px] font-semibold text-neutral-800 focus:outline-none focus:border-[#ff4f3a]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[8px] font-black uppercase tracking-wider text-neutral-400">Toggle active layers</label>
                        <div className="grid grid-cols-2 gap-1 max-h-[120px] overflow-y-auto pr-1">
                          {CALIBRATION_FEATURES.map((feat) => {
                            const checked = selectedCustomFeatures.has(feat.key);
                            return (
                              <button
                                key={feat.key}
                                type="button"
                                onClick={() => toggleCustomFeatureItem(feat.key)}
                                className={`p-1.5 text-left border rounded text-[8px] transition-all flex items-center justify-between ${
                                  checked ? 'bg-neutral-900 border-neutral-900 text-white font-black uppercase' : 'bg-white border-neutral-200 text-neutral-400 font-bold uppercase hover:bg-neutral-100'
                                }`}
                              >
                                <span className="truncate pr-1">{feat.label}</span>
                                {checked && <Check size={8} strokeWidth={4} className="shrink-0 text-white" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white hover:text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition shadow flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus size={10} strokeWidth={3} />
                        Save Preset Button
                      </button>
                    </form>

                    {/* Relaunch Onboarder Link/Button */}
                    <div className="pt-2 border-t border-neutral-150">
                      <button
                        type="button"
                        onClick={async () => {
                          if (confirm("Relaunching setup wizard will temporarily overlay the screen until completed. Proceed?")) {
                            try {
                              await updateDoc(doc(db, 'users', user.uid), {
                                onboardingCompleted: false
                              });
                              setIsOpen(false);
                              toast.info("Relaunching setup calibration wizard walkthrough...");
                            } catch (e) {
                              console.error(e);
                              toast.error("Failed to relaunch calibration.");
                            }
                          }
                        }}
                        className="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg text-[8.5px] font-black uppercase tracking-widest transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <SlidersHorizontal size={10} />
                        Relaunch Setup Wizard
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Drawer Footer info details */}
              <div className="bg-neutral-50 px-6 py-4 border-t border-neutral-150 flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-neutral-400 shrink-0">
                <span>Preset Setup Mode({user.activeWorkspacePreset || 'none'})</span>
                <span>Calibrated</span>
              </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* DIALOG 1: Asset Tags printable sheet overlay */}
      <QRPrintModal 
        isOpen={activeModal === 'tags'} 
        onClose={() => setActiveModal('none')} 
        items={gearList} 
        user={user} 
      />

      {/* DIALOG 2: Interactive Maintenance Inspection entry logger */}
      <AnimatePresence>
        {activeModal === 'maintenance' && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveModal('none')}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] p-8 border border-neutral-100 shadow-2xl space-y-6"
            >
              <div className="space-y-1">
                <h3 className="text-xl font-black uppercase tracking-tighter">Inspections & Maintenance Log</h3>
                <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Update checkup history to keep assets certified</p>
              </div>

              <form onSubmit={handleLogMaintenanceSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Select Equipment Item</label>
                  <select
                    value={selectedGearId}
                    onChange={(e) => setSelectedGearId(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3.5 text-xs font-semibold outline-none focus:bg-white cursor-pointer"
                  >
                    <option value="">-- PICK INVENTORY GEAR --</option>
                    {gearList.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.brand || 'Any'} {item.model || ''}) - Status: {item.status}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Notes & Inspection Parameters</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Conducted performance output benchmarking, verified power connector terminals, cleaned fan shroud grids..."
                    value={maintenanceNotes}
                    onChange={(e) => setMaintenanceNotes(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-xs font-semibold outline-none focus:bg-white leading-relaxed"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveModal('none')}
                    className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl py-3.5 text-[10px] font-black uppercase tracking-widest transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingMaintenance}
                    className="flex-1 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl py-3.5 text-[10px] font-black uppercase tracking-widest disabled:opacity-40 transition flex items-center justify-center gap-2"
                  >
                    {isSavingMaintenance ? 'Saving record...' : 'Confirm Inspection'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DIALOG 3: Insurance replacement valuation metrics report */}
      <AnimatePresence>
        {activeModal === 'insurance' && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveModal('none')}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-xl bg-white rounded-[2.5rem] p-8 border border-neutral-100 shadow-2xl space-y-6 overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-xl font-black uppercase tracking-tighter">Insurance Valuation Audit</h3>
                  <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Aggregate inventory specifications values for underwriting</p>
                </div>
                <button
                  onClick={() => setActiveModal('none')}
                  className="bg-neutral-50 border border-neutral-200 text-[10px] font-black uppercase py-2 px-3 rounded-lg hover:bg-neutral-100 transition"
                >
                  Close
                </button>
              </div>

              {/* Insurance report body cards */}
              <div className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
                    <p className="text-[8px] font-black uppercase tracking-widest text-neutral-400">Inventory Valuation</p>
                    <p className="text-xl font-black text-neutral-800 mt-1">${totalValuation.toLocaleString()}</p>
                  </div>
                  <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
                    <p className="text-[8px] font-black uppercase tracking-widest text-neutral-400">Total Units catalogued</p>
                    <p className="text-xl font-black text-neutral-800 mt-1">{totalItemCount} Items</p>
                  </div>
                </div>

                <div className="bg-neutral-50 p-5 rounded-[2rem] border border-neutral-100 space-y-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Valuation Metrics</p>
                  
                  <div className="flex justify-between items-center text-xs text-neutral-600 border-b border-neutral-200/60 pb-2">
                    <span className="font-semibold uppercase text-[10px]">Average Value per Item</span>
                    <span className="font-black">${averageValue.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs text-neutral-600 border-b border-neutral-200/60 pb-2">
                    <span className="font-semibold uppercase text-[10px]">Highest Value Asset</span>
                    <span className="font-black text-neutral-800 truncate max-w-[200px]" title={maxPriceItem.name}>
                      {maxPriceItem.name}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs text-neutral-600">
                    <span className="font-semibold uppercase text-[10px]">Maximum Single Unit Cost</span>
                    <span className="font-black text-neutral-800">${(maxPriceItem.price || 0).toLocaleString()}</span>
                  </div>
                </div>

                <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 flex gap-3 text-[10px] text-blue-800 leading-relaxed">
                  <Info size={16} className="shrink-0 mt-0.5 text-blue-600" />
                  <p>
                    This report compiles the replacement value of all items in your master Gear library. Keep tags updated and retain invoices to guarantee quick claims fulfillment in case of dispatch loss.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
