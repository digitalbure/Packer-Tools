import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { 
  Cpu, 
  Wifi, 
  Smartphone, 
  CheckCircle, 
  AlertTriangle, 
  X, 
  RefreshCw, 
  Tag, 
  Info,
  Radio,
  Edit3,
  ExternalLink,
  ShieldCheck,
  Check,
  Volume2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { 
  nfcHardware, 
  isWebNfcSupported, 
  NfcReadResult, 
  logIdentificationEvent,
  logScanEvent
} from '../lib/hardwareProviders';
import { hapticScanSuccess } from '../utils/haptics';

export interface NfcScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'associate' | 'search' | 'write';
  targetItem?: {
    id: string;
    name: string;
    type: 'gear' | 'inventory';
    inventoryId?: string; // required if type === 'inventory'
  };
  onAssociateSuccess?: (tagId: string) => void;
  onSearchSuccess?: (foundItem: any, type: 'gear' | 'inventory', inventoryId?: string) => void;
  currentUser: any;
}

// Pre-defined preset tags for hardware wedge / fallback testing
const PRESET_TAGS = [
  { id: '04:A2:3B:4C:5D:6E:7F', name: 'NTAG215 Hardware Tag #1' },
  { id: '04:1B:9C:E2:44:81:80', name: 'NTAG213 High-Temp Tag #2' },
  { id: '04:77:88:99:AA:BB:CC', name: 'Mifare Ultralight Tag #3' },
  { id: '04:F0:E1:D2:C3:B4:A5', name: 'On-Metal Shield Tag #4' },
];

