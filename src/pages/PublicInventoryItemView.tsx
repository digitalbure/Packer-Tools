import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, onSnapshot, collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { InventoryItem } from './InventoryModule';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Tag, CheckCircle2, ShieldAlert, BadgeInfo, Scale, 
  DollarSign, Wrench, Calendar, Phone, Mail, User, AlertCircle, 
  Globe, Copy, Check, MessageSquare, ExternalLink, HelpCircle
} from 'lucide-react';

export default function PublicInventoryItemView() {
  const { inventoryId, itemId } = useParams<{ inventoryId: string; itemId: string }>();
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Finder report state
  const [finderName, setFinderName] = useState('');
  const [finderContact, setFinderContact] = useState('');
  const [finderMessage, setFinderMessage] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);

  useEffect(() => {
    if (!inventoryId || !itemId) {
      setError("Invalid inventory item reference path.");
      setLoading(false);
      return;
    }

    setLoading(true);
    const itemRef = doc(db, 'inventories', inventoryId, 'items', itemId);
    
    const unsubscribe = onSnapshot(itemRef, (docSnap) => {
      if (docSnap.exists()) {
        const itemData = { id: docSnap.id, ...docSnap.data() } as InventoryItem;
        
        // Check if public sharing is explicitly enabled
        if (itemData.publicSharingEnabled) {
          setItem(itemData);
          setError(null);
        } else {
          setError("This asset is private. Public sharing is not enabled for this item.");
        }
      } else {
        setError("This asset record does not exist or has been removed from our databases.");
      }
      setLoading(false);
    }, (err) => {
      console.error("Error fetching public inventory item:", err);
      setError("Missing access permissions. This item might be private.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [inventoryId, itemId]);

  // Handle report submission
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finderContact.trim() || !finderMessage.trim()) {
      toast.error("Please provide both a contact reference and message text.");
      return;
    }

    setSubmittingReport(true);
    try {
      // Log report under item incidents/messages for admin oversight
      const msgsRef = collection(db, 'inventories', inventoryId!, 'items', itemId!, 'publicReports');
      await addDoc(msgsRef, {
        finderName: finderName.trim() || 'Anonymous Finder',
        finderContact: finderContact.trim(),
        finderMessage: finderMessage.trim(),
        createdAt: new Date().toISOString(),
        resolved: false
      });

      setReportSubmitted(true);
      toast.success("Message sent securely to the asset custodian!");
    } catch (err) {
      console.error("Error creating finder message:", err);
      toast.error("Failed to transmit report. Please try again later.");
    } finally {
      setSubmittingReport(false);
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Direct link copied to clipboard!");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
          className="w-12 h-12 border-4 border-neutral-800 border-t-[#0066cc] rounded-full"
        />
        <p className="mt-4 text-xs font-black uppercase tracking-widest text-neutral-400">
          Syncing Passport Transceiver...
        </p>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-950/40 border border-red-800 text-red-500 rounded-2xl flex items-center justify-center mb-6 shadow-xl">
          <ShieldAlert size={32} />
        </div>
        <h1 className="text-xl font-bold uppercase tracking-tight mb-2">Access Restriced</h1>
        <p className="text-sm text-neutral-400 max-w-md mb-8">{error || "Asset not found."}</p>
        <Link 
          to="/" 
          className="px-6 py-3 bg-neutral-900 hover:bg-neutral-800 rounded-xl border border-neutral-800 text-xs font-bold uppercase tracking-wider transition"
        >
          Return to Portal
        </Link>
      </div>
    );
  }

  // Choose display background image or fallback gradient
  const hasPhoto = item.photoUrls && item.photoUrls.length > 0;
  const displayImage = hasPhoto 
    ? item.photoUrls![0] 
    : "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=600";

  return (
    <div className="min-h-screen bg-neutral-950 text-white selection:bg-[#0066cc]">
      {/* Visual Top Header Accent */}
      <div className="relative h-64 md:h-80 w-full overflow-hidden flex items-end">
        <div className="absolute inset-0 bg-black/60 z-10" />
        <div 
          className="absolute inset-0 bg-cover bg-center filter blur-lg scale-110 opacity-30"
          style={{ backgroundImage: `url(${displayImage})` }}
        />
        
        {/* Subtle grid lines background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:30px_30px]" />
        
        <div className="w-full max-w-5xl mx-auto px-4 md:px-6 relative z-20 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 bg-[#0066cc]/20 border border-[#0066cc]/40 text-[#0066cc] text-[9px] font-black uppercase tracking-wider rounded-full">
                {item.primaryCategory || 'General Gear'}
              </span>
              <span className={`px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-full border ${
                item.status === 'available' 
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400' 
                  : item.status === 'in_use'
                  ? 'bg-amber-950/40 border-amber-800 text-amber-400'
                  : 'bg-red-950/40 border-red-800 text-red-400'
              }`}>
                {item.status === 'available' ? 'Available / IN' : item.status === 'in_use' ? 'Out / In Use' : item.status}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold uppercase tracking-tight text-white leading-none">
              {item.brand ? <span className="text-neutral-500 mr-2 font-normal">{item.brand}</span> : null}
              {item.name}
            </h1>
            <p className="text-neutral-400 text-xs font-mono">
              Unique Passport Identifier: <span className="text-white select-all">{item.assetTag}</span>
            </p>
          </div>
          
          <button 
            onClick={copyShareLink}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-900/80 hover:bg-neutral-900 rounded-xl border border-neutral-800 text-xs font-bold uppercase tracking-wider transition self-start md:self-end"
          >
            <Copy size={13} />
            <span>Copy Passport Link</span>
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Info Columns */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Visual Media Showcase */}
            <div className="bg-neutral-900 rounded-[2rem] p-3 border border-neutral-800/80 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-neutral-950/80 backdrop-blur-md rounded-xl border border-neutral-800 text-[9px] font-black uppercase tracking-widest text-neutral-450">
                Media Passport Attachment
              </div>
              <div className="aspect-[4/3] rounded-[1.5rem] overflow-hidden bg-neutral-950 relative">
                <img 
                  src={displayImage} 
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-102 transition duration-500" 
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            {/* Tech Specs Summary Card */}
            <div className="bg-neutral-900 rounded-[2rem] p-6 md:p-8 border border-neutral-800/80 shadow-xl space-y-6">
              <h3 className="text-sm font-black uppercase tracking-wider border-b border-neutral-800 pb-3 text-neutral-300">
                Asset Identity & Specifications
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500 block">Manufacturer / Make</span>
                  <span className="text-xs font-extrabold text-white mt-1 block uppercase">{item.brand || 'Unbranded'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500 block">Model Identification</span>
                  <span className="text-xs font-extrabold text-white mt-1 block uppercase">{item.model || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500 block">Serial Reference</span>
                  <span className="text-xs font-extrabold font-mono text-neutral-200 mt-1 block select-all truncate">{item.serialNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500 block">Current Condition</span>
                  <span className="text-xs font-extrabold text-white mt-1 block uppercase flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${
                      item.condition === 'new' ? 'bg-emerald-500' : item.condition === 'good' ? 'bg-blue-500' : 'bg-amber-500'
                    }`} />
                    {item.condition}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500 block">Primary Category</span>
                  <span className="text-xs font-extrabold text-white mt-1 block uppercase">{item.primaryCategory}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500 block">Model No</span>
                  <span className="text-xs font-extrabold font-mono text-neutral-300 mt-1 block truncate">{item.modelNumber || 'N/A'}</span>
                </div>
              </div>

              {item.description && (
                <div className="pt-4 border-t border-neutral-800/50">
                  <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500 block mb-2">Custodian Deployment Notes</span>
                  <p className="text-xs text-neutral-300 leading-relaxed font-medium bg-neutral-950/45 rounded-xl p-4 border border-neutral-800">
                    {item.description}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Custodian Info & Lost Report Form */}
          <div className="space-y-8">
            
            {/* Custodian/Owner Card */}
            <div className="bg-neutral-900 rounded-[2rem] p-6 md:p-8 border border-neutral-800/80 shadow-xl space-y-6">
              <div className="flex items-center gap-3 border-b border-neutral-800 pb-4">
                <div className="w-10 h-10 rounded-xl bg-[#0066cc]/10 text-[#0066cc] flex items-center justify-center">
                  <User size={20} />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-neutral-450">Custodian Representative</h3>
                  <h4 className="text-base font-bold text-white uppercase">{item.ownerName || 'Verified Corporate Custodian'}</h4>
                </div>
              </div>

              {item.ownerBio && (
                <p className="text-xs text-neutral-350 leading-relaxed italic">
                  "{item.ownerBio}"
                </p>
              )}

              <div className="space-y-3 pt-2">
                {item.ownerEmail && (
                  <a 
                    href={`mailto:${item.ownerEmail}`}
                    className="flex items-center gap-3 p-3 bg-neutral-950/50 hover:bg-neutral-950 rounded-xl border border-neutral-800 transition group text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-neutral-900 text-neutral-450 group-hover:text-white flex items-center justify-center transition">
                      <Mail size={14} />
                    </div>
                    <div className="truncate">
                      <span className="text-[8px] font-black uppercase tracking-widest text-neutral-500 block">Contact Email</span>
                      <span className="text-xs font-semibold text-neutral-200 group-hover:text-white transition truncate block">{item.ownerEmail}</span>
                    </div>
                  </a>
                )}

                {item.ownerPhone && (
                  <a 
                    href={`tel:${item.ownerPhone}`}
                    className="flex items-center gap-3 p-3 bg-neutral-950/50 hover:bg-neutral-950 rounded-xl border border-neutral-800 transition group text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-neutral-900 text-neutral-450 group-hover:text-white flex items-center justify-center transition">
                      <Phone size={14} />
                    </div>
                    <div>
                      <span className="text-[8px] font-black uppercase tracking-widest text-neutral-500 block">Contact Telephone</span>
                      <span className="text-xs font-bold text-neutral-200 group-hover:text-white transition block">{item.ownerPhone}</span>
                    </div>
                  </a>
                )}
              </div>
            </div>

            {/* Found Item Reporter Form */}
            <div className="bg-neutral-900 rounded-[2rem] p-6 md:p-8 border border-neutral-800/80 shadow-xl space-y-6">
              <div className="space-y-1">
                <h3 className="text-xs font-black uppercase tracking-widest text-neutral-450 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Security Transceiver
                </h3>
                <h4 className="text-base font-bold text-white uppercase">Report Issue or Lost Item</h4>
                <p className="text-[10px] text-neutral-400">Did you locate this item or notice damages? Message the custodian securely below.</p>
              </div>

              {reportSubmitted ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-emerald-950/30 border border-emerald-900 rounded-2xl p-5 text-center space-y-3"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={20} />
                  </div>
                  <h5 className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">Transmission Complete</h5>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Your message has been uploaded securely to the owner's incidents pipeline. Thank you for maintaining logistics safety.
                  </p>
                  <button
                    onClick={() => setReportSubmitted(false)}
                    className="text-[10px] font-black uppercase tracking-wider text-neutral-450 hover:text-white transition pt-2"
                  >
                    Send another report
                  </button>
                </motion.div>
              ) : (
                <form onSubmit={handleSendMessage} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase tracking-widest text-neutral-500 block ml-1">Your Name (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. John Doe"
                      value={finderName}
                      onChange={(e) => setFinderName(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-white h-10 text-white font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase tracking-widest text-neutral-500 block ml-1">Your Email or Phone *</label>
                    <input
                      type="text"
                      placeholder="Required: How can we reach you?"
                      value={finderContact}
                      required
                      onChange={(e) => setFinderContact(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-white h-10 text-white font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase tracking-widest text-neutral-500 block ml-1">Message Detail *</label>
                    <textarea
                      placeholder="Required: State the current item coordinates, safety status, or issue description..."
                      value={finderMessage}
                      required
                      rows={3}
                      onChange={(e) => setFinderMessage(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2.5 text-xs outline-none focus:ring-1 focus:ring-white text-white font-medium"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingReport}
                    className="w-full py-3 bg-white hover:bg-neutral-100 text-neutral-900 font-black uppercase tracking-wider text-[10px] rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <span>{submittingReport ? "Transmitting..." : "Transmit Report"}</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-neutral-900 py-12 text-center text-[10px] text-neutral-500 uppercase tracking-widest">
        <div className="max-w-md mx-auto px-4 space-y-2">
          <p>© {new Date().getFullYear()} Packer Tools logistics. All rights reserved.</p>
          <p className="text-neutral-600 font-mono">Secured via decentralized asset passports.</p>
        </div>
      </footer>
    </div>
  );
}
