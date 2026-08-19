import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Battery, 
  BatteryCharging, 
  Zap, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Sliders, 
  RotateCcw, 
  Flame, 
  Thermometer, 
  Gauge, 
  FileText,
  User,
  Plus
} from 'lucide-react';
import { doc, updateDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { GearItem, UserProfile, BatteryLog, BatteryHealthStatus } from '../types';
import { 
  calculateWh, 
  determineHealthStatus, 
  getBatteryStatusTheme, 
  estimateDegradationSOH,
  CHEMISTRY_PROFILES 
} from '../utils/batteryLifecycle';
import { hapticLight, hapticSuccess } from '../utils/haptics';
import { toast } from 'sonner';

interface BatteryTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  battery?: GearItem | null;
  allBatteries?: GearItem[];
  user: UserProfile | null;
  onSuccess?: (updatedBattery: GearItem) => void;
}

export default function BatteryTestModal({
  isOpen,
  onClose,
  battery: initialBattery,
  allBatteries = [],
  user,
  onSuccess
}: BatteryTestModalProps) {
  const [selectedBatteryId, setSelectedBatteryId] = useState<string>(initialBattery?.id || '');
  const [activeBattery, setActiveBattery] = useState<GearItem | null>(initialBattery || null);

  // Form State
  const [diagnosticType, setDiagnosticType] = useState<BatteryLog['diagnosticType']>('routine_cycle');
  const [cycleIncrement, setCycleIncrement] = useState<number>(1);
  const [exactCycles, setExactCycles] = useState<number>(0);
  const [useExactCycles, setUseExactCycles] = useState<boolean>(false);
  
  const [entryMode, setEntryMode] = useState<'health_pct' | 'measured_capacity'>('health_pct');
  const [healthPercentage, setHealthPercentage] = useState<number>(95);
  const [measuredMah, setMeasuredMah] = useState<number>(0);
  const [measuredWh, setMeasuredWh] = useState<number>(0);
  
  const [voltage, setVoltage] = useState<number>(14.8);
  const [internalResistance, setInternalResistance] = useState<number>(45);
  const [temperature, setTemperature] = useState<number>(24);
  const [chargePercentage, setChargePercentage] = useState<number>(100);
  const [notes, setNotes] = useState<string>('');
  const [testerName, setTesterName] = useState<string>(user?.displayName || user?.email || 'Lead Technician');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Synchronize when battery prop changes
  useEffect(() => {
    if (initialBattery) {
      setActiveBattery(initialBattery);
      setSelectedBatteryId(initialBattery.id);
      populateFromBattery(initialBattery);
    } else if (allBatteries.length > 0 && !selectedBatteryId) {
      setActiveBattery(allBatteries[0]);
      setSelectedBatteryId(allBatteries[0].id);
      populateFromBattery(allBatteries[0]);
    }
  }, [initialBattery, allBatteries]);

  const handleSelectBattery = (bId: string) => {
    setSelectedBatteryId(bId);
    const found = allBatteries.find(b => b.id === bId);
    if (found) {
      setActiveBattery(found);
      populateFromBattery(found);
    }
  };

  const populateFromBattery = (target: GearItem) => {
    const currentCycles = target.batteryCycleCount || 0;
    setExactCycles(currentCycles + 1);
    setCycleIncrement(1);
    
    const ratedCycles = target.batteryMaxCycles || 500;
    const existingHealth = target.batteryHealthPercentage !== undefined 
      ? target.batteryHealthPercentage 
      : estimateDegradationSOH(currentCycles, ratedCycles);
      
    setHealthPercentage(existingHealth);
    
    // Set voltage
    const chemProfile = target.batteryChemistry ? CHEMISTRY_PROFILES[target.batteryChemistry] : null;
    const nominalV = target.batteryVoltage || chemProfile?.nominalVoltage || 14.8;
    setVoltage(nominalV);
    
    // Set initial capacity
    if (target.batteryCapacityMah) {
      setMeasuredMah(Math.round((target.batteryCapacityMah * existingHealth) / 100));
    }
    if (target.batteryCapacityWh) {
      setMeasuredWh(Math.round((target.batteryCapacityWh * existingHealth) / 100));
    }
    
    setInternalResistance(target.batteryInternalResistanceMOhms || 45);
    setNotes('');
  };

  // Recalculate health % if entering measured capacity
  const handleMeasuredCapacityChange = (val: number, type: 'mah' | 'wh') => {
    if (!activeBattery) return;
    if (type === 'mah') {
      setMeasuredMah(val);
      const rated = activeBattery.batteryCapacityMah || 0;
      if (rated > 0) {
        const pct = Math.min(100, Math.max(0, Math.round((val / rated) * 100)));
        setHealthPercentage(pct);
      }
    } else {
      setMeasuredWh(val);
      const rated = activeBattery.batteryCapacityWh || calculateWh(activeBattery.batteryCapacityMah, activeBattery.batteryVoltage);
      if (rated > 0) {
        const pct = Math.min(100, Math.max(0, Math.round((val / rated) * 100)));
        setHealthPercentage(pct);
      }
    }
  };

  // Calculate prospective status
  const prospectiveCycles = useExactCycles ? exactCycles : ((activeBattery?.batteryCycleCount || 0) + cycleIncrement);
  const prospectiveStatus: BatteryHealthStatus = determineHealthStatus(
    healthPercentage,
    prospectiveCycles,
    activeBattery?.batteryMaxCycles || 500,
    internalResistance,
    activeBattery?.batteryChemistry
  );

  const statusTheme = getBatteryStatusTheme(prospectiveStatus);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBattery) {
      toast.error("Please select an equipment asset to log battery diagnostics.");
      return;
    }

    try {
      setIsSubmitting(true);
      hapticLight();

      const newLogId = `blog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const nowIso = new Date().toISOString();

      const newLog: BatteryLog = {
        id: newLogId,
        timestamp: nowIso,
        cycleCount: prospectiveCycles,
        healthPercentage,
        voltage,
        capacityActualMah: measuredMah > 0 ? measuredMah : undefined,
        capacityActualWh: measuredWh > 0 ? measuredWh : undefined,
        internalResistanceMOhms: internalResistance > 0 ? internalResistance : undefined,
        temperatureCelsius: temperature,
        status: prospectiveStatus,
        notes: notes.trim() || undefined,
        recordedBy: testerName.trim() || user?.email || 'Field Inspector',
        chargePercentage,
        diagnosticType
      };

      const existingLogs: BatteryLog[] = activeBattery.batteryLogs || [];
      const updatedLogs = [newLog, ...existingLogs].slice(0, 50); // Keep last 50 telemetry logs

      // Determine document reference location (handles both root gear collection and user subcollection)
      const updates = {
        isBattery: true,
        batteryCycleCount: prospectiveCycles,
        batteryHealthPercentage: healthPercentage,
        batteryHealthStatus: prospectiveStatus,
        batteryLastTestedDate: nowIso.split('T')[0],
        batteryInternalResistanceMOhms: internalResistance,
        batteryLogs: updatedLogs,
        updatedAt: nowIso
      };

      // Try updating in root gear collection first, fallback to user's gearLibrary if needed
      try {
        const gearDocRef = doc(db, 'gear', activeBattery.id);
        await updateDoc(gearDocRef, updates);
      } catch (err) {
        if (user?.uid) {
          const userGearRef = doc(db, 'users', user.uid, 'gearLibrary', activeBattery.id);
          await updateDoc(userGearRef, updates);
        }
      }

      hapticSuccess();
      toast.success(`Logged ${diagnosticType.replace('_', ' ')} for ${activeBattery.name}!`, {
        description: `Cycles: ${prospectiveCycles} | Health: ${healthPercentage}% (${prospectiveStatus.toUpperCase()})`
      });

      const updatedAsset: GearItem = {
        ...activeBattery,
        ...updates
      };

      if (onSuccess) {
        onSuccess(updatedAsset);
      }

      onClose();
    } catch (err: any) {
      console.error('Error logging battery lifecycle diagnostic:', err);
      toast.error('Failed to record battery diagnostic: ' + (err.message || 'Unknown database error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                <BatteryCharging size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                  Log Battery Diagnostic Test
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Record usage cycles, State of Health (SOH), and electrical telemetry
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition"
            >
              <X size={20} />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
            {/* Battery Asset Selector if multiple available */}
            {allBatteries.length > 1 && !initialBattery && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Target Battery Asset
                </label>
                <select
                  value={selectedBatteryId}
                  onChange={(e) => handleSelectBattery(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium focus:ring-2 focus:ring-accent outline-none"
                >
                  {allBatteries.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.assetTag ? `[${b.assetTag}]` : ''} - {b.batteryChemistry || 'Battery'} ({b.batteryCycleCount || 0} cycles)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Active Battery Summary Card */}
            {activeBattery && (
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-[200px]">
                  <div className="w-12 h-12 rounded-xl bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center overflow-hidden shrink-0">
                    {activeBattery.photoUrls && activeBattery.photoUrls[0] ? (
                      <img src={activeBattery.photoUrls[0]} alt={activeBattery.name} className="w-full h-full object-cover" />
                    ) : (
                      <Battery className="text-neutral-500" size={24} />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-neutral-900 dark:text-white text-sm">
                      {activeBattery.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                      <span className="font-semibold text-accent">{activeBattery.assetTag || 'NO-TAG'}</span>
                      <span>•</span>
                      <span>{activeBattery.batteryChemistry || 'Li-ion'}</span>
                      {activeBattery.batteryCapacityWh && (
                        <>
                          <span>•</span>
                          <span>{activeBattery.batteryCapacityWh} Wh</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs text-neutral-400">Current Lifecycle</div>
                    <div className="text-sm font-bold text-neutral-900 dark:text-white">
                      {activeBattery.batteryCycleCount || 0} / {activeBattery.batteryMaxCycles || 500} Cycles
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold border ${statusTheme.bg} ${statusTheme.text} ${statusTheme.border}`}>
                    {statusTheme.label}
                  </div>
                </div>
              </div>
            )}

            {/* Diagnostic Test Mode */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                Diagnostic Test Type
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: 'routine_cycle', label: 'Routine Cycle', desc: 'Shoot check-in/out' },
                  { id: 'bench_test', label: 'Bench Test', desc: 'Capacity load bench' },
                  { id: 'load_test', label: 'Rig Load Test', desc: 'High-draw stress test' },
                  { id: 'calibration', label: 'Fuel Gauge Reset', desc: 'Full cycle reset' },
                  { id: 'field_checkout', label: 'Field Ready QC', desc: 'Pre-flight dispatch' }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setDiagnosticType(item.id as any)}
                    className={`p-2.5 rounded-xl text-left border transition-all ${
                      diagnosticType === item.id
                        ? 'border-accent bg-accent/5 text-neutral-900 dark:text-white ring-1 ring-accent'
                        : 'border-neutral-200 dark:border-neutral-700/80 bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:border-neutral-300'
                    }`}
                  >
                    <div className="font-bold text-xs">{item.label}</div>
                    <div className="text-[10px] text-neutral-400 truncate">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Cycle Count Section */}
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/80 dark:border-neutral-700/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-accent" />
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                    Cycle Log & Counter
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setUseExactCycles(!useExactCycles)}
                  className="text-xs text-accent hover:underline font-medium"
                >
                  {useExactCycles ? 'Switch to Quick Increment' : 'Set Exact Cycle Count'}
                </button>
              </div>

              {!useExactCycles ? (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-neutral-500">Increment by:</span>
                  {[1, 2, 5, 10].map((inc) => (
                    <button
                      key={inc}
                      type="button"
                      onClick={() => setCycleIncrement(inc)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                        cycleIncrement === inc
                          ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-transparent shadow-sm'
                          : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100'
                      }`}
                    >
                      +{inc} {inc === 1 ? 'Cycle' : 'Cycles'}
                    </button>
                  ))}
                  <div className="ml-auto text-xs font-bold text-neutral-600 dark:text-neutral-300">
                    New Total: <span className="text-accent font-extrabold text-sm">{prospectiveCycles}</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <input
                      type="number"
                      min="0"
                      max="10000"
                      value={exactCycles}
                      onChange={(e) => setExactCycles(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-bold"
                    />
                  </div>
                  <span className="text-xs text-neutral-400">Total lifetime discharge cycles</span>
                </div>
              )}
            </div>

            {/* Health / SOH Section */}
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/80 dark:border-neutral-700/50 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gauge size={16} className="text-emerald-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                    State of Health (SOH) & Capacity
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setEntryMode('health_pct')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition ${
                      entryMode === 'health_pct' ? 'bg-emerald-500 text-white font-bold' : 'text-neutral-500'
                    }`}
                  >
                    Percent (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryMode('measured_capacity')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition ${
                      entryMode === 'measured_capacity' ? 'bg-emerald-500 text-white font-bold' : 'text-neutral-500'
                    }`}
                  >
                    Measured mAh/Wh
                  </button>
                </div>
              </div>

              {entryMode === 'health_pct' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-500">Calculated Health Percentage:</span>
                    <span className="text-lg font-extrabold text-neutral-900 dark:text-white">
                      {healthPercentage}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="1"
                    value={healthPercentage}
                    onChange={(e) => setHealthPercentage(parseInt(e.target.value))}
                    className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
                    <span>Critical (10%)</span>
                    <span>Degraded (65%)</span>
                    <span>Good (80%)</span>
                    <span>New (100%)</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-neutral-500">Measured Capacity (mAh)</label>
                    <input
                      type="number"
                      min="0"
                      value={measuredMah}
                      onChange={(e) => handleMeasuredCapacityChange(parseFloat(e.target.value) || 0, 'mah')}
                      placeholder="e.g. 6400"
                      className="w-full mt-1 px-3 py-2 text-sm rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-500">Measured Energy (Wh)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={measuredWh}
                      onChange={(e) => handleMeasuredCapacityChange(parseFloat(e.target.value) || 0, 'wh')}
                      placeholder="e.g. 94.5"
                      className="w-full mt-1 px-3 py-2 text-sm rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-bold"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Electrical Telemetry (Voltage, Internal Resistance, Temperature) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5">
                  <Zap size={14} className="text-amber-500" /> Voltage (V)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="50"
                  value={voltage}
                  onChange={(e) => setVoltage(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5">
                  <Activity size={14} className="text-indigo-500" /> Internal Res. (mΩ)
                </label>
                <input
                  type="number"
                  min="0"
                  max="1000"
                  value={internalResistance}
                  onChange={(e) => setInternalResistance(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5">
                  <Thermometer size={14} className="text-rose-500" /> Temp (°C)
                </label>
                <input
                  type="number"
                  min="-20"
                  max="80"
                  value={temperature}
                  onChange={(e) => setTemperature(parseInt(e.target.value) || 25)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-mono"
                />
              </div>
            </div>

            {/* Inspector Notes & Tester Name */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Technician / Inspector Name
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-3 text-neutral-400" />
                  <input
                    type="text"
                    value={testerName}
                    onChange={(e) => setTesterName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins (Senior Camera Tech)"
                    className="w-full pl-10 pr-3 py-2 text-sm rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Diagnostic Notes & Calibration Observations
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. High draw stress test passed without thermal runaway. Ready for A-cam rig."
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:ring-2 focus:ring-accent outline-none resize-none"
                />
              </div>
            </div>
          </form>

          {/* Footer Actions */}
          <div className="p-4 sm:p-6 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !activeBattery}
              className="px-6 py-2.5 rounded-xl bg-accent text-white font-bold text-sm shadow-md hover:bg-accent/90 transition flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Recording...</span>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Save Diagnostic Log</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
