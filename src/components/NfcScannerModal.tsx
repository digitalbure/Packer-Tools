import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Cpu, 
  Smartphone, 
  Wifi, 
  CheckCircle, 
  AlertTriangle, 
  Search, 
  Database, 
  Info, 
  RefreshCw, 
  Tag, 
  Hammer, 
  Check 
} from 'lucide-react';
import { 
  collection, 
  doc, 
  updateDoc, 
  getDocs, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';

export interface NfcScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'associate' | 'search';
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

// Pre-defined mock tags for easy quick-start simulation testing
const MOCK_PRESET_TAGS = [
  { id: 'NFC_TAG_CAM_809', name: 'Premium Camera Rig Tag' },
  { id: 'NFC_TAG_LENS_412', name: 'Prime Lens Assembly Tag' },
  { id: 'NFC_TAG_DRONE_504', name: 'Flight Rig Drone Tag' },
  { id: 'NFC_TAG_RIG_201', name: 'Heavy Rigging Sling Tag' },
];

export default function NfcScannerModal({
  isOpen,
  onClose,
  mode,
  targetItem,
  onAssociateSuccess,
  onSearchSuccess,
  currentUser
}: NfcScannerModalProps) {
  const [nfcSupported, setNfcSupported] = useState<boolean>(false);
  const [nfcState, setNfcState] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('Initializing scanner...');
  const [scannedTagId, setScannedTagId] = useState<string>('');
  const [manualTagInput, setManualTagInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // NDEFReader controller ref for clean cancellation on unmount/close
  const [ndefController, setNdefController] = useState<any>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Check for native NDEFReader support
    if ('NDEFReader' in window) {
      setNfcSupported(true);
      setNfcState('scanning');
      setStatusMessage('Web NFC adapter detected. Ready for physical tap...');
      startNativeNfcScan();
    } else {
      setNfcSupported(false);
      setNfcState('idle');
      setStatusMessage('NFC hardware not detected. Simulator mode activated.');
    }

    return () => {
      // Abort NFC scan if running
      if (ndefController) {
        try {
          ndefController.abort();
        } catch (e) {
          console.log('Abort error ignored', e);
        }
      }
    };
  }, [isOpen]);

  const startNativeNfcScan = async () => {
    try {
      const controller = new AbortController();
      setNdefController(controller);
      
      // @ts-ignore
      const ndef = new NDEFReader();
      await ndef.scan({ signal: controller.signal });
      
      setStatusMessage('NFC antenna listening... Place your tag on the device.');
      setNfcState('scanning');

      // @ts-ignore
      ndef.addEventListener('reading', ({ serialNumber }) => {
        if (serialNumber) {
          handleTagScanned(serialNumber);
        }
      });

      // @ts-ignore
      ndef.addEventListener('readingerror', () => {
        toast.error('Failed to read NFC tag. Make sure it is formatted.');
        setStatusMessage('Reading error. Please tap again.');
      });
    } catch (err: any) {
      console.error('NFC Scan failed:', err);
      // Fallback to simulation mode if permissions denied or error thrown
      setNfcSupported(false);
      setNfcState('idle');
      setStatusMessage('NFC scan initialization blocked. Simulator mode active.');
    }
  };

  const handleTagScanned = async (tagId: string) => {
    if (!tagId || isProcessing) return;
    setIsProcessing(true);
    setNfcState('success');
    setScannedTagId(tagId);
    setStatusMessage(`Tag detected! ID: ${tagId}`);
    triggerHaptic();

    try {
      if (mode === 'associate') {
        if (!targetItem) throw new Error('No target item selected for association');

        if (targetItem.type === 'gear') {
          // Update in users/{userId}/gearLibrary/{itemId}
          const itemRef = doc(db, 'users', currentUser.uid, 'gearLibrary', targetItem.id);
          await updateDoc(itemRef, { nfcTag: tagId });
          toast.success(`NFC Tag successfully associated with ${targetItem.name}!`);
        } else {
          // Update in inventories/{inventoryId}/items/{itemId}
          if (!targetItem.inventoryId) throw new Error('Missing inventory context');
          const itemRef = doc(db, 'inventories', targetItem.inventoryId, 'items', targetItem.id);
          await updateDoc(itemRef, { nfcTag: tagId });
          toast.success(`NFC Tag associated with inventory item ${targetItem.name}!`);
        }

        if (onAssociateSuccess) {
          onAssociateSuccess(tagId);
        }
        
        // Brief timeout for visual verification then close
        setTimeout(() => {
          onClose();
          resetState();
        }, 1500);

      } else {
        // Search / Lookup Mode
        setStatusMessage('Searching database for associated gear...');
        
        // 1. Search User Gear Library
        const gearColRef = collection(db, 'users', currentUser.uid, 'gearLibrary');
        const gearQuery = query(gearColRef, where('nfcTag', '==', tagId));
        const gearSnapshot = await getDocs(gearQuery);

        if (!gearSnapshot.empty) {
          const matchedGearDoc = gearSnapshot.docs[0];
          const gearItem = { id: matchedGearDoc.id, ...matchedGearDoc.data() };
          toast.success(`Equipment found! Opening ${gearItem.name || 'item'} details.`);
          if (onSearchSuccess) {
            onSearchSuccess(gearItem, 'gear');
          }
          onClose();
          resetState();
          return;
        }

        // 2. Search Inventories Items (Requires iterating inventories since collectionGroups are restricted)
        const inventoriesColRef = collection(db, 'inventories');
        const inventoriesSnapshot = await getDocs(inventoriesColRef);
        
        for (const invDoc of inventoriesSnapshot.docs) {
          const itemsColRef = collection(db, 'inventories', invDoc.id, 'items');
          const itemQuery = query(itemsColRef, where('nfcTag', '==', tagId));
          const itemSnapshot = await getDocs(itemQuery);
          
          if (!itemSnapshot.empty) {
            const matchedItemDoc = itemSnapshot.docs[0];
            const invItem = { id: matchedItemDoc.id, ...matchedItemDoc.data() };
            toast.success(`Inventory asset located inside sheet "${invDoc.data().name || 'sheet'}"!`);
            if (onSearchSuccess) {
              onSearchSuccess(invItem, 'inventory', invDoc.id);
            }
            onClose();
            resetState();
            return;
          }
        }

        // If no match found
        setNfcState('error');
        setErrorMessage(`No equipment is associated with NFC Tag ID "${tagId}".`);
        setStatusMessage('Unknown Tag ID. You can associate this tag to physical gear inside its edit panel.');
        toast.error('NFC tag recognized but not linked to any equipment.');
      }
    } catch (err: any) {
      console.error('NFC operation error:', err);
      setNfcState('error');
      setErrorMessage(err.message || 'Firestore write transaction failed');
      toast.error('Failed to register NFC data.');
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerHaptic = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
  };

  const handleSimulatePresetTap = (tagId: string) => {
    handleTagScanned(tagId);
  };

  const handleManualInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTagInput.trim()) {
      toast.error('Please enter a valid tag identifier');
      return;
    }
    handleTagScanned(manualTagInput.trim());
  };

  const resetState = () => {
    setNfcState('idle');
    setScannedTagId('');
    setManualTagInput('');
    setIsProcessing(false);
    setErrorMessage('');
    setStatusMessage('System reset. Ready to scan.');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-neutral-950/85 backdrop-blur-md z-[200] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 30 }}
          className="bg-neutral-900 border border-neutral-800 text-neutral-100 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col font-sans"
        >
          {/* Header */}
          <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#F27D26]/10 flex items-center justify-center text-[#F27D26]">
                <Cpu size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-neutral-200">
                  {mode === 'associate' ? 'NFC Hardware Link' : 'NFC Asset Scanner'}
                </h3>
                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">
                  Secure Equipment Association
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-neutral-800 rounded-xl transition text-neutral-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content Area */}
          <div className="p-6 flex-1 flex flex-col items-center justify-center space-y-6">
            
            {/* Pulsing Concentric NFC Ring Animation */}
            <div className="relative w-40 h-40 flex items-center justify-center">
              <AnimatePresence>
                {nfcState === 'scanning' && (
                  <>
                    <motion.div
                      animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                      className="absolute inset-0 rounded-full border-2 border-[#F27D26]/40"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.6], opacity: [0.8, 0] }}
                      transition={{ duration: 2, delay: 0.6, repeat: Infinity, ease: "easeOut" }}
                      className="absolute inset-0 rounded-full border border-[#F27D26]/30"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.2], opacity: [1, 0] }}
                      transition={{ duration: 2, delay: 1.2, repeat: Infinity, ease: "easeOut" }}
                      className="absolute inset-0 rounded-full border border-[#F27D26]/20"
                    />
                  </>
                )}
              </AnimatePresence>

              {/* Central Badge Icon */}
              <div className={`w-24 h-24 rounded-full flex flex-col items-center justify-center shadow-lg transition-all duration-300 relative z-10 ${
                nfcState === 'success' ? 'bg-emerald-950/80 border-2 border-emerald-500 text-emerald-400' :
                nfcState === 'error' ? 'bg-red-950/80 border-2 border-red-500 text-red-400' :
                'bg-neutral-800 border-2 border-neutral-700 text-[#F27D26]'
              }`}>
                {nfcState === 'success' ? (
                  <CheckCircle size={44} className="animate-bounce" />
                ) : nfcState === 'error' ? (
                  <AlertTriangle size={44} />
                ) : (
                  <>
                    <Wifi size={40} className="transform rotate-45 animate-pulse" />
                    <Smartphone size={24} className="absolute text-neutral-400 mt-2" />
                  </>
                )}
              </div>
            </div>

            {/* Target Item context box (Associate Mode Only) */}
            {mode === 'associate' && targetItem && (
              <div className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl p-4 text-center">
                <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-black">Target Asset</p>
                <p className="text-sm font-extrabold text-neutral-200 mt-0.5">{targetItem.name}</p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="text-[9px] font-black uppercase bg-neutral-800 text-neutral-300 px-2.5 py-1 rounded-full">
                    {targetItem.type === 'gear' ? 'Gear Library' : 'Inventory Sheet'}
                  </span>
                  {targetItem.inventoryId && (
                    <span className="text-[9px] font-mono font-bold text-[#F27D26]">
                      ID: {targetItem.id.substring(0, 8)}...
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Status Display Text */}
            <div className="text-center space-y-2">
              <p className={`text-xs font-bold leading-relaxed px-4 ${
                nfcState === 'success' ? 'text-emerald-400 font-extrabold' :
                nfcState === 'error' ? 'text-red-400 font-extrabold' :
                'text-neutral-300'
              }`}>
                {statusMessage}
              </p>
              
              {nfcState === 'error' && errorMessage && (
                <p className="text-[11px] text-neutral-500 font-semibold px-4">
                  {errorMessage}
                </p>
              )}
            </div>

            {/* Simulator Panel (Highly customizable for all devices) */}
            <div className="w-full border-t border-neutral-800/80 pt-5 mt-2 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-1.5">
                  <Hammer size={12} className="text-[#F27D26]" />
                  <span>NFC Tag Simulator Sandbox</span>
                </span>
                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                  nfcSupported ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                }`}>
                  {nfcSupported ? 'Physical Active' : 'Simulation Mode'}
                </span>
              </div>

              {/* Mock Preset Badges */}
              <div className="grid grid-cols-2 gap-2">
                {MOCK_PRESET_TAGS.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => handleSimulatePresetTap(tag.id)}
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

              {/* Custom manual string entry */}
              <form onSubmit={handleManualInputSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <Tag size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="text"
                    value={manualTagInput}
                    onChange={(e) => setManualTagInput(e.target.value)}
                    placeholder="Enter custom NFC Tag UID / Serial..."
                    disabled={isProcessing}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-8 pr-3 py-2.5 outline-none focus:border-[#F27D26] transition text-[11px] font-mono text-neutral-200 uppercase"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isProcessing || !manualTagInput.trim()}
                  className="px-4 py-2.5 bg-[#F27D26] hover:bg-[#F27D26]/90 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition cursor-pointer"
                >
                  Tap
                </button>
              </form>

              {nfcState !== 'idle' && (
                <button
                  onClick={resetState}
                  className="w-full text-center text-[10px] text-neutral-500 hover:text-neutral-300 font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 pt-1"
                >
                  <RefreshCw size={10} />
                  <span>Restart Scanner</span>
                </button>
              )}

            </div>

          </div>

          {/* Footer Info */}
          <div className="p-4 bg-neutral-950/80 border-t border-neutral-800 flex items-center justify-center gap-1.5 text-[10px] text-neutral-400 font-bold uppercase">
            <Info size={12} className="text-[#F27D26]" />
            <span>Tag simulation is recommended for standard browser testing</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
