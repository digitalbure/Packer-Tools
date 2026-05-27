import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, RefreshCw, Check, Loader2, Zap, Package, AlertCircle, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { bulkIdentifyItems } from '../services/geminiService';
import { toast } from 'sonner';
import { collection, addDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, GearItem } from '../types';
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

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast.error("Could not access camera.");
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
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-neutral-900 text-white rounded-xl flex items-center justify-center">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Smart Bulk Scan</h2>
              <p className="text-xs text-neutral-500">Scan multiple items at once</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full transition">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!capturedImage ? (
            <div className="relative aspect-video bg-neutral-900 rounded-3xl overflow-hidden group">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute inset-0 border-[20px] border-black/20 pointer-events-none">
                <div className="w-full h-full border-2 border-white/30 border-dashed rounded-xl"></div>
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
        </div>

        <div className="p-6 border-t border-neutral-100 bg-neutral-50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-4 bg-white border border-neutral-200 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isIdentifying || !capturedImage || detectedItems.filter(i => i.selected).length === 0}
            className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Check size={20} />
            <span>Add Selected Items</span>
          </button>
        </div>
      </motion.div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