export default function NfcScannerModal({
  isOpen,
  onClose,
  mode: initialMode = 'search',
  targetItem,
  onAssociateSuccess,
  onSearchSuccess,
  currentUser
}: NfcScannerModalProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'scan' | 'write'>('scan');
  const [nfcSupported, setNfcSupported] = useState<boolean>(false);
  const [nfcState, setNfcState] = useState<'idle' | 'scanning' | 'writing' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('Initializing NFC hardware...');
  const [scannedTagId, setScannedTagId] = useState<string>('');
  const [readResult, setReadResult] = useState<NfcReadResult | null>(null);
  const [manualTagInput, setManualTagInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Play audio chime on tap
  const playTapChime = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, ctx.currentTime); // A6
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {}
  };

  useEffect(() => {
    if (initialMode === 'write') {
      setActiveTab('write');
    } else {
      setActiveTab('scan');
    }
  }, [initialMode, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      nfcHardware.stopScan();
      return;
    }

    const supported = isWebNfcSupported();
    setNfcSupported(supported);

    if (activeTab === 'scan') {
      if (supported) {
        startHardwareScan();
      } else {
        setNfcState('idle');
        setStatusMessage('NFC write/scan requires Android Chrome. Web NFC is not supported on iOS Safari.');
      }
    } else if (activeTab === 'write') {
      setNfcState('idle');
      if (supported) {
        setStatusMessage('Hold a physical NFC tag near the back of the device to encode the Asset Passport URL.');
      } else {
        setStatusMessage('NFC write/scan requires Android Chrome. Tag encoding cannot run in this browser.');
      }
    }

    return () => {
      nfcHardware.stopScan();
    };
  }, [isOpen, activeTab]);

  const startHardwareScan = async () => {
    try {
      setNfcState('scanning');
      setStatusMessage('NFC antenna active. Tap physical tag against device...');

      await nfcHardware.startScan({
        onReading: (result: NfcReadResult) => {
          handleTagRead(result);
        },
        onError: (err: any) => {
          console.warn('NFC Read error:', err);
          setStatusMessage('NFC scan error. Tap tag again.');
        },
        onStatusChange: (status: string) => {
          setStatusMessage(status);
        }
      });
    } catch (err: any) {
      console.error('Failed to start Web NFC scan:', err);
      setNfcState('idle');
      setStatusMessage('NFC write/scan requires Android Chrome.');
    }
  };

  const handleTagRead = async (result: NfcReadResult) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setNfcState('success');
    setScannedTagId(result.serialNumber);
    setReadResult(result);
    playTapChime();
    hapticScanSuccess();

    try {
      if (initialMode === 'associate') {
        if (!targetItem) throw new Error('No target asset designated for link');

        const tagId = result.serialNumber;

        if (targetItem.type === 'gear') {
          const itemRef = doc(db, 'users', currentUser.uid, 'gearLibrary', targetItem.id);
          await updateDoc(itemRef, { 
            nfcTag: tagId, 
            nfcTagWritten: true,
            updatedAt: new Date().toISOString() 
          });
          toast.success(`NFC Tag [${tagId}] linked to ${targetItem.name}!`);
        } else {
          if (!targetItem.inventoryId) throw new Error('Missing inventory context');
          const itemRef = doc(db, 'inventories', targetItem.inventoryId, 'items', targetItem.id);
          await updateDoc(itemRef, { 
            nfcTag: tagId, 
            nfcTagWritten: true,
            updatedAt: new Date().toISOString() 
          });
          toast.success(`NFC Tag linked to ${targetItem.name}!`);
        }

        await logIdentificationEvent(currentUser.uid, {
          eventType: 'tag_assign',
          assetId: targetItem.id,
          assetName: targetItem.name,
          result: 'success',
          metadata: { nfcTag: tagId, serialNumber: result.serialNumber }
        });

        await logScanEvent({
          assetId: targetItem.id,
          assetName: targetItem.name,
          tagType: 'nfc',
          scanContext: 'tag-associate',
          userId: currentUser?.uid,
          userEmail: currentUser?.email,
          tagValue: tagId,
          metadata: { mode: 'associate', serialNumber: result.serialNumber }
        });

        if (onAssociateSuccess) {
          onAssociateSuccess(tagId);
        }

        setTimeout(() => {
          onClose();
          resetState();
        }, 1200);

      } else {
        // Search / Lookup Mode -> Resolves directly to the Asset Passport page
        setStatusMessage('Searching registered equipment records...');
        
        // 1. Direct match by extracted Asset ID from the NDEF URL
        if (result.extractedAssetId) {
          try {
            const directRef = collection(db, 'users', currentUser.uid, 'gearLibrary');
            const snap = await getDocs(query(directRef, where('id', '==', result.extractedAssetId)));
            if (!snap.empty) {
              const matched = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
              toast.success(`Asset Passport resolved: ${matched.name || 'Item'}!`);
              
              await logScanEvent({
                assetId: matched.id,
                assetName: matched.name,
                tagType: 'nfc',
                scanContext: 'passport-lookup',
                userId: currentUser?.uid,
                userEmail: currentUser?.email,
                tagValue: result.serialNumber || result.extractedAssetId,
                metadata: { extractedAssetId: result.extractedAssetId, passportUrl: result.passportUrl }
              });

              if (onSearchSuccess) {
                onSearchSuccess(matched, 'gear');
              } else {
                navigate(`/gear/${matched.id}?owner=${matched.ownerId || currentUser?.uid || ''}`);
              }
              onClose();
              resetState();
              return;
            }
          } catch (e) {}
        }

        // 2. Query User's Gear Library by nfcTag
        const gearColRef = collection(db, 'users', currentUser.uid, 'gearLibrary');
        const gearQuery = query(gearColRef, where('nfcTag', '==', result.serialNumber));
        const gearSnapshot = await getDocs(gearQuery);

        if (!gearSnapshot.empty) {
          const matchedGearDoc = gearSnapshot.docs[0];
          const gearItem = { id: matchedGearDoc.id, ...matchedGearDoc.data() } as any;
          toast.success(`Asset Located: ${gearItem.name}!`);

          await logScanEvent({
            assetId: gearItem.id,
            assetName: gearItem.name,
            tagType: 'nfc',
            scanContext: 'passport-lookup',
            userId: currentUser?.uid,
            userEmail: currentUser?.email,
            tagValue: result.serialNumber,
            metadata: { source: 'gearLibrary' }
          });

          if (onSearchSuccess) {
            onSearchSuccess(gearItem, 'gear');
          } else {
            navigate(`/gear/${gearItem.id}?owner=${gearItem.ownerId || currentUser?.uid || ''}`);
          }
          onClose();
          resetState();
          return;
        }

        // 3. Query inventories
        const inventoriesColRef = collection(db, 'inventories');
        const inventoriesSnapshot = await getDocs(inventoriesColRef);
        for (const invDoc of inventoriesSnapshot.docs) {
          const itemsColRef = collection(db, 'inventories', invDoc.id, 'items');
          const itemQuery = query(itemsColRef, where('nfcTag', '==', result.serialNumber));
          const itemSnapshot = await getDocs(itemQuery);
          if (!itemSnapshot.empty) {
            const matchedItemDoc = itemSnapshot.docs[0];
            const invItem = { id: matchedItemDoc.id, ...matchedItemDoc.data() } as any;
            toast.success(`Asset Located in sheet "${invDoc.data().name || 'sheet'}": ${invItem.name}`);

            await logScanEvent({
              assetId: invItem.id,
              assetName: invItem.name,
              tagType: 'nfc',
              scanContext: 'passport-lookup',
              userId: currentUser?.uid,
              userEmail: currentUser?.email,
              tagValue: result.serialNumber,
              metadata: { source: 'inventorySheet', inventoryId: invDoc.id }
            });

            if (onSearchSuccess) {
              onSearchSuccess(invItem, 'inventory', invDoc.id);
            } else {
              navigate(`/gear/${invItem.id}?owner=${currentUser?.uid || ''}`);
            }
            onClose();
            resetState();
            return;
          }
        }

        // 4. If NDEF URL is present in the tag, navigate to it directly
        if (result.passportUrl) {
          toast.success(`Navigating to scanned Asset Passport...`);
          const parsed = nfcHardware.parsePassportUrl(result.passportUrl);
          if (parsed?.assetId) {
            await logScanEvent({
              assetId: parsed.assetId,
              assetName: 'Scanned Passport URL Tag',
              tagType: 'nfc',
              scanContext: 'passport-lookup',
              userId: currentUser?.uid,
              userEmail: currentUser?.email,
              tagValue: result.serialNumber,
              metadata: { passportUrl: result.passportUrl }
            });

            navigate(`/gear/${parsed.assetId}?owner=${parsed.ownerId || currentUser?.uid || ''}`);
            onClose();
            resetState();
            return;
          }
        }

        // Tag not found
        setNfcState('error');
        setErrorMessage(`No equipment found matching NFC Tag [${result.serialNumber}].`);
        setStatusMessage('Tag read successfully, but is not linked to any asset.');
      }
    } catch (err: any) {
      console.error('NFC processing error:', err);
      setNfcState('error');
      setErrorMessage(err.message || 'Operation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePhysicalWrite = async () => {
    if (!targetItem) {
      toast.error('No target asset selected to encode.');
      return;
    }

    if (!nfcSupported) {
      toast.error('NFC write/scan requires Android Chrome. Web NFC is not supported on this platform.');
      return;
    }

    setIsProcessing(true);
    setNfcState('writing');
    setStatusMessage('Hold physical NFC tag against the device to write Asset Passport URL...');

    try {
      // Standard Asset Passport URL that encodes into the NFC tag
      const passportUrl = `${window.location.origin}/#/gear/${targetItem.id}?owner=${currentUser?.uid || ''}`;
      
      await nfcHardware.writePassportTag({
        passportUrl,
        assetId: targetItem.id,
        assetName: targetItem.name,
        ownerId: currentUser?.uid,
        workspaceId: currentUser?.activeWorkspaceId
      }, {
        onStatusChange: (status) => setStatusMessage(status)
      });

      setNfcState('success');
      playTapChime();
      hapticScanSuccess();

      // Update Firestore asset record with nfcTagWritten: true
      if (targetItem.type === 'gear') {
        const itemRef = doc(db, 'users', currentUser.uid, 'gearLibrary', targetItem.id);
        await updateDoc(itemRef, { 
          nfcTagWritten: true,
          updatedAt: new Date().toISOString() 
        });
      } else if (targetItem.inventoryId) {
        const itemRef = doc(db, 'inventories', targetItem.inventoryId, 'items', targetItem.id);
        await updateDoc(itemRef, { 
          nfcTagWritten: true,
          updatedAt: new Date().toISOString() 
        });
      }

      toast.success(`Physical NFC Tag encoded with Asset Passport URL for ${targetItem.name}!`);

      await logIdentificationEvent(currentUser.uid, {
        eventType: 'nfc_write',
        assetId: targetItem.id,
        assetName: targetItem.name,
        result: 'success',
        metadata: { passportUrl }
      });

      await logScanEvent({
        assetId: targetItem.id,
        assetName: targetItem.name,
        tagType: 'nfc',
        scanContext: 'encoder-write',
        userId: currentUser?.uid,
        userEmail: currentUser?.email,
        tagValue: targetItem.id,
        metadata: { passportUrl, mode: 'physical-write' }
      });

      setTimeout(() => {
        onClose();
        resetState();
      }, 1500);
    } catch (err: any) {
      console.error('NFC write error:', err);
      setNfcState('error');
      setErrorMessage(err.message || 'Failed to write NFC tag');
      toast.error('NFC Write Failed. Make sure the tag is unlocked and compatible (NTAG213/215/216).');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTagInput.trim()) {
      toast.error('Please enter a tag identifier');
      return;
    }
    handleTagRead({
      serialNumber: manualTagInput.trim(),
      records: [{ recordType: 'text', data: manualTagInput.trim() }]
    });
  };

  const resetState = () => {
    setNfcState('idle');
    setScannedTagId('');
    setReadResult(null);
    setManualTagInput('');
    setIsProcessing(false);
    setErrorMessage('');
    if (activeTab === 'scan' && nfcSupported) {
      startHardwareScan();
    }
  };

  if (!isOpen) return null;

  const passportUrl = targetItem 
    ? `${window.location.origin}/#/gear/${targetItem.id}?owner=${currentUser?.uid || ''}`
    : '';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-neutral-950/85 backdrop-blur-md z-[200] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          className="bg-neutral-900 border border-neutral-800 text-neutral-100 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col font-sans"
        >
          {/* Header */}
          <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#F27D26]/15 flex items-center justify-center text-[#F27D26]">
                <Radio size={20} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-neutral-200">
                  {initialMode === 'associate' ? 'NFC Hardware Link' : initialMode === 'write' ? 'NFC Tag Encoder' : 'NFC Asset Scanner'}
                </h3>
                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
                  NTAG213/215/216 Silicon & Passports
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-neutral-800 rounded-xl transition text-neutral-400 hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Graceful Fallback / Platform Notice */}
          {!nfcSupported && (
            <div className="bg-amber-950/70 border-b border-amber-800/80 px-4 py-3 flex items-start gap-2.5">
              <AlertCircle size={18} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-200 leading-tight">
                <p className="font-extrabold text-white">NFC write/scan requires Android Chrome</p>
                <p className="text-amber-300/80 mt-0.5">
                  Web NFC is Chrome-on-Android only (no iOS Safari support). Use manual tag entry, keyboard wedge reader, or open on an Android Chrome device.
                </p>
              </div>
            </div>
          )}

          {/* Mode Tabs */}
          {targetItem && (
            <div className="flex border-b border-neutral-800 bg-neutral-950/50 p-1.5">
              <button
                onClick={() => setActiveTab('scan')}
                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'scan' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Wifi size={14} />
                <span>Read / Scan</span>
              </button>
              <button
                onClick={() => setActiveTab('write')}
                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                  activeTab === 'write' ? 'bg-[#F27D26] text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Edit3 size={14} />
                <span>Write Passport</span>
              </button>
            </div>
          )}

          {/* Body */}
          <div className="p-6 flex-1 flex flex-col items-center justify-center space-y-6">
            
            {/* Concentric Animated NFC Rings */}
            <div className="relative w-36 h-36 flex items-center justify-center">
              <AnimatePresence>
                {(nfcState === 'scanning' || nfcState === 'writing') && (
                  <>
                    <motion.div
                      animate={{ scale: [1, 2.1], opacity: [0.6, 0] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                      className={`absolute inset-0 rounded-full border-2 ${nfcState === 'writing' ? 'border-sky-500/50' : 'border-[#F27D26]/50'}`}
                    />
                    <motion.div
                      animate={{ scale: [1, 1.5], opacity: [0.8, 0] }}
                      transition={{ duration: 1.8, delay: 0.5, repeat: Infinity, ease: "easeOut" }}
                      className={`absolute inset-0 rounded-full border ${nfcState === 'writing' ? 'border-sky-500/30' : 'border-[#F27D26]/30'}`}
                    />
                  </>
                )}
              </AnimatePresence>

              {/* Central Badge */}
              <div className={`w-24 h-24 rounded-full flex flex-col items-center justify-center shadow-xl transition-all duration-300 relative z-10 ${
                nfcState === 'success' ? 'bg-emerald-950/90 border-2 border-emerald-500 text-emerald-400' :
                nfcState === 'error' ? 'bg-red-950/90 border-2 border-red-500 text-red-400' :
                nfcState === 'writing' ? 'bg-sky-950/90 border-2 border-sky-500 text-sky-400' :
                'bg-neutral-800 border-2 border-neutral-700 text-[#F27D26]'
              }`}>
                {nfcState === 'success' ? (
                  <CheckCircle size={42} className="animate-bounce" />
                ) : nfcState === 'error' ? (
                  <AlertTriangle size={42} />
                ) : nfcState === 'writing' ? (
                  <Edit3 size={38} className="animate-pulse" />
                ) : (
                  <>
                    <Wifi size={38} className="transform rotate-45 animate-pulse" />
                    <Smartphone size={22} className="absolute text-neutral-400 mt-2" />
                  </>
                )}
              </div>
            </div>

            {/* Target Item context */}
            {targetItem && (
              <div className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl p-4 text-center">
                <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-black">Target Asset</p>
                <p className="text-sm font-extrabold text-neutral-200 mt-0.5">{targetItem.name}</p>
                
                {activeTab === 'write' && (
                  <div className="mt-2 text-left bg-neutral-900/80 p-2.5 rounded-xl border border-neutral-800 space-y-1">
                    <p className="text-[10px] text-neutral-400 font-bold uppercase">Asset Passport URL to Encode:</p>
                    <p className="text-[10px] font-mono text-sky-400 truncate">{passportUrl}</p>
                  </div>
                )}
              </div>
            )}

            {/* Status Text */}
            <div className="text-center space-y-1.5 px-4">
              <p className={`text-xs font-bold leading-relaxed ${
                nfcState === 'success' ? 'text-emerald-400 font-extrabold' :
                nfcState === 'error' ? 'text-red-400 font-extrabold' :
                'text-neutral-300'
              }`}>
                {statusMessage}
              </p>
              {errorMessage && (
                <p className="text-[11px] text-neutral-500 font-semibold">{errorMessage}</p>
              )}
            </div>

            {/* Action Buttons for Physical Write */}
            {activeTab === 'write' && (
              <button
                onClick={handlePhysicalWrite}
                disabled={isProcessing || !nfcSupported}
                className="w-full py-3 bg-[#F27D26] hover:bg-[#F27D26]/90 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <Edit3 size={16} />
                <span>{isProcessing ? 'Encoding Tag...' : !nfcSupported ? 'Requires Android Chrome' : 'Write Passport Tag Now'}</span>
              </button>
            )}

            {/* Hardware Status & Wedge Fallback Options */}
            <div className="w-full border-t border-neutral-800/80 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-1.5">
                  <Cpu size={12} className="text-[#F27D26]" />
                  <span>Hardware & Wedge Fallback</span>
                </span>
                <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                  nfcSupported ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                }`}>
                  {nfcSupported ? 'Web NFC Active' : 'Fallback / Wedge Mode'}
                </span>
              </div>

              {/* Preset Tag Quick Taps */}
              <div className="grid grid-cols-2 gap-2">
                {PRESET_TAGS.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => handleTagRead({
                      serialNumber: tag.id,
                      records: [{ recordType: 'text', data: tag.id }]
                    })}
                    disabled={isProcessing}
                    className="p-2.5 bg-neutral-950 border border-neutral-800 rounded-xl hover:bg-neutral-800/80 text-left transition text-neutral-300 group hover:border-[#F27D26]/50 disabled:opacity-50 cursor-pointer"
                  >
                    <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider group-hover:text-[#F27D26] truncate">
                      {tag.name}
                    </p>
                    <p className="text-[10px] font-mono font-black text-neutral-200 mt-0.5 truncate">
                      {tag.id}
                    </p>
                  </button>
                ))}
              </div>

              {/* Manual input */}
              <form onSubmit={handleManualInputSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <Tag size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="text"
                    value={manualTagInput}
                    onChange={(e) => setManualTagInput(e.target.value)}
                    placeholder="UID or Keyboard Wedge Tag..."
                    disabled={isProcessing}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-8 pr-3 py-2.5 outline-none focus:border-[#F27D26] transition text-[11px] font-mono text-neutral-200 uppercase"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isProcessing || !manualTagInput.trim()}
                  className="px-4 py-2.5 bg-[#F27D26] hover:bg-[#F27D26]/90 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition cursor-pointer"
                >
                  Submit
                </button>
              </form>

              {nfcState !== 'idle' && (
                <button
                  onClick={resetState}
                  className="w-full text-center text-[10px] text-neutral-500 hover:text-neutral-300 font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 pt-1 cursor-pointer"
                >
                  <RefreshCw size={10} />
                  <span>Reset / Re-scan</span>
                </button>
              )}
            </div>

          </div>

          {/* Footer */}
          <div className="p-4 bg-neutral-950/80 border-t border-neutral-800 flex items-center justify-between text-[10px] text-neutral-400 font-bold">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>Multi-Tenant Passport Protocol</span>
            </span>
            <span className="font-mono text-neutral-500">v5.21</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
