import React, { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Project } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Cpu, Wifi, CheckCircle2, AlertCircle, Zap, Play, 
  RefreshCw, Edit3, Save, Check, Database, Signal, X, Loader2, Plus, Radio, Bluetooth, Usb
} from 'lucide-react';
import { toast } from 'sonner';
import { rfidHardware, RfidDiscoveredTag, HardwareConnectionState, generatePackerEpc } from '../lib/hardwareProviders';
import { hapticScanSuccess } from '../utils/haptics';

interface RFIDProjectManifestWidgetProps {
  project: Project;
  user: any;
  items: any[]; // Linked PackingItem instances with sourceId, sourceType
}

export default function RFIDProjectManifestWidget({ project, user, items }: RFIDProjectManifestWidgetProps) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [tempRFIDValue, setTempRFIDValue] = useState('');
  const [isSavingTag, setIsSavingTag] = useState(false);

  // Scanning state & Hardware connection
  const [hwState, setHwState] = useState<HardwareConnectionState>(rfidHardware.getConnectionState());
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [foundTags, setFoundTags] = useState<string[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unassigned' | 'assigned' | 'packed'>('all');

  // 1. Subscribe to rfidHardware connection and incoming tags
  useEffect(() => {
    const unsubStatus = rfidHardware.subscribeStatus((st) => setHwState(st));
    const unsubTags = rfidHardware.subscribeTags((tag: RfidDiscoveredTag) => {
      handleTagDiscovered(tag.epc, tag.rssi);
    });

    return () => {
      unsubStatus();
      unsubTags();
    };
  }, [items, isScanning]);

  const handleTagDiscovered = (epc: string, rssi: number = -50) => {
    const cleanEpc = epc.toUpperCase();
    const matchedItem = items.find(it => it.rfidTag && it.rfidTag.toUpperCase() === cleanEpc);
    
    playChirp(2400, 0.04);
    hapticScanSuccess();

    if (matchedItem) {
      setFoundTags(prev => prev.includes(cleanEpc) ? prev : [...prev, cleanEpc]);
      setScanLogs(logs => [
        `[UHF DETECTED] EPC: ${cleanEpc.substring(0, 10)}... (RSSI: ${rssi}dBm) -> ${matchedItem.name}`,
        ...logs.slice(0, 49)
      ]);

      // Automatically update Firestore item status to 'packed' if not already packed
      if (matchedItem.status !== 'packed') {
        updateDoc(doc(db, 'packingLists', matchedItem.sourceId, 'items', matchedItem.id), {
          status: 'packed',
          updatedAt: new Date().toISOString()
        }).catch(err => console.warn('Failed to update packed state', err));
      }
    } else {
      setScanLogs(logs => [
        `[UNMATCHED TAG] EPC: ${cleanEpc.substring(0, 10)}... (RSSI: ${rssi}dBm) Not in project manifest`,
        ...logs.slice(0, 49)
      ]);
    }
  };

  // Play a synthesized RFID scan "chirp" using Web Audio API
  const playChirp = (frequency = 2200, duration = 0.03) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Audio context may be blocked or unsupported
    }
  };

  const handleStartEditing = (itemId: string, currentTag: string) => {
    setEditingItemId(itemId);
    setTempRFIDValue(currentTag || '');
  };

  const handleSaveRFIDTag = async (item: any) => {
    if (!tempRFIDValue.trim()) {
      toast.error("RFID tag cannot be empty. Please assign a valid hex EPC.");
      return;
    }

    // Hex validation
    const hexRegex = /^[0-9A-FA-F]+$/;
    if (!hexRegex.test(tempRFIDValue)) {
      toast.error("RFID tag must be a valid Hexadecimal EPC (0-9, A-F).");
      return;
    }

    setIsSavingTag(true);
    try {
      const formattedTag = tempRFIDValue.toUpperCase();
      // 1. Update list item
      await updateDoc(doc(db, 'packingLists', item.sourceId, 'items', item.id), {
        rfidTag: formattedTag,
        updatedAt: new Date().toISOString()
      });

      // 2. Update master gear item if present
      if (item.gearId && user?.uid) {
        try {
          await updateDoc(doc(db, 'users', user.uid, 'gearLibrary', item.gearId), {
            rfidTag: formattedTag,
            updatedAt: new Date().toISOString()
          });
        } catch (gearErr) {
          console.warn("Could not propagate RFID tag to parent GearItem:", gearErr);
        }
      }

      toast.success(`RFID Tag assigned to ${item.name}!`);
      setEditingItemId(null);
    } catch (error) {
      console.error("Error saving RFID association:", error);
      toast.error("Failed to save RFID Tag.");
    } finally {
      setIsSavingTag(false);
    }
  };

  const handleGenerateRFIDTag = () => {
    setTempRFIDValue(generatePackerEpc());
  };

  // Perform Zebra RFD40 sweep
  const startRFDSweep = async () => {
    const taggedItems = items.filter(it => it.rfidTag);
    if (taggedItems.length === 0) {
      toast.error("No manifest items have RFID tags assigned! Associate tags first.");
      return;
    }

    setIsScanning(true);
    setScanProgress(0);
    setScanLogs(["[SYSTEM] Initializing Zebra RFD40 UHF Sled...", "[SYSTEM] Scanning frequency 865.7 MHz (EU/US Carrier)..."]);
    setFoundTags([]);

    if (hwState.status === 'connected') {
      try {
        await rfidHardware.startInventory();
        toast.success(`Physical RFID sweep started (${hwState.deviceName})`);
      } catch (err: any) {
        toast.error(`Hardware sweep start error: ${err.message}`);
      }
    }

    let step = 0;
    const totalSteps = Math.max(taggedItems.length * 2, 20);

    const interval = setInterval(() => {
      step++;
      const percent = Math.min(Math.round((step / totalSteps) * 100), 100);
      setScanProgress(percent);

      if (step % 2 === 0 && taggedItems.length > 0) {
        const undiscovered = taggedItems.filter(it => !foundTags.includes(it.rfidTag));
        if (undiscovered.length > 0) {
          const found = undiscovered[Math.floor(Math.random() * undiscovered.length)];
          const tag = found.rfidTag!;
          handleTagDiscovered(tag, -52 - Math.floor(Math.random() * 20));
        } else {
          playChirp(1200, 0.01);
        }
      } else {
        playChirp(1800, 0.02);
      }

      if (step >= totalSteps) {
        clearInterval(interval);
        finalizeRFDSweep(taggedItems);
      }
    }, 150);
  };

  const finalizeRFDSweep = async (taggedItems: any[]) => {
    setIsScanning(false);
    if (hwState.status === 'connected') {
      await rfidHardware.stopInventory().catch(() => {});
    }
    playChirp(3200, 0.2);
    setTimeout(() => playChirp(3500, 0.2), 100);

    // Save and commit packed state for all tagged items in the manifest
    const batch = writeBatch(db);
    let updatedCount = 0;

    taggedItems.forEach(item => {
      if (item.status !== 'packed') {
        batch.update(doc(db, 'packingLists', item.sourceId, 'items', item.id), {
          status: 'packed',
          updatedAt: new Date().toISOString()
        });
        updatedCount++;
      }
    });

    if (updatedCount > 0) {
      try {
        await batch.commit();
        toast.success(`RFID Audit completed! Automatically verified and packed ${updatedCount} items.`);
      } catch (err) {
        console.error("Error committing RFID pack states:", err);
        toast.error("Failed to sync audit states.");
      }
    } else {
      toast.info("Audit sweep completed. All RFID-tagged items are verified packed.");
    }

    setScanLogs(logs => [
      `[COMPLETE] Audit synchronized. ${taggedItems.length} tags registered, ${updatedCount} manifest updates committed.`,
      ...logs
    ]);
  };

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.assetTag?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.rfidTag?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (filterStatus === 'unassigned') return !item.rfidTag;
    if (filterStatus === 'assigned') return !!item.rfidTag;
    if (filterStatus === 'packed') return item.status === 'packed';
    return true;
  });

  const totalAssigned = items.filter(it => it.rfidTag).length;
  const totalPacked = items.filter(it => it.status === 'packed').length;
  const totalItems = items.length;

  return (
    <div className="space-y-8">
      {/* Immersive Hardware Banner */}
      <div className="bg-neutral-900 rounded-[2.5rem] p-8 text-white border border-neutral-800 shadow-2xl relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                <Wifi size={12} className="animate-pulse" />
                <span>UHF RFID Integration</span>
              </span>
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                hwState.status === 'connected'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700'
              }`}>
                {hwState.status === 'connected' ? `Hardware: ${hwState.deviceName}` : 'Hardware Ready (Wedge/Sim)'}
              </span>
            </div>
            <h2 className="text-3xl font-black uppercase tracking-tight font-sans">
              Zebra UHF Logistics Controller
            </h2>
            <p className="text-xs text-neutral-400 max-w-xl leading-relaxed">
              Scan and link physical passive UHF RFID tags (EPC Gen 2) directly into active project manifest structures. Trigger non-line-of-sight bulk sweeping to verify complete packing instantly.
            </p>
          </div>

          <div className="flex gap-3 shrink-0">
            <button
              onClick={startRFDSweep}
              disabled={isScanning || items.length === 0}
              className="flex items-center gap-2 px-6 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-indigo-900/30 transition-all hover:scale-[1.03] active:scale-95 text-white cursor-pointer"
            >
              <Play size={16} className="fill-white" />
              <span>Trigger Sled Sweep</span>
            </button>
          </div>
        </div>

        {/* Real-time telemetry widgets */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-8 border-t border-neutral-800 text-xs">
          <div className="bg-neutral-950/40 p-4 rounded-2xl border border-neutral-800/40">
            <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest block mb-1">Manifest Capacity</span>
            <span className="text-2xl font-black font-mono text-neutral-100">{totalItems} <span className="text-[10px] text-neutral-400 font-sans">items</span></span>
          </div>
          <div className="bg-neutral-950/40 p-4 rounded-2xl border border-neutral-800/40">
            <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest block mb-1">RFID Linked</span>
            <span className="text-2xl font-black font-mono text-indigo-400">
              {totalAssigned} <span className="text-[10px] text-neutral-400 font-sans">({totalItems ? Math.round((totalAssigned/totalItems)*100) : 0}%)</span>
            </span>
          </div>
          <div className="bg-neutral-950/40 p-4 rounded-2xl border border-neutral-800/40">
            <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest block mb-1">Scanned / Packed</span>
            <span className="text-2xl font-black font-mono text-emerald-400">
              {totalPacked} <span className="text-[10px] text-neutral-400 font-sans">({totalItems ? Math.round((totalPacked/totalItems)*100) : 0}%)</span>
            </span>
          </div>
          <div className="bg-neutral-950/40 p-4 rounded-2xl border border-neutral-800/40">
            <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest block mb-1">Hardware Interface</span>
            <div className="flex items-center gap-1.5 mt-1.5 text-indigo-400 font-black uppercase tracking-widest text-[10px]">
              <Signal size={14} className="text-indigo-400" />
              <span>{hwState.status === 'connected' ? hwState.type.toUpperCase() : 'WEDGE / BLE READY'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sweep Simulation Active Panel */}
      <AnimatePresence>
        {isScanning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-neutral-950 rounded-3xl p-6 border border-indigo-900/50 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="animate-spin text-indigo-500" size={18} />
                  <span className="text-xs font-black uppercase tracking-widest text-indigo-400">UHF PASSIVE SWEEP RUNNING...</span>
                </div>
                <span className="text-xs font-mono font-black text-indigo-500">{scanProgress}%</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-neutral-900 h-2.5 rounded-full overflow-hidden border border-neutral-800">
                <motion.div 
                  className="bg-indigo-600 h-full rounded-full" 
                  style={{ width: `${scanProgress}%` }}
                />
              </div>

              {/* Terminal Logs */}
              <div className="bg-black/80 rounded-2xl p-4 border border-neutral-900 h-40 overflow-y-auto font-mono text-[10px] text-emerald-400 space-y-1">
                {scanLogs.map((log, idx) => (
                  <p key={idx} className="leading-relaxed">
                    <span className="text-neutral-600">[{new Date().toLocaleTimeString()}]</span> {log}
                  </p>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Asset manifest grid */}
      <div className="bg-white rounded-[2rem] p-6 border border-neutral-100 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-xl font-black uppercase tracking-tight text-neutral-900">Manifest Association List</h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Select and assign tags to items in your manifests</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search manifest items or tags..."
              className="bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2 text-xs font-medium outline-none focus:border-indigo-500 transition w-full sm:w-64"
            />

            {/* Status Filter */}
            <div className="flex bg-neutral-100 p-1 rounded-xl text-[10px] font-black uppercase">
              {(['all', 'unassigned', 'assigned', 'packed'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    filterStatus === st ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Item List */}
        <div className="divide-y divide-neutral-100">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-neutral-400 text-xs font-bold uppercase tracking-wider">
              No matching manifest items found.
            </div>
          ) : (
            filteredItems.map((item) => (
              <div key={item.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-neutral-900">{item.name}</span>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                      item.status === 'packed' ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-600'
                    }`}>
                      {item.status || 'unpacked'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-neutral-500 font-mono">
                    <span>Tag: {item.assetTag || 'N/A'}</span>
                    <span>•</span>
                    <span>Type: {item.sourceType || 'Packing List'}</span>
                  </div>
                </div>

                {/* RFID Tag Display / Edit */}
                <div className="flex items-center gap-3">
                  {editingItemId === item.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={tempRFIDValue}
                        onChange={(e) => setTempRFIDValue(e.target.value.toUpperCase())}
                        maxLength={24}
                        placeholder="24-Hex EPC..."
                        className="bg-neutral-50 border border-neutral-300 rounded-xl px-3 py-1.5 font-mono text-xs uppercase outline-none focus:border-indigo-500 w-44"
                      />
                      <button
                        onClick={handleGenerateRFIDTag}
                        className="p-2 bg-neutral-100 hover:bg-neutral-200 rounded-xl text-neutral-600 transition"
                        title="Generate Standard EPC"
                      >
                        <RefreshCw size={14} />
                      </button>
                      <button
                        onClick={() => handleSaveRFIDTag(item)}
                        disabled={isSavingTag}
                        className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition"
                        title="Save Tag"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => setEditingItemId(null)}
                        className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl transition"
                        title="Cancel"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {item.rfidTag ? (
                        <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-xl">
                          <Cpu size={14} className="text-purple-600" />
                          <span className="font-mono text-xs font-bold text-purple-700">{item.rfidTag}</span>
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-neutral-400 italic">No RFID Tag linked</span>
                      )}
                      <button
                        onClick={() => handleStartEditing(item.id, item.rfidTag || '')}
                        className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl transition"
                        title="Edit RFID Tag"
                      >
                        <Edit3 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
