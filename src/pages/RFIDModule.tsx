import React, { useState, useEffect, useRef } from 'react';
import { 
  Cpu, 
  Bluetooth, 
  Wifi, 
  Sliders, 
  Settings, 
  Layers, 
  Compass, 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  Play, 
  Square, 
  RefreshCw, 
  Tag, 
  Smartphone, 
  Search, 
  Download, 
  FileSpreadsheet, 
  ChevronRight, 
  Volume2, 
  VolumeX,
  Plus,
  HelpCircle,
  Clock,
  User,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, AdminSettings, GearItem } from '../types';
import { toast } from 'sonner';
import { db } from '../firebase';
import { collection, onSnapshot, getDocs, doc, setDoc } from 'firebase/firestore';

interface RFIDAsset {
  id: string;
  name: string;
  category: string;
  assetTag: string;
  epc: string;
  status: 'in_use' | 'available' | 'maintenance' | 'out_of_sync';
  lastScanned?: string;
  rssi?: number;
  expectedRoom: string;
  actualRoom?: string;
}

const PRELOADED_RFID_ASSETS: RFIDAsset[] = [
  { id: 'rf-1', name: 'RED V-Raptor 8K VV Camera', category: 'Cameras', assetTag: 'PT-CAM-2049', epc: 'E2801130200020B4125678A1', status: 'available', expectedRoom: 'Locker A' },
  { id: 'rf-2', name: 'Arri Signature Prime 47mm T1.8', category: 'Lenses', assetTag: 'PT-LEN-0914', epc: 'E2801130200020B4125678A2', status: 'available', expectedRoom: 'Locker A' },
  { id: 'rf-3', name: 'Teradek Bolt 4K LT 750 TX/RX', category: 'Wireless', assetTag: 'PT-WIR-8422', epc: 'E2801130200020B4125678A3', status: 'in_use', expectedRoom: 'Stage 1' },
  { id: 'rf-4', name: 'Shure Axient Digital AD2 Handheld', category: 'Audio', assetTag: 'PT-AUD-0055', epc: 'E2801130200020B4125678A4', status: 'available', expectedRoom: 'Locker B' },
  { id: 'rf-5', name: 'SmallHD Cine 24" High-Bright', category: 'Monitors', assetTag: 'PT-MON-3301', epc: 'E2801130200020B4125678A5', status: 'available', expectedRoom: 'Stage 1' },
  { id: 'rf-6', name: 'Aputure LS 1200d Pro Light Kit', category: 'Lighting', assetTag: 'PT-LGT-5509', epc: 'E2801130200020B4125678A6', status: 'maintenance', expectedRoom: 'Locker B' },
  { id: 'rf-7', name: 'Inovativ Voyager 36 EVO Cart', category: 'Grip', assetTag: 'PT-GRP-4412', epc: 'E2801130200020B4125678A7', status: 'available', expectedRoom: 'Stage 1' },
  { id: 'rf-8', name: 'DJI Ronin 2 3-Axis Stabilizer', category: 'Stabilizers', assetTag: 'PT-STB-0103', epc: 'E2801130200020B4125678A8', status: 'in_use', expectedRoom: 'Locker A' },
];

