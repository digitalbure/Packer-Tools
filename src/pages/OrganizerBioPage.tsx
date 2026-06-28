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
  QrCode, Info, Layers, User, ShieldAlert, CheckCircle, Clock, FileText, Share2, Printer,
  Lock, Unlock, Minus, Plus
} from 'lucide-react';

export default function OrganizerBioPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryOwnerId = searchParams.get('owner');

  const [container, setContainer] = useState<Container | null>(null);
  const [items, setItems] = useState<GearItem[]>([]);
  const [allUserGear, setAllUserGear] = useState<GearItem[]>([]);
  const [ownerProfile, setOwnerProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Lock and collapsible states
  const [pinInput, setPinInput] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinError, setPinError] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'flat' | 'sections'>('flat');

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
            setAllUserGear(allGear);
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
    if (!finderContact.trim() || !finderMessage.trim()) {
      toast.error("Please fill in contact and message details.");
      return;
    }

    setSubmittingReport(true);
    try {
      // Record a secure message log for the owner
      await addDoc(collection(db, 'users', queryOwnerId!, 'messages'), {
        type: 'organizer_alert',
        containerId: id,
        containerName: container?.name || 'Unknown Organizer',
        senderName: finderName.trim() || 'Anonymous Custodian/Finder',
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

  const hasPin = !!container?.pinCode;
  const isMissing = container?.status === 'missing';
  const requiresUnlock = hasPin && container?.isLocked && !isMissing;
  const showContentLocked = requiresUnlock && !isUnlocked;

  const displayedItems = items.filter(item => {
    if (requiresUnlock && isUnlocked) return true;
    return item.visibility !== 'private';
  });

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!container) return;
    if (pinInput === container.pinCode) {
      setIsUnlocked(true);
      setPinError('');
      toast.success("Passport details unlocked successfully!");
    } else {
      setPinError("Incorrect security PIN code. Access denied.");
      toast.error("Incorrect PIN");
    }
  };

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

  if (showContentLocked) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between">
        {/* Top Banner Accent */}
        <div className="h-2 bg-gradient-to-r from-neutral-800 via-neutral-600 to-neutral-800" />

        <div className="max-w-md w-full mx-auto p-6 space-y-8 flex-1 flex flex-col justify-center">
          <div className="bg-neutral-900 border border-neutral-850 rounded-[2.5rem] p-8 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 bg-neutral-950 border border-neutral-800 rounded-3xl flex items-center justify-center mx-auto text-amber-500 shadow-inner">
              <Lock size={32} />
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 bg-neutral-950 text-neutral-400 border border-neutral-800 rounded-full text-[8px] font-black uppercase tracking-widest">
                Protected Passport
              </span>
              <h1 className="text-2xl font-black uppercase tracking-tight text-white mt-2">
                {container.name}
              </h1>
              <p className="text-xs text-neutral-400 leading-relaxed max-w-xs mx-auto">
                This physical organizer's catalog is secured with a digital padlock. Enter the owner's assigned PIN code to unlock.
              </p>
            </div>

            <form onSubmit={handleVerifyPin} className="space-y-4">
              <div className="space-y-1.5">
                <input
                  type="password"
                  maxLength={4}
                  value={pinInput}
                  onChange={e => {
                    setPinInput(e.target.value.replace(/\D/g, ''));
                    setPinError('');
                  }}
                  placeholder="••••"
                  className="w-full text-center bg-neutral-950 border border-neutral-800 rounded-2xl px-6 py-4 text-2xl font-mono tracking-widest text-white focus:outline-none focus:border-primary font-bold"
                />
                {pinError && (
                  <p className="text-[10px] text-red-500 font-bold">{pinError}</p>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-white hover:bg-neutral-100 text-neutral-900 font-bold text-xs uppercase tracking-widest rounded-xl transition shadow-lg flex items-center justify-center gap-2"
              >
                <Unlock size={14} />
                <span>Verify & Open Passport</span>
              </button>
            </form>
          </div>

          {/* Incident reporting available even while locked */}
          <div className="bg-neutral-900 border border-neutral-850 rounded-[2.5rem] p-8 space-y-6 shadow-xl">
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight text-white flex items-center gap-2 justify-center">
                <ShieldAlert size={16} className="text-amber-500 animate-pulse" /> Found this Case / Report Loss
              </h3>
              <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500 mt-1 text-center">
                Contact the owner securely without unlocking the inventory list
              </p>
            </div>

            {reportSubmitted ? (
              <div className="p-4 bg-green-950/20 border border-green-900/30 rounded-2xl text-center space-y-2">
                <CheckCircle size={24} className="text-green-500 mx-auto" />
                <h4 className="font-bold text-xs text-green-400">Alert Dispatched!</h4>
                <p className="text-[9px] text-neutral-400">
                  The custodian is notified of your transmission. They will contact you shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSendReport} className="space-y-3 text-left">
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase tracking-widest text-neutral-400">Your Contact Details</label>
                  <input 
                    type="text" 
                    required
                    value={finderContact}
                    onChange={e => setFinderContact(e.target.value)}
                    placeholder="e.g. email or phone number"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-primary text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase tracking-widest text-neutral-400">Message</label>
                  <textarea 
                    required
                    value={finderMessage}
                    onChange={e => setFinderMessage(e.target.value)}
                    rows={2}
                    placeholder="e.g. I found this case in room 204..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-primary text-white resize-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-[10px] uppercase tracking-widest rounded-xl transition"
                >
                  Send Report
                </button>
              </form>
            )}
          </div>
        </div>

        <footer className="py-4 border-t border-neutral-900 text-center bg-neutral-950">
          <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
            <Package size={12} />
            <span>Packer Tools Security Protection</span>
          </div>
        </footer>
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

        {/* Banner if marked missing */}
        {isMissing && (
          <div className="bg-amber-950/40 border border-amber-900/60 p-6 rounded-[2rem] flex flex-col sm:flex-row items-start gap-4 shadow-xl animate-pulse">
            <div className="p-3 bg-amber-500 text-black rounded-2xl shrink-0">
              <ShieldAlert size={20} className="stroke-[2.5]" />
            </div>
            <div className="text-left">
              <h3 className="font-black text-sm text-amber-400 uppercase tracking-tight">📢 Physical Organizer Marked Missing / Lost</h3>
              <p className="text-xs text-amber-200/80 leading-relaxed mt-1">
                This container is currently flagged as lost or missing. PIN security lock has been automatically bypassed so that return/custodian credentials can be accessed. If found, please use the contact dispatch tool below to assist with safe return.
              </p>
            </div>
          </div>
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
              <div className="flex justify-between items-center flex-wrap gap-3">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                    <Layers size={18} className="text-primary" /> Packed Inventory Contents
                  </h2>
                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500 mt-1">
                    Verified Digital Record ({displayedItems.length} {displayedItems.length === 1 ? 'item' : 'items'})
                  </p>
                </div>
                
                <div className="flex bg-neutral-950 p-1 rounded-xl border border-neutral-850">
                  <button
                    onClick={() => setViewMode('flat')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-300 ${
                      viewMode === 'flat'
                        ? 'bg-neutral-800 text-white font-black'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    Flat List
                  </button>
                  <button
                    onClick={() => setViewMode('sections')}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-300 ${
                      viewMode === 'sections'
                        ? 'bg-neutral-800 text-white font-black'
                        : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    Compartments
                  </button>
                </div>
              </div>

              {/* View Mode: Flat List */}
              {viewMode === 'flat' && (
                <div className="space-y-3 max-h-[35rem] overflow-y-auto pr-2 custom-scrollbar">
                  {displayedItems.map(item => {
                    const isKit = item?.isKit || item?.category === 'Kit' || item?.category === 'Kits';
                    const hasExpandableContent = (isKit && item?.childItemIds && item.childItemIds.length > 0) || (item?.addOns && item.addOns.length > 0);
                    const isExpanded = expandedItems.has(item.id);
                    const isPrivate = item.visibility === 'private';
                    
                    return (
                      <div 
                        key={item.id}
                        className="p-1 bg-neutral-950 border border-neutral-850 rounded-2xl hover:border-neutral-700/80 transition-all duration-300 text-left"
                      >
                        <div className="p-3.5 flex items-center justify-between gap-4 group/item">
                          <div className="min-w-0 flex items-center gap-3">
                            {hasExpandableContent ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const next = new Set(expandedItems);
                                  if (next.has(item.id)) {
                                    next.delete(item.id);
                                  } else {
                                    next.add(item.id);
                                  }
                                  setExpandedItems(next);
                                }}
                                className="p-1 hover:bg-neutral-900 rounded-lg transition text-neutral-400 hover:text-white flex items-center justify-center shrink-0"
                                title={isExpanded ? "Collapse Details" : "Expand Details"}
                              >
                                {isExpanded ? <Minus size={14} className="stroke-[3]" /> : <Plus size={14} className="stroke-[3]" />}
                              </button>
                            ) : (
                              <div className="w-6 h-6 flex items-center justify-center text-neutral-600 shrink-0 select-none font-black text-xs">
                                •
                              </div>
                            )}
                            <div className="w-10 h-10 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center justify-center text-neutral-400 shrink-0">
                              {item.photoUrls?.[0] ? (
                                <img src={item.photoUrls[0]} alt={item.name} className="w-full h-full object-cover rounded-xl" />
                              ) : (
                                isKit ? <Layers size={18} className="text-primary shrink-0 animate-pulse" /> : <Package size={18} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-sm text-neutral-100 group-hover/item:text-white transition-colors truncate flex items-center gap-1.5 flex-wrap">
                                {item.brand && <span className="text-neutral-400 font-medium mr-1">{item.brand}</span>}
                                <span>{item.name}</span>
                                {isKit && (
                                  <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-black uppercase tracking-widest">
                                    Kit
                                  </span>
                                )}
                                {isPrivate && (
                                  <span className="text-[8px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded font-black uppercase tracking-widest flex items-center gap-0.5">
                                    <Lock size={8} /> Private
                                  </span>
                                )}
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

                        {isExpanded && hasExpandableContent && (
                          <div className="pl-10 pr-4 pb-4 space-y-3 border-t border-neutral-900/50 pt-3 bg-neutral-950/30 rounded-b-2xl text-left">
                            {/* Kit Contents */}
                            {isKit && item?.childItemIds && item.childItemIds.length > 0 && (
                              <div className="space-y-1.5">
                                <p className="text-[8px] font-black uppercase text-neutral-500 tracking-widest">Kit Contents ({item.childItemIds.length})</p>
                                <div className="space-y-1">
                                  {item.childItemIds.map(childId => {
                                    const child = allUserGear.find(g => g.id === childId);
                                    return (
                                      <div key={childId} className="flex items-center gap-2 px-2.5 py-1.5 bg-neutral-900 rounded-lg text-neutral-300 text-xs border border-neutral-800 shadow-xs">
                                        <Package size={10} className="text-neutral-500" />
                                        <span className="font-semibold truncate">{child?.name || 'Loading sub-item...'}</span>
                                        {child?.brand && <span className="text-[10px] text-neutral-500 font-medium ml-auto">{child.brand}</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Accessories / Add Ons */}
                            {item?.addOns && item.addOns.length > 0 && (
                              <div className="space-y-1.5">
                                <p className="text-[8px] font-black uppercase text-neutral-500 tracking-widest">Accessories & Add-ons ({item.addOns.length})</p>
                                <div className="grid grid-cols-1 gap-1.5">
                                  {item.addOns.map((addOn, index) => (
                                    <div key={index} className="flex flex-col md:flex-row md:items-center justify-between gap-1 px-3 py-2 bg-neutral-900 rounded-lg border border-neutral-800 shadow-xs text-xs">
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold text-neutral-300 truncate">{addOn.name}</span>
                                          {addOn.type && (
                                            <span className="text-[8px] bg-neutral-850 text-neutral-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                              {addOn.type}
                                            </span>
                                          )}
                                        </div>
                                        {addOn.notes && (
                                          <p className="text-[10px] text-neutral-500 italic mt-0.5">"{addOn.notes}"</p>
                                        )}
                                      </div>
                                      <div className="text-neutral-400 font-mono text-[10px] shrink-0 font-bold self-start md:self-auto">
                                        {addOn.price === 0 ? 'Included' : `$${addOn.price}`}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {displayedItems.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-neutral-500 space-y-2 bg-neutral-950 rounded-3xl border border-dashed border-neutral-800">
                      <Package size={40} className="text-neutral-600" />
                      <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">Empty Container Registry</p>
                      <p className="text-[10px] text-neutral-500 max-w-xs">No active assets are currently checked-in inside this physical container.</p>
                    </div>
                  )}
                </div>
              )}

              {/* View Mode: Compartments */}
              {viewMode === 'sections' && (() => {
                const unassignedItems = displayedItems.filter(item => !(container?.sections || []).some(s => s.items.includes(item.id)));
                return (
                  <div className="space-y-4 max-h-[35rem] overflow-y-auto pr-2 custom-scrollbar text-left">
                    {/* Render Each Compartment */}
                    {(container?.sections || []).map(sec => {
                      const secAssignedItems = displayedItems.filter(item => sec.items.includes(item.id));
                      return (
                        <div key={sec.id} className="p-4 bg-neutral-950 border border-neutral-850 rounded-3xl space-y-3">
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-wide text-neutral-100 flex items-center gap-2">
                              <span>📁 {sec.name}</span>
                              <span className="text-[8px] font-mono text-neutral-500 bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800">{secAssignedItems.length} items</span>
                            </h4>
                            {sec.description && (
                              <p className="text-[10px] text-neutral-400 italic leading-tight mt-0.5">{sec.description}</p>
                            )}
                          </div>

                          {/* List of items in section */}
                          <div className="space-y-2 pt-1 border-t border-neutral-900/50">
                            {secAssignedItems.map(item => {
                              const isKit = item?.isKit || item?.category === 'Kit' || item?.category === 'Kits';
                              const hasExpandableContent = (isKit && item?.childItemIds && item.childItemIds.length > 0) || (item?.addOns && item.addOns.length > 0);
                              const isExpanded = expandedItems.has(item.id);
                              
                              return (
                                <div key={item.id} className="p-1 bg-neutral-900 border border-neutral-850 rounded-2xl">
                                  <div className="p-3.5 flex items-center justify-between gap-4">
                                    <div className="min-w-0 flex items-center gap-3">
                                      {hasExpandableContent ? (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const next = new Set(expandedItems);
                                            if (next.has(item.id)) {
                                              next.delete(item.id);
                                            } else {
                                              next.add(item.id);
                                            }
                                            setExpandedItems(next);
                                          }}
                                          className="p-1 hover:bg-neutral-850 rounded-lg transition text-neutral-400 hover:text-white flex items-center justify-center shrink-0"
                                        >
                                          {isExpanded ? <Minus size={14} className="stroke-[3]" /> : <Plus size={14} className="stroke-[3]" />}
                                        </button>
                                      ) : (
                                        <div className="w-6 h-6 flex items-center justify-center text-neutral-600 shrink-0 font-black text-xs">
                                          •
                                        </div>
                                      )}
                                      <div className="w-8 h-8 bg-neutral-950 border border-neutral-800 rounded-lg flex items-center justify-center text-neutral-400 shrink-0">
                                        {item.photoUrls?.[0] ? (
                                          <img src={item.photoUrls[0]} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                                        ) : (
                                          isKit ? <Layers size={14} className="text-primary shrink-0 animate-pulse" /> : <Package size={14} />
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <h4 className="font-bold text-xs text-neutral-100 truncate">
                                          {item.brand && <span className="text-neutral-400 font-medium mr-1">{item.brand}</span>}
                                          {item.name}
                                        </h4>
                                        <span className="text-[8px] text-neutral-500 uppercase font-bold">{item.category}</span>
                                      </div>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                      item.status === 'in_use' 
                                        ? 'bg-amber-900/30 text-amber-500 border border-amber-900/40' 
                                        : 'bg-green-950/30 text-green-500 border border-green-900/40'
                                    }`}>
                                      {item.status === 'in_use' ? 'OUT' : 'IN'}
                                    </span>
                                  </div>

                                  {isExpanded && hasExpandableContent && (
                                    <div className="pl-10 pr-4 pb-4 space-y-3 border-t border-neutral-900/50 pt-3 text-xs">
                                      {isKit && item?.childItemIds && item.childItemIds.length > 0 && (
                                        <div className="space-y-1">
                                          {item.childItemIds.map(childId => {
                                            const child = allUserGear.find(g => g.id === childId);
                                            return (
                                              <div key={childId} className="flex items-center gap-2 px-2 py-1 bg-neutral-950 rounded border border-neutral-800 text-neutral-400">
                                                <Package size={10} />
                                                <span className="truncate">{child?.name || 'Sub-item'}</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {secAssignedItems.length === 0 && (
                              <p className="text-[10px] text-neutral-500 italic text-center py-2">No items are packed inside this division.</p>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Unassigned Items Section */}
                    <div className="p-4 bg-neutral-950/40 border border-dashed border-neutral-800 rounded-3xl space-y-3">
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wide text-neutral-400">Main Space / Unallocated Gear</h4>
                        <p className="text-[9px] text-neutral-500 italic">Items placed generally inside the container without a custom division assignment</p>
                      </div>

                      <div className="space-y-2 pt-1 border-t border-neutral-850">
                        {unassignedItems.map(item => {
                          const isKit = item?.isKit || item?.category === 'Kit' || item?.category === 'Kits';
                          const hasExpandableContent = (isKit && item?.childItemIds && item.childItemIds.length > 0) || (item?.addOns && item.addOns.length > 0);
                          const isExpanded = expandedItems.has(item.id);

                          return (
                            <div key={item.id} className="p-1 bg-neutral-950 border border-neutral-850 rounded-2xl">
                              <div className="p-3.5 flex items-center justify-between gap-4">
                                <div className="min-w-0 flex items-center gap-3">
                                  {hasExpandableContent ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const next = new Set(expandedItems);
                                        if (next.has(item.id)) {
                                          next.delete(item.id);
                                        } else {
                                          next.add(item.id);
                                        }
                                        setExpandedItems(next);
                                      }}
                                      className="p-1 hover:bg-neutral-850 rounded-lg transition text-neutral-400 hover:text-white flex items-center justify-center shrink-0"
                                    >
                                      {isExpanded ? <Minus size={14} className="stroke-[3]" /> : <Plus size={14} className="stroke-[3]" />}
                                    </button>
                                  ) : (
                                    <div className="w-6 h-6 flex items-center justify-center text-neutral-600 shrink-0 font-black text-xs">
                                      •
                                    </div>
                                  )}
                                  <div className="w-8 h-8 bg-neutral-900 border border-neutral-800 rounded-lg flex items-center justify-center text-neutral-400 shrink-0">
                                    {item.photoUrls?.[0] ? (
                                      <img src={item.photoUrls[0]} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                                    ) : (
                                      isKit ? <Layers size={14} className="text-primary shrink-0 animate-pulse" /> : <Package size={14} />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className="font-bold text-xs text-neutral-100 truncate">
                                      {item.brand && <span className="text-neutral-400 font-medium mr-1">{item.brand}</span>}
                                      {item.name}
                                    </h4>
                                    <span className="text-[8px] text-neutral-500 uppercase font-bold">{item.category}</span>
                                  </div>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                  item.status === 'in_use' 
                                    ? 'bg-amber-900/30 text-amber-500 border border-amber-900/40' 
                                    : 'bg-green-950/30 text-green-500 border border-green-900/40'
                                }`}>
                                  {item.status === 'in_use' ? 'OUT' : 'IN'}
                                </span>
                              </div>

                              {isExpanded && hasExpandableContent && (
                                <div className="pl-10 pr-4 pb-4 space-y-3 border-t border-neutral-900/50 pt-3 text-xs">
                                  {isKit && item?.childItemIds && item.childItemIds.length > 0 && (
                                    <div className="space-y-1">
                                      {item.childItemIds.map(childId => {
                                        const child = allUserGear.find(g => g.id === childId);
                                        return (
                                          <div key={childId} className="flex items-center gap-2 px-2 py-1 bg-neutral-950 rounded border border-neutral-800 text-neutral-400">
                                            <Package size={10} />
                                            <span className="truncate">{child?.name || 'Sub-item'}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {unassignedItems.length === 0 && (
                          <p className="text-[10px] text-neutral-500 italic text-center py-4 bg-neutral-950 rounded-2xl border border-dashed border-neutral-850">All packed gear is organized into custom compartments.</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
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
