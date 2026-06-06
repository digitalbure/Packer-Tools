import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, GearItem } from '../types';
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
  BookOpen
} from 'lucide-react';
import { toast } from 'sonner';

interface QuickActionsDrawerProps {
  user: UserProfile;
}

export default function QuickActionsDrawer({ user }: QuickActionsDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [gearList, setGearList] = useState<GearItem[]>([]);
  const [activeModal, setActiveModal] = useState<'none' | 'tags' | 'maintenance' | 'insurance'>('none');
  
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
        title: "Print QR Barcode Tags",
        description: "Open printable label sheet overlay with physical ID tracking details.",
        icon: <Printer size={18} />,
        onClick: () => {
          setIsOpen(false);
          setActiveModal('tags');
        },
        colorClass: "bg-blue-50 text-blue-600"
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
          <span className="absolute right-full mr-3.5 bg-neutral-955 text-white text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap shadow-xl pointer-events-none border border-neutral-800 translate-x-2 group-hover:translate-x-0 leading-none">
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
              className="relative w-full max-w-[380px] h-full bg-white shadow-2xl border-l border-neutral-100 flex flex-col justify-between overflow-hidden"
            >
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

              {/* Drawer Body content (scrollable) */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                
                {/* Dynamically Styled Context Highlight card */}
                <div className="bg-neutral-900 text-white rounded-2xl p-4 border border-neutral-800 text-[10px] leading-relaxed shadow-md">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#ff4f3a] animate-ping" />
                    <span className="font-mono text-[8px] font-black uppercase tracking-widest text-[#ff4f3a]">{contextTitle}</span>
                  </div>
                  <p className="font-semibold text-neutral-300">
                    {contextDesc}
                  </p>
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
                        <p className="text-[9px] text-neutral-400 font-medium leading-relaxed uppercase mt-0.5 mt-0.5 line-clamp-2">
                          {act.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Drawer Footer info details */}
              <div className="bg-neutral-50 px-6 py-4 border-t border-neutral-150 flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-neutral-400">
                <span>Adaptive Context mode</span>
                <span>Active</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* DIALOG 1: Asset Tags printable sheet overlay */}
      <AnimatePresence>
        {activeModal === 'tags' && (
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
              className="relative w-full max-w-4xl bg-white rounded-[2.5rem] p-8 border border-neutral-100 shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tighter">Printable Asset Tags</h3>
                  <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Self adhesive label layouts printable on standard A4 / Letter grids</p>
                </div>
                <div className="flex gap-2.5">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl px-4 py-2.5 text-[9px] font-black uppercase tracking-widest shadow-md transition"
                  >
                    <Printer size={12} />
                    <span>Print Tags</span>
                  </button>
                  <button
                    onClick={() => setActiveModal('none')}
                    className="bg-neutral-150 hover:bg-neutral-200 text-neutral-600 rounded-xl px-4 py-2.5 text-[9px] font-black tracking-widest uppercase transition"
                  >
                    Close
                  </button>
                </div>
              </div>

              {gearList.length === 0 ? (
                <div className="text-center py-16 border border-dashed rounded-3xl text-neutral-400 font-bold uppercase text-xs">
                  No active equipment listed in catalog to populate labels.
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 border-t border-neutral-100 pt-6 print:grid-cols-2">
                  {gearList.map(item => (
                    <div 
                      key={item.id} 
                      className="border border-neutral-200 rounded-2xl p-4 bg-white hover:border-black transition flex items-center justify-between gap-4 break-inside-avoid shadow-xs cursor-pointer hover:shadow-md"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <p className="text-[10px] font-black uppercase text-black line-clamp-1">{item.name}</p>
                        <p className="text-[7.5px] text-neutral-400 font-extrabold uppercase mt-0.5">
                          {item.brand || 'ANY'} • {item.model || 'GENERIC'}
                        </p>
                        <p className="text-[8.5px] font-mono tracking-wider text-neutral-900 font-black">
                          ID: {item.assetTag || 'VIRT-TAG'}
                        </p>
                      </div>

                      <div className="w-14 h-14 bg-neutral-50 rounded-xl border border-neutral-100 shrink-0 flex items-center justify-center text-neutral-400 font-mono text-[6px]">
                        {/* Elegant Simulated QR tag block */}
                        <div className="w-10 h-10 grid grid-cols-5 gap-0.5">
                          {Array.from({ length: 25 }).map((_, i) => (
                            <div 
                              key={i} 
                              className={`rounded-xs ${((i % 2 === 0 && i % 3 === 0) || i === 0 || i === 4 || i === 20 || i === 24) ? 'bg-neutral-900' : 'bg-transparent'}`} 
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
