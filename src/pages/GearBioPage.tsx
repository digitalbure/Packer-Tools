import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, collection, query, getDocs, addDoc, writeBatch, getDoc, collectionGroup, where, limit } from 'firebase/firestore';
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
  Phone, Mail, MessageSquare, AlertTriangle, ShieldCheck, SlidersHorizontal, User
} from 'lucide-react';
import BookingWidget, { BookingRequest } from '../booking/BookingWidget';
import { computeDeposit } from '../booking/depositPolicy';
import '../marketplace/brand.css';
import '../booking/booking.css';
import AssetIdentificationPanel from '../components/AssetIdentificationPanel';
import LabelStudioLauncher from '../components/LabelStudioLauncher';

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
  const [isLabelStudioOpen, setIsLabelStudioOpen] = useState(false);
  const [userTemplates, setUserTemplates] = useState<any[]>([]);
  const [initialPrintTab, setInitialPrintTab] = useState<'designs' | 'print'>('designs');

  useEffect(() => {
    if (user?.uid) {
      const q = query(collection(db, 'users', user.uid, 'labelTemplates'));
      getDocs(q).then((snap) => {
        const templatesList = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }));
        setUserTemplates(templatesList);
      }).catch((err) => {
        console.warn("Could not check user templates:", err);
      });
    }
  }, [user]);

  const printableItems = React.useMemo(() => {
    if (!item) return [];
    return [{
      id: item.id,
      name: item.name,
      assetTag: item.assetTag || '',
      brand: item.brand || '',
      category: item.primaryCategory || item.category || '',
      serial: item.serialNumber || '',
      model: item.model || item.modelNumber || '',
      ownerId: item.ownerId || '',
      status: item.status || '',
      condition: item.condition || '',
      ownerName: item.recoveryContactName || ownerProfile?.displayName || '',
      ownerPhone: item.recoveryContactPhone || ownerProfile?.phoneNumber || '',
      ownerEmail: item.recoveryContactEmail || ownerProfile?.email || '',
      ownerBio: item.ownerBio || ownerProfile?.bio || ''
    }];
  }, [item, ownerProfile]);

  useEffect(() => {
    if (item) {
      document.title = `${item.brand ? item.brand + ' ' : ''}${item.name} | Packer Tools Digital Passport`;
      
      const itemAny = item as any;
      const itemImg = (item.photoUrls && item.photoUrls.length > 0 && item.photoUrls[0])
        || itemAny.photoUrl
        || itemAny.imageUrl
        || itemAny.image
        || (itemAny.photos && itemAny.photos.length > 0 && itemAny.photos[0])
        || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&q=80&w=600';
      
      const updateOrCreateMetaTag = (selector: string, attrName: string, attrVal: string, contentVal: string) => {
        let element = document.querySelector(selector);
        if (!element) {
          element = document.createElement('meta');
          element.setAttribute(attrName, attrVal);
          document.head.appendChild(element);
        }
        element.setAttribute('content', contentVal);
      };

      updateOrCreateMetaTag('meta[property="og:title"]', 'property', 'og:title', `${item.brand ? item.brand + ' ' : ''}${item.name} Passport`);
      updateOrCreateMetaTag('meta[property="og:description"]', 'property', 'og:description', item.description || `Certified product asset reference ID: ${item.assetTag || item.id}`);
      updateOrCreateMetaTag('meta[property="og:image"]', 'property', 'og:image', itemImg);
      updateOrCreateMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', `${item.brand ? item.brand + ' ' : ''}${item.name} Passport`);
      updateOrCreateMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', item.description || `Certified product asset reference ID: ${item.assetTag || item.id}`);
      updateOrCreateMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', itemImg);
      updateOrCreateMetaTag('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
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
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingConditions, setBookingConditions] = useState<string[]>([]);

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
    if (!id) {
      setLoading(false);
      return;
    }

    let unsubItem: (() => void) | null = null;
    let unsubIncidents: (() => void) | null = null;
    let unsubOwner: (() => void) | null = null;
    let isMounted = true;

    setLoading(true);

    const initLoad = async () => {
      let candidateOwnerId = queryOwnerId || (user ? user.uid : null);
      let foundData: GearItem | null = null;
      let finalOwnerId: string | null = candidateOwnerId;

      // Tier 1: Direct document lookup if candidate ownerId is available
      if (candidateOwnerId) {
        try {
          const itemRef = doc(db, 'users', candidateOwnerId, 'gearLibrary', id);
          const docSnap = await getDoc(itemRef);
          if (docSnap.exists()) {
            foundData = { id: docSnap.id, ...docSnap.data() } as GearItem;
          }
        } catch (err) {
          console.warn("Direct gear doc lookup failed:", err);
        }
      }

      // Tier 2: Collection group fallback if direct lookup failed or candidateOwnerId was null
      if (!foundData) {
        try {
          const cgQuery = query(collectionGroup(db, 'gearLibrary'), where('id', '==', id), limit(1));
          const cgSnap = await getDocs(cgQuery);
          if (!cgSnap.empty) {
            const docSnap = cgSnap.docs[0];
            foundData = { id: docSnap.id, ...docSnap.data() } as GearItem;
            finalOwnerId = foundData.ownerId || docSnap.ref.parent?.parent?.id || null;
          } else {
            // Check by assetTag
            const tagQuery = query(collectionGroup(db, 'gearLibrary'), where('assetTag', '==', id), limit(1));
            const tagSnap = await getDocs(tagQuery);
            if (!tagSnap.empty) {
              const docSnap = tagSnap.docs[0];
              foundData = { id: docSnap.id, ...docSnap.data() } as GearItem;
              finalOwnerId = foundData.ownerId || docSnap.ref.parent?.parent?.id || null;
            } else {
              // Fallback: search recent collectionGroup docs matching doc.id
              const allCgSnap = await getDocs(query(collectionGroup(db, 'gearLibrary'), limit(300)));
              const matchDoc = allCgSnap.docs.find(d => d.id === id || d.data().assetTag === id);
              if (matchDoc) {
                foundData = { id: matchDoc.id, ...matchDoc.data() } as GearItem;
                finalOwnerId = foundData.ownerId || matchDoc.ref.parent?.parent?.id || null;
              }
            }
          }
        } catch (cgErr) {
          console.warn("Collection group gear lookup failed:", cgErr);
        }
      }

      if (!isMounted) return;

      if (foundData && finalOwnerId) {
        setItem(foundData);
        setEditForm(foundData);

        // Listen for live updates on gear item
        const itemRef = doc(db, 'users', finalOwnerId, 'gearLibrary', foundData.id);
        unsubItem = onSnapshot(itemRef, (docSnap) => {
          if (docSnap.exists() && isMounted) {
            const updated = { id: docSnap.id, ...docSnap.data() } as GearItem;
            setItem(updated);
          }
        }, (err) => console.warn("Live gear update error:", err));

        // Fetch Incidents
        const incidentsRef = collection(db, 'users', finalOwnerId, 'gearLibrary', foundData.id, 'incidents');
        unsubIncidents = onSnapshot(incidentsRef, (snapshot) => {
          if (!isMounted) return;
          const fetchedIncidents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as GearIncident[];
          setIncidents(fetchedIncidents.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
        }, (err) => console.warn("GearBioPage: Error catching incidents:", err));

        // Fetch Owner PROFILE
        const ownerRef = doc(db, 'users', finalOwnerId);
        unsubOwner = onSnapshot(ownerRef, (ownerSnap) => {
          if (ownerSnap.exists() && isMounted) {
            setOwnerProfile(ownerSnap.data());
          }
        }, (err) => console.warn("GearBioPage: Error catching owner profile:", err));

        // Fetch Owner Booking Conditions
        const qConditions = query(collection(db, 'users', finalOwnerId, 'bookingConditions'));
        getDocs(qConditions).then(snapshot => {
          if (!snapshot.empty && isMounted) {
            const condList = snapshot.docs.map(doc => doc.data().name as string);
            setBookingConditions(condList);
          }
        }).catch(e => console.warn("Error getting public conditions template:", e));

      } else {
        toast.error("Gear item not found or has been deleted.");
        if (user) {
          navigate('/library');
        }
      }

      if (isMounted) {
        setLoading(false);
      }
    };

    initLoad();

    return () => {
      isMounted = false;
      if (unsubItem) unsubItem();
      if (unsubIncidents) unsubIncidents();
      if (unsubOwner) unsubOwner();
    };
  }, [id, user, queryOwnerId, navigate]);

  const handleBookReservation = async (req: BookingRequest) => {
    if (!item) return;
    try {
      setBookingLoading(true);
      const targetOwnerId = queryOwnerId || item.ownerId || user?.uid;
      const pd = req.pickupDropoff;
      await addDoc(collection(db, 'gearBookings'), {
        gearId: item.id || id,
        gearName: `${item.brand || ''} ${item.model || item.name}`.trim(),
        brand: item.brand || '',
        ownerId: targetOwnerId || '',
        clientName: req.clientName,
        clientEmail: req.clientEmail,
        clientPhone: req.clientPhone,
        startDate: req.startDate,
        endDate: req.endDate,
        days: req.quote.days,
        estimatedRental: req.quote.rental,
        depositAmount: req.quote.deposit,
        paymentStatus: 'Pending Deposit',
        reservationType: 'deposit',
        customConditions: req.conditions,
        createdAt: new Date().toISOString(),
        pickupDropoff: pd ? {
          pickupType: pd.pickupType, pickupLocationId: pd.pickupLocationId, pickupLabel: pd.pickupLabel || '', dropoffLabel: pd.dropoffLabel || '', pickupCustomAddress: pd.pickupCustomAddress,
          pickupTimeSlot: pd.pickupTimeSlot, pickupNotes: pd.pickupNotes, dropoffType: pd.dropoffType,
          dropoffLocationId: pd.dropoffLocationId, dropoffCustomAddress: pd.dropoffCustomAddress,
          dropoffTimeSlot: pd.dropoffTimeSlot, dropoffNotes: pd.dropoffNotes, distanceKm: pd.distanceKm, transitCost: pd.transitCost,
        } : null,
      });
      setBookingSuccess(true);
      toast.success('Booking request sent to the owner.');
    } catch (err) {
      console.error(err);
      toast.error('The request did not send. Check your connection and try again.');
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
          ownerBio: editForm.ownerBio || '',
          recoveryContactName: editForm.recoveryContactName || '',
          recoveryContactPhone: editForm.recoveryContactPhone || '',
          recoveryContactEmail: editForm.recoveryContactEmail || '',
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
    if (userTemplates.length > 0) {
      setInitialPrintTab('print');
    } else {
      setInitialPrintTab('designs');
    }
    setIsLabelStudioOpen(true);
  };

  const qrValue = item ? `${window.location.origin}/gear/${item.id}?owner=${item.ownerId}` : '';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        <p className="mt-4 text-neutral-400 font-mono text-xs">Loading this item's page...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold">This item was not found</h2>
        <Link to="/library" className="mt-4 inline-flex items-center gap-2 text-primary font-bold">
          <ArrowLeft size={16} /> Back to your library
        </Link>
      </div>
    );
  }

  const renderConditionRating = (condition?: 'new' | 'good' | 'fair' | 'poor') => {
    const labels: Record<string, string> = { new: 'New', good: 'Good', fair: 'Fair', poor: 'Poor' };
    return <span className="mk__tag">{labels[condition || 'good']}</span>;
  };

  if (item && item.visibility === 'private' && !isOwnerOfItem) {
    return (
      <div className="mk mk__gate">
        <div className="mk__card mk__gate-card">
          <div className="mk__badge mk__badge--bad">
            <ShieldAlert size={24} />
          </div>
          <div>
            <h2 className="mk__h1" style={{ fontSize: '1.25rem' }}>This item is private</h2>
            <p className="mk__lede">The owner has kept this item's page for their own workspace. Sign in if it's yours.</p>
          </div>
          <div style={{ display: 'grid', gap: '.5rem', width: '100%' }}>
            <Link to="/" className="mk__btn mk__btn--primary" style={{ width: '100%' }}>Sign in</Link>
            <Link to="/" className="mk__btn" style={{ width: '100%', border: 'none', boxShadow: 'none' }}>Go to Packer Tools</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!isOwnerOfItem) {
    const recoveryEnabled = item.recoveryEnabled !== false;
    const isLost = item.status === 'missing';

    return (
      <div className="mk" style={{ padding: '0 1rem' }}>
        <div className="mk__wrap">

          <div className="mk__hero">
            <div className={`mk__badge ${isLost ? 'mk__badge--bad' : 'mk__badge--ok'}`}>
              {isLost ? <ShieldAlert size={28} strokeWidth={2} /> : <ShieldCheck size={28} strokeWidth={2} />}
            </div>
            <div>
              <p className="mk__eyebrow">Packer Tools</p>
              <h1 className="mk__h1">{isLost ? "Help return this item" : "Equipment record"}</h1>
              <p className="mk__lede">
                {isLost
                  ? "You scanned this item's tag. It's marked missing — thanks for helping get it back to its owner."
                  : "Specifications and owner contact details for this piece of equipment."}
              </p>
            </div>
          </div>

          {/* Item and owner contact */}
          <div className="mk__card mk__split">
            <div className="mk__panel">
              <p className="mk__label">{item.brand || 'No brand set'}</p>
              <h2 className="mk__h1" style={{ fontSize: '1.375rem' }}>{item.name}</h2>
              <div style={{ display: 'flex', gap: '.5rem', marginTop: '.75rem', flexWrap: 'wrap' }}>
                <span className="mk__tag"><Tag size={11} />{item.category || 'Gear'}</span>
                <span className="mk__tag">Tag {item.assetTag}</span>
              </div>

              {item.photoUrls && item.photoUrls.length > 0 ? (
                <div className="mk__photo" style={{ marginTop: '1.25rem' }}>
                  <img
                    src={item.photoUrls[publicActiveImageIdx] || 'https://picsum.photos/seed/gear/400/400'}
                    alt={`${item.name} image ${publicActiveImageIdx + 1}`}
                    referrerPolicy="no-referrer"
                  />
                  {item.photoUrls.length > 1 && (
                    <>
                      <button type="button" className="mk__photo-nav mk__photo-nav--prev" onClick={() => setPublicActiveImageIdx((prev) => (prev === 0 ? item.photoUrls!.length - 1 : prev - 1))}>←</button>
                      <button type="button" className="mk__photo-nav mk__photo-nav--next" onClick={() => setPublicActiveImageIdx((prev) => (prev === item.photoUrls!.length - 1 ? 0 : prev + 1))}>→</button>
                      <div className="mk__photo-dots">
                        {item.photoUrls.map((_, idx) => (
                          <button key={idx} type="button" onClick={() => setPublicActiveImageIdx(idx)} className={`mk__dot ${publicActiveImageIdx === idx ? 'mk__dot--active' : ''}`} />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="mk__photo mk__photo-empty" style={{ marginTop: '1.25rem' }}>
                  <Camera size={40} className="stroke-1" />
                </div>
              )}
            </div>

            <div className="mk__panel mk__panel--dark">
              <p className="mk__label">{isLost ? "If you've found it" : 'Getting in touch'}</p>
              <p style={{ marginTop: '.5rem', fontSize: '.875rem', lineHeight: 1.5 }}>
                {recoveryEnabled
                  ? (item.recoveryInstructions || 'The owner has not left specific instructions. Use the contact details below to arrange the return.')
                  : 'Contact the owner using the details below to arrange the return.'}
              </p>

              {recoveryEnabled && (
                <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '2px solid #333' }}>
                  {!revealContact ? (
                    <div style={{ display: 'grid', gap: '.5rem' }}>
                      <p style={{ fontSize: '.8125rem', color: '#9AA1A6' }}>Contact details are hidden until you ask to see them, to keep them off spam lists.</p>
                      <button type="button" className="mk__btn mk__btn--dark" onClick={() => { setRevealContact(true); toast.success('Contact details shown below.'); }}>
                        Show contact details
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: '.5rem' }}>
                      {item.recoveryContactPhone && (
                        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                          <a href={`tel:${item.recoveryContactPhone}`} className="mk__btn mk__btn--dark" style={{ flex: 1 }}><Phone size={14} /> Call</a>
                          <a href={`sms:${item.recoveryContactPhone}`} className="mk__btn mk__btn--dark" style={{ flex: 1 }}><MessageSquare size={14} /> Text</a>
                        </div>
                      )}
                      {(item.recoveryContactEmail || ownerProfile?.email) && (
                        <a href={`mailto:${item.recoveryContactEmail || ownerProfile?.email}`} className="mk__btn mk__btn--dark" style={{ width: '100%' }}>
                          <Mail size={14} /> Email {item.recoveryContactName || ownerProfile?.displayName || 'the owner'}
                        </a>
                      )}
                      <button type="button" onClick={() => setRevealContact(false)} style={{ background: 'none', border: 'none', color: '#9AA1A6', fontSize: '.75rem', fontWeight: 600, cursor: 'pointer', textAlign: 'right' }}>
                        Hide again
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '2px solid #333', display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                <img src={ownerProfile?.photoURL || 'https://picsum.photos/seed/avatar/100/100'} style={{ width: '2.5rem', height: '2.5rem', borderRadius: 4, objectFit: 'cover', border: '2px solid #333' }} />
                <div>
                  <p className="mk__label">Owner</p>
                  <p style={{ fontWeight: 700, fontSize: '.875rem' }}>{item.recoveryContactName || ownerProfile?.displayName || 'Not named'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Owner bio */}
          <div className="mk__card">
            <div className="mk__panel">
              <p className="mk__label"><User size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />About the owner</p>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <img src={ownerProfile?.photoURL || 'https://picsum.photos/seed/avatar/100/100'} alt={item.recoveryContactName || ownerProfile?.displayName || 'Owner'} referrerPolicy="no-referrer" style={{ width: '4rem', height: '4rem', borderRadius: 4, objectFit: 'cover', border: '2px solid var(--ink)' }} />
                <div style={{ flex: 1, minWidth: '12rem' }}>
                  <p style={{ fontWeight: 800, fontSize: '1rem' }}>{item.recoveryContactName || ownerProfile?.displayName || 'Not named'}</p>
                  {ownerProfile?.company && <p className="mk__label" style={{ marginTop: '.125rem' }}>{ownerProfile.company}</p>}
                  {(item.ownerBio || ownerProfile?.bio) && (
                    <p className="mk__note" style={{ marginTop: '.75rem' }}>{item.ownerBio || ownerProfile?.bio}</p>
                  )}
                  <div className="mk__form-grid" style={{ marginTop: '.75rem' }}>
                    <div>
                      <p className="mk__label">Phone</p>
                      <p className="mk__value">
                        {!revealContact
                          ? (item.recoveryContactPhone ? `${item.recoveryContactPhone.slice(0, 5)}•••••` : 'Not shared')
                          : (item.recoveryContactPhone || ownerProfile?.phoneNumber || 'Not shared')}
                      </p>
                    </div>
                    <div>
                      <p className="mk__label">Email</p>
                      <p className="mk__value" style={{ fontFamily: "'Barlow Semi Condensed', sans-serif" }}>
                        {!revealContact
                          ? (item.recoveryContactEmail || ownerProfile?.email ? `${(item.recoveryContactEmail || ownerProfile?.email).slice(0, 3)}•••@•••.com` : 'Not shared')
                          : (item.recoveryContactEmail || ownerProfile?.email || 'Not shared')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Specifications */}
          <div className="mk__card">
            <div className="mk__panel">
              <p className="mk__label"><BadgeInfo size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />Specifications</p>
              <div className="mk__spec-grid" style={{ marginTop: '.75rem' }}>
                <div>
                  <p className="mk__label">Condition</p>
                  <div style={{ marginTop: '.25rem' }}>{renderConditionRating(item.condition)}</div>
                </div>
                {item.brand && <div><p className="mk__label">Brand</p><p className="mk__value">{item.brand}</p></div>}
                {item.model && <div><p className="mk__label">Model</p><p className="mk__value">{item.model}</p></div>}
                {item.modelNumber && <div><p className="mk__label">Model number</p><p className="mk__value">{item.modelNumber}</p></div>}
                {item.serialNumber && <div><p className="mk__label">Serial number</p><p className="mk__value" style={{ fontFamily: 'monospace' }}>{item.serialNumber}</p></div>}
                <div><p className="mk__label">Category</p><p className="mk__value">{item.primaryCategory || item.category || 'Other'}</p></div>
                {item.weight ? <div><p className="mk__label">Weight</p><p className="mk__value">{item.weight} {item.weightUnit || 'g'}</p></div> : null}
                {item.releaseYear && <div><p className="mk__label">Release year</p><p className="mk__value">{item.releaseYear}</p></div>}
                {item.dimensions && (item.dimensions.length || item.dimensions.width || item.dimensions.height) && (
                  <div><p className="mk__label">Dimensions</p><p className="mk__value">{item.dimensions.length}×{item.dimensions.width}×{item.dimensions.height} {item.dimensions.unit || 'cm'}</p></div>
                )}
              </div>
              {item.description && <p className="mk__note" style={{ marginTop: '1rem' }}>{item.description}</p>}
            </div>
          </div>

          {/* Finder message */}
          <div className="mk__card">
            <div className="mk__panel">
              <p className="mk__label"><MessageSquare size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />Message the owner</p>
              <p className="mk__lede" style={{ marginTop: '.25rem', textAlign: 'left' }}>
                Leave your contact details so the owner can reach you to arrange a pickup or drop-off. This goes straight to their dashboard.
              </p>

              {reportSubmitted ? (
                <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="mk__note" style={{ marginTop: '1rem', textAlign: 'center', borderColor: 'var(--ok)', background: 'var(--ok-bg)' }}>
                  <Check size={22} strokeWidth={3} style={{ color: 'var(--ok)', margin: '0 auto .5rem' }} />
                  <p style={{ fontWeight: 700, color: 'var(--ok)' }}>Message sent</p>
                  <p style={{ marginTop: '.25rem' }}>The owner has your message and contact details. Thanks for reaching out.</p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmitFinderReport} style={{ marginTop: '1rem', display: 'grid', gap: '.75rem' }}>
                  <div className="mk__form-grid">
                    <div>
                      <label className="mk__label">Your name</label>
                      <input type="text" required value={finderName} onChange={(e) => setFinderName(e.target.value)} placeholder="e.g. Sina Tabua" className="bk__input" style={{ marginTop: '.25rem', width: '100%' }} />
                    </div>
                    <div>
                      <label className="mk__label">Phone or email</label>
                      <input type="text" required value={finderContact} onChange={(e) => setFinderContact(e.target.value)} placeholder="e.g. +679 000 0000" className="bk__input" style={{ marginTop: '.25rem', width: '100%' }} />
                    </div>
                  </div>
                  <div>
                    <label className="mk__label">Where is it, or what would you like to say?</label>
                    <textarea rows={3} value={finderMessage} onChange={(e) => setFinderMessage(e.target.value)} placeholder="e.g. Found at the front desk of the Suva office, ask for security." className="bk__input" style={{ marginTop: '.25rem', width: '100%' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" disabled={submittingReport} className="mk__btn mk__btn--primary">
                      {submittingReport ? 'Sending...' : 'Send message'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          <p className="mk__footer-note">Packer Tools</p>
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
            toast.success("Link copied.");
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
              <h2 className="text-sm font-black uppercase tracking-widest text-neutral-400">Equipment details</h2>
              <p className="text-[10px] text-neutral-400 italic">Specs, condition, and rental settings for this item</p>
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
                  <option value="private">Private (only you can see it)</option>
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
                  placeholder="https://images.unsplash.com/photo-1516035069371-29a1b244cc32&#10;https://images.unsplash.com/photo-1511707171634-5f897ff02aa9"
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

              {item.secondaryCategories?.includes('Rentable') && (
                <BookingWidget
                  dailyRate={item.rentalPrice}
                  deposit={computeDeposit(adminSettings?.moduleWidgetConfigs?.depositPolicy, item.rentalPrice || 0, item.rentalDeposit || ownerProfile?.marketplaceDepositAmount)}
                  format={(n) => formatCurrency(n, item.currency || 'USD')}
                  conditions={bookingConditions}
                  ownerId={queryOwnerId || item.ownerId}
                  submitting={bookingLoading}
                  done={bookingSuccess}
                  onSubmit={handleBookReservation}
                  onReset={() => setBookingSuccess(false)}
                />
              )}

              {/* Description & AI labels */}
              {item.description && (
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Description</p>
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
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-900">Suggested by Packer Tools</h4>
                    <p className="text-xs text-amber-700 mt-1 leading-normal italic">
                      "{item.organizationTip}"
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Owner Custodian Bio & Contact Passport Card */}
          {item && (
            <div className="bg-white border border-neutral-100 rounded-[2.5rem] p-8 shadow-xl shadow-neutral-150/50 space-y-6 text-left">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-neutral-800 flex items-center gap-2">
                    <User size={18} className="text-[#ff4f3a]" />
                    <span>Owner details</span>
                  </h3>
                  <p className="text-[10px] text-neutral-400 mt-1">
                    How scanners and visitors view your identity brief and direct contact details.
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-widest">
                  {isEditing ? "EDITING MODE" : "PUBLIC PREVIEW"}
                </span>
              </div>

              <div className="flex flex-col md:flex-row gap-6 items-start">
                <img 
                  src={ownerProfile?.photoURL || 'https://picsum.photos/seed/avatar/100/100'} 
                  alt={editForm.recoveryContactName || ownerProfile?.displayName || 'Custodian'}
                  className="w-20 h-20 rounded-2xl object-cover shrink-0 border-2 border-neutral-100 shadow-sm"
                  referrerPolicy="no-referrer"
                />
                <div className="space-y-4 flex-1 w-full font-sans">
                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Custodian Full Name</label>
                        <input
                          type="text"
                          value={editForm.recoveryContactName || ''}
                          onChange={(e) => setEditForm({ ...editForm, recoveryContactName: e.target.value })}
                          placeholder={user?.displayName || "Custodian Display Name"}
                          className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">About you (shown to renters and finders)</label>
                        <textarea
                          rows={3}
                          value={editForm.ownerBio || ''}
                          onChange={(e) => setEditForm({ ...editForm, ownerBio: e.target.value })}
                          placeholder="e.g. Lead Director of Photography specializing in commercials and nature documentaries. Owner of Red Sky Studios and Packer Tools partner."
                          className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed font-medium"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Direct Contact Phone</label>
                          <input
                            type="text"
                            value={editForm.recoveryContactPhone || ''}
                            onChange={(e) => setEditForm({ ...editForm, recoveryContactPhone: e.target.value })}
                            placeholder="e.g. +1 555-0199"
                            className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Direct Contact Email</label>
                          <input
                            type="email"
                            value={editForm.recoveryContactEmail || ''}
                            onChange={(e) => setEditForm({ ...editForm, recoveryContactEmail: e.target.value })}
                            placeholder={user?.email || "e.g. finder@example.com"}
                            className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-lg font-black text-neutral-900 leading-none">
                          {item.recoveryContactName || ownerProfile?.displayName || 'Private Equipment Manager'}
                        </h4>
                        {ownerProfile?.company && (
                          <p className="text-xs text-neutral-400 mt-1 font-bold uppercase tracking-wider">{ownerProfile.company}</p>
                        )}
                      </div>

                      <div className="bg-neutral-50/80 border border-neutral-100 p-4 rounded-2xl">
                        <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-1">About</p>
                        <p className="text-xs text-neutral-600 leading-relaxed font-medium italic">
                          {item.ownerBio || ownerProfile?.bio || 'No bio added yet.'}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="p-3 bg-neutral-50 border border-neutral-100 rounded-xl space-y-1">
                          <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Direct Contact Phone</p>
                          <p className="text-xs font-bold text-neutral-800 font-mono">
                            {item.recoveryContactPhone || ownerProfile?.phoneNumber || 'Not Publicly Shared'}
                          </p>
                        </div>
                        <div className="p-3 bg-neutral-50 border border-neutral-100 rounded-xl space-y-1">
                          <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Direct Contact Email</p>
                          <p className="text-xs font-bold text-neutral-800 font-mono">
                            {item.recoveryContactEmail || ownerProfile?.email || 'Not Publicly Shared'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {item && (
            <div className="mb-4">
              <AssetIdentificationPanel asset={item} user={user} onUpdate={() => window.location.reload()} />
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
              <div className="mt-2 flex flex-wrap gap-2 justify-center sm:justify-start">
                <button
                  onClick={handlePrintLabel}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-800 transition"
                >
                  <Printer size={12} />
                  <span>Print Tag Label</span>
                </button>
                {user && (
                  <button
                    type="button"
                    onClick={() => setIsLabelStudioOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition"
                  >
                    <SlidersHorizontal size={12} />
                    <span>Label Studio</span>
                  </button>
                )}
              </div>
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

      <LabelStudioLauncher
        isOpen={isLabelStudioOpen}
        onClose={() => setIsLabelStudioOpen(false)}
        items={printableItems}
        user={user}
      />
    </div>
  );
}
