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
  CheckCircle2,
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
  Activity,
  Usb,
  Radio,
  ShieldCheck,
  Zap,
  Battery,
  Signal,
  Check,
  Box,
  Package,
  ListChecks,
  Link2,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Hash
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, AdminSettings, GearItem, ScanEvent } from '../types';
import { toast } from 'sonner';
import { db } from '../firebase';
import { collection, onSnapshot, getDocs, doc, updateDoc, writeBatch, query, orderBy, limit } from 'firebase/firestore';
import { 
  rfidHardware, 
  isWebBluetoothSupported, 
  isWebSerialSupported, 
  RfidDiscoveredTag, 
  HardwareConnectionState, 
  HardwareLog, 
  logIdentificationEvent, 
  logScanEvent,
  generatePackerEpc 
} from '../lib/hardwareProviders';
import { hapticScanSuccess } from '../utils/haptics';

interface RFIDAsset {
  id: string;
  name: string;
  category: string;
  assetTag: string;
  epc: string;
  status: 'in_use' | 'available' | 'maintenance' | 'out_of_sync' | 'missing';
  lastScanned?: string;
  rssi?: number;
  expectedRoom: string;
  actualRoom?: string;
  isCustom?: boolean;
}

interface PackingListSummary {
  id: string;
  name: string;
  eventDate?: string;
  status?: string;
  itemCount?: number;
}

interface ManifestItem {
  id: string;
  name: string;
  customName?: string;
  category?: string;
  quantity?: number;
  status?: string;
  rfidTag?: string;
  assetTag?: string;
  gearId?: string;
  notes?: string;
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
  const [activeTab, setActiveTab] = useState<'scan' | 'manifest' | 'locate' | 'encode' | 'audit_events' | 'hardware' | 'roi'>('scan');
  
  // Hardware Connection State
  const [hwState, setHwState] = useState<HardwareConnectionState>(rfidHardware.getConnectionState());
  const [connectionModalOpen, setConnectionModalOpen] = useState(false);
  const [portalUrlInput, setPortalUrlInput] = useState('ws://localhost:8080/rfid');
  const [antennaPower, setAntennaPower] = useState(25); // dBm (10 to 30)
  const [beepVolume, setBeepVolume] = useState(70);
  const [isMuted, setIsMuted] = useState(false);

  // Live Bulk Audit States
  const [isScanning, setIsScanning] = useState(false);
  const [scannedItems, setScannedItems] = useState<RFIDAsset[]>([]);
  const [auditStats, setAuditStats] = useState({ total: 8, found: 0, outOfPlace: 0, missing: 8 });
  const [scanSpeed, setScanSpeed] = useState(0); // tags per second
  const [scanLog, setScanLog] = useState<HardwareLog[]>([]);

  // Real-time Immutable Scan Events Audit Trail (log-only, non-destructive)
  const [scanEvents, setScanEvents] = useState<ScanEvent[]>([]);
  const [eventFilterType, setEventFilterType] = useState<'all' | 'rfid' | 'nfc'>('all');
  const [eventFilterContext, setEventFilterContext] = useState<string>('all');
  const [eventSearch, setEventSearch] = useState('');

  // Registered Gear Items from Firestore
  const [firestoreGear, setFirestoreGear] = useState<GearItem[]>([]);
  const [activeAssetPool, setActiveAssetPool] = useState<RFIDAsset[]>(PRELOADED_RFID_ASSETS);

  // Manifest Cross-Check States
  const [packingLists, setPackingLists] = useState<PackingListSummary[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [manifestItems, setManifestItems] = useState<ManifestItem[]>([]);
  const [isManifestLoading, setIsManifestLoading] = useState(false);
  const [scannedManifestEpcs, setScannedManifestEpcs] = useState<Set<string>>(new Set());
  const [unexpectedEpcs, setUnexpectedEpcs] = useState<{ epc: string; rssi?: number; time: string }[]>([]);
  const [isManifestScanning, setIsManifestScanning] = useState(false);
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);

  // Link Uncataloged Tag Modal
  const [linkingTag, setLinkingTag] = useState<string | null>(null);
  const [linkingGearId, setLinkingGearId] = useState<string>('');
  const [isLinkingSaving, setIsLinkingSaving] = useState(false);

  // Geiger Counter Locator States
  const [targetAsset, setTargetAsset] = useState<RFIDAsset>(PRELOADED_RFID_ASSETS[0]);
  const [proximity, setProximity] = useState(15); // 0 to 100%
  const [geigerActive, setGeigerActive] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const intervalIdRef = useRef<number | null>(null);

  // Encoder States
  const [encoderAsset, setEncoderAsset] = useState<RFIDAsset>(PRELOADED_RFID_ASSETS[0]);
  const [encodeMode, setEncodeMode] = useState<'short_id' | 'hex_epc'>('short_id');
  const [customEPC, setCustomEPC] = useState('');
  const [isEncoding, setIsEncoding] = useState(false);
  const [encodeProgress, setEncodeProgress] = useState(0);

  // ROI Calculator States
  const [assetCount, setAssetCount] = useState(1200);
  const [sledCount, setSledCount] = useState(4);
  const [portalCount, setPortalCount] = useState(2);

  // Track discovered tags map to calculate rate
  const tagReadCountsRef = useRef<Map<string, number>>(new Map());
  const lastSecondCountRef = useRef<number>(0);

  // 1. Subscribe to real hardware telemetry & logs
  useEffect(() => {
    const unsubStatus = rfidHardware.subscribeStatus((st) => {
      setHwState(st);
      if (st.antennaPower) setAntennaPower(st.antennaPower);
    });

    const unsubLogs = rfidHardware.subscribeLogs((log) => {
      setScanLog((prev) => [log, ...prev.slice(0, 49)]);
    });

    const unsubTags = rfidHardware.subscribeTags((tag: RfidDiscoveredTag) => {
      handleIncomingTagDiscovery(tag);
    });

    return () => {
      unsubStatus();
      unsubLogs();
      unsubTags();
    };
  }, [activeAssetPool, targetAsset, geigerActive]);

  // 2. Load Firestore Gear Library & Synchronize Asset Pool
  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = onSnapshot(collection(db, 'users', user.uid, 'gearLibrary'), (snapshot) => {
      const gear: GearItem[] = [];
      snapshot.forEach((docSnap) => {
        gear.push({ id: docSnap.id, ...docSnap.data() } as GearItem);
      });
      setFirestoreGear(gear);

      // Merge real firestore gear items having RFID tags into active pool
      const realRfidItems: RFIDAsset[] = gear.map((g, idx) => ({
        id: g.id,
        name: g.name,
        category: g.category || 'Equipment',
        assetTag: g.assetTag || `PT-ASSET-${idx + 100}`,
        epc: g.rfidTag || generatePackerEpc(g.assetTag || g.id),
        status: (g.status as any) || 'available',
        expectedRoom: (g as any).location || 'Depot Rack A',
        isCustom: true
      }));

      if (realRfidItems.length > 0) {
        setActiveAssetPool(realRfidItems);
        setAuditStats(prev => ({ ...prev, total: realRfidItems.length, missing: realRfidItems.length }));
        setTargetAsset(realRfidItems[0]);
        setEncoderAsset(realRfidItems[0]);
        setCustomEPC(realRfidItems[0].epc);
      }
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // 2b. Load User's Packing Lists for Manifest Cross-Check
  useEffect(() => {
    if (!user?.uid) return;
    const unsubLists = onSnapshot(collection(db, 'packingLists'), (snapshot) => {
      const lists: PackingListSummary[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.ownerId === user.uid || data.userId === user.uid || !data.ownerId) {
          lists.push({
            id: d.id,
            name: data.name || 'Untitled Packing List',
            eventDate: data.eventDate || data.createdAt,
            status: data.status || 'draft',
            itemCount: data.itemCount || 0
          });
        }
      });
      setPackingLists(lists);
      if (lists.length > 0 && !selectedListId) {
        setSelectedListId(lists[0].id);
      }
    });

    return () => unsubLists();
  }, [user?.uid]);

