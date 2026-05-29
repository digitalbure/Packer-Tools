import React, { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { doc, getDoc, collection, query, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { PackingList, PackingItem } from '../types';
import { Package, Tag, Info, Check, CreditCard, ShieldCheck, XCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

// Interactive canvas signature pad
const SignaturePad = ({ onSave }: { onSave: (dataUrl: string) => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const getPos = (e: React.MouseEvent | React.TouchEvent | TouchEvent | MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
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
    const pos = getPos(e);
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
    
    // Core event prevention for scroll override
    if (e.cancelable) e.preventDefault();
    
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
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
        <label className="text-[10px] uppercase tracking-widest font-black text-neutral-400 block">Capture Digital Signature (Draw below)</label>
        <button
          type="button"
          onClick={clearCanvas}
          className="text-[9px] bg-neutral-800 text-neutral-400 py-1 px-2.5 rounded-lg hover:text-white transition uppercase font-black tracking-wider"
        >
          Clear Pad
        </button>
      </div>
      <div className="border-2 border-dashed border-neutral-700 bg-neutral-950 rounded-2xl relative overflow-hidden h-32 active:border-primary transition-colors">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="absolute inset-0 w-full h-full cursor-pointer touch-none"
          width={400}
          height={128}
        />
      </div>
    </div>
  );
};

export default function PackingListBioView() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [list, setList] = useState<PackingList | null>(null);
  const [items, setItems] = useState<PackingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Verification process state
  const [checkedItemIds, setCheckedItemIds] = useState<Set<string>>(new Set());
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  
  // Checkout particulars
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [creditCard, setCreditCard] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [signatureData, setSignatureData] = useState('');
  
  const [paymentStep, setPaymentStep] = useState<'particulars' | 'processing' | 'receipt'>('particulars');

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      
      try {
        const listRef = doc(db, 'packingLists', id);
        const listSnap = await getDoc(listRef);
        
        if (!listSnap.exists()) {
          setError("Packing list not found.");
          setLoading(false);
          return;
        }
        
        const listData = { id: listSnap.id, ...listSnap.data() } as PackingList;
        
        // Match token parameter
        if (!listData.shareToken || listData.shareToken !== token) {
          setError("Access denied. This list is private or the share link is invalid.");
          setLoading(false);
          return;
        }
        
        setList(listData);
        
        const itemsRef = collection(db, 'packingLists', id, 'items');
        const itemsSnap = await getDocs(query(itemsRef));
        const fetchedItems = itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PackingItem[];
        setItems(fetchedItems.sort((a, b) => (a.order || 0) - (b.order || 0)));
        
      } catch (err) {
        console.error("Error fetching bio view:", err);
        setError("An error occurred while loading the list.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id, token]);

  const toggleItemCheck = (itemId: string) => {
    const newRules = new Set(checkedItemIds);
    if (newRules.has(itemId)) {
      newRules.delete(itemId);
    } else {
      newRules.add(itemId);
    }
    setCheckedItemIds(newRules);
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !list) return;

    if (!clientName || !clientEmail) {
      toast.error("Please enter your name and email recipient coordinates.");
      return;
    }

    if (!creditCard || !cardExpiry || !cardCvv) {
      toast.error("Please provide payment credit credentials.");
      return;
    }

    if (!signatureData) {
      toast.error("Please capture your signature on the digital drawing pad.");
      return;
    }

    setPaymentStep('processing');

    setTimeout(async () => {
      try {
        const listRef = doc(db, 'packingLists', id);
        await updateDoc(listRef, {
          rentalStatus: 'awaiting_release',
          bookingClientName: clientName,
          bookingClientEmail: clientEmail,
          bookingClientSignature: signatureData,
          bookingPaidAt: new Date().toISOString(),
          status: 'Sent'
        });

        setList(prev => prev ? {
          ...prev,
          rentalStatus: 'awaiting_release',
          bookingClientName: clientName,
          bookingClientEmail: clientEmail,
          bookingClientSignature: signatureData,
          bookingPaidAt: new Date().toISOString()
        } : null);

        setPaymentStep('receipt');
        toast.success("Payment cleared & Hire invoice dispatched!");
      } catch (err) {
        console.error("Error recording hire records:", err);
        toast.error("An error occurred during transaction processing.");
        setPaymentStep('particulars');
      }
    }, 2500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-900 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !list) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-white p-8 text-center space-y-6">
        <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center">
          <Info size={40} />
        </div>
        <h1 className="text-2xl font-black uppercase tracking-tighter">{error || "Something went wrong"}</h1>
        <p className="text-xs text-neutral-400 font-semibold leading-relaxed">Please check back later or verify your shared parameters link.</p>
      </div>
    );
  }

  const isRental = list.transactionType === 'Rental';
  const hirePercent = list.bookingFeePercent ?? 10;
  const securityDeposit = list.securityDeposit ?? 150;
  const price = list.price ?? 0;
  
  const bookingFeeAmount = (price * hirePercent) / 100;
  const totalAmountToCollect = bookingFeeAmount + securityDeposit;

  const allItemsChecked = checkedItemIds.size === items.length && items.length > 0;

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans selection:bg-primary selection:text-white pb-32">
      {/* Brand Header */}
      <div className="relative pt-16 pb-8 px-6 flex flex-col items-center text-center space-y-6">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 bg-white rounded-[2rem] overflow-hidden shadow-2xl border-4 border-neutral-850 flex items-center justify-center"
        >
          {list.brandLogo ? (
            <img src={list.brandLogo} alt={list.brandName} className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
          ) : (
            <Package size={32} className="text-neutral-950" />
          )}
        </motion.div>
        
        <div className="space-y-2">
          {list.brandName && (
            <p className="text-primary font-black uppercase tracking-widest text-[10px] bg-primary/10 px-3 py-1 rounded-full border border-primary/20 inline-block">
              {list.brandName} Client Portal
            </p>
          )}
          <h1 className="text-3xl font-black tracking-tighter uppercase">{list.name}</h1>
          {isRental && (
            <span className="inline-block py-1 px-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] rounded-full font-black uppercase tracking-widest">
              💼 Equipment Rental & Booking Active
            </span>
          )}
        </div>
        
        {list.description && (
          <div className="text-neutral-400 max-w-sm text-xs leading-relaxed font-semibold">
            <ReactMarkdown>{list.description}</ReactMarkdown>
          </div>
        )}
      </div>

      {/* Checklist Instructions Alert */}
      <div className="max-w-md mx-auto px-6 mb-6">
        <div className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl flex gap-3 text-neutral-400">
          <Info size={18} className="text-primary shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-black text-white uppercase tracking-tight">Verify Your Package Booking</p>
            <p className="text-[11px] font-semibold leading-normal">
              {isRental ? "Please visually check the asset checklist below. Tap each item to verify its presence, then proceed to checkout." : "Please review the shared items packager library."}
            </p>
          </div>
        </div>
      </div>

      {/* Items List - Bio Style */}
      <div className="max-w-md mx-auto px-6 space-y-3.5">
        {items.map((item, idx) => {
          const isChecked = checkedItemIds.has(item.id);
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              onClick={() => toggleItemCheck(item.id)}
              className={`group relative border rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer ${
                isChecked 
                  ? 'bg-neutral-900/40 border-primary/20 hover:border-primary/30' 
                  : 'bg-neutral-900/20 border-neutral-800 hover:border-neutral-700/80'
              }`}
            >
              <div className="flex items-center p-4 gap-4">
                {/* Checkbox state */}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center border transition ${
                  isChecked 
                    ? 'bg-primary border-primary text-white' 
                    : 'bg-neutral-900 border-neutral-700 hover:border-neutral-500 text-transparent'
                }`}>
                  <Check size={12} className="stroke-[3]" />
                </div>

                <div className="w-14 h-14 bg-neutral-900 rounded-xl overflow-hidden flex-shrink-0 border border-neutral-800">
                  {item.photoUrls?.[0] ? (
                    <img src={item.photoUrls[0]} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-600">
                      <Package size={20} />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className={`font-black text-sm tracking-tight truncate ${isChecked ? 'text-neutral-300 line-through' : 'text-white'}`}>
                    <ReactMarkdown components={{ p: 'span' }}>{item.name}</ReactMarkdown>
                  </h3>
                  <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-neutral-500 mt-1">
                    <Tag size={9} />
                    <span className="font-mono">{item.assetTag}</span>
                    {item.aiLabel && (
                      <>
                        <span className="w-1 h-1 bg-neutral-800 rounded-full"></span>
                        <span className="text-primary">{item.aiLabel}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Bottom Sticky Action Console */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-neutral-950 via-neutral-950/95 to-transparent flex flex-col items-center">
        <div className="w-full max-w-sm space-y-3">
          {isRental && (!list.rentalStatus || list.rentalStatus === 'awaiting_payment') ? (
            <button
              onClick={() => {
                if (!allItemsChecked) {
                  toast.error("Please verify all items by checking them off before initiating secure rent checkout.");
                  return;
                }
                setShowCheckoutModal(true);
              }}
              disabled={!allItemsChecked}
              className={`w-full py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                allItemsChecked 
                  ? 'bg-primary text-white hover:bg-primary/95 shadow-xl shadow-primary/20' 
                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700/50'
              }`}
            >
              {allItemsChecked ? "🔓 Initiate Secure Hire Checkout" : `Verify all items to pay (${checkedItemIds.size}/${items.length})`}
            </button>
          ) : isRental ? (
            <div className="w-full py-3.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-extrabold text-[11px] uppercase tracking-widest rounded-2xl text-center">
              ✓ Booking Confirmed & Awaiting Release
            </div>
          ) : (
            <div className="w-full py-3 bg-neutral-900 border border-neutral-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center text-neutral-400">
              Verified Checklist View Mode Only
            </div>
          )}

          <div className="flex justify-center">
            <div className="flex items-center gap-2 px-4 py-2 bg-neutral-900/90 backdrop-blur rounded-full border border-neutral-800 shadow-xl">
              <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest">Securely Hosted on</span>
              <span className="text-[9px] font-black text-white uppercase tracking-wider">packer.tools</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECURE CHECKOUT PAYWALL MODAL */}
      <AnimatePresence>
        {showCheckoutModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-md p-6 sm:p-8 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-primary/10 text-primary rounded-xl border border-primary/20">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight">Hire Payment Portal</h3>
                    <p className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest">packer.tools merchant gateway</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCheckoutModal(false)}
                  className="text-neutral-500 hover:text-white transition"
                >
                  <XCircle size={20} />
                </button>
              </div>

              {paymentStep === 'particulars' && (
                <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                  {/* Financial Slip Box */}
                  <div className="bg-neutral-950 p-4 rounded-2xl border border-neutral-850 space-y-2">
                    <div className="flex justify-between text-xs text-neutral-400 font-bold">
                      <span>Kit Base Hire rate:</span>
                      <span className="text-white">{list.currency || '$'}{price}</span>
                    </div>
                    <div className="flex justify-between text-xs text-neutral-400 font-bold">
                      <span>Prepayment Booking Surcharge ({hirePercent}%):</span>
                      <span className="text-white">{list.currency || '$'}{bookingFeeAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-neutral-400 font-bold">
                      <span>Authorization Security Deposit:</span>
                      <span className="text-white">{list.currency || '$'}{securityDeposit.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-neutral-800 pt-2 flex justify-between text-xs font-black text-[#FF5500] uppercase tracking-wider">
                      <span>Rent Downpayment Total:</span>
                      <span>{list.currency || '$'}{totalAmountToCollect.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Form Particulars */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-[9px] uppercase tracking-widest font-black text-neutral-400 block mb-1">Customer Full Name (Booking holder)</label>
                      <input
                        type="text"
                        required
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl focus:ring-2 focus:ring-primary outline-none text-xs text-white"
                        placeholder="e.g. Samuel Stark"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase tracking-widest font-black text-neutral-400 block mb-1">Receipt Email Address</label>
                      <input
                        type="email"
                        required
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl focus:ring-2 focus:ring-primary outline-none text-xs text-white"
                        placeholder="e.g. sam@packer.tools"
                      />
                    </div>
                  </div>

                  {/* Sandbox Credit Card Information */}
                  <div className="space-y-3 pt-2">
                    <span className="text-[9px] uppercase tracking-widest font-black text-neutral-400 block pb-1 border-b border-neutral-800/60">Secure Card Entry</span>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        maxLength={19}
                        value={creditCard}
                        onChange={(e) => setCreditCard(e.target.value)}
                        className="w-full px-10 py-3 bg-neutral-950 border border-neutral-800 rounded-xl focus:ring-2 focus:ring-primary outline-none text-xs text-white tracking-widest font-mono"
                        placeholder="4111 2222 3333 4444"
                      />
                      <CreditCard className="absolute left-3 top-3.5 text-neutral-500" size={14} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <input
                        type="text"
                        required
                        maxLength={5}
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl focus:ring-2 focus:ring-primary outline-none text-xs text-white tracking-widest font-mono text-center"
                        placeholder="MM/YY"
                      />
                      <input
                        type="password"
                        required
                        maxLength={4}
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl focus:ring-2 focus:ring-primary outline-none text-xs text-white tracking-widest font-mono text-center"
                        placeholder="CVV"
                      />
                    </div>
                  </div>

                  {/* Canvas Draw signature */}
                  <div className="pt-2">
                    <SignaturePad onSave={(dataUrl) => setSignatureData(dataUrl)} />
                  </div>

                  {/* Bottom Checkout trigger */}
                  <button
                    type="submit"
                    className="w-full py-4 mt-2 bg-[#FF5500] hover:bg-[#ff7733] text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl transition"
                  >
                    Credit Secure Payment & Sign
                  </button>
                </form>
              )}

              {paymentStep === 'processing' && (
                <div className="flex flex-col items-center justify-center py-12 space-y-6 text-center animate-pulse">
                  <div className="p-4 bg-amber-500/10 text-amber-500 rounded-full border border-amber-500/20 animate-spin">
                    <RefreshCw size={36} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-base font-black uppercase tracking-tight">Clearing Escrow Payment</h4>
                    <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Verifying card authenticity & digital booking signature</p>
                  </div>
                </div>
              )}

              {paymentStep === 'receipt' && (
                <div className="flex flex-col items-center justify-center py-6 space-y-6 text-center animate-scale-up">
                  <div className="p-4 bg-green-500/10 text-green-500 rounded-full border border-green-500/20">
                    <ShieldCheck size={40} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-lg font-black uppercase tracking-tighter">🎉 Booking Complete!</h4>
                    <p className="text-xs text-neutral-400 font-bold max-w-xs leading-normal">
                      Pre-payment authorization cleared successfully. Order confirmation was dispatched back to the owner. Let them release the gear to you!
                    </p>
                  </div>

                  <div className="bg-neutral-950 p-4 rounded-2xl w-full text-left space-y-1.5 font-mono text-[10px] text-neutral-400 border border-neutral-850">
                    <div><span className="text-neutral-500">CLIENT:</span> <span className="text-white font-bold">{clientName}</span></div>
                    <div><span className="text-neutral-500">INVOICE PREPAYMENT:</span> <span className="text-emerald-400 font-bold">{list.currency || '$'}{bookingFeeAmount.toFixed(2)}</span></div>
                    <div><span className="text-neutral-500">ESCROW DEPOSIT:</span> <span className="text-[#FF5500] font-bold">{list.currency || '$'}{securityDeposit.toFixed(2)}</span></div>
                    <div><span className="text-neutral-500">GATEWAY PROOF ID:</span> <span className="text-zinc-300 font-bold">PT-TX-{Math.floor(100000 + Math.random() * 900000)}</span></div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowCheckoutModal(false);
                      setPaymentStep('particulars');
                    }}
                    className="w-full py-3.5 bg-neutral-800 hover:bg-neutral-750 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition"
                  >
                    Finish View
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
