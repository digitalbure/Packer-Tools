import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeCameraScanConfig } from 'html5-qrcode';
import { 
  X, 
  Camera, 
  Zap, 
  RotateCcw, 
  Flashlight, 
  FlashlightOff, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Layers, 
  Tag, 
  QrCode, 
  Barcode, 
  Upload, 
  Copy, 
  ExternalLink, 
  ListPlus, 
  Printer, 
  Check, 
  Loader2, 
  Sliders, 
  RefreshCw, 
  FileSpreadsheet, 
  ShieldCheck, 
  Clock, 
  ChevronRight,
  Package,
  Wrench,
  HelpCircle,
  Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, GearItem, PackingList } from '../types';
import { useAuth } from '../providers/AuthProvider';
import { toast } from 'sonner';
import { hapticScanSuccess, hapticError, hapticSuccess } from '../utils/haptics';

export interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserProfile | any;
  mode?: 'single' | 'continuous';
  gearList?: GearItem[];
  onItemSelect?: (item: GearItem) => void;
  onAddToManifest?: (item: GearItem) => void;
  onRegisterNewItem?: (scannedTag: string) => void;
  title?: string;
  initialScanMode?: 'single' | 'continuous';
  targetContext?: 'general' | 'audit' | 'packing';
}

interface ScannedSessionItem {
  id: string;
  code: string;
  gear?: GearItem;
  found: boolean;
  timestamp: string;
  timeMs: number;
}

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  currentUser,
  mode,
  gearList = [],
  onItemSelect,
  onAddToManifest,
  onRegisterNewItem,
  title = "Barcode & QR Asset Scanner",
  initialScanMode = 'single',
  targetContext = 'general'
}: BarcodeScannerModalProps) {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const effectiveUser = currentUser || authUser;
  
  // UI Tabs & Modes
  const [activeTab, setActiveTab] = useState<'camera' | 'upload' | 'manual'>('camera');
  const [scanMode, setScanMode] = useState<'single' | 'continuous'>(mode || initialScanMode);

  useEffect(() => {
    if (mode) {
      setScanMode(mode);
    }
  }, [mode]);
  
  // Camera & Device state
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isCameraRunning, setIsCameraRunning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isTorchSupported, setIsTorchSupported] = useState(false);
  const [isInitializingCamera, setIsInitializingCamera] = useState(false);
  
  // Scan matching & results
  const [activeScannedCode, setActiveScannedCode] = useState<string | null>(null);
  const [matchedGear, setMatchedGear] = useState<GearItem | null>(null);
  const [isSearchingDb, setIsSearchingDb] = useState(false);
  const [unrecognizedCode, setUnrecognizedCode] = useState<string | null>(null);
  const [manualInputCode, setManualInputCode] = useState('');
  
  // Continuous mode session log
  const [sessionScannedItems, setSessionScannedItems] = useState<ScannedSessionItem[]>([]);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  
  // Refs
  const scannerInstanceRef = useRef<Html5Qrcode | null>(null);
  const lastScannedCodeRef = useRef<string | null>(null);
  const lastScannedTimeRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Play pleasant harmonic scan tone
  const playScanBeep = useCallback((isSuccess = true) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isSuccess ? 'sine' : 'triangle';
      
      if (isSuccess) {
        // High, crisp double-pip
        osc.frequency.setValueAtTime(1760, ctx.currentTime); // A6
        osc.frequency.setValueAtTime(2637, ctx.currentTime + 0.06); // E7
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.14);
      } else {
        // Low cautionary double beep
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(330, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
      }
    } catch (e) {
      // Audio fallback silent
    }
  }, []);

  // Parse raw scanned text to clean identifier or passport link
  const normalizeScannedCode = (rawText: string): { cleanCode: string; extractedId?: string; isUrl: boolean } => {
    const trimmed = rawText.trim();
    
    // Check for passport or gear direct URLs
    if (trimmed.includes('/#/gear/') || trimmed.includes('/gear/') || trimmed.includes('/passport/') || trimmed.includes('/p/')) {
      try {
        let idPart = '';
        if (trimmed.includes('/#/gear/')) {
          idPart = trimmed.split('/#/gear/')[1];
        } else if (trimmed.includes('/gear/')) {
          idPart = trimmed.split('/gear/')[1];
        } else if (trimmed.includes('/passport/')) {
          idPart = trimmed.split('/passport/')[1];
        } else if (trimmed.includes('/p/')) {
          idPart = trimmed.split('/p/')[1];
        }
        
        if (idPart) {
          const cleanId = idPart.split('?')[0].split('/')[0].trim();
          return { cleanCode: cleanId, extractedId: cleanId, isUrl: true };
        }
      } catch (e) {
        // Continue to fallback
      }
    }

    // Check for JSON formatted payload
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.id || parsed.assetTag || parsed.serialNumber) {
          return { 
            cleanCode: parsed.assetTag || parsed.serialNumber || parsed.id, 
            extractedId: parsed.id, 
            isUrl: false 
          };
        }
      } catch (e) {}
    }

    return { cleanCode: trimmed, isUrl: false };
  };

  // Find gear item in database or local state by tag, serial, or id
  const lookupGearItem = async (code: string): Promise<GearItem | null> => {
    const { cleanCode, extractedId } = normalizeScannedCode(code);
    const lowerCode = cleanCode.toLowerCase();

    // 1. Search in-memory gearList for ultra-fast instant match
    if (gearList && gearList.length > 0) {
      const memoryMatch = gearList.find(item => {
        if (extractedId && item.id === extractedId) return true;
        if (item.id === cleanCode) return true;
        if (item.assetTag && item.assetTag.trim().toLowerCase() === lowerCode) return true;
        if (item.serialNumber && item.serialNumber.trim().toLowerCase() === lowerCode) return true;
        if (item.barcode && item.barcode.trim().toLowerCase() === lowerCode) return true;
        if (item.rfidEpc && item.rfidEpc.trim().toLowerCase() === lowerCode) return true;
        if (item.rfidTag && item.rfidTag.trim().toLowerCase() === lowerCode) return true;
        if (item.nfcTag && item.nfcTag.trim().toLowerCase() === lowerCode) return true;
        return false;
      });

      if (memoryMatch) return memoryMatch;
    }

    if (!effectiveUser?.uid) return null;

    // 2. Query Firestore collection: users/{uid}/gearLibrary
    try {
      const gearRef = collection(db, 'users', effectiveUser.uid, 'gearLibrary');

      // Check direct Doc ID if it could be a doc ID
      if (extractedId || cleanCode.length > 15) {
        const targetId = extractedId || cleanCode;
        try {
          const directSnap = await getDoc(doc(db, 'users', effectiveUser.uid, 'gearLibrary', targetId));
          if (directSnap.exists()) {
            return { id: directSnap.id, ...directSnap.data() } as GearItem;
          }
        } catch (e) {}
      }

      // Check by assetTag
      const qAsset = query(gearRef, where('assetTag', '==', cleanCode));
      const snapAsset = await getDocs(qAsset);
      if (!snapAsset.empty) {
        const d = snapAsset.docs[0];
        return { id: d.id, ...d.data() } as GearItem;
      }

      // Check by serialNumber
      const qSerial = query(gearRef, where('serialNumber', '==', cleanCode));
      const snapSerial = await getDocs(qSerial);
      if (!snapSerial.empty) {
        const d = snapSerial.docs[0];
        return { id: d.id, ...d.data() } as GearItem;
      }

      // Check by barcode
      const qBarcode = query(gearRef, where('barcode', '==', cleanCode));
      const snapBarcode = await getDocs(qBarcode);
      if (!snapBarcode.empty) {
        const d = snapBarcode.docs[0];
        return { id: d.id, ...d.data() } as GearItem;
      }

      // Check by rfidEpc
      const qEpc = query(gearRef, where('rfidEpc', '==', cleanCode));
      const snapEpc = await getDocs(qEpc);
      if (!snapEpc.empty) {
        const d = snapEpc.docs[0];
        return { id: d.id, ...d.data() } as GearItem;
      }

      // Global fallback in shared 'gear' collection
      try {
        const globalRef = collection(db, 'gear');
        const qGlobal = query(globalRef, where('assetTag', '==', cleanCode));
        const snapGlobal = await getDocs(qGlobal);
        if (!snapGlobal.empty) {
          const d = snapGlobal.docs[0];
          return { id: d.id, ...d.data() } as GearItem;
        }
      } catch (e) {}

    } catch (err) {
      console.warn("Error querying database for gear item tag:", err);
    }

    return null;
  };

  // Main barcode detection handler
  const handleCodeDetected = async (rawCode: string) => {
    if (!rawCode || !rawCode.trim()) return;
    const cleanRaw = rawCode.trim();
    const now = Date.now();

    // Prevent immediate duplicate scans within 1.8 seconds in continuous mode
    if (lastScannedCodeRef.current === cleanRaw && now - lastScannedTimeRef.current < 1800) {
      return;
    }

    lastScannedCodeRef.current = cleanRaw;
    lastScannedTimeRef.current = now;

    setActiveScannedCode(cleanRaw);
    setIsSearchingDb(true);
    setUnrecognizedCode(null);

    try {
      const item = await lookupGearItem(cleanRaw);

      if (item) {
        playScanBeep(true);
        hapticScanSuccess();
        setMatchedGear(item);
        setUnrecognizedCode(null);

        // Append to continuous session log
        setSessionScannedItems(prev => {
          const existingIdx = prev.findIndex(p => p.gear?.id === item.id);
          const newEntry: ScannedSessionItem = {
            id: item.id,
            code: cleanRaw,
            gear: item,
            found: true,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            timeMs: now
          };
          if (existingIdx !== -1) {
            const updated = [...prev];
            updated.splice(existingIdx, 1);
            return [newEntry, ...updated];
          }
          return [newEntry, ...prev];
        });

        // If Single Scan Mode, pause scanner so user can inspect or take action
        if (scanMode === 'single') {
          pauseCameraScanner();
        } else {
          toast.success(`Found: ${item.name} (${item.assetTag || 'No Tag'})`, { duration: 2500 });
        }
      } else {
        // Tag not recognized
        playScanBeep(false);
        hapticError();
        setMatchedGear(null);
        setUnrecognizedCode(cleanRaw);

        // Append to session log as unrecognized
        setSessionScannedItems(prev => [
          {
            id: `unreg-${now}`,
            code: cleanRaw,
            found: false,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            timeMs: now
          },
          ...prev
        ]);

        if (scanMode === 'single') {
          pauseCameraScanner();
        } else {
          toast.error(`Unregistered Tag: ${cleanRaw}`, { duration: 2500 });
        }
      }
    } catch (err: any) {
      console.error("Scan lookup error:", err);
      toast.error(`Lookup failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSearchingDb(false);
    }
  };

  // Start Html5Qrcode camera scanning
  const startCameraScanner = async (cameraIdToUse?: string) => {
    try {
      setIsInitializingCamera(true);
      setCameraError(null);

      // Stop any existing instance
      if (scannerInstanceRef.current) {
        try {
          if (scannerInstanceRef.current.isScanning) {
            await scannerInstanceRef.current.stop();
          }
          scannerInstanceRef.current.clear();
        } catch (e) {}
        scannerInstanceRef.current = null;
      }

      const viewportEl = document.getElementById("barcode-scanner-viewport");
      if (!viewportEl) {
        setIsInitializingCamera(false);
        return;
      }

      const html5QrCode = new Html5Qrcode("barcode-scanner-viewport");
      scannerInstanceRef.current = html5QrCode;

      // Get list of available video cameras if not already populated
      try {
        const deviceList = await Html5Qrcode.getCameras();
        if (deviceList && deviceList.length > 0) {
          setCameras(deviceList);
          if (!selectedCameraId && !cameraIdToUse) {
            // Prefer back/environment camera
            const backCam = deviceList.find(c => 
              c.label.toLowerCase().includes('back') || 
              c.label.toLowerCase().includes('rear') || 
              c.label.toLowerCase().includes('environment')
            );
            const targetCamId = backCam ? backCam.id : deviceList[0].id;
            setSelectedCameraId(targetCamId);
            cameraIdToUse = targetCamId;
          }
        }
      } catch (e) {
        console.warn("Camera enumeration note:", e);
      }

      const cameraConfig = cameraIdToUse 
        ? { deviceId: { exact: cameraIdToUse } } 
        : { facingMode: "environment" };

      const scanConfig: Html5QrcodeCameraScanConfig = {
        fps: 15,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          // Optimized rectangle for both 1D Barcodes and 2D QR Codes
          const minDimension = Math.min(viewfinderWidth, viewfinderHeight);
          const width = Math.floor(minDimension * 0.88);
          const height = Math.floor(minDimension * 0.58);
          return { width: Math.max(width, 240), height: Math.max(height, 160) };
        },
        aspectRatio: 1.0
      };

      await html5QrCode.start(
        cameraConfig,
        scanConfig,
        (decodedText) => {
          handleCodeDetected(decodedText);
        },
        () => {
          // Silent frame ignore
        }
      );

      setIsCameraRunning(true);
      setIsInitializingCamera(false);

      // Check torch capability
      try {
        const capabilities = (html5QrCode as any).getRunningTrackCapabilities?.();
        if (capabilities && 'torch' in capabilities) {
          setIsTorchSupported(true);
        }
      } catch (e) {}

    } catch (err: any) {
      console.error("Camera startup error:", err);
      setIsInitializingCamera(false);
      setIsCameraRunning(false);
      
      const errMsg = err?.message || String(err);
      if (errMsg.includes('NotAllowedError') || errMsg.includes('Permission')) {
        setCameraError("Camera permission was denied. Please allow camera access in your browser settings, or use image upload / manual entry.");
      } else if (errMsg.includes('NotFoundError') || errMsg.includes('DevicesNotFoundError')) {
        setCameraError("No camera device was found on this system. You can upload an image or type the tag manually.");
      } else {
        setCameraError(`Camera initialization failed: ${errMsg}. Please switch to file upload or manual search.`);
      }
    }
  };

  // Pause / Resume camera scanner helpers
  const pauseCameraScanner = () => {
    try {
      if (scannerInstanceRef.current && scannerInstanceRef.current.isScanning) {
        scannerInstanceRef.current.pause(true);
        setIsCameraRunning(false);
      }
    } catch (e) {}
  };

  const resumeCameraScanner = () => {
    setMatchedGear(null);
    setUnrecognizedCode(null);
    setActiveScannedCode(null);
    lastScannedCodeRef.current = null;
    try {
      if (scannerInstanceRef.current) {
        scannerInstanceRef.current.resume();
        setIsCameraRunning(true);
      } else {
        startCameraScanner(selectedCameraId);
      }
    } catch (e) {
      startCameraScanner(selectedCameraId);
    }
  };

  const stopCameraScanner = async () => {
    if (scannerInstanceRef.current) {
      try {
        if (scannerInstanceRef.current.isScanning) {
          await scannerInstanceRef.current.stop();
        }
        scannerInstanceRef.current.clear();
      } catch (e) {}
      scannerInstanceRef.current = null;
    }
    setIsCameraRunning(false);
    setIsTorchOn(false);
  };

  // Toggle Torch / Flashlight
  const toggleTorch = async () => {
    if (!scannerInstanceRef.current || !isTorchSupported) return;
    try {
      const nextState = !isTorchOn;
      await (scannerInstanceRef.current as any).applyVideoConstraints({
        advanced: [{ torch: nextState }]
      });
      setIsTorchOn(nextState);
      toast.success(nextState ? "Flashlight turned ON" : "Flashlight turned OFF");
    } catch (err: any) {
      console.warn("Torch toggle failed:", err);
      toast.error("Flashlight control is not supported on this device/camera.");
    }
  };

  // Switch camera device
  const handleCameraChange = async (newCamId: string) => {
    setSelectedCameraId(newCamId);
    await stopCameraScanner();
    setTimeout(() => {
      startCameraScanner(newCamId);
    }, 200);
  };

  // Handle uploaded image file scanning
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsSearchingDb(true);
      toast.loading("Scanning image for barcode / QR code...", { id: 'file-scan' });

      // Create temporary scanner instance for file analysis
      const tempScanner = new Html5Qrcode("barcode-file-scan-temp");
      const decodedText = await tempScanner.scanFile(file, true);
      tempScanner.clear();

      toast.success("Barcode detected from photo!", { id: 'file-scan' });
      handleCodeDetected(decodedText);
    } catch (err: any) {
      console.error("File barcode scanning error:", err);
      toast.error("No valid barcode or QR code detected in this image. Please ensure good lighting and clear focus.", { id: 'file-scan' });
    } finally {
      setIsSearchingDb(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Clipboard Paste of barcode image
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            toast.loading("Scanning pasted image...", { id: 'paste-scan' });
            try {
              const tempScanner = new Html5Qrcode("barcode-file-scan-temp");
              const decodedText = await tempScanner.scanFile(file, true);
              tempScanner.clear();
              toast.success("Barcode recognized from clipboard!", { id: 'paste-scan' });
              handleCodeDetected(decodedText);
            } catch (err) {
              toast.error("Could not find a clear barcode in pasted image.", { id: 'paste-scan' });
            }
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  // Handle Manual Code Submission
  const handleManualSearch = () => {
    if (!manualInputCode.trim()) {
      toast.error("Please enter an asset tag, serial number, or barcode");
      return;
    }
    handleCodeDetected(manualInputCode.trim());
  };

  // Update Gear Status directly from scanner modal
  const handleQuickStatusChange = async (newStatus: 'available' | 'in_use' | 'maintenance' | 'missing') => {
    if (!matchedGear || !effectiveUser?.uid) return;
    setIsUpdatingStatus(true);
    try {
      const gearRef = doc(db, 'users', effectiveUser.uid, 'gearLibrary', matchedGear.id);
      await updateDoc(gearRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });

      setMatchedGear(prev => prev ? { ...prev, status: newStatus } : null);
      
      // Update session log item
      setSessionScannedItems(prev => prev.map(p => 
        p.gear?.id === matchedGear.id 
          ? { ...p, gear: { ...p.gear, status: newStatus } } 
          : p
      ));

      hapticSuccess();
      toast.success(`Updated status to: ${newStatus.toUpperCase()}`);
    } catch (err: any) {
      console.error("Error updating status:", err);
      toast.error(`Status update failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Lifecycle on modal open / close
  useEffect(() => {
    if (isOpen) {
      setActiveScannedCode(null);
      setMatchedGear(null);
      setUnrecognizedCode(null);
      setCameraError(null);

      // Start camera after DOM mount
      const timer = setTimeout(() => {
        if (activeTab === 'camera') {
          startCameraScanner();
        }
      }, 150);

      return () => {
        clearTimeout(timer);
        stopCameraScanner();
      };
    } else {
      stopCameraScanner();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      {/* Hidden container for file scan processing */}
      <div id="barcode-file-scan-temp" className="hidden" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#ff4f3a]/15 text-[#ff4f3a] border border-[#ff4f3a]/30 flex items-center justify-center shrink-0 shadow-inner">
              <Barcode size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-tight">
                  {title}
                </h3>
                <span className="px-2 py-0.5 bg-[#ff4f3a]/20 text-[#ff4f3a] border border-[#ff4f3a]/30 rounded-full text-[9px] font-black uppercase tracking-wider">
                  Live Scanner
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 font-medium">
                Point camera at 1D Barcodes, 2D QR Codes, or Asset Tags for instant lookup
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Scan Mode Toggle: Single vs Continuous */}
            <button
              type="button"
              onClick={() => {
                const next = scanMode === 'single' ? 'continuous' : 'single';
                setScanMode(next);
                toast.info(`Switched to ${next === 'continuous' ? 'Continuous Audit' : 'Single Lookup'} Mode`);
              }}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                scanMode === 'continuous'
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                  : 'bg-neutral-800/80 text-neutral-300 border-neutral-700 hover:bg-neutral-800'
              }`}
              title="Toggle Continuous Audit Mode"
            >
              <Layers size={13} />
              <span>{scanMode === 'continuous' ? 'Audit Mode' : 'Single Scan'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition cursor-pointer"
              title="Close Scanner"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 pt-3 pb-0 bg-neutral-950 flex items-center justify-between border-b border-neutral-800/60">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('camera')}
              className={`pb-2.5 px-3 text-xs font-black uppercase tracking-wider border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'camera'
                  ? 'border-[#ff4f3a] text-white'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Camera size={14} />
              <span>Live Camera</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`pb-2.5 px-3 text-xs font-black uppercase tracking-wider border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'upload'
                  ? 'border-[#ff4f3a] text-white'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Upload size={14} />
              <span>Photo / File</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={`pb-2.5 px-3 text-xs font-black uppercase tracking-wider border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'manual'
                  ? 'border-[#ff4f3a] text-white'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Tag size={14} />
              <span>Manual Entry</span>
            </button>
          </div>

          {/* Torch & Camera Switchers (when camera active) */}
          {activeTab === 'camera' && (
            <div className="flex items-center gap-1.5 pb-2">
              {isTorchSupported && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`p-1.5 rounded-lg border text-xs transition cursor-pointer ${
                    isTorchOn 
                      ? 'bg-amber-400/20 text-amber-300 border-amber-400/40' 
                      : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
                  }`}
                  title="Toggle Flashlight / Torch"
                >
                  {isTorchOn ? <Flashlight size={14} /> : <FlashlightOff size={14} />}
                </button>
              )}

              {cameras.length > 1 && (
                <select
                  value={selectedCameraId}
                  onChange={(e) => handleCameraChange(e.target.value)}
                  className="bg-neutral-800 border border-neutral-700 text-neutral-300 text-[10px] font-bold rounded-lg px-2 py-1 outline-none cursor-pointer max-w-[130px] truncate"
                >
                  {cameras.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.label || `Camera ${c.id.slice(0, 5)}`}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* TAB 1: Live Camera Feed */}
          {activeTab === 'camera' && (
            <div className="space-y-4">
              {/* Viewport Container */}
              <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] bg-black rounded-2xl overflow-hidden border border-neutral-800 shadow-inner flex items-center justify-center">
                
                {/* Html5Qrcode Mount Point */}
                <div 
                  id="barcode-scanner-viewport" 
                  className="w-full h-full [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
                />

                {/* Laser scan line overlay animation when running */}
                {isCameraRunning && !matchedGear && !unrecognizedCode && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    {/* Targeting Box */}
                    <div className="w-[82%] h-[60%] sm:w-[70%] sm:h-[55%] border-2 border-[#ff4f3a]/60 rounded-2xl relative shadow-[0_0_20px_rgba(255,79,58,0.2)]">
                      {/* Corner Accents */}
                      <div className="absolute -top-1 -left-1 w-4 h-4 border-t-3 border-l-3 border-[#ff4f3a]" />
                      <div className="absolute -top-1 -right-1 w-4 h-4 border-t-3 border-r-3 border-[#ff4f3a]" />
                      <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-3 border-l-3 border-[#ff4f3a]" />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-3 border-r-3 border-[#ff4f3a]" />
                      
                      {/* Animated Laser Sweep Line */}
                      <motion.div 
                        animate={{ y: [0, 160, 0] }}
                        transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                        className="w-full h-0.5 bg-gradient-to-r from-transparent via-[#ff4f3a] to-transparent shadow-[0_0_12px_#ff4f3a]"
                      />
                    </div>
                    <span className="mt-3 text-[10px] font-black uppercase tracking-widest text-neutral-400 bg-black/60 px-3 py-1 rounded-full backdrop-blur-sm border border-neutral-800">
                      Align barcode or QR code in frame
                    </span>
                  </div>
                )}

                {/* Initializing Spinner */}
                {isInitializingCamera && (
                  <div className="absolute inset-0 bg-neutral-950/90 flex flex-col items-center justify-center gap-3">
                    <Loader2 size={32} className="animate-spin text-[#ff4f3a]" />
                    <p className="text-xs font-bold text-neutral-300">Starting device camera...</p>
                  </div>
                )}

                {/* Camera Permission / Error Fallback */}
                {cameraError && (
                  <div className="absolute inset-0 bg-neutral-950/95 p-6 flex flex-col items-center justify-center text-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
                      <AlertCircle size={24} />
                    </div>
                    <h4 className="text-sm font-bold text-white">Camera Access Required</h4>
                    <p className="text-xs text-neutral-400 max-w-md leading-relaxed">
                      {cameraError}
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center mt-2">
                      <button
                        type="button"
                        onClick={() => startCameraScanner(selectedCameraId)}
                        className="px-4 py-2 bg-[#ff4f3a] hover:bg-[#ff4f3a]/90 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <RefreshCw size={12} />
                        Retry Camera
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('upload')}
                        className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Upload size={12} />
                        Upload Image Instead
                      </button>
                    </div>
                  </div>
                )}

                {/* Searching Database Spinner Overlay */}
                {isSearchingDb && (
                  <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-20">
                    <Loader2 size={28} className="animate-spin text-[#ff4f3a]" />
                    <span className="text-xs font-bold text-white">Looking up asset tag...</span>
                  </div>
                )}
              </div>

              {/* Camera Action Toolbar */}
              <div className="flex items-center justify-between text-xs text-neutral-400 pt-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-semibold text-[11px]">
                    {isCameraRunning ? 'Camera Active' : 'Scanner Ready'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={resumeCameraScanner}
                    className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition cursor-pointer"
                  >
                    <RefreshCw size={11} />
                    Reset Scan
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: File Upload / Clipboard Paste */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-neutral-700 hover:border-[#ff4f3a]/60 bg-neutral-950/60 hover:bg-neutral-950 transition-all rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-3 cursor-pointer group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-2xl bg-neutral-800 group-hover:bg-[#ff4f3a]/15 text-neutral-400 group-hover:text-[#ff4f3a] transition border border-neutral-700 group-hover:border-[#ff4f3a]/30 flex items-center justify-center shadow-inner">
                  <Upload size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Click or Drag Image Here to Scan</h4>
                  <p className="text-xs text-neutral-400 mt-1">Supports PNG, JPG, WEBP photos of barcodes and QR codes</p>
                </div>
                <div className="px-3 py-1 bg-neutral-800/80 rounded-full border border-neutral-700 text-[10px] font-mono text-neutral-300">
                  Tip: You can also press <kbd className="px-1.5 py-0.5 bg-neutral-900 rounded text-white font-bold">Ctrl+V</kbd> to paste an image directly
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Manual Code / Tag Lookup */}
          {activeTab === 'manual' && (
            <div className="space-y-4">
              <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">
                  Enter Unique Identification Tag or Serial #
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                    <input
                      type="text"
                      value={manualInputCode}
                      onChange={(e) => setManualInputCode(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                      placeholder="e.g. TAG-00124, SN-FX3-9821, or barcode #"
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl pl-10 pr-4 py-3 text-white text-xs font-semibold outline-none focus:border-[#ff4f3a] focus:ring-1 focus:ring-[#ff4f3a] transition"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleManualSearch}
                    disabled={isSearchingDb}
                    className="px-5 py-3 bg-[#ff4f3a] hover:bg-[#ff4f3a]/90 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer shrink-0"
                  >
                    {isSearchingDb ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                    <span>Lookup</span>
                  </button>
                </div>
                <p className="text-[11px] text-neutral-500">
                  Matches asset tags, manufacturer serial numbers, RFID EPCs, and digital passport links.
                </p>
              </div>
            </div>
          )}

          {/* SCAN RESULT SECTION: MATCH FOUND */}
          <AnimatePresence>
            {matchedGear && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 sm:p-5 bg-gradient-to-b from-neutral-950 to-neutral-900 border border-emerald-500/40 rounded-2xl space-y-4 shadow-xl relative overflow-hidden"
              >
                {/* Top Success Badge */}
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400">
                      <CheckCircle2 size={16} />
                    </span>
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                      Equipment Asset Verified & Located
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded-md border border-neutral-700">
                      Tag: {matchedGear.assetTag || matchedGear.id.slice(0, 8)}
                    </span>
                  </div>
                </div>

                {/* Item Details Row */}
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Photo */}
                  <div className="w-full sm:w-28 h-28 rounded-xl bg-neutral-800 overflow-hidden shrink-0 border border-neutral-700 flex items-center justify-center">
                    {matchedGear.photoUrls && matchedGear.photoUrls[0] ? (
                      <img 
                        src={matchedGear.photoUrls[0]} 
                        alt={matchedGear.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Package size={32} className="text-neutral-500" />
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className="px-2 py-0.5 bg-neutral-800 text-neutral-300 rounded text-[9px] font-black uppercase tracking-wider">
                          {matchedGear.primaryCategory || matchedGear.category || 'General'}
                        </span>
                        {matchedGear.brand && (
                          <span className="px-2 py-0.5 bg-neutral-800 text-neutral-300 rounded text-[9px] font-bold">
                            {matchedGear.brand}
                          </span>
                        )}
                        {matchedGear.isKit && (
                          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded text-[9px] font-bold uppercase">
                            Master Kit
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-black text-white truncate">
                        {matchedGear.name}
                      </h4>
                      {matchedGear.model && (
                        <p className="text-xs text-neutral-400 font-medium">Model: {matchedGear.model}</p>
                      )}
                    </div>

                    {/* Quick Specs Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] pt-1">
                      <div className="p-2 bg-neutral-900/90 rounded-lg border border-neutral-800">
                        <span className="text-[9px] uppercase font-bold text-neutral-500 block">Serial Number</span>
                        <span className="font-mono font-bold text-neutral-200 truncate block">
                          {matchedGear.serialNumber || '—'}
                        </span>
                      </div>

                      <div className="p-2 bg-neutral-900/90 rounded-lg border border-neutral-800">
                        <span className="text-[9px] uppercase font-bold text-neutral-500 block">Current Status</span>
                        <span className={`font-bold capitalize block text-[11px] ${
                          matchedGear.status === 'available' ? 'text-emerald-400' :
                          matchedGear.status === 'in_use' ? 'text-amber-400' :
                          matchedGear.status === 'maintenance' ? 'text-red-400' : 'text-neutral-400'
                        }`}>
                          {matchedGear.status ? matchedGear.status.replace('_', ' ') : 'Available'}
                        </span>
                      </div>

                      <div className="p-2 bg-neutral-900/90 rounded-lg border border-neutral-800 col-span-2 sm:col-span-1">
                        <span className="text-[9px] uppercase font-bold text-neutral-500 block">Replacement Value</span>
                        <span className="font-mono font-bold text-neutral-200 block">
                          {matchedGear.price ? `$${matchedGear.price.toLocaleString()}` : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Holder if checked out */}
                    {matchedGear.status === 'in_use' && matchedGear.currentHolder && (
                      <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300 flex items-center gap-1.5">
                        <Clock size={13} />
                        <span>Checked out to: <strong>{matchedGear.currentHolder}</strong></span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Status Changer Dropdown */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-800">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                      Quick Status Update:
                    </span>
                    <div className="flex gap-1">
                      {(['available', 'in_use', 'maintenance', 'missing'] as const).map(st => (
                        <button
                          key={st}
                          type="button"
                          disabled={isUpdatingStatus || matchedGear.status === st}
                          onClick={() => handleQuickStatusChange(st)}
                          className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border transition cursor-pointer ${
                            matchedGear.status === st
                              ? 'bg-white text-black border-white'
                              : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
                          }`}
                        >
                          {st.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Direct Action Triggers */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (onItemSelect) {
                        onItemSelect(matchedGear);
                      } else {
                        navigate(`/gear/${matchedGear.id}`);
                      }
                      onClose();
                    }}
                    className="p-2.5 bg-white hover:bg-neutral-200 text-neutral-900 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition cursor-pointer shadow"
                  >
                    <ExternalLink size={13} />
                    <span>View Details</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (onAddToManifest) {
                        onAddToManifest(matchedGear);
                      } else {
                        toast.success(`Selected ${matchedGear.name} for packing manifest`);
                      }
                    }}
                    className="p-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition cursor-pointer border border-neutral-700"
                  >
                    <ListPlus size={13} />
                    <span>Add to List</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      navigate(`/gear/${matchedGear.id}`);
                      onClose();
                    }}
                    className="p-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition cursor-pointer border border-neutral-700"
                  >
                    <QrCode size={13} />
                    <span>QR Passport</span>
                  </button>

                  <button
                    type="button"
                    onClick={resumeCameraScanner}
                    className="p-2.5 bg-[#ff4f3a] hover:bg-[#ff4f3a]/90 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition cursor-pointer shadow"
                  >
                    <RefreshCw size={13} />
                    <span>Scan Next</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* SCAN RESULT SECTION: NO MATCH FOUND */}
          <AnimatePresence>
            {unrecognizedCode && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 sm:p-5 bg-neutral-950 border border-amber-500/40 rounded-2xl space-y-4 shadow-xl"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <AlertCircle size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-black text-white uppercase tracking-tight">
                      Unregistered Asset Tag Scanned
                    </h4>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      No existing gear in your library matches tag identifier:
                    </p>
                    <div className="mt-2 p-2 bg-neutral-900 rounded-lg border border-neutral-800 font-mono text-xs text-amber-300 font-bold break-all select-all">
                      {unrecognizedCode}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-800">
                  <button
                    type="button"
                    onClick={() => {
                      if (onRegisterNewItem) {
                        onRegisterNewItem(unrecognizedCode);
                      } else {
                        navigate(`?addGear=true&prefillTag=${encodeURIComponent(unrecognizedCode)}`);
                      }
                      onClose();
                    }}
                    className="flex-1 py-3 px-4 bg-[#ff4f3a] hover:bg-[#ff4f3a]/90 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer shadow-lg"
                  >
                    <Tag size={14} />
                    <span>Register New Gear with Tag</span>
                  </button>

                  <button
                    type="button"
                    onClick={resumeCameraScanner}
                    className="py-3 px-4 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <RefreshCw size={14} />
                    <span>Scan Again</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Continuous Mode Scanned Session History Log */}
          {sessionScannedItems.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-1.5">
                  <Clock size={12} />
                  <span>Session Scan History ({sessionScannedItems.length})</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSessionScannedItems([])}
                  className="text-[10px] text-neutral-500 hover:text-neutral-300 underline cursor-pointer"
                >
                  Clear History
                </button>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {sessionScannedItems.map((item, idx) => (
                  <div
                    key={`${item.id}-${idx}`}
                    className="p-2 bg-neutral-950 rounded-xl border border-neutral-800/80 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${item.found ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      <div className="truncate">
                        <span className="font-bold text-white truncate block">
                          {item.gear?.name || 'Unregistered Item'}
                        </span>
                        <span className="font-mono text-[10px] text-neutral-400 block truncate">
                          Tag: {item.code}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-neutral-500 font-mono">{item.timestamp}</span>
                      {item.found && item.gear && (
                        <button
                          type="button"
                          onClick={() => {
                            setMatchedGear(item.gear!);
                            pauseCameraScanner();
                          }}
                          className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[9px] font-bold uppercase transition cursor-pointer"
                        >
                          Inspect
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
          <div className="flex items-center gap-1.5">
            <Smartphone size={13} className="text-[#ff4f3a]" />
            <span>Works with hardware wedges & camera</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer"
          >
            Close Scanner
          </button>
        </div>
      </motion.div>
    </div>
  );
}
