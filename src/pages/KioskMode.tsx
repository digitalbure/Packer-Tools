import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Scan, 
  ArrowRight, 
  ArrowLeft, 
  User, 
  Package, 
  CheckCircle2, 
  X, 
  ShieldCheck, 
  QrCode, 
  Settings,
  Lock,
  LogOut,
  Clock,
  LayoutGrid,
  Tag,
  Search,
  Luggage,
  Box,
  Plus,
  Trash2,
  Minus,
  Printer,
  Mail,
  Share2,
  ShoppingBag,
  Sliders,
  CheckSquare,
  Tv,
  Pencil,
  FileDown,
  Smartphone,
  Sparkles,
  Check,
  Volume2
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import SignatureCanvas from 'react-signature-canvas';
import { QRCodeCanvas } from 'qrcode.react';
import { collection, query, where, getDocs, getDoc, addDoc, deleteDoc, serverTimestamp, doc, updateDoc, onSnapshot, limit, arrayUnion } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, signInWithGoogle } from '../firebase';
import { triggerGoogleChatAlert } from '../services/googleChat';
import { GearItem, UserProfile, CheckoutRecord, AdminSettings, Container } from '../types';
import { offlineSync, OfflineOperation } from '../services/offlineSync';
import PackerLogo from '../components/PackerLogo';
import { toast } from 'sonner';
import { isFeatureEnabled } from '../lib/featureUtils';

interface KioskModeProps {
  user: UserProfile | null;
  adminSettings: AdminSettings | null;
}

type KioskStep = 'welcome' | 'activate' | 'scan' | 'search' | 'confirm' | 'user_details' | 'sign' | 'complete' | 'case_explorer' | 'case_pack' | 'create_case' | 'review' | 'receipt' | 'order_view' | 'configure';
type KioskAction = 'checkout' | 'checkin' | 'pack' | 'order';

