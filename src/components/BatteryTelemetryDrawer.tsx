import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Battery, 
  BatteryCharging, 
  Zap, 
  Activity, 
  Plane, 
  Clock, 
  Calendar, 
  FileText, 
  Plus, 
  Download, 
  Printer, 
  ShieldCheck, 
  AlertTriangle, 
  Thermometer, 
  TrendingDown, 
  User,
  ChevronRight,
  Gauge
} from 'lucide-react';
import { GearItem, UserProfile, BatteryLog } from '../types';
import { 
  calculateWh, 
  getBatteryStatusTheme, 
  getFlightCompliance, 
  CHEMISTRY_PROFILES,
  estimateRuntime,
  estimateDegradationSOH
} from '../utils/batteryLifecycle';
import { hapticLight, hapticSuccess } from '../utils/haptics';
import { toast } from 'sonner';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface BatteryTelemetryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  battery: GearItem | null;
  user: UserProfile | null;
  onOpenTestModal: (b: GearItem) => void;
  onBatteryUpdated?: (updated: GearItem) => void;
}

export default function BatteryTelemetryDrawer({
  isOpen,
  onClose,
  battery,
  user,
  onOpenTestModal,
  onBatteryUpdated
}: BatteryTelemetryDrawerProps) {
  const [loadWatts, setLoadWatts] = useState<number>(45);
  const [isQuickLogging, setIsQuickLogging] = useState<boolean>(false);

  if (!isOpen || !battery) return null;

  const currentCycles = battery.batteryCycleCount || 0;
  const maxCycles = battery.batteryMaxCycles || 500;
  const healthPct = battery.batteryHealthPercentage !== undefined 
    ? battery.batteryHealthPercentage 
    : estimateDegradationSOH(currentCycles, maxCycles);
  
  const statusTheme = getBatteryStatusTheme(battery.batteryHealthStatus || 'good');
  const wh = calculateWh(battery.batteryCapacityMah, battery.batteryVoltage, battery.batteryCapacityWh);
  const flightInfo = getFlightCompliance(wh);
  const chemProfile = battery.batteryChemistry ? CHEMISTRY_PROFILES[battery.batteryChemistry] : null;
  const runtime = estimateRuntime(wh, healthPct, loadWatts);

  const logs: BatteryLog[] = battery.batteryLogs || [];

  // Quick 1-click cycle increment
  const handleQuickAddCycle = async () => {
    try {
      setIsQuickLogging(true);
      hapticLight();
      const newCycles = currentCycles + 1;
      const nowIso = new Date().toISOString();

      const newLog: BatteryLog = {
        id: `blog_${Date.now()}`,
        timestamp: nowIso,
        cycleCount: newCycles,
        healthPercentage: healthPct,
        status: battery.batteryHealthStatus || 'good',
        notes: 'Routine cycle log from field deployment',
        recordedBy: user?.displayName || user?.email || 'Technician',
        diagnosticType: 'routine_cycle'
      };

      const updatedLogs = [newLog, ...logs].slice(0, 50);

      const updates = {
        batteryCycleCount: newCycles,
        batteryLogs: updatedLogs,
        updatedAt: nowIso
      };

      try {
        await updateDoc(doc(db, 'gear', battery.id), updates);
      } catch {
        if (user?.uid) {
          await updateDoc(doc(db, 'users', user.uid, 'gearLibrary', battery.id), updates);
        }
      }

      hapticSuccess();
      toast.success(`Incremented cycle count for ${battery.name} (+1)`, {
        description: `New total: ${newCycles} cycles`
      });

      if (onBatteryUpdated) {
        onBatteryUpdated({ ...battery, ...updates });
      }
    } catch (err: any) {
      toast.error('Failed to increment cycle: ' + err.message);
    } finally {
      setIsQuickLogging(false);
    }
  };

  // Export CSV of logs
  const handleExportCSV = () => {
    if (logs.length === 0) {
      toast.error("No historical telemetry logs available to export.");
      return;
    }

    const headers = ['Timestamp', 'Cycle Count', 'Health %', 'Status', 'Voltage (V)', 'Actual mAh', 'Resistance (mOhm)', 'Temp (°C)', 'Diagnostic Type', 'Inspector', 'Notes'];
    const rows = logs.map(l => [
      l.timestamp,
      l.cycleCount,
      `${l.healthPercentage}%`,
      l.status,
      l.voltage || '',
      l.capacityActualMah || '',
      l.internalResistanceMOhms || '',
      l.temperatureCelsius || '',
      l.diagnosticType || '',
      `"${(l.recordedBy || '').replace(/"/g, '""')}"`,
      `"${(l.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${battery.name.replace(/[^a-z0-9]/gi, '_')}_battery_telemetry.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Exported battery lifecycle CSV!");
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end">
        {/* Backdrop click */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 shadow-2xl border-l border-neutral-200 dark:border-neutral-800 h-full flex flex-col z-10"
        >
          {/* Header */}
          <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-accent/10 text-accent rounded-2xl">
                <BatteryCharging size={24} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                  Battery Telemetry & Lifecycle
                </h2>
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <span className="font-mono font-bold text-accent">{battery.assetTag || 'NO-TAG'}</span>
                  <span>•</span>
                  <span>{battery.name}</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {/* Main KPI Status Hero */}
            <div className="p-5 rounded-3xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/80 dark:border-neutral-700/60 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-neutral-400 font-bold uppercase tracking-wider">
                    State of Health (SOH)
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black text-neutral-900 dark:text-white">
                      {healthPct}%
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusTheme.bg} ${statusTheme.text} ${statusTheme.border}`}>
                      {statusTheme.label}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-neutral-400 font-bold uppercase tracking-wider">
                    Cycle Usage
                  </div>
                  <div className="text-xl font-bold text-neutral-900 dark:text-white mt-1">
                    {currentCycles} <span className="text-xs text-neutral-400 font-normal">/ {maxCycles} rated</span>
                  </div>
                </div>
              </div>

              {/* Cycle Life Gauge Bar */}
              <div className="space-y-1">
                <div className="w-full h-3 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden flex">
                  <div 
                    className={`h-full ${statusTheme.fillBar} transition-all duration-500`}
                    style={{ width: `${Math.min(100, (currentCycles / maxCycles) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-neutral-400">
                  <span>Cycle 0 (Brand New)</span>
                  <span>{Math.round((currentCycles / maxCycles) * 100)}% Rated Life Expended</span>
                  <span>{maxCycles} Cycles</span>
                </div>
              </div>

              {/* Action bar for current battery */}
              <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-neutral-200/60 dark:border-neutral-700/40">
                <button
                  type="button"
                  onClick={handleQuickAddCycle}
                  disabled={isQuickLogging}
                  className="px-3.5 py-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-bold flex items-center gap-1.5 shadow-sm hover:scale-105 active:scale-95 transition"
                >
                  <Plus size={14} />
                  <span>+1 Cycle Log</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenTestModal(battery)}
                  className="px-3.5 py-2 rounded-xl bg-accent text-white text-xs font-bold flex items-center gap-1.5 shadow-sm hover:bg-accent/90 transition"
                >
                  <Activity size={14} />
                  <span>Record Diagnostic Test</span>
                </button>

                {logs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold flex items-center gap-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition ml-auto"
                  >
                    <Download size={14} />
                    <span>CSV</span>
                  </button>
                )}
              </div>
            </div>

            {/* Aviation / Flight Compliance Badge */}
            <div className={`p-4 rounded-2xl border ${flightInfo.badgeBg} ${flightInfo.badgeBorder} space-y-2`}>
              <div className="flex items-center gap-2">
                <Plane size={18} className={flightInfo.badgeText} />
                <span className={`text-sm font-bold ${flightInfo.badgeText}`}>
                  {flightInfo.label}
                </span>
                <span className="ml-auto text-xs font-mono font-extrabold px-2 py-0.5 rounded bg-white/60 dark:bg-black/40">
                  {wh} Watt-Hours
                </span>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-300">
                {flightInfo.summary}. {flightInfo.details}
              </p>
              <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 bg-white/40 dark:bg-black/20 p-2 rounded-xl">
                ⚠️ {flightInfo.airlineRule}
              </div>
            </div>

            {/* Real-time Runtime Estimator */}
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/80 dark:border-neutral-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-accent" />
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                    Estimated Field Runtime
                  </span>
                </div>
                <div className="text-sm font-bold text-neutral-900 dark:text-white">
                  {runtime.formatted} <span className="text-xs font-normal text-neutral-400">at {loadWatts}W load</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-neutral-500">
                  <span>Simulate Rig Power Draw:</span>
                  <span className="font-bold">{loadWatts} Watts</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="250"
                  step="5"
                  value={loadWatts}
                  onChange={(e) => setLoadWatts(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-accent"
                />
                <div className="flex justify-between text-[10px] text-neutral-400">
                  <span>Monitor (15W)</span>
                  <span>Cinema Rig (50W)</span>
                  <span>LED Key Light (120W)</span>
                  <span>Heavy Rig (250W)</span>
                </div>
              </div>
            </div>

            {/* Electrical Specifications Grid */}
            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Electrical Specifications
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-700/50">
                  <div className="text-[10px] text-neutral-400 uppercase font-bold">Chemistry</div>
                  <div className="text-xs font-bold text-neutral-900 dark:text-white mt-0.5">
                    {battery.batteryChemistry || 'Li-ion'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-700/50">
                  <div className="text-[10px] text-neutral-400 uppercase font-bold">Nominal Voltage</div>
                  <div className="text-xs font-bold text-neutral-900 dark:text-white mt-0.5">
                    {battery.batteryVoltage || chemProfile?.nominalVoltage || 14.8} V
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-700/50">
                  <div className="text-[10px] text-neutral-400 uppercase font-bold">Rated Capacity</div>
                  <div className="text-xs font-bold text-neutral-900 dark:text-white mt-0.5">
                    {battery.batteryCapacityMah ? `${battery.batteryCapacityMah} mAh` : `${wh} Wh`}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-700/50">
                  <div className="text-[10px] text-neutral-400 uppercase font-bold">Internal Resistance</div>
                  <div className="text-xs font-bold text-neutral-900 dark:text-white mt-0.5">
                    {battery.batteryInternalResistanceMOhms ? `${battery.batteryInternalResistanceMOhms} mΩ` : '45 mΩ (Norm)'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-700/50">
                  <div className="text-[10px] text-neutral-400 uppercase font-bold">Last Tested Date</div>
                  <div className="text-xs font-bold text-neutral-900 dark:text-white mt-0.5">
                    {battery.batteryLastTestedDate || 'Pending Calibration'}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-700/50">
                  <div className="text-[10px] text-neutral-400 uppercase font-bold">Serial Number</div>
                  <div className="text-xs font-bold text-neutral-900 dark:text-white mt-0.5 truncate font-mono">
                    {battery.serialNumber || 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* Diagnostic Logs Timeline */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Historical Telemetry Logs ({logs.length})
                </div>
                {logs.length > 0 && (
                  <span className="text-[10px] text-neutral-400">Showing newest to oldest</span>
                )}
              </div>

              {logs.length === 0 ? (
                <div className="p-8 rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800 text-center space-y-2">
                  <Activity size={28} className="mx-auto text-neutral-400" />
                  <div className="text-xs font-bold text-neutral-600 dark:text-neutral-300">
                    No Telemetry Records Found
                  </div>
                  <p className="text-[11px] text-neutral-400 max-w-sm mx-auto">
                    Click "Record Diagnostic Test" or "+1 Cycle Log" to begin logging load tests and health calibrations for this asset.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log, idx) => {
                    const logTheme = getBatteryStatusTheme(log.status);
                    return (
                      <div
                        key={log.id || idx}
                        className="p-3.5 rounded-2xl bg-neutral-50/80 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/50 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${logTheme.indicator}`} />
                            <span className="text-xs font-bold text-neutral-900 dark:text-white capitalize">
                              {(log.diagnosticType || 'routine_cycle').replace('_', ' ')}
                            </span>
                            <span className="text-[10px] text-neutral-400 font-mono">
                              Cycle #{log.cycleCount}
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                            {log.healthPercentage}% SOH
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-neutral-500 dark:text-neutral-400 pt-1 border-t border-neutral-200/40 dark:border-neutral-700/30">
                          <div>
                            <span className="text-neutral-400">Voltage: </span>
                            <span className="font-semibold">{log.voltage ? `${log.voltage}V` : '—'}</span>
                          </div>
                          <div>
                            <span className="text-neutral-400">Resistance: </span>
                            <span className="font-semibold">{log.internalResistanceMOhms ? `${log.internalResistanceMOhms} mΩ` : '—'}</span>
                          </div>
                          <div>
                            <span className="text-neutral-400">Inspector: </span>
                            <span className="font-semibold truncate">{log.recordedBy || 'Tech'}</span>
                          </div>
                          <div>
                            <span className="text-neutral-400">Date: </span>
                            <span className="font-semibold">{new Date(log.timestamp).toLocaleDateString()}</span>
                          </div>
                        </div>

                        {log.notes && (
                          <div className="text-[11px] text-neutral-600 dark:text-neutral-300 bg-white/60 dark:bg-neutral-800/80 p-2 rounded-xl border border-neutral-200/40 dark:border-neutral-700/40">
                            💬 {log.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-6 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-between">
            <div className="text-xs text-neutral-500">
              Asset ID: <span className="font-mono">{battery.id.substring(0, 8)}...</span>
            </div>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold text-xs hover:bg-neutral-800 dark:hover:bg-neutral-100 transition"
            >
              Close Drawer
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
