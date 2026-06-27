import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { doc, onSnapshot, collection, query, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Container, GearItem, UserProfile } from '../types';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { QRCodeCanvas } from 'qrcode.react';
import { 
  ArrowLeft, Package, Mail, Phone, MapPin, Building, Globe, ExternalLink, 
  QrCode, Info, Layers, User, ShieldAlert, CheckCircle, Clock, FileText, Share2, Printer
} from 'lucide-react';

export default function OrganizerBioPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryOwnerId = searchParams.get('owner');

  const [container, setContainer] = useState<Container | null>(null);
  const [items, setItems] = useState<GearItem[]>([]);
  const [ownerProfile, setOwnerProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Contact / Finder Form State
  const [finderName, setFinderName] = useState('');
  const [finderContact, setFinderContact] = useState('');
  const [finderMessage, setFinderMessage] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);

  useEffect(() => {
    const ownerId = queryOwnerId;
    if (!id || !ownerId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    // Fetch Container Snapshot
    const containerRef = doc(db, 'users', ownerId, 'containers', id);
    const unsubscribeContainer = onSnapshot(containerRef, async (docSnap) => {
      if (docSnap.exists()) {
        const containerData = { id: docSnap.id, ...docSnap.data() } as Container;
        setContainer(containerData);

        // Update document title for SEO / social bookmarking
        document.title = `${containerData.name} | Packer Tools Digital Organizer Passport`;

        // Load items within this container
        if (containerData.items && containerData.items.length > 0) {
          try {
            const gearColRef = collection(db, 'users', ownerId, 'gearLibrary');
            const gearSnap = await getDocs(gearColRef);
            const allGear = gearSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as GearItem));
            const nestedItems = allGear.filter(g => containerData.items.includes(g.id));
            setItems(nestedItems);
          } catch (error) {
            console.error("Error fetching gear items in container:", error);
          }
        } else {
          setItems([]);
        }
      } else {
        toast.error("Organizer not found or has been deleted.");
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching container details:", error);
      toast.error("Failed to load organizer details.");
      setLoading(false);
    });

    // Fetch Owner Profile Snapshot
    const ownerRef = doc(db, 'users', ownerId);
    const unsubscribeOwner = onSnapshot(ownerRef, (ownerSnap) => {
      if (ownerSnap.exists()) {
        setOwnerProfile({ uid: ownerSnap.id, ...ownerSnap.data() } as UserProfile);
      }
    }, (error) => {
      console.warn("OrganizerBioPage: Error catching owner profile:", error);
    });

    return () => {
      unsubscribeContainer();
      unsubscribeOwner();
    };
  }, [id, queryOwnerId]);

  const handleSendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finderName.trim() || !finderContact.trim() || !finderMessage.trim()) {
      toast.error("Please fill in all details.");
      return;
    }

    setSubmittingReport(true);
    try {
      // Record a secure message log for the owner
      await addDoc(collection(db, 'users', queryOwnerId!, 'messages'), {
        type: 'organizer_alert',
        containerId: id,
        containerName: container?.name || 'Unknown Organizer',
        senderName: finderName.trim(),
        senderContact: finderContact.trim(),
        message: finderMessage.trim(),
        createdAt: new Date().toISOString(),
        read: false
      });

      setReportSubmitted(true);
      toast.success("Alert notification dispatched securely to the manager!");
    } catch (err) {
      console.error("Error submitting report:", err);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setSubmittingReport(false);
    }
  };

  const getContainerTypeEmoji = (type: string) => {
    switch (type) {
      case 'shelf': return '🗄️';
      case 'locker': return '🔒';
      case 'bag': return '🎒';
      case 'suitcase': return '🧳';
      case 'pelican':
      case 'nanuk':
      case 'case': return '💼';
      case 'box': return '📦';
      default: return '🧰';
    }
  };

  const shareUrl = window.location.href;

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-6 text-white">
        <div className="w-12 h-12 border-4 border-t-primary border-neutral-700 rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold uppercase tracking-widest text-neutral-400">Loading Passport Credentials...</p>
      </div>
    );
  }

  if (!container) {
    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <ShieldAlert size={64} className="text-red-500 mb-4 animate-bounce" />
        <h1 className="text-2xl font-black uppercase tracking-tight mb-2">Invalid Asset Token</h1>
        <p className="text-sm text-neutral-400 max-w-md mb-6">
          This organizer credentials are unknown or the record has been archived by the security controller.
        </p>
        <Link to="/" className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold uppercase tracking-widest rounded-xl transition">
          Return to Hub
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Top Banner Accent */}
      <div className="h-2 bg-gradient-to-r from-primary via-neutral-500 to-amber-500" />

      {/* Main Core View Area */}
      <div className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8 space-y-8">
        {/* Navigation / Actions Bar */}
        <div className="flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-400 hover:text-white transition group bg-neutral-900 px-4 py-2 rounded-xl"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
            <span>Go Back</span>
          </button>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowQrCode(!showQrCode)}
              className="p-2.5 bg-neutral-900 text-neutral-300 hover:text-white rounded-xl transition hover:scale-105"
              title="Show QR Code"
            >
              <QrCode size={18} />
            </button>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(shareUrl);
                toast.success("URL copied to clipboard!");
              }}
              className="p-2.5 bg-neutral-900 text-neutral-300 hover:text-white rounded-xl transition hover:scale-105"
              title="Copy Share Link"
            >
              <Share2 size={18} />
            </button>
            <button 
              onClick={() => window.print()}
              className="p-2.5 bg-neutral-900 text-neutral-300 hover:text-white rounded-xl transition hover:scale-105"
              title="Print Page Passport"
            >
              <Printer size={18} />
            </button>
          </div>
        </div>

        {/* QR Code Expanded Drawer Panel */}
        {showQrCode && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 bg-neutral-900 border border-neutral-800 rounded-3xl flex flex-col items-center text-center space-y-4"
          >
            <h4 className="text-xs font-black uppercase tracking-widest text-neutral-400">Organizer Public Passport Link QR</h4>
            <div className="bg-white p-4 rounded-2xl inline-block">
              <QRCodeCanvas value={shareUrl} size={160} />
            </div>
            <p className="text-[10px] text-neutral-500 max-w-xs leading-relaxed">
              Scan this QR code with any standard camera to access this live physical organizer status catalog.
            </p>
          </motion.div>
        )}

        {/* Main Content Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT PANEL: Organizer Image & Specific Details (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-neutral-900 border border-neutral-800/80 rounded-[2.5rem] overflow-hidden shadow-xl">
              <div className="h-64 md:h-80 relative bg-neutral-800 flex items-center justify-center">
                {container.photoUrls?.[0] ? (
                  <img 
                    src={container.photoUrls[0]} 
                    alt={container.name} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-8xl select-none">{getContainerTypeEmoji(container.type)}</div>
                )}
                
                <span className="absolute top-6 left-6 px-3 py-1 bg-black/60 text-white rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-sm border border-white/10 shadow-lg">
                  {container.type}
                </span>

                {container.status && (
                  <span className="absolute bottom-6 left-6 px-3 py-1 bg-primary text-black rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg">
                    {container.status}
                  </span>
                )}
              </div>

              {/* Title Info */}
              <div className="p-8 space-y-4">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Asset Title</p>
                  <h1 className="text-3xl font-black uppercase tracking-tighter text-white mt-1">
                    {container.name}
                  </h1>
                  {container.model && (
                    <p className="text-xs font-bold text-neutral-400 mt-1 uppercase">Model: {container.model}</p>
                  )}
                </div>

                {container.description && (
                  <div className="space-y-1">
                    <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Statement / Purpose</p>
                    <p className="text-xs text-neutral-400 italic leading-relaxed">"{container.description}"</p>
                  </div>
                )}

                {/* Dimensions & Weight */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-800/60">
                  {container.dimensions && (
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-widest text-neutral-500">Volume (L x W x H)</p>
                      <p className="text-xs font-bold text-neutral-300 mt-1">
                        {container.dimensions.length} x {container.dimensions.width} x {container.dimensions.height} {container.dimensions.unit}
                      </p>
                    </div>
                  )}

                  {container.weightLimit !== undefined && (
                    <div>
                      <p className="text-[8px] font-black uppercase tracking-widest text-neutral-500">Load Limit</p>
                      <p className="text-xs font-bold text-neutral-300 mt-1">
                        {container.weightLimit} {container.weightUnit || 'kg'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Organizer Notes Section (If present publicly) */}
                {container.notes && (
                  <div className="bg-amber-950/20 border border-amber-900/30 rounded-2xl p-4 space-y-2 mt-4">
                    <p className="text-[8px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-1.5">
                      <FileText size={12} /> Organizer Operational Notes
                    </p>
                    <p className="text-xs text-amber-100/90 leading-relaxed font-medium">
                      {container.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Owner Profile Module */}
            {ownerProfile && (
              <div className="bg-neutral-900 border border-neutral-800/80 rounded-[2.5rem] p-8 space-y-6 shadow-xl">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden bg-neutral-800 border-2 border-neutral-700/60 flex items-center justify-center shrink-0">
                    {ownerProfile.photoURL ? (
                      <img src={ownerProfile.photoURL} alt={ownerProfile.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <User size={24} className="text-neutral-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-widest text-neutral-500">Owner / Custodian</p>
                    <h3 className="text-lg font-black uppercase tracking-tight text-white mt-0.5">{ownerProfile.displayName}</h3>
                    {ownerProfile.company && (
                      <p className="text-xs text-neutral-400 font-semibold">{ownerProfile.company}</p>
                    )}
                  </div>
                </div>

                {ownerProfile.bio && (
                  <p className="text-xs text-neutral-400 leading-relaxed italic">
                    "{ownerProfile.bio}"
                  </p>
                )}

                <div className="space-y-3 pt-4 border-t border-neutral-800/60 text-xs font-semibold text-neutral-300">
                  {ownerProfile.email && (
                    <div className="flex items-center gap-3">
                      <Mail size={14} className="text-neutral-500" />
                      <a href={`mailto:${ownerProfile.email}`} className="hover:text-white hover:underline transition truncate">{ownerProfile.email}</a>
                    </div>
                  )}
                  {ownerProfile.phoneNumber && (
                    <div className="flex items-center gap-3">
                      <Phone size={14} className="text-neutral-500" />
                      <a href={`tel:${ownerProfile.phoneNumber}`} className="hover:text-white hover:underline transition">{ownerProfile.phoneNumber}</a>
                    </div>
                  )}
                  {ownerProfile.location && (
                    <div className="flex items-center gap-3">
                      <MapPin size={14} className="text-neutral-500" />
                      <span>{ownerProfile.location}</span>
                    </div>
                  )}
                  {ownerProfile.website && (
                    <div className="flex items-center gap-3">
                      <Globe size={14} className="text-neutral-500" />
                      <a href={ownerProfile.website} target="_blank" rel="noopener noreferrer" className="hover:text-white hover:underline transition flex items-center gap-1">
                        <span>Visit Website</span>
                        <ExternalLink size={10} />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT PANEL: Content Checklist & Alert Form (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Packed Items List */}
            <div className="bg-neutral-900 border border-neutral-800/80 rounded-[2.5rem] p-8 space-y-6 shadow-xl">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                    <Layers size={18} className="text-primary" /> Packed Inventory Contents
                  </h2>
                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500 mt-1">
                    Verified Digital Record ({items.length} {items.length === 1 ? 'item' : 'items'})
                  </p>
                </div>
                <div className="px-3 py-1 bg-neutral-850 rounded-full text-[10px] font-black text-neutral-400 border border-neutral-800/50">
                  ONLINE
                </div>
              </div>

              <div className="space-y-3 max-h-[30rem] overflow-y-auto pr-2 custom-scrollbar">
                {items.map(item => (
                  <div 
                    key={item.id}
                    className="p-4 bg-neutral-950 border border-neutral-850 rounded-2xl flex items-center justify-between gap-4 group/item hover:border-neutral-700/80 transition-all duration-300"
                  >
                    <div className="min-w-0 flex items-center gap-3">
                      <div className="w-10 h-10 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-center text-neutral-400 shrink-0">
                        {item.photoUrls?.[0] ? (
                          <img src={item.photoUrls[0]} alt={item.name} className="w-full h-full object-cover rounded-xl" />
                        ) : (
                          <Package size={18} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-neutral-100 group-hover/item:text-white transition-colors truncate">
                          {item.brand && <span className="text-neutral-400 font-medium mr-1">{item.brand}</span>}
                          {item.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] text-neutral-500 uppercase font-black">{item.category}</span>
                          {item.assetTag && (
                            <span className="text-[8px] bg-neutral-900 text-neutral-400 border border-neutral-800 px-1.5 py-0.2 rounded font-mono uppercase">
                              #{item.assetTag}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {item.status && (
                        <span className={`px-2.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                          item.status === 'in_use' 
                            ? 'bg-amber-900/30 text-amber-500 border border-amber-900/40' 
                            : 'bg-green-950/30 text-green-500 border border-green-900/40'
                        }`}>
                          {item.status === 'in_use' ? 'OUT' : item.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {items.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-neutral-500 space-y-2 bg-neutral-950 rounded-3xl border border-dashed border-neutral-800">
                    <Package size={40} className="strokeWidth={1} text-neutral-600" />
                    <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">Empty Container Registry</p>
                    <p className="text-[10px] text-neutral-500 max-w-xs">No active assets are currently checked-in inside this physical container.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Interactive Alert Form for Lost/Found / Support */}
            <div className="bg-neutral-900 border border-neutral-800/80 rounded-[2.5rem] p-8 space-y-6 shadow-xl">
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight text-white flex items-center gap-2">
                  <ShieldAlert size={18} className="text-amber-500 animate-pulse" /> Dispatch Incident or Alert Log
                </h3>
                <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500 mt-1">
                  Secure communications for tracking, finding or general inquiries
                </p>
              </div>

              {reportSubmitted ? (
                <div className="p-6 bg-green-950/30 border border-green-900/40 rounded-3xl text-center space-y-4">
                  <CheckCircle size={40} className="text-green-500 mx-auto" />
                  <div>
                    <h4 className="font-bold text-sm text-green-400">Message Dispatched Successfully!</h4>
                    <p className="text-[10px] text-neutral-400 mt-1 max-w-sm mx-auto">
                      Your query has been securely locked. The asset manager has been notified via the system database logs.
                    </p>
                  </div>
                  <button 
                    onClick={() => setReportSubmitted(false)}
                    className="py-2.5 px-4 bg-neutral-850 hover:bg-neutral-800 text-[10px] font-black uppercase tracking-widest rounded-xl transition"
                  >
                    Send Another Alert
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSendReport} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Your Full Name</label>
                      <input 
                        type="text" 
                        required
                        value={finderName}
                        onChange={e => setFinderName(e.target.value)}
                        placeholder="e.g. John Doe"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none focus:border-primary text-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Contact Email / Phone</label>
                      <input 
                        type="text" 
                        required
                        value={finderContact}
                        onChange={e => setFinderContact(e.target.value)}
                        placeholder="e.g. email@example.com"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none focus:border-primary text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Message / Status Report</label>
                    <textarea 
                      required
                      value={finderMessage}
                      onChange={e => setFinderMessage(e.target.value)}
                      rows={4}
                      placeholder="e.g. I found this case in Room 3B... or I need to request this container for tomorrow's dispatch."
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none focus:border-primary text-white resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingReport}
                    className="w-full py-3 bg-white hover:bg-neutral-100 text-neutral-900 font-bold text-xs uppercase tracking-widest rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <span>{submittingReport ? 'Sending...' : 'Send Secured Broadcast Alert'}</span>
                  </button>
                </form>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Footer Branding */}
      <footer className="py-6 border-t border-neutral-900 text-center bg-neutral-950">
        <div className="flex items-center justify-center gap-2 text-xs font-bold text-neutral-600 uppercase tracking-widest">
          <Package size={14} />
          <span>Packer Tools Asset Control Registry Portal</span>
        </div>
      </footer>
    </div>
  );
}
