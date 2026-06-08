import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, RefreshCw, Check, Loader2, Zap, Package, AlertCircle, Layers, QrCode } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { bulkIdentifyItems } from '../services/geminiService';
import { toast } from 'sonner';
import { collection, addDoc, doc, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, GearItem, PackingItem } from '../types';
import { Html5QrcodeScanner } from 'html5-qrcode';
import confetti from 'canvas-confetti';

interface BulkScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  listId: string;
  user: UserProfile;
}

export default function BulkScanModal({ isOpen, onClose, listId, user }: BulkScanModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isIdentifying, setIsIdentifying] = useState(false);
   const [detectedItems, setDetectedItems] = useState<{ name: string; category: string; selected: boolean; tags: string[]; organizationTip?: string }[]>([]);
  const [isLikelyComplete, setIsLikelyComplete] = useState(true);
  const [warningReason, setWarningReason] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState(false);

  const [activeMode, setActiveMode] = useState<'onboard' | 'qr_pack'>('onboard');
  const [packingListItems, setPackingListItems] = useState<PackingItem[]>([]);
  const [manualCodeInput, setManualCodeInput] = useState('');
  const [isProcessingQR, setIsProcessingQR] = useState(false);
  const [scannedSessionLog, setScannedSessionLog] = useState<Array<{
    code: string;
    itemName: string;
    status: 'packed_existing' | 'added_from_library' | 'created_new' | 'already_packed';
    timestamp: string;
    category?: string;
  }>>([]);

  // Load packing list items on open/change
  useEffect(() => {
    if (isOpen && listId) {
      const fetchPackingItems = async () => {
        try {
          const itemsSnap = await getDocs(collection(db, 'packingLists', listId, 'items'));
          const itemsList = itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PackingItem[];
          setPackingListItems(itemsList);
        } catch (err) {
          console.error("Error fetching packing list items for QR scan mode:", err);
        }
      };
      fetchPackingItems();
    }
  }, [isOpen, listId]);

  // QR Code matching & packing handling logic
  const performQrMatchingLogic = async (code: string) => {
    if (isProcessingQR) return;
    setIsProcessingQR(true);
    try {
      let decodedValue = code.trim();
      if (decodedValue.includes('/gear/')) {
        const parts = decodedValue.split('/gear/');
        if (parts.length > 1) {
          decodedValue = parts[1];
        }
      }

      // Check if already logged in this exact session recently to prevent instant duplicate alerts
      const indexInLog = scannedSessionLog.findIndex(log => log.code === code);
      if (indexInLog !== -1 && (Date.now() - new Date(scannedSessionLog[indexInLog].timestamp).getTime() < 3000)) {
        setIsProcessingQR(false);
        return;
      }

      // 1. Search existing packing list items context
      const matchingItemIndex = packingListItems.findIndex(item => 
        (item.assetTag && item.assetTag.trim().toLowerCase() === decodedValue.toLowerCase()) || 
        item.id === decodedValue
      );

      if (matchingItemIndex !== -1) {
        const item = packingListItems[matchingItemIndex];
        
        if (item.status === 'packed') {
          // If already marked packed, just display note in log so they have visual confirmation
          setScannedSessionLog(prev => [
            {
              code,
              itemName: item.name,
              status: 'already_packed',
              timestamp: new Date().toISOString(),
              category: item.aiLabel || 'General'
            },
            ...prev
          ]);
          toast.info(`"${item.name}" was already packed.`);
          setIsProcessingQR(false);
          return;
        }

        // Update state list
        const updatedItems = [...packingListItems];
        updatedItems[matchingItemIndex] = { ...item, status: 'packed' };
        setPackingListItems(updatedItems);

        // Save status in Firestore
        await updateDoc(doc(db, 'packingLists', listId, 'items', item.id), {
          status: 'packed'
        });

        // Add to session log
        setScannedSessionLog(prev => [
          {
            code,
            itemName: item.name,
            status: 'packed_existing',
            timestamp: new Date().toISOString(),
            category: item.aiLabel || 'General'
          },
          ...prev
        ]);

        confetti({
          particleCount: 65,
          spread: 45,
          origin: { y: 0.8 }
        });

        toast.success(`Packed: "${item.name}" checked off!`);
        setIsProcessingQR(false);
        return;
      }

      // 2. Query primary Gear Library matching assetTag
      const gearQuery = query(
        collection(db, 'users', user.uid, 'gearLibrary'),
        where('assetTag', '==', decodedValue)
      );
      const gearSnap = await getDocs(gearQuery);

      if (!gearSnap.empty) {
        const gearDoc = gearSnap.docs[0];
        const gearData = gearDoc.data();
        const gearName = gearData.name || "Library Item";

        const randomTag = decodedValue;
        const newPackingItem = {
          listId,
          name: gearName,
          photoUrls: gearData.photoUrls || [],
          assetTag: randomTag,
          status: 'packed' as const,
          aiLabel: gearData.aiLabel || gearData.category || "General",
          description: gearData.description || "Direct barcode scan checkout on-the-fly",
          notes: "Dynamically packed from gear library.",
          tags: gearData.tags || [],
          organizationTip: gearData.organizationTip || '',
          order: Date.now(),
          gearId: gearDoc.id,
          createdAt: new Date().toISOString()
        };

        const docRef = await addDoc(collection(db, 'packingLists', listId, 'items'), newPackingItem);

        const createdItem: PackingItem = {
          id: docRef.id,
          ...newPackingItem
        };
        setPackingListItems(prev => [...prev, createdItem]);

        setScannedSessionLog(prev => [
          {
            code,
            itemName: gearName,
            status: 'added_from_library',
            timestamp: new Date().toISOString(),
            category: newPackingItem.aiLabel
          },
          ...prev
        ]);

        confetti({
          particleCount: 100,
          spread: 60,
          origin: { y: 0.8 }
        });

        toast.success(`Dynamic Pack: "${gearName}" added from library!`);
        setIsProcessingQR(false);
        return;
      }

      // 3. Register a custom general asset on-the-fly
      const customName = `Custom Unit (${decodedValue})`;
      const newCustomItem = {
        listId,
        name: customName,
        photoUrls: [],
        assetTag: decodedValue,
        status: 'packed' as const,
        aiLabel: "Unassigned",
        description: "Unlisted dynamic scan entry.",
        notes: "Created during packaging run.",
        tags: ["custom-on-the-fly"],
        organizationTip: "",
        order: Date.now(),
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'packingLists', listId, 'items'), newCustomItem);

      const createdItem: PackingItem = {
        id: docRef.id,
        ...newCustomItem
      };
      setPackingListItems(prev => [...prev, createdItem]);

      setScannedSessionLog(prev => [
        {
          code,
          itemName: customName,
          status: 'created_new',
          timestamp: new Date().toISOString(),
          category: "Unassigned"
        },
        ...prev
      ]);

      confetti({
        particleCount: 40,
        spread: 30,
        origin: { y: 0.8 }
      });

      toast.success(`Created & Packed general asset: ${decodedValue}`);
      setIsProcessingQR(false);
    } catch (err) {
      console.error("QR match processing failure:", err);
      toast.error("Error linking scanned tag.");
      setIsProcessingQR(false);
    }
  };

  const handleQRScanned = (scannedValue: string) => {
    if (!scannedValue) return;
    performQrMatchingLogic(scannedValue);
  };

  // QR Real-time Camera Scanner Effect
  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    if (isOpen && activeMode === 'qr_pack') {
      const timer = setTimeout(() => {
        const element = document.getElementById("qr-bulk-scanner");
        if (element) {
          try {
            scanner = new Html5QrcodeScanner(
              "qr-bulk-scanner",
              { fps: 10, qrbox: { width: 250, height: 250 } },
              /* verbose= */ false
            );
            scanner.render(
              (decodedText) => {
                handleQRScanned(decodedText);
              },
              (err) => {
                // Silently ignore camera frame search updates
              }
            );
          } catch (err) {
            console.error("Failed to start HTML5 QR scanner on popup: ", err);
          }
        }
      }, 300);

      return () => {
        clearTimeout(timer);
        if (scanner) {
          try {
            scanner.clear().catch(e => console.log("Non-blocking context error clearing:", e));
          } catch (e) {
            console.log("Cleanup exception ignored:", e);
          }
        }
      };
    }
  }, [isOpen, activeMode]);

  useEffect(() => {
    if (isOpen && activeMode === 'onboard') {
      startCamera(false);
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, activeMode]);

  const startCamera = async (isManualClick = false) => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCameraError(false);
    } catch (error) {
      console.warn("Camera access denied or unavailable:", error);
      setCameraError(true);
      if (isManualClick) {
        toast.error("Could not access camera. Please ensure permissions are granted or upload an image instead.");
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setCapturedImage(dataUrl);
        handleBulkIdentify(dataUrl);
      };
      reader.onerror = (error) => {
        console.error("Error reading file:", error);
        toast.error("Failed to read image file.");
      };
      reader.readAsDataURL(file);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        handleBulkIdentify(dataUrl);
      }
    }
  };

  const handleBulkIdentify = async (base64Data: string) => {
    setIsIdentifying(true);
    const base64 = base64Data.split(',')[1];
    try {
      const result = await bulkIdentifyItems(base64);
      setDetectedItems(result.items.map(item => ({ ...item, selected: true })));
      setIsLikelyComplete(result.isLikelyComplete);
      setWarningReason(result.reason || null);
      
      if (!result.isLikelyComplete) {
        toast.warning(result.reason || "Some items might be hidden under layers.");
      }
    } catch (error) {
      console.error("Bulk identification error:", error);
      toast.error("Failed to identify items.");
    } finally {
      setIsIdentifying(false);
    }
  };

  const [saveToLibrary, setSaveToLibrary] = useState(true);

  const handleSave = async () => {
    const selectedItems = detectedItems.filter(item => item.selected);
    if (selectedItems.length === 0) {
      toast.error("No items selected.");
      return;
    }

    try {
      const batchPromises = selectedItems.map(async (item) => {
        const randomTag = `TAG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const itemData = {
          listId,
          name: item.name || "Unknown Item",
          photoUrls: [capturedImage],
          assetTag: randomTag,
          status: 'pending',
          aiLabel: item.category || "General",
          description: 'Bulk scanned item',
          notes: '',
          tags: item.tags || [],
          organizationTip: item.organizationTip || '',
          order: Date.now(),
          createdAt: new Date().toISOString(),
        };

        // Add to packing list
        const addToListPromise = addDoc(collection(db, 'packingLists', listId, 'items'), itemData);

        // Optionally add to gear library
        if (saveToLibrary) {
          const gearData = {
            ownerId: user.uid,
            name: item.name || "Unknown Item",
            category: item.category || "General",
            aiLabel: item.category || "General",
            description: 'Bulk scanned item',
            tags: item.tags || [],
            organizationTip: item.organizationTip || '',
            photoUrls: [capturedImage],
            assetTag: randomTag,
            condition: 'good',
            usageCount: 0,
            quantity: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          await addDoc(collection(db, 'users', user.uid, 'gearLibrary'), gearData);
        }

        return addToListPromise;
      });

      await Promise.all(batchPromises);
      
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });

      toast.success(`Added ${selectedItems.length} items to your list!`);
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/gearLibrary`);
    }
  };

  const toggleItem = (index: number) => {
    setDetectedItems(prev => prev.map((item, i) => i === index ? { ...item, selected: !item.selected } : item));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-neutral-900/90 backdrop-blur-md z-[60] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
      >
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-white sticky top-0 z-10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-neutral-900 text-white rounded-xl flex items-center justify-center">
              {activeMode === 'onboard' ? <Layers size={20} /> : <QrCode size={20} />}
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {activeMode === 'onboard' ? 'Smart Bulk Onboard' : 'Scan to Pack & Audit'}
              </h2>
              <p className="text-xs text-neutral-500">
                {activeMode === 'onboard' 
                  ? 'Onboard multiple physical units from photography' 
                  : 'Fast-track equipment dispatch & checkout using QR codes'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full transition">
            <X size={24} />
          </button>
        </div>

        {/* Dynamic Mode Tabs Selector Banner */}
        <div className="px-6 py-3 flex gap-2 border-b border-neutral-100 bg-neutral-50/75 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveMode('onboard');
              setCapturedImage(null);
            }}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition duration-200 border ${
              activeMode === 'onboard'
                ? 'bg-neutral-900 border-neutral-900 text-white shadow-sm'
                : 'bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
            }`}
          >
            <Layers size={13} className={activeMode === 'onboard' ? 'text-primary' : ''} />
            <span>🔍 Onboard (AI Vision)</span>
          </button>
          
          <button
            type="button"
            onClick={() => {
              setActiveMode('qr_pack');
              setCapturedImage(null);
            }}
            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition duration-200 border ${
              activeMode === 'qr_pack'
                ? 'bg-neutral-900 border-neutral-900 text-white shadow-sm'
                : 'bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
            }`}
          >
            <QrCode size={13} className={activeMode === 'qr_pack' ? 'text-primary-light' : ''} />
            <span>📷 Check Out / Pack (QR Setup)</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeMode === 'onboard' ? (
            <>
              {!capturedImage ? (
                <div className="relative aspect-video bg-neutral-900 rounded-3xl overflow-hidden group flex items-center justify-center">
                  {cameraError ? (
                    <div className="w-full h-full bg-neutral-950 flex flex-col items-center justify-center p-6 text-center space-y-4">
                      <div className="w-14 h-14 bg-red-400/10 text-red-500 rounded-full flex items-center justify-center">
                        <Camera size={28} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-white uppercase tracking-wider">Camera Access Denied</p>
                        <p className="text-xs text-neutral-400 max-w-sm">
                          We couldn't request the camera in this browser. You can still bulk scan by uploading a picture of your laid out equipment.
                        </p>
                      </div>
                      <div className="w-full max-w-xs pt-1">
                        <label className="flex flex-col items-center justify-center w-full h-24 px-4 transition bg-neutral-900/50 border-2 border-dashed border-neutral-700 hover:border-primary rounded-xl cursor-pointer hover:bg-neutral-900">
                          <div className="flex flex-col items-center justify-center pt-3 pb-3">
                            <Zap className="w-6 h-6 mb-1 text-primary animate-bounce fill-primary/10" />
                            <p className="text-xs text-neutral-200 font-semibold"><span className="text-primary font-bold">Upload image</span> or drag here</p>
                          </div>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleFileUpload}
                          />
                        </label>
                      </div>
                      <button
                        onClick={() => startCamera(true)}
                        className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition flex items-center gap-1.5"
                      >
                        <RefreshCw size={12} />
                        <span>Retry Camera Link</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                      <div className="absolute inset-0 border-[20px] border-black/20 pointer-events-none">
                        <div className="w-full h-full border-2 border-white/30 border-dashed rounded-xl"></div>
                      </div>
                      
                      {/* File Upload Option Icon button over video */}
                      <div className="absolute top-4 right-4 z-10 animate-fade-in">
                        <label className="p-2 py-1.5 bg-neutral-905/90 hover:bg-neutral-900 text-white rounded-xl border border-white/10 cursor-pointer flex items-center justify-center shadow-lg transition duration-200 backdrop-blur" title="Upload Image File">
                          <span className="text-[9px] font-black uppercase tracking-widest mr-2">Upload File</span>
                          <Package size={14} />
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleFileUpload}
                          />
                        </label>
                      </div>

                      <div className="absolute bottom-6 left-0 right-0 flex justify-center">
                        <button
                          onClick={capturePhoto}
                          className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all border-4 border-neutral-200"
                        >
                          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white">
                            <Camera size={24} />
                          </div>
                        </button>
                      </div>
                      <div className="absolute top-4 left-4 right-4 text-center">
                        <p className="text-white/70 text-xs font-bold bg-black/40 backdrop-blur-md py-2 px-4 rounded-full inline-block">
                          Lay out items clearly for best results
                        </p>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="relative aspect-video rounded-3xl overflow-hidden border-2 border-neutral-100">
                    <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
                    {isIdentifying && (
                      <div className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm flex flex-col items-center justify-center text-white space-y-4">
                        <Loader2 className="animate-spin" size={40} />
                        <div className="flex items-center gap-2 font-bold">
                          <Zap className="text-primary fill-primary" size={20} />
                          <span>AI Analyzing Scene...</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {!isIdentifying && (
                    <div className="space-y-6">
                      {!isLikelyComplete && (
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3 text-amber-800"
                        >
                          <AlertCircle className="shrink-0 mt-0.5" size={20} />
                          <div className="space-y-1">
                            <p className="text-sm font-bold">Layer Warning</p>
                            <p className="text-xs opacity-90">{warningReason || "AI suspects some items might be hidden or layered. Consider a second scan from a different angle."}</p>
                          </div>
                        </motion.div>
                      )}

                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/10 rounded-2xl">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                              <Layers size={16} />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-neutral-900">Save to Gear Library</p>
                              <p className="text-[10px] text-neutral-500">Reuse these items in future lists</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setSaveToLibrary(!saveToLibrary)}
                            className={`w-12 h-6 rounded-full transition-all relative ${saveToLibrary ? 'bg-primary' : 'bg-neutral-200'}`}
                          >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${saveToLibrary ? 'left-7' : 'left-1'}`} />
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-neutral-900">Detected Items ({detectedItems.filter(i => i.selected).length})</h3>
                          <button 
                            onClick={() => setCapturedImage(null)}
                            className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                          >
                            <RefreshCw size={12} />
                            Retake Photo
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {detectedItems.map((item, idx) => (
                            <button
                              key={idx}
                              onClick={() => toggleItem(idx)}
                              className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${
                                item.selected 
                                  ? 'bg-primary/5 border-primary shadow-sm' 
                                  : 'bg-neutral-50 border-neutral-100 text-neutral-400'
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                item.selected ? 'bg-primary text-white' : 'bg-neutral-200 text-neutral-400'
                              }`}>
                                {item.selected ? <Check size={16} /> : <Package size={16} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`font-bold text-sm truncate ${item.selected ? 'text-neutral-900' : 'text-neutral-400'}`}>
                                  {item.name}
                                </p>
                                <p className="text-[10px] uppercase tracking-widest font-black opacity-60">
                                  {item.category}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* QR / Barcode Scan & Dynamic Checkout mode layout */
            <div className="space-y-6">
              <div className="relative aspect-video bg-neutral-950 rounded-3xl overflow-hidden border border-neutral-800 flex flex-col items-center justify-center text-white">
                <div id="qr-bulk-scanner" className="absolute inset-0 w-full h-full object-cover [&_video]:object-cover" />
                
                {/* Laser line overlay simulation */}
                <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-red-500 animate-pulse pointer-events-none opacity-45 shadow-[0_0_8px_rgba(239,68,68,0.8)] z-10" />

                <div className="absolute top-4 left-4 right-4 text-center z-10 pointer-events-none">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/90 bg-neutral-900/85 backdrop-blur-md px-4 py-1.5 rounded-full inline-block shadow border border-white/5">
                    Position physical QR tag inside target box
                  </p>
                </div>
              </div>

              {/* Simulation fallback container */}
              <div className="bg-neutral-50 border border-neutral-200 rounded-3xl p-5 space-y-3.5 shadow-sm">
                <div className="flex items-center gap-2">
                  <QrCode size={15} className="text-neutral-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 font-sans">
                    Universal QR Simulation Bar / Backup Entry
                  </span>
                </div>
                
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!manualCodeInput.trim()) return;
                    handleQRScanned(manualCodeInput);
                    setManualCodeInput('');
                  }} 
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    placeholder="Enter or paste active QR Asset Tag (e.g., TAG-A1B2C3)"
                    value={manualCodeInput}
                    onChange={(e) => setManualCodeInput(e.target.value)}
                    className="flex-1 bg-white border border-neutral-300 rounded-2xl px-4 py-2.5 text-xs text-neutral-850 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary-light font-sans font-medium"
                  />
                  <button
                    type="submit"
                    disabled={isProcessingQR || !manualCodeInput.trim()}
                    className="px-5 py-2.5 bg-neutral-900 text-white hover:bg-neutral-800 rounded-2xl text-[10px] font-black uppercase tracking-wider transition duration-150 disabled:opacity-40"
                  >
                    Simulate Scan
                  </button>
                </form>
                <div className="flex items-start gap-1 text-[9px] text-neutral-400 font-medium font-sans">
                  <span className="text-amber-500">💡</span>
                  <span>
                    Integrates with current packing list items! If scanned item is from your <strong>Gear Library</strong>, it automatically appends to list as packed! Custom unregistered values create new line items.
                  </span>
                </div>
              </div>

              {/* Scanned Audit log for this session */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-widest text-neutral-500 font-sans">
                    Session Scan History ({scannedSessionLog.length})
                  </h4>
                  {scannedSessionLog.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setScannedSessionLog([])}
                      className="text-[9px] font-black uppercase tracking-wider text-neutral-400 hover:text-red-500 transition"
                    >
                      Reset History
                    </button>
                  )}
                </div>

                {scannedSessionLog.length === 0 ? (
                  <div className="border border-dashed border-neutral-200 rounded-2xl p-8 text-center bg-neutral-50/20 font-sans">
                    <p className="text-xs text-neutral-400 font-semibold uppercase tracking-widest block font-mono">Viewfinder Ready</p>
                    <p className="text-[10px] text-neutral-400 mt-1 max-w-sm mx-auto">Items scanned via QR camera or simulated manually will show up here as they auto-save and pack.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {scannedSessionLog.map((log, index) => (
                      <div 
                        key={index} 
                        className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-left animate-scale-up hover:bg-neutral-100/50 transition"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black text-neutral-800 truncate leading-snug">
                            {log.itemName}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-[8px] font-bold uppercase tracking-wider text-neutral-400 font-mono">
                            <span className="bg-neutral-200/55 px-1.5 py-0.5 rounded text-neutral-600">CODE: {log.code}</span>
                            <span>•</span>
                            <span>{log.category || 'General'}</span>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {log.status === 'packed_existing' && (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[8px] font-black uppercase tracking-widest">
                              🏁 Checked Off
                            </span>
                          )}
                          {log.status === 'added_from_library' && (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded text-[8px] font-black uppercase tracking-widest">
                              ✅ Library Pulled
                            </span>
                          )}
                          {log.status === 'created_new' && (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[8px] font-black uppercase tracking-widest">
                              📦 On-The-Fly New
                            </span>
                          )}
                          {log.status === 'already_packed' && (
                            <span className="px-2 py-0.5 bg-neutral-200 text-neutral-600 border border-neutral-300 rounded text-[8px] font-black uppercase tracking-widest">
                              ℹ Already Packed
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-neutral-100 bg-neutral-50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-4 bg-white border border-neutral-200 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-100 transition shadow-sm uppercase text-[10px] tracking-widest font-black"
          >
            Cancel
          </button>
          {activeMode === 'onboard' ? (
            <button
              onClick={handleSave}
              disabled={isIdentifying || !capturedImage || detectedItems.filter(i => i.selected).length === 0}
              className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 uppercase text-[10px] tracking-widest font-black"
            >
              <Check size={16} />
              <span>Add Selected Onboards</span>
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex-1 py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-850 transition shadow-lg flex items-center justify-center gap-2 uppercase text-[10px] tracking-widest font-black cursor-pointer"
            >
              <Check size={16} />
              <span>Complete Packing Run</span>
            </button>
          )}
        </div>
      </motion.div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
