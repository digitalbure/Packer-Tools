import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, collection, addDoc, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Container, GearItem, UserProfile } from '../types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Package, User, CheckCircle2, ShieldAlert, History, AlertTriangle, 
  RotateCcw, ArrowRightLeft, ShieldCheck, Signature, Check, X, ClipboardList, 
  Layers, Search, RefreshCw, Eye, Tag, AlertCircle, Sparkles, BookOpen
} from 'lucide-react';

// Pure React & Canvas Signature Pad
const SignaturePad = ({ onSave }: { onSave: (dataUrl: string) => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const getPos = (e: React.MouseEvent | React.TouchEvent | TouchEvent | MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e.nativeEvent);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    if (e.cancelable) e.preventDefault();
    
    const pos = getPos(e.nativeEvent);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      onSave(canvas.toDataURL());
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      onSave('');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-[9px] uppercase tracking-widest font-black text-neutral-400 block">Required digital signature</label>
        <button
          type="button"
          onClick={clearCanvas}
          className="text-[8px] bg-neutral-800 text-neutral-400 py-1 px-2.5 rounded-lg hover:text-white transition uppercase font-black tracking-wider"
        >
          Clear Pad
        </button>
      </div>
      <div className="border border-neutral-800 bg-neutral-950 rounded-2xl relative overflow-hidden h-28 active:border-primary transition-colors">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          width={400}
          height={112}
          className="w-full h-full cursor-crosshair"
        />
      </div>
    </div>
  );
};

interface LogRecord {
  id: string;
  action: 'check_out' | 'check_in' | 'status_update' | 'item_add' | 'item_remove';
  itemName?: string;
  itemId?: string;
  operatorName: string;
  recipientName?: string;
  notes?: string;
  signatureUrl?: string;
  oldStatus?: string;
  newStatus?: string;
  createdAt: string;
}