const KioskMode: React.FC<KioskModeProps> = ({ user: initialUser, adminSettings }) => {
  const [terminalId, setTerminalId] = useState<string | null>(localStorage.getItem('kiosk_terminal_id'));
  const [isActivated, setIsActivated] = useState<boolean>(false);
  const [pairedUid, setPairedUid] = useState<string | null>(null);
  const [pairedUser, setPairedUser] = useState<UserProfile | null>(null);
  const [checkingPlan, setCheckingPlan] = useState<boolean>(false);
  const [step, setStep] = useState<KioskStep>('welcome');
  const [escapeTaps, setEscapeTaps] = useState(0);
  const [cameraAccessError, setCameraAccessError] = useState<string | null>(null);

  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlineQueue, setOfflineQueue] = useState<OfflineOperation[]>([]);
  const [isOfflineSyncing, setIsOfflineSyncing] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = offlineSync.subscribe((queue, online, syncing) => {
      setOfflineQueue(queue);
      setIsOnline(online);
      setIsOfflineSyncing(syncing);
    });
    return () => unsubscribe();
  }, []);

  // Active Terminal Source Configuration
  const [activeSourceType, setActiveSourceType] = useState<'gearLibrary' | 'customInventory'>('gearLibrary');
  const [terminalInventoryId, setTerminalInventoryId] = useState<string | null>(null);

  // administrative states for Kiosk Controller Hub
  const [adminTab, setAdminTab] = useState<'hub' | 'devices' | 'scanner' | 'downloads'>('hub');
  const [terminalsList, setTerminalsList] = useState<any[]>([]);
  
  // Customization preferences in state with persistent memory
  const [kioskWelcomeMessage, setKioskWelcomeMessage] = useState<string>(
    localStorage.getItem('kiosk_welcome_message') || 'Welcome to the Gear Command Terminal'
  );
  const [showBrandSetting, setShowBrandSetting] = useState<boolean>(
    localStorage.getItem('kiosk_show_brand') !== 'false'
  );
  const [showConditionSetting, setShowConditionSetting] = useState<boolean>(
    localStorage.getItem('kiosk_show_condition') !== 'false'
  );
  const [showHolderSetting, setShowHolderSetting] = useState<boolean>(
    localStorage.getItem('kiosk_show_holder') !== 'false'
  );
  const [showCategorySetting, setShowCategorySetting] = useState<boolean>(
    localStorage.getItem('kiosk_show_category') !== 'false'
  );
  const [showQRSetting, setShowQRSetting] = useState<boolean>(
    localStorage.getItem('kiosk_show_qr') !== 'false'
  );
  const [showTimestampSetting, setShowTimestampSetting] = useState<boolean>(
    localStorage.getItem('kiosk_show_timestamp') !== 'false'
  );

  const [editingTerminalId, setEditingTerminalId] = useState<string | null>(null);

  const [isScannerApp, setIsScannerApp] = useState<boolean>(
    window.location.hash.includes('scannerApp=true') || window.location.search.includes('scannerApp=true')
  );

  useEffect(() => {
    const handleHash = () => {
      setIsScannerApp(
        window.location.hash.includes('scannerApp=true') || window.location.search.includes('scannerApp=true')
      );
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // PWA Scanner focused states
  const [pwaMode, setPwaMode] = useState<'checkout' | 'checkin' | 'lookup'>('checkout');
  const [pwaScannerActive, setPwaScannerActive] = useState<boolean>(false);
  const [pwaLatestScannedItem, setPwaLatestScannedItem] = useState<GearItem | null>(null);
  const [pwaManualInput, setPwaManualInput] = useState<string>('');
  const [pwaSessionLogs, setPwaSessionLogs] = useState<{
    id: string;
    itemName: string;
    brand: string;
    action: 'in' | 'out' | 'lookup';
    assignee?: string;
    timestamp: Date;
    assetTag: string;
  }[]>([]);

  // PWA Install prompt trigger state
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any | null>(null);
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);
  
  // Terminal creation & list states
  const [showAddTerminalModal, setShowAddTerminalModal] = useState<boolean>(false);
  const [newTerminalName, setNewTerminalName] = useState<string>('');
  const [newTerminalMode, setNewTerminalMode] = useState<'both' | 'checkout' | 'checkin'>('both');

  // Scanner state for instant checkin/out
  const [isInstantScannerActive, setIsInstantScannerActive] = useState<boolean>(false);
  const [scannerAssignee, setScannerAssignee] = useState<string>(initialUser?.displayName || 'Terminal Guest');
  const [scannerAssigneeEmail, setScannerAssigneeEmail] = useState<string>(initialUser?.email || 'guest@terminal.local');
  const [instantManualInput, setInstantManualInput] = useState<string>('');
  const [autoScanLogs, setAutoScanLogs] = useState<{
    id: string;
    itemName: string;
    brand: string;
    action: 'in' | 'out';
    assignee?: string;
    timestamp: Date;
    assetTag: string;
  }[]>([]);

  // Real-time terminals synchronization
  useEffect(() => {
    if (!initialUser?.uid) return;
    const q = query(collection(db, 'terminals'), where('ownerUid', '==', initialUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      setTerminalsList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Error loading terminals for PIN management:", err));
    return () => unsub();
  }, [initialUser?.uid]);

  // Persists local customizations
  useEffect(() => {
    localStorage.setItem('kiosk_welcome_message', kioskWelcomeMessage);
    localStorage.setItem('kiosk_show_brand', String(showBrandSetting));
    localStorage.setItem('kiosk_show_condition', String(showConditionSetting));
    localStorage.setItem('kiosk_show_holder', String(showHolderSetting));
    localStorage.setItem('kiosk_show_category', String(showCategorySetting));
    localStorage.setItem('kiosk_show_qr', String(showQRSetting));
    localStorage.setItem('kiosk_show_timestamp', String(showTimestampSetting));
  }, [kioskWelcomeMessage, showBrandSetting, showConditionSetting, showHolderSetting, showCategorySetting, showQRSetting, showTimestampSetting]);

  // Scanner hook for administrative tab auto check-in/out
  const instantScannerRef = useRef<Html5Qrcode | null>(null);
  const lastInstantScannedRef = useRef<{ code: string; time: number } | null>(null);

  useEffect(() => {
    if (!isInstantScannerActive || adminTab !== 'scanner') {
      setCameraAccessError(null);
      if (instantScannerRef.current) {
        try {
          if (instantScannerRef.current.isScanning) {
            instantScannerRef.current.stop().catch(e => console.log(e));
          }
        } catch (e) {
          console.warn(e);
        }
        instantScannerRef.current = null;
      }
      return;
    }

    let isSubscribed = true;
    let retryCount = 0;

    const startInstantScanner = () => {
      setCameraAccessError(null);
      const el = document.getElementById("gear-instant-scanner");
      if (!el) {
        if (isSubscribed && retryCount < 40) {
          retryCount++;
          setTimeout(startInstantScanner, 100);
        }
        return;
      }

      try {
        const scanner = new Html5Qrcode("gear-instant-scanner");
        instantScannerRef.current = scanner;

        scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 280, height: 280 } },
          (decodedText) => {
            const now = Date.now();
            if (
              lastInstantScannedRef.current &&
              lastInstantScannedRef.current.code === decodedText &&
              now - lastInstantScannedRef.current.time < 2500
            ) {
              return;
            }
            lastInstantScannedRef.current = { code: decodedText, time: now };
            handleInstantScanSuccess(decodedText);
          },
          () => {}
        ).catch((err) => {
          console.warn("Retrying scanner with user-facing camera:", err);
          if (!isSubscribed) return;
          scanner.start(
            { facingMode: "user" },
            { fps: 10, qrbox: { width: 280, height: 280 } },
            (decodedText) => {
              const now = Date.now();
              if (
                lastInstantScannedRef.current &&
                lastInstantScannedRef.current.code === decodedText &&
                now - lastInstantScannedRef.current.time < 2500
              ) {
                return;
              }
              lastInstantScannedRef.current = { code: decodedText, time: now };
              handleInstantScanSuccess(decodedText);
            },
            () => {}
          ).catch(e => {
            console.error("Camera access failed:", e);
            if (isSubscribed) {
              setCameraAccessError(e.message || String(e));
            }
          });
        });
      } catch (err) {
        console.error("Instant barcode scanner failed startup", err);
        setCameraAccessError(String(err));
      }
    };

    startInstantScanner();

    return () => {
      isSubscribed = false;
      if (instantScannerRef.current) {
        try {
          if (instantScannerRef.current.isScanning) {
            instantScannerRef.current.stop().catch(e => console.log(e));
          }
        } catch (e) {
          console.warn(e);
        }
        instantScannerRef.current = null;
      }
    };
  }, [isInstantScannerActive, adminTab]);

  const playScanChime = (type: 'success' | 'double' | 'error' = 'success') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (type === 'success') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.14);
      } else if (type === 'double') {
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.frequency.setValueAtTime(1100, ctx.currentTime);
        gain1.gain.setValueAtTime(0.08, ctx.currentTime);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start();
        osc1.stop(ctx.currentTime + 0.05);

        setTimeout(() => {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.frequency.setValueAtTime(1400, ctx.currentTime);
          gain2.gain.setValueAtTime(0.08, ctx.currentTime);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start();
          osc2.stop(ctx.currentTime + 0.05);
        }, 60);
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, ctx.currentTime);
        gain.gain.setValueAtTime(0.16, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.28);
      }
    } catch (err) {
      console.warn("Audio chime block:", err);
    }
  };

  const triggerPwaInstall = async () => {
    if (!deferredInstallPrompt) {
      toast.info("Install prompt isn't armed yet. Please use browser's Share/Settings overlay and select 'Add to Home Screen'!");
      return;
    }
    try {
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        toast.success("Successfully installed Packer Tools Scanner App!");
      }
      setDeferredInstallPrompt(null);
    } catch (err) {
      console.error(err);
    }
  };

  const pwaScannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!pwaScannerActive || !isScannerApp) {
      setCameraAccessError(null);
      if (pwaScannerRef.current) {
        try {
          if (pwaScannerRef.current.isScanning) {
            pwaScannerRef.current.stop().catch(e => console.log(e));
          }
        } catch (e) {
          console.warn(e);
        }
        pwaScannerRef.current = null;
      }
      return;
    }

    let isSubscribed = true;
    let retryCount = 0;

    const startPwaScanner = () => {
      setCameraAccessError(null);
      const el = document.getElementById("pwa-scanner-viewport");
      if (!el) {
        if (isSubscribed && retryCount < 45) {
          retryCount++;
          setTimeout(startPwaScanner, 120);
        }
        return;
      }

      try {
        const scanner = new Html5Qrcode("pwa-scanner-viewport");
        pwaScannerRef.current = scanner;

        scanner.start(
          { facingMode: "environment" },
          { fps: 12, qrbox: { width: 260, height: 260 } },
          (decodedText) => {
            const now = Date.now();
            if (
              lastInstantScannedRef.current &&
              lastInstantScannedRef.current.code === decodedText &&
              now - lastInstantScannedRef.current.time < 2200
            ) {
              return;
            }
            lastInstantScannedRef.current = { code: decodedText, time: now };
            playScanChime('success');
            handlePwaScan(decodedText);
          },
          () => {}
        ).catch(() => {
          if (!isSubscribed) return;
          scanner.start(
            { facingMode: "user" },
            { fps: 12, qrbox: { width: 260, height: 260 } },
            (decodedText) => {
              const now = Date.now();
              if (
                lastInstantScannedRef.current &&
                lastInstantScannedRef.current.code === decodedText &&
                now - lastInstantScannedRef.current.time < 2200
              ) {
                return;
              }
              lastInstantScannedRef.current = { code: decodedText, time: now };
              playScanChime('success');
              handlePwaScan(decodedText);
            },
            () => {}
          ).catch(e => {
            console.error("PWA Cam start fail:", e);
            if (isSubscribed) {
              setCameraAccessError(e.message || String(e));
            }
          });
        });
      } catch (err) {
        console.error("HTML5Qrcode setup error in PWA mode:", err);
        setCameraAccessError(String(err));
      }
    };

    startPwaScanner();

    return () => {
      isSubscribed = false;
      if (pwaScannerRef.current) {
        try {
          if (pwaScannerRef.current.isScanning) {
            pwaScannerRef.current.stop().catch(e => console.log(e));
          }
        } catch (e) {
          console.warn(e);
        }
        pwaScannerRef.current = null;
      }
    };
  }, [pwaScannerActive, isScannerApp, pwaMode]);

  const handlePwaScan = async (scannedValue: string) => {
    const targetUid = initialUser?.uid;
    if (!targetUid) {
      toast.error("Please authentication register in this app first.");
      return;
    }

    let decodedValue = scannedValue.trim();
    if (decodedValue.includes('/gear/')) {
      try {
        const urlObj = new URL(decodedValue);
        const pathParts = urlObj.pathname.split('/');
        const gearIdx = pathParts.indexOf('gear');
        if (gearIdx !== -1 && pathParts[gearIdx + 1]) {
          decodedValue = pathParts[gearIdx + 1];
        }
      } catch (e) {
        const parts = decodedValue.split('/gear/');
        if (parts[1]) {
          decodedValue = parts[1].split('?')[0];
        }
      }
    }

    try {
      let foundItem: GearItem | null = null;
      const directRef = doc(db, 'users', targetUid, 'gearLibrary', decodedValue);
      const directSnap = await getDoc(directRef);
      if (directSnap.exists()) {
        foundItem = { id: directSnap.id, ...directSnap.data() } as GearItem;
      } else {
        const qTag = query(
          collection(db, 'users', targetUid, 'gearLibrary'),
          where('assetTag', '==', decodedValue),
          limit(1)
        );
        const tagSnap = await getDocs(qTag);
        if (!tagSnap.empty) {
          foundItem = { id: tagSnap.docs[0].id, ...tagSnap.docs[0].data() } as GearItem;
        } else {
          const qRawTag = query(
            collection(db, 'users', targetUid, 'gearLibrary'),
            where('assetTag', '==', scannedValue),
            limit(1)
          );
          const rawTagSnap = await getDocs(qRawTag);
          if (!rawTagSnap.empty) {
            foundItem = { id: rawTagSnap.docs[0].id, ...rawTagSnap.docs[0].data() } as GearItem;
          }
        }
      }

      if (!foundItem) {
        playScanChime('error');
        toast.error(`No equipment matches asset tag "${decodedValue}"`);
        return;
      }

      setPwaLatestScannedItem(foundItem);

      const userGearRef = doc(db, 'users', targetUid, 'gearLibrary', foundItem.id);

      if (pwaMode === 'checkin') {
        const nowMs = Date.now();
        if (!isOnline) {
          await offlineSync.queueOperation({
            type: 'update',
            collectionPath: ['users', targetUid, 'gearLibrary', foundItem.id],
            docId: foundItem.id,
            data: {
              status: 'available',
              currentHolder: "",
              lastCheckedIn: nowMs
            },
            label: `Check-in ${foundItem.name} (Offline)`
          });

          const checkoutId = 'checkout_' + nowMs + '_' + Math.random().toString(36).substring(2, 7);
          await offlineSync.queueOperation({
            type: 'set',
            collectionPath: ['checkouts', checkoutId],
            docId: checkoutId,
            data: {
              assetId: foundItem.id,
              assetName: foundItem.name,
              assetType: 'item',
              userId: targetUid,
              userName: foundItem.currentHolder || 'Assigned Holder',
              userEmail: '',
              checkInTime: nowMs,
              status: 'returned',
              notes: `Checked-in securely via PWA Scanner App (Offline)`
            },
            label: `Record Check-in ${foundItem.name} (Offline)`
          });
        } else {
          await updateDoc(userGearRef, {
            status: 'available',
            currentHolder: "",
            lastCheckedIn: serverTimestamp()
          });

          await addDoc(collection(db, 'checkouts'), {
            assetId: foundItem.id,
            assetName: foundItem.name,
            assetType: 'item',
            userId: targetUid,
            userName: foundItem.currentHolder || 'Assigned Holder',
            userEmail: '',
            checkInTime: serverTimestamp(),
            status: 'returned',
            notes: `Checked-in securely via PWA Scanner App`
          });
        }

        setPwaSessionLogs(prev => [
          {
            id: Math.random().toString(),
            itemName: foundItem!.name,
            brand: foundItem!.brand || '',
            action: 'in',
            timestamp: new Date(),
            assetTag: foundItem!.assetTag || foundItem!.id
          },
          ...prev
        ]);
        toast.success(`✓ Checked IN: ${foundItem.name}${!isOnline ? ' (Queued Offline)' : ''}`);
      } else if (pwaMode === 'checkout') {
        const holderName = scannerAssignee.trim() || initialUser?.displayName || 'PWA Scanner Operator';
        const nowMs = Date.now();
        if (!isOnline) {
          await offlineSync.queueOperation({
            type: 'update',
            collectionPath: ['users', targetUid, 'gearLibrary', foundItem.id],
            docId: foundItem.id,
            data: {
              status: 'in_use',
              currentHolder: holderName,
              lastCheckedOut: nowMs
            },
            label: `Check-out ${foundItem.name} to ${holderName} (Offline)`
          });

          const checkoutId = 'checkout_' + nowMs + '_' + Math.random().toString(36).substring(2, 7);
          await offlineSync.queueOperation({
            type: 'set',
            collectionPath: ['checkouts', checkoutId],
            docId: checkoutId,
            data: {
              assetId: foundItem.id,
              assetName: foundItem.name,
              assetType: 'item',
              userId: targetUid,
              userName: holderName,
              userEmail: scannerAssigneeEmail || '',
              checkOutTime: nowMs,
              status: 'checked_out',
              notes: `Checked-out securely via PWA Scanner App to ${holderName} (Offline)`
            },
            label: `Record Check-out ${foundItem.name} (Offline)`
          });
        } else {
          await updateDoc(userGearRef, {
            status: 'in_use',
            currentHolder: holderName,
            lastCheckedOut: serverTimestamp()
          });

          await addDoc(collection(db, 'checkouts'), {
            assetId: foundItem.id,
            assetName: foundItem.name,
            assetType: 'item',
            userId: targetUid,
            userName: holderName,
            userEmail: scannerAssigneeEmail || '',
            checkOutTime: serverTimestamp(),
            status: 'checked_out',
            notes: `Checked-out securely via PWA Scanner App to ${holderName}`
          });
        }

        setPwaSessionLogs(prev => [
          {
            id: Math.random().toString(),
            itemName: foundItem!.name,
            brand: foundItem!.brand || '',
            action: 'out',
            assignee: holderName,
            timestamp: new Date(),
            assetTag: foundItem!.assetTag || foundItem!.id
          },
          ...prev
        ]);
        toast.success(`➜ Checked OUT: ${foundItem.name} to ${holderName}${!isOnline ? ' (Queued Offline)' : ''}`);
      } else {
        // Spec Board / Lookup
        setPwaSessionLogs(prev => [
          {
            id: Math.random().toString(),
            itemName: foundItem!.name,
            brand: foundItem!.brand || '',
            action: 'lookup',
            timestamp: new Date(),
            assetTag: foundItem!.assetTag || foundItem!.id
          },
          ...prev
        ]);
        toast.success(`🔍 Resolved specs for "${foundItem.name}"`);
      }
    } catch (err) {
      console.error("PWA Scan execution error:", err);
      playScanChime('error');
      toast.error("Handheld transition failed.");
    }
  };

  const processAutoCheckInOut = async (scannedValue: string) => {
    const targetUid = initialUser?.uid;
    if (!targetUid) {
      toast.error("Please log in to use the automated scanner component.");
      return;
    }

    let decodedValue = scannedValue.trim();
    if (decodedValue.includes('/gear/')) {
      try {
        const urlObj = new URL(decodedValue);
        const pathParts = urlObj.pathname.split('/');
        const gearIdx = pathParts.indexOf('gear');
        if (gearIdx !== -1 && pathParts[gearIdx + 1]) {
          decodedValue = pathParts[gearIdx + 1];
        }
      } catch (e) {
        const parts = decodedValue.split('/gear/');
        if (parts[1]) {
          decodedValue = parts[1].split('?')[0];
        }
      }
    }

    try {
      let foundItem: GearItem | null = null;
      const directRef = doc(db, 'users', targetUid, 'gearLibrary', decodedValue);
      const directSnap = await getDoc(directRef);
      if (directSnap.exists()) {
        foundItem = { id: directSnap.id, ...directSnap.data() } as GearItem;
      } else {
        const qTag = query(
          collection(db, 'users', targetUid, 'gearLibrary'),
          where('assetTag', '==', decodedValue),
          limit(1)
        );
        const tagSnap = await getDocs(qTag);
        if (!tagSnap.empty) {
          foundItem = { id: tagSnap.docs[0].id, ...tagSnap.docs[0].data() } as GearItem;
        } else {
          const qRawTag = query(
            collection(db, 'users', targetUid, 'gearLibrary'),
            where('assetTag', '==', scannedValue),
            limit(1)
          );
          const rawTagSnap = await getDocs(qRawTag);
          if (!rawTagSnap.empty) {
            foundItem = { id: rawTagSnap.docs[0].id, ...rawTagSnap.docs[0].data() } as GearItem;
          }
        }
      }

      if (!foundItem) {
        toast.error(`No equipment matches asset identifier "${decodedValue}"`);
        return;
      }

      const userGearRef = doc(db, 'users', targetUid, 'gearLibrary', foundItem.id);
      
      if (foundItem.status === 'in_use') {
        await updateDoc(userGearRef, {
          status: 'available',
          currentHolder: "",
          lastCheckedIn: serverTimestamp()
        });

        await addDoc(collection(db, 'checkouts'), {
          assetId: foundItem.id,
          assetName: foundItem.name,
          assetType: 'item',
          userId: targetUid,
          userName: foundItem.currentHolder || 'Assigned Holder',
          userEmail: '',
          checkInTime: serverTimestamp(),
          status: 'returned',
          notes: `Auto checked-in via Instant Gear Scanner at ${new Date().toLocaleTimeString()}`
        });

        setAutoScanLogs(prev => [
          {
            id: Math.random().toString(),
            itemName: foundItem!.name,
            brand: foundItem!.brand || '',
            action: 'in',
            timestamp: new Date(),
            assetTag: foundItem!.assetTag || foundItem!.id
          },
          ...prev
        ]);

        toast.success(`✓ Auto Checked IN: ${foundItem.brand || ''} ${foundItem.name}`);
      } else {
        const holderName = scannerAssignee.trim() || initialUser?.displayName || 'Terminal Guest';
        const holderEmail = scannerAssigneeEmail.trim() || initialUser?.email || 'guest@terminal.local';

        await updateDoc(userGearRef, {
          status: 'in_use',
          currentHolder: holderName,
          lastCheckedOut: serverTimestamp()
        });

        await addDoc(collection(db, 'checkouts'), {
          assetId: foundItem.id,
          assetName: foundItem.name,
          assetType: 'item',
          userId: targetUid,
          userName: holderName,
          userEmail: holderEmail,
          checkOutTime: serverTimestamp(),
          status: 'active',
          notes: `Auto checked-out via Instant Gear Scanner at ${new Date().toLocaleTimeString()}`
        });

        setAutoScanLogs(prev => [
          {
            id: Math.random().toString(),
            itemName: foundItem!.name,
            brand: foundItem!.brand || '',
            action: 'out',
            assignee: holderName,
            timestamp: new Date(),
            assetTag: foundItem!.assetTag || foundItem!.id
          },
          ...prev
        ]);

        toast.success(`➜ Auto Checked OUT: ${foundItem.brand || ''} ${foundItem.name} to ${holderName}`);
      }
    } catch (err) {
      console.error("Auto scan check-in/out error:", err);
      toast.error("Auto state transition failed.");
    }
  };

  const handleInstantScanSuccess = (scannedValue: string) => {
    processAutoCheckInOut(scannedValue);
  };

  const handleAddNewTerminal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initialUser?.uid) return;
    if (!newTerminalName.trim()) {
      toast.error("Please specify a terminal location or device name!");
      return;
    }

    setIsLoading(true);
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await addDoc(collection(db, 'terminals'), {
        ownerUid: initialUser.uid,
        deviceName: newTerminalName.trim(),
        pairingCode: code,
        status: 'pending',
        lastActive: new Date().toISOString(),
        settings: {
          mode: newTerminalMode
        },
        customPreferences: {
          welcomeMessage: kioskWelcomeMessage,
          showBrand: showBrandSetting,
          showCondition: showConditionSetting,
          showHolder: showHolderSetting,
          showCategory: showCategorySetting,
          showQR: showQRSetting,
          showTimestamp: showTimestampSetting
        }
      });

      toast.success(`Kiosk "${newTerminalName}" successfully registered!`);
      setNewTerminalName('');
      setShowAddTerminalModal(false);
    } catch (err) {
      console.error("Error creating terminal record:", err);
      toast.error("Failed to register Kiosk device.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegeneratePin = async (tId: string, deviceName: string) => {
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await updateDoc(doc(db, 'terminals', tId), {
        pairingCode: code,
        lastActive: new Date().toISOString()
      });
      toast.success(`Pairing PIN successfully rotated for ${deviceName}!`);
    } catch (err) {
      console.error("Error regenerating pairing PIN:", err);
      toast.error("Failed to rotate pairing PIN.");
    }
  };

  const handleRevokeTerminal = async (tId: string, deviceName: string) => {
    if (!confirm(`Are you sure you want to delete and revoke terminal "${deviceName}"?`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'terminals', tId));
      toast.success(`Terminal ${deviceName} successfully deleted.`);
    } catch (err) {
      console.error("Error deleting terminal:", err);
      toast.error("Failed to delete terminal.");
    }
  };
  
  // Database Entities load states
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [inventories, setInventories] = useState<any[]>([]);

  // Setup options selection
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedSourceType, setSelectedSourceType] = useState<'gearLibrary' | 'customInventory'>('gearLibrary');
  const [selectedInventoryId, setSelectedInventoryId] = useState<string>('');
  
  // Custom states for the interactive Cart/Self-Service Fast-Food Kiosk
  const [cart, setCart] = useState<{ item: GearItem; qty: number }[]>([]);
  const [lastOrderReceipt, setLastOrderReceipt] = useState<{
    orderNumber: string;
    userName: string;
    userEmail: string;
    items: { id: string; name: string; assetTag: string; category: string; qty: number; isKit?: boolean }[];
    createdAt: Date;
    actionType: KioskAction;
  } | null>(null);

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailModalData, setEmailModalData] = useState<{
    success: boolean;
    simulated: boolean;
    recipient: string;
    subject: string;
    html: string;
    notice?: string;
    error?: string;
  } | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Active strategy loaded dynamically from settings
  const activeStrategy = adminSettings?.kioskConfig?.mode || 'direct';
  const [isFulfillDeskOpen, setIsFulfillDeskOpen] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [activeFulfillOrder, setActiveFulfillOrder] = useState<any | null>(null);
  const [verifiedItemsMap, setVerifiedItemsMap] = useState<{ [id: string]: boolean }>({});

  useEffect(() => {
    const targetUid = pairedUid || initialUser?.uid;
    if (!targetUid || activeStrategy !== 'order') return;

    const q = query(
      collection(db, 'orders'),
      where('userId', '==', targetUid),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort in-memory to prevent requiring Firestore custom indexes
      orders.sort((a: any, b: any) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });
      setPendingOrders(orders);
    }, (err) => {
      console.warn("Real-time orders sync warning:", err);
    });

    return () => unsubscribe();
  }, [pairedUid, initialUser?.uid, activeStrategy]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GearItem[]>([]);
  const [pairingCode, setPairingCode] = useState<string>('');
  
  const [action, setAction] = useState<KioskAction | null>(null);
  const [scannedAsset, setScannedAsset] = useState<GearItem | null>(null);
  const [selectedCase, setSelectedCase] = useState<Container | null>(null);
  const [containers, setContainers] = useState<Container[]>([]);
  const [newCaseName, setNewCaseName] = useState('');
  const [newCaseType, setNewCaseType] = useState('Case');
  const [guestInfo, setGuestInfo] = useState({ name: '', email: '' });
  const [signature, setSignature] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [kioskMode, setKioskMode] = useState<'both' | 'checkout' | 'checkin'>('both');
  const [gear, setGear] = useState<GearItem[]>([]);

  // Mobile layout, security PIN rotation states and checks
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);
  const [pinExpirySec, setPinExpirySec] = useState<number>(60);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isOrgMember = !!(initialUser?.orgId || pairedUser?.orgId);

  // Rotate Pairing PIN every minute (60s) when the device is not activated (on step 'activate')
  useEffect(() => {
    if (isActivated || !terminalId || step !== 'activate') return;

    const timer = setInterval(() => {
      setPinExpirySec((prev) => {
        if (prev <= 1) {
          const newCode = Math.floor(100000 + Math.random() * 900000).toString();
          updateDoc(doc(db, 'terminals', terminalId), {
            pairingCode: newCode,
            lastActive: new Date().toISOString()
          })
            .then(() => {
              setPairingCode(newCode);
              toast.success("Pairing PIN auto-rotated for enhanced security!");
            })
            .catch((err) => console.error("Error auto-rotating Kiosk PIN:", err));
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActivated, terminalId, step]);

  useEffect(() => {
    setPinExpirySec(60);
  }, [pairingCode]);

  const sigCanvas = useRef<SignatureCanvas>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedKioskQrRef = useRef<{ code: string; time: number } | null>(null);

  // Synchronically load organizations, departments, teams, custom inventories
  useEffect(() => {
    const targetUid = pairedUid || initialUser?.uid;
    if (!targetUid) return;

    // Load custom inventories
    const qInvs = query(collection(db, 'inventories'));
    const unsubInvs = onSnapshot(qInvs, (snap) => {
      setInventories(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.warn("Invs load warning:", err));

    // Load organizations
    const qOrgs = query(collection(db, 'organizations'), where('ownerId', '==', targetUid));
    const unsubOrgs = onSnapshot(qOrgs, (snap) => {
      setOrganizations(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.warn("Orgs load warning:", err));

    return () => {
      unsubInvs();
      unsubOrgs();
    };
  }, [pairedUid, initialUser?.uid]);

  // Load departments & teams when selectedOrgId changes
  useEffect(() => {
    if (!selectedOrgId) {
      setDepartments([]);
      setTeams([]);
      return;
    }

    const qDepts = query(collection(db, 'departments'), where('orgId', '==', selectedOrgId));
    const unsubDepts = onSnapshot(qDepts, (snap) => {
      setDepartments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.warn("Depts load warning:", err));

    const qTeams = query(collection(db, 'teams'), where('orgId', '==', selectedOrgId));
    const unsubTeams = onSnapshot(qTeams, (snap) => {
      setTeams(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.warn("Teams load warning:", err));

    return () => {
      unsubDepts();
      unsubTeams();
    };
  }, [selectedOrgId]);

  // Dynamic real-time gear catalog loading with strict checkout filters
  // This supports both central gearLibrary and custom lists + filters by org/dept/team + skips sale products
  useEffect(() => {
    const targetUid = pairedUid || initialUser?.uid;
    if (!targetUid) return;

    let unsubscribe = () => {};

    if (activeSourceType === 'gearLibrary') {
      const gearPath = `users/${targetUid}/gearLibrary`;
      unsubscribe = onSnapshot(collection(db, 'users', targetUid, 'gearLibrary'), (snapshot) => {
        let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GearItem));
        
        // Kiosk will not process sales or items specifically configured for purchase/sales
        items = items.filter(item => !item.isSale);

        // Filter by organization context if selected
        if (selectedOrgId) {
          items = items.filter(item => item.orgId === selectedOrgId);
        }
        // Filter by department context if selected
        if (selectedDeptId && selectedDeptId !== 'all') {
          items = items.filter(item => item.deptId === selectedDeptId);
        }
        // Filter by team context if selected
        if (selectedTeamId && selectedTeamId !== 'all') {
          items = items.filter(item => item.teamId === selectedTeamId);
        }

        setGear(items);
      }, (error) => {
        console.warn("Dynamic gearLibrary load failed:", error);
      });
    } else if (activeSourceType === 'customInventory' && terminalInventoryId) {
      unsubscribe = onSnapshot(collection(db, 'inventories', terminalInventoryId, 'items'), (snapshot) => {
        let items = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            brand: data.brand || '',
            model: data.model || '',
            category: data.category || 'Gear',
            assetTag: data.assetTag || data.id || doc.id,
            status: data.status || 'available',
            condition: data.condition || 'good',
            isSale: data.isSale || false,
            price: data.price || 0,
            quantity: data.quantity || 1,
            orgId: data.orgId || '',
            deptId: data.deptId || '',
            teamId: data.teamId || ''
          } as unknown as GearItem;
        });

        // Kiosk will not process sales or items specifically configured for purchase/sales
        items = items.filter(item => !item.isSale);

        // Filter by organization context if selected
        if (selectedOrgId) {
          items = items.filter(item => !item.orgId || item.orgId === selectedOrgId);
        }
        // Filter by department context if selected
        if (selectedDeptId && selectedDeptId !== 'all') {
          items = items.filter(item => !item.deptId || item.deptId === selectedDeptId);
        }
        // Filter by team context if selected
        if (selectedTeamId && selectedTeamId !== 'all') {
          items = items.filter(item => !item.teamId || item.teamId === selectedTeamId);
        }

        setGear(items);
      }, (error) => {
        console.warn("Dynamic customInventory load failed: ", error);
      });
    }

    return () => {
      unsubscribe();
    };
  }, [pairedUid, initialUser?.uid, activeSourceType, terminalInventoryId, selectedOrgId, selectedDeptId, selectedTeamId]);

  // Handle container listeners
  useEffect(() => {
    const targetUid = pairedUid || initialUser?.uid;
    if (!targetUid) return;

    const containerPath = `users/${targetUid}/containers`;
    const unsubscribeContainers = onSnapshot(collection(db, 'users', targetUid, 'containers'), (snapshot) => {
      setContainers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Container)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, containerPath);
    });

    return () => {
      unsubscribeContainers();
    };
  }, [pairedUid, initialUser]);

  // Synchronize paired user profile to get real-time subscription status and plan attributes
  useEffect(() => {
    const targetUid = pairedUid || initialUser?.uid;
    if (!targetUid) {
      setPairedUser(null);
      return;
    }

    setCheckingPlan(true);
    const unsub = onSnapshot(doc(db, 'users', targetUid), (snap) => {
      if (snap.exists()) {
        setPairedUser({ uid: snap.id, ...snap.data() } as UserProfile);
      } else {
        setPairedUser(null);
      }
      setCheckingPlan(false);
    }, (error) => {
      console.warn("Error fetching paired user profile:", error);
      setCheckingPlan(false);
    });

    return () => unsub();
  }, [pairedUid, initialUser]);

  useEffect(() => {
    const initializeTerminal = async () => {
      const terminalCollectionPath = 'terminals';
      let id = localStorage.getItem('kiosk_terminal_id');
      if (!id) {
        // Create new terminal record
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        try {
          const docRef = await addDoc(collection(db, 'terminals'), {
            pairingCode: code,
            status: 'pending',
            deviceName: 'Kiosk Tablet ' + Math.random().toString(36).substring(7),
            lastActive: new Date().toISOString(),
            settings: { mode: 'both' }
          });
          id = docRef.id;
          localStorage.setItem('kiosk_terminal_id', id);
          setTerminalId(id);
          setPairingCode(code);
        } catch (err) {
          console.error("Terminal init failed", err);
          if (err instanceof Error && err.message.includes('permission')) {
            handleFirestoreError(err, OperationType.CREATE, terminalCollectionPath);
          }
        }
      }

      if (id) {
        const terminalDocPath = `terminals/${id}`;
        const unsub = onSnapshot(doc(db, 'terminals', id), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data.status === 'active' && data.ownerUid) {
              setPairedUid(data.ownerUid);
              setIsActivated(true);
              const configured = localStorage.getItem('kiosk_configured');
              if (configured === 'true') {
                setStep('welcome');
              } else {
                setStep('configure');
              }
            } else {
              setStep('activate');
              setPairingCode(data.pairingCode);
            }
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, terminalDocPath);
        });
        return unsub;
      }
    };

    initializeTerminal();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleEscapeTap = () => {
    setEscapeTaps(prev => {
      const next = prev + 1;
      if (next >= 5) {
        if (terminalId) {
          updateDoc(doc(db, 'terminals', terminalId), { status: 'pending', ownerUid: null });
        }
        localStorage.removeItem('kiosk_terminal_id');
        window.location.href = '/dashboard';
        return 0;
      }
      setTimeout(() => setEscapeTaps(0), 3000);
      return next;
    });
  };

  const handleManualSearch = async () => {
    const targetUid = pairedUid || initialUser?.uid;
    if (!targetUid) return;

    setIsLoading(true);
    try {
      const q = query(
        collection(db, 'users', targetUid, 'gearLibrary'),
        limit(100)
      );
      
      const snapshot = await getDocs(q);
      let results = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) } as GearItem));
      
      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase().trim();
        results = results.filter(item => {
          const nameMatch = item.name?.toLowerCase().includes(lowerQuery);
          const assetTagMatch = item.assetTag?.toLowerCase().includes(lowerQuery);
          const brandMatch = item.brand?.toLowerCase().includes(lowerQuery);
          const categoryMatch = item.category?.toLowerCase().includes(lowerQuery);
          const modelMatch = item.model?.toLowerCase().includes(lowerQuery);
          
          // Match 'kit' or 'kits' keywords if the item is flagged as a kit
          const kitMatch = item.isKit && (lowerQuery === 'kit' || lowerQuery === 'kits' || item.name?.toLowerCase().includes('kit'));
          
          return nameMatch || assetTagMatch || brandMatch || categoryMatch || modelMatch || kitMatch;
        });
      }
      
      setSearchResults(results.slice(0, 20));
    } catch (e) {
      console.error("Search failed", e);
      toast.error("Search failed");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusDisplay = (status?: GearItem['status']) => {
    switch (status) {
      case 'available': return { label: 'Available', color: 'bg-green-500/20 text-green-400' };
      case 'in_use': return { label: 'In Use', color: 'bg-blue-500/20 text-blue-400' };
      case 'maintenance': return { label: 'In Service', color: 'bg-amber-500/20 text-amber-400' };
      case 'retired': return { label: 'Retired', color: 'bg-red-500/20 text-red-400' };
      case 'missing': return { label: 'Missing', color: 'bg-neutral-500/20 text-neutral-400' };
      default: return { label: 'Available', color: 'bg-green-500/20 text-green-400' };
    }
  };

  const handleActivate = async () => {
    if (!terminalId) return;
    try {
      const targetUid = initialUser?.uid;
      if (!targetUid) {
        toast.error("Please login first to pair this kiosk with your active account!");
        return;
      }
      if (!isFeatureEnabled('kioskMode', initialUser, adminSettings)) {
        toast.error("Your current plan does not include Kiosk Mode. Please upgrade to Pro or Enterprise.");
        return;
      }
      await updateDoc(doc(db, 'terminals', terminalId), {
        status: 'active',
        ownerUid: targetUid,
        lastActive: new Date().toISOString()
      });
      setPairedUid(targetUid);
      setIsActivated(true);
      const configured = localStorage.getItem('kiosk_configured');
      if (configured === 'true') {
        setStep('welcome');
      } else {
        setStep('configure');
      }
      toast.success("Terminal paired and fully activated!");
    } catch (err) {
      console.error("Handshake activation failed", err);
      toast.error("Handshake activation failed");
    }
  };

  useEffect(() => {
    const isScanStep = step === 'scan';
    const isPackStep = step === 'case_pack';

    if (isScanStep || isPackStep) {
      if (isScanStep && !isOrgMember) {
        return;
      }

      let isSubscribed = true;
      let retryCount = 0;

      const initScanner = () => {
        if (!isSubscribed) return;
        const el = document.getElementById("kiosk-scanner");
        if (!el) {
          if (isSubscribed && retryCount < 40) {
            retryCount++;
            setTimeout(initScanner, 50);
          }
          return;
        }

        try {
          if (!isSubscribed || !document.body.contains(el)) {
            if (isSubscribed && retryCount < 40) {
              retryCount++;
              setTimeout(initScanner, 50);
            }
            return;
          }

          const scanner = new Html5Qrcode("kiosk-scanner");
          scannerRef.current = scanner;

          const startKioskQR = async () => {
            try {
              await scanner.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 300, height: 300 } },
                (decodedText) => {
                  const now = Date.now();
                  if (
                    lastScannedKioskQrRef.current &&
                    lastScannedKioskQrRef.current.code === decodedText &&
                    now - lastScannedKioskQrRef.current.time < 2000
                  ) {
                    return;
                  }
                  lastScannedKioskQrRef.current = { code: decodedText, time: now };
                  handleScanSuccess(decodedText);
                },
                () => {}
              );
            } catch (envError) {
              console.warn("Back camera failed in kiosk mode, trying front/any camera:", envError);
              try {
                await scanner.start(
                  { facingMode: "user" },
                  { fps: 10, qrbox: { width: 300, height: 300 } },
                  (decodedText) => {
                    const now = Date.now();
                    if (
                      lastScannedKioskQrRef.current &&
                      lastScannedKioskQrRef.current.code === decodedText &&
                      now - lastScannedKioskQrRef.current.time < 2000
                    ) {
                      return;
                    }
                    lastScannedKioskQrRef.current = { code: decodedText, time: now };
                    handleScanSuccess(decodedText);
                  },
                  () => {}
                );
              } catch (userError) {
                console.warn("Front camera failed, trying first available device id:", userError);
                try {
                  const devices = await Html5Qrcode.getCameras();
                  if (devices && devices.length > 0) {
                    await scanner.start(
                      devices[0].id,
                      { fps: 10, qrbox: { width: 300, height: 300 } },
                      (decodedText) => {
                        const now = Date.now();
                        if (
                          lastScannedKioskQrRef.current &&
                          lastScannedKioskQrRef.current.code === decodedText &&
                          now - lastScannedKioskQrRef.current.time < 2000
                        ) {
                          return;
                        }
                        lastScannedKioskQrRef.current = { code: decodedText, time: now };
                        handleScanSuccess(decodedText);
                      },
                      () => {}
                    );
                  } else {
                    toast.error("No camera devices detected. Please verify connectivity or check system permissions.");
                  }
                } catch (genericError) {
                  console.error("Camera startup failed completely in kiosk mode:", genericError);
                  toast.error("Could not activate camera for QR scanning.");
                }
              }
            }
          };

          startKioskQR();
        } catch (e) {
          console.error("Failed to initialize scanner", e);
        }
      };

      initScanner();

      return () => {
        isSubscribed = false;
        if (scannerRef.current) {
          try {
            if (scannerRef.current.isScanning) {
              scannerRef.current.stop().catch(e => console.log("Non-blocking error stopping scanner:", e));
            }
          } catch (e) {
            console.log("Cleanup exception ignored:", e);
          }
          scannerRef.current = null;
        }
      };
    }
  }, [step, isOrgMember]);

  const handleCreateCase = async () => {
    const targetUid = pairedUid || initialUser?.uid;
    if (!targetUid || !newCaseName.trim()) return;
    setIsLoading(true);
    try {
      await addDoc(collection(db, 'users', targetUid, 'containers'), {
        name: newCaseName,
        type: newCaseType,
        items: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setNewCaseName('');
      setStep('case_explorer');
      toast.success("Case created successfully");
    } catch (e) {
      toast.error("Failed to create case");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePackItem = async (assetTag: string) => {
    const targetUid = pairedUid || initialUser?.uid;
    if (!targetUid || !selectedCase) return;
    setIsLoading(true);
    try {
      const q = query(collection(db, 'users', targetUid, 'gearLibrary'), where('assetTag', '==', assetTag), limit(1));
      const snap = await getDocs(q);
      
      let item: any = null;
      if (!snap.empty) {
        item = { id: snap.docs[0].id, ...snap.docs[0].data() };
      } else {
        const idSnap = await getDocs(query(collection(db, 'users', targetUid, 'gearLibrary'), where('id', '==', assetTag), limit(1)));
        if (!idSnap.empty) {
          item = { id: idSnap.docs[0].id, ...idSnap.docs[0].data() };
        }
      }

      if (!item) {
        toast.error("Item not found");
        return;
      }

      if (selectedCase.items.includes(item.id)) {
        toast.info("Item already in this case");
        return;
      }

      await updateDoc(doc(db, 'users', targetUid, 'containers', selectedCase.id), {
        items: arrayUnion(item.id),
        updatedAt: serverTimestamp()
      });
      
      toast.success(`Packed ${item.name}`);
    } catch (e) {
      toast.error("Packing failed");
    } finally {
      setIsLoading(false);
    }
  };

  const addToCart = (item: GearItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) {
        toast.success(`Incremented quantity for "${item.name}"`);
        return prev.map(i => i.item.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      } else {
        toast.success(`Added "${item.name}" to the list`);
        return [...prev, { item, qty: 1 }];
      }
    });
  };

  const removeFromCart = (itemId: string, removeFully = false) => {
    setCart(prev => {
      const existing = prev.find(i => i.item.id === itemId);
      if (!existing) return prev;
      if (removeFully || existing.qty <= 1) {
        toast.info(`Removed "${existing.item.name}" from review list`);
        return prev.filter(i => i.item.id !== itemId);
      } else {
        return prev.map(i => i.item.id === itemId ? { ...i, qty: i.qty - 1 } : i);
      }
    });
  };

  const getItemDocRef = (itemId: string, targetUid: string) => {
    if (activeSourceType === 'customInventory' && terminalInventoryId) {
      return doc(db, 'inventories', terminalInventoryId, 'items', itemId);
    }
    return doc(db, 'users', targetUid, 'gearLibrary', itemId);
  };

  const getItemCollectionPath = (itemId: string, targetUid: string) => {
    if (activeSourceType === 'customInventory' && terminalInventoryId) {
      return ['inventories', terminalInventoryId, 'items', itemId];
    }
    return ['users', targetUid, 'gearLibrary', itemId];
  };

  const handleScanSuccess = async (scannedValue: string) => {
    if (step === 'case_pack') {
      handlePackItem(scannedValue);
      return;
    }
    const targetUid = pairedUid || initialUser?.uid;
    if (!targetUid) return;
    setIsLoading(true);

    // Extract ID or tag if a full URL was scanned
    let decodedValue = scannedValue.trim();
    if (scannedValue.includes('/gear/')) {
      try {
        const urlObj = new URL(scannedValue);
        const pathParts = urlObj.pathname.split('/');
        const gearIdx = pathParts.indexOf('gear');
        if (gearIdx !== -1 && pathParts[gearIdx + 1]) {
          decodedValue = pathParts[gearIdx + 1];
        }
      } catch (e) {
        const parts = scannedValue.split('/gear/');
        if (parts[1]) {
          decodedValue = parts[1].split('?')[0];
        }
      }
    }

    try {
      let foundItem: GearItem | null = null;

      // 1. First try direct document ID lookup (in case the scanned value is the document ID)
      const directDocRef = getItemDocRef(decodedValue, targetUid);
      const directDocSnap = await getDoc(directDocRef);
      if (directDocSnap.exists()) {
        const dData = directDocSnap.data();
        if (activeSourceType === 'customInventory') {
          foundItem = {
            id: directDocSnap.id,
            name: dData.name,
            brand: dData.brand || '',
            model: dData.model || '',
            category: dData.category || 'Gear',
            assetTag: dData.assetTag || dData.id || directDocSnap.id,
            status: dData.status || 'available',
            condition: dData.condition || 'good',
            isSale: dData.isSale || false,
            price: dData.price || 0,
            quantity: dData.quantity || 1
          } as unknown as GearItem;
        } else {
          foundItem = { id: directDocSnap.id, ...dData } as GearItem;
        }
      } else {
        // 2. Try looking up by the 'assetTag' field (classic tag search)
        const colRef = activeSourceType === 'customInventory' && terminalInventoryId
          ? collection(db, 'inventories', terminalInventoryId, 'items')
          : collection(db, 'users', targetUid, 'gearLibrary');

        const qTag = query(
          colRef,
          where('assetTag', '==', decodedValue),
          limit(1)
        );
        const tagSnap = await getDocs(qTag);
        if (!tagSnap.empty) {
          const dData = tagSnap.docs[0].data();
          if (activeSourceType === 'customInventory') {
            foundItem = {
              id: tagSnap.docs[0].id,
              name: dData.name,
              brand: dData.brand || '',
              model: dData.model || '',
              category: dData.category || 'Gear',
              assetTag: dData.assetTag || dData.id || tagSnap.docs[0].id,
              status: dData.status || 'available',
              condition: dData.condition || 'good',
              isSale: dData.isSale || false,
              price: dData.price || 0,
              quantity: dData.quantity || 1
            } as unknown as GearItem;
          } else {
            foundItem = { id: tagSnap.docs[0].id, ...dData } as GearItem;
          }
        } else {
          // 3. Fallback: search by 'assetTag' using the raw undecoded value in case the tag was custom
          const qRawTag = query(
            colRef,
            where('assetTag', '==', scannedValue),
            limit(1)
          );
          const rawTagSnap = await getDocs(qRawTag);
          if (!rawTagSnap.empty) {
            const dData = rawTagSnap.docs[0].data();
            if (activeSourceType === 'customInventory') {
              foundItem = {
                id: rawTagSnap.docs[0].id,
                name: dData.name,
                brand: dData.brand || '',
                model: dData.model || '',
                category: dData.category || 'Gear',
                assetTag: dData.assetTag || dData.id || rawTagSnap.docs[0].id,
                status: dData.status || 'available',
                condition: dData.condition || 'good',
                isSale: dData.isSale || false,
                price: dData.price || 0,
                quantity: dData.quantity || 1
              } as unknown as GearItem;
            } else {
              foundItem = { id: rawTagSnap.docs[0].id, ...dData } as GearItem;
            }
          }
        }
      }

      if (!foundItem) {
        toast.error("Asset not found in organization database");
        setIsLoading(false);
        return;
      }
      
      // Check status restrictions for checkout
      if (action === 'checkout' && foundItem) {
        const isRestricted = adminSettings?.kioskConfig?.restrictedStatuses?.includes(foundItem.status || 'available');
        if (isRestricted) {
          toast.error(`Status restricted: "${foundItem.name}" is ${foundItem.status}`);
          setIsLoading(false);
          return;
        }
      }

      addToCart(foundItem);
      setStep('review');
    } catch (error) {
      toast.error("Error retrieving asset data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckout = async () => {
    const targetUid = pairedUid || initialUser?.uid;
    if (cart.length === 0 || !targetUid) return;
    setIsLoading(true);
    try {
      const checkoutItems: any[] = [];
      const sigData = sigCanvas.current?.toDataURL() || undefined;
      const nowMs = Date.now();

      for (const { item, qty } of cart) {
        if (!isOnline) {
          const checkoutId = 'checkout_' + nowMs + '_' + Math.random().toString(36).substring(2, 7);
          await offlineSync.queueOperation({
            type: 'set',
            collectionPath: ['checkouts', checkoutId],
            docId: checkoutId,
            data: {
              assetId: item.id,
              assetName: item.name,
              assetType: 'item',
              userId: targetUid,
              userName: guestInfo.name || initialUser?.displayName || 'Terminal Guest',
              userEmail: guestInfo.email || initialUser?.email || 'guest@terminal.local',
              checkOutTime: nowMs,
              status: 'active',
              signature: sigData || null,
              notes: `Bulk checked out via Gear Terminal at ${new Date().toLocaleString()} (Offline)`
            },
            label: `Check-out ${item.name} to ${guestInfo.name || initialUser?.displayName || 'Terminal Guest'} (Offline)`
          });

          const userGearPath = getItemCollectionPath(item.id, targetUid);
          await offlineSync.queueOperation({
            type: 'update',
            collectionPath: userGearPath,
            docId: item.id,
            data: {
              status: 'in_use',
              currentHolder: guestInfo.name || initialUser?.displayName || 'Terminal Guest',
              lastCheckedOut: nowMs
            },
            label: `Update status of ${item.name} to In Use (Offline)`
          });

          if (item.isKit && item.childItemIds?.length) {
            for (const childId of item.childItemIds) {
              const childPath = getItemCollectionPath(childId, targetUid);
              await offlineSync.queueOperation({
                type: 'update',
                collectionPath: childPath,
                docId: childId,
                data: {
                  status: 'in_use',
                  currentHolder: guestInfo.name || initialUser?.displayName || 'Terminal Guest',
                  lastCheckedOut: nowMs,
                  kitId: item.id
                },
                label: `Update kit item ${childId} status to In Use (Offline)`
              });
            }
          }
        } else {
          const checkoutData: any = {
            assetId: item.id,
            assetName: item.name,
            assetType: 'item',
            userId: targetUid,
            userName: guestInfo.name || initialUser?.displayName || 'Terminal Guest',
            userEmail: guestInfo.email || initialUser?.email || 'guest@terminal.local',
            checkOutTime: serverTimestamp(),
            status: 'active',
            signature: sigData || null,
            notes: `Bulk checked out via Gear Terminal at ${new Date().toLocaleString()}`
          };

          await addDoc(collection(db, 'checkouts'), checkoutData);
          
          const userGearRef = getItemDocRef(item.id, targetUid);
          await updateDoc(userGearRef, {
            status: 'in_use',
            currentHolder: guestInfo.name || initialUser?.displayName || 'Terminal Guest',
            lastCheckedOut: serverTimestamp()
          });

          if (item.isKit && item.childItemIds?.length) {
            for (const childId of item.childItemIds) {
              const childRef = getItemDocRef(childId, targetUid);
              await updateDoc(childRef, {
                status: 'in_use',
                currentHolder: guestInfo.name || initialUser?.displayName || 'Terminal Guest',
                lastCheckedOut: serverTimestamp(),
                kitId: item.id
              });
            }
          }
        }

        checkoutItems.push({
          id: item.id,
          name: item.name,
          assetTag: item.assetTag || 'NO-TAG',
          category: item.category || 'Gear',
          qty,
          isKit: item.isKit || false
        });
      }

      if (isOnline && initialUser?.orgId) {
        const itemNames = checkoutItems.map(it => `• ${it.name} [${it.assetTag}]`).join('\n');
        triggerGoogleChatAlert(
          initialUser.orgId,
          'checkout',
          `📤 *Equipment Checked Out*:\n• *Holder*: ${guestInfo.name || initialUser.displayName || 'Terminal Guest'}\n• *Items*:\n${itemNames}`
        ).catch(err => console.warn('Google Chat check out error:', err));
      }

      setLastOrderReceipt({
        orderNumber: `REC-${Math.floor(1000 + Math.random() * 9000)}`,
        userName: guestInfo.name || initialUser?.displayName || 'Terminal Guest',
        userEmail: guestInfo.email || initialUser?.email || 'guest@terminal.local',
        items: checkoutItems,
        createdAt: new Date(),
        actionType: 'checkout'
      });

      if (!isOnline) {
        toast.success(`✓ Bulk check-out queued offline. ${checkoutItems.length} items set to In Use.`);
      }

      setStep('receipt');
    } catch (error) {
      console.error(error);
      toast.error("Bulk check-out failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckin = async () => {
    const targetUid = pairedUid || initialUser?.uid;
    if (cart.length === 0 || !targetUid) return;
    setIsLoading(true);
    try {
      const checkinItems: any[] = [];
      const nowMs = Date.now();
      for (const { item, qty } of cart) {
        if (!isOnline) {
          const checkoutId = 'checkout_' + nowMs + '_' + Math.random().toString(36).substring(2, 7);
          await offlineSync.queueOperation({
            type: 'set',
            collectionPath: ['checkouts', checkoutId],
            docId: checkoutId,
            data: {
              assetId: item.id,
              assetName: item.name,
              assetType: 'item',
              userId: targetUid,
              userName: guestInfo.name || initialUser?.displayName || 'Terminal Guest',
              userEmail: guestInfo.email || initialUser?.email || 'guest@terminal.local',
              checkInTime: nowMs,
              status: 'returned',
              notes: `Checked-in securely via Gear Terminal (Offline bulk)`
            },
            label: `Bulk Check-in ${item.name} (Offline)`
          });

          const userGearPath = getItemCollectionPath(item.id, targetUid);
          await offlineSync.queueOperation({
            type: 'update',
            collectionPath: userGearPath,
            docId: item.id,
            data: {
              status: 'available',
              currentHolder: null,
              lastCheckedIn: nowMs
            },
            label: `Update status of ${item.name} to Available (Offline)`
          });

          if (item.isKit && item.childItemIds?.length) {
            for (const childId of item.childItemIds) {
              const childPath = getItemCollectionPath(childId, targetUid);
              await offlineSync.queueOperation({
                type: 'update',
                collectionPath: childPath,
                docId: childId,
                data: {
                  status: 'available',
                  currentHolder: null,
                  lastCheckedIn: nowMs,
                  kitId: null
                },
                label: `Update kit item ${childId} status to Available (Offline)`
              });
            }
          }
        } else {
          const q = query(
            collection(db, 'checkouts'), 
            where('assetId', '==', item.id), 
            where('status', '==', 'active')
          );
          const snapshot = await getDocs(q);

          if (!snapshot.empty) {
            for (const d of snapshot.docs) {
              await updateDoc(doc(db, 'checkouts', d.id), {
                status: 'returned',
                checkInTime: serverTimestamp()
              });
            }
          }

          const userGearRef = getItemDocRef(item.id, targetUid);
          await updateDoc(userGearRef, {
            status: 'available',
            currentHolder: null,
            lastCheckedIn: serverTimestamp()
          });

          if (item.isKit && item.childItemIds?.length) {
            for (const childId of item.childItemIds) {
              const childRef = getItemDocRef(childId, targetUid);
              await updateDoc(childRef, {
                status: 'available',
                currentHolder: null,
                lastCheckedIn: serverTimestamp(),
                kitId: null
              });
            }
          }
        }

        checkinItems.push({
          id: item.id,
          name: item.name,
          assetTag: item.assetTag || 'NO-TAG',
          category: item.category || 'Gear',
          qty,
          isKit: item.isKit || false
        });
      }

      if (initialUser?.orgId) {
        const itemNames = checkinItems.map(it => `• ${it.name} [${it.assetTag}]`).join('\n');
        triggerGoogleChatAlert(
          initialUser.orgId,
          'checkin',
          `📥 *Equipment Returned (Checked In)*:\n• *From*: ${guestInfo.name || initialUser.displayName || 'Terminal Guest'}\n• *Items*:\n${itemNames}`
        ).catch(err => console.warn('Google Chat check in error:', err));
      }

      setLastOrderReceipt({
        orderNumber: `RET-${Math.floor(1000 + Math.random() * 9000)}`,
        userName: guestInfo.name || initialUser?.displayName || 'Terminal Guest',
        userEmail: guestInfo.email || initialUser?.email || 'guest@terminal.local',
        items: checkinItems,
        createdAt: new Date(),
        actionType: 'checkin'
      });

      setStep('receipt');
    } catch (error) {
      console.error(error);
      toast.error("Bulk check-in failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!lastOrderReceipt) return;
    setIsSendingEmail(true);
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: lastOrderReceipt.userEmail,
          orderNumber: lastOrderReceipt.orderNumber,
          actionType: lastOrderReceipt.actionType,
          userName: lastOrderReceipt.userName,
          items: lastOrderReceipt.items,
          timestamp: lastOrderReceipt.createdAt.toLocaleString()
        })
      });
      const data = await response.json();
      if (data && data.success) {
        setEmailModalData(data);
        setEmailModalOpen(true);
        if (data.simulated) {
          toast.info("Sandbox email simulated & ready for inspection!");
        } else {
          toast.success(`Handover email successfully sent to ${lastOrderReceipt.userEmail}!`);
        }
      } else {
        toast.error("Email API returned an error frame.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Mail route offline. Connecting locally...");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleCreateOrder = async () => {
    const targetUid = pairedUid || initialUser?.uid;
    if (cart.length === 0 || !targetUid) return;
    setIsLoading(true);
    try {
      const orderNumber = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
      const orderItems = cart.map(({ item, qty }) => ({
        id: item.id,
        name: item.name,
        assetTag: item.assetTag || 'NO-TAG',
        category: item.category || 'Gear',
        qty,
        isKit: item.isKit || false
      }));

      // Write order to Firestore db
      await addDoc(collection(db, 'orders'), {
        orderNumber,
        userName: guestInfo.name || 'Terminal Guest',
        userEmail: guestInfo.email || 'guest@terminal.local',
        items: orderItems,
        status: 'pending',
        createdAt: serverTimestamp(),
        userId: targetUid
      });

      setLastOrderReceipt({
        orderNumber,
        userName: guestInfo.name || 'Terminal Guest',
        userEmail: guestInfo.email || 'guest@terminal.local',
        items: orderItems,
        createdAt: new Date(),
        actionType: 'order'
      });

      setStep('receipt');
    } catch (e) {
      console.error(e);
      toast.error("Failed to submit self-service order.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFulfillOrder = async (order: any) => {
    setIsLoading(true);
    try {
      // 1. Mark order as fulfilled
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'fulfilled',
        fulfilledAt: serverTimestamp()
      });

      // 2. Create actual checkout records and update the gear library status with 'in_use' for each item in the order
      for (const item of order.items) {
        await addDoc(collection(db, 'checkouts'), {
          assetId: item.id,
          assetName: item.name,
          assetType: 'item',
          userId: order.userId,
          userName: order.userName,
          userEmail: order.userEmail,
          checkOutTime: serverTimestamp(),
          status: 'active',
          notes: `Checked out via Self-Service Kiosk Order ${order.orderNumber}`
        });

        const userGearRef = doc(db, 'users', order.userId, 'gearLibrary', item.id);
        await updateDoc(userGearRef, {
          status: 'in_use',
          currentHolder: order.userName,
          lastCheckedOut: serverTimestamp()
        });

        // Auto-fulfill kit pieces if any
        const gearItem = gear.find(g => g.id === item.id);
        if (gearItem && gearItem.isKit && gearItem.childItemIds?.length) {
          for (const childId of gearItem.childItemIds) {
            const childRef = doc(db, 'users', order.userId, 'gearLibrary', childId);
            await updateDoc(childRef, {
              status: 'in_use',
              currentHolder: order.userName,
              lastCheckedOut: serverTimestamp(),
              kitId: gearItem.id
            });
          }
        }
      }

      toast.success(`Order ${order.orderNumber} successfully fulfilled and items released!`);
      setIsFulfillDeskOpen(false);
      setActiveFulfillOrder(null);
      setVerifiedItemsMap({});
    } catch (err) {
      console.error("Fulfill order error:", err);
      toast.error("Failed to fulfill the order. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetKiosk = () => {
    setStep('welcome');
    setAction(null);
    setScannedAsset(null);
    setGuestInfo({ name: '', email: '' });
    setSignature(null);
    setCart([]);
    setLastOrderReceipt(null);
  };

  const isFullscreen = window.location.hash.includes('fullscreen=true');

  if (!isFullscreen) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-8 bg-neutral-50 min-h-screen text-neutral-900 font-sans">
        {/* Header Board */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-200 pb-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-black uppercase tracking-tighter text-neutral-900 flex items-center gap-2">
              <QrCode size={32} className="text-[#F27D26]" />
              Kiosk & Scanner Console
            </h1>
            <p className="text-xs text-neutral-550 font-medium leading-relaxed">
              Configure remote terminal behaviors, manage pairing PIN authorization keys, or use your device as an instant auto check-in/out scanner.
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => {
                window.location.hash = '#/kiosk?fullscreen=true';
              }}
              className="px-5 py-3 bg-[#F27D26] hover:bg-[#F27D26]/90 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition flex items-center gap-2 shadow-sm shadow-[#F27D26]/20 cursor-pointer text-center"
            >
              <Lock size={15} />
              Launch Fullscreen Kiosk
            </button>
          </div>
        </header>

        {/* Console Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 bg-neutral-200/50 p-1.5 rounded-2xl w-fit">
          <button
            onClick={() => {
              setAdminTab('hub');
              setIsInstantScannerActive(false);
            }}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-205 cursor-pointer ${
              adminTab === 'hub' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            Kiosk Configuration
          </button>
          <button
            onClick={() => {
              setAdminTab('devices');
              setIsInstantScannerActive(false);
            }}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-205 cursor-pointer ${
              adminTab === 'devices' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            Manage Pairing Keys ({terminalsList.length})
          </button>
          <button
            onClick={() => {
              setAdminTab('scanner');
              setIsInstantScannerActive(true);
            }}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-205 cursor-pointer ${
              adminTab === 'scanner' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            Gear Scanner (Auto-Check)
          </button>
          <button
            onClick={() => {
              setAdminTab('downloads');
              setIsInstantScannerActive(false);
            }}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-205 cursor-pointer flex items-center gap-1.5 ${
              adminTab === 'downloads' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <FileDown size={14} />
            <span>Downloads</span>
          </button>
        </div>

        {/* Tab Content Panels */}
        <AnimatePresence mode="wait">
          {adminTab === 'hub' && (
            <motion.div
              key="tab-hub"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="grid md:grid-cols-3 gap-8"
            >
              <div className="md:col-span-2 bg-white rounded-3xl border border-neutral-200 p-6 sm:p-8 space-y-6 shadow-sm">
                <div className="space-y-1 border-b border-neutral-100 pb-4">
                  <h3 className="text-lg font-black uppercase tracking-tight text-neutral-900">Custom Display Properties</h3>
                  <p className="text-xs text-neutral-455 font-medium">Select exactly what properties should be visible inside the physical checkout terminal screen.</p>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Custom Greeting Welcome Headline</label>
                    <input
                      type="text"
                      value={kioskWelcomeMessage}
                      onChange={(e) => setKioskWelcomeMessage(e.target.value)}
                      placeholder="e.g. Welcome to the Central Gear Depot"
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl p-4 text-xs font-semibold focus:border-[#F27D26] outline-none text-neutral-800 transition"
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4 pt-2">
                    <label className="flex items-center gap-3 p-4 bg-neutral-50 rounded-2xl border border-neutral-150 cursor-pointer hover:bg-neutral-100/50 transition border-solid">
                      <input
                        type="checkbox"
                        checked={showBrandSetting}
                        onChange={(e) => setShowBrandSetting(e.target.checked)}
                        className="accent-[#F27D26] scale-110"
                      />
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wide text-neutral-800 block">Show Brand & Model</span>
                        <span className="text-[10px] text-neutral-400 block mt-0.5 font-medium leading-none">Displays equipment manufacturer details first.</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-4 bg-neutral-50 rounded-2xl border border-neutral-150 cursor-pointer hover:bg-neutral-100/50 transition border-solid">
                      <input
                        type="checkbox"
                        checked={showConditionSetting}
                        onChange={(e) => setShowConditionSetting(e.target.checked)}
                        className="accent-[#F27D26] scale-110"
                      />
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wide text-neutral-800 block">Show Condition Rating</span>
                        <span className="text-[10px] text-neutral-400 block mt-0.5 font-medium leading-none">Embeds condition tags on items.</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-4 bg-neutral-50 rounded-2xl border border-neutral-150 cursor-pointer hover:bg-neutral-100/50 transition border-solid">
                      <input
                        type="checkbox"
                        checked={showHolderSetting}
                        onChange={(e) => setShowHolderSetting(e.target.checked)}
                        className="accent-[#F27D26] scale-110"
                      />
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wide text-neutral-800 block">Show Custody Holder name</span>
                        <span className="text-[10px] text-neutral-400 block mt-0.5 font-medium leading-none">Shows who currently possesses Checked-Out gear.</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-4 bg-neutral-50 rounded-2xl border border-neutral-150 cursor-pointer hover:bg-neutral-100/50 transition border-solid">
                      <input
                        type="checkbox"
                        checked={showCategorySetting}
                        onChange={(e) => setShowCategorySetting(e.target.checked)}
                        className="accent-[#F27D26] scale-110"
                      />
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wide text-neutral-800 block">Show Category Badge</span>
                        <span className="text-[10px] text-neutral-400 block mt-0.5 font-medium leading-none">Organizes items with visual categories.</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-4 bg-neutral-50 rounded-2xl border border-neutral-150 cursor-pointer hover:bg-neutral-100/50 transition border-solid">
                      <input
                        type="checkbox"
                        checked={showQRSetting}
                        onChange={(e) => setShowQRSetting(e.target.checked)}
                        className="accent-[#F27D26] scale-110"
                      />
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wide text-neutral-800 block">Show QR Confirmation</span>
                        <span className="text-[10px] text-neutral-400 block mt-0.5 font-medium leading-none">Embeds dynamic QR validation assets.</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-4 bg-neutral-50 rounded-2xl border border-neutral-150 cursor-pointer hover:bg-neutral-100/50 transition border-solid">
                      <input
                        type="checkbox"
                        checked={showTimestampSetting}
                        onChange={(e) => setShowTimestampSetting(e.target.checked)}
                        className="accent-[#F27D26] scale-110"
                      />
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wide text-neutral-800 block">Show Live Timestamp Clock</span>
                        <span className="text-[10px] text-neutral-400 block mt-0.5 font-medium leading-none">Includes real-time localized clock widgets.</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-neutral-200 p-6 sm:p-8 flex flex-col justify-between shadow-sm space-y-6">
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-[#F27D26]/10 text-[#F27D26] rounded-2xl flex items-center justify-center">
                    <Sliders size={24} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-black uppercase tracking-tight text-neutral-900">Configure Default Kiosk Mode</h3>
                    <p className="text-xs text-neutral-550 leading-relaxed font-semibold">
                      Restrict terminal operations to enforce certain flows in warehouses or fields. For example, checkin-only modes prevent unrecorded gear removals.
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-2">
                    <button
                      onClick={() => {
                        setKioskMode('both');
                        toast.success("Default mode set to Checkout & Checkin!");
                      }}
                      className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        kioskMode === 'both'
                          ? 'border-[#F27D26] bg-[#F27D26]/5 text-[#F27D26]'
                          : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-black uppercase tracking-wide block">Both (Checkout / Check-In)</span>
                        <span className="text-[10px] text-neutral-400 block mt-0.5 font-semibold">Self-service full capability terminal.</span>
                      </div>
                      {kioskMode === 'both' && <CheckSquare size={16} />}
                    </button>

                    <button
                      onClick={() => {
                        setKioskMode('checkout');
                        toast.success("Default mode set to Checkout Only!");
                      }}
                      className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        kioskMode === 'checkout'
                          ? 'border-[#F27D26] bg-[#F27D26]/5 text-[#F27D26]'
                          : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-black uppercase tracking-wide block">Checkout & Order Only</span>
                        <span className="text-[10px] text-neutral-400 block mt-0.5 font-semibold">Disable instant check-ins.</span>
                      </div>
                      {kioskMode === 'checkout' && <CheckSquare size={16} />}
                    </button>

                    <button
                      onClick={() => {
                        setKioskMode('checkin');
                        toast.success("Default mode set to Check-In Only!");
                      }}
                      className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        kioskMode === 'checkin'
                          ? 'border-[#F27D26] bg-[#F27D26]/5 text-[#F27D26]'
                          : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      <div>
                        <span className="text-xs font-black uppercase tracking-wide block">Check-In Focus Only</span>
                        <span className="text-[10px] text-neutral-400 block mt-0.5 font-semibold">Disable checkout & orders.</span>
                      </div>
                      {kioskMode === 'checkin' && <CheckSquare size={16} />}
                    </button>
                  </div>
                </div>

                <div className="bg-neutral-950/5 border border-dashed border-neutral-200 rounded-2xl p-4 text-[11px] text-neutral-500 font-mono text-center">
                  All active parameters are compiled and synced automatically to remote terminals.
                </div>
              </div>
            </motion.div>
          )}

          {adminTab === 'devices' && (
            <motion.div
              key="tab-devices"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-6"
            >
              {/* Device Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-3xl border border-neutral-200 p-6 shadow-sm">
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight text-neutral-955 text-neutral-900">Add & Manage Kiosk Devices</h3>
                  <p className="text-xs text-neutral-400 font-medium">Register standalone android tablets or warehouse devices. Pair using security rotating PIN keys.</p>
                </div>
                <button
                  onClick={() => setShowAddTerminalModal(true)}
                  className="px-5 py-3 bg-[#F27D26] text-white hover:bg-[#F27D05] rounded-2xl text-xs font-black uppercase tracking-widest transition flex items-center gap-2 cursor-pointer"
                >
                  <Plus size={16} />
                  Add Kiosk Device
                </button>
              </div>

              {/* Terminals list Grid */}
              {terminalsList.length === 0 ? (
                <div className="text-center p-16 bg-white border border-neutral-200 rounded-[2rem] space-y-4 shadow-sm">
                  <div className="w-16 h-16 bg-neutral-50 text-neutral-400 rounded-3xl flex items-center justify-center mx-auto border border-neutral-100">
                    <Tv size={32} />
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-sm font-black uppercase tracking-wider text-neutral-800">No Terminals Registered</h4>
                    <p className="text-xs text-neutral-400 max-w-sm mx-auto font-medium leading-relaxed">
                      Add a device tablet above to authorize standalone self-checkout stations without granting full account access.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {terminalsList.map((terminal) => {
                    const statusBadge = terminal.status === 'active' 
                      ? 'bg-green-500/10 text-green-600 border-green-500/20'
                      : 'bg-amber-500/10 text-amber-600 border-amber-500/20';

                    return (
                      <div key={terminal.id} className="bg-white rounded-3xl border border-neutral-200 p-6 flex flex-col justify-between shadow-sm space-y-6">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-0.5 flex-1 mr-2">
                              {editingTerminalId === terminal.id ? (
                                <input
                                  type="text"
                                  defaultValue={terminal.deviceName}
                                  autoFocus
                                  onBlur={async (e) => {
                                    const val = e.target.value.trim();
                                    setEditingTerminalId(null);
                                    if (val && val !== terminal.deviceName) {
                                      try {
                                        await updateDoc(doc(db, 'terminals', terminal.id), { deviceName: val });
                                        toast.success(`Kiosk name updated to "${val}"`);
                                      } catch (err) {
                                        toast.error("Failed to update Kiosk name");
                                      }
                                    }
                                  }}
                                  onKeyDown={async (e) => {
                                    if (e.key === 'Enter') {
                                      const val = (e.target as HTMLInputElement).value.trim();
                                      setEditingTerminalId(null);
                                      if (val && val !== terminal.deviceName) {
                                        try {
                                          await updateDoc(doc(db, 'terminals', terminal.id), { deviceName: val });
                                          toast.success(`Kiosk name updated to "${val}"`);
                                        } catch (err) {
                                          toast.error("Failed to update Kiosk name");
                                        }
                                      }
                                    } else if (e.key === 'Escape') {
                                      setEditingTerminalId(null);
                                    }
                                  }}
                                  className="text-sm font-black uppercase tracking-wide text-neutral-900 border-b border-neutral-300 focus:outline-none focus:border-neutral-500 bg-transparent py-0 w-full"
                                />
                              ) : (
                                <h4 
                                  onDoubleClick={() => setEditingTerminalId(terminal.id)}
                                  title="Double click to edit custom Kiosk label"
                                  className="text-sm font-black uppercase tracking-wide text-neutral-900 cursor-pointer hover:opacity-80 transition flex items-center gap-1 group/label"
                                >
                                  <span>{terminal.deviceName}</span>
                                  <Pencil size={11} className="text-neutral-300 group-hover/label:text-neutral-500 transition-colors shrink-0 ml-1" />
                                </h4>
                              )}
                              <p className="text-[10px] text-neutral-400 font-mono uppercase tracking-widest font-bold">Terminal ID: {terminal.id.substring(0, 8)}</p>
                            </div>
                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border leading-none ${statusBadge}`}>
                              {terminal.status}
                            </span>
                          </div>

                          <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-150 space-y-3">
                            <div className="flex justify-between items-center text-[10px] uppercase font-black text-neutral-400">
                              <span>Default Mode:</span>
                              <span className="text-neutral-850 font-mono font-black mt-0.5 uppercase">{terminal.settings?.mode || 'both'}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] uppercase font-black text-neutral-400">
                              <span>Last Touch Sync:</span>
                              <span className="text-neutral-850 font-mono font-black mt-0.5">
                                {terminal.lastActive ? new Date(terminal.lastActive).toLocaleDateString() : 'Pending Pairing'}
                              </span>
                            </div>
                          </div>

                          {terminal.status === 'pending' && (
                            <div className="bg-amber-50/50 border border-dashed border-amber-200 rounded-2xl p-4 text-center space-y-1">
                              <span className="text-[10px] font-black uppercase tracking-widest text-[#F27D26] block">Terminal Pairing Pin Key</span>
                              <span className="text-2xl font-mono font-black tracking-widest text-neutral-800 block">{terminal.pairingCode}</span>
                              <span className="text-[9px] text-amber-600/85 leading-normal block pt-1 font-semibold select-all">
                                Enter this verification number on your new station panel to complete secure handshake activation.
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 border-t border-neutral-100 pt-4">
                          <button
                            onClick={() => handleRegeneratePin(terminal.id, terminal.deviceName)}
                            className="flex-1 py-2.5 bg-neutral-50 border border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer"
                          >
                            Regen PIN
                          </button>
                          <button
                            onClick={() => handleRevokeTerminal(terminal.id, terminal.deviceName)}
                            className="px-3.5 py-2.5 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer"
                          >
                            Revoke
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {adminTab === 'scanner' && (
            <motion.div
              key="tab-scanner"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="grid lg:grid-cols-12 gap-8"
            >
              {/* Scanner Interface */}
              <div className="lg:col-span-7 bg-white rounded-[2rem] border border-neutral-200 p-6 sm:p-8 space-y-6 shadow-sm">
                <div className="space-y-1 border-b border-neutral-100 pb-4 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h3 className="text-base font-black uppercase tracking-tight text-neutral-900">Auto Scan State Machine</h3>
                    <p className="text-xs text-neutral-450 font-medium">Scanned gear moves available tags directly into 'in_use' and back!</p>
                  </div>
                  
                  {/* Start/Stop Camera Feed */}
                  <button
                    onClick={() => {
                      setIsInstantScannerActive(!isInstantScannerActive);
                      if (!isInstantScannerActive) {
                        toast.success("Ready to receive scans!");
                      }
                    }}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                      isInstantScannerActive 
                        ? 'bg-rose-50 border border-rose-250 text-rose-600 hover:bg-rose-100' 
                        : 'bg-[#F27D26]/10 text-[#F27D26] hover:bg-[#F27D26]/20'
                    }`}
                  >
                    <Scan size={14} />
                    {isInstantScannerActive ? 'Disconnect Scan Stream' : 'Activate Scan Stream'}
                  </button>
                </div>

                {/* Live Scanner Placeholder/Viewport */}
                <div className="relative aspect-video rounded-2xl bg-neutral-950 overflow-hidden border border-neutral-300 m-auto max-w-lg flex flex-col justify-center items-center text-center">
                  {isInstantScannerActive ? (
                    cameraAccessError ? (
                      <div className="p-4 text-center max-w-md mx-auto space-y-3 text-neutral-200">
                        <div className="w-8 h-8 rounded-full bg-rose-900/20 text-rose-500 font-extrabold flex items-center justify-center mx-auto text-sm">
                          ⚠️
                        </div>
                        <div className="space-y-1 text-xs text-rose-300">
                          <h5 className="font-extrabold uppercase tracking-wider text-[10px]">IFrame Camera Restricted</h5>
                          <p className="normal-case leading-relaxed font-sans text-[10px] text-neutral-400">
                            The sandboxed preview iframe blocked browser camera permissions (<code className="font-mono bg-neutral-900 px-1 py-0.5 rounded text-neutral-300 text-[9px]">{cameraAccessError}</code>).
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0 justify-center">
                          <button
                            onClick={() => {
                              window.open(window.location.origin + window.location.pathname + window.location.hash, '_blank');
                            }}
                            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition cursor-pointer"
                          >
                            Open in New Tab
                          </button>
                          <button
                            onClick={() => {
                              setCameraAccessError(null);
                              setIsInstantScannerActive(false);
                            }}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition cursor-pointer"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div id="gear-instant-scanner" className="w-full h-full object-cover relative select-none" />
                    )
                  ) : (
                    <div className="p-6 space-y-4">
                      <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mx-auto text-neutral-400">
                        <Scan size={28} />
                      </div>
                      <div className="space-y-2">
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-300 block">Video Feed Blocked</span>
                        <p className="text-[10px] text-neutral-500 leading-relaxed font-semibold uppercase font-mono max-w-xs">
                          Click 'Activate Scan Stream' above to bind cameras for high-frequency scanner operations.
                        </p>
                      </div>
                    </div>
                  )}
                  {isInstantScannerActive && !cameraAccessError && (
                    <div className="absolute inset-0 border-2 border-[#F27D26]/20 pointer-events-none flex items-center justify-center">
                      <div className="w-56 h-56 border-2 border-dashed border-[#F27D26]/60 rounded-3xl animate-pulse" />
                    </div>
                  )}
                </div>

                {/* Configurations parameters: Default Checkout Assignee User */}
                <div className="grid sm:grid-cols-2 gap-4 bg-neutral-50 p-4 rounded-2xl border border-neutral-150">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#555] block">Recipient/Assignee Name</label>
                    <input
                      type="text"
                      value={scannerAssignee}
                      onChange={(e) => setScannerAssignee(e.target.value)}
                      placeholder="e.g. John Doe, Production Crew A"
                      className="w-full bg-white border border-neutral-200 rounded-xl p-3 text-xs font-bold uppercase tracking-wide text-neutral-800 outline-none focus:border-[#F27D26]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#555] block">Recipient Email (Optional)</label>
                    <input
                      type="text"
                      value={scannerAssigneeEmail}
                      onChange={(e) => setScannerAssigneeEmail(e.target.value)}
                      placeholder="e.g. pilot@agency-group.com"
                      className="w-full bg-white border border-neutral-200 rounded-xl p-3 text-xs font-semibold text-neutral-800 outline-none focus:border-[#F27D26]"
                    />
                  </div>
                </div>

                {/* Manual tag lookup backup input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (instantManualInput.trim()) {
                      processAutoCheckInOut(instantManualInput);
                      setInstantManualInput('');
                    }
                  }}
                  className="space-y-1.5 pt-2"
                >
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Or Manually Enter Asset Tag Code</label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={instantManualInput}
                      onChange={(e) => setInstantManualInput(e.target.value)}
                      placeholder="Type asset code (e.g. CAM-012) and press Enter"
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl py-3.5 pl-4 pr-32 text-xs font-bold outline-none focus:border-[#F27D26] text-neutral-800 transition"
                    />
                    <button
                      type="submit"
                      className="absolute right-2 px-4 py-2 bg-[#F27D26] hover:bg-[#F27D15] text-white text-[10px] font-black uppercase tracking-wide rounded-lg cursor-pointer transition"
                    >
                      Process Input
                    </button>
                  </div>
                </form>
              </div>

              {/* Chronological Scan Entries logs */}
              <div className="lg:col-span-5 bg-white rounded-[2rem] border border-neutral-200 p-6 sm:p-8 flex flex-col shadow-sm h-[600px]">
                <div className="border-b border-neutral-100 pb-4 mb-4 shrink-0">
                  <h3 className="text-base font-black uppercase tracking-tight text-neutral-900">Session Operations Log</h3>
                  <p className="text-xs text-neutral-450 font-medium">Automatic transitions tracked in the current active session.</p>
                </div>

                <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                  {autoScanLogs.length === 0 ? (
                    <div className="h-full flex flex-col justify-center items-center text-center p-6 text-neutral-400">
                      <div className="w-12 h-12 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-center mb-3">
                        <Clock size={20} />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">Scan Session Empty</span>
                      <p className="text-[10px] text-neutral-400 leading-normal max-w-sm block mt-1 uppercase font-semibold font-mono">
                        Awaiting automatic check-ins or custody dispatches...
                      </p>
                    </div>
                  ) : (
                    autoScanLogs.map((log) => {
                      const isReturn = log.action === 'in';
                      return (
                        <div key={log.id} className="p-3 bg-neutral-50 rounded-2xl border border-neutral-150 flex justify-between items-start border-solid">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border leading-none ${
                                isReturn 
                                  ? 'bg-green-500/10 text-green-700 border-green-500/20' 
                                  : 'bg-blue-500/10 text-blue-700 border-blue-500/20'
                              }`}>
                                {isReturn ? 'AUTO IN' : 'AUTO OUT'}
                              </span>
                              <span className="text-[9px] font-mono font-black text-neutral-400">
                                {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                            </div>
                            <h4 className="text-xs font-black uppercase tracking-tight text-neutral-800 leading-snug">
                              {log.brand ? `${log.brand} ` : ''}{log.itemName}
                            </h4>
                            <p className="text-[10px] text-neutral-450 font-semibold uppercase tracking-wide leading-none">
                              {isReturn ? 'Safely returned to inventory' : `Signed out to ${log.assignee}`}
                            </p>
                          </div>
                          <span className="text-[9px] font-mono bg-neutral-200 text-neutral-600 px-2 py-0.5 rounded font-black mt-1 uppercase leading-none">
                            {log.assetTag}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {adminTab === 'downloads' && (
            <motion.div
              key="tab-downloads"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="grid lg:grid-cols-12 gap-8 text-neutral-900 animate-fadeIn"
            >
              {/* Launcher Card */}
              <div className="lg:col-span-7 bg-white rounded-[2rem] border border-neutral-200 p-6 sm:p-8 space-y-6 shadow-sm">
                <div className="space-y-1 border-b border-neutral-100 pb-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F27D26]/10 text-[#F27D26] rounded-full text-[10px] font-black uppercase tracking-widest mb-2">
                    <Sparkles size={11} className="animate-pulse" />
                    <span>Next-Gen Enterprise scanning</span>
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tight text-neutral-900">Packer Tools Dedicated Scanner App</h3>
                  <p className="text-sm text-neutral-500 font-medium font-sans">
                    Convert any iOS or Android smartphone into a dedicated full-screen barcode & QR code scanning terminal.
                  </p>
                </div>

                <div className="space-y-4 text-xs font-semibold leading-relaxed text-neutral-500 uppercase">
                  <p className="font-sans normal-case leading-relaxed text-neutral-500">
                    Unlike default web dashboards, the **Packer Tools Scanner App** is a specialized, light-weight, high-frequency scan terminal client. When launched as an installed Progressive Web App (PWA):
                  </p>
                  
                  <ul className="space-y-2 border-l-2 border-neutral-200 pl-4 py-1">
                    <li className="flex items-start gap-2 normal-case font-sans">
                      <Check size={14} className="text-[#F27D26] shrink-0 mt-0.5" />
                      <span>**Distraction Free Layout**: Completely strips standard app menus, wrappers, sidebars and headers for a pristine native utility appearance.</span>
                    </li>
                    <li className="flex items-start gap-2 normal-case font-sans">
                      <Check size={14} className="text-[#F27D26] shrink-0 mt-0.5" />
                      <span>**Integrated single Sign-On (SSO)**: Operates securely on behalf of your standard logged-in user profile.</span>
                    </li>
                    <li className="flex items-start gap-2 normal-case font-sans">
                      <Check size={14} className="text-[#F27D26] shrink-0 mt-0.5" />
                      <span>**Acoustic Synthesizer feedback**: Emits high-quality audio chirps and buzzing status cues to prevent visual lookup fatigue in rugged field/warehouse spaces.</span>
                    </li>
                  </ul>

                  <div className="bg-neutral-50 border border-neutral-150 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 border-solid">
                    <div className="text-center md:text-left font-sans normal-case">
                      <h4 className="font-black uppercase text-neutral-800 tracking-wider text-[11px]">Instant Desktop Sandbox</h4>
                      <p className="text-[10px] text-neutral-450 leading-relaxed font-semibold uppercase font-mono mt-0.5">Test drive the mobile scanner module inside your current screen layout</p>
                    </div>
                    <button
                      onClick={() => {
                        window.location.hash = '#/kiosk?scannerApp=true&hideLayout=true';
                        playScanChime('double');
                      }}
                      className="px-5 py-3 bg-[#F27D26] hover:bg-[#F27D15] text-white text-xs font-black uppercase tracking-widest rounded-xl transition flex items-center justify-center gap-1.5 shrink-0 shadow-md shadow-[#F27D26]/20 cursor-pointer text-center"
                    >
                      <Scan size={14} />
                      <span>Launch Preview Mode</span>
                    </button>
                  </div>
                </div>

                {/* Progressive Web App Install Instruction grid */}
                <div className="border-t border-neutral-100 pt-6 space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wide text-neutral-900 flex items-center gap-2">
                    <Smartphone size={16} className="text-neutral-500" />
                    How to Download & Save to Home Screen
                  </h4>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="bg-neutral-50 border border-neutral-150 p-4 rounded-2xl space-y-2 border-solid">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">🍏</span>
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-800">Apple iOS Guide (Safari)</span>
                      </div>
                      <ol className="text-[10px] leading-relaxed text-neutral-500 list-decimal pl-4 font-semibold uppercase font-sans space-y-1">
                        <li>Scan the on-screen QR code to open the launcher link in Safari</li>
                        <li>Tap the **"Share"** icon (square with arrow) on bottom navbar</li>
                        <li>Scroll down and select **"Add to Home Screen"** option</li>
                        <li>Give it a title (e.g. Packer Scanner) and tap **"Add"**!</li>
                      </ol>
                    </div>

                    <div className="bg-neutral-50 border border-neutral-150 p-4 rounded-2xl space-y-2 border-solid">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">🤖</span>
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-800">Android Guide (Chrome)</span>
                      </div>
                      <ol className="text-[10px] leading-relaxed text-neutral-500 list-decimal pl-4 font-semibold uppercase font-sans space-y-1">
                        <li>Scan the on-screen QR code to load the app inside Chrome</li>
                        <li>Tap the **3-dots menu** on Chrome's upper title bar</li>
                        <li>Select **"Install App"** / **"Add to Home Screen"** option</li>
                        <li>Confirm the Google Chrome popup to finish installing!</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>

              {/* QR Code and install box */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                {/* Visual Phone Frame with QR Code */}
                <div className="bg-neutral-900 text-white rounded-[2rem] p-6 text-center space-y-6 flex flex-col items-center justify-between border border-neutral-800 shadow-md relative overflow-hidden min-h-[440px] border-solid">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[#F27D26]/10 rounded-full blur-3xl pointer-events-none" />
                  
                  <div className="space-y-1">
                    <h3 className="text-lg font-black uppercase tracking-tighter text-white leading-none">Instant Handheld QR Pairing</h3>
                    <p className="text-neutral-550 text-[9px] font-black uppercase tracking-widest block pt-1">Scan using phone camera to pair and install</p>
                  </div>

                  {/* QR Code Canvas */}
                  <div className="bg-white p-4.5 rounded-3xl border-4 border-solid border-neutral-800 shadow-xl inline-block">
                    <QRCodeCanvas
                      value={`${window.location.protocol}//${window.location.host}${window.location.pathname}#/kiosk?scannerApp=true&hideLayout=true`}
                      size={175}
                      level="H"
                      includeMargin={false}
                    />
                  </div>

                  <div className="space-y-2 bg-black/40 p-3.5 rounded-2xl border border-white/5 w-full text-left font-mono text-[9px] border-solid">
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-550 uppercase font-bold">Target PWA URL:</span>
                      <span className="text-neutral-200 font-bold max-w-[150px] truncate leading-none">
                        {window.location.host}/#/kiosk
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-550 uppercase font-bold">Query Flag:</span>
                      <span className="text-amber-500 font-extrabold uppercase flex items-center leading-none">
                        scannerApp=true
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-550 uppercase font-bold">Layout Layer:</span>
                      <span className="text-emerald-500 font-extrabold uppercase flex items-center leading-none">
                        hideLayout=true
                      </span>
                    </div>
                  </div>

                  {deferredInstallPrompt && (
                    <button
                      onClick={triggerPwaInstall}
                      className="w-full py-3 bg-white hover:bg-neutral-200 text-neutral-900 font-black text-xs uppercase tracking-widest rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Smartphone size={14} />
                      <span>Install App Prompt</span>
                    </button>
                  )}
                </div>

                {/* Additional tips card */}
                <div className="bg-white border border-neutral-200 rounded-[2rem] p-6 space-y-3.5 shadow-sm border-solid">
                  <h4 className="text-xs font-black uppercase tracking-wide text-neutral-900 flex items-center gap-1.5">
                    <Volume2 size={16} className="text-neutral-400 font-black animate-pulse" />
                    Operator Audio Tuning
                  </h4>
                  <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide leading-relaxed font-sans normal-case">
                    The handheld PWA includes high-performance synthesizers to duplicate industrial laser gun audio alerts. Ensure your device sound bell ring is unmuted to receive real-time checkout success sound indicators.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal: Register New Kiosk device */}
        <AnimatePresence>
          {showAddTerminalModal && (
            <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-md flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-md w-full bg-white rounded-3xl border border-neutral-200 p-6 sm:p-8 space-y-6 shadow-2xl text-neutral-900"
              >
                <div className="flex justify-between items-center border-b border-neutral-100 pb-4">
                  <h3 className="text-lg font-black uppercase tracking-tight text-neutral-900">Add Kiosk Station</h3>
                  <button
                    onClick={() => setShowAddTerminalModal(false)}
                    className="p-1.5 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-neutral-600 hover:text-neutral-900 transition cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                <form onSubmit={handleAddNewTerminal} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Terminal Location / Device Label</label>
                    <input
                      type="text"
                      required
                      value={newTerminalName}
                      onChange={(e) => setNewTerminalName(e.target.value)}
                      placeholder="e.g. South Warehouse Tablet B"
                      className="w-full bg-neutral-50 border border-neutral-250 rounded-2xl p-4 text-xs font-semibold text-neutral-800 outline-none focus:border-[#F27D26]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#F27D26]">Initial Default Operational Mode</label>
                    <select
                      value={newTerminalMode}
                      onChange={(e) => setNewTerminalMode(e.target.value as any)}
                      className="w-full bg-neutral-50 border border-neutral-250 rounded-2xl p-4 text-xs font-semibold uppercase tracking-wider text-neutral-800 outline-none"
                    >
                      <option value="both">Both (Checkout & Check-In)</option>
                      <option value="checkout">Checkout Only</option>
                      <option value="checkin">Check-In Only</option>
                    </select>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowAddTerminalModal(false)}
                      className="flex-1 py-3 border border-neutral-200 hover:bg-neutral-50 text-neutral-600 rounded-2xl text-xs font-black uppercase tracking-widest transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-4 bg-[#F27D26] hover:bg-[#F27D26]/95 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition cursor-pointer"
                    >
                      Create Pin Key
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (isScannerApp) {
    if (!initialUser) {
      return (
        <div className="min-h-screen bg-[#0D0D0D] text-white flex flex-col justify-center items-center p-6 font-sans">
          <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 p-8 rounded-[2rem] text-center space-y-6 shadow-2xl relative overflow-hidden border-solid">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#F27D26]/5 rounded-full blur-3xl" />
            
            <div className="w-16 h-16 bg-[#F27D26]/10 text-[#F27D26] rounded-2xl flex items-center justify-center mx-auto border border-[#F27D26]/20">
              <Scan size={32} className="animate-pulse" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black uppercase tracking-tight text-white">Packer Tools</h2>
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#F27D26]">Dedicated Scanner App</h3>
              <p className="text-xs text-neutral-400 leading-relaxed font-sans normal-case pt-2">
                This is a secure enterprise scanning client. Authorized operators must sign in with their corporate credentials to begin tracking custody, auditing dispatches, or checking gear.
              </p>
            </div>

            <button
              onClick={async () => {
                try {
                  await signInWithGoogle();
                } catch (e) {
                  toast.error("Google Authentication authentication failed.");
                }
              }}
              className="w-full py-4 bg-[#F27D26] hover:bg-[#F27D15] text-white rounded-2xl text-xs font-black uppercase tracking-widest transition shadow-lg shadow-[#F27D26]/20 flex items-center justify-center gap-2 cursor-pointer border-none"
            >
              <User size={16} />
              <span>Operator Authenticate</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#0D0D0D] text-white flex flex-col font-sans select-none overflow-x-hidden">
        {/* PWA App Titlebar */}
        <header className="px-5 py-4 bg-neutral-950 border-b border-neutral-850 flex items-center justify-between shrink-0 border-solid">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#F27D26]/10 border border-[#F27D26]/20 flex items-center justify-center shrink-0">
              <Scan size={18} className="text-[#F27D26]" />
            </div>
            <div>
              <h1 className="text-xs font-black uppercase tracking-wider text-white leading-none">Packer Scanner</h1>
              <span className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest block pt-0.5">Standalone Handheld</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end text-right font-mono text-[9px] mr-1">
              <span className="text-neutral-300 font-bold uppercase truncate max-w-[120px]">{initialUser.displayName}</span>
              <span className="text-neutral-500 font-medium truncate max-w-[120px]">{initialUser.email}</span>
            </div>
            
            <button
              onClick={() => {
                window.location.hash = '#/kiosk';
                setIsScannerApp(false);
              }}
              className="px-3 py-1.5 bg-neutral-900 border border-neutral-800 hover:bg-[#F27D15] hover:text-white hover:border-[#F27D15] rounded-xl text-[9px] font-black uppercase tracking-wider transition cursor-pointer text-center"
            >
              Exit PWA
            </button>
          </div>
        </header>

        {/* Core content grid */}
        <main className="flex-1 p-4 md:p-6 max-w-lg mx-auto w-full flex flex-col justify-start gap-4 h-full overflow-y-auto">
          {/* Scanning Mode toggle */}
          <div className="bg-neutral-950 border border-neutral-850 p-1 rounded-2xl flex gap-1 border-solid shrink-0">
            {(['checkout', 'checkin', 'lookup'] as const).map((mode) => {
              const label = mode === 'checkout' ? 'Check OUT' : mode === 'checkin' ? 'Check IN' : 'L-up Spec';
              const activeBg = mode === 'checkout' 
                ? 'bg-blue-600 text-white font-extrabold' 
                : mode === 'checkin' 
                  ? 'bg-green-600 text-white font-extrabold' 
                  : 'bg-neutral-800 text-white font-extrabold';
              
              return (
                <button
                  key={mode}
                  onClick={() => {
                    setPwaMode(mode);
                    playScanChime('double');
                  }}
                  className={`flex-1 py-3.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer border-none ${
                    pwaMode === mode ? activeBg : 'text-neutral-500 hover:text-neutral-300 bg-transparent'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Scanner view port */}
          <div className="bg-neutral-950 border border-neutral-850 rounded-[2rem] p-5 text-center flex flex-col items-center justify-center gap-4 border-solid min-h-[355px] relative overflow-hidden shrink-0">
            <div className="absolute top-2 left-3 flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${pwaScannerActive ? 'bg-red-500 animate-pulse' : 'bg-neutral-600'}`} />
              <span className="text-[8px] font-mono text-neutral-500 uppercase font-bold tracking-widest leading-none">
                {pwaScannerActive ? 'Camera Live' : 'Camera Standby'}
              </span>
            </div>

            {pwaScannerActive ? (
              cameraAccessError ? (
                <div className="w-full relative shrink-0">
                  <div className="p-5 text-center bg-rose-950/20 border border-rose-800/40 rounded-2xl max-w-md mx-auto space-y-3.5 my-2 animate-fadeIn text-neutral-200">
                    <div className="w-10 h-10 rounded-full bg-rose-900/20 text-rose-500 font-extrabold flex items-center justify-center mx-auto">
                      ⚠️
                    </div>
                    <div className="space-y-1.5 text-xs text-rose-300">
                      <h5 className="font-extrabold uppercase tracking-wider">Browser Blocked Camera Permissions</h5>
                      <p className="normal-case leading-relaxed font-sans font-medium text-neutral-350">
                        The browser rejected access to the camera system (specifically: <code className="font-mono bg-neutral-900 px-1 py-0.5 rounded text-neutral-200">{cameraAccessError}</code>).
                      </p>
                    </div>
                    <div className="space-y-2 text-[11px] font-sans normal-case text-neutral-450 text-left bg-neutral-950/40 p-3.5 rounded-xl border border-neutral-850">
                      <p className="font-black text-rose-300 uppercase text-[9px] tracking-wider mb-1">💡 Troubleshooting Steps:</p>
                      <ul className="list-disc pl-4 space-y-1 text-xs text-neutral-300">
                        <li>
                          <strong>Open in New Tab:</strong> Sandboxed iframes block native camera hooks. Press <strong>"Open in New Tab"</strong> or copy-paste the URL above directly.
                        </li>
                        <li>
                          <strong>Browser Permission Bar:</strong> Check address bar padlock icon or settings cog to grant <strong>Camera streams and access</strong> toggle.
                        </li>
                        <li>
                          <strong>Force Reload:</strong> Refresh browser page state once camera permission is authorized.
                        </li>
                      </ul>
                    </div>
                    <div className="flex gap-2.5 pt-1.5 shrink-0 justify-center">
                      <button
                        onClick={() => {
                          window.open(window.location.origin + window.location.pathname + window.location.hash, '_blank');
                        }}
                        className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer"
                      >
                        Open in New Tab
                      </button>
                      <button
                        onClick={() => {
                          setCameraAccessError(null);
                          setPwaScannerActive(false);
                        }}
                        className="px-4 py-2 bg-rose-600 hover:bg-[#F27D26] text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full relative shrink-0">
                  {/* Visual Viewfinder bracket overlay */}
                  <div className="absolute inset-0 pointer-events-none z-10 p-8">
                    <div className="w-full h-full border-2 border-dashed border-[#F27D26]/40 rounded-3xl relative">
                      {/* Laser line effect */}
                      <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500/80 shadow-md shadow-red-500 animate-bounce" />
                    </div>
                  </div>

                  <div 
                    id="pwa-scanner-viewport" 
                    className="w-full aspect-square max-w-[285px] mx-auto rounded-3xl overflow-hidden border border-neutral-800 bg-black relative"
                  />

                  <button
                    onClick={() => {
                      setPwaScannerActive(false);
                      playScanChime('error');
                    }}
                    className="mt-4 px-6 py-2.5 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/20 text-[10px] font-black uppercase tracking-widest rounded-xl transition cursor-pointer"
                  >
                    Stop Camera
                  </button>
                </div>
              )
            ) : (
              <div className="space-y-6 py-4 flex flex-col items-center">
                <div className="w-20 h-20 bg-neutral-905 border border-neutral-800 rounded-3xl flex items-center justify-center relative">
                  <Scan size={36} className="text-neutral-600 animate-pulse" />
                </div>
                
                <div className="space-y-1.5 max-w-xs mx-auto">
                  <h4 className="text-xs font-black uppercase tracking-widest text-neutral-400">Camera Lens Offline</h4>
                  <p className="text-[10px] text-neutral-550 leading-relaxed font-semibold uppercase font-sans normal-case">
                    Arm your host handset camera stream to scan equipment asset barcode symbols.
                  </p>
                </div>

                <div className="flex flex-col gap-2 w-full max-w-xs">
                  <button
                    onClick={() => {
                      setPwaScannerActive(true);
                      playScanChime('double');
                    }}
                    className="w-full py-4 bg-[#F27D26] hover:bg-[#F27D15] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition flex items-center justify-center gap-2 cursor-pointer border-none shadow-lg shadow-[#F27D26]/10"
                  >
                    <Scan size={14} />
                    <span>Start Scanner Lens</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Fallback code inputs */}
          <div className="bg-neutral-950 border border-neutral-850 p-4.5 rounded-[2rem] space-y-3.5 border-solid shrink-0">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-[#F27D26] leading-none">Damaged Serial/Barcode Fallback</h4>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const v = pwaManualInput.trim();
                if (v) {
                  setPwaManualInput('');
                  playScanChime('success');
                  await handlePwaScan(v);
                }
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={pwaManualInput}
                onChange={(e) => setPwaManualInput(e.target.value)}
                placeholder="INPUT BARCODE OR ID NUM..."
                className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-xs font-mono font-bold text-white uppercase outline-none focus:border-[#F27D26]"
              />
              <button
                type="submit"
                className="px-5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer border-none"
              >
                Send
              </button>
            </form>
          </div>

          {/* Last item scanned panel card */}
          {pwaLatestScannedItem && (
            <div className="bg-neutral-950 border border-[#F27D26]/30 p-5 rounded-[2rem] space-y-3.5 border-solid shrink-0 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-neutral-850 pb-3">
                <span className="text-[9px] font-mono font-black text-neutral-500 uppercase tracking-widest">Active Scan Focus</span>
                <span className="text-[9px] font-mono px-2 py-0.5 bg-neutral-900 rounded border border-neutral-800 text-neutral-300 font-bold uppercase">
                  {pwaLatestScannedItem.assetTag || 'NO TAG'}
                </span>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0">
                  <Package size={22} className="text-[#F27D26]" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-tight text-white leading-tight">{pwaLatestScannedItem.brand ? `${pwaLatestScannedItem.brand} ` : ''}{pwaLatestScannedItem.name}</h3>
                  <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2 font-mono text-[9px] text-neutral-450 uppercase font-semibold">
                    <span>Cond: <span className="text-white font-black">{pwaLatestScannedItem.condition || 'good'}</span></span>
                    <span>Status: <span className="text-white font-black">{pwaLatestScannedItem.status}</span></span>
                    {pwaLatestScannedItem.currentHolder && (
                      <span>Holder: <span className="text-white font-bold">{pwaLatestScannedItem.currentHolder}</span></span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Operations session Logs */}
          <div className="bg-neutral-950 border border-neutral-850 rounded-[2rem] p-5 flex flex-col h-[320px] border-solid shrink-0">
            <div className="border-b border-neutral-850 pb-3 mb-3 flex items-center justify-between shrink-0">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[#F27D26] leading-none">Session Audit Stream</h4>
              <span className="text-[9px] bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800 text-neutral-500 font-mono font-bold uppercase leading-none">
                {pwaSessionLogs.length} LOGS
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs">
              {pwaSessionLogs.length === 0 ? (
                <div className="h-full flex flex-col justify-center items-center text-center text-neutral-600 shrink-0">
                  <Clock size={20} className="mb-2" />
                  <span className="text-[9px] font-mono font-black uppercase tracking-wider">Awaiting dynamic scans...</span>
                </div>
              ) : (
                pwaSessionLogs.map((log) => {
                  const isIn = log.action === 'in';
                  const isOut = log.action === 'out';
                  const badge = isIn 
                    ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                    : isOut 
                      ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' 
                      : 'bg-neutral-800 text-neutral-400 border-neutral-705';

                  return (
                    <div key={log.id} className="p-3 bg-neutral-900/60 rounded-xl border border-neutral-850 flex justify-between items-start border-solid">
                      <div className="space-y-1 leading-none">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-wider border leading-none ${badge}`}>
                            {log.action.toUpperCase()}
                          </span>
                          <span className="text-[8px] font-mono text-neutral-550">
                            {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        <h5 className="text-[10px] font-black uppercase tracking-tight text-white leading-tight mt-1">{log.brand ? `${log.brand} ` : ''}{log.itemName}</h5>
                        {isOut && log.assignee && (
                          <span className="text-[8px] text-neutral-400 font-bold block capitalize pt-0.5">Signed out to: <span className="text-white">{log.assignee}</span></span>
                        )}
                      </div>
                      <span className="text-[7.5px] font-mono bg-neutral-950 px-1.5 py-0.5 rounded text-neutral-450 border border-neutral-850 font-bold uppercase leading-none">
                        {log.assetTag}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex flex-col font-sans select-none md:overflow-hidden overflow-y-auto md:touch-none touch-auto relative">
      {/* Secret Escape Area */}
      <div 
        onClick={handleEscapeTap}
        className="absolute bottom-0 left-0 w-24 h-24 z-[9999] opacity-0 active:bg-white/5 cursor-pointer"
      />
      
      {/* Kiosk Header */}
      <header className="p-4 md:p-8 flex items-center justify-between border-b border-white/5 bg-black/20 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3 md:gap-6">
          <div className="w-10 h-10 md:w-16 md:h-16 flex items-center justify-center rounded-xl md:rounded-2xl overflow-hidden bg-[#0D0D0D] border border-neutral-800">
            <PackerLogo variant="symbol-only" size={32} className="md:hidden" />
            <PackerLogo variant="symbol-only" size={54} className="hidden md:block" />
          </div>
          <div>
            <h1 className="text-xl md:text-4xl font-black uppercase tracking-tighter leading-none">Gear Terminal</h1>
            <p className="text-[10px] md:text-xs text-neutral-500 font-bold uppercase tracking-widest mt-0.5 md:mt-1">
              {adminSettings?.branding?.companyName || 'PackerTools.AI'} • {activeSourceType === 'customInventory' ? 'Custom List Context' : 'Central Gear catalog'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 md:gap-6">
          {!isOnline && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl text-xs font-black uppercase tracking-widest animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
              Offline
              {offlineQueue.length > 0 && ` (${offlineQueue.length} Queued)`}
            </div>
          )}
          {isActivated && (
            <button
              onClick={() => setStep('configure')}
              className="p-3 bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white rounded-xl transition border border-white/5"
              title="Configure Terminal Context"
            >
              <Settings size={20} />
            </button>
          )}
          <div className="text-right">
            <div className="text-xl md:text-4xl font-mono font-black tabular-nums">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-[8px] md:text-xs font-black uppercase tracking-widest text-neutral-500 text-right">
              {currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>
      </header>

      {/* Main Kiosk Viewport */}
      <main className="flex-1 relative flex items-center justify-center p-4 md:p-8 md:overflow-hidden overflow-visible">
        <AnimatePresence mode="wait">
          {pairedUid && pairedUser && !isFeatureEnabled('kioskMode', pairedUser, adminSettings) ? (
            <motion.div 
              key="restricted"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-xl w-full bg-neutral-900 border border-neutral-800 p-10 md:p-16 rounded-[3rem] text-center space-y-8 shadow-2xl"
            >
              <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center mx-auto">
                <Lock size={40} />
              </div>
              <div className="space-y-3 font-sans">
                <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">Plan Check Failed</h2>
                <div className="text-xs text-neutral-450 font-bold uppercase tracking-wider">
                  Kiosk Mode is restricted by plan constraints.
                </div>
                <div className="bg-neutral-950 p-4 rounded-2xl border border-white/5 space-y-2 mt-4 text-left">
                  <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-wider text-neutral-400">
                    <span>Active Account:</span>
                    <span className="text-white">{pairedUser.displayName || pairedUser.email}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-wider text-rose-400 font-mono">
                    <span>Current Plan:</span>
                    <span className="px-2 py-0.5 bg-rose-500/20 rounded font-mono text-[9px]">{pairedUser.plan || 'free'} Tier</span>
                  </div>
                </div>
                <p className="text-xs text-neutral-400 leading-relaxed pt-2">
                  To continue utilizing continuous visual gear audits, kiosk scan flows, and offline digital tag synchronization, please upgrade this account's subscription to a pro or enterprise tier in your account dashboard.
                </p>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-4">
                <button
                  onClick={async () => {
                    if (terminalId) {
                      await updateDoc(doc(db, 'terminals', terminalId), { status: 'pending', ownerUid: null });
                    }
                    localStorage.removeItem('kiosk_terminal_id');
                    window.location.reload();
                  }}
                  className="flex-1 py-4 bg-white/5 border border-white/15 text-white hover:bg-white/10 rounded-2xl text-[11px] font-black uppercase tracking-widest transition"
                >
                  Disconnect Terminal
                </button>
                <a
                  href="/dashboard"
                  className="flex-1 py-4 bg-[#ff4f3a] text-white hover:bg-[#ff4f3a]/95 rounded-2xl text-[11px] font-black uppercase tracking-widest transition flex items-center justify-center font-bold"
                >
                  Dashboard Details
                </a>
              </div>
            </motion.div>
          ) : step === 'configure' ? (
            <motion.div 
              key="configure"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl w-full bg-[#111] border border-white/10 p-8 md:p-12 rounded-[2.5rem] text-left space-y-8 shadow-2xl relative"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary/20 text-primary rounded-2xl flex items-center justify-center">
                    <Settings size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white">Terminal Config Settings</h2>
                    <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider font-mono">Select workspace and gear catalog context</p>
                  </div>
                </div>
                {localStorage.getItem('kiosk_configured') === 'true' && (
                  <button 
                    onClick={() => setStep('welcome')}
                    className="p-2.5 bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white rounded-xl transition"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              <div className="space-y-6">
                {/* Organization Selection (Required) */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-450 block">Active Organization (Required)</label>
                  <select
                    value={selectedOrgId}
                    onChange={(e) => {
                      setSelectedOrgId(e.target.value);
                      setSelectedDeptId('');
                      setSelectedTeamId('');
                    }}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm font-semibold uppercase tracking-wide text-white outline-none focus:border-primary transition"
                  >
                    <option value="">-- SELECT ORGANIZATION --</option>
                    {organizations.map(org => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                  {organizations.length === 0 && (
                    <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider mt-1">
                      ⚠️ No active organizations found. Please create an organization in your main workspace first.
                    </p>
                  )}
                </div>

                {/* Grid for Departments and Teams (Only visible if Org is selected) */}
                {selectedOrgId && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-450 block">Department Option</label>
                      <select
                        value={selectedDeptId}
                        onChange={(e) => setSelectedDeptId(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm font-semibold uppercase tracking-wide text-white outline-none focus:border-primary transition"
                      >
                        <option value="all">ALL DEPARTMENTS / CENTRAL</option>
                        {departments.map(dept => (
                          <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-450 block">Team Context Option</label>
                      <select
                        value={selectedTeamId}
                        onChange={(e) => setSelectedTeamId(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm font-semibold uppercase tracking-wide text-white outline-none focus:border-primary transition"
                      >
                        <option value="all">ALL TEAMS</option>
                        {teams.map(team => (
                          <option key={team.id} value={team.id}>{team.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Equipment Source Integration Setting */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-450 block">Equipment Source Integration</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSourceType('gearLibrary');
                        setSelectedInventoryId('');
                      }}
                      className={`p-4 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-2 ${
                        selectedSourceType === 'gearLibrary'
                          ? 'bg-primary/20 border-primary text-white font-bold'
                          : 'bg-black/20 border-white/10 text-neutral-400 hover:bg-white/5 font-semibold'
                      }`}
                    >
                      <Package size={18} />
                      <span className="text-xs uppercase tracking-wider">Central Gear Library</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSourceType('customInventory')}
                      className={`p-4 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-2 ${
                        selectedSourceType === 'customInventory'
                          ? 'bg-primary/20 border-primary text-white font-bold'
                          : 'bg-black/20 border-white/10 text-neutral-400 hover:bg-white/5 font-semibold'
                      }`}
                    >
                      <LayoutGrid size={18} />
                      <span className="text-xs uppercase tracking-wider">Custom Inventory</span>
                    </button>
                  </div>
                </div>

                {/* Custom Inventory List dropdown (Conditional) */}
                {selectedSourceType === 'customInventory' && (
                  <div className="space-y-2 animate-fade-in font-sans">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-450 block">Select Custom Inventory Manifest</label>
                    <select
                      value={selectedInventoryId}
                      onChange={(e) => setSelectedInventoryId(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-sm font-semibold uppercase tracking-wide text-white outline-none focus:border-primary transition"
                    >
                      <option value="">-- SELECT CUSTOM INVENTORY --</option>
                      {inventories.map(inv => (
                        <option key={inv.id} value={inv.id}>{inv.name || `Inventory #${inv.id.slice(0,6)}`}</option>
                      ))}
                    </select>
                    {inventories.length === 0 && (
                      <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider mt-1">
                        ⚠️ No custom inventories found. Please create one in your inventory dashboard module.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-6 border-t border-white/5 flex gap-4">
                <button
                  type="button"
                  onClick={async () => {
                    if (terminalId) {
                      await updateDoc(doc(db, 'terminals', terminalId), { status: 'pending', ownerUid: null });
                    }
                    localStorage.removeItem('kiosk_terminal_id');
                    localStorage.removeItem('kiosk_configured');
                    window.location.reload();
                  }}
                  className="px-6 py-4 bg-white/5 border border-white/10 hover:bg-rose-500/10 hover:border-rose-500/30 text-neutral-400 hover:text-rose-400 rounded-xl text-[10px] font-black uppercase tracking-wider transition"
                >
                  Unpair & reset
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!selectedOrgId) {
                      toast.error("Please select an organization context!");
                      return;
                    }
                    if (selectedSourceType === 'customInventory' && !selectedInventoryId) {
                      toast.error("Please pick a custom inventory list!");
                      return;
                    }

                    // Save all options
                    localStorage.setItem('kiosk_active_source_type', selectedSourceType);
                    localStorage.setItem('kiosk_terminal_inventory_id', selectedInventoryId);
                    localStorage.setItem('kiosk_selected_org_id', selectedOrgId);
                    localStorage.setItem('kiosk_selected_dept_id', selectedDeptId);
                    localStorage.setItem('kiosk_selected_team_id', selectedTeamId);
                    localStorage.setItem('kiosk_configured', 'true');

                    // Update live active state triggers
                    setActiveSourceType(selectedSourceType);
                    setTerminalInventoryId(selectedInventoryId);

                    setStep('welcome');
                    toast.success("Terminal configuration successfully activated!");
                  }}
                  className="flex-1 px-8 py-4 bg-primary text-white hover:bg-primary/95 rounded-xl text-[10px] font-black uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-2 font-bold"
                >
                  <CheckCircle2 size={14} />
                  <span>Save & Activate Kiosk Workspace</span>
                </button>
              </div>
            </motion.div>
          ) : step === 'activate' ? (
            <motion.div 
              key="activate"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="max-w-xl w-full bg-neutral-800 p-8 md:p-16 rounded-[2rem] md:rounded-[4rem] text-center space-y-6 md:space-y-12 border border-white/10 shadow-2xl"
            >
              <div className="space-y-4">
                <div className="w-24 h-24 bg-white text-black rounded-[2rem] flex items-center justify-center mx-auto mb-8">
                  <ShieldCheck size={48} />
                </div>
                <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter">Activate Terminal</h2>
                <p className="text-neutral-400 font-medium font-bold">To use this device as a digital Gear Terminal, enter this activation code in your organization settings.</p>
              </div>

              <div className="flex flex-col items-center justify-center gap-6 bg-black/40 py-8 px-4 rounded-[2rem] border border-white/5">
                <div className="text-4xl md:text-7xl font-mono font-black tracking-[0.2em] text-white">
                  {pairingCode}
                </div>
                
                {/* Security Rotation Visual Countdown */}
                <div className="flex items-center gap-2 justify-center bg-black/45 px-4 py-2 rounded-full border border-white/5 w-fit">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="text-xs text-neutral-400 font-medium">Rotating security PIN in <strong className="font-mono text-emerald-400 font-bold">{pinExpirySec}s</strong></span>
                </div>

                {pairingCode && (
                  <div className="bg-white p-4 rounded-2xl inline-block shadow-lg hover:scale-105 transition duration-300">
                    <QRCodeCanvas 
                       value={`${window.location.origin}/organization?pair=${pairingCode}`}
                      size={140}
                      level="H"
                    />
                    <p className="text-[9px] text-neutral-800 font-bold uppercase tracking-widest mt-2">Scan to auto-pair mobile device</p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <button 
                  onClick={handleActivate}
                  className="w-full py-6 bg-white text-black rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition shadow-lg"
                >
                  Instant Active Account Handshake
                </button>
                <p className="text-[10px] text-neutral-500 uppercase tracking-[0.2em] font-black">Waiting for secure handshake...</p>
              </div>
            </motion.div>
          ) : null}

          {step === 'welcome' && (
            <motion.div 
              key="welcome"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 w-full max-w-6xl md:h-[60vh] items-center"
            >
              {activeStrategy === 'order' ? (
                <>
                  <button 
                    onClick={() => { setAction('order'); setStep('order_view'); }}
                    className="group relative bg-white text-black rounded-[2.5rem] md:rounded-[4rem] p-10 md:p-14 flex flex-col items-center justify-center gap-6 hover:scale-[1.01] active:scale-95 transition-all shadow-2xl md:col-span-2 text-center"
                  >
                    <div className="w-20 h-20 md:w-32 md:h-32 bg-neutral-100 text-black rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                      <ShoppingBag size={48} className="md:w-16 md:h-16 text-primary" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-3xl md:text-6xl font-black uppercase tracking-tighter">Start New Gear Order</h2>
                      <p className="text-xs md:text-xl font-bold text-neutral-400 uppercase tracking-widest">Self-Service Gear Ordering</p>
                    </div>
                    
                    <div className="mt-4 max-w-xl text-left bg-neutral-50 p-6 rounded-2xl border border-neutral-100 text-[11px] md:text-xs text-neutral-500 font-medium">
                      <p className="font-black text-black uppercase mb-1">📋 Order Instructions:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Browse the local collections and click items to add them.</li>
                        <li>Verify your cart list, correct any doubles or remove items.</li>
                        <li>Submit to generate your personal Order Checklist receipt.</li>
                        <li>Staff will scan QR tags later to release resources.</li>
                      </ul>
                    </div>
                  </button>
                </>
              ) : (
                <>
                  {(kioskMode === 'both' || kioskMode === 'checkout') && (
                    <button 
                      onClick={() => { setAction('checkout'); setStep('scan'); }}
                      className="group relative bg-white text-black rounded-[2rem] md:rounded-[4rem] p-8 md:p-0 flex flex-col items-center justify-center gap-4 md:gap-8 hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-white/5 h-full"
                    >
                      <div className="w-20 h-20 md:w-40 md:h-40 bg-neutral-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <LogOut size={32} className="md:w-20 md:h-20 rotate-180 text-primary" />
                      </div>
                      <div className="text-center space-y-1 md:space-y-2">
                        <h2 className="text-3xl md:text-6xl font-black uppercase tracking-tighter">Check Out</h2>
                        <p className="text-xs md:text-xl font-medium text-neutral-400 uppercase tracking-widest">Withdraw equipment</p>
                      </div>
                      <div className="w-10 h-10 md:w-16 md:h-16 bg-neutral-900 text-white rounded-full flex items-center justify-center md:absolute md:bottom-12 md:right-12">
                        <ArrowRight size={20} className="md:w-8 md:h-8" />
                      </div>
                    </button>
                  )}

                  {(kioskMode === 'both' || kioskMode === 'checkin') && (
                    <button 
                      onClick={() => { setAction('checkin'); setStep('scan'); }}
                      className="group relative bg-neutral-800 text-white rounded-[2rem] md:rounded-[4rem] p-8 md:p-0 flex flex-col items-center justify-center gap-4 md:gap-8 hover:scale-[1.02] active:scale-95 transition-all border border-white/10 h-full"
                    >
                      <div className="w-20 h-20 md:w-40 md:h-40 bg-white/5 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <LogOut size={32} className="md:w-20 md:h-20 text-white" />
                      </div>
                      <div className="text-center space-y-1 md:space-y-2">
                        <h2 className="text-3xl md:text-6xl font-black uppercase tracking-tighter">Check In</h2>
                        <p className="text-xs md:text-xl font-medium text-neutral-500 uppercase tracking-widest">Return equipment</p>
                      </div>
                      <div className="w-10 h-10 md:w-16 md:h-16 bg-white text-black rounded-full flex items-center justify-center md:absolute md:bottom-12 md:right-12">
                        <ArrowRight size={20} className="md:w-8 md:h-8" />
                      </div>
                    </button>
                  )}
                </>
              )}

              {/* Auxiliary Actions */}
              <div className="md:col-span-2 flex flex-col md:flex-row justify-center gap-4 mt-6">
                {(activeStrategy !== 'order' || adminSettings?.kioskConfig?.allowManualSearch) && (
                  <button 
                    onClick={() => setStep('search')}
                    className="px-8 md:px-12 py-4 md:py-6 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center gap-3 text-[10px] md:text-sm font-black uppercase tracking-widest text-neutral-400 transition border border-white/10"
                  >
                    <Search size={16} className="md:w-5 md:h-5" />
                    <span>Search Library</span>
                  </button>
                )}
                <button 
                  onClick={() => setStep('case_explorer')}
                  className="px-8 md:px-12 py-4 md:py-6 bg-primary/10 hover:bg-primary/20 rounded-full flex items-center justify-center gap-3 text-[10px] md:text-sm font-black uppercase tracking-widest text-primary transition border border-primary/20"
                >
                  <Luggage size={16} className="md:w-5 md:h-5" />
                  <span>Bags & Cases</span>
                </button>
                {activeStrategy === 'order' && (
                  <button 
                    type="button"
                    onClick={() => setIsFulfillDeskOpen(true)}
                    className="px-8 md:px-12 py-4 md:py-6 bg-amber-500/10 hover:bg-amber-500/20 rounded-full flex items-center justify-center gap-3 text-[10px] md:text-sm font-black uppercase tracking-widest text-amber-500 transition border border-amber-500/20"
                  >
                    <ShieldCheck size={16} className="md:w-5 md:h-5 animate-pulse" />
                    <span>Staff Handover Gate ({pendingOrders.length})</span>
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {step === 'search' && (
            <motion.div 
              key="search"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-4xl space-y-8"
            >
              <div className="flex bg-neutral-800 p-4 rounded-[3rem] border border-white/10 shadow-2xl">
                <Search className="ml-6 text-neutral-500 self-center" size={32} />
                <input 
                  autoFocus
                  placeholder="SEARCH GEAR NAME OR ASSET TAG..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                  className="flex-1 bg-transparent p-10 text-4xl font-black uppercase tracking-tighter outline-none text-white placeholder:text-neutral-700"
                />
                <button 
                  onClick={handleManualSearch}
                  disabled={isLoading}
                  className="bg-white text-black px-12 rounded-[2rem] font-black uppercase tracking-widest hover:bg-neutral-200 transition disabled:opacity-50"
                >
                  {isLoading ? '...' : 'Find'}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 max-h-[50vh] overflow-y-auto pr-4 custom-scrollbar">
                {searchResults.map(gear => {
                  const statusInfo = getStatusDisplay(gear.status);
                  const isRestricted = adminSettings?.kioskConfig?.restrictedStatuses?.includes(gear.status || 'available') && action === 'checkout';

                  return (
                    <button 
                      key={gear.id}
                      disabled={isRestricted}
                      onClick={() => {
                        if (action) {
                          addToCart(gear);
                        } else {
                          // Default fallback
                          setScannedAsset(gear);
                          setStep('confirm');
                        }
                      }}
                      className={`flex items-center gap-6 p-6 rounded-[2.5rem] border transition text-left group ${
                        isRestricted 
                          ? 'bg-neutral-900/50 border-white/5 opacity-50 cursor-not-allowed' 
                          : 'bg-neutral-800/50 hover:bg-neutral-700 border-white/5 shadow-sm hover:shadow-xl'
                      }`}
                    >
                      <div className="w-24 h-24 bg-neutral-900 rounded-2xl overflow-hidden shrink-0 border border-white/5 relative">
                        {gear.photoUrls?.[0] ? (
                          <img src={gear.photoUrls[0]} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-700">
                             <Package size={32} />
                          </div>
                        )}
                        {/* Display cart count indicator if item is in the cart */}
                        {cart.find(c => c.item.id === gear.id) && (
                          <div className="absolute top-2 right-2 bg-primary text-white font-black text-xs w-6 h-6 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                            {cart.find(c => c.item.id === gear.id)?.qty}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-4 mb-2">
                          <h4 className="text-3xl font-black uppercase tracking-tighter truncate">{gear.name}</h4>
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-neutral-500 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                            <Tag size={14} />
                            {gear.assetTag || 'NO-TAG'}
                          </p>
                          <span className="px-2.5 py-0.5 bg-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest text-neutral-400">
                            {gear.category || 'Gear'}
                          </span>
                          {gear.isKit && (
                            <span className="px-2.5 py-0.5 bg-primary/20 text-primary border border-primary/20 rounded-lg text-[9px] font-black uppercase tracking-widest animate-pulse">
                              KIT (Multi-item)
                            </span>
                          )}
                        </div>
                        {isRestricted && (
                          <p className="text-red-400 text-[10px] font-black uppercase tracking-widest mt-2 italic flex items-center gap-2">
                            <Lock size={12} />
                            Status Restricted for Checkout
                          </p>
                        )}
                      </div>
                      {!isRestricted && (
                        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-white/5 group-hover:bg-primary transition-colors text-white">
                          {action ? (
                            <Plus size={24} />
                          ) : (
                            <ArrowRight size={24} />
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
                {searchResults.length === 0 && !isLoading && searchQuery && (
                  <div className="text-center py-20 bg-white/5 rounded-[3rem] border border-dashed border-white/10">
                    <div className="text-neutral-500 font-black uppercase tracking-widest text-sm mb-2">No items found</div>
                    <p className="text-neutral-600 text-xs uppercase tracking-[0.2em]">Check spelling or try asset tag ID</p>
                  </div>
                )}
              </div>

              <div className="flex justify-center pt-8">
                <button onClick={resetKiosk} className="text-neutral-500 font-black uppercase tracking-widest text-sm hover:text-white transition underline underline-offset-8">
                  Back to Terminal
                </button>
              </div>
            </motion.div>
          )}

          {step === 'scan' && (
            <motion.div 
              key="scan"
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center space-y-6 md:space-y-12 w-full max-w-4xl"
            >
              <div className="text-center space-y-2 md:space-y-4">
                <h2 className="text-3xl md:text-7xl font-black uppercase tracking-tighter">Scan Asset</h2>
                <p className="text-sm md:text-2xl text-neutral-500 uppercase tracking-widest font-bold">Position QR code or barcode within camera</p>
              </div>

              {!isOrgMember ? (
                <div className="bg-red-500/10 border-2 border-red-500/20 max-w-lg p-6 md:p-10 rounded-[2.5rem] text-center space-y-6 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-red-500" />
                  <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
                    <ShieldCheck size={32} className="rotate-180" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl md:text-2xl font-black uppercase text-red-400">Membership Required</h3>
                    <p className="text-xs md:text-sm text-neutral-40a leading-relaxed text-neutral-350">
                      You must belong to an organization to scan or pair assets via the mobile kiosk. Please complete the organization onboarding process or request your administrator to invite you first.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="relative w-full aspect-square max-w-lg bg-black rounded-[3rem] overflow-hidden border-4 border-white/10 shadow-2xl">
                  <div id="kiosk-scanner" className="w-full h-full" />
                  <div className="absolute inset-0 border-2 border-white/20 pointer-events-none" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-4 border-white border-dashed opacity-50 animate-pulse pointer-events-none rounded-2xl" />
                </div>
              )}

              <button 
                onClick={resetKiosk}
                className="px-8 md:px-12 py-3 md:py-6 bg-white/10 hover:bg-white/20 rounded-full flex items-center gap-4 text-sm md:text-xl font-black uppercase tracking-widest transition"
              >
                <X size={20} className="md:w-8 md:h-8" />
                <span>Cancel Operation</span>
              </button>
            </motion.div>
          )}

          {step === 'case_explorer' && (
            <motion.div 
              key="case_explorer"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-6xl space-y-8"
            >
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white text-black rounded-2xl flex items-center justify-center">
                    <Luggage size={24} />
                  </div>
                  <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter">Bags & Cases</h2>
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <button 
                    onClick={() => setStep('create_case')} 
                    className="flex-1 md:flex-none px-6 py-3 bg-white text-black rounded-full font-black uppercase tracking-widest text-[10px] transition"
                  >
                    New Case
                  </button>
                  <button onClick={resetKiosk} className="flex-1 md:flex-none px-6 py-3 bg-white/10 hover:bg-white/20 rounded-full font-black uppercase tracking-widest text-[10px] transition">
                    Back
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {containers.map(container => (
                  <motion.button
                    key={container.id}
                    onClick={() => setSelectedCase(container)}
                    className="group relative bg-neutral-800 rounded-[2.5rem] overflow-hidden border border-white/10 text-left h-64 shadow-xl"
                  >
                    {container.photoUrls?.[0] ? (
                      <img src={container.photoUrls[0]} className="w-full h-full object-cover opacity-60 group-hover:scale-110 group-hover:opacity-100 transition-all duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-700 bg-neutral-900">
                        <Box size={64} />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                    <div className="absolute bottom-8 left-8 right-8 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-1 bg-white/10 backdrop-blur-md rounded-lg text-[8px] font-black uppercase tracking-widest text-white leading-none">
                          {container.type}
                        </span>
                        <span className="text-white/50 text-[10px] font-black uppercase tracking-widest">
                          {container.items.length} Items
                        </span>
                      </div>
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-none truncate">{container.name}</h3>
                    </div>
                  </motion.button>
                ))}
              </div>

              <AnimatePresence>
                {selectedCase && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
                  >
                    <motion.div 
                      initial={{ scale: 0.9, y: 20 }}
                      animate={{ scale: 1, y: 0 }}
                      className="bg-neutral-900 w-full max-w-2xl rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl flex flex-col max-h-[80vh]"
                    >
                      <div className="h-48 relative overflow-hidden shrink-0">
                         {selectedCase.photoUrls?.[0] ? (
                          <img src={selectedCase.photoUrls[0]} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-neutral-800 flex items-center justify-center text-neutral-600">
                            <Box size={48} />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 to-transparent" />
                        <button 
                          onClick={() => setSelectedCase(null)}
                          className="absolute top-6 right-6 p-2 bg-black/50 text-white rounded-full hover:bg-white hover:text-black transition"
                        >
                          <X size={24} />
                        </button>
                        <div className="absolute bottom-6 left-8 right-16">
                          <h3 className="text-2xl md:text-4xl font-black uppercase tracking-tighter text-white truncate">{selectedCase.name}</h3>
                          <p className="text-neutral-500 font-bold uppercase tracking-widest text-[10px] md:text-xs">{selectedCase.type} • {selectedCase.items.length} Items</p>
                        </div>
                        <div className="absolute bottom-6 right-8">
                           <button 
                            onClick={() => { setStep('case_pack'); setAction('pack'); }}
                            className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition"
                            title="Pack into this case"
                           >
                              <Plus size={24} />
                           </button>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto p-8 space-y-6">
                        {selectedCase.description && (
                          <div className="p-4 bg-white/5 rounded-2xl border border-white/5 italic text-sm text-neutral-400">
                             "{selectedCase.description}"
                          </div>
                        )}

                        <div className="space-y-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Inventory</p>
                          <div className="grid grid-cols-1 gap-2">
                            {selectedCase.items.map(itemId => {
                              const item = gear.find(g => g.id === itemId);
                              return (
                                <div key={itemId} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                                  <div className="w-12 h-12 bg-neutral-800 rounded-xl overflow-hidden shrink-0">
                                    {item?.photoUrls?.[0] ? (
                                      <img src={item.photoUrls[0]} className="w-full h-full object-cover" />
                                    ) : <Package size={20} className="w-full h-full p-3 text-neutral-600" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-white truncate">{item?.name || 'Unknown Item'}</p>
                                    <p className="text-[8px] font-black uppercase tracking-widest text-neutral-500">{item?.assetTag || 'NO-TAG'}</p>
                                  </div>
                                </div>
                              );
                            })}
                            {selectedCase.items.length === 0 && (
                              <p className="text-center py-12 text-neutral-600 font-bold uppercase tracking-widest text-xs">No items currently packed.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {step === 'create_case' && (
            <motion.div 
              key="create_case"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-neutral-800 p-8 md:p-12 rounded-[2rem] md:rounded-[3rem] w-full max-w-xl space-y-8 border border-white/10"
            >
              <h2 className="text-3xl font-black uppercase tracking-tighter">Create New Case</h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-4">Case Name</label>
                  <input 
                    type="text" 
                    value={newCaseName}
                    onChange={(e) => setNewCaseName(e.target.value)}
                    placeholder="e.g. SONY FX3 KIT CASE"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-xl font-bold uppercase outline-none focus:ring-2 focus:ring-primary transition"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-4">Container Type</label>
                  <select 
                    value={newCaseType}
                    onChange={(e) => setNewCaseType(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-xl font-bold uppercase outline-none focus:ring-2 focus:ring-primary appearance-none transition"
                  >
                    <option value="Case">Protector Case</option>
                    <option value="Bag">Backpack/Bag</option>
                    <option value="Kit">Kit Box</option>
                    <option value="Pallet">Pallet</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setStep('case_explorer')} className="flex-1 py-4 bg-white/5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-white/10 transition">Cancel</button>
                <button 
                  onClick={handleCreateCase}
                  disabled={!newCaseName.trim() || isLoading}
                  className="flex-1 py-4 bg-white text-black rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-neutral-200 transition disabled:opacity-50"
                >
                  {isLoading ? 'Creating...' : 'Create Case'}
                </button>
              </div>
            </motion.div>
          )}

          {step === 'case_pack' && selectedCase && (
            <motion.div 
              key="case_pack"
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center space-y-12 w-full max-w-4xl"
            >
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-3 text-primary mb-2">
                  <Box size={24} />
                  <span className="text-sm font-black uppercase tracking-[0.3em]">Packing Interface</span>
                </div>
                <h2 className="text-3xl md:text-6xl font-black uppercase tracking-tighter">Pack Into {selectedCase.name}</h2>
                <p className="text-sm md:text-xl text-neutral-500 uppercase tracking-widest font-bold">Scan gear items to link them to this case profile</p>
              </div>

              <div className="relative w-full aspect-square max-w-lg bg-black rounded-[2rem] md:rounded-[3rem] overflow-hidden border-4 border-primary/20 shadow-2xl">
                <div id="kiosk-scanner" className="w-full h-full" />
                <div className="absolute inset-0 border-2 border-primary/10 pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-4 border-primary border-dashed opacity-50 animate-pulse pointer-events-none rounded-2xl" />
              </div>

              <div className="flex flex-col items-center gap-4">
                <div className="px-6 py-2 bg-primary/10 text-primary rounded-full text-xs font-black uppercase tracking-widest animate-bounce">
                  Ready for scan
                </div>
                <button 
                  onClick={() => setStep('case_explorer')}
                  className="px-12 py-6 bg-white/10 hover:bg-white/20 rounded-full flex items-center gap-4 text-xs md:text-xl font-black uppercase tracking-widest transition"
                >
                  <CheckCircle2 size={24} className="md:w-8 md:h-8" />
                  <span>Done Packing</span>
                </button>
              </div>
            </motion.div>
          )}

          {step === 'order_view' && (
            <motion.div
              key="order_view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full max-w-7xl flex flex-col lg:flex-row gap-8 h-[75vh]"
            >
              {/* Left Catalog section */}
              <div className="flex-1 flex flex-col bg-neutral-900 border border-white/5 rounded-[2.5rem] p-6 overflow-hidden">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                  <div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter">Self-Service Catalog</h2>
                    <p className="text-neutral-500 font-bold uppercase tracking-widest text-xs mt-0.5">Select needed equipment list</p>
                  </div>
                  <div className="flex bg-neutral-800 rounded-full px-4 py-2 border border-white/5 w-full md:w-auto items-center">
                    <Search className="text-neutral-500 mr-2" size={18} />
                    <input 
                      placeholder="SEARCH GEAR OR ASSET CODE..." 
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        handleManualSearch();
                      }}
                      className="bg-transparent border-none outline-none font-bold text-xs uppercase text-white placeholder:text-neutral-600 tracking-wider"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                  {(searchResults.length > 0 ? searchResults : gear).map(item => {
                    const statusInfo = getStatusDisplay(item.status);
                    const itemInCart = cart.find(c => c.item.id === item.id);
                    const isRestricted = adminSettings?.kioskConfig?.restrictedStatuses?.includes(item.status || 'available');
                    
                    return (
                      <div 
                        key={item.id} 
                        className={`flex items-center justify-between p-4 bg-neutral-800/40 border border-white/5 rounded-2xl transition hover:border-white/10 ${
                          isRestricted ? 'opacity-40' : ''
                        }`}
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-16 h-16 bg-neutral-900 rounded-xl overflow-hidden shrink-0 border border-white/5 relative">
                            {item.photoUrls?.[0] ? (
                              <img src={item.photoUrls[0]} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-neutral-600">
                                <Package size={20} />
                              </div>
                            )}
                            {itemInCart && (
                              <div className="absolute top-1 right-1 bg-primary text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                                {itemInCart.qty}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 text-left">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-black text-white text-lg tracking-tight uppercase truncate">{item.name}</h4>
                              <span className="px-2 py-0.5 bg-white/5 rounded-md text-[8px] font-black uppercase text-neutral-400 tracking-widest">
                                {item.category || 'Gear'}
                              </span>
                              {item.isKit && (
                                <span className="px-2 py-0.5 bg-primary/20 text-primary rounded-md text-[8px] font-black uppercase tracking-widest animate-pulse">
                                  KIT
                                </span>
                              )}
                            </div>
                            <p className="text-neutral-500 font-bold uppercase tracking-widest text-[10px] mt-1 flex items-center gap-1">
                              <Tag size={10} />
                              {item.assetTag || 'NO-TAG'} • {item.brand || 'No Brand'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className={`px-2.5 py-1 rounded-full text-[8px] font-black tracking-widest uppercase ${statusInfo.color}`}>
                            {statusInfo.label}
                          </div>
                          
                          {isRestricted ? (
                            <div className="p-3 bg-red-900/20 text-red-400 rounded-xl flex items-center gap-1.5" title="Restricted Status">
                              <Lock size={14} />
                              <span className="text-[8px] font-black uppercase tracking-wider">Locked</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => addToCart(item)}
                              className="px-4 py-2 bg-white text-black hover:bg-primary hover:text-white transition rounded-xl font-black uppercase tracking-widest text-[10px]"
                            >
                              Add to list
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Side Cart section */}
              <div className="w-full lg:w-[400px] bg-neutral-950 border border-white/5 rounded-[2.5rem] p-6 flex flex-col justify-between h-full">
                <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between border-b border-white/5 pb-4 shrink-0">
                    <div className="flex items-center gap-3">
                      <ShoppingBag className="text-primary" size={24} />
                      <h3 className="text-2xl font-black uppercase tracking-tighter">Your Choices</h3>
                    </div>
                    <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-black tabular-nums">
                      {cart.reduce((sum, c) => sum + c.qty, 0)} Items
                    </span>
                  </div>

                  {/* Cart Item rows */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {cart.map(({ item, qty }) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-neutral-900 rounded-xl border border-white/5">
                        <div className="text-left min-w-0 flex-1">
                          <p className="font-bold text-white uppercase text-sm truncate">{item.name}</p>
                          <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500">{item.assetTag}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.id)}
                            className="w-8 h-8 rounded-full bg-white/5 hover:bg-neutral-800 flex items-center justify-center text-neutral-400"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="font-mono font-black text-sm w-4 text-center">{qty}</span>
                          <button
                            type="button"
                            onClick={() => addToCart(item)}
                            className="w-8 h-8 rounded-full bg-white/5 hover:bg-neutral-800 flex items-center justify-center text-neutral-400"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {cart.length === 0 && (
                      <div className="text-center py-24 text-neutral-700 uppercase font-black tracking-widest text-xs flex flex-col items-center justify-center gap-4">
                        <ShoppingBag size={48} className="text-neutral-800 opacity-50" />
                        <span>Empty list</span>
                        <p className="text-[10px] text-neutral-600 font-medium normal-case">Select items from the library catalog on the left to populate your list.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 space-y-4 shrink-0">
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => resetKiosk()}
                      className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-neutral-400 rounded-2xl font-black uppercase text-xs tracking-widest"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={cart.length === 0}
                      onClick={() => setStep('review')}
                      className="flex-1 py-4 bg-primary text-white hover:scale-105 transition rounded-2xl font-black uppercase text-xs tracking-widest disabled:opacity-30 disabled:hover:scale-100"
                    >
                      Review Order List
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 'review' && (
            <motion.div
              key="review"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white text-black rounded-[3rem] p-8 md:p-12 w-full max-w-4xl space-y-8 md:space-y-10 shadow-2xl"
            >
              <div className="text-center space-y-2">
                <div className="px-5 py-1.5 bg-primary/10 text-primary font-black uppercase text-[10px] tracking-widest rounded-full inline-block">
                  Kiosk Selection Gate
                </div>
                <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-neutral-900 leading-none">Review Selections</h2>
                <p className="text-xs md:text-sm text-neutral-500 font-bold uppercase tracking-widest">
                  Verify or edit items before final authorization check-out
                </p>
              </div>

              {/* Cart Items Checklist Card Container */}
              <div className="space-y-3 max-h-[35vh] overflow-y-auto pr-2 custom-scrollbar">
                {cart.map(({ item, qty }) => {
                  const statusInfo = getStatusDisplay(item.status);
                  return (
                    <div 
                      key={item.id} 
                      className="flex items-center justify-between p-4 md:p-6 bg-neutral-50 rounded-[2rem] border border-neutral-100 shadow-sm"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Artwork */}
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-2xl overflow-hidden shrink-0 border border-neutral-100">
                          {item.photoUrls?.[0] ? (
                            <img src={item.photoUrls[0]} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-300 animate-pulse">
                              <Package size={24} />
                            </div>
                          )}
                        </div>
                        <div className="text-left min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-black text-neutral-950 text-xl md:text-2xl leading-none uppercase truncate">{item.name}</h4>
                            <span className="px-2 py-0.5 bg-neutral-200 text-neutral-600 rounded-md text-[8px] font-black uppercase tracking-widest">
                              {item.category || 'Gear'}
                            </span>
                            {item.isKit && (
                              <span className="px-2 py-0.5 bg-primary/20 text-primary rounded-md text-[8px] font-black uppercase tracking-widest">
                                KIT CONTAINERS
                              </span>
                            )}
                          </div>
                          <p className="text-neutral-400 font-bold uppercase tracking-widest text-[9px] md:text-xs mt-2 flex items-center gap-1.5 leading-none">
                            <Tag size={12} />
                            {item.assetTag || 'NO-TAG'} • {item.brand || 'No Brand'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        {/* Corrections quantities corrector */}
                        <div className="flex items-center bg-neutral-200/40 rounded-full p-1 border border-neutral-200/50">
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.id)}
                            className="w-10 h-10 rounded-full bg-white hover:bg-neutral-100 flex items-center justify-center text-neutral-600 transition shadow-sm"
                            title="Decrement quantity"
                          >
                            <Minus size={16} />
                          </button>
                          <span className="font-mono font-black text-base md:text-lg px-4 text-center text-neutral-800 min-w-8">{qty}</span>
                          <button
                            type="button"
                            onClick={() => addToCart(item)}
                            className="w-10 h-10 rounded-full bg-white hover:bg-neutral-100 flex items-center justify-center text-neutral-600 transition shadow-sm"
                            title="Increment quantity"
                          >
                            <Plus size={16} />
                          </button>
                        </div>

                        {/* Full removal trash key */}
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id, true)}
                          className="w-11 h-11 rounded-2xl bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 flex items-center justify-center transition border border-red-100/30"
                          title="Remove item"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {cart.length === 0 && (
                  <div className="text-center py-16 bg-neutral-50 rounded-[2rem] border border-dashed border-neutral-200">
                    <p className="text-neutral-400 font-black uppercase text-xs tracking-widest">Empty Selection</p>
                    <p className="text-neutral-300 text-[10px] mt-1 uppercase font-medium">Scan an item or use manual search/catalog to populate your list.</p>
                  </div>
                )}
              </div>

              {/* CTAs */}
              <div className="flex flex-col md:flex-row gap-4 w-full">
                <button
                  type="button"
                  onClick={() => setStep(action === 'order' ? 'order_view' : 'scan')}
                  className="flex-1 py-4 md:py-5 bg-neutral-100 hover:bg-neutral-200 text-neutral-500 rounded-2xl text-xs font-black uppercase tracking-widest transition"
                >
                  {action === 'order' ? 'Back to Catalog' : 'Scan More Items'}
                </button>
                <button
                  type="button"
                  disabled={cart.length === 0}
                  onClick={() => setStep('user_details')}
                  className="flex-[1.5] py-4 md:py-5 bg-black text-white hover:scale-105 transition rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl disabled:opacity-30 disabled:hover:scale-100"
                >
                  <span>Authorize & Submit List ({cart.reduce((sum, c) => sum + c.qty, 0)})</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 'receipt' && lastOrderReceipt && (
            <motion.div
              key="receipt"
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-2xl flex flex-col space-y-6"
            >
              {/* Paper Receipt slip container */}
              <div className="bg-white text-black p-8 md:p-10 rounded-3xl shadow-2xl relative overflow-hidden border border-neutral-100">
                <div className="text-center space-y-4 border-b-2 border-dashed border-neutral-200 pb-6 mt-2">
                  <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 size={36} />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black uppercase tracking-tighter text-neutral-900 leading-none">
                      {lastOrderReceipt.actionType === 'order' ? 'Order Complete' : 'Handover Logged'}
                    </h3>
                    <p className="text-[9px] text-neutral-400 font-extrabold uppercase tracking-widest mt-1.5">
                      {lastOrderReceipt.actionType === 'order' ? 'Self-Service Order Checklist Slip' : 'Direct Checkout Confirmation Receipt'}
                    </p>
                  </div>
                  <div className="font-mono bg-neutral-50 px-4 py-2 inline-block border border-neutral-100 rounded-xl text-center">
                    <p className="text-[8px] text-neutral-400 uppercase tracking-widest font-black">SCAN CODE FOR INVENTORY HANDOVER</p>
                    <p className="text-2xl font-black text-neutral-950 tracking-widest leading-none mt-1">{lastOrderReceipt.orderNumber}</p>
                    {/* Real Barcode representation using QRCode */}
                    <div className="flex justify-center mt-2 p-1 bg-white rounded-lg border border-neutral-100">
                      <QRCodeCanvas value={lastOrderReceipt.orderNumber} size={64} />
                    </div>
                  </div>
                </div>

                <div className="py-5 space-y-3.5 border-b-2 border-dashed border-neutral-200 font-mono text-xs text-left">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">OPERATOR NAME:</span>
                    <span className="font-black text-neutral-800 uppercase">{lastOrderReceipt.userName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">OPERATOR EMAIL:</span>
                    <span className="font-black text-neutral-800 lowercase">{lastOrderReceipt.userEmail}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">TIMESTAMP:</span>
                    <span className="font-black text-neutral-800">{lastOrderReceipt.createdAt.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">WORKFLOW STRATEGY:</span>
                    <span className="font-black text-neutral-800 uppercase">{lastOrderReceipt.actionType === 'order' ? 'Self-Service Fast Food Reservation' : 'Direct Scan & Go'}</span>
                  </div>
                </div>

                {/* Checkout items checklists layout */}
                <div className="py-6 space-y-4">
                  <p className="text-left font-mono font-black text-[10px] text-neutral-400 uppercase tracking-wider mb-1">📥 Equipment packing list checklist:</p>
                  <div className="space-y-2 max-h-[25vh] overflow-y-auto pr-1 custom-scrollbar">
                    {lastOrderReceipt.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-100 text-sm">
                        <div className="text-left font-sans">
                          <p className="font-mono text-neutral-400 text-[8px] font-black leading-none mb-0.5">{it.category?.toUpperCase() || 'EQUIPMENT'}</p>
                          <p className="font-black text-neutral-900 uppercase text-base">{it.name}</p>
                          <p className="text-[10px] text-neutral-400 font-bold mt-1 uppercase flex items-center gap-1 leading-none">
                            <Tag size={10} />
                            {it.assetTag}
                          </p>
                        </div>
                        <div className="flex items-center shrink-0 ml-4 font-mono">
                          <span className="px-2.5 py-1 bg-neutral-200 text-neutral-800 font-black rounded-lg text-xs leading-none">QTY: {it.qty}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t-2 border-neutral-200 pt-5 text-center space-y-2">
                  <p className="text-[10px] font-mono text-neutral-400 uppercase font-black tracking-widest leading-relaxed">
                    📃 Packing Slip Receipt
                  </p>
                  <p className="text-[9px] font-mono text-neutral-400 uppercase font-bold leading-relaxed italic">
                    Bring this code or packing checklist to the Inventory department to fulfill. Keep this receipt as a packing list checklist to confirm everything is available when returning equipment later.
                  </p>
                </div>
              </div>

              {/* Actions panel */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    toast.success("Packing List Receipt print job initiated.");
                  }}
                  className="py-4 bg-neutral-800 hover:bg-neutral-700 text-white border border-white/10 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-lg"
                >
                  <Printer size={14} />
                  <span>Print Slip</span>
                </button>
                <button
                  type="button"
                  disabled={isSendingEmail}
                  onClick={() => handleSendEmail()}
                  className="py-4 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-white border border-white/10 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-lg transition-all"
                >
                  <Mail size={14} className={isSendingEmail ? "animate-spin" : ""} />
                  <span>{isSendingEmail ? 'Sending...' : 'Email Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => resetKiosk()}
                  className="py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-lg"
                >
                  <CheckCircle2 size={14} />
                  <span>Finish & Close</span>
                </button>
              </div>
            </motion.div>
          )}

          {step === 'confirm' && scannedAsset && (
            <motion.div 
              key="confirm"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white text-black rounded-[2rem] md:rounded-[4rem] p-8 md:p-16 w-full max-w-4xl flex flex-col items-center text-center space-y-6 md:space-y-12"
            >
              <div className="w-20 h-20 md:w-32 md:h-32 bg-neutral-100 rounded-full flex items-center justify-center overflow-hidden border-4 border-neutral-50">
                {scannedAsset.photoUrls?.[0] ? (
                  <img src={scannedAsset.photoUrls[0]} className="w-full h-full object-cover" />
                ) : (
                  <Package size={64} className="text-neutral-400" />
                )}
              </div>

              <div className="space-y-4">
                <span className="px-6 py-2 bg-neutral-100 text-neutral-500 rounded-full text-sm font-black uppercase tracking-widest">
                  {scannedAsset.category || 'Equipment'}
                </span>
                <h2 className="text-3xl md:text-7xl font-black uppercase tracking-tighter">{scannedAsset.name}</h2>
                <div className="flex items-center justify-center gap-3 md:gap-4 text-neutral-400 text-sm md:text-xl font-mono">
                  <Tag size={16} className="md:w-6 md:h-6" />
                  <span>{scannedAsset.assetTag || 'NO-TAG-ID'}</span>
                </div>

                {scannedAsset.isKit && scannedAsset.childItemIds && (
                  <div className="mt-8 p-6 bg-neutral-50 rounded-[2rem] border border-neutral-100 w-full max-w-lg">
                    <div className="flex items-center gap-2 text-primary mb-4">
                      <Package size={18} />
                      <span className="text-xs font-black uppercase tracking-widest text-primary">Kit Contents ({scannedAsset.childItemIds.length} Items)</span>
                    </div>
                    <div className="text-left space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                      <p className="text-xs text-neutral-500 italic">This will check out all individual items in this kit.</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 md:gap-6 w-full mt-4 md:mt-8">
                <button 
                  onClick={resetKiosk}
                  className="py-6 md:py-8 bg-neutral-100 text-neutral-500 rounded-[1.5rem] md:rounded-[2.5rem] text-sm md:text-2xl font-black uppercase tracking-widest hover:bg-neutral-200 transition"
                >
                  Incorrect
                </button>
                <button 
                  onClick={() => setStep(action === 'checkout' ? 'user_details' : 'sign')}
                  className="py-6 md:py-8 bg-black text-white rounded-[1.5rem] md:rounded-[2.5rem] text-sm md:text-2xl font-black uppercase tracking-widest hover:scale-105 transition shadow-2xl"
                >
                  Confirm Gear
                </button>
              </div>
            </motion.div>
          )}

          {step === 'user_details' && (
            <motion.div 
              key="user_details"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white text-black rounded-[2rem] md:rounded-[4rem] p-8 md:p-16 w-full max-w-4xl space-y-6 md:space-y-12"
            >
              <div className="text-center space-y-2 md:space-y-4">
                <h2 className="text-3xl md:text-6xl font-black uppercase tracking-tighter">Your Identity</h2>
                <p className="text-xs md:text-xl text-neutral-400 uppercase tracking-widest font-bold">Please identify yourself for the records</p>
              </div>

              <div className="space-y-4 md:space-y-8">
                <div className="space-y-2 md:space-y-4">
                  <label className="text-[10px] md:text-xs font-black uppercase tracking-widest text-neutral-400 ml-4 md:ml-6">Full Name</label>
                  <input 
                    type="text"
                    value={guestInfo.name}
                    onChange={(e) => setGuestInfo({ ...guestInfo, name: e.target.value })}
                    placeholder="e.g. John Doe"
                    className="w-full text-xl md:text-4xl p-6 md:p-10 bg-neutral-50 border-2 md:border-4 border-neutral-100 rounded-[1.5rem] md:rounded-[2.5rem] focus:border-black outline-none transition font-black tracking-tighter uppercase"
                  />
                </div>
                <div className="space-y-2 md:space-y-4">
                  <label className="text-[10px] md:text-xs font-black uppercase tracking-widest text-neutral-400 ml-4 md:ml-6">Organization Email</label>
                  <input 
                    type="email"
                    value={guestInfo.email}
                    onChange={(e) => setGuestInfo({ ...guestInfo, email: e.target.value })}
                    placeholder="name@company.com"
                    className="w-full text-xl md:text-4xl p-6 md:p-10 bg-neutral-50 border-2 md:border-4 border-neutral-100 rounded-[1.5rem] md:rounded-[2.5rem] focus:border-black outline-none transition font-black tracking-tighter lowercase"
                  />
                </div>
              </div>

              <button 
                disabled={!guestInfo.name || !guestInfo.email || isLoading}
                onClick={action === 'order' ? handleCreateOrder : () => setStep('sign')}
                className="w-full py-6 md:py-10 bg-black text-white rounded-[1.5rem] md:rounded-[2.5rem] text-xl md:text-3xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition disabled:opacity-30 disabled:hover:scale-100"
              >
                {isLoading ? 'Creating Order...' : action === 'order' ? 'Submit Order request' : 'Proceed to Signature'}
              </button>
            </motion.div>
          )}

          {step === 'sign' && (
            <motion.div 
              key="sign"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white text-black rounded-[4rem] p-16 w-full max-w-4xl space-y-12"
            >
              <div className="text-center space-y-4">
                <h2 className="text-6xl font-black uppercase tracking-tighter">Digital Authorization</h2>
                <p className="text-xl text-neutral-400 uppercase tracking-widest font-bold">Sign below to confirm accountability</p>
              </div>

              <div className="bg-neutral-50 rounded-[3rem] border-4 border-neutral-100 overflow-hidden h-[400px]">
                <SignatureCanvas 
                  ref={sigCanvas}
                  penColor='black'
                  canvasProps={{ className: 'w-full h-full' }}
                  onEnd={() => setSignature('done')}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <button 
                  onClick={() => sigCanvas.current?.clear()}
                  className="py-8 bg-neutral-100 text-neutral-500 rounded-[2rem] text-2xl font-black uppercase tracking-widest hover:bg-neutral-200"
                >
                  Clear Pad
                </button>
                <button 
                  disabled={!signature}
                  onClick={action === 'checkout' ? handleCheckout : handleCheckin}
                  className="py-8 bg-emerald-500 text-white rounded-[2rem] text-2xl font-black uppercase tracking-widest hover:bg-emerald-600 transition shadow-2xl shadow-emerald-500/20 tabular-nums flex items-center justify-center gap-4"
                >
                  {isLoading ? (
                    <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 size={32} />
                      <span>{action === 'checkout' ? 'Authorize Move' : 'Log Return'}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {step === 'complete' && (
            <motion.div 
              key="complete"
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-12"
            >
              <div className="w-56 h-56 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/30">
                <CheckCircle2 size={120} />
              </div>
              <div className="space-y-4">
                <h2 className="text-8xl font-black uppercase tracking-tighter leading-tight">Success</h2>
                <p className="text-3xl text-neutral-400 font-bold uppercase tracking-widest">
                  {action === 'checkout' ? 'Equipment has been assigned to you' : 'Equipment successfullly returned to stock'}
                </p>
              </div>
              <p className="text-neutral-500 text-xl font-bold italic animate-pulse">System will reset in 5 seconds...</p>
              {(() => {
                setTimeout(resetKiosk, 5000);
                return null;
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Info */}
      <footer className="p-8 flex items-center justify-between border-t border-white/5 bg-black/20 shrink-0">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-emerald-500" size={24} />
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Secure Protocol</span>
          </div>
          <div className="flex items-center gap-3">
            <QrCode className="text-neutral-500" size={24} />
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Barcode Scanning Active</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsConfigOpen(true)}
            className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition text-neutral-500"
          >
            <Settings size={24} />
          </button>
        </div>
      </footer>

      {/* Config Overlay */}
      <AnimatePresence>
        {isConfigOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-8"
          >
            <div className="bg-neutral-800 rounded-[3rem] p-16 w-full max-w-2xl border border-white/10 space-y-12">
              <div className="text-center space-y-4">
                <Lock className="mx-auto text-neutral-500 mb-4" size={48} />
                <h2 className="text-5xl font-black uppercase tracking-tighter">Terminal Settings</h2>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-xs font-black uppercase tracking-widest text-neutral-500 block text-center">Operation Mode</label>
                  <div className="flex gap-4">
                    {(['both', 'checkout', 'checkin'] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setKioskMode(m)}
                        className={`flex-1 py-6 rounded-2xl font-black uppercase text-xs tracking-widest transition border-2 ${
                          kioskMode === m ? 'bg-white text-black border-white' : 'bg-transparent text-neutral-500 border-white/10'
                        }`}
                      >
                        {m === 'both' ? 'Hybrid' : m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-8 border-t border-white/5">
                  <button 
                    onClick={() => setIsConfigOpen(false)}
                    className="w-full py-8 bg-neutral-700 text-white rounded-[2rem] text-xl font-black uppercase tracking-widest hover:bg-neutral-600 transition"
                  >
                    Close Settings
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {isFulfillDeskOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-8"
          >
            <div className="bg-neutral-950 text-white rounded-[3rem] border border-white/10 w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden shadow-2xl">
              {/* Header */}
              <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl">
                    <ShieldCheck size={28} className="animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter leading-none">Staff Handover Gate & Fulfillment</h2>
                    <p className="text-neutral-500 font-bold uppercase tracking-widest text-[9px] md:text-xs mt-1">Verify self-service orders & release inventory items</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsFulfillDeskOpen(false);
                    setActiveFulfillOrder(null);
                    setVerifiedItemsMap({});
                  }}
                  className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-neutral-400 transition"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body Split */}
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* Left side list */}
                <div className="w-full md:w-2/5 border-r border-white/5 flex flex-col overflow-hidden p-6 gap-4">
                  <h3 className="font-mono font-black text-[10px] text-neutral-500 uppercase tracking-widest leading-none">📥 Active Pending Orders ({pendingOrders.length})</h3>
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                    {pendingOrders.map((order) => {
                      const isSelected = activeFulfillOrder?.id === order.id;
                      const orderDate = order.createdAt?.seconds 
                        ? new Date(order.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                        : 'Just Now';
                      
                      return (
                        <button
                          key={order.id}
                          onClick={() => {
                            setActiveFulfillOrder(order);
                            setVerifiedItemsMap({});
                          }}
                          className={`w-full p-5 rounded-2xl text-left border transition flex flex-col gap-3 group ${
                            isSelected 
                              ? 'bg-white text-black border-white' 
                              : 'bg-neutral-900 border-white/5 hover:border-white/10 text-white'
                          }`}
                        >
                          <div className="flex justify-between items-start w-full">
                            <div>
                              <p className={`font-mono text-xs font-black ${isSelected ? 'text-primary' : 'text-neutral-400'}`}>
                                {order.orderNumber}
                              </p>
                              <h4 className="font-black text-lg md:text-xl uppercase tracking-tight mt-1 line-clamp-1">
                                {order.userName}
                              </h4>
                            </div>
                            <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              isSelected ? 'bg-black/10 text-neutral-800' : 'bg-white/5 text-neutral-400'
                            }`}>
                              {orderDate}
                            </span>
                          </div>

                          <div className="flex justify-between items-center mt-1">
                            <span className={`text-[9px] font-black uppercase tracking-wider ${
                              isSelected ? 'text-neutral-500' : 'text-neutral-400'
                            }`}>
                              {order.items?.reduce((acc: number, it: any) => acc + (it.qty || 1), 0)} Items Selected
                            </span>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                              isSelected ? 'bg-primary text-white' : 'bg-white/5 text-white group-hover:bg-amber-500/20'
                            }`}>
                              <ArrowRight size={16} />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    {pendingOrders.length === 0 && (
                      <div className="text-center py-20 text-neutral-600 font-extrabold uppercase tracking-widest text-xs flex flex-col items-center justify-center gap-3">
                        <ShoppingBag size={40} className="opacity-30" />
                        <span>No reservations waiting</span>
                        <p className="text-[10px] text-neutral-500 font-medium normal-case font-sans">Self-service orders submitted at kiosks will appear in this feed automatically in real-time.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right side order details */}
                <div className="flex-1 bg-neutral-900/30 flex flex-col overflow-hidden p-6">
                  {activeFulfillOrder ? (
                    <div className="flex-1 flex flex-col justify-between overflow-hidden">
                      <div className="space-y-6 flex-1 flex flex-col overflow-hidden">
                        {/* Order Header */}
                        <div className="bg-neutral-900 p-5 rounded-2xl border border-white/5">
                          <p className="text-[9px] font-mono text-amber-500 font-black uppercase tracking-wider">ACTIVE SPECIMEN DETAILS</p>
                          <h4 className="text-2xl font-black text-white mt-1 uppercase tracking-tight">{activeFulfillOrder.userName}</h4>
                          <p className="text-xs text-neutral-400 lowercase font-mono mt-1">{activeFulfillOrder.userEmail}</p>
                          <div className="mt-3 pt-3 border-t border-white/5 flex justify-between items-center text-xs font-mono">
                            <span className="text-neutral-500">ORDER CODE:</span>
                            <span className="text-white font-black uppercase">{activeFulfillOrder.orderNumber}</span>
                          </div>
                        </div>

                        {/* Order Items checklist */}
                        <div className="flex-1 flex flex-col overflow-hidden">
                          <div className="flex justify-between items-center mb-3">
                            <span className="font-mono text-[9px] text-neutral-500 uppercase tracking-widest font-black">📝 Inventory Packing Checklist:</span>
                            <span className="font-mono text-[10px] bg-amber-500/20 text-amber-500 px-2.5 py-0.5 rounded-full font-black uppercase">
                              {activeFulfillOrder.items.filter((it: any) => verifiedItemsMap[`${activeFulfillOrder.id}_${it.id}`]).length} OF {activeFulfillOrder.items.length} VERIFIED
                            </span>
                          </div>

                          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                            {activeFulfillOrder.items.map((item: any) => {
                              const isVerified = !!verifiedItemsMap[`${activeFulfillOrder.id}_${item.id}`];
                              return (
                                <button
                                  type="button"
                                  key={item.id}
                                  onClick={() => {
                                    setVerifiedItemsMap(prev => ({
                                      ...prev,
                                      [`${activeFulfillOrder.id}_${item.id}`]: !prev[`${activeFulfillOrder.id}_${item.id}`]
                                    }));
                                  }}
                                  className={`w-full p-4 rounded-xl border text-left transition flex items-center justify-between ${
                                    isVerified 
                                      ? 'bg-amber-500/10 border-amber-500/30 text-white' 
                                      : 'bg-neutral-900/60 border-white/5 hover:border-white/10 text-white'
                                  }`}
                                >
                                  <div className="flex items-center gap-4 min-w-0">
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition border ${
                                      isVerified ? 'bg-amber-500 border-amber-500 text-black' : 'border-neutral-700 bg-neutral-800'
                                    }`}>
                                      {isVerified && <CheckCircle2 size={14} className="stroke-[3]" />}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-black text-sm uppercase truncate">{item.name}</p>
                                      <p className="text-[10px] text-neutral-500 font-mono tracking-widest flex items-center gap-1.5 mt-1 leading-none">
                                        <Tag size={10} />
                                        {item.assetTag}
                                        {item.isKit && (
                                          <span className="text-[8px] bg-primary/20 text-primary px-1.5 py-0.5 rounded uppercase font-black tracking-normal">KIT</span>
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                  <span className="font-mono text-xs font-black px-2.5 py-1 bg-white/5 rounded-md">
                                    QTY: {item.qty}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="pt-4 border-t border-white/5 flex gap-4 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const next: { [key: string]: boolean } = {};
                            activeFulfillOrder.items.forEach((it: any) => {
                              next[`${activeFulfillOrder.id}_${it.id}`] = true;
                            });
                            setVerifiedItemsMap(next);
                            toast.success("All items verified");
                          }}
                          className="px-6 py-4 bg-white/5 hover:bg-white/10 text-neutral-400 rounded-xl font-bold uppercase text-[10px] tracking-widest border border-white/5"
                        >
                          Verify All
                        </button>
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleFulfillOrder(activeFulfillOrder)}
                          className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white transition rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-lg disabled:opacity-40"
                        >
                          {isLoading ? 'Processing Handover...' : 'Approve Handover & Release Gear'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center text-neutral-700 uppercase font-bold tracking-widest text-xs gap-4">
                      <ShieldCheck size={64} className="text-neutral-800 opacity-50" />
                      <span>Select a Reservation Ticket on the left to begin packing verification</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {emailModalOpen && emailModalData && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-8 overflow-y-auto"
          >
            <div className="bg-neutral-900 text-white rounded-[3rem] border border-white/10 w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl">
              {/* Header */}
              <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl">
                    <Mail size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                      <span>Live Handover Receipt Integrator</span>
                      {emailModalData.simulated && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-black font-mono">SANDBOX SIMULATOR</span>
                      )}
                    </h2>
                    <p className="text-[10px] text-neutral-400 font-extrabold uppercase tracking-widest mt-0.5">
                      Fiji Logistics & Dispatch System Hub by Digital Bure 🇫🇯
                    </p>
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={() => setEmailModalOpen(false)} 
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition text-neutral-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Main Content Pane */}
              <div className="flex-1 overflow-hidden grid lg:grid-cols-2">
                {/* Left pane - Interactive HTML Preview in sandbox */}
                <div className="p-6 border-r border-white/5 flex flex-col h-full bg-neutral-950/40">
                  <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                    <p className="text-xs font-black uppercase tracking-widest text-neutral-400 flex items-center gap-1.5">
                      <LayoutGrid size={14} />
                      <span>Live Rendered Email Draft</span>
                    </p>
                    <span className="text-[9px] text-[#2563eb] font-bold font-mono uppercase">invoice_receipt.html</span>
                  </div>
                  <div className="flex-1 bg-white rounded-2xl overflow-hidden border border-white/10 shadow-inner relative flex flex-col min-h-[40vh] lg:min-h-0">
                    <iframe 
                      title="HTML Email Preview"
                      srcDoc={emailModalData.html} 
                      className="w-full h-full border-0 bg-white" 
                      sandbox="allow-same-origin"
                    />
                  </div>
                </div>

                {/* Right pane - Integration Guide and Documentation */}
                <div className="p-6 space-y-6 overflow-y-auto h-full flex flex-col">
                  {/* Status Card */}
                  <div className="p-5 bg-neutral-800/60 rounded-2xl border border-white/5 space-y-3 shrink-0">
                    <h3 className="text-xs font-black uppercase tracking-widest text-[#2563eb]">Dispatch Telemetry Status</h3>
                    <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                      <div>
                        <p className="text-neutral-500">RECIPIENT EMAIL:</p>
                        <p className="font-bold text-neutral-300 truncate">{emailModalData.recipient}</p>
                      </div>
                      <div>
                        <p className="text-neutral-500">SUBJECT LINE:</p>
                        <p className="font-bold text-neutral-300 truncate">{emailModalData.subject}</p>
                      </div>
                      <div>
                        <p className="text-neutral-500">DELIVERY STATUS:</p>
                        <p className="flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${emailModalData.simulated ? "bg-amber-400" : "bg-emerald-500 animate-pulse"}`}></span>
                          <span className="font-extrabold uppercase">
                            {emailModalData.simulated ? "Simulated Successful" : "Sent to Dispatcher"}
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="text-neutral-500 font-bold">INTEGRATED API:</p>
                        <p className="font-bold text-neutral-300">{emailModalData.simulated ? "Local Sandbox Client" : "Resend Cloud Mailer"}</p>
                      </div>
                    </div>
                    {emailModalData.notice && (
                      <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[10px] leading-relaxed text-amber-400 font-medium">
                        ⚠️ <strong>Config Assist Notice:</strong> {emailModalData.notice}
                      </div>
                    )}
                  </div>

                  {/* Integration Tutorial Code card */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-neutral-400 border-b border-white/5 pb-2">
                      <QrCode size={14} className="text-blue-400" />
                      <span>Production Deployment Guide</span>
                    </div>

                    <div className="space-y-4 text-xs leading-relaxed text-neutral-400">
                      <p>
                        To send automated emails on <strong>Checkout</strong> and <strong>Check-In</strong>, Packer Tools integrates with transactional API dispatchers like <strong>Resend</strong> or <strong>SendGrid</strong> on the full-stack server-side layer.
                      </p>

                      <strong className="text-white block mt-2">1. Set Up Environment Variables</strong>
                      <p>
                        Add your transactional email secret key to your platform environment parameters.
                        Define the key in your local <code>.env</code> settings pane:
                      </p>
                      <pre className="bg-black/60 p-4 rounded-xl border border-white/5 overflow-x-auto text-[10px] text-neutral-300 font-mono">
{`# File: .env
RESEND_API_KEY="re_A6yG8x...YourAPIKeyHere"`}
                      </pre>

                      <strong className="text-white block mt-2">2. Deployment Workflow options</strong>
                      <div className="space-y-3 bg-neutral-950/40 p-4 rounded-2xl border border-white/5">
                        <div className="space-y-1">
                          <p className="text-white font-extrabold text-[11px] uppercase tracking-wide">Option A: Firestore Collection Trigger (Recommended)</p>
                          <p className="text-[10px] leading-normal text-neutral-500">
                            Deploy a standard Firebase Cloud Function checking the <code>checkouts</code> Firestore collection. On every <code>onCreate</code> or <code>onUpdate</code> record event, extract user metadata and call Resend API automatically. This is fully secure, failsafe, and works separate of the user's browser.
                          </p>
                        </div>
                        <div className="space-y-1 border-t border-white/5 pt-2">
                          <p className="text-white font-extrabold text-[11px] uppercase tracking-wide">Option B: Server Side API Route Proxy (Active)</p>
                          <p className="text-[10px] leading-normal text-neutral-500">
                            Our Express backend includes a live router at <code>/server.ts</code>. When handovers complete, the client triggers a POST request to <code>/api/send-email</code>. This server-side proxy handles secure email delivery without exposing credentials to the client.
                          </p>
                        </div>
                      </div>

                      <strong className="text-white block mt-2">3. Fijian digital support</strong>
                      <p className="text-[10px] leading-normal">
                        Developed and designed by <strong>Digital Bure Fiji</strong>. Visually integrated with real Fijian hospitality. Visit <a href="https://digitalbure.com" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">digitalbure.com</a> to onboard production email accounts, configure white-labeled agency emails, or consult on database pipelines.
                      </p>
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="pt-4 border-t border-white/5 mt-auto flex justify-end shrink-0">
                    <button
                      type="button"
                      onClick={() => setEmailModalOpen(false)}
                      className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer"
                    >
                      Dismiss Sandbox Viewer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default KioskMode;
