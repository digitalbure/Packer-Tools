import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, collection, query, getDocs, addDoc, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { GearItem, UserProfile, GearIncident } from '../types';
import { toast } from 'sonner';
import { useAuth } from '../providers/AuthProvider';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeCanvas } from 'qrcode.react';
import { 
  ArrowLeft, Camera, QrCode, Tag, Check, Pencil, Save, 
  Trash2, ShieldAlert, BadgeInfo, Scale, DollarSign, Wrench, Calendar,
  Clock, Heart, ShoppingBag, Plus, Eye, Share2, Printer, CheckCircle,
  Phone, Mail, MessageSquare, AlertTriangle, ShieldCheck
} from 'lucide-react';
import PickupDropoffWidget, { PickupDropoffState } from '../components/PickupDropoffWidget';

interface GearBioPageProps {
  user: UserProfile | null;
  adminSettings: any;
}

export default function GearBioPage({ user, adminSettings }: GearBioPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { formatCurrency } = useAuth();
  const [searchParams] = useSearchParams();
  const queryOwnerId = searchParams.get('owner');

  const [item, setItem] = useState<GearItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [incidents, setIncidents] = useState<GearIncident[]>([]);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [submittingIncident, setSubmittingIncident] = useState(false);
  const [newIncident, setNewIncident] = useState<Partial<GearIncident>>({
    type: 'damage',
    description: '',
    severity: 'medium',
    resolved: false
  });

  const [editForm, setEditForm] = useState<Partial<GearItem>>({});
  const [ownerProfile, setOwnerProfile] = useState<any>(null);
  const [revealContact, setRevealContact] = useState(false);

  useEffect(() => {
    if (item) {
      document.title = `${item.brand || ''} ${item.name} | Packer Tools Digital Passport Representative`;
      
      const ogImgUrl = item.photoUrls?.[0] || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=400';
      
      let ogImageMeta = document.querySelector('meta[property="og:image"]');
      if (!ogImageMeta) {
        ogImageMeta = document.createElement('meta');
        ogImageMeta.setAttribute('property', 'og:image');
        document.head.appendChild(ogImageMeta);
      }
      ogImageMeta.setAttribute('content', ogImgUrl);

      let ogTitleMeta = document.querySelector('meta[property="og:title"]');
      if (!ogTitleMeta) {
        ogTitleMeta = document.createElement('meta');
        ogTitleMeta.setAttribute('property', 'og:title');
        document.head.appendChild(ogTitleMeta);
      }
      ogTitleMeta.setAttribute('content', `${item.brand || ''} ${item.name} Passport`);

      let ogDescMeta = document.querySelector('meta[property="og:description"]');
      if (!ogDescMeta) {
        ogDescMeta = document.createElement('meta');
        ogDescMeta.setAttribute('property', 'og:description');
        document.head.appendChild(ogDescMeta);
      }
      ogDescMeta.setAttribute('content', item.description || `Certified product asset reference ID: ${item.assetTag}`);
    }
  }, [item]);

  // Finder / Public report states
  const [finderName, setFinderName] = useState('');
  const [finderContact, setFinderContact] = useState('');
  const [finderMessage, setFinderMessage] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [publicActiveImageIdx, setPublicActiveImageIdx] = useState(0);
  const [ownerActiveImageIdx, setOwnerActiveImageIdx] = useState(0);

  // Online client-side booking states
  const [bookingClientName, setBookingClientName] = useState('');
  const [bookingClientEmail, setBookingClientEmail] = useState('');
  const [bookingClientPhone, setBookingClientPhone] = useState('');
  const [bookingStartDate, setBookingStartDate] = useState('');
  const [bookingEndDate, setBookingEndDate] = useState('');
  const [bookingType, setBookingType] = useState('deposit');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingConditions, setBookingConditions] = useState<string[]>([]);
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [pickupDropoffState, setPickupDropoffState] = useState<PickupDropoffState | null>(null);

  // Fetch Owner Booking Conditions
  useEffect(() => {
    const targetOwnerId = queryOwnerId || user?.uid;
    if (!targetOwnerId) return;
    const qConditions = query(collection(db, 'users', targetOwnerId, 'bookingConditions'));
    getDocs(qConditions).then(snapshot => {
      if (!snapshot.empty) {
        const condList = snapshot.docs.map(doc => doc.data().name as string);
        setBookingConditions(condList);
      }
    }).catch(e => console.error("Error getting public conditions template:", e));
  }, [queryOwnerId, user?.uid]);

  useEffect(() => {
    const targetOwnerId = queryOwnerId || user?.uid;
    if (!id || !targetOwnerId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const itemRef = doc(db, 'users', targetOwnerId, 'gearLibrary', id);
    const unsubscribeItem = onSnapshot(itemRef, (docSnap) => {
      if (docSnap.exists()) {
        const itemData = { id: docSnap.id, ...docSnap.data() } as GearItem;
        setItem(itemData);
        setEditForm(itemData);
      } else {
        toast.error("Gear item not found or has been deleted.");
        if (user) {
          navigate('/library');
        }
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching gear item:", error);
      toast.error("Failed to load gear details.");
      setLoading(false);
    });

    // Fetch Incidents
    const incidentsRef = collection(db, 'users', targetOwnerId, 'gearLibrary', id, 'incidents');
    const unsubscribeIncidents = onSnapshot(incidentsRef, (snapshot) => {
      const fetchedIncidents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as GearIncident[];
      setIncidents(fetchedIncidents.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    }, (error) => {
      console.warn("GearBioPage: Error catching incidents:", error);
    });

    // Fetch Owner PROFILE
    const ownerRef = doc(db, 'users', targetOwnerId);
    const unsubscribeOwner = onSnapshot(ownerRef, (ownerSnap) => {
      if (ownerSnap.exists()) {
        setOwnerProfile(ownerSnap.data());
      }
    }, (error) => {
      console.warn("GearBioPage: Error catching owner profile:", error);
    });

    return () => {
      unsubscribeItem();
      unsubscribeIncidents();
      unsubscribeOwner();
    };
  }, [id, user, queryOwnerId, navigate]);

  const handleBookReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    if (!bookingClientName || !bookingStartDate || !bookingEndDate) {
      toast.error("Please fill in Booker Name, Start Date, and End Date.");
      return;
    }

    try {
      setBookingLoading(true);

      const targetOwnerId = queryOwnerId || item.ownerId || user?.uid;
      const bookingData = {
        gearId: item.id || id,
        gearName: `${item.brand || ''} ${item.model || item.name}`.trim(),
        brand: item.brand || '',
        ownerId: targetOwnerId || '',
        clientName: bookingClientName,
        clientEmail: bookingClientEmail,
        clientPhone: bookingClientPhone,
        startDate: bookingStartDate,
        endDate: bookingEndDate,
        depositAmount: item.rentalDeposit || 0,
        paymentStatus: bookingType === 'free' ? 'Free' : 'Pending Deposit',
        reservationType: bookingType,
        customConditions: selectedConditions,
        createdAt: new Date().toISOString(),
        pickupDropoff: pickupDropoffState ? {
          pickupType: pickupDropoffState.pickupType,
          pickupLocationId: pickupDropoffState.pickupLocationId,
          pickupCustomAddress: pickupDropoffState.pickupCustomAddress,
          pickupTimeSlot: pickupDropoffState.pickupTimeSlot,
          pickupNotes: pickupDropoffState.pickupNotes,
          dropoffType: pickupDropoffState.dropoffType,
          dropoffLocationId: pickupDropoffState.dropoffLocationId,
          dropoffCustomAddress: pickupDropoffState.dropoffCustomAddress,
          dropoffTimeSlot: pickupDropoffState.dropoffTimeSlot,
          dropoffNotes: pickupDropoffState.dropoffNotes,
          distanceKm: pickupDropoffState.distanceKm,
          transitCost: pickupDropoffState.transitCost,
        } : null
      };

      await addDoc(collection(db, 'gearBookings'), bookingData);

      setBookingSuccess(true);
      setPickupDropoffState(null);
      toast.success("Spot reserved! The rental hold has been added to the calendar.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to schedule booking hold.");
    } finally {
      setBookingLoading(false);
    }
  };

  const isOwnerOfItem = !!(user && item && user.uid === item.ownerId);

  const handleUpdate = async () => {
    if (!id || !item) return;
    try {
      const itemRef = doc(db, 'users', item.ownerId, 'gearLibrary', id);
      const updatedAtStr = new Date().toISOString();
      const updatedData = {
        ...editForm,
        updatedAt: updatedAtStr
      };

      // Query other items with identical names in user's gear list
      const snap = await getDocs(collection(db, 'users', item.ownerId, 'gearLibrary'));
      const sameNameDocs = snap.docs.filter(docSnap => {
        const d = docSnap.data();
        return docSnap.id !== id && d.name && d.name.trim().toLowerCase() === item.name.trim().toLowerCase();
      });

      const batch = writeBatch(db);
      batch.update(itemRef, updatedData);

      sameNameDocs.forEach(docSnap => {
        batch.update(docSnap.ref, {
          brand: editForm.brand || '',
          model: editForm.model || '',
          modelNumber: editForm.modelNumber || '',
          serialNumber: editForm.serialNumber || '',
          releaseYear: editForm.releaseYear || '',
          weight: editForm.weight || 0,
          weightUnit: editForm.weightUnit || 'g',
          price: editForm.price || 0,
          photoUrls: editForm.photoUrls || [],
          description: editForm.description || '',
          rentalPrice: editForm.rentalPrice || 0,
          rentalPeriod: editForm.rentalPeriod || 'day',
          currency: editForm.currency || '$',
          updatedAt: updatedAtStr
        });
      });

      await batch.commit();

      setIsEditing(false);
      toast.success("Gear specifications and matching duplicate items updated successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to save changes.");
    }
  };

  const handleAddIncident = async () => {
    if (!id || !item || !newIncident.description) {
      toast.error("Please add a description");
      return;
    }
    setSubmittingIncident(true);
    try {
      const incidentsRef = collection(db, 'users', item.ownerId, 'gearLibrary', id, 'incidents');
      await addDoc(incidentsRef, {
        ...newIncident,
        gearId: id,
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        resolved: false
      });

      // Update condition to poor if severe damage
      if (newIncident.severity === 'high' || newIncident.severity === 'critical') {
        const itemRef = doc(db, 'users', item.ownerId, 'gearLibrary', id);
        await updateDoc(itemRef, { condition: 'poor', status: 'maintenance' });
      }

      toast.success("Maintenance incident logged successfully");
      setShowIncidentModal(false);
      setNewIncident({ type: 'damage', description: '', severity: 'medium', resolved: false });
    } catch (e) {
      console.error(e);
      toast.error("Failed to log incident");
    } finally {
      setSubmittingIncident(false);
    }
  };

  const handleResolveIncident = async (incidentId: string) => {
    if (!id || !item) return;
    try {
      const ref = doc(db, 'users', item.ownerId, 'gearLibrary', id, 'incidents', incidentId);
      await updateDoc(ref, { resolved: true });
      toast.success("Incident resolved successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to resolve incident");
    }
  };

  const handleSubmitFinderReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    if (!finderName.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    if (!finderContact.trim()) {
      toast.error("Please enter your contact information.");
      return;
    }
    setSubmittingReport(true);
    try {
      const incidentsRef = collection(db, 'users', item.ownerId, 'gearLibrary', item.id, 'incidents');
      await addDoc(incidentsRef, {
        type: 'recovery_report',
        severity: 'critical',
        description: `🚨 LOST & FOUND REPORT: Found by ${finderName.trim()}. Contact details: ${finderContact.trim()}. Message: "${finderMessage.trim() || 'No message provided'}"`,
        resolved: false,
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
      });
      setReportSubmitted(true);
      toast.success("Recovery notice submitted successfully! The owner will be alerted.");
    } catch (error) {
      console.error("Error submitting finder report:", error);
      toast.error("Failed to submit finder report.");
    } finally {
      setSubmittingReport(false);
    }
  };

  const handlePrintLabel = () => {
    window.print();
  };

  const qrValue = item ? `${window.location.origin}/gear/${item.id}?owner=${item.ownerId}` : '';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="mt-4 text-neutral-400 font-mono text-xs">Accessing digital passport...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold">Gear Item Not Found</h2>
        <Link to="/library" className="mt-4 inline-flex items-center gap-2 text-primary font-bold">
          <ArrowLeft size={16} /> Back to Library
        </Link>
      </div>
    );
  }

  const renderConditionRating = (condition?: 'new' | 'good' | 'fair' | 'poor') => {
    const ratings = {
      new: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Pristine (New)' },
      good: { color: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Excellent (Good)' },
      fair: { color: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Operational (Fair)' },
      poor: { color: 'bg-red-50 text-red-700 border-red-200', label: 'Damaged / Poor' }
    };
    const current = condition ? ratings[condition] : ratings.good;
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${current.color}`}>
        {current.label}
      </span>
    );
  };

  if (item && item.visibility === 'private' && !isOwnerOfItem) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-6 sm:p-12">
        <div className="max-w-md w-full bg-white border border-neutral-200/60 p-8 sm:p-12 rounded-[2rem] shadow-sm text-center space-y-6">
          <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert size={24} />
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Security Gate</p>
            <h2 className="text-xl font-black uppercase tracking-tight">🔒 Internal Tool</h2>
          </div>
          <p className="text-neutral-500 text-sm leading-relaxed">
            This equipment is registered as a private internal workspace asset. <span className="font-extrabold text-neutral-900">Please log in to your account to see details.</span>
          </p>
          <div className="pt-4 border-t border-neutral-100 flex flex-col gap-3">
            <Link to="/" className="w-full py-3 bg-black hover:bg-neutral-800 text-white text-xs font-black uppercase tracking-widest rounded-xl transition">
              Log In to Portal
            </Link>
            <Link to="/" className="text-xs font-bold text-neutral-400 hover:text-neutral-600 transition">
              Return Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isOwnerOfItem) {
    const recoveryEnabled = item.recoveryEnabled !== false;
    const isLost = item.status === 'missing';

    return (
      <div className="min-h-screen bg-neutral-50/50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto space-y-8">
          
          {/* Header Return/Spec Banner */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className={`w-16 h-16 ${isLost ? 'bg-red-100 text-red-600 shadow-red-100' : 'bg-emerald-100/80 text-emerald-600 shadow-emerald-100'} rounded-3xl flex items-center justify-center shadow-xl`}>
              {isLost ? <ShieldAlert size={32} strokeWidth={2} /> : <ShieldCheck size={32} strokeWidth={2} />}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-neutral-900 uppercase">
                {isLost ? "SAFE RECOVERY PORTAL" : "DIGITAL ASSET PASSPORT"}
              </h1>
              <p className="text-xs sm:text-sm text-neutral-500 font-medium max-w-md mx-auto mt-1">
                {isLost 
                  ? "You scanned the active digital asset tag of this item. Thank you for helping return it!" 
                  : "Verified equipment specifications and asset registration certified under Packer Tools."}
              </p>
            </div>
          </div>

          {/* Lost & Found Item Profile Card */}
          <div className="bg-white border border-neutral-100 rounded-[2.5rem] shadow-xl shadow-neutral-100 overflow-hidden flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-neutral-100">
            {/* Item Photo & Meta */}
            <div className="p-8 flex-1 flex flex-col justify-between space-y-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                  {item.brand || 'No Brand Specified'}
                </p>
                <h2 className="text-2xl font-black italic uppercase tracking-tighter mt-1 text-neutral-900 leading-tight">
                  {item.name}
                </h2>
                <div className="mt-3 flex gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-100 rounded-full text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                    <Tag size={10} />
                    {item.category || 'Gear Asset'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-100 rounded-full text-[10px] font-mono text-neutral-500">
                    TAG: {item.assetTag}
                  </span>
                </div>
              </div>

              {item.photoUrls && item.photoUrls.length > 0 ? (
                <div className="relative aspect-square bg-neutral-50 rounded-[2rem] overflow-hidden border border-neutral-100 group">
                  <img 
                    src={item.photoUrls[publicActiveImageIdx] || 'https://picsum.photos/seed/gear/400/400'} 
                    alt={`${item.name} image ${publicActiveImageIdx + 1}`}
                    className="object-cover w-full h-full transition-all duration-350"
                    referrerPolicy="no-referrer"
                  />

                  {item.photoUrls.length > 1 && (
                    <>
                      <button 
                        type="button"
                        onClick={() => setPublicActiveImageIdx((prev) => (prev === 0 ? item.photoUrls!.length - 1 : prev - 1))}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-black flex items-center justify-center shadow-lg transition-all duration-200 cursor-pointer text-xs font-black z-10 hover:scale-110 border border-neutral-150"
                      >
                        ←
                      </button>
                      <button 
                        type="button"
                        onClick={() => setPublicActiveImageIdx((prev) => (prev === item.photoUrls!.length - 1 ? 0 : prev + 1))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-black flex items-center justify-center shadow-lg transition-all duration-200 cursor-pointer text-xs font-black z-10 hover:scale-110 border border-neutral-150"
                      >
                        →
                      </button>

                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-sm">
                        {item.photoUrls.map((_, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setPublicActiveImageIdx(idx)}
                            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                              publicActiveImageIdx === idx ? 'bg-white scale-125' : 'bg-white/40'
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="aspect-square bg-neutral-50 rounded-[2rem] overflow-hidden border border-neutral-100 flex items-center justify-center text-neutral-400">
                  <Camera size={48} className="stroke-1" />
                </div>
              )}
            </div>

            {/* Custom Recovery Actions */}
            <div className="p-8 flex-1 bg-neutral-950 text-white flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400">Recovery Instructions</h3>
                
                {recoveryEnabled ? (
                  <p className="text-sm text-neutral-300 leading-relaxed font-medium italic">
                    "{item.recoveryInstructions || 'Owner has not provided specific instructions. Please use the contact details below to return this device safely.'}"
                  </p>
                ) : (
                  <p className="text-sm text-neutral-400 leading-relaxed italic">
                    "Please contact the owner of this device using the information below to settle safe return."
                  </p>
                )}
              </div>

              {recoveryEnabled && (
                <div className="space-y-4 pt-4 border-t border-neutral-800">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Direct Contact Methods</h4>
                  
                  {!revealContact ? (
                    <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl text-center space-y-3">
                      <p className="text-[10px] text-neutral-300 font-extrabold uppercase tracking-widest leading-normal">
                        🔒 Contact details hidden for privacy
                      </p>
                      <p className="text-[10px] text-neutral-500 leading-relaxed">
                        To protect the owner from automated spam bots and web scraping, direct dial and email links are masked until requested.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setRevealContact(true);
                          toast.success("Identity links unlocked successfully.");
                        }}
                        className="w-full py-2.5 bg-white text-black hover:bg-neutral-100 transition font-black text-[9px] uppercase tracking-widest rounded-lg cursor-pointer"
                      >
                        Reveal Contact Details
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Contact Phone */}
                      {item.recoveryContactPhone && (
                        <div className="flex flex-col sm:flex-row gap-2">
                          <a 
                            href={`tel:${item.recoveryContactPhone}`}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-white text-black hover:bg-neutral-100 transition font-bold text-xs rounded-xl text-center"
                          >
                            <Phone size={14} />
                            <span>Call Owner</span>
                          </a>
                          <a 
                            href={`sms:${item.recoveryContactPhone}`}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 transition font-bold text-xs rounded-xl text-white text-center"
                          >
                            <MessageSquare size={14} />
                            <span>Send Text SMS</span>
                          </a>
                        </div>
                      )}

                      {/* Email */}
                      {(item.recoveryContactEmail || ownerProfile?.email) && (
                        <a 
                          href={`mailto:${item.recoveryContactEmail || ownerProfile?.email}`}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 transition font-bold text-xs rounded-xl text-white text-center animate-fade-in"
                        >
                          <Mail size={14} />
                          <span>Email {item.recoveryContactName || ownerProfile?.displayName || 'Owner'}</span>
                        </a>
                      )}
                      
                      <button
                        type="button"
                        onClick={() => setRevealContact(false)}
                        className="text-[9px] text-neutral-500 hover:text-neutral-400 block text-right mx-auto font-black uppercase tracking-widest pt-1"
                      >
                        Lock & Hide Links again
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Minimalist Profile Details */}
              <div className="pt-4 border-t border-neutral-800 flex items-center gap-3">
                <img 
                  src={ownerProfile?.photoURL || 'https://picsum.photos/seed/avatar/100/100'} 
                  className="w-10 h-10 rounded-xl object-cover shrink-0 grayscale border border-neutral-800"
                />
                <div>
                  <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Registered Asset Owner</p>
                  <p className="font-bold text-sm text-neutral-100">{item.recoveryContactName || ownerProfile?.displayName || 'Private Equipment Manager'}</p>
                </div>
              </div>

            </div>
          </div>

          {/* Device Info & Specifications Card */}
          <div className="bg-white border border-neutral-100 rounded-[2.5rem] p-8 shadow-xl shadow-neutral-100 space-y-6">
            <div>
              <h3 className="text-base font-black tracking-tight uppercase flex items-center gap-2 text-neutral-800">
                <BadgeInfo size={18} className="text-[#ff4f3a]" />
                <span>Device Info & Specifications</span>
              </h3>
              <p className="text-[11px] text-neutral-400 mt-1">
                Official specifications, condition logs, and tags verified from the active digital registry.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 bg-neutral-50 p-6 rounded-[2rem] text-left">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Condition</p>
                <div className="mt-1">{renderConditionRating(item.condition)}</div>
              </div>
              {item.brand && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Brand</p>
                  <p className="font-semibold text-xs mt-1 text-neutral-800">{item.brand}</p>
                </div>
              )}
              {item.model && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Model</p>
                  <p className="font-semibold text-xs mt-1 text-neutral-800">{item.model}</p>
                </div>
              )}
              {item.modelNumber && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Model Number</p>
                  <p className="font-semibold text-xs mt-1 text-neutral-800">{item.modelNumber}</p>
                </div>
              )}
              {item.serialNumber && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Serial Number</p>
                  <p className="font-mono text-xs mt-1 text-neutral-800 select-all">{item.serialNumber}</p>
                </div>
              )}
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Primary Category</p>
                <span className="inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-900 text-white font-semibold uppercase tracking-wider">
                  {item.primaryCategory || item.category || 'Other'}
                </span>
              </div>
              {item.weight && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Weight</p>
                  <p className="font-semibold text-xs mt-1 text-neutral-850">
                    {item.weight} {item.weightUnit || 'g'}
                  </p>
                </div>
              )}
              {item.releaseYear && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Release Year</p>
                  <p className="font-semibold text-xs mt-1 text-neutral-800">{item.releaseYear}</p>
                </div>
              )}
              {item.dimensions && (item.dimensions.length || item.dimensions.width || item.dimensions.height) && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Dimensions</p>
                  <p className="font-semibold text-xs mt-1 text-neutral-800">
                    {item.dimensions.length}x{item.dimensions.width}x{item.dimensions.height} {item.dimensions.unit || 'cm'}
                  </p>
                </div>
              )}
            </div>

            {item.description && (
              <div className="bg-neutral-50 p-5 rounded-[1.5rem] border border-neutral-100 text-left">
                <p className="text-[10px] font-black uppercase tracking-widest text-neutral-450 mb-1">Equipment Description</p>
                <p className="text-xs text-neutral-600 leading-relaxed font-semibold italic">"{item.description}"</p>
              </div>
            )}
          </div>

          {/* Secure Ping Form Card */}
          <div className="bg-white border border-neutral-100 rounded-[2.5rem] p-8 shadow-xl shadow-neutral-100 space-y-6">
            <div>
              <h3 className="text-base font-black tracking-tight uppercase flex items-center gap-2 text-neutral-800">
                <MessageSquare size={18} className="text-emerald-500" />
                <span>Send Return Notice / Ping Location</span>
              </h3>
              <p className="text-[11px] text-neutral-400 mt-1">
                Provide your contact details so the owner can contact you and coordinate a drop-off or pickup. This ping is directly logged on their dashboard.
              </p>
            </div>

            {reportSubmitted ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-emerald-50 border border-emerald-100 p-6 rounded-[2rem] text-center space-y-3"
              >
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                  <Check size={24} strokeWidth={3} />
                </div>
                <h4 className="font-bold text-emerald-900 text-sm">Notice Dispatched!</h4>
                <p className="text-xs text-emerald-600 max-w-md mx-auto">
                  Thank you so much! Your location/message has been securely delivered to the owner's log history. Your helpfulness is highly appreciated.
                </p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmitFinderReport} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Your Name</label>
                    <input
                      type="text"
                      required
                      value={finderName}
                      onChange={(e) => setFinderName(e.target.value)}
                      placeholder="e.g. John Finder"
                      className="w-full bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-primary transition"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Your Contact Details (Phone/Email)</label>
                    <input
                      type="text"
                      required
                      value={finderContact}
                      onChange={(e) => setFinderContact(e.target.value)}
                      placeholder="e.g. +1 (555) 0123 / citizen@me.com"
                      className="w-full bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-primary transition"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Where is the item? / Secure Message</label>
                  <textarea
                    rows={3}
                    value={finderMessage}
                    onChange={(e) => setFinderMessage(e.target.value)}
                    placeholder="Provide details about where you found it, e.g., 'Found on table 4 at Starbucks, left with manager Sarah' or 'I have it safe at my office in Soho, call me!'"
                    className="w-full bg-neutral-50 border border-neutral-100 rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-primary transition"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={submittingReport}
                    className="w-full sm:w-auto px-6 py-3 bg-black hover:bg-neutral-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs uppercase tracking-widest transition"
                  >
                    {submittingReport ? 'Sending Notice...' : 'Submit Secure Return Notice'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Minimal Platform attribution */}
          <p className="text-center text-[9px] font-black uppercase tracking-widest text-neutral-400">
            SECURED BY PACKER TOOLS CERTIFIED ASSET SYSTEM
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16">
      {/* Header breadcrumb */}
      <div className="flex items-center justify-between">
        <Link 
          to="/library" 
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-neutral-500 hover:text-black transition"
        >
          <ArrowLeft size={14} /> back to inventory listing
        </Link>
        <button
          onClick={() => {
            navigator.clipboard.writeText(qrValue);
            toast.success("Passport bio link copied to clipboard");
          }}
          className="p-2 hover:bg-neutral-100 rounded-xl transition text-neutral-500 hover:text-black"
          title="Share Gear Bio Link"
        >
          <Share2 size={18} />
        </button>
      </div>

      {/* Main Card Bio Sheet */}
      <div className="bg-white border border-neutral-100 rounded-[2.5rem] shadow-xl overflow-hidden grid md:grid-cols-12 gap-0">
        
        {/* Left Side: Photo & Specs Card */}
        <div className="md:col-span-5 bg-neutral-950 p-6 md:p-8 flex flex-col justify-between text-white relative">
          <div className="absolute top-6 right-6">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
              item.status === 'available' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
              item.status === 'in_use' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
              item.status === 'maintenance' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
              'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              {item.status || 'available'}
            </span>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                {item.brand || 'No Specified Brand'}
              </p>
              <h1 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter mt-1 leading-none text-white">
                {item.name}
              </h1>
              <p className="text-xs font-mono text-neutral-400 mt-2">ID: {item.assetTag}</p>
            </div>

            {/* Product Image Carousel */}
            {item.photoUrls && item.photoUrls.length > 0 ? (
              <div className="relative aspect-square bg-neutral-900 rounded-[2rem] overflow-hidden flex items-center justify-center border border-neutral-800 group">
                <img 
                  src={item.photoUrls[ownerActiveImageIdx] || 'https://picsum.photos/seed/gear/400/400'} 
                  alt={`${item.name} image ${ownerActiveImageIdx + 1}`}
                  className="object-cover w-full h-full hover:scale-105 transition duration-500"
                  referrerPolicy="no-referrer"
                />

                {item.photoUrls.length > 1 && (
                  <>
                    <button 
                      type="button"
                      onClick={() => setOwnerActiveImageIdx((prev) => (prev === 0 ? item.photoUrls!.length - 1 : prev - 1))}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center shadow-lg transition-all duration-200 cursor-pointer text-xs font-black z-10 hover:scale-110 border border-neutral-800"
                    >
                      ←
                    </button>
                    <button 
                      type="button"
                      onClick={() => setOwnerActiveImageIdx((prev) => (prev === item.photoUrls!.length - 1 ? 0 : prev + 1))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center shadow-lg transition-all duration-200 cursor-pointer text-xs font-black z-10 hover:scale-110 border border-neutral-800"
                    >
                      →
                    </button>

                    {/* Pagination Dots */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 bg-black/75 px-3 py-1.5 rounded-full">
                      {item.photoUrls.map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setOwnerActiveImageIdx(idx)}
                          className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                            ownerActiveImageIdx === idx ? 'bg-white scale-125' : 'bg-white/40'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="aspect-square bg-neutral-900 rounded-[2rem] overflow-hidden flex items-center justify-center border border-neutral-800 text-neutral-500">
                <Camera size={48} className="stroke-1" />
              </div>
            )}
          </div>

          {/* Quick Specifications list */}
          <div className="mt-8 pt-6 border-t border-neutral-800 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Weight</p>
              <p className="text-sm font-bold mt-0.5 text-white">
                {item.weight ? `${item.weight} ${item.weightUnit || 'g'}` : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Value</p>
              <p className="text-sm font-bold mt-0.5 text-emerald-400">
                {item.price ? formatCurrency(item.price, item.currency || 'USD') : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Interactive Details, Custom QR & Ancillaries */}
        <div className="md:col-span-7 p-6 md:p-8 space-y-8">
          <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-neutral-400">Gear Biography Passport</h2>
              <p className="text-[10px] text-neutral-400 italic">Full maintenance, rental capability, and specification logging</p>
            </div>
            
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 text-neutral-700 text-xs font-bold rounded-xl hover:bg-black hover:text-white transition"
            >
              {isEditing ? <Check size={14} /> : <Pencil size={14} />}
              <span>{isEditing ? 'Cancel Edit' : 'Edit Specs'}</span>
            </button>
          </div>

          {isEditing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Brand</label>
                  <input
                    type="text"
                    value={editForm.brand || ''}
                    onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary transition"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Model Name</label>
                  <input
                    type="text"
                    value={editForm.model || ''}
                    onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Model Number</label>
                  <input
                    type="text"
                    value={editForm.modelNumber || ''}
                    onChange={(e) => setEditForm({ ...editForm, modelNumber: e.target.value })}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary transition"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Serial Number</label>
                  <input
                    type="text"
                    value={editForm.serialNumber || ''}
                    onChange={(e) => setEditForm({ ...editForm, serialNumber: e.target.value })}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Price Value</label>
                  <input
                    type="number"
                    value={editForm.price || ''}
                    onChange={(e) => setEditForm({ ...editForm, price: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary transition"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Currency</label>
                  <select
                    value={editForm.currency || '$'}
                    onChange={(e) => setEditForm({ ...editForm, currency: e.target.value })}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary transition"
                  >
                    <option value="$">USD ($)</option>
                    <option value="€">EUR (€)</option>
                    <option value="£">GBP (£)</option>
                    <option value="A$">AUD (A$)</option>
                    <option value="C$">CAD (C$)</option>
                    <option value="FJD">FJD (FJD)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Status</label>
                  <select
                    value={editForm.status || 'available'}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary transition"
                  >
                    <option value="available">Available</option>
                    <option value="in_use">In Use</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="retired">Retired</option>
                    <option value="missing">Missing</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Condition</label>
                  <select
                    value={editForm.condition || 'good'}
                    onChange={(e) => setEditForm({ ...editForm, condition: e.target.value as any })}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary transition"
                  >
                    <option value="new">New / Pristine</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor / Damaged</option>
                  </select>
                </div>
              </div>

               <div className="space-y-1 pt-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Visibility & Accessibility</label>
                <select
                  value={editForm.visibility || 'public'}
                  onChange={(e) => setEditForm({ ...editForm, visibility: e.target.value as 'public' | 'private' })}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary transition"
                >
                  <option value="public">🌐 Public (Accessible via QR scan & sharing)</option>
                  <option value="private">🔒 Private (Owner only; locks out external access)</option>
                </select>
                <p className="text-[9px] text-neutral-400 mt-0.5">
                  Private kits are prepped for specific internal planning/projects and block scan reports from public finders.
                </p>
              </div>

              <div className="space-y-1 pt-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-[#ff4f3a]">Equipment Images / Carousel URLs (one URL per line)</label>
                <textarea
                  rows={3}
                  value={editForm.photoUrls?.join('\n') || ''}
                  onChange={(e) => {
                    const urls = e.target.value.split('\n').map(u => u.trim()).filter(u => u !== '');
                    setEditForm({ ...editForm, photoUrls: urls });
                  }}
                  placeholder="https://images.unsplash.com/photo-1542291026-7eec264c27ff&#10;https://images.unsplash.com/photo-1511707171634-5f897ff02aa9"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary font-mono transition"
                />
                <p className="text-[9px] text-neutral-400 mt-0.5">
                  Pasting multiple image links will automatically render a beautiful, touch-friendly image carousel for public scan views.
                </p>
              </div>

              {/* Rental Settings */}
              <div className="bg-neutral-50 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-neutral-800">Rental Marketplace Availability</p>
                    <p className="text-[10px] text-neutral-400">Onboard list item with rentability similar to other modules</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={editForm.secondaryCategories?.includes('Rentable') || false}
                    onChange={(e) => {
                      const list = editForm.secondaryCategories || [];
                      const updated = e.target.checked 
                        ? [...list, 'Rentable']
                        : list.filter(c => c !== 'Rentable');
                      setEditForm({ 
                        ...editForm, 
                        secondaryCategories: updated,
                        isAvailableForRent: e.target.checked
                      });
                    }}
                    className="h-5 w-5 text-primary focus:ring-primary border-neutral-300 rounded"
                  />
                </div>

                {(editForm.secondaryCategories?.includes('Rentable')) && (
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Rental Rate / Hour</label>
                      <input
                        type="number"
                        value={editForm.rentalHourlyPrice || 0}
                        onChange={(e) => setEditForm({ ...editForm, rentalHourlyPrice: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary transition"
                        placeholder="e.g. 10"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Rental Rate / Day</label>
                      <input
                        type="number"
                        value={editForm.rentalPrice || 0}
                        onChange={(e) => setEditForm({ ...editForm, rentalPrice: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary transition"
                        placeholder="e.g. 45"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Special Setup Deposit</label>
                      <input
                        type="number"
                        value={editForm.rentalDeposit || 0}
                        onChange={(e) => setEditForm({ ...editForm, rentalDeposit: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary transition"
                        placeholder="e.g. 150"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Booking Terms</label>
                      <select
                        value={editForm.rentalPeriod || 'day'}
                        onChange={(e) => setEditForm({ ...editForm, rentalPeriod: e.target.value as any })}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary transition"
                      >
                        <option value="day">Instant Booking</option>
                        <option value="week">Manual Verification Required</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Lost & Found Recovery Preferences */}
              <div className="bg-emerald-50/50 border border-emerald-100 p-6 rounded-2xl space-y-4 text-left">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-emerald-800 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-500" />
                    <span>Lost & Found Recovery Preferences</span>
                  </h4>
                  <p className="text-[10px] text-emerald-600 mt-1">Configure what contact info is shown publicly to a scanner if this device gets lost.</p>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-800">Enable Finder Recovery Portal</span>
                  <input
                    type="checkbox"
                    checked={editForm.recoveryEnabled !== false}
                    onChange={(e) => setEditForm({ ...editForm, recoveryEnabled: e.target.checked })}
                    className="h-5 w-5 text-emerald-600 focus:ring-emerald-500 border-neutral-300 rounded"
                  />
                </div>

                {editForm.recoveryEnabled !== false && (
                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Contact Name</label>
                        <input
                          type="text"
                          value={editForm.recoveryContactName || ''}
                          onChange={(e) => setEditForm({...editForm, recoveryContactName: e.target.value})}
                          placeholder={user?.displayName || "e.g. John Doe"}
                          className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Contact Phone</label>
                        <input
                          type="text"
                          value={editForm.recoveryContactPhone || ''}
                          onChange={(e) => setEditForm({...editForm, recoveryContactPhone: e.target.value})}
                          placeholder="e.g. +1 555-0199"
                          className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Contact Email</label>
                      <input
                        type="email"
                        value={editForm.recoveryContactEmail || ''}
                        onChange={(e) => setEditForm({...editForm, recoveryContactEmail: e.target.value})}
                        placeholder={user?.email || "e.g. finder@example.com"}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Custom Finder Instructions</label>
                      <textarea
                        rows={2}
                        value={editForm.recoveryInstructions || ''}
                        onChange={(e) => setEditForm({...editForm, recoveryInstructions: e.target.value})}
                        placeholder="e.g. 'This camera is my livelihood. If found, please leave at any major hotel desk or call me. Reward offered!'"
                        className="w-full bg-white border border-neutral-100 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-neutral-100 font-bold rounded-xl text-neutral-600 hover:bg-neutral-200 transition text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdate}
                  className="px-4 py-2 bg-black text-white font-bold rounded-xl hover:bg-neutral-800 transition text-xs"
                >
                  Save Specs
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Product Info Table */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 bg-neutral-50 p-6 rounded-[2rem]">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Condition</p>
                  <div className="mt-1">{renderConditionRating(item.condition)}</div>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Model Number</p>
                  <p className="font-semibold text-xs mt-1 text-neutral-800">{item.modelNumber || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Serial Number</p>
                  <p className="font-mono text-xs mt-1 text-neutral-800 select-all">{item.serialNumber || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Primary Category</p>
                  <span className="inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-900 text-white">
                    {item.primaryCategory || item.category || 'Other'}
                  </span>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Release Year</p>
                  <p className="font-semibold text-xs mt-1 text-neutral-800">{item.releaseYear || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Purchase Date</p>
                  <p className="font-semibold text-xs mt-1 text-neutral-800">{item.purchaseDate || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Access Visibility</p>
                  <span className={`inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    item.visibility === 'private' ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}>
                    {item.visibility === 'private' ? '🔒 Private Kit' : '🌐 Public Access'}
                  </span>
                </div>
              </div>

              {/* Rental Banner - if set available for rent */}
              {item.secondaryCategories?.includes('Rentable') && (
                <div className="border border-blue-100 bg-blue-50/50 p-4 rounded-[1.5rem] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2.5 rounded-xl text-blue-600">
                      <ShoppingBag size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-blue-900">Listed on Rental Marketplace</p>
                      <p className="text-[10px] text-blue-600 mt-0.5">
                        Available at <span className="font-bold">{formatCurrency(item.rentalPrice || 45, item.currency || 'USD')} / day</span> • 
                        {item.rentalPeriod === 'week' ? ' Verification Required' : ' Instant Book'}
                      </p>
                    </div>
                  </div>
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              )}

              {/* ONLINE RESERVATION & CALENDAR HOLD MODULE */}
              {item.secondaryCategories?.includes('Rentable') && (
                <div className="bg-stone-50 border border-neutral-200/60 p-6 sm:p-8 rounded-[2.5rem] space-y-6">
                  <div>
                    <h3 className="text-lg font-black text-neutral-900 flex items-center gap-2 uppercase tracking-tight">
                      <Calendar size={18} className="text-[#ff4f3a]" />
                      <span>Reserve this Kit Online</span>
                    </h3>
                    <p className="text-[11px] text-neutral-400 mt-0.5">Fulfill owner requirements and schedule reservation dates.</p>
                  </div>

                  {bookingSuccess ? (
                    <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl text-center space-y-3">
                      <CheckCircle className="text-emerald-500 mx-auto" size={36} />
                      <div>
                        <h4 className="font-black text-emerald-900 text-sm uppercase">Booking Hold Registered!</h4>
                        <p className="text-xs text-emerald-700 mt-1">Your reservation hold has been placed on the master schedule. Owner will coordinate pick-up and deposit escrow instructions.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setBookingSuccess(false);
                          setBookingClientName('');
                          setBookingClientEmail('');
                          setBookingClientPhone('');
                          setBookingStartDate('');
                          setBookingEndDate('');
                          setSelectedConditions([]);
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition"
                      >
                        Reserve Another Slot
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleBookReservation} className="space-y-4 text-left">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Your Full Name (Booker)</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Liam Naidu / Fiji Production"
                          value={bookingClientName}
                          onChange={(e) => setBookingClientName(e.target.value)}
                          className="w-full p-2.5 bg-white border border-neutral-205 rounded-xl text-xs font-semibold outline-none focus:ring-1 focus:ring-primary transition"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Email Address</label>
                          <input
                            type="email"
                            required
                            placeholder="liam@gmail.com"
                            value={bookingClientEmail}
                            onChange={(e) => setBookingClientEmail(e.target.value)}
                            className="w-full p-2.5 bg-white border border-neutral-205 rounded-xl text-xs font-semibold outline-none focus:ring-1 focus:ring-primary transition"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Phone Number</label>
                          <input
                            type="text"
                            placeholder="+679 12345"
                            value={bookingClientPhone}
                            onChange={(e) => setBookingClientPhone(e.target.value)}
                            className="w-full p-2.5 bg-white border border-neutral-205 rounded-xl text-xs font-semibold outline-none focus:ring-1 focus:ring-primary transition"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Rental Start Date</label>
                          <input
                            type="date"
                            required
                            value={bookingStartDate}
                            onChange={(e) => setBookingStartDate(e.target.value)}
                            className="w-full p-2.5 bg-white border border-neutral-205 rounded-xl text-xs font-bold outline-none text-neutral-800 font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Rental End Date</label>
                          <input
                            type="date"
                            required
                            value={bookingEndDate}
                            onChange={(e) => setBookingEndDate(e.target.value)}
                            className="w-full p-2.5 bg-white border border-neutral-205 rounded-xl text-xs font-bold outline-none text-neutral-800 font-mono"
                          />
                        </div>
                      </div>

                      {/* Customizable Pickup and Dropoff Widget */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Dispatch Routing Logistics</label>
                        <PickupDropoffWidget onChange={setPickupDropoffState} />
                      </div>

                      {/* Customized Checklist */}
                      {bookingConditions.length > 0 && (
                        <div className="space-y-2">
                          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Confirm Booking Requirements Set by Owner</label>
                          <div className="space-y-1.5 bg-neutral-100/50 p-3 rounded-xl border border-neutral-150">
                            {bookingConditions.map((cond) => {
                              const isSelected = selectedConditions.includes(cond);
                              return (
                                <label 
                                  key={cond} 
                                  className="flex items-start gap-2.5 p-1 text-[10px] uppercase font-bold text-neutral-600 cursor-pointer hover:text-neutral-900 transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {
                                      if (isSelected) {
                                        setSelectedConditions(prev => prev.filter(c => c !== cond));
                                      } else {
                                        setSelectedConditions(prev => [...prev, cond]);
                                      }
                                    }}
                                    className="rounded cursor-pointer mt-0.5 h-3.5 w-3.5 text-primary focus:ring-0"
                                  />
                                  <span>I agree to: {cond}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Interactive rate overview */}
                      <div className="p-4 bg-white border border-neutral-200 rounded-xl space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-neutral-500 font-bold uppercase text-[9px] tracking-wider">Equipment Daily Rate:</span>
                          <span className="font-extrabold text-neutral-900 font-mono">{formatCurrency(item.rentalPrice || 45, item.currency || 'USD')}/day</span>
                        </div>
                        {item.rentalHourlyPrice && item.rentalHourlyPrice > 0 ? (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-neutral-400 font-bold uppercase text-[9px] tracking-wider">Equipment Hourly Rate:</span>
                            <span className="font-semibold text-neutral-800 font-mono">{formatCurrency(item.rentalHourlyPrice, item.currency || 'USD')}/hour</span>
                          </div>
                        ) : null}
                        <div className="flex justify-between items-center text-xs pt-1.5 border-t border-dotted border-neutral-200">
                          <span className="text-neutral-500 font-bold uppercase text-[9px] tracking-wider">Security Deposit Escrow:</span>
                          <span className="font-extrabold text-neutral-800 font-mono">{formatCurrency(item.rentalDeposit || 0, item.currency || 'USD')}</span>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={bookingLoading}
                        className="w-full py-3.5 bg-neutral-900 hover:bg-black disabled:bg-neutral-400 text-white font-black rounded-xl text-xs uppercase tracking-widest shadow-md transition cursor-pointer"
                      >
                        {bookingLoading ? 'Securing Hold Calendar...' : 'Confirm Advanced Reservation'}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Description & AI labels */}
              {item.description && (
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Equipment Bio & Description</p>
                  <p className="text-xs text-neutral-600 leading-relaxed bg-neutral-50 p-4 rounded-xl">
                    {item.description}
                  </p>
                </div>
              )}

              {/* Organization and AI Advice */}
              {item.organizationTip && (
                <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-[1.5rem] flex gap-3">
                  <Heart className="text-amber-500 shrink-0 mt-0.5" size={16} />
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-900">Onboarding AI Advice</h4>
                    <p className="text-xs text-amber-700 mt-1 leading-normal italic">
                      "{item.organizationTip}"
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* QR Code Identification Passport */}
          <div className="border border-neutral-100 p-5 rounded-[2rem] bg-stone-50/30 flex flex-col sm:flex-row items-center justify-between gap-6 print:hidden">
            <div className="space-y-2 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <QrCode size={18} className="text-primary animate-pulse" />
                <h3 className="text-xs font-black uppercase tracking-widest text-neutral-800">QR Asset Passport</h3>
              </div>
              <p className="text-[10px] text-neutral-400 max-w-sm">
                Each onboarded item receives a custom digital passport QR tag. Scan code with the camera controller to update tracking logs or verify inventory instantly.
              </p>
              <button
                onClick={handlePrintLabel}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-800 transition"
              >
                <Printer size={12} />
                <span>Print Tag Label</span>
              </button>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-neutral-100 shadow-md">
              <QRCodeCanvas 
                value={qrValue} 
                size={80} 
                level="M"
                includeMargin={false}
              />
              <p className="text-[8px] font-mono text-center font-bold text-neutral-400 mt-2 tracking-widest">
                {item.assetTag}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Maintenance Incidents & Reports Log */}
      <div className="bg-white border border-neutral-100 rounded-[2.5rem] p-6 md:p-8 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-neutral-800">Lifecycle & Maintenance Incidents Log</h2>
            <p className="text-[10px] text-neutral-400">History of damage logs, wear logs, and repairs made on this inventory item</p>
          </div>
          <button
            onClick={() => setShowIncidentModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-xl transition shadow-lg"
          >
            <Plus size={14} />
            <span>Log Wear / Incident</span>
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {incidents.length === 0 ? (
            <p className="text-center py-6 text-xs text-neutral-400 italic">No incidents or wear reports are logged for this gear item. It is currently in healthy state.</p>
          ) : (
            incidents.map((inc) => (
              <div key={inc.id} className="border border-neutral-100 p-4 rounded-2xl flex items-center justify-between bg-neutral-50/50 hover:bg-neutral-50 transition">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      inc.severity === 'critical' || inc.severity === 'high' ? 'bg-red-100 text-red-700' :
                      inc.severity === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {inc.severity} Severity
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      inc.resolved ? 'bg-emerald-100 text-emerald-800' : 'bg-red-50 text-red-800 animate-pulse'
                    }`}>
                      {inc.resolved ? 'Resolved' : 'Active wear'}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-700 mt-1">{inc.description}</p>
                  <p className="text-[9px] text-neutral-400 font-mono flex items-center gap-1 mt-1">
                    <Clock size={10} /> Logged: {inc.date || 'N/A'}
                  </p>
                </div>

                {!inc.resolved && (
                  <button
                    onClick={() => handleResolveIncident(inc.id)}
                    className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 border border-emerald-200 bg-emerald-50 px-3 py-1.5 rounded-xl transition"
                  >
                    <CheckCircle size={12} />
                    <span>Resolve</span>
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Incident Wear Logging Modal */}
      <AnimatePresence>
        {showIncidentModal && (
          <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl p-6 space-y-6"
            >
              <div>
                <h3 className="text-lg font-black uppercase tracking-tighter italic">Log Damage or Maintenance Needed</h3>
                <p className="text-xs text-neutral-400">Keep inventory and rental logs secure and completely accounted for.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Incident Severity</label>
                  <select
                    value={newIncident.severity}
                    onChange={(e) => setNewIncident({ ...newIncident, severity: e.target.value as any })}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary text-sm transition"
                  >
                    <option value="low">Low (Aesthetic wear / scratch)</option>
                    <option value="medium">Medium (Missing piece / minor repair)</option>
                    <option value="high">High (Broken functionality but salvageable)</option>
                    <option value="critical">Critical (Completely broken or lost)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Incident Type</label>
                  <select
                    value={newIncident.type}
                    onChange={(e) => setNewIncident({ ...newIncident, type: e.target.value as any })}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary text-sm transition"
                  >
                    <option value="damage">Damage / Wear</option>
                    <option value="loss">Loss of Ancillary</option>
                    <option value="repair">Scheduled Repair</option>
                    <option value="theft">Theft / Complete Loss</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Description of wear / issue</label>
                  <textarea
                    rows={3}
                    value={newIncident.description}
                    onChange={(e) => setNewIncident({ ...newIncident, description: e.target.value })}
                    placeholder="Provide description of how damage occurred or accessories lost..."
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-primary transition"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowIncidentModal(false)}
                  className="px-4 py-2 bg-neutral-100 font-bold text-neutral-600 rounded-xl hover:bg-neutral-200 text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddIncident}
                  disabled={submittingIncident}
                  className="px-4 py-2 bg-black text-white font-bold rounded-xl hover:bg-neutral-800 text-xs transition"
                >
                  {submittingIncident ? 'Logging...' : 'Submit Log'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