export default function RFIDModule({ user, adminSettings }: { user: UserProfile; adminSettings: AdminSettings | null }) {
  const [activeTab, setActiveTab] = useState<'scan' | 'locate' | 'encode' | 'roi'>('scan');
  
  // Zebra RFD40 Pairing & Control Settings
  const [isPaired, setIsPaired] = useState(false);
  const [isPairing, setIsPairing] = useState(false);
  const [antennaPower, setAntennaPower] = useState(25); // dBm (0 to 30)
  const [beepVolume, setBeepVolume] = useState(70);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedReader, setSelectedReader] = useState('Zebra RFD40 Sled [SN: 2209140A]');

  // Live Bulk Audit States
  const [isScanning, setIsScanning] = useState(false);
  const [scannedItems, setScannedItems] = useState<RFIDAsset[]>([]);
  const [progressCount, setProgressCount] = useState(0);
  const [auditStats, setAuditStats] = useState({ total: 8, found: 0, outOfPlace: 0, missing: 8 });
  const [scanSpeed, setScanSpeed] = useState(0); // tags per second
  const [scanLog, setScanLog] = useState<{ time: string; msg: string; type: 'success' | 'warn' | 'info' }[]>([]);

  // Geiger Counter Locator States
  const [targetAsset, setTargetAsset] = useState<RFIDAsset>(PRELOADED_RFID_ASSETS[0]);
  const [proximity, setProximity] = useState(10); // 0 to 100%
  const [geigerActive, setGeigerActive] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const intervalIdRef = useRef<number | null>(null);

  // Encoder States
  const [encoderAsset, setEncoderAsset] = useState<RFIDAsset>(PRELOADED_RFID_ASSETS[0]);
  const [customEPC, setCustomEPC] = useState('');
  const [isEncoding, setIsEncoding] = useState(false);
  const [encodeProgress, setEncodeProgress] = useState(0);

  // ROI Calculator States
  const [assetCount, setAssetCount] = useState(1200);
  const [sledCount, setSledCount] = useState(4);
  const [portalCount, setPortalCount] = useState(2);

  // Load registered gear from Firestore if available
  const [firestoreGear, setFirestoreGear] = useState<GearItem[]>([]);
  
  useEffect(() => {
    setCustomEPC(encoderAsset.epc);
  }, [encoderAsset]);

  // Read registered gear items to enable tagging real items
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'gear'), (snapshot) => {
      const gear: GearItem[] = [];
      snapshot.forEach((doc) => {
        gear.push({ id: doc.id, ...doc.data() } as GearItem);
      });
      setFirestoreGear(gear);
    });
    return () => unsubscribe();
  }, []);

  // Web Audio Context initialization for high-fidelity geiger chime
  const startAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  };

  const playChime = (frequency: number, duration: number, type: 'sine' | 'square' | 'triangle' = 'sine') => {
    if (isMuted || !beepVolume) return;
    try {
      startAudio();
      const ctx = audioContextRef.current;
      if (!ctx || ctx.state === 'suspended') return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.value = frequency;

      // Map volume slider logically
      const vol = (beepVolume / 100) * 0.15;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio Context beep failed", e);
    }
  };

  // Geiger Counter repetitive beep loop
  useEffect(() => {
    if (geigerActive && !isMuted) {
      // Calculate delay based on proximity: 10% is slow (e.g. 1500ms), 100% is extremely fast (e.g. 50ms)
      const baseDelay = 1200;
      const factor = (100 - proximity) / 100;
      const delay = Math.max(45, baseDelay * Math.pow(factor, 2.5));

      // Calculate frequency: higher pitch when closer
      const pitch = 300 + (proximity * 8);

      const triggerBeep = () => {
        playChime(pitch, 0.08, 'sine');
        // schedule next beep dynamically
        const nextFactor = (100 - proximity) / 100;
        const nextDelay = Math.max(45, baseDelay * Math.pow(nextFactor, 2.5));
        intervalIdRef.current = window.setTimeout(triggerBeep, nextDelay);
      };

      intervalIdRef.current = window.setTimeout(triggerBeep, delay);
    }

    return () => {
      if (intervalIdRef.current) {
        clearTimeout(intervalIdRef.current);
      }
    };
  }, [geigerActive, proximity, isMuted, beepVolume]);

  // Simulate pairing
  const handlePair = () => {
    if (isPaired) {
      setIsPaired(false);
      setScanLog(prev => [{ time: new Date().toLocaleTimeString(), msg: 'Sled reader disconnected.', type: 'info' }, ...prev]);
      toast.success('RFID Sled disconnected');
    } else {
      setIsPairing(true);
      setTimeout(() => {
        setIsPaired(true);
        setIsPairing(false);
        setScanLog(prev => [{ time: new Date().toLocaleTimeString(), msg: 'Zebra RFD40 Sled paired over Bluetooth LE successfully.', type: 'success' }, ...prev]);
        toast.success('Zebra RFD40 paired successfully!');
        playChime(880, 0.15);
        setTimeout(() => playChime(1100, 0.15), 100);
      }, 1500);
    }
  };

  // Simulate Bulk Audit scan sweep
  useEffect(() => {
    let scanTimer: number;
    if (isScanning) {
      let ticks = 0;
      const expectedCount = PRELOADED_RFID_ASSETS.length;
      
      // Configure expected scan rates based on dBm antenna power
      // Max power 30dBm = discovers 100% of items rapidly
      // Min power = misses items in Locker B/Stage 1
      const rangeThreshold = antennaPower / 30; // 0 to 1
      
      const discoverableAssets = PRELOADED_RFID_ASSETS.filter(item => {
        if (item.expectedRoom === 'Locker A') return true;
        if (item.expectedRoom === 'Locker B' && rangeThreshold >= 0.5) return true;
        if (item.expectedRoom === 'Stage 1' && rangeThreshold >= 0.8) return true;
        return false;
      });

      setScannedItems([]);
      setScanSpeed(0);

      const runSweepTick = () => {
        ticks += 1;
        setScanSpeed(Math.round(15 + Math.random() * 25));

        const newlyScanned: RFIDAsset[] = [];
        
        discoverableAssets.forEach((asset, idx) => {
          // Probability based tick discovery
          if (Math.random() > 0.35) {
            // Calculate a synthetic signal RSSI
            const baseSignal = asset.expectedRoom === 'Locker A' ? -42 : asset.expectedRoom === 'Locker B' ? -68 : -82;
            const fluctuation = Math.floor(Math.random() * 12 - 6);
            const actualRSSI = baseSignal + fluctuation;

            newlyScanned.push({
              ...asset,
              rssi: actualRSSI,
              lastScanned: new Date().toLocaleTimeString(),
              status: asset.status === 'in_use' ? 'out_of_sync' : 'available'
            });
          }
        });

        setScannedItems(prev => {
          const merged = [...prev];
          newlyScanned.forEach(n => {
            const existsIdx = merged.findIndex(m => m.id === n.id);
            if (existsIdx === -1) {
              merged.push(n);
              // Log to event log
              setScanLog(log => [{ 
                time: new Date().toLocaleTimeString(), 
                msg: `EPC Discovered: [${n.epc.substring(0,6)}...${n.epc.substring(18)}] - ${n.name}`, 
                type: 'success' 
              }, ...log]);
              // Trigger rapid scan chirp
              playChime(1500, 0.04, 'sine');
            } else {
              // Update RSSI and last scanned time
              merged[existsIdx].rssi = n.rssi;
              merged[existsIdx].lastScanned = n.lastScanned;
            }
          });

          // Calculate statistics
          const found = merged.length;
          const outOfPlace = merged.filter(m => m.status === 'out_of_sync').length;
          const missing = expectedCount - found;
          setAuditStats({ total: expectedCount, found, outOfPlace, missing });
          
          return merged;
        });

        if (ticks < 12) {
          scanTimer = window.setTimeout(runSweepTick, 400);
        } else {
          setIsScanning(false);
          setScanSpeed(0);
          toast.success(`RFID Audit sweep completed. ${auditStats.found} of ${auditStats.total} assets resolved.`);
          playChime(1000, 0.15);
          setTimeout(() => playChime(1300, 0.25), 120);
        }
      };

      scanTimer = window.setTimeout(runSweepTick, 400);
    }

    return () => {
      clearTimeout(scanTimer);
    };
  }, [isScanning]);

  const triggerScanSweep = () => {
    if (!isPaired) {
      toast.error('Connect your handheld Zebra RFD40 reader first to execute a physical tag sweep.');
      return;
    }
    setScanLog(prev => [{ time: new Date().toLocaleTimeString(), msg: 'Starting continuous inventory audit sweep...', type: 'info' }, ...prev]);
    setIsScanning(true);
  };

  // Tag encoding simulation
  const handleEncodeTag = () => {
    if (!isPaired) {
      toast.error('Zebra Sled must be paired to program memory blocks.');
      return;
    }
    if (!customEPC.match(/^[0-9A-Fa-f]{24}$/)) {
      toast.error('EPC must be exactly 24 hexadecimal characters (A-F, 0-9).');
      return;
    }

    setIsEncoding(true);
    setEncodeProgress(0);

    const interval = setInterval(() => {
      setEncodeProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsEncoding(false);
          toast.success(`UHF Passive Tag successfully programmed! EPC: ${customEPC}`);
          playChime(1200, 0.1);
          setTimeout(() => playChime(1600, 0.25), 100);
          setScanLog(log => [{ 
            time: new Date().toLocaleTimeString(), 
            msg: `Programmed Tag - Asset: ${encoderAsset.name}, EPC Block: ${customEPC}`, 
            type: 'success' 
          }, ...log]);
          return 100;
        }
        return prev + 25;
      });
    }, 400);
  };

  const handleRandomEPC = () => {
    const chars = '0123456789ABCDEF';
    let result = 'E280'; // Common UHF Gen2 EPC prefix
    for (let i = 0; i < 20; i++) {
      result += chars[Math.floor(Math.random() * 16)];
    }
    setCustomEPC(result);
  };

  // ROI computations
  const tagsCost = assetCount * 0.18;
  const hardwareCost = (sledCount * 1250) + (portalCount * 3800);
  const totalCapex = tagsCost + hardwareCost;
  // Estimate audit time savings: Barcode takes 12 secs per item, RFID takes 0.1 secs
  const barcodeHoursPerYear = Math.round((assetCount * 12 * 52) / 3600);
  const rfidHoursPerYear = Math.round((assetCount * 0.1 * 52) / 3600);
  const laborSavings = (barcodeHoursPerYear - rfidHoursPerYear) * 35; // $35/hr labor
  const equipmentLossSavings = Math.round(assetCount * 120 * 0.035); // 3.5% loss rate reduced
  const totalAnnualSavings = laborSavings + equipmentLossSavings;
  const payBackMonths = Math.max(1, Math.round((totalCapex / (totalAnnualSavings / 12)) * 10) / 10);

  return (
    <div className="space-y-8 pb-16">
      {/* Header section with Premium Enterprise styling */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-neutral-200/60 pb-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 bg-[#ff4f3a]/10 border border-[#ff4f3a]/20 text-[#ff4f3a] font-mono font-black text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-xl w-fit">
            <Cpu size={12} className="animate-pulse" /> ENTERPRISE CORE ENGINE
          </div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight flex items-center gap-2 text-neutral-900">
            <span>UHF RFID Logistics & Track Module</span>
          </h1>
          <p className="text-xs text-neutral-500 font-medium">
            Pair Zebra RFD40 handheld devices, execute instant bulk space scans, configure Gen2 EPC tags, and calculate project ROI.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="bg-neutral-100 p-1.5 rounded-2xl flex border border-neutral-200/50 w-full md:w-auto overflow-x-auto gap-1">
          {(['scan', 'locate', 'encode', 'roi'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setGeigerActive(false);
              }}
              className={`text-xs font-bold uppercase tracking-wider py-2 px-4 rounded-xl transition cursor-pointer select-none whitespace-nowrap flex items-center gap-2 ${
                activeTab === tab 
                  ? 'bg-neutral-900 text-white shadow-sm' 
                  : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/40'
              }`}
            >
              {tab === 'scan' && <Activity size={14} />}
              {tab === 'locate' && <Compass size={14} />}
              {tab === 'encode' && <Tag size={14} />}
              {tab === 'roi' && <Sliders size={14} />}
              <span>
                {tab === 'scan' && 'Continuous Audit'}
                {tab === 'locate' && 'RSSI Geiger Locator'}
                {tab === 'encode' && 'EPC Tag Encoder'}
                {tab === 'roi' && 'Cost & ROI Advisor'}
              </span>
            </button>
          ))}
        </div>
      </header>

      <div className="grid lg:grid-cols-4 gap-8">
        {/* Left Column: Sled pairing controls */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-150 pb-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800">RFD40 Controller</h3>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isPaired ? 'bg-[#ff4f3a] animate-pulse' : 'bg-neutral-300'}`} />
                <span className="text-[10px] font-mono uppercase font-black text-neutral-500">{isPaired ? 'Online' : 'Standby'}</span>
              </div>
            </div>

            {/* Simulated Handheld Sled image/mockup */}
            <div className="bg-neutral-900 rounded-2xl p-5 border border-neutral-800 relative flex flex-col items-center justify-center space-y-3 overflow-hidden text-center min-h-[160px]">
              <div className="absolute top-2 left-2 bg-neutral-800 text-[8px] font-mono text-neutral-400 font-bold px-1.5 py-0.5 rounded uppercase tracking-widest">SLED SENSORS</div>
              <div className="relative">
                <Smartphone size={44} className={`text-neutral-400 z-10 transition-transform ${isScanning ? 'scale-105 duration-100 animate-bounce' : ''}`} />
                <Bluetooth size={16} className={`absolute -right-2 -bottom-1 text-white bg-[#ff4f3a] p-0.5 rounded-full ${isPaired ? 'animate-pulse' : 'opacity-40'}`} />
              </div>
              <div className="space-y-0.5">
                <p className="text-[11px] font-extrabold text-white uppercase tracking-tight">{isPaired ? 'Zebra Sled Synced' : 'BLE Disconnected'}</p>
                <p className="text-[9px] font-mono text-neutral-500">Bluetooth LE 5.3 &bull; EPC Gen2 v2</p>
              </div>

              <button
                onClick={handlePair}
                disabled={isPairing}
                className={`w-full py-2.5 text-[10px] font-bold uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2 border ${
                  isPaired 
                    ? 'bg-neutral-800 hover:bg-neutral-750 text-neutral-300 border-neutral-700' 
                    : 'bg-[#ff4f3a] hover:bg-[#e0402c] text-white border-transparent'
                }`}
              >
                {isPairing ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    <span>Searching BLE...</span>
                  </>
                ) : isPaired ? (
                  <>
                    <VolumeX size={12} />
                    <span>Disconnect Sled</span>
                  </>
                ) : (
                  <>
                    <Bluetooth size={12} />
                    <span>Pair Sled Reader</span>
                  </>
                )}
              </button>
            </div>

            {/* Calibration Sliders */}
            <div className="space-y-5 pt-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-neutral-700">
                  <span className="flex items-center gap-1.5"><Wifi size={14} className="text-neutral-500" /> Antenna Power</span>
                  <span className="font-mono text-neutral-900">{antennaPower} dBm</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="30"
                  value={antennaPower}
                  onChange={(e) => {
                    setAntennaPower(Number(e.target.value));
                    playChime(400 + Number(e.target.value) * 10, 0.05);
                  }}
                  className="w-full h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-[#ff4f3a]"
                />
                <div className="flex justify-between text-[9px] font-mono text-neutral-400 font-bold uppercase">
                  <span>10 dBm (Close range)</span>
                  <span>30 dBm (Max range)</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-neutral-700">
                  <span className="flex items-center gap-1.5">
                    {isMuted ? <VolumeX size={14} className="text-neutral-400" /> : <Volume2 size={14} className="text-neutral-500" />}
                    Chirp Volume
                  </span>
                  <span className="font-mono text-neutral-900">{isMuted ? 'Muted' : `${beepVolume}%`}</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    disabled={isMuted}
                    value={beepVolume}
                    onChange={(e) => setBeepVolume(Number(e.target.value))}
                    className="flex-1 h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-[#ff4f3a] disabled:opacity-50"
                  />
                  <button 
                    onClick={() => setIsMuted(!isMuted)} 
                    className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-neutral-500 hover:text-neutral-900 transition"
                  >
                    {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Quick calibration status cards */}
            <div className="bg-neutral-50 border border-neutral-150 p-4 rounded-2xl space-y-2.5 text-[11px] text-neutral-600 font-semibold leading-relaxed">
              <div className="flex justify-between">
                <span>Selected Device:</span>
                <span className="font-mono font-bold text-neutral-900 text-right truncate max-w-[120px]" title={selectedReader}>{selectedReader}</span>
              </div>
              <div className="flex justify-between">
                <span>Operating Frequency:</span>
                <span className="font-mono font-bold text-neutral-900">915 MHz (US UHF)</span>
              </div>
              <div className="flex justify-between">
                <span>Protocol Standards:</span>
                <span className="font-mono font-bold text-neutral-900">EPC Class 1 Gen 2</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Section: Core Tabs Content */}
        <div className="lg:col-span-3 space-y-6">
          <AnimatePresence mode="wait">
            
            {/* SCAN TAB: Continuous Space Audit */}
            {activeTab === 'scan' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Stats row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white border border-neutral-200 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
                    <span className="text-[9px] font-mono font-black text-neutral-400 uppercase tracking-widest block">ROSTER TOTAL</span>
                    <span className="text-3xl font-black text-neutral-850 mt-1">{auditStats.total}</span>
                    <span className="text-[10px] text-neutral-500 font-bold mt-1">Expected items tagged</span>
                  </div>
                  <div className="bg-white border border-neutral-200 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
                    <span className="text-[9px] font-mono font-black text-[#ff4f3a] uppercase tracking-widest block">RESOLVED FOUND</span>
                    <span className="text-3xl font-black text-neutral-850 mt-1">{auditStats.found}</span>
                    <span className="text-[10px] text-neutral-500 font-bold mt-1">Tags discovered live</span>
                  </div>
                  <div className="bg-white border border-neutral-200 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
                    <span className="text-[9px] font-mono font-black text-amber-500 uppercase tracking-widest block">OUT OF PLACE</span>
                    <span className="text-3xl font-black text-amber-500 mt-1">{auditStats.outOfPlace}</span>
                    <span className="text-[10px] text-neutral-500 font-bold mt-1">Items at incorrect rooms</span>
                  </div>
                  <div className="bg-white border border-neutral-200 rounded-2xl p-4 flex flex-col justify-between shadow-sm">
                    <span className="text-[9px] font-mono font-black text-red-500 uppercase tracking-widest block">MISSING UNREAD</span>
                    <span className="text-3xl font-black text-red-500 mt-1">{auditStats.missing}</span>
                    <span className="text-[10px] text-neutral-500 font-bold mt-1">Out of range / Unscanned</span>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  {/* Sweep Console */}
                  <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm md:col-span-2 space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-150 pb-4">
                      <div className="space-y-0.5">
                        <h3 className="text-sm font-black uppercase tracking-tight text-neutral-900">Active Audit Scan Sandbox</h3>
                        <p className="text-[11px] text-neutral-500">Hold trigger or press scan to sweep the space for passive tags.</p>
                      </div>
                      
                      <div className="flex gap-2">
                        {isScanning ? (
                          <div className="flex items-center gap-1.5 bg-[#ff4f3a]/10 border border-[#ff4f3a]/20 text-[#ff4f3a] font-mono text-[10px] font-bold py-1 px-3 rounded-xl">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#ff4f3a] animate-ping" />
                            <span>{scanSpeed} Tags/s</span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-mono bg-neutral-100 text-neutral-500 py-1 px-3 rounded-xl border border-neutral-200/50">Scanner Idle</span>
                        )}
                      </div>
                    </div>

                    {/* Scan execution button / progress */}
                    <div className="bg-neutral-50 rounded-2xl p-6 border border-neutral-200/50 flex flex-col items-center justify-center space-y-4 min-h-[160px] text-center relative overflow-hidden">
                      {isScanning && (
                        <div className="absolute inset-0 bg-gradient-to-r from-neutral-50/10 via-[#ff4f3a]/5 to-neutral-50/10 animate-pulse pointer-events-none" />
                      )}

                      <div className="space-y-1">
                        <h4 className="text-xs font-black uppercase tracking-wider text-neutral-800">UHF PASSIVE SWEEP</h4>
                        <p className="text-[11px] text-neutral-400 max-w-sm">
                          RFID electromagnetic waves will penetrate plastic containers and road cases, resolving inventory records instantly.
                        </p>
                      </div>

                      <button
                        onClick={triggerScanSweep}
                        disabled={isScanning}
                        className={`px-8 py-3.5 text-xs font-black uppercase tracking-widest rounded-xl transition select-none flex items-center gap-2 cursor-pointer shadow-sm ${
                          isScanning 
                            ? 'bg-neutral-800 text-neutral-400 border border-neutral-700 cursor-not-allowed' 
                            : 'bg-neutral-900 hover:bg-neutral-850 text-white'
                        }`}
                      >
                        {isScanning ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            <span>Sweeping Room...</span>
                          </>
                        ) : (
                          <>
                            <Play size={14} />
                            <span>Trigger Bulk RFID Sweep</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Discovery Table */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-wider text-neutral-700">Discovered Items ({scannedItems.length})</h4>
                      {scannedItems.length === 0 ? (
                        <div className="border border-dashed border-neutral-200 rounded-2xl p-8 text-center text-xs font-bold text-neutral-400 uppercase tracking-wider">
                          No active tags discovered yet. Tap "Trigger Bulk RFID Sweep" above!
                        </div>
                      ) : (
                        <div className="overflow-x-auto border border-neutral-150 rounded-2xl">
                          <table className="w-full text-left font-sans border-collapse">
                            <thead>
                              <tr className="bg-neutral-50 font-mono text-[9px] uppercase font-black text-neutral-400 border-b border-neutral-150">
                                <th className="py-2.5 px-4">Asset Info</th>
                                <th className="py-2.5 px-4">EPC Code (UHF Pass)</th>
                                <th className="py-2.5 px-4">RSSI</th>
                                <th className="py-2.5 px-4">Location Check</th>
                              </tr>
                            </thead>
                            <tbody className="text-[11px] font-semibold divide-y divide-neutral-150 text-neutral-700">
                              {scannedItems.map(item => {
                                const locationMismatch = item.expectedRoom !== (item.id === 'rf-3' || item.id === 'rf-7' ? 'Stage 1' : 'Locker A');
                                return (
                                  <tr key={item.id} className="hover:bg-neutral-50/50">
                                    <td className="py-2.5 px-4">
                                      <div className="font-extrabold text-neutral-850">{item.name}</div>
                                      <div className="text-[9px] font-mono text-neutral-400 font-bold">{item.assetTag} &bull; {item.category}</div>
                                    </td>
                                    <td className="py-2.5 px-4 font-mono text-[10px] text-neutral-900 font-bold">
                                      {item.epc}
                                    </td>
                                    <td className="py-2.5 px-4">
                                      <span className={`font-mono font-bold ${item.rssi && item.rssi > -55 ? 'text-[#ff4f3a]' : 'text-neutral-500'}`}>
                                        {item.rssi} dBm
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-4">
                                      {locationMismatch ? (
                                        <div className="flex items-center gap-1 text-amber-600 bg-amber-50 border border-amber-200/50 px-2 py-0.5 rounded-lg w-fit text-[10px] font-bold">
                                          <AlertTriangle size={10} />
                                          <span>Out of Place (Expected {item.expectedRoom})</span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 border border-emerald-200/50 px-2 py-0.5 rounded-lg w-fit text-[10px] font-bold">
                                          <CheckCircle size={10} />
                                          <span>Resolved in {item.expectedRoom}</span>
                                        </div>
                                      )}
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

                  {/* Terminal Log */}
                  <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm space-y-4 flex flex-col">
                    <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800 flex items-center gap-2">
                      <Clock size={14} className="text-neutral-500 animate-spin" />
                      <span>Scanner Log Terminal</span>
                    </h3>

                    <div className="bg-neutral-900 rounded-2xl p-4 flex-1 font-mono text-[10px] text-neutral-300 space-y-2.5 overflow-y-auto max-h-[420px] scrollbar-hide min-h-[300px]">
                      {scanLog.length === 0 ? (
                        <p className="text-neutral-500 italic text-center pt-8">No terminal traffic detected.</p>
                      ) : (
                        scanLog.map((log, idx) => (
                          <div key={idx} className="flex gap-2 items-start leading-relaxed border-b border-neutral-800 pb-1.5">
                            <span className="text-neutral-500 font-bold shrink-0">{log.time}</span>
                            <span className={
                              log.type === 'success' ? 'text-emerald-400' :
                              log.type === 'warn' ? 'text-amber-400' : 'text-sky-300'
                            }>
                              {log.msg}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* LOCATE TAB: Geiger Proximity Counter */}
            {activeTab === 'locate' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm space-y-6"
              >
                <div className="border-b border-neutral-150 pb-4">
                  <h3 className="text-sm font-black uppercase tracking-tight text-neutral-900">UHF RSSI Geiger locator (Asset finder)</h3>
                  <p className="text-[11px] text-neutral-500">Pick a specific tag, arm the tracker, and sweep around to search for localized signal echoes.</p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  {/* Left Controls */}
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-neutral-700 block uppercase">Select Asset to Locate</label>
                      <select
                        value={targetAsset.id}
                        onChange={(e) => {
                          const asset = PRELOADED_RFID_ASSETS.find(a => a.id === e.target.value);
                          if (asset) setTargetAsset(asset);
                        }}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-xs font-bold text-neutral-800 focus:outline-none"
                      >
                        {PRELOADED_RFID_ASSETS.map(a => (
                          <option key={a.id} value={a.id}>{a.name} ({a.assetTag})</option>
                        ))}
                      </select>
                    </div>

                    <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/50 space-y-3">
                      <div className="flex items-center justify-between text-[11px] font-mono uppercase font-black text-neutral-500">
                        <span>Target details</span>
                        <span>UHF PASSIVE</span>
                      </div>
                      <div className="text-xs font-bold text-neutral-700 space-y-1.5">
                        <div className="flex justify-between"><span>Name:</span> <span className="text-neutral-900 font-extrabold">{targetAsset.name}</span></div>
                        <div className="flex justify-between"><span>Tag ID:</span> <span className="text-neutral-900 font-mono">{targetAsset.assetTag}</span></div>
                        <div className="flex justify-between"><span>EPC code:</span> <span className="text-neutral-900 font-mono text-[10px]">{targetAsset.epc}</span></div>
                        <div className="flex justify-between"><span>Expected Room:</span> <span className="text-neutral-900 font-bold text-[#ff4f3a]">{targetAsset.expectedRoom}</span></div>
                      </div>
                    </div>

                    {/* Geiger activation switch */}
                    <div className="space-y-3">
                      <button
                        onClick={() => {
                          setGeigerActive(!geigerActive);
                          playChime(600, 0.15);
                        }}
                        className={`w-full py-4 text-xs font-black uppercase tracking-widest rounded-xl transition select-none flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                          geigerActive 
                            ? 'bg-[#ff4f3a] hover:bg-[#e0402c] text-white' 
                            : 'bg-neutral-900 hover:bg-neutral-850 text-white'
                        }`}
                      >
                        {geigerActive ? (
                          <>
                            <Square size={14} fill="white" />
                            <span>Deactivate Locator</span>
                          </>
                        ) : (
                          <>
                            <Play size={14} fill="white" />
                            <span>Arm Geiger Locator Wand</span>
                          </>
                        )}
                      </button>
                      <p className="text-[10px] text-neutral-400 font-semibold text-center italic">
                        * Note: Ensure your speaker is unmuted. This tool will synthesize real audio signal feedback clicks based on simulated distance.
                      </p>
                    </div>
                  </div>

                  {/* Right interactive panel */}
                  <div className="bg-neutral-900 text-white rounded-3xl p-6 border border-neutral-800 flex flex-col items-center justify-center space-y-6 text-center min-h-[300px] relative overflow-hidden">
                    {geigerActive && (
                      <div 
                        className="absolute inset-0 bg-red-500/5 pointer-events-none transition-all duration-75"
                        style={{ opacity: proximity / 100 }}
                      />
                    )}

                    {/* Dynamic circular pulse widget */}
                    <div className="relative flex items-center justify-center">
                      <motion.div
                        animate={geigerActive ? {
                          scale: [1, 1.2 + (proximity/100)*0.8, 1],
                          opacity: [0.3, 0.8, 0.3],
                        } : {}}
                        transition={{
                          duration: Math.max(0.1, (100 - proximity) / 80),
                          repeat: Infinity,
                          ease: 'easeInOut'
                        }}
                        className="absolute w-24 h-24 bg-[#ff4f3a]/20 rounded-full"
                      />
                      <div className="bg-neutral-800 border-2 border-neutral-700 w-16 h-16 rounded-full flex items-center justify-center relative z-10 shadow-lg">
                        <Compass className={`text-white w-8 h-8 ${geigerActive ? 'animate-pulse' : ''}`} />
                      </div>
                    </div>

                    <div className="space-y-1 relative z-10">
                      <p className="text-[10px] font-mono uppercase font-black tracking-widest text-[#ff4f3a]">Geiger Signal Echo</p>
                      <h4 className="text-2xl font-black font-mono">{geigerActive ? `${proximity}%` : 'LOCATOR DISARMED'}</h4>
                      <p className="text-[10px] text-neutral-500 font-bold uppercase font-mono">
                        {geigerActive ? `RSSI Signal spikes at -${100 - Math.round(proximity * 0.6)} dBm` : 'Ready to parse space echoes'}
                      </p>
                    </div>

                    {/* Proximity Slider to test synthesize */}
                    <div className="w-full space-y-2 relative z-10">
                      <div className="flex justify-between text-[10px] font-mono font-black uppercase text-neutral-400">
                        <span>Simulate Wand Proximity</span>
                        <span>{proximity}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        disabled={!geigerActive}
                        value={proximity}
                        onChange={(e) => setProximity(Number(e.target.value))}
                        className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[#ff4f3a] disabled:opacity-30"
                      />
                      <div className="flex justify-between text-[8px] font-mono text-neutral-500 font-bold uppercase">
                        <span>Far (Slow clicks)</span>
                        <span>Hot (Constant Buzz)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ENCODE TAB: Tag Programming */}
            {activeTab === 'encode' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm space-y-6"
              >
                <div className="border-b border-neutral-150 pb-4">
                  <h3 className="text-sm font-black uppercase tracking-tight text-neutral-900">UHF RFID Tag Encoder & Memory Writer</h3>
                  <p className="text-[11px] text-neutral-500">Program Electronic Product Codes (EPC) onto passive smart labels linked to your gear entries.</p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  {/* Config Form */}
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-neutral-700 block uppercase">1. Select Target Gear Entry</label>
                      <select
                        value={encoderAsset.id}
                        onChange={(e) => {
                          const asset = PRELOADED_RFID_ASSETS.find(a => a.id === e.target.value);
                          if (asset) setEncoderAsset(asset);
                        }}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-xs font-bold text-neutral-800 focus:outline-none"
                      >
                        {PRELOADED_RFID_ASSETS.map(a => (
                          <option key={a.id} value={a.id}>{a.name} ({a.assetTag})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-neutral-700 block uppercase">2. Input EPC Hex string (96-Bit)</label>
                        <button 
                          onClick={handleRandomEPC}
                          className="text-[10px] font-mono font-black text-[#ff4f3a] uppercase tracking-wider bg-transparent border-0 cursor-pointer"
                        >
                          Generate Random Hex
                        </button>
                      </div>
                      <input
                        type="text"
                        maxLength={24}
                        value={customEPC}
                        onChange={(e) => setCustomEPC(e.target.value.toUpperCase().replace(/[^0-9A-FA-F]/g, ''))}
                        placeholder="E2801130200020B..."
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-xs font-mono font-bold text-neutral-800 focus:outline-none"
                      />
                      <div className="flex justify-between text-[8px] font-mono text-neutral-400 font-bold uppercase">
                        <span>Hex characters only</span>
                        <span>{customEPC.length} / 24 characters</span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <button
                        onClick={handleEncodeTag}
                        disabled={isEncoding}
                        className={`w-full py-3.5 text-xs font-black uppercase tracking-widest rounded-xl transition select-none flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                          isEncoding 
                            ? 'bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed' 
                            : 'bg-neutral-900 hover:bg-neutral-850 text-white'
                        }`}
                      >
                        {isEncoding ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" />
                            <span>Writing Memory Block... {encodeProgress}%</span>
                          </>
                        ) : (
                          <>
                            <Tag size={14} />
                            <span>Write EPC Tag Memory</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Encoder visual representation */}
                  <div className="bg-neutral-50 border border-neutral-200 rounded-3xl p-6 flex flex-col items-center justify-center space-y-4 text-center min-h-[250px]">
                    <div className="bg-white border border-neutral-250 p-6 rounded-2xl shadow-sm w-full max-w-sm flex items-center gap-4 relative overflow-hidden">
                      <div className="bg-neutral-100 p-3 rounded-xl shrink-0 text-neutral-500">
                        <Tag size={28} />
                      </div>
                      <div className="text-left space-y-0.5 min-w-0 flex-1">
                        <div className="bg-[#ff4f3a]/10 border border-[#ff4f3a]/20 text-[#ff4f3a] font-mono font-black text-[8px] px-1.5 py-0.5 rounded uppercase w-fit tracking-wider">
                          UHF GEN2 PASSIVE CHIP
                        </div>
                        <h4 className="text-xs font-extrabold text-neutral-850 truncate">{encoderAsset.name}</h4>
                        <p className="text-[10px] font-mono text-neutral-500 font-bold">Serial Ref: {encoderAsset.assetTag}</p>
                        <p className="text-[9px] font-mono text-neutral-400 truncate">EPC: {customEPC || '---'}</p>
                      </div>

                      {isEncoding && (
                        <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center p-4">
                          <div className="w-full bg-neutral-200 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-[#ff4f3a] h-full transition-all duration-300" style={{ width: `${encodeProgress}%` }} />
                          </div>
                          <span className="text-[9px] font-mono font-black uppercase text-neutral-600 mt-2">Programming Block 1 Memory ({encodeProgress}%)</span>
                        </div>
                      )}
                    </div>

                    <p className="text-[10px] text-neutral-400 font-semibold max-w-xs">
                      * Bring the Zebra reader's antenna nose within 10cm of the passive tag adhesive before sending memory writes to avoid programming adjacent labels.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ROI TAB: Cost & ROI Evaluation */}
            {activeTab === 'roi' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Cost Calibrations Sliders */}
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm space-y-5 md:col-span-1">
                    <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800 border-b border-neutral-150 pb-3">Deployment Params</h3>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold text-neutral-700">
                        <span>1. Assets to tag</span>
                        <span className="font-mono text-neutral-950 font-extrabold">{assetCount} qty</span>
                      </div>
                      <input
                        type="range"
                        min="100"
                        max="10000"
                        step="100"
                        value={assetCount}
                        onChange={(e) => setAssetCount(Number(e.target.value))}
                        className="w-full h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-[#ff4f3a]"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold text-neutral-700">
                        <span>2. RFD40 Handheld Sleds</span>
                        <span className="font-mono text-neutral-950 font-extrabold">{sledCount} qty</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="20"
                        step="1"
                        value={sledCount}
                        onChange={(e) => setSledCount(Number(e.target.value))}
                        className="w-full h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-[#ff4f3a]"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold text-neutral-700">
                        <span>3. Fixed Portal Gates</span>
                        <span className="font-mono text-neutral-950 font-extrabold">{portalCount} qty</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        step="1"
                        value={portalCount}
                        onChange={(e) => setPortalCount(Number(e.target.value))}
                        className="w-full h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-[#ff4f3a]"
                      />
                    </div>
                  </div>

                  {/* Computations Output */}
                  <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm md:col-span-2 space-y-6">
                    <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800 border-b border-neutral-150 pb-3">Estimated Investment Summary & ROI</h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                      <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-150">
                        <span className="text-[9px] font-mono font-black text-neutral-400 uppercase tracking-widest block">INITIAL CAPEX</span>
                        <span className="text-2xl font-black text-neutral-850 block mt-1">${totalCapex.toLocaleString()}</span>
                        <span className="text-[9px] text-neutral-500 font-bold block mt-1">Hardware + Passive Tags</span>
                      </div>
                      <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-150">
                        <span className="text-[9px] font-mono font-black text-[#ff4f3a] uppercase tracking-widest block">ANNUAL SAVINGS</span>
                        <span className="text-2xl font-black text-[#ff4f3a] block mt-1">${totalAnnualSavings.toLocaleString()}</span>
                        <span className="text-[9px] text-neutral-500 font-bold block mt-1">Labor + Shrinkage protection</span>
                      </div>
                      <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-150">
                        <span className="text-[9px] font-mono font-black text-emerald-600 uppercase tracking-widest block">ROI BREAKEVEN</span>
                        <span className="text-2xl font-black text-emerald-600 block mt-1">{payBackMonths} Months</span>
                        <span className="text-[9px] text-neutral-500 font-bold block mt-1">Time to recover Capex</span>
                      </div>
                    </div>

                    {/* Breakdown Matrix */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-wider text-neutral-700">Detailed Metric Forecasts</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold text-neutral-600">
                        <div className="bg-neutral-50/60 p-4 rounded-2xl border border-neutral-150 space-y-1.5">
                          <div className="text-[10px] font-mono font-black text-neutral-450 uppercase tracking-wider">Audit Labor Time (Yearly)</div>
                          <div className="flex justify-between font-mono"><span>Barcode Hand scans:</span> <span className="text-neutral-900 font-bold">{barcodeHoursPerYear} hours</span></div>
                          <div className="flex justify-between font-mono"><span>UHF RFID Bulk scans:</span> <span className="text-emerald-600 font-bold">{rfidHoursPerYear} hours</span></div>
                          <div className="text-[9px] text-neutral-400 border-t border-neutral-200 pt-1 mt-1 font-bold italic">
                            * Over 99% faster audit intervals using RF electromagnetic sweeps.
                          </div>
                        </div>

                        <div className="bg-neutral-50/60 p-4 rounded-2xl border border-neutral-150 space-y-1.5">
                          <div className="text-[10px] font-mono font-black text-neutral-450 uppercase tracking-wider">Hardware & Tag Expenses</div>
                          <div className="flex justify-between font-mono"><span>Passive Labels (UHF):</span> <span className="text-neutral-900">${tagsCost.toLocaleString()}</span></div>
                          <div className="flex justify-between font-mono"><span>Handheld Zebra Readers:</span> <span className="text-neutral-900">${(sledCount * 1250).toLocaleString()}</span></div>
                          <div className="flex justify-between font-mono"><span>Fixed Portal Gates:</span> <span className="text-neutral-900">${(portalCount * 3800).toLocaleString()}</span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