export default function OrganizerIOPage({ user }: { user: UserProfile | null }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [container, setContainer] = useState<Container | null>(null);
  const [items, setItems] = useState<GearItem[]>([]);
  const [allGear, setAllGear] = useState<GearItem[]>([]);
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Check In / Check Out form state
  const [ioMode, setIoMode] = useState<'checkout' | 'checkin'>('checkout');
  const [operatorName, setOperatorName] = useState(user?.displayName || '');
  const [recipientName, setRecipientName] = useState('');
  const [ioNotes, setIoNotes] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // Search/Simulate scanner state
  const [searchQuery, setSearchQuery] = useState('');
  const [scanTag, setScanTag] = useState('');

  useEffect(() => {
    if (!id || !user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    // Fetch Container Live Observer
    const containerRef = doc(db, 'users', user.uid, 'containers', id);
    const unsubscribeContainer = onSnapshot(containerRef, async (docSnap) => {
      if (docSnap.exists()) {
        const containerData = { id: docSnap.id, ...docSnap.data() } as Container;
        setContainer(containerData);

        // Fetch user's entire gear library
        const gearColRef = collection(db, 'users', user.uid, 'gearLibrary');
        const gearSnap = await getDocs(gearColRef);
        const gearList = gearSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as GearItem));
        setAllGear(gearList);

        // Filter items packed in this container
        const packed = gearList.filter(g => containerData.items.includes(g.id));
        setItems(packed);
      } else {
        toast.error("Organizer record not found.");
        navigate('/organizer');
      }
      setLoading(false);
    }, (error) => {
      console.error("Error setting up container snapshot:", error);
      toast.error("Failed to sync organizer operations.");
      setLoading(false);
    });

    // Fetch Logs Live Observer
    const logsColRef = collection(db, 'users', user.uid, 'containers', id, 'logs');
    const logsQuery = query(logsColRef, orderBy('createdAt', 'desc'));
    const unsubscribeLogs = onSnapshot(logsQuery, (snap) => {
      const logsList = snap.docs.map(d => ({ id: d.id, ...d.data() } as LogRecord));
      setLogs(logsList);
    }, (error) => {
      console.warn("Failed to subscribe to logs collection:", error);
    });

    return () => {
      unsubscribeContainer();
      unsubscribeLogs();
    };
  }, [id, user, navigate]);

  const handleContainerStatusChange = async (newStatus: 'storage' | 'transit' | 'deployed' | 'maintenance') => {
    if (!container || !user) return;
    const oldStatus = container.status || 'storage';
    try {
      await updateDoc(doc(db, 'users', user.uid, 'containers', container.id), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });

      // Log Status Update Event
      await addDoc(collection(db, 'users', user.uid, 'containers', container.id, 'logs'), {
        action: 'status_update',
        operatorName: user.displayName || 'Authorized Admin',
        oldStatus,
        newStatus,
        createdAt: new Date().toISOString()
      });

      toast.success(`Organizer status updated to ${newStatus}`);
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleToggleSelectItem = (itemId: string) => {
    const next = new Set(selectedItemIds);
    if (next.has(itemId)) {
      next.delete(itemId);
    } else {
      next.add(itemId);
    }
    setSelectedItemIds(next);
  };

  const handleSelectAllInUse = () => {
    const inUseIds = items.filter(i => i.status === 'in_use').map(i => i.id);
    setSelectedItemIds(new Set(inUseIds));
  };

  const handleSelectAllAvailable = () => {
    const availableIds = items.filter(i => i.status !== 'in_use').map(i => i.id);
    setSelectedItemIds(new Set(availableIds));
  };

  const handleExecuteIO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItemIds.size === 0) {
      toast.error("Please select at least one item to check-in/out.");
      return;
    }
    if (!operatorName.trim()) {
      toast.error("Operator's name is required.");
      return;
    }
    if (ioMode === 'checkout' && !recipientName.trim()) {
      toast.error("Custodian / Recipient Name is required for check-out authorization.");
      return;
    }
    if (ioMode === 'checkout' && !signatureData) {
      toast.error("Authorization signature is required for check-out.");
      return;
    }

    try {
      toast.loading(`Processing equipment custody batch...`);
      
      // Update individual gear item statuses in Firestore
      const targetStatus = ioMode === 'checkout' ? 'in_use' : 'storage';
      const targetHolder = ioMode === 'checkout' ? recipientName.trim() : '';

      for (const itemId of selectedItemIds) {
        const itemRef = doc(db, 'users', user!.uid, 'gearLibrary', itemId);
        await updateDoc(itemRef, {
          status: targetStatus,
          currentHolder: targetHolder,
          updatedAt: new Date().toISOString()
        });

        const matchedItem = items.find(i => i.id === itemId);

        // Append log record in container sub-collection
        await addDoc(collection(db, 'users', user!.uid, 'containers', id!, 'logs'), {
          action: ioMode === 'checkout' ? 'check_out' : 'check_in',
          itemId,
          itemName: matchedItem?.name || 'Unknown Packed Gear',
          operatorName: operatorName.trim(),
          recipientName: ioMode === 'checkout' ? recipientName.trim() : undefined,
          notes: ioNotes.trim() || undefined,
          signatureUrl: ioMode === 'checkout' ? signatureData : undefined,
          createdAt: new Date().toISOString()
        });
      }

      setSelectedItemIds(new Set());
      setRecipientName('');
      setIoNotes('');
      setSignatureData('');
      
      toast.dismiss();
      toast.success(ioMode === 'checkout' ? "Items checked out successfully!" : "Items checked in successfully!");
    } catch (err) {
      console.error(err);
      toast.dismiss();
      toast.error("Custody transaction failed.");
    }
  };

  const handleSimulateScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanTag.trim()) return;

    // Find if item is inside the library
    const matched = allGear.find(g => g.assetTag === scanTag.trim() || g.serialNumber === scanTag.trim());
    if (!matched) {
      toast.error(`No item found in library matching: ${scanTag}`);
      setScanTag('');
      return;
    }

    // Check if item is already in container
    if (container?.items.includes(matched.id)) {
      // Auto toggle selection
      handleToggleSelectItem(matched.id);
      toast.success(`Scanned: ${matched.name} (Toggled in list!)`);
    } else {
      // Prompt to add to container
      if (confirm(`Item "${matched.name}" is not assigned here. Assign it to this organizer now?`)) {
        try {
          const updatedItems = [...(container?.items || []), matched.id];
          await updateDoc(doc(db, 'users', user!.uid, 'containers', id!), {
            items: updatedItems,
            updatedAt: new Date().toISOString()
          });

          // Log assignment log
          await addDoc(collection(db, 'users', user!.uid, 'containers', id!, 'logs'), {
            action: 'item_add',
            itemId: matched.id,
            itemName: matched.name,
            operatorName: user?.displayName || 'System Admin',
            createdAt: new Date().toISOString()
          });

          setSelectedItemIds(prev => {
            const next = new Set(prev);
            next.add(matched.id);
            return next;
          });

          toast.success(`Assigned and loaded ${matched.name}!`);
        } catch {
          toast.error("Failed to assign scanned item.");
        }
      }
    }
    setScanTag('');
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (item.brand && item.brand.toLowerCase().includes(searchQuery.toLowerCase())) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatLogAction = (action: string) => {
    switch (action) {
      case 'check_out': return 'Checked Out';
      case 'check_in': return 'Checked In';
      case 'status_update': return 'Status Shifted';
      case 'item_add': return 'Item Added';
      case 'item_remove': return 'Item Removed';
      default: return action;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-6 text-white">
        <div className="w-12 h-12 border-4 border-t-primary border-neutral-700 rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold uppercase tracking-widest text-neutral-400">Loading Control Terminal...</p>
      </div>
    );
  }

  if (!container) {
    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <ShieldAlert size={64} className="text-red-500 mb-4 animate-bounce" />
        <h1 className="text-2xl font-black uppercase tracking-tight mb-2">Organizer Not Found</h1>
        <Link to="/organizer" className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold uppercase tracking-widest rounded-xl transition">
          Return to Organizers
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <div className="h-2 bg-gradient-to-r from-primary via-neutral-500 to-amber-500" />

      {/* Main Container Workspace */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 space-y-8">
        
        {/* Upper Header Navigation */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-900 pb-6">
          <div className="flex items-center gap-4">
            <Link 
              to="/organizer"
              className="p-3 bg-neutral-900 text-neutral-400 hover:text-white rounded-2xl transition"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-neutral-900 text-neutral-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-neutral-800">
                  INTERNAL TERMINAL
                </span>
                <span className="text-xs text-neutral-500 font-bold font-mono">ID: {container.id.substring(0, 8)}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight mt-1 flex items-center gap-2">
                {container.name} <span className="text-neutral-500 font-normal">Check I/O</span>
              </h1>
            </div>
          </div>

          {/* Quick Status Bar */}
          <div className="bg-neutral-900 border border-neutral-800/80 p-3 rounded-2xl flex items-center gap-3">
            <span className="text-[9px] uppercase tracking-widest font-black text-neutral-500 pl-2">Organizer Status</span>
            <div className="flex bg-neutral-950 p-1 rounded-xl border border-neutral-850">
              {(['storage', 'transit', 'deployed', 'maintenance'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => handleContainerStatusChange(status)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-300 ${
                    container.status === status
                      ? 'bg-white text-black font-black'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dashboard Grid Modules */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT SECTION: CHECK I/O CONTROL PANEL (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Simulation Scan Input */}
            <div className="bg-neutral-900 border border-neutral-800/80 rounded-3xl p-6 shadow-xl">
              <form onSubmit={handleSimulateScan} className="flex gap-3 items-center">
                <div className="p-2.5 bg-neutral-950 rounded-xl border border-neutral-850 text-neutral-400">
                  <Tag size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-[8px] uppercase tracking-widest font-black text-neutral-500 mb-1">Asset Tag / Serial Number Scanner Simulator</p>
                  <input 
                    type="text"
                    value={scanTag}
                    onChange={e => setScanTag(e.target.value)}
                    placeholder="Enter asset tag (e.g. CAM-A2) or serial number..."
                    className="w-full bg-transparent text-xs text-white font-bold focus:outline-none placeholder-neutral-600"
                  />
                </div>
                <button 
                  type="submit"
                  className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-[10px] font-black uppercase tracking-widest text-white rounded-xl transition shrink-0"
                >
                  Simulate Scan
                </button>
              </form>
            </div>

            {/* Custody Core Form */}
            <div className="bg-neutral-900 border border-neutral-800/80 rounded-[2.5rem] p-8 shadow-xl space-y-6">
              
              <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
                <div className="flex bg-neutral-950 p-1.5 rounded-2xl border border-neutral-850 w-full max-w-sm">
                  <button
                    onClick={() => { setIoMode('checkout'); setSelectedItemIds(new Set()); }}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${
                      ioMode === 'checkout' ? 'bg-red-950/40 text-red-400 border border-red-900/40 font-bold' : 'text-neutral-500'
                    }`}
                  >
                    <ArrowRightLeft size={14} />
                    <span>Check Out (Take Gear)</span>
                  </button>
                  <button
                    onClick={() => { setIoMode('checkin'); setSelectedItemIds(new Set()); }}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${
                      ioMode === 'checkin' ? 'bg-green-950/40 text-green-400 border border-green-900/40 font-bold' : 'text-neutral-500'
                    }`}
                  >
                    <CheckCircle2 size={14} />
                    <span>Check In (Return)</span>
                  </button>
                </div>
              </div>

              {/* Items List inside the container */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-black uppercase text-sm tracking-tight text-white">Select Cargo items</h3>
                    <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500 mt-0.5">
                      Selected: {selectedItemIds.size} of {items.length} packed items
                    </p>
                  </div>
                  
                  {/* Select helpers */}
                  <div className="flex gap-2 text-[9px] font-black uppercase tracking-wider">
                    <button 
                      onClick={handleSelectAllAvailable}
                      className="px-2.5 py-1 bg-neutral-950 border border-neutral-850 hover:border-neutral-700 rounded-lg text-neutral-400 transition"
                    >
                      All Pack
                    </button>
                    <button 
                      onClick={handleSelectAllInUse}
                      className="px-2.5 py-1 bg-neutral-950 border border-neutral-850 hover:border-neutral-700 rounded-lg text-neutral-400 transition"
                    >
                      All Out
                    </button>
                    <button 
                      onClick={() => setSelectedItemIds(new Set())}
                      className="px-2.5 py-1 bg-neutral-950 border border-neutral-850 hover:border-neutral-700 rounded-lg text-neutral-400 transition"
                    >
                      Deselect
                    </button>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search packed assets..."
                    className="w-full bg-neutral-950 border border-neutral-850 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-700"
                  />
                </div>

                {/* Catalog Grid */}
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                  {filteredItems.map(item => {
                    const isSelected = selectedItemIds.has(item.id);
                    const isInUse = item.status === 'in_use';
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleToggleSelectItem(item.id)}
                        className={`w-full text-left p-4.5 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-4 ${
                          isSelected 
                            ? 'bg-neutral-900 border-neutral-600 shadow-inner' 
                            : 'bg-neutral-950 border-neutral-850 hover:border-neutral-800'
                        }`}
                      >
                        <div className="flex items-center gap-3 truncate">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition ${
                            isSelected 
                              ? 'bg-primary text-black border-primary' 
                              : 'bg-neutral-900 text-neutral-500 border-neutral-800'
                          }`}>
                            {isSelected ? <Check size={16} /> : <Package size={16} />}
                          </div>
                          <div className="truncate">
                            <p className="text-xs font-black uppercase text-white truncate">{item.name}</p>
                            <p className="text-[9px] font-black uppercase text-neutral-500 mt-0.5">{item.brand || 'No Brand'} • {item.category}</p>
                          </div>
                        </div>

                        {/* Status label */}
                        <div className="shrink-0 text-right">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                            isInUse 
                              ? 'bg-amber-950/30 text-amber-500 border border-amber-900/30' 
                              : 'bg-green-950/30 text-green-500 border border-green-900/30'
                          }`}>
                            {isInUse ? `OUT (${item.currentHolder || 'Anonymous'})` : 'IN'}
                          </span>
                        </div>
                      </button>
                    );
                  })}

                  {filteredItems.length === 0 && (
                    <p className="text-[10px] text-neutral-500 italic text-center py-6">No matching packed items found.</p>
                  )}
                </div>
              </div>

              {/* Custody input parameters */}
              <form onSubmit={handleExecuteIO} className="space-y-4 pt-4 border-t border-neutral-850">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Operator/Officer Name</label>
                    <input 
                      type="text"
                      required
                      value={operatorName}
                      onChange={e => setOperatorName(e.target.value)}
                      placeholder="Enter operational officer name..."
                      className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none focus:border-neutral-700 text-white"
                    />
                  </div>

                  {ioMode === 'checkout' && (
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Custodian/Recipient Name</label>
                      <input 
                        type="text"
                        required
                        value={recipientName}
                        onChange={e => setRecipientName(e.target.value)}
                        placeholder="Who is receiving the equipment..."
                        className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none focus:border-neutral-700 text-white"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Action Notes / Asset Audit Remarks</label>
                  <textarea 
                    value={ioNotes}
                    onChange={e => setIoNotes(e.target.value)}
                    placeholder="Any specific damage logs, event coordinates, or scheduling notes..."
                    rows={2}
                    className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none focus:border-neutral-700 text-white resize-none"
                  />
                </div>

                {/* Digital Signature Drawing Canvas for Checkout Authorization */}
                {ioMode === 'checkout' && (
                  <div className="pt-2">
                    <SignaturePad onSave={setSignatureData} />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={selectedItemIds.size === 0}
                  className={`w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                    ioMode === 'checkout' 
                      ? 'bg-white hover:bg-neutral-150 text-neutral-950' 
                      : 'bg-neutral-800 hover:bg-neutral-700 text-white'
                  }`}
                >
                  <span>{ioMode === 'checkout' ? `Authorize Checkout of ${selectedItemIds.size} items` : `Approve Return of ${selectedItemIds.size} items`}</span>
                </button>
              </form>
            </div>
          </div>

          {/* RIGHT SECTION: LOGS & METRIC TILES (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-neutral-900 border border-neutral-800/80 p-5 rounded-2xl">
                <p className="text-[8px] font-black uppercase tracking-widest text-neutral-500">Total Items</p>
                <p className="text-2xl font-black text-white mt-1">{items.length}</p>
              </div>
              <div className="bg-neutral-900 border border-neutral-800/80 p-5 rounded-2xl">
                <p className="text-[8px] font-black uppercase tracking-widest text-neutral-500">Checked Out (OUT)</p>
                <p className="text-2xl font-black text-amber-500 mt-1">
                  {items.filter(i => i.status === 'in_use').length}
                </p>
              </div>
            </div>

            {/* Live Equipment Logs History */}
            <div className="bg-neutral-900 border border-neutral-800/80 rounded-[2.5rem] p-8 shadow-xl space-y-6">
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight text-white flex items-center gap-2">
                  <History size={18} className="text-neutral-400" /> Equipment Operations Audit Log
                </h3>
                <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500 mt-1">
                  Live verification logs captured for this organizer container
                </p>
              </div>

              <div className="space-y-4 max-h-[26rem] overflow-y-auto pr-1 custom-scrollbar">
                {logs.map(log => (
                  <div 
                    key={log.id} 
                    className="p-4 bg-neutral-950 border border-neutral-850 rounded-2xl space-y-3"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-wider ${
                          log.action === 'check_out' 
                            ? 'bg-red-950/40 text-red-400 border border-red-900/30' 
                            : log.action === 'check_in' 
                              ? 'bg-green-950/40 text-green-400 border border-green-900/30' 
                              : 'bg-neutral-850 text-neutral-400'
                        }`}>
                          {formatLogAction(log.action)}
                        </span>
                        
                        <p className="text-xs font-black uppercase mt-1.5 text-white leading-tight">
                          {log.itemName || 'Status/System Update'}
                        </p>
                      </div>

                      <span className="text-[8px] font-mono font-black text-neutral-500 uppercase shrink-0">
                        {new Date(log.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="text-[10px] text-neutral-400 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-neutral-500">Operator:</span>
                        <span className="font-bold text-neutral-300">{log.operatorName}</span>
                      </div>
                      
                      {log.recipientName && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-neutral-500">Recipient/Holder:</span>
                          <span className="font-bold text-neutral-300">{log.recipientName}</span>
                        </div>
                      )}

                      {log.notes && (
                        <div className="bg-neutral-900/60 p-2 rounded-xl border border-neutral-800/40 text-neutral-400 text-[10px] italic mt-1.5">
                          "{log.notes}"
                        </div>
                      )}

                      {log.oldStatus && log.newStatus && (
                        <div className="flex items-center gap-1.5 mt-1 font-mono text-[9px]">
                          <span className="text-neutral-500">Transition:</span>
                          <span className="text-neutral-400 uppercase">{log.oldStatus}</span>
                          <span className="text-neutral-650">→</span>
                          <span className="text-white font-bold uppercase">{log.newStatus}</span>
                        </div>
                      )}

                      {/* Display Signature preview if present */}
                      {log.signatureUrl && (
                        <div className="mt-2.5">
                          <p className="text-[8px] uppercase tracking-widest text-neutral-500 mb-1 font-bold">Authorized Digital Sign-off</p>
                          <div className="bg-neutral-900/40 border border-neutral-850 p-2 rounded-xl h-10 w-28 flex items-center justify-center overflow-hidden">
                            <img src={log.signatureUrl} alt="Signed" className="max-h-full max-w-full object-contain filter invert contrast-150" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {logs.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-neutral-600 space-y-1 bg-neutral-950 rounded-2xl border border-dashed border-neutral-850">
                    <History size={24} className="strokeWidth={1} text-neutral-700" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">No Operations Logs</p>
                    <p className="text-[9px] text-neutral-500">Custody checks and shifts will appear here.</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
