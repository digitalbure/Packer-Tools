import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, doc, setDoc, query, where, getDocs, getDoc } from 'firebase/firestore';
import { Camera, RefreshCw, Check, X, ChevronLeft, Zap, Package, Tag, Loader2, Edit2, Eraser, Library, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '../firebase';
import { UserProfile, GearItem, AdminSettings } from '../types';
import { identifyItem, removeBackground } from '../services/geminiService';
import confetti from 'canvas-confetti';
import { Html5Qrcode } from 'html5-qrcode';

const base64ToFile = (dataurl: string, filename: string): File => {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
};

export default function CameraScanner({ user, adminSettings }: { user: UserProfile, adminSettings: AdminSettings | null }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [scanMode, setScanMode] = useState<'ai' | 'manual'>('ai');
  const [cameraError, setCameraError] = useState(false);
  const [identifiedItem, setIdentifiedItem] = useState<{ 
    name: string; 
    category: string; 
    isClear: boolean; 
    confidence: number;
    reason?: string;
    tags?: string[];
    organizationTip?: string;
  } | null>(null);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualCategory, setManualCategory] = useState('');
  const [assetTag, setAssetTag] = useState('');
  const [addToLibrary, setAddToLibrary] = useState(true);
  const [libraryMatch, setLibraryMatch] = useState<GearItem | null>(null);
  const [gearLibraryItems, setGearLibraryItems] = useState<GearItem[]>([]);
  const [dbSearchQuery, setDbSearchQuery] = useState('');
  const [manualEntryMode, setManualEntryMode] = useState<'existing' | 'new_item'>('existing');

  useEffect(() => {
    if (!user?.uid) return;
    const fetchGear = async () => {
      try {
        const snap = await getDocs(collection(db, 'users', user.uid, 'gearLibrary'));
        const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as GearItem[];
        setGearLibraryItems(items);
      } catch (err) {
        console.warn("Error loading gear library for selection:", err);
      }
    };
    fetchGear();
  }, [user]);

  useEffect(() => {
    startCamera(false);
    return () => stopCamera();
  }, []);

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

  const handleQrDetected = async (decodedText: string): Promise<boolean> => {
    toast.success("Passport QR Code detected!");
    
    let gearId = '';
    let ownerId = '';
    
    if (decodedText.includes('/#/gear/') || decodedText.includes('/gear/')) {
      const urlPart = decodedText.includes('/#/gear/') ? '/#/gear/' : '/gear/';
      const parts = decodedText.split(urlPart);
      if (parts[1]) {
        const subParts = parts[1].split('?');
        gearId = subParts[0];
        if (subParts[1] && subParts[1].includes('owner=')) {
          const searchParams = new URLSearchParams(subParts[1]);
          ownerId = searchParams.get('owner') || '';
        }
      }
    }
    
    if (gearId) {
      const actualOwner = ownerId || user.uid;
      try {
        const docRef = doc(db, 'users', actualOwner, 'gearLibrary', gearId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const gear = { id: docSnap.id, ...docSnap.data() } as GearItem;
          
          setManualName(gear.name);
          setManualCategory(gear.category || 'Equipment');
          setAssetTag(gear.assetTag || `TAG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`);
          setLibraryMatch(gear);
          setAddToLibrary(false);
          if (gear.photoUrls && gear.photoUrls[0]) {
            setCapturedImage(gear.photoUrls[0]);
          } else {
            setCapturedImage('https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=300');
          }
          
          setIdentifiedItem({
            name: gear.name,
            category: gear.category || 'Equipment',
            isClear: true,
            confidence: 1.0,
            tags: gear.tags,
            organizationTip: gear.organizationTip
          });
          
          toast.success(`Matched passport item "${gear.name}" from QR code.`);
          return true;
        }
      } catch (err) {
        console.error("Error fetching QR item from database:", err);
      }
    }
    
    try {
      const q = query(collection(db, 'users', user.uid, 'gearLibrary'), where('assetTag', '==', decodedText.trim()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const gear = { id: snap.docs[0].id, ...snap.docs[0].data() } as GearItem;
        setManualName(gear.name);
        setManualCategory(gear.category || 'Equipment');
        setAssetTag(gear.assetTag || decodedText.trim());
        setLibraryMatch(gear);
        setAddToLibrary(false);
        if (gear.photoUrls && gear.photoUrls[0]) {
          setCapturedImage(gear.photoUrls[0]);
        } else {
          setCapturedImage('https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=300');
        }
        
        setIdentifiedItem({
          name: gear.name,
          category: gear.category || 'Equipment',
          isClear: true,
          confidence: 1.0,
          tags: gear.tags,
          organizationTip: gear.organizationTip
        });
        
        toast.success(`Matched owned asset tag "${gear.name}" from QR code.`);
        return true;
      }
    } catch (err) {
      console.warn("Error matching asset tag directly:", err);
    }
    
    setManualName(decodedText.length < 50 ? decodedText : "QR Encoded Item");
    setManualCategory("Equipment");
    setAssetTag(decodedText);
    setLibraryMatch(null);
    setAddToLibrary(true);
    setCapturedImage('https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=300');
    
    setIdentifiedItem({
      name: decodedText.length < 50 ? decodedText : "QR Encoded Item",
      category: "Equipment",
      isClear: true,
      confidence: 0.9,
      tags: ["QR Scan"],
      organizationTip: "Loaded from custom QR tag."
    });
    
    toast.success(`Scanned plain QR code. Pre-populated for packing!`);
    return true;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        setCapturedImage(dataUrl);

        setIsIdentifying(true);
        try {
          const html5QrCode = new Html5Qrcode("temp-qr-reader");
          const decodedText = await html5QrCode.scanFile(file, false);
          await handleQrDetected(decodedText);
          setIsIdentifying(false);
          return;
        } catch (err) {
          console.log("No QR barcode found in file. Proceeding with standard Gemini identification.");
        }

        if (scanMode === 'ai') {
          handleIdentify(dataUrl);
        } else {
          const randomTag = `TAG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          setAssetTag(randomTag);
        }
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
    }
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        
        setIsIdentifying(true);
        try {
          const file = base64ToFile(dataUrl, "capture.jpg");
          const html5QrCode = new Html5Qrcode("temp-qr-reader");
          const decodedText = await html5QrCode.scanFile(file, false);
          await handleQrDetected(decodedText);
          setIsIdentifying(false);
          return;
        } catch (err) {
          console.log("No QR barcode found in captured frame. Proceeding with standard Gemini identification.");
        }

        if (scanMode === 'ai') {
          handleIdentify(dataUrl);
        } else {
          const randomTag = `TAG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          setAssetTag(randomTag);
        }
      }
    }
  };

  const handleIdentify = async (base64Data: string) => {
    setIsIdentifying(true);
    const base64 = base64Data.split(',')[1];
    const result = await identifyItem(base64);
    setIdentifiedItem({ 
      name: result.name, 
      category: result.category,
      isClear: result.isClear,
      confidence: result.confidence,
      reason: result.reason,
      tags: result.tags,
      organizationTip: result.organizationTip
    });
    
    if (!result.isClear) {
      toast.warning(result.reason || "Image might not be clear. Consider retaking.");
    }

    if (result.confidence < 0.6) {
      toast.info("AI is a bit unsure about this item. You can manually label it.");
    }

    const randomTag = `TAG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    setAssetTag(randomTag);
    setIsIdentifying(false);

    // Check if item exists in library
    if (result.name) {
      const q = query(collection(db, 'users', user.uid, 'gearLibrary'), where('name', '==', result.name));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const match = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as GearItem;
        setLibraryMatch(match);
        setAddToLibrary(false);
        toast.info(`Found "${match.name}" in your Gear Library!`);
      } else {
        setLibraryMatch(null);
        setAddToLibrary(true);
      }
    }
  };

  const handleRemoveBg = async () => {
    if (!capturedImage) return;
    setIsRemovingBg(true);
    const base64 = capturedImage.split(',')[1];
    const result = await removeBackground(base64);
    if (result) {
      setCapturedImage(result);
      toast.success("Background removed!");
    } else {
      toast.error("Failed to remove background.");
    }
    setIsRemovingBg(false);
  };

  const handleSave = async () => {
    const finalItem = scanMode === 'ai' 
      ? (isEditingLabel ? { name: manualName, category: manualCategory } : identifiedItem)
      : { name: manualName, category: manualCategory };

    if (!finalItem || !finalItem.name) {
      toast.error("Please provide a name for the item.");
      return;
    }

    try {
      let targetId = id;
      
      if (id === 'new') {
        const listRef = await addDoc(collection(db, 'packingLists'), {
          ownerId: user.uid,
          name: `Quick Scan ${new Date().toLocaleDateString()}`,
          description: 'Created via Quick Scan',
          isTemplate: false,
          shareToken: Math.random().toString(36).substring(2, 15),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        targetId = listRef.id;
      }

      if (!targetId) throw new Error("No target list ID");

      const itemData = {
        listId: targetId,
        name: finalItem.name,
        photoUrls: capturedImage ? [capturedImage] : [],
        assetTag: assetTag || `TAG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        status: 'pending',
        aiLabel: finalItem.category || 'Manual',
        description: '',
        notes: '',
        tags: (finalItem as any).tags || [],
        organizationTip: (finalItem as any).organizationTip || '',
        order: Date.now(),
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, 'packingLists', targetId, 'items'), itemData);
      
      if (addToLibrary) {
        const gearItem: Omit<GearItem, 'id'> = {
          ownerId: user.uid,
          name: finalItem.name,
          category: finalItem.category,
          photoUrls: [capturedImage],
          assetTag: assetTag,
          tags: (finalItem as any).tags || [],
          organizationTip: (finalItem as any).organizationTip || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          usageCount: 1,
          quantity: 1,
          condition: 'good'
        };
        await addDoc(collection(db, 'users', user.uid, 'gearLibrary'), gearItem);
        toast.success("Added to Gear Library!");
      }
      
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      navigate(`/list/${targetId}`);
    } catch (error) {
      console.error("Error saving item:", error);
      toast.error("Failed to save item.");
    }
  };

  const resetScanner = () => {
    setCapturedImage(null);
    setIdentifiedItem(null);
    setIsEditingLabel(false);
    setManualName('');
    setManualCategory('');
    setAssetTag('');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20">
      <header className="flex items-center justify-between">
        <Link to={id === 'new' ? '/dashboard' : `/list/${id}`} className="flex items-center gap-2 text-neutral-500 hover:text-primary transition font-medium">
          <ChevronLeft size={20} />
          <span>Cancel</span>
        </Link>
        <h1 className="text-2xl font-black tracking-tight">{id === 'new' ? 'Quick Scan' : 'Add New Item'}</h1>
        <div className="w-10"></div>
      </header>

      <div className="flex justify-center">
        <div className="bg-neutral-100 p-1 rounded-2xl flex gap-1">
          <button
            onClick={() => setScanMode('ai')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              scanMode === 'ai' ? 'bg-white text-primary shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            <Zap size={16} className={scanMode === 'ai' ? 'fill-primary' : ''} />
            AI Scanner
          </button>
          <button
            onClick={() => setScanMode('manual')}
            className={`px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              scanMode === 'manual' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            <Edit2 size={16} />
            Manual Entry
          </button>
        </div>
      </div>

      <div className="relative aspect-[3/4] bg-neutral-900 rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white">
        {!capturedImage && scanMode === 'ai' ? (
          <>
            {cameraError ? (
              <div className="w-full h-full bg-neutral-900 flex flex-col items-center justify-center p-8 text-center space-y-6">
                <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center animate-pulse">
                  <Camera size={40} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white uppercase tracking-wider">Camera Access Denied</h3>
                  <p className="text-xs text-neutral-450 max-w-xs leading-relaxed">
                    We couldn't open the video camera in this browser. You can still import your equipment by uploading an image.
                  </p>
                </div>
                <div className="w-full pt-4 max-w-xs">
                  <label className="flex flex-col items-center justify-center w-full h-36 px-4 transition bg-neutral-950/55 border-2 border-dashed border-neutral-700 hover:border-primary rounded-2xl cursor-pointer hover:bg-neutral-950/80">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Zap className="w-8 h-8 mb-2.5 text-primary animate-bounce fill-primary/10" />
                      <p className="mb-1 text-sm text-neutral-100 font-semibold"><span className="text-primary font-black uppercase tracking-wider">Upload Image</span></p>
                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">PNG, JPG or JPEG</p>
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
                  className="px-6 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition flex items-center gap-2"
                >
                  <RefreshCw size={14} />
                  <span>Retry Camera Link</span>
                </button>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 border-[40px] border-black/20 pointer-events-none">
                  <div className="w-full h-full border-2 border-white/50 border-dashed rounded-2xl"></div>
                </div>
                
                {/* Upload override on top right */}
                <div className="absolute top-4 right-4 z-10">
                  <label className="px-4 py-2 bg-neutral-900/80 hover:bg-neutral-900 text-white rounded-xl border border-white/10 cursor-pointer flex items-center justify-center shadow-lg transition duration-205 backdrop-blur-sm" title="Upload Image File">
                    <span className="text-[10px] font-black uppercase tracking-widest mr-2">Upload File</span>
                    <Package size={14} />
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>

                <div className="absolute bottom-8 left-0 right-0 flex justify-center">
                  <button
                    onClick={capturePhoto}
                    className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all border-8 border-neutral-200"
                  >
                    <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white">
                      <Camera size={32} />
                    </div>
                  </button>
                </div>
              </>
            )}
          </>
        ) : !capturedImage && scanMode === 'manual' ? (
          <div className="w-full h-full bg-white p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div className="text-center space-y-1.5 shrink-0">
              <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto text-neutral-400">
                <Edit2 size={24} />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tighter text-neutral-900">Manual Entry</h3>
              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">Select an owned asset or input details manually to pack</p>
            </div>

            {/* Selection Mode Selector */}
            <div className="bg-neutral-50 p-1 rounded-xl flex border border-neutral-150/40 shrink-0">
              <button
                type="button"
                onClick={() => setManualEntryMode('existing')}
                className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                  manualEntryMode === 'existing' 
                    ? 'bg-neutral-900 text-white shadow-sm' 
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                <Library size={12} />
                <span>Existing DB Items</span>
              </button>
              <button
                type="button"
                onClick={() => setManualEntryMode('new_item')}
                className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                  manualEntryMode === 'new_item' 
                    ? 'bg-neutral-900 text-white shadow-sm' 
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                <Edit2 size={12} />
                <span>Brand New Item</span>
              </button>
            </div>
            
            {manualEntryMode === 'existing' ? (
              <div className="flex-1 flex flex-col min-h-0 space-y-4">
                <div className="space-y-1 shrink-0">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Search Your Owned Database</label>
                  <input
                    type="text"
                    placeholder="Search gear name, category, barcode..."
                    value={dbSearchQuery}
                    onChange={(e) => setDbSearchQuery(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-xs font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-primary placeholder:text-neutral-350 transition"
                  />
                </div>
                
                <div className="flex-1 overflow-y-auto max-h-[180px] border border-neutral-155 rounded-2xl bg-neutral-25/30 p-2 space-y-1.5 custom-scrollbar min-h-[140px]">
                  {gearLibraryItems.filter(item => 
                    (item.name || '').toLowerCase().includes(dbSearchQuery.toLowerCase()) || 
                    (item.category || '').toLowerCase().includes(dbSearchQuery.toLowerCase()) ||
                    (item.assetTag || '').toLowerCase().includes(dbSearchQuery.toLowerCase())
                  ).map(gear => (
                    <button
                      key={gear.id}
                      type="button"
                      onClick={() => {
                        setManualName(gear.name);
                        setManualCategory(gear.category || 'Equipment');
                        setAssetTag(gear.assetTag || `TAG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`);
                        setLibraryMatch(gear);
                        setAddToLibrary(false);
                        if (gear.photoUrls && gear.photoUrls[0]) {
                          setCapturedImage(gear.photoUrls[0]);
                        } else {
                          // No photo, but pre-populate fields
                          setCapturedImage('https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=300');
                        }
                        toast.success(`Loaded "${gear.name}" from your Gear database!`);
                      }}
                      className="w-full flex items-center justify-between p-2.5 bg-white hover:bg-neutral-50 border border-neutral-150 rounded-xl transition duration-150 text-left group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg overflow-hidden border border-neutral-100 bg-neutral-50 shrink-0 flex items-center justify-center">
                          {gear.photoUrls && gear.photoUrls[0] ? (
                            <img src={gear.photoUrls[0]} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Package size={14} className="text-neutral-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-neutral-900 group-hover:text-primary transition truncate leading-snug">{gear.name}</h4>
                          <p className="text-[8px] text-neutral-400 font-extrabold uppercase tracking-widest">{gear.category || 'General'}</p>
                        </div>
                      </div>
                      <span className="text-[8px] font-mono tracking-wider text-neutral-400 bg-neutral-100 px-1 py-0.5 rounded uppercase font-black shrink-0">
                        {gear.assetTag?.slice(-6) || 'OWNED'}
                      </span>
                    </button>
                  ))}

                  {gearLibraryItems.filter(item => 
                    (item.name || '').toLowerCase().includes(dbSearchQuery.toLowerCase()) || 
                    (item.category || '').toLowerCase().includes(dbSearchQuery.toLowerCase()) ||
                    (item.assetTag || '').toLowerCase().includes(dbSearchQuery.toLowerCase())
                  ).length === 0 && (
                    <div className="text-center py-8 text-neutral-400 space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-wider">No matching database items found</p>
                      <button 
                        type="button" 
                        onClick={() => setManualEntryMode('new_item')} 
                        className="text-[9px] text-primary font-black uppercase tracking-widest hover:underline block mx-auto"
                      >
                        Create a Brand New asset instead
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Item Name</label>
                  <input
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="e.g. Sony A7IV Camera"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-xs font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-primary transition"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Category</label>
                  <input
                    type="text"
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                    placeholder="e.g. Electronics"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-xs font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-primary transition"
                  />
                </div>
              </div>
            )}

            <div className="pt-2 space-y-2 shrink-0">
              <button
                type="button"
                onClick={handleSave}
                disabled={!manualName}
                className="w-full py-3.5 bg-primary text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-primary/90 transition shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check size={16} />
                <span>Pack Item Now</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  startCamera();
                  setCapturedImage(null);
                }}
                className="w-full py-3 bg-neutral-100 text-neutral-600 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-neutral-150 transition flex items-center justify-center gap-2"
              >
                <Camera size={16} />
                <span>Use Camera Instead</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="relative w-full h-full">
            <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
            
            {(isIdentifying || isRemovingBg) && (
              <div className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm flex flex-col items-center justify-center text-white space-y-4">
                <Loader2 className="animate-spin" size={48} />
                <div className="flex items-center gap-2 font-bold text-xl">
                  <Zap className="text-primary fill-primary" />
                  <span>{isRemovingBg ? 'Removing Background...' : 'AI Identifying Item...'}</span>
                </div>
              </div>
            )}

            {!isIdentifying && !isRemovingBg && (identifiedItem || scanMode === 'manual') && (
              <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-neutral-900 via-neutral-900/90 to-transparent text-white space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary rounded-full text-xs font-bold uppercase tracking-wider">
                      {scanMode === 'ai' ? <Zap size={12} /> : <Edit2 size={12} />}
                      <span>{scanMode === 'ai' ? 'AI Identification' : 'Manual Entry'}</span>
                    </div>
                    {scanMode === 'ai' && (
                      <button 
                        onClick={handleRemoveBg}
                        disabled={isRemovingBg}
                        className="flex items-center gap-2 px-4 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary rounded-full text-xs font-black uppercase tracking-widest transition-all border border-primary/30 shadow-[0_0_15px_rgba(var(--color-primary),0.1)] active:scale-95 disabled:opacity-50"
                      >
                        <Eraser size={14} className="group-hover:rotate-12 transition-transform" />
                        <span>AI Remove Background</span>
                      </button>
                    )}
                  </div>
                  
                  {scanMode === 'ai' ? (
                    <>
                      {identifiedItem?.isClear === false && (
                        <div className="bg-amber-500/20 border border-amber-500/50 p-3 rounded-xl flex items-start gap-3">
                          <AlertCircle className="text-amber-500 shrink-0" size={18} />
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">Image Quality Warning</p>
                            <p className="text-xs text-amber-200">{identifiedItem.reason}</p>
                          </div>
                        </div>
                      )}
                      
                      {isEditingLabel ? (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Correct Item Name</label>
                            <input
                              type="text"
                              value={manualName}
                              onChange={(e) => setManualName(e.target.value)}
                              placeholder={identifiedItem?.name}
                              className="w-full bg-white/10 backdrop-blur border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-primary transition"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Category</label>
                            <input
                              type="text"
                              value={manualCategory}
                              onChange={(e) => setManualCategory(e.target.value)}
                              placeholder={identifiedItem?.category}
                              className="w-full bg-white/10 backdrop-blur border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-primary transition"
                            />
                          </div>
                          <button 
                            onClick={() => setIsEditingLabel(false)}
                            className="text-xs font-bold text-primary hover:underline"
                          >
                            Cancel Editing
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <p className="text-sm font-bold text-primary uppercase tracking-widest animate-pulse">
                                {identifiedItem && identifiedItem.confidence < 0.6 ? "AI is unsure, is this a..." : "Is this a..."}
                              </p>
                              {identifiedItem && (
                                <div className="flex items-center gap-2 bg-white/5 px-2 py-0.5 rounded-lg border border-white/10">
                                  <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full transition-all duration-1000 ${identifiedItem.confidence > 0.8 ? 'bg-green-500' : identifiedItem.confidence > 0.5 ? 'bg-amber-500' : 'bg-red-500'}`}
                                      style={{ width: `${identifiedItem.confidence * 100}%` }}
                                    />
                                  </div>
                                  <span className={`text-[8px] font-black uppercase ${identifiedItem.confidence > 0.8 ? 'text-green-400' : identifiedItem.confidence > 0.5 ? 'text-amber-400' : 'text-red-400'}`}>
                                    {Math.round(identifiedItem.confidence * 100)}% Confidence
                                  </span>
                                </div>
                              )}
                            </div>
                            <button 
                              onClick={() => {
                                setIsEditingLabel(true);
                                setManualName(identifiedItem?.name || '');
                                setManualCategory(identifiedItem?.category || '');
                              }}
                              className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-white transition"
                            >
                              <Edit2 size={12} />
                              <span>Edit Label</span>
                            </button>
                          </div>
                          <h2 className="text-3xl font-black">{identifiedItem?.name}?</h2>
                          <div className="flex items-center gap-4 text-neutral-300">
                            <div className="flex items-center gap-1">
                              <Package size={14} />
                              <span className="text-sm">{identifiedItem?.category}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Tag size={14} />
                              <span className="text-sm font-mono">{assetTag}</span>
                            </div>
                          </div>
                          {identifiedItem && identifiedItem.confidence < 0.6 && (
                            <button 
                              onClick={() => {
                                setIsEditingLabel(true);
                                setManualName(identifiedItem?.name || '');
                                setManualCategory(identifiedItem?.category || '');
                              }}
                              className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition border border-white/20 flex items-center justify-center gap-2"
                            >
                              <Edit2 size={14} />
                              <span>Unsure? Manually Label It</span>
                            </button>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Item Name</label>
                        <input
                          type="text"
                          value={manualName}
                          onChange={(e) => setManualName(e.target.value)}
                          placeholder="e.g. Sony A7IV Camera"
                          className="w-full bg-white/10 backdrop-blur border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-primary transition"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Category</label>
                        <input
                          type="text"
                          value={manualCategory}
                          onChange={(e) => setManualCategory(e.target.value)}
                          placeholder="e.g. Electronics"
                          className="w-full bg-white/10 backdrop-blur border border-white/20 rounded-xl px-4 py-3 text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-primary transition"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-2">
                    {libraryMatch ? (
                      <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-xl text-green-400 font-bold text-xs uppercase tracking-widest">
                        <Check size={14} />
                        <span>In Gear Library</span>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setAddToLibrary(!addToLibrary)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all font-bold text-xs uppercase tracking-widest ${
                          addToLibrary 
                            ? 'bg-primary/20 border-primary text-primary' 
                            : 'bg-white/5 border-white/10 text-white/50'
                        }`}
                      >
                        <Library size={14} />
                        <span>Add to Gear Library</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={resetScanner}
                    className="flex-1 py-4 bg-white/10 backdrop-blur text-white rounded-2xl font-bold hover:bg-white/20 transition flex items-center justify-center gap-2 border border-white/20"
                  >
                    <RefreshCw size={20} />
                    <span>Retake</span>
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={scanMode === 'manual' && (!manualName || !manualCategory)}
                    className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Check size={20} />
                    <span>{scanMode === 'ai' ? 'Yes, Add Item' : 'Save Item'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
      <div id="temp-qr-reader" className="hidden" style={{ width: 0, height: 0 }} />

      <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm flex items-start gap-4">
        <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center flex-shrink-0">
          <Zap size={20} />
        </div>
        <div className="space-y-1">
          <h4 className="font-bold">Smart Recognition</h4>
          <p className="text-sm text-neutral-500 leading-relaxed">
            Our AI automatically identifies your gear, checks for image clarity, and can even remove backgrounds for a cleaner inventory look.
          </p>
        </div>
      </div>
    </div>
  );
}
