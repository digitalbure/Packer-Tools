import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Battery, 
  BatteryCharging, 
  Zap, 
  Activity, 
  Plus, 
  Search, 
  Filter, 
  Plane, 
  Sliders, 
  RotateCcw, 
  Download, 
  Printer, 
  AlertTriangle, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  Gauge, 
  LayoutGrid, 
  List as ListIcon, 
  FileSpreadsheet, 
  Info, 
  HelpCircle, 
  TrendingDown, 
  Flame, 
  RefreshCw, 
  ChevronRight, 
  Box, 
  ArrowRight,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { collection, onSnapshot, query, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { GearItem, UserProfile, AdminSettings, BatteryHealthStatus } from '../types';
import { 
  calculateWh, 
  determineHealthStatus, 
  getBatteryStatusTheme, 
  getFlightCompliance, 
  CHEMISTRY_PROFILES, 
  isBatteryAsset,
  estimateDegradationSOH,
  estimateRuntime
} from '../utils/batteryLifecycle';
import BatteryTestModal from '../components/BatteryTestModal';
import BatteryTelemetryDrawer from '../components/BatteryTelemetryDrawer';
import { hapticLight, hapticSuccess } from '../utils/haptics';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

interface BatteryLifecycleModuleProps {
  user: UserProfile | null;
  adminSettings: AdminSettings | null;
}

export default function BatteryLifecycleModule({ user, adminSettings }: BatteryLifecycleModuleProps) {
  const [gearItems, setGearItems] = useState<GearItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [chemistryFilter, setChemistryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'flight'>('grid');
  
  // Modals & Drawers
  const [selectedBatteryForTest, setSelectedBatteryForTest] = useState<GearItem | null>(null);
  const [isTestModalOpen, setIsTestModalOpen] = useState<boolean>(false);
  const [selectedBatteryForDrawer, setSelectedBatteryForDrawer] = useState<GearItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isFlightModalOpen, setIsFlightModalOpen] = useState<boolean>(false);

  // Flight Pack Luggage Checker items
  const [flightPackList, setFlightPackList] = useState<{ [gearId: string]: number }>({});

  // 1. Subscribe to Firestore Gear Collection
  useEffect(() => {
    setLoading(true);
    const unsubGear = onSnapshot(collection(db, 'gear'), (snap) => {
      const items: GearItem[] = [];
      snap.forEach((doc) => {
        const data = doc.data() as GearItem;
        items.push({ ...data, id: doc.id });
      });
      
      // If user has a personal gearLibrary subcollection, listen or merge as well
      if (user?.uid) {
        const userGearRef = collection(db, 'users', user.uid, 'gearLibrary');
        onSnapshot(userGearRef, (userSnap) => {
          const userItems: GearItem[] = [];
          userSnap.forEach((d) => {
            userItems.push({ ...d.data(), id: d.id } as GearItem);
          });
          
          // Combine and deduplicate by ID
          const combinedMap = new Map<string, GearItem>();
          items.forEach(i => combinedMap.set(i.id, i));
          userItems.forEach(i => combinedMap.set(i.id, i));
          
          setGearItems(Array.from(combinedMap.values()));
          setLoading(false);
        }, (err) => {
          console.warn('Personal gear library subcollection read error:', err);
          setGearItems(items);
          setLoading(false);
        });
      } else {
        setGearItems(items);
        setLoading(false);
      }
    }, (error) => {
      console.error('Error listening to gear collection:', error);
      setLoading(false);
    });

    return () => unsubGear();
  }, [user]);

  // 2. Filter exclusively for battery / power assets
  const batteryAssets = useMemo(() => {
    return gearItems.filter(isBatteryAsset).map(item => {
      const currentCycles = item.batteryCycleCount || 0;
      const maxCycles = item.batteryMaxCycles || 500;
      const healthPct = item.batteryHealthPercentage !== undefined 
        ? item.batteryHealthPercentage 
        : estimateDegradationSOH(currentCycles, maxCycles);
      
      const computedStatus = item.batteryHealthStatus || determineHealthStatus(
        healthPct,
        currentCycles,
        maxCycles,
        item.batteryInternalResistanceMOhms,
        item.batteryChemistry
      );

      const wh = calculateWh(item.batteryCapacityMah, item.batteryVoltage, item.batteryCapacityWh);

      return {
        ...item,
        isBattery: true,
        batteryCycleCount: currentCycles,
        batteryMaxCycles: maxCycles,
        batteryHealthPercentage: healthPct,
        batteryHealthStatus: computedStatus,
        batteryCapacityWh: wh
      };
    });
  }, [gearItems]);

  // 3. Computed Fleet Metrics
  const metrics = useMemo(() => {
    const total = batteryAssets.length;
    let totalWh = 0;
    let optimalCount = 0;
    let degradedCount = 0;
    let criticalCount = 0;
    let flightApprovedCount = 0;

    batteryAssets.forEach(b => {
      const wh = b.batteryCapacityWh || 0;
      totalWh += wh;
      
      const status = b.batteryHealthStatus;
      if (status === 'excellent' || status === 'good') {
        optimalCount++;
      } else if (status === 'degraded' || status === 'replace_soon') {
        degradedCount++;
      } else if (status === 'critical') {
        criticalCount++;
      }

      if (wh <= 100) {
        flightApprovedCount++;
      }
    });

    const averageHealth = total > 0 
      ? Math.round(batteryAssets.reduce((acc, b) => acc + (b.batteryHealthPercentage || 100), 0) / total)
      : 100;

    return {
      total,
      totalKWh: (totalWh / 1000).toFixed(2),
      optimalCount,
      degradedCount,
      criticalCount,
      flightApprovedCount,
      averageHealth
    };
  }, [batteryAssets]);

  // 4. Filtered List
  const filteredBatteries = useMemo(() => {
    return batteryAssets.filter(b => {
      // Search match
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchName = b.name.toLowerCase().includes(query);
        const matchTag = (b.assetTag || '').toLowerCase().includes(query);
        const matchBrand = (b.brand || '').toLowerCase().includes(query);
        const matchSerial = (b.serialNumber || '').toLowerCase().includes(query);
        const matchChem = (b.batteryChemistry || '').toLowerCase().includes(query);
        if (!matchName && !matchTag && !matchBrand && !matchSerial && !matchChem) {
          return false;
        }
      }

      // Status match
      if (statusFilter !== 'all') {
        if (statusFilter === 'optimal' && b.batteryHealthStatus !== 'excellent' && b.batteryHealthStatus !== 'good') return false;
        if (statusFilter === 'degraded' && b.batteryHealthStatus !== 'degraded' && b.batteryHealthStatus !== 'replace_soon') return false;
        if (statusFilter === 'critical' && b.batteryHealthStatus !== 'critical') return false;
        if (statusFilter === 'flight_clear' && (b.batteryCapacityWh || 0) > 100) return false;
        if (statusFilter === 'needs_calibration' && b.batteryLastTestedDate) {
          const daysOld = (Date.now() - new Date(b.batteryLastTestedDate).getTime()) / (1000 * 60 * 60 * 24);
          if (daysOld < 90) return false;
        }
      }

      // Chemistry match
      if (chemistryFilter !== 'all' && b.batteryChemistry !== chemistryFilter) {
        return false;
      }

      return true;
    });
  }, [batteryAssets, searchQuery, statusFilter, chemistryFilter]);

  // Quick +1 Cycle Handler
  const handleQuickAddCycle = async (b: GearItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      hapticLight();
      const newCycles = (b.batteryCycleCount || 0) + 1;
      const nowIso = new Date().toISOString();

      const newLog = {
        id: `blog_${Date.now()}`,
        timestamp: nowIso,
        cycleCount: newCycles,
        healthPercentage: b.batteryHealthPercentage || 95,
        status: b.batteryHealthStatus || 'good',
        notes: 'Routine +1 Cycle increment from Fleet Dashboard',
        recordedBy: user?.displayName || user?.email || 'Technician',
        diagnosticType: 'routine_cycle' as const
      };

      const updatedLogs = [newLog, ...(b.batteryLogs || [])].slice(0, 50);

      const updates = {
        batteryCycleCount: newCycles,
        batteryLogs: updatedLogs,
        updatedAt: nowIso
      };

      try {
        await updateDoc(doc(db, 'gear', b.id), updates);
      } catch {
        if (user?.uid) {
          await updateDoc(doc(db, 'users', user.uid, 'gearLibrary', b.id), updates);
        }
      }

      hapticSuccess();
      toast.success(`Incremented cycle for ${b.name} (+1)`, {
        description: `New total: ${newCycles} cycles`
      });
    } catch (err: any) {
      toast.error('Failed to increment cycle: ' + err.message);
    }
  };

  // Export Full Fleet CSV
  const handleExportFleetReport = () => {
    if (batteryAssets.length === 0) {
      toast.error("No battery assets found to export.");
      return;
    }

    const headers = [
      'Asset Name', 'Asset Tag', 'Brand', 'Model', 'Serial Number', 
      'Chemistry', 'Rated Wh', 'Rated mAh', 'Voltage (V)', 
      'Cycle Count', 'Max Rated Cycles', 'State of Health (%)', 
      'Status Tier', 'Flight Compliance', 'Last Calibration Date'
    ];

    const rows = batteryAssets.map(b => {
      const wh = b.batteryCapacityWh || 0;
      const flight = getFlightCompliance(wh);
      return [
        `"${b.name.replace(/"/g, '""')}"`,
        `"${b.assetTag || ''}"`,
        `"${b.brand || ''}"`,
        `"${b.model || ''}"`,
        `"${b.serialNumber || ''}"`,
        b.batteryChemistry || 'Li-ion',
        wh,
        b.batteryCapacityMah || '',
        b.batteryVoltage || '',
        b.batteryCycleCount || 0,
        b.batteryMaxCycles || 500,
        `${b.batteryHealthPercentage || 100}%`,
        b.batteryHealthStatus || 'good',
        `"${flight.label}"`,
        b.batteryLastTestedDate || 'Never'
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `fleet_battery_lifecycle_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Fleet battery report exported!");
  };

  // Trigger Label Studio for Battery
  const handlePrintBatteryTag = (b: GearItem, e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('open-label-studio', { detail: { assetId: b.id, asset: b } }));
    toast.info(`Loaded ${b.name} into Label Studio!`);
  };

  return (
    <div className="min-h-screen bg-neutral-100/60 dark:bg-neutral-950 text-neutral-900 dark:text-white p-4 sm:p-8 space-y-8">
      {/* Header & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl">
              <BatteryCharging size={28} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-900 dark:text-white">
                Battery Lifecycle & Telemetry
              </h1>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
                Live State of Health (SOH) tracking, usage cycle logs, and IATA aviation compliance
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsFlightModalOpen(true)}
            className="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 font-bold text-xs flex items-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 shadow-sm transition"
          >
            <Plane size={15} className="text-sky-500" />
            <span>Flight Luggage Calculator</span>
          </button>

          <button
            type="button"
            onClick={handleExportFleetReport}
            className="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 font-bold text-xs flex items-center gap-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 shadow-sm transition"
          >
            <Download size={15} />
            <span>Export Report (CSV)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedBatteryForTest(null);
              setIsTestModalOpen(true);
            }}
            className="px-5 py-2.5 rounded-xl bg-accent text-white font-bold text-xs flex items-center gap-2 shadow-md hover:bg-accent/90 transition"
          >
            <Activity size={15} />
            <span>Log Diagnostic Test</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Batteries */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Fleet Batteries</span>
            <Battery size={18} className="text-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white">
            {metrics.total}
          </div>
          <div className="text-[11px] text-neutral-400 font-medium">
            {metrics.totalKWh} kWh Stored Energy
          </div>
        </div>

        {/* Fleet Average Health */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Average SOH</span>
            <Gauge size={18} className="text-accent" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white">
            {metrics.averageHealth}%
          </div>
          <div className="text-[11px] text-emerald-500 font-semibold flex items-center gap-1">
            <CheckCircle2 size={12} />
            <span>Fleet health benchmark</span>
          </div>
        </div>

        {/* Optimal Condition */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Optimal (≥80%)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {metrics.optimalCount}
          </div>
          <div className="text-[11px] text-neutral-400">
            Peak mission readiness
          </div>
        </div>

        {/* Degraded / Service Due */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Degraded</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
            {metrics.degradedCount}
          </div>
          <div className="text-[11px] text-neutral-400">
            Capacity 50% - 79%
          </div>
        </div>

        {/* Critical Replacement */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Critical (&lt;50%)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400">
            {metrics.criticalCount}
          </div>
          <div className="text-[11px] text-rose-500 font-semibold">
            {metrics.criticalCount > 0 ? 'Retirement due' : 'Zero critical cells'}
          </div>
        </div>

        {/* Flight Carry-On Clear */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Flight Approved</span>
            <Plane size={18} className="text-sky-500" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-sky-600 dark:text-sky-400">
            {metrics.flightApprovedCount}
          </div>
          <div className="text-[11px] text-neutral-400">
            ≤ 100Wh Carry-on
          </div>
        </div>
      </div>

      {/* Filter and View Controls Bar */}
      <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className="absolute left-3.5 top-3 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by battery name, asset tag, serial number, chemistry, or brand..."
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/60 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:ring-2 focus:ring-accent outline-none"
            />
          </div>

          {/* Chemistry Dropdown & View Mode Switcher */}
          <div className="flex items-center gap-2">
            <select
              value={chemistryFilter}
              onChange={(e) => setChemistryFilter(e.target.value)}
              className="px-3 py-2 text-xs font-bold rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 outline-none"
            >
              <option value="all">All Chemistries</option>
              <option value="V-Mount">V-Mount</option>
              <option value="Gold-Mount">Gold-Mount</option>
              <option value="B-Mount">B-Mount</option>
              <option value="NP-F">Sony NP-F / L-Series</option>
              <option value="BP-U">Sony BP-U</option>
              <option value="Li-ion">Standard Li-ion</option>
              <option value="LiPo">LiPo (Drones)</option>
              <option value="LiFePO4">LiFePO4</option>
            </select>

            <div className="flex items-center p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-700'
                }`}
                title="Grid Cards"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-700'
                }`}
                title="Dense Table"
              >
                <ListIcon size={16} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('flight')}
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'flight'
                    ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-700'
                }`}
                title="Flight Aviation Matrix"
              >
                <Plane size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Filter Status Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <span className="text-[11px] font-bold text-neutral-400 mr-1">Filter:</span>
          {[
            { id: 'all', label: `All (${batteryAssets.length})` },
            { id: 'optimal', label: `Optimal (${metrics.optimalCount})` },
            { id: 'degraded', label: `Degraded (${metrics.degradedCount})` },
            { id: 'critical', label: `Critical (${metrics.criticalCount})` },
            { id: 'flight_clear', label: `≤100Wh Flight Clear (${metrics.flightApprovedCount})` },
            { id: 'needs_calibration', label: 'Overdue Calibration' }
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setStatusFilter(pill.id)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                statusFilter === pill.id
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Asset Viewport */}
      {loading ? (
        <div className="p-16 text-center space-y-3">
          <RefreshCw size={28} className="animate-spin text-accent mx-auto" />
          <div className="text-sm font-bold text-neutral-500">Scanning battery telemetry logs...</div>
        </div>
      ) : filteredBatteries.length === 0 ? (
        <div className="p-16 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto text-neutral-400">
            <Battery size={32} />
          </div>
          <div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-white">
              {batteryAssets.length === 0 ? 'No Battery Assets Configured' : 'No Batteries Match Current Filters'}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md mx-auto mt-1">
              {batteryAssets.length === 0
                ? 'Gear items categorized as Power, or containing battery names (e.g. V-Mount, NP-F, Gold-Mount) will automatically appear here for telemetry tracking.'
                : 'Try adjusting your search keywords or resetting status filters.'}
            </p>
          </div>
          {batteryAssets.length === 0 && (
            <Link
              to="/library?addGear=true"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white font-bold text-xs shadow-md hover:bg-accent/90 transition"
            >
              <Plus size={16} />
              <span>Add Battery Asset in Gear Library</span>
            </Link>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {filteredBatteries.map((b) => {
            const statusTheme = getBatteryStatusTheme(b.batteryHealthStatus || 'good');
            const flight = getFlightCompliance(b.batteryCapacityWh || 0);
            const currentCycles = b.batteryCycleCount || 0;
            const maxCycles = b.batteryMaxCycles || 500;
            const healthPct = b.batteryHealthPercentage || 100;
            const cycleProgress = Math.min(100, Math.round((currentCycles / maxCycles) * 100));

            return (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => {
                  setSelectedBatteryForDrawer(b);
                  setIsDrawerOpen(true);
                }}
                className="p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 hover:border-accent/40 shadow-sm hover:shadow-md transition-all cursor-pointer space-y-4 group flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Top Row: Thumbnail + Identity + Status Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center overflow-hidden shrink-0 border border-neutral-200/60 dark:border-neutral-700/60">
                        {b.photoUrls && b.photoUrls[0] ? (
                          <img src={b.photoUrls[0]} alt={b.name} className="w-full h-full object-cover" />
                        ) : (
                          <Battery className="text-emerald-500" size={24} />
                        )}
                      </div>
                      <div>
                        <div className="text-[11px] font-mono font-bold text-accent">
                          {b.assetTag || 'NO-TAG'}
                        </div>
                        <h3 className="font-bold text-neutral-900 dark:text-white text-sm line-clamp-1 group-hover:text-accent transition">
                          {b.name}
                        </h3>
                        <div className="text-[11px] text-neutral-400">
                          {b.brand || 'Generic'} • {b.batteryChemistry || 'Li-ion'}
                        </div>
                      </div>
                    </div>

                    <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusTheme.bg} ${statusTheme.text} ${statusTheme.border} shrink-0`}>
                      {statusTheme.label}
                    </div>
                  </div>

                  {/* Energy & Capacity Bar */}
                  <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/40 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-500 font-medium">Rated Energy:</span>
                      <span className="font-extrabold text-neutral-900 dark:text-white font-mono">
                        {b.batteryCapacityWh || 0} Wh {b.batteryCapacityMah ? `(${b.batteryCapacityMah} mAh)` : ''}
                      </span>
                    </div>

                    {/* Gauge bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-neutral-400">
                        <span>Cycle Usage</span>
                        <span className="font-bold text-neutral-700 dark:text-neutral-300">
                          {currentCycles} / {maxCycles} ({cycleProgress}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${statusTheme.fillBar} transition-all duration-500`}
                          style={{ width: `${cycleProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Aviation Flight Compliance Badge */}
                  <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/40 dark:border-neutral-700/40">
                    <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
                      <Plane size={13} className={flight.compliance === 'unrestricted' ? 'text-emerald-500' : 'text-amber-500'} />
                      <span className="truncate">{flight.label}</span>
                    </div>
                    <span className="text-[10px] font-bold text-neutral-400">
                      {b.batteryLastTestedDate ? `Tested: ${b.batteryLastTestedDate}` : 'Pending Test'}
                    </span>
                  </div>
                </div>

                {/* Footer Action Strip */}
                <div className="pt-2 flex items-center justify-between border-t border-neutral-100 dark:border-neutral-800 gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleQuickAddCycle(b, e)}
                    className="px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-bold flex items-center gap-1 transition"
                  >
                    <Plus size={13} />
                    <span>+1 Cycle</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => handlePrintBatteryTag(b, e)}
                      className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                      title="Print Barcode Tag"
                    >
                      <Printer size={15} />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBatteryForTest(b);
                        setIsTestModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-accent text-white text-xs font-bold flex items-center gap-1 shadow-sm hover:bg-accent/90 transition"
                    >
                      <Activity size={13} />
                      <span>Test</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : viewMode === 'table' ? (
        /* DENSE TABLE VIEW */
        <div className="rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 uppercase font-bold tracking-wider">
                <tr>
                  <th className="p-4">Asset</th>
                  <th className="p-4">Chemistry</th>
                  <th className="p-4">Rating</th>
                  <th className="p-4">Cycles</th>
                  <th className="p-4">State of Health</th>
                  <th className="p-4">Flight Clearance</th>
                  <th className="p-4">Last Tested</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {filteredBatteries.map((b) => {
                  const statusTheme = getBatteryStatusTheme(b.batteryHealthStatus || 'good');
                  const flight = getFlightCompliance(b.batteryCapacityWh || 0);
                  const currentCycles = b.batteryCycleCount || 0;
                  const maxCycles = b.batteryMaxCycles || 500;
                  const healthPct = b.batteryHealthPercentage || 100;

                  return (
                    <tr 
                      key={b.id}
                      onClick={() => {
                        setSelectedBatteryForDrawer(b);
                        setIsDrawerOpen(true);
                      }}
                      className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition cursor-pointer"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center overflow-hidden shrink-0">
                            {b.photoUrls && b.photoUrls[0] ? (
                              <img src={b.photoUrls[0]} alt={b.name} className="w-full h-full object-cover" />
                            ) : (
                              <Battery className="text-emerald-500" size={16} />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-neutral-900 dark:text-white line-clamp-1">
                              {b.name}
                            </div>
                            <div className="font-mono text-[10px] text-accent">
                              {b.assetTag || 'NO-TAG'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 font-medium text-neutral-600 dark:text-neutral-300">
                        {b.batteryChemistry || 'Li-ion'}
                      </td>

                      <td className="p-4 font-mono font-bold text-neutral-900 dark:text-white">
                        {b.batteryCapacityWh || 0} Wh
                      </td>

                      <td className="p-4">
                        <div className="font-bold text-neutral-900 dark:text-white font-mono">
                          {currentCycles} <span className="text-neutral-400 text-[10px] font-normal">/ {maxCycles}</span>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusTheme.bg} ${statusTheme.text} ${statusTheme.border}`}>
                            {healthPct}% SOH
                          </span>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300 text-[11px]">
                          <Plane size={14} className={flight.compliance === 'unrestricted' ? 'text-emerald-500' : 'text-amber-500'} />
                          <span>{flight.label}</span>
                        </div>
                      </td>

                      <td className="p-4 text-neutral-400 font-mono text-[11px]">
                        {b.batteryLastTestedDate || 'Never'}
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => handleQuickAddCycle(b, e)}
                            className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold hover:bg-neutral-200"
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBatteryForTest(b);
                              setIsTestModalOpen(true);
                            }}
                            className="px-3 py-1 rounded-lg bg-accent text-white font-bold hover:bg-accent/90"
                          >
                            Test
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
      ) : (
        /* FLIGHT AVIATION MATRIX VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: ≤ 100Wh Unrestricted */}
          <div className="p-5 rounded-3xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                <Plane size={18} />
                <span>≤100Wh (Unrestricted Carry-On)</span>
              </div>
              <span className="text-xs font-mono font-extrabold bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                {batteryAssets.filter(b => (b.batteryCapacityWh || 0) <= 100).length} Assets
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              Permitted in passenger carry-on baggage. Most commercial carriers permit up to 20 individual units per passenger.
            </p>

            <div className="space-y-2">
              {batteryAssets.filter(b => (b.batteryCapacityWh || 0) <= 100).map(b => (
                <div
                  key={b.id}
                  onClick={() => {
                    setSelectedBatteryForDrawer(b);
                    setIsDrawerOpen(true);
                  }}
                  className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 flex items-center justify-between cursor-pointer hover:border-emerald-500/40 transition"
                >
                  <div>
                    <div className="font-bold text-xs text-neutral-900 dark:text-white line-clamp-1">{b.name}</div>
                    <div className="text-[10px] text-neutral-400">{b.batteryChemistry || 'Li-ion'} • {b.batteryCapacityWh || 0} Wh</div>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">CLEAR</span>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: 101Wh - 160Wh Special Approval */}
          <div className="p-5 rounded-3xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-sm">
                <Plane size={18} />
                <span>101–160Wh (Special Approval)</span>
              </div>
              <span className="text-xs font-mono font-extrabold bg-amber-500/20 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full">
                {batteryAssets.filter(b => (b.batteryCapacityWh || 0) > 100 && (b.batteryCapacityWh || 0) <= 160).length} Assets
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              Limit of maximum 2 spare batteries per passenger in carry-on. Must be declared at check-in counter.
            </p>

            <div className="space-y-2">
              {batteryAssets.filter(b => (b.batteryCapacityWh || 0) > 100 && (b.batteryCapacityWh || 0) <= 160).map(b => (
                <div
                  key={b.id}
                  onClick={() => {
                    setSelectedBatteryForDrawer(b);
                    setIsDrawerOpen(true);
                  }}
                  className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 flex items-center justify-between cursor-pointer hover:border-amber-500/40 transition"
                >
                  <div>
                    <div className="font-bold text-xs text-neutral-900 dark:text-white line-clamp-1">{b.name}</div>
                    <div className="text-[10px] text-neutral-400">{b.batteryChemistry || 'Li-ion'} • {b.batteryCapacityWh || 0} Wh</div>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">MAX 2/PAX</span>
                </div>
              ))}
            </div>
          </div>

          {/* Column 3: >160Wh Cargo Only */}
          <div className="p-5 rounded-3xl bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-sm">
                <ShieldAlert size={18} />
                <span>&gt;160Wh (Cargo Freight Only)</span>
              </div>
              <span className="text-xs font-mono font-extrabold bg-rose-500/20 text-rose-800 dark:text-rose-300 px-2 py-0.5 rounded-full">
                {batteryAssets.filter(b => (b.batteryCapacityWh || 0) > 160).length} Assets
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              Class 9 Dangerous Goods. Strictly forbidden in passenger aircraft cabins or baggage. Must be shipped via certified air cargo.
            </p>

            <div className="space-y-2">
              {batteryAssets.filter(b => (b.batteryCapacityWh || 0) > 160).map(b => (
                <div
                  key={b.id}
                  onClick={() => {
                    setSelectedBatteryForDrawer(b);
                    setIsDrawerOpen(true);
                  }}
                  className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800 flex items-center justify-between cursor-pointer hover:border-rose-500/40 transition"
                >
                  <div>
                    <div className="font-bold text-xs text-neutral-900 dark:text-white line-clamp-1">{b.name}</div>
                    <div className="text-[10px] text-neutral-400">{b.batteryChemistry || 'Li-ion'} • {b.batteryCapacityWh || 0} Wh</div>
                  </div>
                  <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">CARGO ONLY</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Diagnostic Test Modal */}
      <BatteryTestModal
        isOpen={isTestModalOpen}
        onClose={() => {
          setIsTestModalOpen(false);
          setSelectedBatteryForTest(null);
        }}
        battery={selectedBatteryForTest}
        allBatteries={batteryAssets}
        user={user}
        onSuccess={(updated) => {
          setGearItems(prev => prev.map(item => item.id === updated.id ? updated : item));
        }}
      />

      {/* Historical Telemetry & Discharge Drawer */}
      <BatteryTelemetryDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedBatteryForDrawer(null);
        }}
        battery={selectedBatteryForDrawer}
        user={user}
        onOpenTestModal={(b) => {
          setIsDrawerOpen(false);
          setSelectedBatteryForTest(b);
          setIsTestModalOpen(true);
        }}
        onBatteryUpdated={(updated) => {
          setGearItems(prev => prev.map(item => item.id === updated.id ? updated : item));
          setSelectedBatteryForDrawer(updated);
        }}
      />

      {/* Flight Luggage Packing Assistant Modal */}
      {isFlightModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-xl bg-white dark:bg-neutral-900 rounded-3xl p-6 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-sky-500/10 text-sky-500 rounded-2xl">
                  <Plane size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-neutral-900 dark:text-white text-lg">
                    IATA Flight Luggage Calculator
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Verify compliance for passenger aircraft carry-on bags
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsFlightModalOpen(false)}
                className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                Select Batteries in Flight Bag:
              </div>
              {batteryAssets.map((b) => {
                const count = flightPackList[b.id] || 0;
                const wh = b.batteryCapacityWh || 0;
                const flight = getFlightCompliance(wh);

                return (
                  <div
                    key={b.id}
                    className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/60 dark:border-neutral-700/60 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-bold text-xs text-neutral-900 dark:text-white">{b.name}</div>
                      <div className="text-[10px] text-neutral-400">
                        {wh} Wh • <span className={flight.compliance === 'cargo_only' ? 'text-rose-500 font-bold' : ''}>{flight.label}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const curr = flightPackList[b.id] || 0;
                          if (curr > 0) {
                            setFlightPackList({ ...flightPackList, [b.id]: curr - 1 });
                          }
                        }}
                        className="w-7 h-7 rounded-lg bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 font-bold text-xs"
                      >
                        -
                      </button>
                      <span className="font-bold text-xs w-4 text-center">{count}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const curr = flightPackList[b.id] || 0;
                          setFlightPackList({ ...flightPackList, [b.id]: curr + 1 });
                        }}
                        className="w-7 h-7 rounded-lg bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 font-bold text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Flight Bag Evaluation Result */}
            {(() => {
              let under100Count = 0;
              let mid160Count = 0;
              let over160Count = 0;

              Object.entries(flightPackList).forEach(([bId, qty]) => {
                if (qty <= 0) return;
                const b = batteryAssets.find(x => x.id === bId);
                if (!b) return;
                const wh = b.batteryCapacityWh || 0;
                if (wh <= 100) under100Count += qty;
                else if (wh <= 160) mid160Count += qty;
                else over160Count += qty;
              });

              const isOverCargoRestricted = over160Count > 0;
              const isMidRestricted = mid160Count > 2;

              let verdictText = 'All items compliant for Passenger Carry-On';
              let verdictColor = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';

              if (isOverCargoRestricted) {
                verdictText = `Violates Aviation Safety: ${over160Count} batteries exceed 160Wh and must travel cargo only!`;
                verdictColor = 'bg-rose-500/10 text-rose-600 border-rose-500/20';
              } else if (isMidRestricted) {
                verdictText = `Warning: ${mid160Count} batteries are 101–160Wh (Passenger limit is 2 per person with airline approval).`;
                verdictColor = 'bg-amber-500/10 text-amber-600 border-amber-500/20';
              }

              return (
                <div className={`p-4 rounded-2xl border ${verdictColor} space-y-1`}>
                  <div className="font-bold text-xs">{verdictText}</div>
                  <div className="text-[11px] text-neutral-500">
                    Total: {under100Count} units (≤100Wh) | {mid160Count} units (101–160Wh) | {over160Count} units (&gt;160Wh)
                  </div>
                </div>
              );
            })()}

            <button
              onClick={() => setIsFlightModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold text-xs"
            >
              Done
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
