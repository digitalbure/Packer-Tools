import React, { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Project } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Cpu, Wifi, CheckCircle2, AlertCircle, Zap, Play, 
  RefreshCw, Edit3, Save, Check, Database, Signal, X, Loader2, Plus
} from 'lucide-react';
import { toast } from 'sonner';

interface RFIDProjectManifestWidgetProps {
  project: Project;
  user: any;
  items: any[]; // Linked PackingItem instances with sourceId, sourceType
}

export default function RFIDProjectManifestWidget({ project, user, items }: RFIDProjectManifestWidgetProps) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [tempRFIDValue, setTempRFIDValue] = useState('');
  const [isSavingTag, setIsSavingTag] = useState(false);

  // Scanning simulation state
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [foundTags, setFoundTags] = useState<string[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unassigned' | 'assigned' | 'packed'>('all');

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
      if (item.gearId) {
        try {
          await updateDoc(doc(db, 'gear', item.gearId), {
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
    const chars = '0123456789ABCDEF';
    let hex = 'E2801'; // Standard EPC Gen 2 prefix
    for (let i = 0; i < 19; i++) {
      hex += chars[Math.floor(Math.random() * chars.length)];
    }
    setTempRFIDValue(hex);
  };

  // Perform Zebra RFD40 sweep simulator
  const startRFDSweep = () => {
    const taggedItems = items.filter(it => it.rfidTag);
    if (taggedItems.length === 0) {
      toast.error("No manifest items have RFID tags assigned! Associate tags first.");
      return;
    }

    setIsScanning(true);
    setScanProgress(0);
    setScanLogs(["[SYSTEM] Initializing Zebra RFD40 UHF Sled...", "[SYSTEM] Scanning frequency 865.7 MHz (EU/US Carrier)..."]);
    setFoundTags([]);

    let step = 0;
    const totalSteps = Math.max(taggedItems.length * 2, 20);

    const interval = setInterval(() => {
      step++;
      const percent = Math.min(Math.round((step / totalSteps) * 100), 100);
      setScanProgress(percent);

      // Randomly "discover" a tag or emit diagnostic log
      if (step % 2 === 0 && taggedItems.length > 0) {
        // Pick an item that hasn't been discovered yet
        const undiscovered = taggedItems.filter(it => !foundTags.includes(it.rfidTag));
        if (undiscovered.length > 0) {
          const found = undiscovered[Math.floor(Math.random() * undiscovered.length)];
          const tag = found.rfidTag!;
          setFoundTags(prev => [...prev, tag]);
          setScanLogs(logs => [
            ...logs,
            `[UHF DETECTED] EPC: ${tag.substring(0, 12)}... (RSSI: -54dBm, Ant: 1) -> ${found.name}`
          ]);
          playChirp(2400, 0.04);
        } else {
          // Play click for background search
          playChirp(1200, 0.01);
        }
      } else {
        // Periodic search ping noise
        playChirp(1800, 0.02);
        if (Math.random() > 0.5) {
          setScanLogs(logs => [
            ...logs,
            `[SCANNING...] Multi-tag collision resolving... Carrier power normal.`
          ]);
        }
      }

      if (step >= totalSteps) {
        clearInterval(interval);
        finalizeRFDSweep(taggedItems);
      }
    }, 150);
  };

  const finalizeRFDSweep = async (taggedItems: any[]) => {
    setIsScanning(false);
    playChirp(3200, 0.2); // Double success beep
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
        toast.success(`RFID Audit completed! Automatically packed ${updatedCount} items.`);
      } catch (err) {
        console.error("Error committing RFID pack states:", err);
        toast.error("Failed to sync audit states.");
      }
    } else {
      toast.info("Audit sweep completed. All RFID-tagged items are already verified packed.");
    }

    setScanLogs(logs => [
      ...logs,
      `[COMPLETE] Audit synchronized. ${taggedItems.length} tags registered, ${updatedCount} manifest updates committed.`
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
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-black uppercase tracking-widest">
                Enterprise Active
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
              className="flex items-center gap-2 px-6 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-indigo-900/30 transition-all hover:scale-[1.03] active:scale-95 text-white"
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
            <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest block mb-1">Sled Status</span>
            <div className="flex items-center gap-1.5 mt-1.5 text-indigo-400 font-black uppercase tracking-widest text-[10px]">
              <Signal size={14} className="text-indigo-400" />
              <span>RFD40 Connected</span>
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
              placeholder="Search by name, asset, or RFID..."
              className="px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary outline-none transition w-full sm:w-64"
            />

            {/* Filter Tabs */}
            <div className="flex bg-neutral-100 p-1 rounded-xl text-[9px] font-black uppercase tracking-widest">
              {(['all', 'unassigned', 'assigned', 'packed'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    filterStatus === st ? 'bg-white text-primary shadow-sm' : 'text-neutral-400 hover:text-neutral-700'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="bg-neutral-50 rounded-2xl p-12 text-center border border-dashed border-neutral-200">
            <Cpu size={32} className="text-neutral-300 mx-auto mb-4" />
            <p className="text-neutral-400 text-xs font-black uppercase tracking-widest">No matching items found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-100 text-[10px] font-black uppercase tracking-widest text-neutral-400">
                  <th className="py-4 px-3">Item Details</th>
                  <th className="py-4 px-3">Category</th>
                  <th className="py-4 px-3">Asset Tag</th>
                  <th className="py-4 px-3">RFID Tag Association</th>
                  <th className="py-4 px-3 text-right">Manifest Sync</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-b border-neutral-100/60 hover:bg-neutral-50/50 transition">
                    <td className="py-4 px-3 align-middle">
                      <div>
                        <div className="font-extrabold text-neutral-900 text-sm">{item.name}</div>
                        <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest">List: {item.sourceId}</span>
                      </div>
                    </td>
                    <td className="py-4 px-3 align-middle">
                      <span className="text-[10px] px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded-full font-bold">
                        {item.category || 'Other'}
                      </span>
                    </td>
                    <td className="py-4 px-3 align-middle font-mono text-[11px] font-bold text-neutral-500">
                      {item.assetTag || 'N/A'}
                    </td>
                    <td className="py-4 px-3 align-middle">
                      {editingItemId === item.id ? (
                        <div className="flex items-center gap-2 max-w-sm">
                          <input
                            type="text"
                            value={tempRFIDValue}
                            maxLength={24}
                            onChange={(e) => setTempRFIDValue(e.target.value.toUpperCase().replace(/[^0-9A-FA-F]/g, ''))}
                            placeholder="HEX EPC"
                            className="px-3 py-1.5 bg-white border border-neutral-300 rounded-lg text-xs font-mono font-bold w-48 uppercase outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={handleGenerateRFIDTag}
                            className="px-2 py-1.5 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 rounded-lg text-[9px] font-black uppercase tracking-widest transition"
                          >
                            Gen
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveRFIDTag(item)}
                            disabled={isSavingTag}
                            className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition disabled:opacity-40"
                          >
                            {isSavingTag ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingItemId(null)}
                            className="p-1.5 bg-neutral-100 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-200 transition"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {item.rfidTag ? (
                            <div className="flex items-center gap-2">
                              <code className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-1 rounded text-xs font-mono font-bold tracking-widest">
                                {item.rfidTag}
                              </code>
                              <button
                                onClick={() => handleStartEditing(item.id, item.rfidTag || '')}
                                className="p-1 text-neutral-400 hover:text-indigo-600 transition"
                                title="Edit Association"
                              >
                                <Edit3 size={13} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleStartEditing(item.id, '')}
                              className="flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-700 font-bold"
                            >
                              <Plus size={12} />
                              <span>Link RFID tag</span>
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-3 align-middle text-right">
                      {item.status === 'packed' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-black uppercase tracking-widest">
                          <CheckCircle2 size={12} />
                          <span>Packed (OK)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-50 text-neutral-400 border border-neutral-100 rounded-full text-[10px] font-black uppercase tracking-widest">
                          <AlertCircle size={12} />
                          <span>Pending Scan</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
