import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, updateDoc, addDoc } from 'firebase/firestore';
import { 
  onAuthStateChanged, 
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { db, auth } from '../firebase';
import { PackingList, PackingItem, Contact, AdminSettings, UserProfile } from '../types';
import { 
  Package, 
  CheckCircle2, 
  Clock, 
  Tag, 
  Info, 
  ArrowRight,
  ArrowLeft,
  ShoppingBag,
  Truck,
  ShieldCheck,
  QrCode,
  ExternalLink,
  Link2,
  Share2,
  Lock,
  Calendar,
  DollarSign,
  MessageSquare,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../providers/AuthProvider';
import { computeDeposit } from '../booking/depositPolicy';
import '../booking/booking.css';
import '../marketplace/brand.css';
import { useLandingFonts } from '../components/landing/useLandingFonts';

export default function MarketplaceView() {
  useLandingFonts();
  const { id } = useParams<{ id: string }>();
  const { convertCurrency, selectedCurrency, user: authUser } = useAuth();
  const [rawList, setList] = useState<PackingList | null>(null);
  const [items, setItems] = useState<PackingItem[]>([]);
  const [recipient, setRecipient] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [globalSettings, setGlobalSettings] = useState<AdminSettings | null>(null);
  const [sellerProfile, setSellerProfile] = useState<UserProfile | null>(null);

  // Dynamic gallery active image
  const [activeMediaUrl, setActiveMediaUrl] = useState<string>('');
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  // Booking & Purchase Inputs
  const [bookingClientName, setBookingClientName] = useState('');
  const [bookingClientEmail, setBookingClientEmail] = useState('');
  const [bookingClientPhone, setBookingClientPhone] = useState('');
  const [bookingStartDate, setBookingStartDate] = useState('');
  const [bookingEndDate, setBookingEndDate] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Enquiry Inputs
  const [enquiryMessage, setEnquiryMessage] = useState('');
  const [enquiryLoading, setEnquiryLoading] = useState(false);
  const [enquirySuccess, setEnquirySuccess] = useState(false);

  // Guest Authentication Forms
  const [authTab, setAuthTab] = useState<'signin' | 'register'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authDisplayName, setAuthDisplayName] = useState('');
  const [authFormLoading, setAuthFormLoading] = useState(false);

  // Switch between secure checkout and message enquiry
  const [activeActionTab, setActiveActionTab] = useState<'checkout' | 'enquiry'>('checkout');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      setCurrentUser(authUser);
      if (authUser) {
        setBookingClientName(authUser.displayName || '');
        setBookingClientEmail(authUser.email || '');
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const fetchData = async () => {
      if (!id) return;
      try {
        // Fetch global settings
        const settingsDoc = await getDoc(doc(db, 'adminSettings', 'global'));
        if (settingsDoc.exists()) {
          setGlobalSettings(settingsDoc.data() as AdminSettings);
        }

        const listDoc = await getDoc(doc(db, 'packingLists', id));
        if (!listDoc.exists()) {
          setError('Listing not found');
          setLoading(false);
          return;
        }

        const listData = { id: listDoc.id, ...listDoc.data() } as PackingList;
        
        if (!listData.marketplaceEnabled) {
          setError('This listing is private');
          setLoading(false);
          return;
        }

        setList(listData);
        
        // Update document metadata for better sharing
        document.title = `${listData.name} | Packer Marketplace`;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
          metaDesc.setAttribute('content', listData.marketplaceDetails || listData.description || `View visual inventory for ${listData.name}`);
        }

        // Fetch seller profile. Profiles are owner/admin-only, so this fails with
        // permission-denied for every other visitor — that's expected, not an error,
        // and must not stop the rest of the listing from loading.
        if (listData.ownerId) {
          try {
            const sellerDoc = await getDoc(doc(db, 'users', listData.ownerId));
            if (sellerDoc.exists()) {
              setSellerProfile(sellerDoc.data() as UserProfile);
            }
          } catch (sellerErr) {
            console.warn('Seller profile not readable by this visitor:', sellerErr);
          }
        }

        // Fetch items
        const itemsSnap = await getDocs(collection(db, 'packingLists', id, 'items'));
        const itemsData = itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PackingItem[];
        setItems(itemsData.sort((a, b) => (a.order || 0) - (b.order || 0)));

        const firstItemImage = itemsData.find(item => item.photoUrls && item.photoUrls.length > 0)?.photoUrls?.[0] || '';
        const ogImageUrl = listData.image || firstItemImage || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&q=80&w=400';
        
        // Initialize active media Url
        setActiveMediaUrl(listData.image || firstItemImage || '');

        // Update social OG & Twitter tags dynamically
        const updateOrCreateMetaTag = (selector: string, attrName: string, attrVal: string, contentVal: string) => {
          let element = document.querySelector(selector);
          if (!element) {
            element = document.createElement('meta');
            element.setAttribute(attrName, attrVal);
            document.head.appendChild(element);
          }
          element.setAttribute('content', contentVal);
        };

        updateOrCreateMetaTag('meta[property="og:title"]', 'property', 'og:title', `${listData.name} | Packer Marketplace`);
        updateOrCreateMetaTag('meta[property="og:description"]', 'property', 'og:description', listData.marketplaceDetails || listData.description || `View visual inventory for ${listData.name}`);
        updateOrCreateMetaTag('meta[property="og:image"]', 'property', 'og:image', ogImageUrl);
        updateOrCreateMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', `${listData.name} | Packer Marketplace`);
        updateOrCreateMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', listData.marketplaceDetails || listData.description || `View visual inventory for ${listData.name}`);
        updateOrCreateMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', ogImageUrl);

        // Fetch recipient if exists
        if (listData.recipientId) {
          const contactSnap = await getDoc(doc(db, 'contacts', listData.recipientId));
          if (contactSnap.exists()) {
            setRecipient({ id: contactSnap.id, ...contactSnap.data() } as Contact);
          }
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching marketplace data:', err);
        setError('Failed to load listing');
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleMarkReceived = async () => {
    if (!id || !rawList) return;
    try {
      await updateDoc(doc(db, 'packingLists', id), {
        status: 'Received',
        receivedAt: new Date().toISOString()
      });
      setList({ ...rawList, status: 'Received', receivedAt: new Date().toISOString() });
      toast.success('Package marked as received!');
    } catch (err) {
      console.error('Error marking as received:', err);
      toast.error('Failed to update status');
    }
  };

  // Compute calculated values for rental
  const getRentDurationInDays = () => {
    if (!bookingStartDate || !bookingEndDate) return 1;
    const start = new Date(bookingStartDate);
    const end = new Date(bookingEndDate);
    const diff = end.getTime() - start.getTime();
    if (diff <= 0) return 1;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const activeCountry = authUser?.country || globalSettings?.marketplaceRegionConfig?.launchCountry || 'Fiji';
  const isFijiBuyer = activeCountry === 'Fiji';

  const getCalculatedFees = () => {
    if (!list) return { subtotal: 0, taxAmount: 0, deposit: 0, totalValue: 0, taxPercent: 15, isInclusive: true };
    const basePrice = list.marketplacePrice || 0;
    const isRental = !list.transactionType || !/^sale$/i.test(list.transactionType);
    const days = isRental ? getRentDurationInDays() : 1;
    const subtotal = basePrice * days;

    const taxPercent = isFijiBuyer
      ? (globalSettings?.taxConfig?.fijiVatRate ?? 15)
      : (globalSettings?.taxConfig?.otherCountriesTaxRates?.[activeCountry]?.rate ?? 10);
    const isInclusive = isFijiBuyer
      ? (globalSettings?.taxConfig?.fijiVatType || 'VIP') === 'VIP'
      : (globalSettings?.taxConfig?.otherCountriesTaxRates?.[activeCountry]?.type || 'exclusive') === 'inclusive';

    let taxAmount = 0;
    let totalValue = subtotal;
    if (isInclusive) {
      taxAmount = subtotal - (subtotal / (1 + (taxPercent / 100)));
    } else {
      taxAmount = subtotal * (taxPercent / 100);
      totalValue = subtotal + taxAmount;
    }

    // Packer Tools does not process payment for this listing, so the deposit shown here is
    // not charged or held — it follows the admin's deposit policy so the renter and owner
    // start from the same figure.
    const deposit = isRental ? computeDeposit(globalSettings?.moduleWidgetConfigs?.depositPolicy, basePrice, list.securityDeposit) : 0;
    totalValue += deposit;

    return { subtotal, taxAmount, deposit, totalValue, taxPercent, isInclusive };
  };

  // Booking / purchase request handler. Nothing is charged: this records a request the owner confirms.
  const handleSecureCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !list) return;
    if (!bookingClientName.trim()) {
      toast.error('Enter your name.');
      return;
    }
    const clientEmail = bookingClientEmail.trim() || currentUser?.email || '';
    if (!clientEmail) {
      toast.error('Enter an email so the owner can reach you.');
      return;
    }

    setBookingLoading(true);
    try {
      const isRental = !list.transactionType || !/^sale$/i.test(list.transactionType);
      const { taxAmount, deposit, totalValue, taxPercent } = getCalculatedFees();

      // Update source Packing List listing status to reflect booking
      await updateDoc(doc(db, 'packingLists', id), {
        bookingClientName: bookingClientName,
        bookingClientEmail: clientEmail,
        rentalStatus: 'awaiting_owner_confirmation',
        updatedAt: new Date().toISOString()
      });

      // Write booking request to gearBookings
      const bookingData = {
        gearId: id,
        gearName: list.name,
        brand: list.brandName || '',
        ownerId: list.ownerId || 'platform_admin',
        clientName: bookingClientName,
        clientEmail,
        clientPhone: bookingClientPhone || '',
        startDate: isRental ? bookingStartDate : new Date().toISOString().split('T')[0],
        endDate: isRental ? bookingEndDate : new Date().toISOString().split('T')[0],
        depositAmount: deposit,
        paymentStatus: 'Awaiting owner confirmation',
        reservationType: isRental ? 'deposit' : 'custom',
        customConditions: [],
        createdAt: new Date().toISOString(),
        totalPrice: totalValue,
        taxAmount,
        deposit,
        taxPercent,
        isTaxInclusive: true,
        transactionType: isRental ? 'rent' : 'sale'
      };

      await addDoc(collection(db, 'gearBookings'), bookingData);

      setBookingSuccess(true);
      toast.success(isRental ? 'Booking request sent.' : 'Purchase request sent.');
    } catch (err) {
      console.error(err);
      toast.error('The request did not send. Try again.');
    } finally {
      setBookingLoading(false);
    }
  };

  // Messaging / enquiry handler
  const handleSendEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !list) return;
    if (!enquiryMessage.trim()) {
      toast.error('Please enter your message first.');
      return;
    }

    setEnquiryLoading(true);
    try {
      await addDoc(collection(db, 'marketplaceInquiries'), {
        listingId: id,
        listingName: list.name,
        senderUid: currentUser?.uid || 'guest',
        senderEmail: currentUser?.email || 'guest@packer.com',
        senderName: currentUser?.displayName || 'Anonymous Partner',
        message: enquiryMessage,
        createdAt: new Date().toISOString(),
        ownerId: list.ownerId || 'platform_admin'
      });

      setEnquirySuccess(true);
      setEnquiryMessage('');
      toast.success('Inquiry dispatched successfully! Average seller reply is under 1 hour.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to dispatch inquiry.');
    } finally {
      setEnquiryLoading(false);
    }
  };

  // Inline Guest Access authorization
  const handleInlineAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword.trim()) {
      toast.error('Please complete email and password.');
      return;
    }
    setAuthFormLoading(true);
    try {
      if (authTab === 'signin') {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
        toast.success('Signed in successfully! Active listing loaded.');
      } else {
        const cred = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        if (cred.user) {
          await updateProfile(cred.user, {
            displayName: authDisplayName || authEmail.split('@')[0]
          });
          // Reload currentUser trigger
          setCurrentUser({ ...cred.user, displayName: authDisplayName } as FirebaseUser);
        }
        toast.success('Account registered successfully! Checkout active.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setAuthFormLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="mk-browse" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '3rem', height: '3rem', border: '4px solid var(--hazard)', borderTopColor: 'transparent', borderRadius: '50%' }} className="animate-spin" />
      </div>
    );
  }

  if (globalSettings?.marketplaceVisibility === 'signed-in' && !currentUser) {
    return (
      <div className="mk mk__gate">
        <div className="mk__card mk__gate-card">
          <div className="mk__badge">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 className="mk__h1" style={{ fontSize: '1.25rem' }}>Sign in to view this listing</h1>
            <p className="mk__lede">The admin has restricted marketplace listings to signed-in users.</p>
          </div>
          <Link to="/" className="mk__btn mk__btn--primary" style={{ width: '100%' }}>Sign in</Link>
        </div>
      </div>
    );
  }

  if (error || !rawList) {
    return (
      <div className="mk mk__gate">
        <div className="mk__card mk__gate-card">
          <div className="mk__badge mk__badge--bad">
            <Info size={24} />
          </div>
          <div>
            <h1 className="mk__h1" style={{ fontSize: '1.25rem' }}>{error || 'Something went wrong'}</h1>
            <p className="mk__lede">This listing may have been removed or set to private.</p>
          </div>
          <Link to="/" className="mk__btn mk__btn--primary" style={{ width: '100%' }}>Go to Packer Tools</Link>
        </div>
      </div>
    );
  }

  const fmtPrice = (n?: number) => (n === undefined || n === null ? null : n.toLocaleString(undefined, { maximumFractionDigits: 2 }));

  // Plain computation, not a hook: this runs after conditional early returns above,
  // and calling a hook there would change the hook count between renders (loading vs.
  // loaded) and crash. rawList is never null past the guards above, but stay defensive.
  const convertedList = (() => {
    if (!rawList) return null;
    const origCurrency = rawList.marketplaceCurrency || rawList.currency || 'USD';
    return {
      ...rawList,
      marketplacePrice: convertCurrency(rawList.marketplacePrice || 0, origCurrency, selectedCurrency),
      securityDeposit: rawList.securityDeposit ? convertCurrency(rawList.securityDeposit, origCurrency, selectedCurrency) : undefined,
    };
  })();

  const list = convertedList || rawList;

  const defaultCurrency = selectedCurrency || globalSettings?.marketplaceRegionConfig?.defaultCurrency || 'USD';
  let currencySymbol = '$';
  if (defaultCurrency) {
    if (defaultCurrency === 'FJD') currencySymbol = 'FJ$';
    else if (defaultCurrency === 'AUD') currencySymbol = 'A$';
    else if (defaultCurrency === 'NZD') currencySymbol = 'NZ$';
    else if (defaultCurrency === 'GBP') currencySymbol = '£';
    else if (defaultCurrency === 'CAD') currencySymbol = 'C$';
    else if (defaultCurrency === 'EUR') currencySymbol = '€';
    else currencySymbol = '$';
  } else {
    currencySymbol = list?.marketplaceCurrency || list?.currency || '$';
  }

  // Create sliding unique images list
  const hasCustomMediaImage = !!list.image;
  const itemPhotosList = items.flatMap(it => it.photoUrls || []).filter(Boolean);
  const galleryList = [
    ...(hasCustomMediaImage ? [list.image!] : []),
    ...itemPhotosList
  ].filter((url, i, self) => url && self.indexOf(url) === i);

  // Check if active media is YouTube/Vimeo embed versus physical image
  const isVideoActive = activeMediaUrl.includes('youtube.com') || activeMediaUrl.includes('youtu.be') || activeMediaUrl.includes('vimeo.com') || activeMediaUrl.endsWith('.mp4');

  // Owner listings store this lowercase ('rent'/'sale'); accept either case so a real
  // rental listing doesn't get mislabeled as an outright sale.
  const isRentalOffer = !list.transactionType || !/^sale$/i.test(list.transactionType);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;

    // Swipe threshold
    if (Math.abs(diff) > 40) {
      const currentIndex = galleryList.indexOf(activeMediaUrl);
      if (currentIndex !== -1) {
        if (diff > 0) {
          // Swipe Left -> Next
          const nextIndex = (currentIndex + 1) % galleryList.length;
          setActiveMediaUrl(galleryList[nextIndex]);
        } else {
          // Swipe Right -> Prev
          const prevIndex = (currentIndex - 1 + galleryList.length) % galleryList.length;
          setActiveMediaUrl(galleryList[prevIndex]);
        }
      }
    }
    setTouchStartX(null);
  };

  return (
    <div className="mk mk-detail">
      <div className="mk-detail__pane mk-detail__pane--left">
        <div className="mk-detail__inner">
          <Link to="/marketplace" className="mk__btn" style={{ width: 'fit-content' }}>
            <ArrowLeft size={14} />
            <span>Back to Marketplace</span>
          </Link>

          <div>
            <div
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className="mk-gallery"
            >
              {activeMediaUrl ? (
                isVideoActive ? (
                  activeMediaUrl.endsWith('.mp4') ? (
                    <video src={activeMediaUrl} controls />
                  ) : (
                    <iframe src={activeMediaUrl.replace('watch?v=', 'embed/').split('&')[0]} title="Listing video" allowFullScreen />
                  )
                ) : (
                  <img src={activeMediaUrl} alt={list.name} referrerPolicy="no-referrer" onError={() => setActiveMediaUrl('')} />
                )
              ) : (
                <div className="mk-gallery-empty">
                  <Package size={32} className="stroke-1" />
                  <span>No photos added yet</span>
                </div>
              )}

              {galleryList.length > 1 && (
                <>
                  <button
                    type="button"
                    className="mk__photo-nav mk__photo-nav--prev"
                    onClick={(e) => {
                      e.stopPropagation();
                      const currentIndex = galleryList.indexOf(activeMediaUrl);
                      if (currentIndex !== -1) setActiveMediaUrl(galleryList[(currentIndex - 1 + galleryList.length) % galleryList.length]);
                    }}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    className="mk__photo-nav mk__photo-nav--next"
                    onClick={(e) => {
                      e.stopPropagation();
                      const currentIndex = galleryList.indexOf(activeMediaUrl);
                      if (currentIndex !== -1) setActiveMediaUrl(galleryList[(currentIndex + 1) % galleryList.length]);
                    }}
                  >
                    →
                  </button>
                </>
              )}
            </div>

            {galleryList.length > 1 && (
              <div className="mk-thumbs" style={{ marginTop: '.5rem' }}>
                {galleryList.map((url, index) => (
                  <button key={index} type="button" className="mk-thumb" aria-current={activeMediaUrl === url} onClick={() => setActiveMediaUrl(url)}>
                    <img src={url} alt="" referrerPolicy="no-referrer" />
                  </button>
                ))}
                {(list as any).videoUrl && (
                  <button type="button" className="mk-thumb" aria-current={activeMediaUrl === (list as any).videoUrl} onClick={() => setActiveMediaUrl((list as any).videoUrl)} style={{ background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Share2 size={16} color="#fff" />
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              <span className="mk__tag">{list.transactionType || 'Rental'}</span>
              {list.status && !/^draft$/i.test(list.status) && <span className="mk__tag">{list.status}</span>}
            </div>
            <h1 className="mk__h1" style={{ marginTop: '.5rem' }}>{list.name}</h1>
          </div>

          {list.ownerId && (
            <div className="mk__note" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              <div>
                <p className="mk__label">Seller</p>
                <p style={{ fontWeight: 700, color: 'var(--ink)' }}>
                  {sellerProfile?.storeName || sellerProfile?.displayName || (list.ownerEmail ? list.ownerEmail.split('@')[0] : 'Not named')}
                </p>
                {sellerProfile?.storeBio && <p style={{ marginTop: '.125rem' }}>{sellerProfile.storeBio}</p>}
              </div>
              <a href={`#/shop/${list.ownerId}`} className="mk__btn" style={{ minHeight: '2.25rem', padding: '.375rem .875rem', fontSize: '.75rem', flex: 'none' }}>
                Visit store
              </a>
            </div>
          )}

          <div>
            <p className="mk__label">Description</p>
            <div style={{ marginTop: '.375rem', fontSize: '.875rem', lineHeight: 1.6 }} className="prose max-w-none">
              <ReactMarkdown>{list.marketplaceDetails || list.description || 'No description added yet.'}</ReactMarkdown>
            </div>
          </div>

          <div className="mk-rates">
            <div>
              <p className="mk__label">Price</p>
              <p className="mk-price">
                {list.marketplacePrice ? `${currencySymbol}${fmtPrice(list.marketplacePrice)}` : 'Ask seller'}
                {list.marketplacePrice ? <span> {isRentalOffer ? '/day' : 'outright'}</span> : null}
              </p>
            </div>
            <div>
              <p className="mk__label">{isFijiBuyer ? 'Fiji VAT' : 'Tax'}</p>
              <p style={{ fontWeight: 700 }}>
                {isFijiBuyer
                  ? `${globalSettings?.taxConfig?.fijiVatRate ?? 15}% (${(globalSettings?.taxConfig?.fijiVatType || 'VIP') === 'VIP' ? 'included' : 'added at checkout'})`
                  : `${globalSettings?.taxConfig?.otherCountriesTaxRates?.[activeCountry]?.rate ?? 10}%`}
              </p>
            </div>
          </div>

          <div className="bk">
            <div className="mk-tabs" style={{ margin: '1rem' }}>
              <button type="button" aria-selected={activeActionTab === 'checkout'} onClick={() => setActiveActionTab('checkout')}>
                {isRentalOffer ? 'Book' : 'Buy'}
              </button>
              <button type="button" aria-selected={activeActionTab === 'enquiry'} onClick={() => setActiveActionTab('enquiry')}>
                Message seller
              </button>
            </div>

            {activeActionTab === 'checkout' && (
              <div className="bk__body" style={{ paddingTop: 0 }}>
                {!currentUser ? (
                  <div style={{ display: 'grid', gap: '1rem', textAlign: 'center' }}>
                    <div>
                      <Lock size={22} style={{ margin: '0 auto .5rem', color: 'var(--hazard)' }} />
                      <h4 style={{ fontWeight: 800, fontSize: '.875rem' }}>Sign in to book</h4>
                      <p className="bk__note" style={{ marginTop: '.25rem' }}>Sign in or create an account to send a request.</p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', borderBottom: '2px solid var(--concrete)', paddingBottom: '.75rem' }}>
                      <button type="button" onClick={() => setAuthTab('signin')} className="mk__label" style={{ background: 'none', border: 'none', cursor: 'pointer', color: authTab === 'signin' ? 'var(--hazard)' : 'var(--ink-soft)' }}>Sign in</button>
                      <button type="button" onClick={() => setAuthTab('register')} className="mk__label" style={{ background: 'none', border: 'none', cursor: 'pointer', color: authTab === 'register' ? 'var(--hazard)' : 'var(--ink-soft)' }}>Create account</button>
                    </div>

                    <form onSubmit={handleInlineAuth} style={{ display: 'grid', gap: '.75rem', textAlign: 'left' }}>
                      {authTab === 'register' && (
                        <div className="bk__field">
                          <label className="bk__label" htmlFor="mv-name">Your name</label>
                          <input id="mv-name" className="bk__input" type="text" required placeholder="e.g. Epeli Qele" value={authDisplayName} onChange={(e) => setAuthDisplayName(e.target.value)} />
                        </div>
                      )}
                      <div className="bk__field">
                        <label className="bk__label" htmlFor="mv-email">Email</label>
                        <input id="mv-email" className="bk__input" type="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
                      </div>
                      <div className="bk__field">
                        <label className="bk__label" htmlFor="mv-pass">Password</label>
                        <input id="mv-pass" className="bk__input" type="password" required value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} />
                      </div>
                      <button type="submit" disabled={authFormLoading} className="bk__btn">
                        {authFormLoading ? 'Checking...' : authTab === 'signin' ? 'Sign in' : 'Create account'}
                      </button>
                    </form>
                  </div>
                ) : bookingSuccess ? (
                  <div className="bk__done">
                    <h4>Request sent</h4>
                    <p>The seller has your details and will confirm with you directly.</p>
                    <button type="button" className="bk__btn bk__btn--quiet" onClick={() => setBookingSuccess(false)}>Send another request</button>
                  </div>
                ) : (
                  <form onSubmit={handleSecureCheckout} style={{ display: 'grid', gap: '1rem' }}>
                    {isRentalOffer && (
                      <div className="bk__row">
                        <div className="bk__field">
                          <label className="bk__label" htmlFor="mv-start"><Calendar size={11} style={{ display: 'inline', marginRight: 3, verticalAlign: -1 }} />Pickup date</label>
                          <input id="mv-start" className="bk__input" type="date" required value={bookingStartDate} onChange={(e) => setBookingStartDate(e.target.value)} />
                        </div>
                        <div className="bk__field">
                          <label className="bk__label" htmlFor="mv-end"><Calendar size={11} style={{ display: 'inline', marginRight: 3, verticalAlign: -1 }} />Return date</label>
                          <input id="mv-end" className="bk__input" type="date" required value={bookingEndDate} onChange={(e) => setBookingEndDate(e.target.value)} />
                        </div>
                      </div>
                    )}

                    <fieldset className="bk__fs">
                      <legend>Your details</legend>
                      <div className="bk__field">
                        <label className="bk__label" htmlFor="mv-cname">Name</label>
                        <input id="mv-cname" className="bk__input" type="text" required value={bookingClientName} onChange={(e) => setBookingClientName(e.target.value)} />
                      </div>
                      <div className="bk__row">
                        <div className="bk__field">
                          <label className="bk__label" htmlFor="mv-cemail">Email</label>
                          <input id="mv-cemail" className="bk__input" type="email" required value={bookingClientEmail} onChange={(e) => setBookingClientEmail(e.target.value)} />
                        </div>
                        <div className="bk__field">
                          <label className="bk__label" htmlFor="mv-cphone">Phone (optional)</label>
                          <input id="mv-cphone" className="bk__input" type="text" value={bookingClientPhone} onChange={(e) => setBookingClientPhone(e.target.value)} />
                        </div>
                      </div>
                    </fieldset>

                    {getCalculatedFees().subtotal > 0 && (() => {
                      const fees = getCalculatedFees();
                      return (
                        <div className="bk__sum">
                          <div className="bk__line">
                            <span>{isRentalOffer ? `${currencySymbol}${fmtPrice(list.marketplacePrice)} × ${getRentDurationInDays()} ${getRentDurationInDays() === 1 ? 'day' : 'days'}` : 'Purchase price'}</span>
                            <span>{currencySymbol}{fees.subtotal.toLocaleString()}</span>
                          </div>
                          {fees.deposit > 0 && (
                            <div className="bk__line">
                              <span>Refundable deposit</span>
                              <span>{currencySymbol}{fees.deposit.toLocaleString()}</span>
                            </div>
                          )}
                          <div className="bk__line">
                            <span>{isFijiBuyer ? 'Fiji VAT' : 'Tax'} ({fees.taxPercent}%){fees.isInclusive ? ' included' : ''}</span>
                            <span>{fees.isInclusive ? '' : '+'}{currencySymbol}{fees.taxAmount.toFixed(2)}</span>
                          </div>
                          <div className="bk__line bk__line--total">
                            <span>Estimated total</span>
                            <span>{currencySymbol}{fees.totalValue.toFixed(2)}</span>
                          </div>
                          <p className="bk__note">The seller confirms this request. Nothing is charged here.</p>
                        </div>
                      );
                    })()}

                    <button type="submit" disabled={bookingLoading} className="bk__btn">
                      {bookingLoading ? 'Sending...' : (isRentalOffer ? 'Send booking request' : 'Send purchase request')}
                    </button>
                  </form>
                )}
              </div>
            )}

            {activeActionTab === 'enquiry' && (
              <div className="bk__body" style={{ paddingTop: 0 }}>
                {enquirySuccess ? (
                  <div className="bk__done">
                    <h4>Message sent</h4>
                    <p>The seller has your message and will reply to your account email.</p>
                    <button type="button" className="bk__btn bk__btn--quiet" onClick={() => setEnquirySuccess(false)}>Send another message</button>
                  </div>
                ) : (
                  <form onSubmit={handleSendEnquiry} style={{ display: 'grid', gap: '1rem' }}>
                    <div className="bk__field">
                      <label className="bk__label" htmlFor="mv-enquiry">Message to the seller</label>
                      <textarea id="mv-enquiry" className="bk__input" rows={4} required value={enquiryMessage} onChange={(e) => setEnquiryMessage(e.target.value)} placeholder="Ask about availability, terms, or pickup" />
                    </div>
                    <button type="submit" disabled={enquiryLoading} className="bk__btn">
                      {enquiryLoading ? 'Sending...' : 'Send message'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mk-detail__pane mk-detail__pane--dark">
        <div className="mk-detail__inner">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #333', paddingBottom: '1rem' }}>
            <div>
              <h2 className="mk__h1" style={{ fontSize: '1.5rem', color: 'var(--tape)' }}>Included items</h2>
              <p style={{ color: '#9AA1A6', fontSize: '.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.03em' }}>{items.length} {items.length === 1 ? 'item' : 'items'}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
              <button
                onClick={() => {
                  navigator.share({
                    title: `${list.name} | Packer Marketplace`,
                    text: list.marketplaceDetails || list.description,
                    url: window.location.href
                  }).catch(() => {
                    navigator.clipboard.writeText(window.location.href);
                    toast.success('Link copied.');
                  });
                }}
                className="mk-modal__close"
                style={{ background: 'transparent', borderColor: '#333', color: '#fff' }}
                title="Share"
              >
                <Share2 size={16} />
              </button>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '.6875rem', color: '#9AA1A6', fontWeight: 700, textTransform: 'uppercase' }}>Price</p>
                <p className="mk-price" style={{ fontSize: '1.25rem', color: 'var(--tape)' }}>{list.marketplacePrice ? `${currencySymbol}${fmtPrice(list.marketplacePrice)}` : 'Ask seller'}</p>
              </div>
            </div>
          </div>

          <div className="mk-included">
            {items.map((item, index) => (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                key={item.id}
                className="mk-included-item"
              >
                <div className="mk-included-item__thumb">
                  {item.photoUrls?.[0] ? (
                    <img src={item.photoUrls[0]} alt={item.name} referrerPolicy="no-referrer" />
                  ) : (
                    <Package size={22} style={{ color: '#666' }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ fontWeight: 700, color: 'var(--tape)', fontSize: '.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</h4>
                  <div style={{ display: 'flex', gap: '.5rem', marginTop: '.25rem', flexWrap: 'wrap' }}>
                    <span className="mk__tag" style={{ borderColor: '#444', fontSize: '.625rem' }}>{item.assetTag || 'No tag'}</span>
                    {item.aiLabel && <span className="mk__tag" style={{ borderColor: '#444', fontSize: '.625rem' }}>{item.aiLabel}</span>}
                  </div>
                  {item.relatedItemIds && item.relatedItemIds.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.375rem', marginTop: '.5rem', alignItems: 'center' }}>
                      <Link2 size={10} style={{ color: '#666' }} />
                      {item.relatedItemIds.map(relatedId => {
                        const relatedItem = items.find(i => i.id === relatedId);
                        if (!relatedItem) return null;
                        return <span key={relatedId} className="mk__tag" style={{ borderColor: '#444', fontSize: '.625rem' }}>{relatedItem.name}</span>;
                      })}
                    </div>
                  )}
                </div>
                <div style={{ width: '.625rem', height: '.625rem', borderRadius: '50%', flex: 'none', background: item.status === 'packed' ? 'var(--ok)' : '#555' }} />
              </motion.div>
            ))}
          </div>

          <footer style={{ paddingTop: '2rem', borderTop: '2px solid #333', textAlign: 'center', display: 'grid', gap: '1rem' }}>
            <p style={{ color: '#9AA1A6', fontSize: '.75rem', lineHeight: 1.6, maxWidth: '22rem', margin: '0 auto' }}>
              This listing is managed with <a href="https://packer.tools" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--tape)', fontWeight: 700 }}>Packer Tools</a>.
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