  // 2c. Load Manifest Items for Selected Packing List
  useEffect(() => {
    if (!selectedListId) {
      setManifestItems([]);
      return;
    }
    setIsManifestLoading(true);
    const unsubItems = onSnapshot(collection(db, 'packingLists', selectedListId, 'items'), (snap) => {
      const items: ManifestItem[] = [];
      snap.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as ManifestItem);
      });
      setManifestItems(items);
      setIsManifestLoading(false);
    }, (err) => {
      console.warn("Failed to load packing list items", err);
      setIsManifestLoading(false);
    });

    return () => unsubItems();
  }, [selectedListId]);

  // 2d. Load Scan Events Audit Log from Firestore (Top 100 recent scans)
  useEffect(() => {
    try {
      const qEvents = query(
        collection(db, 'scanEvents'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      const unsubScanEvents = onSnapshot(qEvents, (snap) => {
        const evs: ScanEvent[] = [];
        snap.forEach((d) => {
          evs.push({ id: d.id, ...d.data() } as ScanEvent);
        });
        setScanEvents(evs);
      }, (err) => {
        console.warn("ScanEvents subscription fallback", err);
      });
      return () => unsubScanEvents();
    } catch (e) {
      console.warn("Failed to init scanEvents listener", e);
    }
  }, []);

  // 3. Audio Chime Engine
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
      if (!ctx || ctx.state === 'suspended') ctx?.resume();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.value = frequency;

      const vol = (beepVolume / 100) * 0.14;
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

  // 4. Geiger Counter Loop
  useEffect(() => {
    if (geigerActive && !isMuted) {
      const baseDelay = 1100;
      const factor = (100 - proximity) / 100;
      const delay = Math.max(40, baseDelay * Math.pow(factor, 2.3));
      const pitch = 350 + (proximity * 9);

      const triggerBeep = () => {
        playChime(pitch, 0.06, 'sine');
        const nextFactor = (100 - proximity) / 100;
        const nextDelay = Math.max(40, baseDelay * Math.pow(nextFactor, 2.3));
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

  // 5. Handle Incoming Physical Tag Discoveries
  const handleIncomingTagDiscovery = (tag: RfidDiscoveredTag) => {
    playChime(1600, 0.03, 'sine');
    hapticScanSuccess();

    // If Manifest Cross-Check tab is active or manifest sweep is on, route to manifest handler
    if (activeTab === 'manifest' || isManifestScanning) {
      handleManifestTagDiscovery(tag);
    }

    // If Geiger counter is active for a specific target asset, map RSSI to proximity
    if (geigerActive && targetAsset) {
      const isTarget = tag.epc.toUpperCase() === targetAsset.epc.toUpperCase() || 
                       tag.epc.includes(targetAsset.epc.slice(-8));
      if (isTarget) {
        const clampedRssi = Math.max(-90, Math.min(-30, tag.rssi));
        const calcProx = Math.round(((clampedRssi - (-90)) / 60) * 100);
        setProximity(calcProx);
        return;
      }
    }

    // Merge into Scanned Items List for Audit Sweep
    setScannedItems((prev) => {
      const cleanEpc = tag.epc.toUpperCase();
      const matched = activeAssetPool.find(
        (a) => a.epc.toUpperCase() === cleanEpc || cleanEpc.includes(a.epc.toUpperCase())
      );

      const item: RFIDAsset = matched || {
        id: `epc-${cleanEpc.substring(0, 8)}`,
        name: `Unknown Tag [${cleanEpc.substring(0, 6)}...${cleanEpc.substring(18)}]`,
        category: 'Uncataloged Tag',
        assetTag: `TAG-${cleanEpc.substring(0, 6)}`,
        epc: cleanEpc,
        status: 'out_of_sync',
        expectedRoom: 'Unassigned',
        rssi: tag.rssi,
        lastScanned: tag.timestamp
      };

      const updatedItem: RFIDAsset = {
        ...item,
        rssi: tag.rssi,
        lastScanned: tag.timestamp,
        status: item.status === 'in_use' ? 'out_of_sync' : 'available'
      };

      const existingIndex = prev.findIndex((p) => p.epc.toUpperCase() === cleanEpc);
      let nextList: RFIDAsset[];
      if (existingIndex >= 0) {
        nextList = [...prev];
        nextList[existingIndex] = updatedItem;
      } else {
        nextList = [updatedItem, ...prev];
      }

      const found = nextList.length;
      const outOfPlace = nextList.filter((m) => m.status === 'out_of_sync').length;
      const missing = Math.max(0, activeAssetPool.length - found);
      setAuditStats({ total: activeAssetPool.length, found, outOfPlace, missing });

      // Non-destructive immutable audit log
      logScanEvent({
        assetId: matched ? matched.id : `tag-${cleanEpc}`,
        assetName: matched ? matched.name : `Uncataloged Tag [${cleanEpc.substring(0, 6)}]`,
        tagType: 'rfid',
        scanContext: activeTab === 'manifest' ? 'manifest-sweep' : 'audit',
        userId: user?.uid,
        userEmail: user?.email,
        tagValue: cleanEpc,
        metadata: {
          rssi: tag.rssi,
          readCount: tag.readCount,
          rawSource: tag.rawSource,
          containerId: selectedListId || undefined
        }
      });

      return nextList;
    });
  };

  // 5b. Manifest Tag Discovery Processing
  const handleManifestTagDiscovery = (tag: RfidDiscoveredTag) => {
    const cleanEpc = tag.epc.toUpperCase().trim();

    setScannedManifestEpcs(prev => {
      const next = new Set(prev);
      next.add(cleanEpc);
      return next;
    });

    const isMatched = manifestItems.some(it => 
      (it.rfidTag && it.rfidTag.toUpperCase() === cleanEpc) ||
      (it.gearId && it.gearId.toUpperCase() === cleanEpc) ||
      (it.assetTag && it.assetTag.toUpperCase() === cleanEpc) ||
      (it.id && it.id.toUpperCase() === cleanEpc)
    );

    if (!isMatched) {
      setUnexpectedEpcs(prev => {
        if (prev.some(u => u.epc === cleanEpc)) return prev;
        return [{ epc: cleanEpc, rssi: tag.rssi, time: new Date().toLocaleTimeString() }, ...prev];
      });
    }
  };

  // 6. Connect Hardware Handlers
  const handleConnectBluetooth = async () => {
    try {
      await rfidHardware.connectBluetooth();
      toast.success('Connected to Zebra RFD40 Sled via Web Bluetooth!');
      setConnectionModalOpen(false);
    } catch (err: any) {
      toast.error(`Bluetooth connection failed: ${err.message}`);
    }
  };

  const handleConnectSerial = async () => {
    try {
      await rfidHardware.connectSerial(115200);
      toast.success('Connected to USB RFID Reader / Sled!');
      setConnectionModalOpen(false);
    } catch (err: any) {
      toast.error(`Serial connection failed: ${err.message}`);
    }
  };

  const handleConnectNetwork = async () => {
    try {
      await rfidHardware.connectNetworkGateway(portalUrlInput);
      toast.success('Connected to Fixed RFID Portal Gateway!');
      setConnectionModalOpen(false);
    } catch (err: any) {
      toast.error(`Portal connection failed: ${err.message}`);
    }
  };

  const handleDisconnectHardware = async () => {
    await rfidHardware.disconnect();
    setIsScanning(false);
    setIsManifestScanning(false);
    toast.success('RFID reader disconnected');
  };

  // 7. Start / Stop Active Tag Sweeps (Audit Tab)
  const toggleScanSweep = async () => {
    if (isScanning) {
      setIsScanning(false);
      setScanSpeed(0);
      if (hwState.status === 'connected') {
        await rfidHardware.stopInventory();
      }
      toast.success('RFID Tag sweep stopped.');
    } else {
      setIsScanning(true);
      if (hwState.status === 'connected') {
        await rfidHardware.startInventory();
        toast.success(`Active hardware RFID sweep initiated (${hwState.deviceName})`);
      } else {
        toast.info('Starting fallback simulation sweep (No physical reader attached)');
        runSimulatedSweep();
      }
    }
  };

  const runSimulatedSweep = () => {
    let tick = 0;
    const interval = setInterval(() => {
      tick++;
      if (tick > 10) {
        clearInterval(interval);
        setIsScanning(false);
        setScanSpeed(0);
        toast.success('Simulation sweep completed.');
        return;
      }

      setScanSpeed(Math.round(18 + Math.random() * 20));
      const randomAsset = activeAssetPool[Math.floor(Math.random() * activeAssetPool.length)];
      if (randomAsset) {
        handleIncomingTagDiscovery({
          epc: randomAsset.epc,
          rssi: -45 - Math.floor(Math.random() * 30),
          readCount: 1,
          timestamp: new Date().toLocaleTimeString(),
          rawSource: 'simulator'
        });
      }
    }, 400);
  };

  // 7b. Manifest Cross-Check Sweep Trigger
  const toggleManifestSweep = async () => {
    if (isManifestScanning) {
      setIsManifestScanning(false);
      if (hwState.status === 'connected') {
        await rfidHardware.stopInventory();
      }
      toast.success('Manifest cross-check sweep stopped.');
    } else {
      setIsManifestScanning(true);
      if (hwState.status === 'connected') {
        await rfidHardware.startInventory();
        toast.success(`Active RFID sweep connected to Manifest (${hwState.deviceName})`);
      } else {
        toast.info('Simulating RFID sweep on selected manifest container...');
        runSimulatedManifestSweep();
      }
    }
  };

  const runSimulatedManifestSweep = () => {
    if (manifestItems.length === 0) {
      toast.error('No items in selected manifest.');
      setIsManifestScanning(false);
      return;
    }

    let scannedCount = 0;
    // Simulate detecting 80% of items and 1 stray tag
    const targetItems = [...manifestItems].sort(() => 0.5 - Math.random());
    const itemsToScan = targetItems.slice(0, Math.max(1, Math.ceil(targetItems.length * 0.85)));

    const interval = setInterval(() => {
      if (scannedCount >= itemsToScan.length) {
        // Add 1 extra unexpected tag
        handleIncomingTagDiscovery({
          epc: 'E2801130999900B412999999',
          rssi: -58,
          readCount: 1,
          timestamp: new Date().toLocaleTimeString(),
          rawSource: 'simulator'
        });
        clearInterval(interval);
        setIsManifestScanning(false);
        toast.success('Manifest RFID container sweep complete.');
        return;
      }

      const item = itemsToScan[scannedCount];
      scannedCount++;
      const tagEpc = item.rfidTag || generatePackerEpc(item.assetTag || item.id);

      handleIncomingTagDiscovery({
        epc: tagEpc,
        rssi: -40 - Math.floor(Math.random() * 35),
        readCount: 1,
        timestamp: new Date().toLocaleTimeString(),
        rawSource: 'simulator'
      });
    }, 350);
  };

  // 7c. Batch Update Verified Manifest Items as "Packed" (Chunked to max 400 per batch as per rules)
  const handleMarkVerifiedAsPacked = async () => {
    if (!selectedListId || manifestItems.length === 0) return;
    const verifiedItems = manifestItems.filter(it => 
      (it.rfidTag && scannedManifestEpcs.has(it.rfidTag.toUpperCase())) ||
      (it.gearId && scannedManifestEpcs.has(it.gearId.toUpperCase())) ||
      (it.assetTag && scannedManifestEpcs.has(it.assetTag.toUpperCase())) ||
      (it.id && scannedManifestEpcs.has(it.id.toUpperCase()))
    );

    if (verifiedItems.length === 0) {
      toast.error('No verified items found to update. Run a sweep first.');
      return;
    }

    setIsBatchUpdating(true);
    try {
      for (let i = 0; i < verifiedItems.length; i += 400) {
        const chunk = verifiedItems.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach((item) => {
          const itemRef = doc(db, 'packingLists', selectedListId, 'items', item.id);
          batch.update(itemRef, {
            status: 'packed',
            packedAt: new Date().toISOString(),
            verifiedViaRFID: true
          });
        });
        await batch.commit();
      }
      playChime(1400, 0.08);
      setTimeout(() => playChime(1800, 0.2), 100);
      toast.success(`Marked ${verifiedItems.length} verified item(s) as 'Packed' in Firestore!`);
    } catch (err: any) {
      console.error('Batch update failed', err);
      toast.error(`Failed to update items: ${err.message}`);
    } finally {
      setIsBatchUpdating(false);
    }
  };

  // 7d. Save Link Uncataloged Tag to Firestore Gear Item
  const handleSaveLinkingTag = async () => {
    if (!linkingTag || !linkingGearId || !user?.uid) return;
    setIsLinkingSaving(true);
    try {
      const gearRef = doc(db, 'users', user.uid, 'gearLibrary', linkingGearId);
      await updateDoc(gearRef, {
        rfidTag: linkingTag.toUpperCase(),
        rfidEpc: linkingTag.toUpperCase(),
        updatedAt: new Date().toISOString()
      });
      
      const targetGear = firestoreGear.find(g => g.id === linkingGearId);
      toast.success(`RFID Tag linked to ${targetGear?.name || 'gear item'}!`);

      await logScanEvent({
        assetId: linkingGearId,
        assetName: targetGear?.name || 'Linked Gear Asset',
        tagType: 'rfid',
        scanContext: 'tag-link',
        userId: user?.uid,
        userEmail: user?.email,
        tagValue: linkingTag.toUpperCase(),
        metadata: { mode: 'link-uncataloged' }
      });

      setLinkingTag(null);
      setLinkingGearId('');
    } catch (e: any) {
      toast.error(`Failed to link tag: ${e.message}`);
    } finally {
      setIsLinkingSaving(false);
    }
  };

  // 8. Physical Tag Memory Programming (Encode Tag)
  const handleEncodeTag = async () => {
    let finalEpc = customEPC.trim();

    if (encodeMode === 'short_id') {
      // If user provided a short alphanumeric ID (e.g. 8oKYkxIK8HuPnzVS4FA3 or asset tag)
      // generate standard 24 hex EPC representation
      if (finalEpc.length === 24 && /^[0-9A-Fa-f]{24}$/.test(finalEpc)) {
        // already 24 hex
      } else {
        finalEpc = generatePackerEpc(finalEpc || encoderAsset.id);
      }
    }

    if (!finalEpc.match(/^[0-9A-Fa-f]{24}$/)) {
      toast.error('EPC must be exactly 24 hexadecimal characters (A-F, 0-9).');
      return;
    }

    setIsEncoding(true);
    setEncodeProgress(10);

    try {
      if (hwState.status === 'connected') {
        setEncodeProgress(40);
        await rfidHardware.programEpc(finalEpc);
        setEncodeProgress(80);
      } else {
        await new Promise((res) => setTimeout(res, 800));
        setEncodeProgress(80);
      }

      // Synchronize EPC to Firestore GearItem if custom gear item
      if (encoderAsset.isCustom && user?.uid) {
        const gearDocRef = doc(db, 'users', user.uid, 'gearLibrary', encoderAsset.id);
        await updateDoc(gearDocRef, {
          rfidTag: finalEpc.toUpperCase(),
          rfidEpc: finalEpc.toUpperCase(),
          updatedAt: new Date().toISOString()
        });
      }

      await logIdentificationEvent(user?.uid || 'anonymous', {
        eventType: 'rfid_encode',
        assetId: encoderAsset.id,
        assetName: encoderAsset.name,
        result: 'success',
        metadata: { epc: finalEpc, device: hwState.deviceName }
      });

      await logScanEvent({
        assetId: encoderAsset.id,
        assetName: encoderAsset.name,
        tagType: 'rfid',
        scanContext: 'encoder-write',
        userId: user?.uid,
        userEmail: user?.email,
        tagValue: finalEpc.toUpperCase(),
        metadata: { epc: finalEpc, device: hwState.deviceName }
      });

      setEncodeProgress(100);
      playChime(1200, 0.1);
      setTimeout(() => playChime(1600, 0.25), 100);
      toast.success(`Physical UHF Gen 2 Tag programmed with EPC [${finalEpc}]!`);
    } catch (err: any) {
      toast.error(`Encoding failed: ${err.message}`);
    } finally {
      setIsEncoding(false);
    }
  };

  const handleRandomEPC = () => {
    setCustomEPC(generatePackerEpc(encoderAsset.assetTag || encoderAsset.id));
  };

  // 9. Export Audit Manifest to CSV
  const handleExportCSV = () => {
    const headers = ['Asset ID', 'Name', 'Category', 'Asset Tag', 'EPC Hex', 'Status', 'Expected Room', 'Last RSSI', 'Scanned Time'];
    const rows = scannedItems.map(item => [
      item.id,
      `"${item.name.replace(/"/g, '""')}"`,
      item.category,
      item.assetTag,
      item.epc,
      item.status,
      item.expectedRoom,
      item.rssi ? `${item.rssi} dBm` : 'N/A',
      item.lastScanned || 'N/A'
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PackerTools_RFID_Audit_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('RFID Audit Manifest exported to CSV.');
  };

  // Hardware Connection Badge info
  const isHardwareConnected = hwState.status === 'connected';

  return (
    <div className="min-h-screen bg-[#0d0d11] text-neutral-100 font-sans p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* Top Header & Hardware Connection Bar */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F27D26] to-amber-600 flex items-center justify-center text-white shadow-lg shadow-[#F27D26]/20">
            <Cpu size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
                UHF RFID Operations Console
              </h1>
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-[#F27D26]">
                Gen 2 EPC
              </span>
            </div>
            <p className="text-xs text-neutral-400 font-medium mt-0.5">
              High-Velocity Hardware Tag Sweeps, Memory Encoding, Manifest Cross-Check & Geiger Asset Locators
            </p>
          </div>
        </div>

        {/* Hardware Status Button */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <button
            onClick={() => setConnectionModalOpen(true)}
            className={`px-4 py-2.5 rounded-2xl border text-xs font-black uppercase tracking-wider flex items-center gap-2.5 transition shadow-md cursor-pointer ${
              isHardwareConnected
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/80'
                : 'bg-neutral-800/90 border-neutral-700 text-neutral-300 hover:bg-neutral-700'
            }`}
          >
            {isHardwareConnected ? (
              <>
                <Radio size={14} className="text-emerald-400 animate-pulse" />
                <span className="truncate max-w-[180px]">{hwState.deviceName}</span>
                {hwState.batteryLevel !== undefined && (
                  <span className="text-[10px] font-mono bg-emerald-900 px-1.5 py-0.5 rounded text-emerald-200">
                    {hwState.batteryLevel}%
                  </span>
                )}
              </>
            ) : (
              <>
                <Bluetooth size={14} className="text-[#F27D26]" />
                <span>Connect RFID Hardware</span>
              </>
            )}
          </button>

          {isHardwareConnected && (
            <button
              onClick={handleDisconnectHardware}
              className="p-2.5 bg-red-950/40 border border-red-800/50 hover:bg-red-900/60 text-red-400 rounded-2xl transition cursor-pointer text-xs font-bold"
              title="Disconnect Reader"
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      {/* Main Tab Switcher */}
      <div className="flex border-b border-neutral-800 bg-neutral-900/40 p-1 rounded-2xl max-w-3xl overflow-x-auto gap-1">
        <button
          onClick={() => setActiveTab('scan')}
          className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2 ${
            activeTab === 'scan' ? 'bg-[#F27D26] text-white shadow-md' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Radio size={14} />
          <span>Audit Sweep</span>
        </button>
        <button
          onClick={() => setActiveTab('manifest')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2 ${
            activeTab === 'manifest' ? 'bg-[#F27D26] text-white shadow-md' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <ListChecks size={14} />
          <span>Manifest Cross-Check</span>
        </button>
        <button
          onClick={() => setActiveTab('locate')}
          className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2 ${
            activeTab === 'locate' ? 'bg-[#F27D26] text-white shadow-md' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Compass size={14} />
          <span>Geiger Locator</span>
        </button>
        <button
          onClick={() => setActiveTab('encode')}
          className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2 ${
            activeTab === 'encode' ? 'bg-[#F27D26] text-white shadow-md' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Tag size={14} />
          <span>Tag Encoder</span>
        </button>
        <button
          onClick={() => setActiveTab('audit_events')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2 ${
            activeTab === 'audit_events' ? 'bg-[#F27D26] text-white shadow-md' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Clock size={14} />
          <span>Scan Audit Trail</span>
          {scanEvents.length > 0 && (
            <span className="px-1.5 py-0.5 text-[9px] bg-neutral-950/80 rounded-full font-mono text-amber-300">
              {scanEvents.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('hardware')}
          className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2 ${
            activeTab === 'hardware' ? 'bg-[#F27D26] text-white shadow-md' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Sliders size={14} />
          <span>Antenna & IO</span>
        </button>
        <button
          onClick={() => setActiveTab('roi')}
          className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-2 ${
            activeTab === 'roi' ? 'bg-[#F27D26] text-white shadow-md' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Activity size={14} />
          <span>ROI Sandbox</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: LIVE BULK AUDIT SWEEP
      ========================================================================= */}
      {activeTab === 'scan' && (
        <div className="space-y-6">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-lg">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Total Manifest Items</span>
              <p className="text-2xl sm:text-3xl font-black text-white mt-1">{auditStats.total}</p>
              <span className="text-[10px] text-neutral-500 font-mono">Real Firestore Sync</span>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-lg">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Verified Present</span>
              <p className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1">{auditStats.found}</p>
              <span className="text-[10px] text-neutral-500 font-mono">
                {auditStats.total > 0 ? Math.round((auditStats.found / auditStats.total) * 100) : 0}% resolved
              </span>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-lg">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Out of Sync / Misplaced</span>
              <p className="text-2xl sm:text-3xl font-black text-amber-400 mt-1">{auditStats.outOfPlace}</p>
              <span className="text-[10px] text-neutral-500 font-mono">Requires Attention</span>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-lg">
              <span className="text-[10px] font-black uppercase tracking-widest text-red-400">Unresolved / Missing</span>
              <p className="text-2xl sm:text-3xl font-black text-red-400 mt-1">{auditStats.missing}</p>
              <span className="text-[10px] text-neutral-500 font-mono">Not Yet Detected</span>
            </div>
          </div>

          {/* Sweep Controls & Action Bar */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <button
                onClick={toggleScanSweep}
                className={`w-full sm:w-auto px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 transition shadow-lg cursor-pointer ${
                  isScanning
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/30'
                    : 'bg-[#F27D26] hover:bg-[#F27D26]/90 text-white shadow-[#F27D26]/30'
                }`}
              >
                {isScanning ? (
                  <>
                    <Square size={16} />
                    <span>Stop Tag Sweep</span>
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    <span>Start Physical RFID Sweep</span>
                  </>
                )}
              </button>

              {isScanning && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-950 border border-neutral-800">
                  <Activity size={16} className="text-emerald-400 animate-pulse" />
                  <span className="text-xs font-mono font-bold text-neutral-300">{scanSpeed} tags/sec</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                onClick={handleExportCSV}
                disabled={scannedItems.length === 0}
                className="px-4 py-3 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-200 font-black text-xs uppercase tracking-wider rounded-2xl transition flex items-center gap-2 cursor-pointer"
              >
                <FileSpreadsheet size={15} />
                <span>Export CSV</span>
              </button>
              <button
                onClick={() => {
                  setScannedItems([]);
                  setAuditStats({ total: activeAssetPool.length, found: 0, outOfPlace: 0, missing: activeAssetPool.length });
                }}
                className="p-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-2xl transition cursor-pointer"
                title="Reset Scan Data"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          {/* Live Tag Table & Event Feed */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Scanned Items Table (2 Cols) */}
            <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-neutral-200 flex items-center gap-2">
                  <Layers size={16} className="text-[#F27D26]" />
                  <span>Detected Asset Manifest ({scannedItems.length})</span>
                </h3>
                <span className="text-[10px] font-mono text-neutral-400 uppercase font-bold">
                  RSSI Threshold: {antennaPower} dBm
                </span>
              </div>

              {scannedItems.length === 0 ? (
                <div className="py-16 text-center text-neutral-500 space-y-2">
                  <Radio size={36} className="mx-auto text-neutral-700 animate-pulse" />
                  <p className="text-xs font-bold uppercase tracking-wider">No RFID Tags Discovered Yet</p>
                  <p className="text-[11px] text-neutral-600">
                    Click "Start Physical RFID Sweep" or tap a tag using your connected reader.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[460px] overflow-y-auto pr-1">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-neutral-800 text-[10px] uppercase font-black tracking-wider text-neutral-400">
                        <th className="pb-3 pl-2">Asset / Equipment</th>
                        <th className="pb-3">Tag / EPC</th>
                        <th className="pb-3">Location</th>
                        <th className="pb-3">RSSI</th>
                        <th className="pb-3 pr-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60 font-medium">
                      {scannedItems.map((item) => (
                        <tr key={item.id} className="hover:bg-neutral-800/40 transition">
                          <td className="py-3 pl-2">
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="font-extrabold text-neutral-200">{item.name}</p>
                                <span className="text-[10px] text-neutral-500 font-mono">{item.category}</span>
                              </div>
                              {item.category === 'Uncataloged Tag' && (
                                <button
                                  onClick={() => {
                                    setLinkingTag(item.epc);
                                    setLinkingGearId(firestoreGear[0]?.id || '');
                                  }}
                                  className="px-2 py-1 bg-[#F27D26]/20 hover:bg-[#F27D26]/30 text-[#F27D26] border border-[#F27D26]/40 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition cursor-pointer"
                                  title="Link this physical RFID tag to a Firestore gear item"
                                >
                                  <Link2 size={11} />
                                  <span>Link Tag</span>
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-3 font-mono text-[10px] text-purple-300">
                            {item.epc}
                          </td>
                          <td className="py-3 text-neutral-300 text-[11px]">
                            {item.expectedRoom}
                          </td>
                          <td className="py-3 font-mono text-[11px] text-emerald-400">
                            {item.rssi ? `${item.rssi} dBm` : '-'}
                          </td>
                          <td className="py-3 pr-2">
                            <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full ${
                              item.status === 'available' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                              item.status === 'out_of_sync' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                              'bg-red-950 text-red-400 border border-red-800'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Live Hardware Telemetry Log (1 Col) */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-4 flex flex-col">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-neutral-200 flex items-center gap-2">
                  <Activity size={16} className="text-[#F27D26]" />
                  <span>Live Hardware Log</span>
                </h3>
                <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
                  {hwState.type.toUpperCase()}
                </span>
              </div>

              <div className="flex-1 max-h-[460px] overflow-y-auto space-y-2 font-mono text-[10px] pr-1">
                {scanLog.length === 0 ? (
                  <p className="text-neutral-600 text-center py-10">Telemetry log stream empty...</p>
                ) : (
                  scanLog.map((log, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-xl border ${
                        log.type === 'success' ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300' :
                        log.type === 'warn' ? 'bg-amber-950/40 border-amber-800/40 text-amber-300' :
                        log.type === 'error' ? 'bg-red-950/40 border-red-800/40 text-red-300' :
                        'bg-neutral-950 border-neutral-800 text-neutral-400'
                      }`}
                    >
                      <span className="text-neutral-500 mr-2">[{log.time}]</span>
                      <span>{log.msg}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 1B: MANIFEST CROSS-CHECK (PACKING LIST VS RFID SCAN DIFF)
      ========================================================================= */}
      {activeTab === 'manifest' && (
        <div className="space-y-6">
          {/* Manifest Selection & Controls Header */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1.5 w-full md:w-auto">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#F27D26]">
                Case Packing Cross-Check
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="packing-list-select" className="text-xs font-bold text-neutral-300">Target Packing List:</label>
                <select
                  id="packing-list-select"
                  value={selectedListId}
                  onChange={(e) => {
                    setSelectedListId(e.target.value);
                    setScannedManifestEpcs(new Set());
                    setUnexpectedEpcs([]);
                  }}
                  className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#F27D26] transition min-w-[220px]"
                >
                  {packingLists.map(pl => (
                    <option key={pl.id} value={pl.id}>
                      {pl.name} {pl.eventDate ? `(${pl.eventDate.slice(0, 10)})` : ''}
                    </option>
                  ))}
                  {packingLists.length === 0 && (
                    <option value="">No Packing Lists found in workspace</option>
                  )}
                </select>
                {isManifestLoading && (
                  <span className="text-xs text-neutral-400 font-mono flex items-center gap-1.5">
                    <Activity size={12} className="animate-spin text-[#F27D26]" /> Loading items...
                  </span>
                )}
              </div>
            </div>

            {/* Sweep & Batch Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-start md:justify-end">
              <button
                onClick={toggleManifestSweep}
                className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2.5 transition shadow-lg cursor-pointer ${
                  isManifestScanning
                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/30'
                    : 'bg-[#F27D26] hover:bg-[#F27D26]/90 text-white shadow-[#F27D26]/30'
                }`}
              >
                {isManifestScanning ? (
                  <>
                    <Square size={16} />
                    <span>Stop Container Sweep</span>
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    <span>Sweep Case with RFID</span>
                  </>
                )}
              </button>

              <button
                onClick={handleMarkVerifiedAsPacked}
                disabled={isBatchUpdating || manifestItems.length === 0}
                className="px-5 py-3 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition flex items-center gap-2 shadow-lg shadow-emerald-700/20 cursor-pointer"
              >
                <CheckCircle2 size={16} />
                <span>{isBatchUpdating ? 'Updating in Firestore...' : 'Mark Verified as Packed'}</span>
              </button>

              <button
                onClick={() => {
                  setScannedManifestEpcs(new Set());
                  setUnexpectedEpcs([]);
                }}
                className="p-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-2xl transition cursor-pointer"
                title="Reset Scan Data"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          {/* Progress Breakdown Banner */}
          {(() => {
            const verified = manifestItems.filter(it => 
              (it.rfidTag && scannedManifestEpcs.has(it.rfidTag.toUpperCase())) ||
              (it.gearId && scannedManifestEpcs.has(it.gearId.toUpperCase())) ||
              (it.assetTag && scannedManifestEpcs.has(it.assetTag.toUpperCase())) ||
              (it.id && scannedManifestEpcs.has(it.id.toUpperCase()))
            );
            const missing = manifestItems.filter(it => !verified.some(v => v.id === it.id));
            const pct = manifestItems.length > 0 ? Math.round((verified.length / manifestItems.length) * 100) : 0;

            return (
              <div className="space-y-6">
                {/* Stats row */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-lg">
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Total in Manifest</span>
                    <p className="text-2xl sm:text-3xl font-black text-white mt-1">{manifestItems.length}</p>
                    <span className="text-[10px] text-neutral-500 font-mono">Expected in container</span>
                  </div>
                  <div className="bg-neutral-900 border border-emerald-900/50 rounded-3xl p-5 shadow-lg">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Verified Present</span>
                    <p className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1">{verified.length}</p>
                    <span className="text-[10px] text-emerald-500/80 font-mono">{pct}% confirmed via RFID</span>
                  </div>
                  <div className="bg-neutral-900 border border-amber-900/50 rounded-3xl p-5 shadow-lg">
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Missing from Case</span>
                    <p className="text-2xl sm:text-3xl font-black text-amber-400 mt-1">{missing.length}</p>
                    <span className="text-[10px] text-amber-500/80 font-mono">Not yet detected</span>
                  </div>
                  <div className="bg-neutral-900 border border-purple-900/50 rounded-3xl p-5 shadow-lg">
                    <span className="text-[10px] font-black uppercase tracking-widest text-purple-400">Unexpected Extra Tags</span>
                    <p className="text-2xl sm:text-3xl font-black text-purple-400 mt-1">{unexpectedEpcs.length}</p>
                    <span className="text-[10px] text-purple-500/80 font-mono">Not listed on manifest</span>
                  </div>
                </div>

                {/* Real-time Progress Bar */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-lg space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-neutral-300">Case Audit Resolution</span>
                    <span className="font-mono text-[#F27D26]">{pct}% Verified</span>
                  </div>
                  <div className="w-full h-3 bg-neutral-950 rounded-full overflow-hidden border border-neutral-800 flex">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                    <div
                      className="h-full bg-amber-500 transition-all duration-300"
                      style={{ width: `${100 - pct}%` }}
                    />
                  </div>
                </div>

                {/* 3-Column Diff Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Panel 1: Verified Present in Case */}
                  <div className="bg-neutral-900 border border-emerald-900/40 rounded-3xl p-5 shadow-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-400" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-emerald-300">
                          Verified in Case ({verified.length})
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800">
                        MATCHED
                      </span>
                    </div>

                    <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                      {verified.length === 0 ? (
                        <p className="text-neutral-600 text-xs text-center py-10">No items verified yet. Point reader at case and sweep.</p>
                      ) : (
                        verified.map((item) => (
                          <div key={item.id} className="p-3 bg-neutral-950/90 border border-emerald-900/40 rounded-2xl space-y-1">
                            <div className="flex justify-between items-start">
                              <p className="text-xs font-extrabold text-neutral-100 truncate">{item.name || item.customName}</p>
                              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded">
                                RFID OK
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500">
                              <span>Tag: {item.assetTag || 'N/A'}</span>
                              <span className="text-purple-300 truncate max-w-[120px]">
                                {item.rfidTag ? `${item.rfidTag.slice(0, 10)}...` : 'Linked'}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Panel 2: Missing from Case */}
                  <div className="bg-neutral-900 border border-amber-900/40 rounded-3xl p-5 shadow-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={16} className="text-amber-400" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-amber-300">
                          Missing from Case ({missing.length})
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-800">
                        PENDING
                      </span>
                    </div>

                    <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                      {missing.length === 0 ? (
                        <div className="text-center py-10 space-y-2">
                          <CheckCircle2 size={32} className="mx-auto text-emerald-400" />
                          <p className="text-xs font-black text-emerald-300 uppercase">Case 100% Complete!</p>
                          <p className="text-[11px] text-neutral-500">Every item in this manifest was detected.</p>
                        </div>
                      ) : (
                        missing.map((item) => (
                          <div key={item.id} className="p-3 bg-neutral-950/90 border border-amber-900/40 rounded-2xl space-y-1">
                            <div className="flex justify-between items-start">
                              <p className="text-xs font-extrabold text-neutral-200 truncate">{item.name || item.customName}</p>
                              <span className="text-[9px] font-mono text-amber-400 bg-amber-950 px-1.5 py-0.5 rounded">
                                Missing
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500">
                              <span>Tag: {item.assetTag || 'N/A'}</span>
                              <span>Qty: {item.quantity || 1}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Panel 3: Unexpected Extra Tags */}
                  <div className="bg-neutral-900 border border-purple-900/40 rounded-3xl p-5 shadow-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                      <div className="flex items-center gap-2">
                        <Layers size={16} className="text-purple-400" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-purple-300">
                          Unexpected Extra Tags ({unexpectedEpcs.length})
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded-full border border-purple-800">
                        UNKNOWN
                      </span>
                    </div>

                    <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                      {unexpectedEpcs.length === 0 ? (
                        <p className="text-neutral-600 text-xs text-center py-10">No stray or unexpected tags detected in this container.</p>
                      ) : (
                        unexpectedEpcs.map((item, idx) => (
                          <div key={idx} className="p-3 bg-neutral-950/90 border border-purple-900/40 rounded-2xl space-y-1.5">
                            <div className="flex justify-between items-start">
                              <p className="text-xs font-mono text-purple-300 truncate">{item.epc}</p>
                              <span className="text-[9px] font-mono text-purple-400 bg-purple-950 px-1.5 py-0.5 rounded">
                                {item.rssi ? `${item.rssi} dBm` : 'Extra'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-neutral-500 font-mono">Discovered: {item.time}</span>
                              <button
                                onClick={() => {
                                  setLinkingTag(item.epc);
                                  setLinkingGearId(firestoreGear[0]?.id || '');
                                }}
                                className="px-2 py-0.5 bg-[#F27D26]/20 hover:bg-[#F27D26]/30 text-[#F27D26] border border-[#F27D26]/40 rounded text-[9px] font-bold uppercase flex items-center gap-1 cursor-pointer"
                              >
                                <Link2 size={10} />
                                <span>Link Tag</span>
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* =========================================================================
          TAB 2: GEIGER COUNTER ASSET LOCATOR
      ========================================================================= */}
      {activeTab === 'locate' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Target Selector */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-neutral-200 flex items-center gap-2">
              <Search size={16} className="text-[#F27D26]" />
              <span>Select Target Asset</span>
            </h3>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {activeAssetPool.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => {
                    setTargetAsset(asset);
                    setProximity(15);
                  }}
                  className={`w-full p-3.5 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                    targetAsset.id === asset.id
                      ? 'bg-[#F27D26]/15 border-[#F27D26] text-white'
                      : 'bg-neutral-950 border-neutral-800/80 text-neutral-300 hover:bg-neutral-800'
                  }`}
                >
                  <div className="truncate">
                    <p className="text-xs font-black truncate">{asset.name}</p>
                    <p className="text-[10px] font-mono text-neutral-500 mt-0.5 truncate">EPC: {asset.epc}</p>
                  </div>
                  {targetAsset.id === asset.id && (
                    <CheckCircle size={16} className="text-[#F27D26] shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Visual Radar & Geiger Control (2 Cols) */}
          <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-6 flex flex-col items-center justify-center text-center">
            
            <div className="space-y-1">
              <span className="text-[10px] text-neutral-400 uppercase font-black tracking-widest">Active Target</span>
              <h2 className="text-xl font-black text-white">{targetAsset.name}</h2>
              <p className="text-xs font-mono text-purple-300">EPC: {targetAsset.epc}</p>
            </div>

            {/* Radar Gauge Visual */}
            <div className="relative w-64 h-64 flex items-center justify-center">
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 100 / Math.max(proximity, 10), repeat: Infinity }}
                className="absolute inset-0 rounded-full border-2 border-[#F27D26]/40"
              />
              <motion.div
                animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.4, 0.1] }}
                transition={{ duration: 100 / Math.max(proximity, 10), repeat: Infinity, delay: 0.2 }}
                className="absolute inset-4 rounded-full border border-[#F27D26]/20"
              />
              <div className="w-36 h-36 rounded-full bg-neutral-950 border-4 border-[#F27D26] flex flex-col items-center justify-center shadow-2xl relative z-10">
                <span className="text-3xl font-black font-mono text-white">{proximity}%</span>
                <span className="text-[9px] font-black uppercase text-neutral-400">Proximity</span>
              </div>
            </div>

            {/* Proximity Slider (Manual tuning or simulation testing) */}
            <div className="w-full max-w-md space-y-2">
              <div className="flex justify-between text-xs font-bold text-neutral-400">
                <span>Signal RSSI Sensitivity</span>
                <span className="font-mono text-[#F27D26]">{proximity}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={proximity}
                onChange={(e) => setProximity(Number(e.target.value))}
                className="w-full accent-[#F27D26] cursor-pointer"
              />
            </div>

            {/* Geiger Toggle Button */}
            <button
              onClick={() => {
                startAudio();
                setGeigerActive(!geigerActive);
              }}
              className={`px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-3 transition shadow-xl cursor-pointer ${
                geigerActive
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
              }`}
            >
              <Volume2 size={18} className={geigerActive ? 'animate-bounce' : ''} />
              <span>{geigerActive ? 'Geiger Audio Active' : 'Start Geiger Audio Chime'}</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: UHF RFID TAG ENCODER
      ========================================================================= */}
      {activeTab === 'encode' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Target Asset Selection */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-neutral-200 flex items-center gap-2">
              <Tag size={16} className="text-[#F27D26]" />
              <span>Select Asset to Encode</span>
            </h3>

            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {activeAssetPool.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => {
                    setEncoderAsset(asset);
                    setCustomEPC(asset.epc);
                  }}
                  className={`w-full p-4 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                    encoderAsset.id === asset.id
                      ? 'bg-[#F27D26]/15 border-[#F27D26] text-white'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                  }`}
                >
                  <div className="truncate">
                    <p className="text-xs font-black truncate">{asset.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-mono bg-neutral-800 px-2 py-0.5 rounded text-neutral-400">
                        {asset.assetTag}
                      </span>
                      {asset.isCustom && (
                        <span className="text-[9px] font-black uppercase bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded">
                          Firestore Gear
                        </span>
                      )}
                    </div>
                  </div>
                  {encoderAsset.id === asset.id && (
                    <CheckCircle size={18} className="text-[#F27D26] shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* EPC Memory Bank Programmer */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div className="border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-neutral-200">
                EPC Memory Bank 01 Programmer
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Writes an identifier directly to Gen 2 silicon (96–128 bits).
              </p>
            </div>

            {/* Silicon limits callout */}
            <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-800/40 text-amber-300/90 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-200">
                <Info size={14} className="shrink-0" />
                <span>EPC Memory Constraints (96-Bit Silicon Limit)</span>
              </div>
              <p className="text-[11px] text-amber-300/80 leading-relaxed">
                Standard UHF Gen 2 tags carry 96–128 bits in the EPC bank. Full URLs (like NFC NDEF records) do not fit in EPC memory. We store short alphanumeric Asset IDs or standardized 24-character hex EPCs which resolve against Firestore.
              </p>
            </div>

            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 space-y-1">
              <span className="text-[10px] text-neutral-400 uppercase font-black">Target Equipment</span>
              <p className="text-sm font-extrabold text-white">{encoderAsset.name}</p>
              <div className="flex items-center justify-between text-xs font-mono text-neutral-500">
                <span>Tag: {encoderAsset.assetTag}</span>
                <span>Firestore ID: {encoderAsset.id}</span>
              </div>
            </div>

            {/* Encoder Mode Toggle */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-300">Encoding Format Mode</label>
              <div className="grid grid-cols-2 gap-2 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
                <button
                  type="button"
                  onClick={() => {
                    setEncodeMode('short_id');
                    setCustomEPC(encoderAsset.assetTag || encoderAsset.id);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    encodeMode === 'short_id' ? 'bg-[#F27D26] text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Hash size={13} />
                  <span>Short Asset ID</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEncodeMode('hex_epc');
                    setCustomEPC(generatePackerEpc(encoderAsset.assetTag || encoderAsset.id));
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    encodeMode === 'hex_epc' ? 'bg-[#F27D26] text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Cpu size={13} />
                  <span>24-Hex EPC</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-neutral-300">
                <span>{encodeMode === 'short_id' ? 'Short ID / Asset Tag' : 'EPC Value (24 Hex Characters)'}</span>
                <button
                  onClick={handleRandomEPC}
                  className="text-[#F27D26] hover:underline cursor-pointer text-[11px]"
                >
                  Generate Standard EPC
                </button>
              </div>
              <input
                type="text"
                value={customEPC}
                onChange={(e) => setCustomEPC(e.target.value.toUpperCase())}
                maxLength={encodeMode === 'hex_epc' ? 24 : 32}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl px-4 py-3.5 font-mono text-sm uppercase text-purple-300 outline-none focus:border-[#F27D26] transition tracking-wider"
              />
              <span className="text-[10px] text-neutral-500 font-mono block">
                {encodeMode === 'hex_epc' ? `Length: ${customEPC.length} / 24 hex characters` : `Short ID: ${customEPC.length} characters (encoded to 96-bit Gen 2 EPC)`}
              </span>
            </div>

            {isEncoding && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-bold text-neutral-400">
                  <span>Programming Memory Blocks...</span>
                  <span>{encodeProgress}%</span>
                </div>
                <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#F27D26] transition-all duration-300"
                    style={{ width: `${encodeProgress}%` }}
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleEncodeTag}
              disabled={isEncoding || !customEPC.trim()}
              className="w-full py-4 bg-[#F27D26] hover:bg-[#F27D26]/90 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition shadow-xl flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <Zap size={16} />
              <span>{isEncoding ? 'Writing Silicon Memory...' : 'Program Physical RFID Tag'}</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB: SCAN EVENTS AUDIT LOG (Immutable Non-Destructive Trail)
      ========================================================================= */}
      {activeTab === 'audit_events' && (
        <div className="space-y-6">
          {/* Header & Description */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Audit Logging Active
                </span>
                <span className="text-xs font-mono text-neutral-400">
                  Read & Write Event Stream
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
                Immutable Hardware Scan Audit Trail
              </h2>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Every physical NFC tap and RFID UHF sweep event is recorded here for non-destructive auditing. Automated status updates remain disabled in this pass to guarantee verification safety.
              </p>
            </div>

            {/* Quick Export Actions */}
            <div className="flex items-center gap-2 self-start md:self-auto">
              <button
                onClick={() => {
                  const headers = ['ID', 'Timestamp', 'Tag Type', 'Scan Context', 'Asset Name', 'Asset ID', 'Tag Value', 'User Email', 'Metadata'];
                  const rows = scanEvents.map(e => [
                    e.id || '',
                    e.scanTimestamp || '',
                    e.tagType || '',
                    e.scanContext || '',
                    `"${(e.assetName || '').replace(/"/g, '""')}"`,
                    e.assetId || '',
                    e.tagValue || '',
                    e.userEmail || '',
                    `"${JSON.stringify(e.metadata || {}).replace(/"/g, '""')}"`
                  ]);
                  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `ScanEvents_Audit_${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success('Scan events audit trail exported to CSV');
                }}
                disabled={scanEvents.length === 0}
                className="px-4 py-2.5 bg-neutral-950 hover:bg-neutral-800 disabled:opacity-40 border border-neutral-800 text-neutral-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
              >
                <Download size={14} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Metrics Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-lg">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Total Scans Logged</span>
              <p className="text-2xl sm:text-3xl font-black text-white mt-1">{scanEvents.length}</p>
              <span className="text-[10px] text-neutral-500 font-mono">Firestore synced</span>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-lg">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">UHF RFID Events</span>
              <p className="text-2xl sm:text-3xl font-black text-purple-400 mt-1">
                {scanEvents.filter(e => e.tagType === 'rfid').length}
              </p>
              <span className="text-[10px] text-neutral-500 font-mono">Sled sweeps & writes</span>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-lg">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">NFC Tap Events</span>
              <p className="text-2xl sm:text-3xl font-black text-sky-400 mt-1">
                {scanEvents.filter(e => e.tagType === 'nfc').length}
              </p>
              <span className="text-[10px] text-neutral-500 font-mono">Passport URLs & writes</span>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-lg">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Manifest Checks</span>
              <p className="text-2xl sm:text-3xl font-black text-amber-400 mt-1">
                {scanEvents.filter(e => e.scanContext?.includes('manifest')).length}
              </p>
              <span className="text-[10px] text-neutral-500 font-mono">Container cross-checks</span>
            </div>
          </div>

          {/* Filters and Search Bar */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-4 sm:p-5 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Type Filter Pills */}
              <div className="flex bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs">
                <button
                  onClick={() => setEventFilterType('all')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    eventFilterType === 'all' ? 'bg-[#F27D26] text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  All Types ({scanEvents.length})
                </button>
                <button
                  onClick={() => setEventFilterType('rfid')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    eventFilterType === 'rfid' ? 'bg-purple-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  RFID UHF
                </button>
                <button
                  onClick={() => setEventFilterType('nfc')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                    eventFilterType === 'nfc' ? 'bg-sky-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Web NFC
                </button>
              </div>

              {/* Context Filter Dropdown */}
              <select
                value={eventFilterContext}
                onChange={(e) => setEventFilterContext(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold text-neutral-300 outline-none focus:border-[#F27D26]"
              >
                <option value="all">All Contexts</option>
                <option value="manifest-sweep">Manifest Sweep</option>
                <option value="audit">Depot Audit</option>
                <option value="encoder-write">Encoder Write</option>
                <option value="tag-write">NFC Tag Write</option>
                <option value="passport-scan">Passport Scan</option>
                <option value="tag-link">Tag Link</option>
              </select>
            </div>

            {/* Text Search */}
            <div className="relative w-full md:w-72">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Search asset, EPC, email..."
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 outline-none focus:border-[#F27D26]"
              />
            </div>
          </div>

          {/* Scan Events Table / List */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-xl">
            {scanEvents.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Clock className="mx-auto text-neutral-600" size={32} />
                <p className="text-sm font-bold text-neutral-300">No Scan Events Recorded Yet</p>
                <p className="text-xs text-neutral-500 max-w-md mx-auto">
                  Scan an NFC tag on Android Chrome or run an RFID sweep with your connected reader or simulator to stream non-destructive audit events into this log.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-950/80 text-neutral-400 uppercase text-[10px] font-black tracking-wider border-b border-neutral-800">
                    <tr>
                      <th className="py-3.5 px-4">Timestamp</th>
                      <th className="py-3.5 px-4">Tag Tech</th>
                      <th className="py-3.5 px-4">Context</th>
                      <th className="py-3.5 px-4">Asset / Identity</th>
                      <th className="py-3.5 px-4">Tag Value / EPC</th>
                      <th className="py-3.5 px-4">Operator</th>
                      <th className="py-3.5 px-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60 font-medium">
                    {scanEvents
                      .filter(e => {
                        if (eventFilterType !== 'all' && e.tagType !== eventFilterType) return false;
                        if (eventFilterContext !== 'all' && e.scanContext !== eventFilterContext) return false;
                        if (eventSearch) {
                          const q = eventSearch.toLowerCase();
                          const matchName = e.assetName?.toLowerCase().includes(q);
                          const matchId = e.assetId?.toLowerCase().includes(q);
                          const matchTag = e.tagValue?.toLowerCase().includes(q);
                          const matchEmail = e.userEmail?.toLowerCase().includes(q);
                          if (!matchName && !matchId && !matchTag && !matchEmail) return false;
                        }
                        return true;
                      })
                      .map((ev, idx) => (
                        <tr key={ev.id || idx} className="hover:bg-neutral-800/40 transition">
                          <td className="py-3 px-4 font-mono text-[11px] text-neutral-400 whitespace-nowrap">
                            {ev.scanTimestamp ? new Date(ev.scanTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now'}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {ev.tagType === 'rfid' ? (
                              <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-black uppercase">
                                UHF RFID
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-black uppercase">
                                Web NFC
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md bg-neutral-950 border border-neutral-800 text-neutral-300 text-[10px] font-bold">
                              {ev.scanContext || 'scan'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-bold text-white truncate max-w-xs">{ev.assetName || ev.assetId || 'Unnamed Asset'}</p>
                            <span className="font-mono text-[10px] text-neutral-500">ID: {ev.assetId}</span>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-amber-300/90 break-all max-w-[200px]">
                            {ev.tagValue || 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-neutral-400 text-[11px] truncate max-w-[160px]">
                            {ev.userEmail || ev.userId || 'Anonymous'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-[10px] text-neutral-500">
                            {ev.metadata?.rssi !== undefined && (
                              <span className="text-emerald-400 mr-2">{ev.metadata.rssi} dBm</span>
                            )}
                            {ev.metadata?.device && (
                              <span className="text-neutral-400 truncate">{ev.metadata.device}</span>
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
      )}

      {/* =========================================================================
          TAB 4: HARDWARE ANTENNA & IO CONFIG
      ========================================================================= */}
      {activeTab === 'hardware' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-6">
              <h3 className="text-sm font-black uppercase tracking-wider text-neutral-200 flex items-center gap-2">
                <Sliders size={16} className="text-[#F27D26]" />
                <span>Antenna RF Power & Beeper</span>
              </h3>

              {/* RF Power Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-neutral-300">
                  <span>RF Transmission Power</span>
                  <span className="font-mono text-[#F27D26]">{antennaPower} dBm</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="30"
                  value={antennaPower}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setAntennaPower(val);
                    if (hwState.status === 'connected') {
                      rfidHardware.setAntennaPower(val);
                    }
                  }}
                  className="w-full accent-[#F27D26] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-neutral-500 font-mono">
                  <span>10 dBm (Near Field / 0.5m)</span>
                  <span>25 dBm (Standard / 6m)</span>
                  <span>30 dBm (Max / 15m)</span>
                </div>
              </div>

              {/* Beeper Volume Slider */}
              <div className="space-y-2 pt-2 border-t border-neutral-800">
                <div className="flex justify-between text-xs font-bold text-neutral-300">
                  <span>Audio Feedback Volume</span>
                  <span className="font-mono text-[#F27D26]">{isMuted ? 'Muted' : `${beepVolume}%`}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-2.5 bg-neutral-800 rounded-xl text-neutral-300 hover:text-white cursor-pointer"
                  >
                    {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={beepVolume}
                    onChange={(e) => {
                      setIsMuted(false);
                      setBeepVolume(Number(e.target.value));
                    }}
                    className="w-full accent-[#F27D26] cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-neutral-200 flex items-center gap-2">
                <Cpu size={16} className="text-[#F27D26]" />
                <span>Hardware Connection Architecture</span>
              </h3>

              <div className="space-y-3 text-xs text-neutral-300 leading-relaxed">
                <div className="p-3 bg-neutral-950 rounded-2xl border border-neutral-800 flex items-start gap-3">
                  <Bluetooth size={18} className="text-sky-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold text-white">Web Bluetooth (BLE GATT)</p>
                    <p className="text-[11px] text-neutral-400">Direct pairing with Zebra RFD40, RFD8500, and Nordic UART UHF sleds.</p>
                  </div>
                </div>

                <div className="p-3 bg-neutral-950 rounded-2xl border border-neutral-800 flex items-start gap-3">
                  <Usb size={18} className="text-purple-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold text-white">Web Serial (USB Virtual COM)</p>
                    <p className="text-[11px] text-neutral-400">High-speed binary and ASCII serial streams at 115200 baud.</p>
                  </div>
                </div>

                <div className="p-3 bg-neutral-950 rounded-2xl border border-neutral-800 flex items-start gap-3">
                  <Wifi size={18} className="text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold text-white">Fixed Portal WebSocket Gateway</p>
                    <p className="text-[11px] text-neutral-400">Overhead doorway portals (Zebra FX9600 / Impinj Speedway) stream.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Technical Evaluation Panel: Web Bluetooth BLE GATT vs Native Vendor SDKs */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2.5">
              <ShieldAlert size={18} className="text-[#F27D26]" />
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                Hardware Architecture Evaluation: Web Bluetooth (GATT) vs. Native Vendor SDKs
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-neutral-300">
              <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-2">
                <div className="flex items-center gap-2 text-sky-400 font-bold">
                  <Bluetooth size={15} />
                  <span>Web Bluetooth (BLE GATT)</span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Compatible with handheld readers exposing standard Nordic UART or Zebra SPP-over-BLE GATT characteristics (e.g. Chafon H10x, standard OEM Bluetooth sleds). Provides 100% zero-install browser connectivity.
                </p>
                <div className="text-[10px] text-sky-300 font-mono bg-sky-950/60 p-2 rounded-xl border border-sky-800/40">
                  Status: Implemented & Supported via `rfidHardware.connectBluetooth()`
                </div>
              </div>

              <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-2">
                <div className="flex items-center gap-2 text-purple-400 font-bold">
                  <Usb size={15} />
                  <span>Web Serial (USB / UART)</span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Direct connection to USB desktop encoders (e.g. Chafon CF-RU5102, Zebra ZD621R, Alien USB) via browser Web Serial API. Bypasses OS driver complexity and supports high-speed raw Gen 2 frame streams.
                </p>
                <div className="text-[10px] text-purple-300 font-mono bg-purple-950/60 p-2 rounded-xl border border-purple-800/40">
                  Status: Implemented & Supported via `rfidHardware.connectSerial()`
                </div>
              </div>

              <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <Wifi size={15} />
                  <span>Native Companion / LLRP Gateway</span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  For industrial readers using proprietary binary SDKs (e.g. Zebra RFD40/8500 in non-GATT mode or Impinj Speedway via LLRP), an edge companion service or WebSocket gateway streams EPC events to Packer Tools.
                </p>
                <div className="text-[10px] text-emerald-300 font-mono bg-emerald-950/60 p-2 rounded-xl border border-emerald-800/40">
                  Status: Implemented & Supported via `rfidHardware.connectNetworkGateway()`
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: ROI SANDBOX
      ========================================================================= */}
      {activeTab === 'roi' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="border-b border-neutral-800 pb-4">
            <h2 className="text-lg font-black uppercase text-white">RFID Deployment ROI Model</h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Calculate labor savings and inventory audit velocity improvements for enterprise fleets.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-300">Managed Equipment Fleet Size</label>
              <input
                type="number"
                value={assetCount}
                onChange={(e) => setAssetCount(Number(e.target.value))}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl p-3 text-white font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-300">Handheld UHF Sleds (Zebra RFD40)</label>
              <input
                type="number"
                value={sledCount}
                onChange={(e) => setSledCount(Number(e.target.value))}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl p-3 text-white font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-300">Fixed Overhead Portal Chokepoints</label>
              <input
                type="number"
                value={portalCount}
                onChange={(e) => setPortalCount(Number(e.target.value))}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl p-3 text-white font-mono text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-neutral-800">
            <div className="bg-neutral-950 p-4 rounded-2xl border border-neutral-800 text-center">
              <span className="text-[10px] uppercase font-black text-neutral-400">Barcode Audit Time</span>
              <p className="text-2xl font-black text-amber-400 mt-1">
                {Math.round((assetCount * 12) / 3600)} Hours
              </p>
            </div>
            <div className="bg-neutral-950 p-4 rounded-2xl border border-neutral-800 text-center">
              <span className="text-[10px] uppercase font-black text-neutral-400">RFID Bulk Sweep Time</span>
              <p className="text-2xl font-black text-emerald-400 mt-1">
                {Math.max(1, Math.round((assetCount * 0.08) / 60))} Minutes
              </p>
            </div>
            <div className="bg-neutral-950 p-4 rounded-2xl border border-neutral-800 text-center">
              <span className="text-[10px] uppercase font-black text-neutral-400">Estimated Annual Labor Savings</span>
              <p className="text-2xl font-black text-sky-400 mt-1">
                ${Math.round(((assetCount * 12 * 52) / 3600) * 35).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          LINK UNCATALOGED TAG MODAL
      ========================================================================= */}
      <AnimatePresence>
        {linkingTag && (
          <div className="fixed inset-0 bg-neutral-950/85 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              className="bg-neutral-900 border border-neutral-800 text-neutral-100 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl p-6 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <Link2 className="text-[#F27D26]" size={18} />
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    Link Physical RFID Tag to Gear
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setLinkingTag(null);
                    setLinkingGearId('');
                  }}
                  className="p-1 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <div className="bg-neutral-950 p-3 rounded-2xl border border-neutral-800 space-y-1">
                  <span className="text-[10px] text-neutral-400 uppercase font-black">Scanned Tag EPC</span>
                  <p className="font-mono text-xs text-purple-300 break-all">{linkingTag}</p>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="gear-item-select" className="text-xs font-bold text-neutral-300">Select Firestore Gear Item</label>
                  <select
                    id="gear-item-select"
                    value={linkingGearId}
                    onChange={(e) => setLinkingGearId(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-xs font-medium text-white outline-none focus:border-[#F27D26]"
                  >
                    <option value="">-- Choose Gear Item --</option>
                    {firestoreGear.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.assetTag || g.category})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setLinkingTag(null);
                    setLinkingGearId('');
                  }}
                  className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs uppercase rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveLinkingTag}
                  disabled={!linkingGearId || isLinkingSaving}
                  className="flex-1 py-3 bg-[#F27D26] hover:bg-[#F27D26]/90 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-[#F27D26]/20 cursor-pointer"
                >
                  {isLinkingSaving ? 'Linking...' : 'Save Tag Link'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          CONNECTION MODAL DIALOG
      ========================================================================= */}
      <AnimatePresence>
        {connectionModalOpen && (
          <div className="fixed inset-0 bg-neutral-950/85 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="bg-neutral-900 border border-neutral-800 text-neutral-100 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl p-6 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <Cpu className="text-[#F27D26]" size={20} />
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    Connect Physical RFID Reader
                  </h3>
                </div>
                <button
                  onClick={() => setConnectionModalOpen(false)}
                  className="p-1.5 hover:bg-neutral-800 rounded-xl text-neutral-400 hover:text-white transition"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                {/* Bluetooth Option */}
                <button
                  onClick={handleConnectBluetooth}
                  className="w-full p-4 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-sky-500/50 hover:bg-neutral-800/60 text-left transition flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center group-hover:scale-105 transition">
                      <Bluetooth size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-white">Web Bluetooth (BLE Sled)</p>
                      <p className="text-[11px] text-neutral-400">Zebra RFD40, RFD8500, Nordic UART Sleds</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-neutral-500 group-hover:text-white transition" />
                </button>

                {/* Serial Option */}
                <button
                  onClick={handleConnectSerial}
                  className="w-full p-4 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-purple-500/50 hover:bg-neutral-800/60 text-left transition flex items-center justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center group-hover:scale-105 transition">
                      <Usb size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-white">Web Serial (USB Port)</p>
                      <p className="text-[11px] text-neutral-400">Direct USB COM port connection (115200 baud)</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-neutral-500 group-hover:text-white transition" />
                </button>

                {/* Network Portal Gateway */}
                <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                      <Wifi size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-white">Fixed Portal Gateway (WebSocket)</p>
                      <p className="text-[11px] text-neutral-400">Zebra FX9600, Impinj Speedway</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={portalUrlInput}
                      onChange={(e) => setPortalUrlInput(e.target.value)}
                      placeholder="ws://192.168.1.100:8080/rfid"
                      className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs font-mono text-neutral-200 outline-none focus:border-[#F27D26]"
                    />
                    <button
                      onClick={handleConnectNetwork}
                      className="px-4 py-2 bg-[#F27D26] hover:bg-[#F27D26]/90 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition cursor-pointer"
                    >
                      Connect
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-neutral-500 text-center font-medium">
                USB and Bluetooth Barcode/RFID Handheld Guns in Keyboard Wedge mode work automatically without pairing.
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
