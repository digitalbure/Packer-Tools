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

export default function MarketplaceView() {
  const { id } = useParams<{ id: string }>();
  const [list, setList] = useState<PackingList | null>(null);
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
        document.title = `${listData.name} | Visual Inventory Marketplace`;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
          metaDesc.setAttribute('content', listData.marketplaceDetails || listData.description || `View visual inventory for ${listData.name}`);
        }

        // Fetch seller profile
        if (listData.ownerId) {
          const sellerDoc = await getDoc(doc(db, 'users', listData.ownerId));
          if (sellerDoc.exists()) {
            setSellerProfile(sellerDoc.data() as UserProfile);
          }
        }

        // Fetch items
        const itemsSnap = await getDocs(collection(db, 'packingLists', id, 'items'));
        const itemsData = itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PackingItem[];
        setItems(itemsData.sort((a, b) => (a.order || 0) - (b.order || 0)));

        const firstItemImage = itemsData.find(item => item.photoUrls && item.photoUrls.length > 0)?.photoUrls?.[0] || '';
        const ogImageUrl = listData.image || firstItemImage || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=400';
        
        // Initialize active media Url
        setActiveMediaUrl(listData.image || firstItemImage || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=400');

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

        updateOrCreateMetaTag('meta[property="og:title"]', 'property', 'og:title', `${listData.name} | Visual Inventory Marketplace`);
        updateOrCreateMetaTag('meta[property="og:description"]', 'property', 'og:description', listData.marketplaceDetails || listData.description || `View visual inventory for ${listData.name}`);
        updateOrCreateMetaTag('meta[property="og:image"]', 'property', 'og:image', ogImageUrl);
        updateOrCreateMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', `${listData.name} | Visual Inventory Marketplace`);
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
    if (!id || !list) return;
    try {
      await updateDoc(doc(db, 'packingLists', id), {
        status: 'Received',
        receivedAt: new Date().toISOString()
      });
      setList({ ...list, status: 'Received', receivedAt: new Date().toISOString() });
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

  const getCalculatedFees = () => {
    if (!list) return { subtotal: 0, taxAmount: 0, damageWaiver: 0, totalValue: 0, taxPercent: 15 };
    const basePrice = list.marketplacePrice || 0;
    const isRental = list.transactionType === 'Rental' || !list.transactionType;
    const days = isRental ? getRentDurationInDays() : 1;
    const subtotal = basePrice * days;
    const taxPercent = globalSettings?.taxConfig?.fijiVatRate ?? 15;
    const isVatInclusive = (globalSettings?.taxConfig?.fijiVatType || 'VIP') === 'VIP';
    
    let taxAmount = 0;
    let totalValue = subtotal;
    
    if (isVatInclusive) {
      taxAmount = subtotal - (subtotal / (1 + (taxPercent / 100)));
    } else {
      taxAmount = subtotal * (taxPercent / 100);
      totalValue = subtotal + taxAmount;
    }
    const damageWaiver = isRental ? 30 : 0; // standard waiver
    totalValue += damageWaiver;

    return {
      subtotal,
      taxAmount,
      damageWaiver,
      totalValue,
      taxPercent
    };
  };

  // Secure checkout booking handler
  const handleSecureCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !list) return;
    if (!bookingClientName.trim()) {
      toast.error('Please enter your full name for sign-off.');
      return;
    }
    
    setBookingLoading(true);
    try {
      const isRental = list.transactionType === 'Rental' || !list.transactionType;
      const { subtotal, taxAmount, damageWaiver, totalValue, taxPercent } = getCalculatedFees();
      const securityDeposit = list.securityDeposit || 150;

      // Update source Packing List listing status to reflect booking
      await updateDoc(doc(db, 'packingLists', id), {
        bookingClientName: bookingClientName,
        bookingClientEmail: bookingClientEmail || currentUser?.email || 'guest-operator@packer.com',
        bookingClientSignature: bookingClientName || 'Digital Verification Signed',
        bookingPaidAt: new Date().toISOString(),
        rentalStatus: isRental ? 'awaiting_payment' : 'released',
        updatedAt: new Date().toISOString()
      });

      // Write booking request to gearBookings
      const bookingData = {
        gearId: id,
        gearName: list.name,
        brand: list.brandName || 'Verified Partner',
        ownerId: list.ownerId || 'platform_admin',
        clientName: bookingClientName,
        clientEmail: bookingClientEmail || currentUser?.email || 'guest-operator@packer.com',
        clientPhone: bookingClientPhone || '+1 (555) 0199',
        startDate: isRental ? bookingStartDate : new Date().toISOString().split('T')[0],
        endDate: isRental ? bookingEndDate : new Date().toISOString().split('T')[0],
        depositAmount: securityDeposit,
        paymentStatus: 'Deposit Paid',
        reservationType: isRental ? 'deposit' : 'custom',
        customConditions: ['Standard Marketplace Insurance Waiver', 'Owner Verification Complete'],
        createdAt: new Date().toISOString(),
        totalPrice: totalValue,
        taxAmount,
        damageWaiver,
        taxPercent,
        isTaxInclusive: true,
        transactionType: isRental ? 'rent' : 'sale'
      };

      await addDoc(collection(db, 'gearBookings'), bookingData);

      setBookingSuccess(true);
      toast.success(isRental ? 'Advanced Booking secured successfully!' : 'Purchase hold locked!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to complete secure transaction.');
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
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F4]">
        <div className="w-12 h-12 border-4 border-[#ff4f3a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (globalSettings?.marketplaceVisibility === 'signed-in' && !currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F4] p-4 text-center">
        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mb-6 text-amber-500 border border-amber-200">
          <ShieldCheck size={32} />
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tighter mb-2">Restricted Access</h1>
        <p className="text-neutral-500 mb-8 max-w-md mx-auto">This marketplace listing is restricted by the platform administrator. You must be signed in to view this inventory.</p>
        <Link to="/" className="bg-[#1A1A1A] hover:bg-black text-white px-8 py-3 rounded-full font-bold uppercase text-xs tracking-widest transition-all">
          Sign In / Create Account
        </Link>
      </div>
    );
  }

  if (error || !list) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F4] p-4 text-center">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6 text-red-500">
          <Info size={32} />
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tighter mb-2">{error || 'Error'}</h1>
        <p className="text-neutral-500 mb-8">The listing you are looking for might have been removed or set to private.</p>
        <Link to="/" className="bg-primary text-white px-8 py-3 rounded-full font-bold uppercase text-xs tracking-widest">
          Go Home
        </Link>
      </div>
    );
  }

  const defaultCurrency = globalSettings?.marketplaceRegionConfig?.defaultCurrency;
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

  if (galleryList.length === 0) {
    galleryList.push('https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=600');
  }

  // Check if active media is YouTube/Vimeo embed versus physical image
  const isVideoActive = activeMediaUrl.includes('youtube.com') || activeMediaUrl.includes('youtu.be') || activeMediaUrl.includes('vimeo.com') || activeMediaUrl.endsWith('.mp4');

  const isRentalOffer = list.transactionType === 'Rental' || !list.transactionType;

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
    <div className="min-h-screen bg-[#F5F5F4] text-[#1A1A1A] font-sans">
      <main className="grid lg:grid-cols-2 min-h-screen">
        {/* Left Pane: Info & Media Gallery & Booking Transaction Widget */}
        <div className="p-6 md:p-12 lg:p-16 flex flex-col justify-start bg-white border-r border-neutral-100 overflow-y-auto max-h-screen">
          <div className="max-w-xl mx-auto w-full space-y-8">
            {/* Back Button */}
            <div>
              <Link 
                to="/marketplace" 
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-black uppercase tracking-widest rounded-xl transition"
                id="back-to-marketplace-btn"
              >
                <ArrowLeft size={14} className="stroke-[2.5]" />
                <span>Back to Marketplace</span>
              </Link>
            </div>

            {/* Premium Media Gallery Section */}
            <div className="space-y-4">
              <div 
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                className="aspect-[16/10] bg-neutral-100 rounded-[2rem] overflow-hidden border border-neutral-100 relative group shadow-sm flex items-center justify-center select-none"
              >
                {isVideoActive ? (
                  activeMediaUrl.endsWith('.mp4') ? (
                    <video 
                      src={activeMediaUrl} 
                      controls 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <iframe 
                      src={activeMediaUrl.replace('watch?v=', 'embed/').split('&')[0]} 
                      title="Listing Intro Video"
                      className="w-full h-full border-0"
                      allowFullScreen
                    />
                  )
                ) : (
                  <img 
                    src={activeMediaUrl} 
                    alt={list.name} 
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                    referrerPolicy="no-referrer"
                    onError={() => {
                      // fallback to original listing image or default unsplash
                      setActiveMediaUrl('https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=600');
                    }}
                  />
                )}

                {/* Left & Right arrow controls overlaid always on mobile, and hovered on desktop */}
                {galleryList.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const currentIndex = galleryList.indexOf(activeMediaUrl);
                        if (currentIndex !== -1) {
                          const prevIndex = (currentIndex - 1 + galleryList.length) % galleryList.length;
                          setActiveMediaUrl(galleryList[prevIndex]);
                        }
                      }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center transition-all z-10 backdrop-blur-sm shadow-sm md:opacity-0 md:group-hover:opacity-100 cursor-pointer border border-white/10"
                      title="Previous Asset"
                    >
                      <ChevronLeft size={16} className="stroke-[2.5]" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const currentIndex = galleryList.indexOf(activeMediaUrl);
                        if (currentIndex !== -1) {
                          const nextIndex = (currentIndex + 1) % galleryList.length;
                          setActiveMediaUrl(galleryList[nextIndex]);
                        }
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center transition-all z-10 backdrop-blur-sm shadow-sm md:opacity-0 md:group-hover:opacity-100 cursor-pointer border border-white/10"
                      title="Next Asset"
                    >
                      <ChevronRight size={16} className="stroke-[2.5]" />
                    </button>
                  </>
                )}
                
                {/* Overlay Indicators */}
                <span className="absolute bottom-3 right-4 px-3 py-1 bg-black/70 text-white text-[9px] font-black uppercase tracking-widest rounded-full backdrop-blur-sm">
                  {isVideoActive ? 'Playing Video' : 'Visual Asset View'}
                </span>
              </div>

              {/* Thumbnails list */}
              {galleryList.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {galleryList.map((url, index) => {
                    const isSelected = activeMediaUrl === url;
                    return (
                      <button
                        key={index}
                        onClick={() => setActiveMediaUrl(url)}
                        className={`w-14 h-14 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${
                          isSelected ? 'border-[#ff4f3a] scale-95' : 'border-neutral-200 opacity-75 hover:opacity-100'
                        }`}
                      >
                        <img src={url} alt="" className="w-full h-full object-cover h-14" referrerPolicy="no-referrer" />
                      </button>
                    );
                  })}
                  {(list as any).videoUrl && (
                    <button
                      onClick={() => setActiveMediaUrl((list as any).videoUrl)}
                      className={`w-14 h-14 rounded-xl border-2 flex-shrink-0 flex flex-col items-center justify-center bg-black transition-all ${
                        activeMediaUrl === (list as any).videoUrl ? 'border-[#ff4f3a] scale-95' : 'border-neutral-800'
                      }`}
                    >
                      <Share2 size={16} className="text-white animate-pulse" />
                      <span className="text-[7.5px] font-black uppercase text-[#ff4f3a]">VIDEO</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Header info content */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  list.transactionType === 'Sale' ? 'bg-green-100 text-green-600' :
                  'bg-blue-100 text-blue-600'
                }`}>
                  {list.transactionType || 'Rental'}
                </span>
                
                {list.status && list.status !== 'Draft' && (
                  <span className="text-[10px] font-bold uppercase tracking-widest bg-neutral-100 text-neutral-600 px-3 py-1 rounded-full">
                    Package Status: {list.status}
                  </span>
                )}
              </div>

              <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase leading-[0.9] text-neutral-900 border-b border-neutral-50 pb-5">
                {list.name}
              </h1>

              {/* Verified Seller Storefront */}
              {list.ownerId && (
                <div className="p-5 bg-neutral-50 rounded-[1.5rem] border border-neutral-100">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#ff4f3a] block mb-1">Verified Storefront Vendor</span>
                      <h3 className="font-extrabold text-neutral-800 uppercase tracking-tight text-md">
                        {sellerProfile?.storeName || sellerProfile?.displayName || (list.ownerEmail ? list.ownerEmail.split('@')[0] : 'Packer Verified Partner')}
                      </h3>
                      <p className="text-[11px] text-neutral-400 font-semibold">{sellerProfile?.storeBio || 'Premium visual inventory operator.'}</p>
                    </div>

                    <a 
                      href={`#/shop/${list.ownerId}`}
                      className="flex items-center gap-2 px-3.5 py-2 bg-[#ff4f3a]/10 hover:bg-[#ff4f3a]/20 text-[#ff4f3a] font-black uppercase text-[9px] tracking-widest rounded-xl transition"
                    >
                      <span>Visit Store</span>
                      <ExternalLink size={10} className="stroke-[2.5]" />
                    </a>
                  </div>
                </div>
              )}

              {/* Description Output */}
              <div className="space-y-2 pt-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Description Overview</div>
                <div className="text-neutral-600 leading-relaxed font-medium text-sm prose max-w-none">
                  <ReactMarkdown>{list.marketplaceDetails || list.description || 'No detailed specs listed yet by merchant.'}</ReactMarkdown>
                </div>
              </div>
            </div>

            {/* Rates & Financial breakdown */}
            <div className="grid grid-cols-2 gap-8 py-6 border-y border-neutral-100">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">Financial Rates</div>
                <div className="text-3xl font-black tracking-tight text-neutral-900">
                  {list.marketplacePrice ? `${currencySymbol}${list.marketplacePrice}` : 'Free / Gift'}
                  <span className="text-xs font-semibold text-neutral-400 lowercase italic">
                    {isRentalOffer ? ' / day' : ' outright'}
                  </span>
                </div>
              </div>
              {list.securityDeposit ? (
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">Security Deposit Holds</div>
                  <div className="text-xl font-bold font-mono text-neutral-700">
                    {currencySymbol}{list.securityDeposit}
                    <span className="text-[9px] block text-neutral-400 uppercase font-sans tracking-wider font-bold">100% Fully Refundable escrow</span>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1">Fiji Region VAT Status</div>
                  <div className="text-sm font-black text-neutral-700 uppercase">
                    {(globalSettings?.taxConfig?.fijiVatType || 'VIP') === 'VIP' ? 'VAT Inclusive (VIP)' : 'VAT Exclusive (VEP)'}
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic Interactive Transaction Widget Section */}
            <div className="bg-neutral-50/50 border border-neutral-150 p-6 rounded-[2rem] space-y-6">
              {/* Tabs selector */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-100 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setActiveActionTab('checkout')}
                  className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeActionTab === 'checkout' 
                      ? 'bg-white text-[#ff4f3a] shadow-sm' 
                      : 'text-neutral-505 hover:text-neutral-905'
                  }`}
                >
                  {isRentalOffer ? '🔒 Secure Hold Rent' : '🛒 Buy Outright'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveActionTab('enquiry')}
                  className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    activeActionTab === 'enquiry' 
                      ? 'bg-white text-[#ff4f3a] shadow-sm' 
                      : 'text-neutral-505 hover:text-neutral-905'
                  }`}
                >
                  💬 Send Enquiry
                </button>
              </div>

              {/* ACTION TAB 1: Checkout Form */}
              {activeActionTab === 'checkout' && (
                <div className="space-y-4">
                  {/* Auth Shield conditional logic rendering */}
                  {!currentUser ? (
                    <div className="p-6 bg-white border border-neutral-200/60 rounded-[1.5rem] shadow-sm space-y-4 text-center">
                      <div className="w-12 h-12 bg-[#ff4f3a]/10 text-[#ff4f3a] rounded-full flex items-center justify-center mx-auto">
                        <Lock size={20} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-extrabold uppercase text-xs tracking-wider text-neutral-800">Operator Authentication Required</h4>
                        <p className="text-[11px] text-neutral-500 max-w-xs mx-auto">Please sign-in or create a packer identity below to unlock booking schedules and contract checkout triggers.</p>
                      </div>

                      {/* Guest Sign-in Signup Sub-Toggles */}
                      <div className="flex justify-center border-b border-neutral-100 pb-3 gap-4">
                        <button 
                          onClick={() => setAuthTab('signin')} 
                          className={`text-[10px] font-black uppercase tracking-widest ${authTab === 'signin' ? 'text-[#ff4f3a] border-b-2 border-[#ff4f3a]' : 'text-neutral-400'}`}
                        >
                          Sign In
                        </button>
                        <button 
                          onClick={() => setAuthTab('register')} 
                          className={`text-[10px] font-black uppercase tracking-widest ${authTab === 'register' ? 'text-[#ff4f3a] border-b-2 border-[#ff4f3a]' : 'text-neutral-400'}`}
                        >
                          Create Account
                        </button>
                      </div>

                      <form onSubmit={handleInlineAuth} className="space-y-3 text-left">
                        {authTab === 'register' && (
                          <div className="space-y-1">
                            <label className="text-[8.5px] font-black uppercase tracking-widest text-neutral-400">Full Public Operator Name</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Epeli Qele"
                              value={authDisplayName}
                              onChange={(e) => setAuthDisplayName(e.target.value)}
                              className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold outline-none text-neutral-900"
                            />
                          </div>
                        )}

                        <div className="space-y-1">
                          <label className="text-[8.5px] font-black uppercase tracking-widest text-neutral-400">Operator Email Address</label>
                          <input
                            type="email"
                            required
                            placeholder="epeli@packertools.com"
                            value={authEmail}
                            onChange={(e) => setAuthEmail(e.target.value)}
                            className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold outline-none text-neutral-900"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[8.5px] font-black uppercase tracking-widest text-neutral-400">Access Key Password</label>
                          <input
                            type="password"
                            required
                            placeholder="••••••••"
                            value={authPassword}
                            onChange={(e) => setAuthPassword(e.target.value)}
                            className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold outline-none text-neutral-900 animate-none"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={authFormLoading}
                          className="w-full py-3 bg-[#ff4f3a] hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[10px] rounded-xl shadow transition flex items-center justify-center gap-2"
                        >
                          {authFormLoading ? 'Verifying Credentials...' : authTab === 'signin' ? 'Verify Sign-In Account' : 'Register Operator Card'}
                        </button>
                      </form>
                    </div>
                  ) : bookingSuccess ? (
                    <div className="p-6 bg-green-50/50 border border-green-200 rounded-2xl text-center space-y-3">
                      <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 size={24} />
                      </div>
                      <h4 className="font-extrabold uppercase text-xs tracking-wider text-green-800">Booking Reservation Held!</h4>
                      <p className="text-[11px] text-green-700">Digital escrow holds secured. The verified seller has been notified. Check your operational listing panel or mailbox for instructions.</p>
                      <button 
                        onClick={() => setBookingSuccess(false)}
                        className="text-[10px] font-black uppercase tracking-widest text-[#ff4f3a] hover:underline block mx-auto pt-2"
                      >
                        Secure another Hold
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSecureCheckout} className="space-y-4">
                      {/* Dates selections ONLY if rental */}
                      {isRentalOffer && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[8.5px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-1">
                              <Calendar size={11} /> Start Hire Date
                            </label>
                            <input
                              type="date"
                              required
                              value={bookingStartDate}
                              onChange={(e) => setBookingStartDate(e.target.value)}
                              className="w-full p-3 bg-white border border-neutral-200 rounded-xl text-xs font-bold outline-none text-neutral-900 font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8.5px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-1">
                              <Calendar size={11} /> End Hire Date
                            </label>
                            <input
                              type="date"
                              required
                              value={bookingEndDate}
                              onChange={(e) => setBookingEndDate(e.target.value)}
                              className="w-full p-3 bg-white border border-neutral-200 rounded-xl text-xs font-bold outline-none text-neutral-900 font-mono"
                            />
                          </div>
                        </div>
                      )}

                      {/* Personal Contact verify signoffs */}
                      <div className="p-4 bg-white border border-neutral-150 rounded-2xl space-y-3">
                        <span className="text-[8px] font-black uppercase tracking-widest text-neutral-400 block mb-1">Contractor Co-Signee Details</span>
                        
                        <div className="space-y-1">
                          <label className="text-[8.5px] font-black uppercase tracking-widest text-neutral-400">Co-Signee Legal Name</label>
                          <input
                            type="text"
                            required
                            placeholder="Epeli Qele"
                            value={bookingClientName}
                            onChange={(e) => setBookingClientName(e.target.value)}
                            className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold outline-none text-neutral-900"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[8.5px] font-black uppercase tracking-widest text-neutral-400">Contractor Email</label>
                            <input
                              type="email"
                              required
                              placeholder="epeli@gmail.com"
                              value={bookingClientEmail}
                              onChange={(e) => setBookingClientEmail(e.target.value)}
                              className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold outline-none text-neutral-900"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8.5px] font-black uppercase tracking-widest text-neutral-400">Operator Phone</label>
                            <input
                              type="text"
                              required
                              placeholder="+679 999 5555"
                              value={bookingClientPhone}
                              onChange={(e) => setBookingClientPhone(e.target.value)}
                              className="w-full p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold outline-none text-neutral-900"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Financial Quote breakdowns */}
                      {getCalculatedFees().subtotal > 0 && (
                        <div className="border border-neutral-100 p-4 rounded-xl bg-white space-y-2">
                          <span className="text-[8px] font-black uppercase tracking-widest text-neutral-400">Subtotal Hire Breakdown</span>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-neutral-500 font-medium">Daily Value Total:</span>
                            <span className="font-bold text-neutral-900 font-mono">{currencySymbol}{getCalculatedFees().subtotal}</span>
                          </div>
                          {isRentalOffer && (
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-neutral-500 font-medium">Full Comprehensive Waiver:</span>
                              <span className="font-bold text-neutral-900 font-mono">{currencySymbol}30</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-neutral-500 font-medium">Estimated tax ({getCalculatedFees().taxPercent}%):</span>
                            <span className="font-bold text-neutral-900 font-mono">{currencySymbol}{getCalculatedFees().taxAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs border-t border-neutral-100 pt-2">
                            <span className="text-neutral-800 font-extrabold uppercase tracking-tight">Est. Total:</span>
                            <span className="font-black text-md text-[#ff4f3a] font-mono">{currencySymbol}{getCalculatedFees().totalValue.toFixed(2)}</span>
                          </div>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={bookingLoading}
                        className="w-full py-4 bg-black hover:bg-neutral-900 text-white font-black uppercase tracking-widest text-[10px] rounded-[1.5rem] shadow-xl transition-all duration-300 flex items-center justify-center gap-2 group cursor-pointer"
                      >
                        {bookingLoading ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <span>{isRentalOffer ? '🔒 Secure Interactive Hold' : '🛒 Fast Buy Outright'}</span>
                            <ArrowRight size={13} className="group-hover:translate-x-1 transition-transform" />
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* ACTION TAB 2: Enquiry Form */}
              {activeActionTab === 'enquiry' && (
                <div className="space-y-4">
                  {enquirySuccess ? (
                    <div className="p-6 bg-amber-50 border border-amber-250 rounded-2xl text-center space-y-2">
                      <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                        <MessageSquare size={24} />
                      </div>
                      <h4 className="font-extrabold uppercase text-xs tracking-wider text-amber-800 font-black">Enquiry Sent!</h4>
                      <p className="text-[11px] text-amber-700">Your message was successfully transmitted to the verified vendor. We will alert you when a reply arrives.</p>
                      <button 
                        onClick={() => setEnquirySuccess(false)}
                        className="text-[10px] font-black uppercase tracking-widest text-[#ff4f3a] hover:underline block mx-auto pt-2"
                      >
                        Send another massage
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSendEnquiry} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[8.5px] font-black uppercase tracking-widest text-neutral-400">Message to merchant</label>
                        <textarea
                          rows={4}
                          required
                          value={enquiryMessage}
                          onChange={(e) => setEnquiryMessage(e.target.value)}
                          placeholder="Ask about rental slots, custom terms, pricing flexibility or pickup variations..."
                          className="w-full p-4 bg-white border border-neutral-200 rounded-2xl text-xs font-medium outline-none text-neutral-800 resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={enquiryLoading}
                        className="w-full py-4 bg-neutral-900 hover:bg-neutral-800 text-white font-black uppercase tracking-widest text-[10px] rounded-[1.5rem] transition shadow flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {enquiryLoading ? 'Dispatched hold...' : '💬 Send Enquiry Mailbox'}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Pane: Included Items List */}
        <div className="bg-[#1A1A1A] text-white p-6 md:p-12 lg:p-16 overflow-y-auto max-h-screen">
          <div className="max-w-xl mx-auto space-y-12">
            <header className="flex justify-between items-end border-b border-white/5 pb-6">
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tighter text-white">Included Items</h2>
                <p className="text-[10.5px] uppercase tracking-widest text-neutral-500 font-bold">{items.length} Fully cataloged kit pieces</p>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => {
                    navigator.share({
                      title: `${list.name} | Marketplace`,
                      text: list.marketplaceDetails || list.description,
                      url: window.location.href
                    }).catch(() => {
                      navigator.clipboard.writeText(window.location.href);
                      toast.success('Listing URL copied to clipboard!');
                    });
                  }}
                  className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition text-white/80 hover:text-white"
                  title="Share Item"
                >
                  <Share2 size={20} />
                </button>
                <div className="text-right">
                  <div className="text-[9px] font-black uppercase tracking-widest text-neutral-500 mb-0.5">Valuation</div>
                  <div className="text-2xl font-black font-sans tracking-tight">
                    {list.marketplacePrice ? `${currencySymbol}${list.marketplacePrice}` : 'N/A'}
                  </div>
                </div>
              </div>
            </header>

            {/* Render Visual Items Cards */}
            <div className="space-y-4">
              {items.map((item, index) => (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  key={item.id}
                  className="bg-white/5 border border-white/10 p-5 rounded-[2rem] flex items-center gap-6 hover:bg-white/10 transition-all group"
                >
                  <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0 border border-white/5">
                    {item.photoUrls?.[0] ? (
                      <img 
                        src={item.photoUrls[0]} 
                        alt={item.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Package size={28} className="text-white/20" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-extrabold uppercase tracking-tight text-md text-white truncate">{item.name}</h4>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-white/50 bg-white/5 px-2.5 py-1 rounded-md">
                        TAG: {item.assetTag || 'NO-TAG'}
                      </span>
                      {item.aiLabel && (
                        <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 bg-white/10 px-2 py-0.5 rounded-full">
                          {item.aiLabel}
                        </span>
                      )}
                    </div>
                    {item.relatedItemIds && item.relatedItemIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2.5 items-center">
                        <Link2 size={10} className="text-white/40" />
                        {item.relatedItemIds.map(relatedId => {
                          const relatedItem = items.find(i => i.id === relatedId);
                          if (!relatedItem) return null;
                          return (
                            <span 
                              key={relatedId}
                              className="text-[8.5px] font-bold uppercase tracking-widest text-white/60 bg-white/5 px-2 py-0.5 rounded-full border border-white/10"
                            >
                              {relatedItem.name}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className={`w-3 h-3 rounded-full ${
                      item.status === 'packed' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-neutral-600'
                    }`} />
                  </div>
                </motion.div>
              ))}
            </div>

            <footer className="pt-12 border-t border-white/10 text-center space-y-4">
              <p className="text-white/40 text-xs leading-relaxed max-w-sm mx-auto">
                This packing list is powered by <a href="https://packer.tools" target="_blank" rel="noopener noreferrer" className="text-white font-bold hover:underline">Packer Tools</a>. 
                Scan the QR code on the physical package to verify contents.
              </p>
              <div className="flex justify-center gap-3">
                <a 
                  href="https://packer.tools" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition text-white/60 hover:text-white"
                >
                  <ExternalLink size={18} />
                </a>
              </div>
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
}
