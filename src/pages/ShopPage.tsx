import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, PackingList } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Globe, 
  Mail, 
  Phone, 
  Twitter, 
  Instagram, 
  Linkedin, 
  Facebook, 
  MapPin, 
  Package, 
  Calendar, 
  ExternalLink, 
  ArrowLeft, 
  CheckCircle,
  Tag,
  DollarSign,
  Briefcase,
  Layers,
  Heart,
  Share2,
  Lock,
  Compass,
  MessageCircle,
  X,
  Copy
} from 'lucide-react';
import { toast } from 'sonner';

export default function ShopPage() {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const [shopOwner, setShopOwner] = useState<UserProfile | null>(null);
  const [listings, setListings] = useState<PackingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'rent' | 'sale'>('all');
  const [globalCurrency, setGlobalCurrency] = useState('USD');

  const getCurrencySymbol = (code: string | undefined): string => {
    if (!code) return '$';
    switch (code.toUpperCase()) {
      case 'FJD': return 'FJ$';
      case 'AUD': return 'A$';
      case 'NZD': return 'NZ$';
      case 'GBP': return '£';
      case 'CAD': return 'C$';
      case 'EUR': return '€';
      case 'USD': return '$';
      default: return code.length <= 3 ? `$ (${code})` : code;
    }
  };

  useEffect(() => {
    const fetchShopData = async () => {
      if (!uid) {
        setError("Invalid Shop URL");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // 1. Fetch global currency from admin settings
        try {
          const settingsDocSnap = await getDoc(doc(db, 'adminSettings', 'global'));
          if (settingsDocSnap.exists()) {
            const data = settingsDocSnap.data();
            if (data?.marketplaceRegionConfig?.defaultCurrency) {
              setGlobalCurrency(data.marketplaceRegionConfig.defaultCurrency);
            }
          }
        } catch (settingsError) {
          console.error("ShopPage: Error loading global settings currency:", settingsError);
        }

        // 2. Fetch user profile
        const userDocSnap = await getDoc(doc(db, 'users', uid));
        if (!userDocSnap.exists()) {
          setError("This shopfront does not exist or has been disabled.");
          setLoading(false);
          return;
        }

        const userData = { uid: userDocSnap.id, ...userDocSnap.data() } as UserProfile;
        setShopOwner(userData);

        // 3. Fetch all marketplace listings of this user
        const listingsQuery = query(
          collection(db, 'packingLists'),
          where('ownerId', '==', uid),
          where('marketplaceEnabled', '==', true)
        );
        const listingsSnap = await getDocs(listingsQuery);
        const listingsData = listingsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as PackingList[];

        setListings(listingsData);
        setLoading(false);
      } catch (err) {
        console.error("Error loading shop data:", err);
        setError("Failed to initialize this shopfront.");
        setLoading(false);
      }
    };

    fetchShopData();
  }, [uid]);

  const handleShareShop = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Shop Link copied to clipboard!");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F4]">
        <div className="w-12 h-12 border-4 border-[#ff4f3a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !shopOwner) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F4] p-6 text-center">
        <div className="w-20 h-20 bg-rose-50 border border-rose-200 text-rose-500 rounded-full flex items-center justify-center mb-6">
          <Lock size={32} />
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-neutral-900 leading-none mb-2">Shopfront Unavailable</h1>
        <p className="text-neutral-500 max-w-sm mb-8 font-medium">{error || "Could not retrieve user store profile"}</p>
        <button 
          onClick={() => navigate('/marketplace')}
          className="px-6 py-3 bg-neutral-900 text-white rounded-full font-black text-xs uppercase tracking-widest hover:bg-neutral-800 transition"
        >
          Return to Marketplace
        </button>
      </div>
    );
  }

  // Default images if not populated
  const defaultCover = "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=1200";
  const defaultLogo = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(shopOwner.storeName || shopOwner.displayName)}`;

  const activeCover = shopOwner.storeCoverImage || defaultCover;
  const activeLogo = shopOwner.storeLogo || shopOwner.photoURL || defaultLogo;

  const filteredListings = listings.filter(item => {
    if (filterType === 'all') return true;
    if (filterType === 'rent') return item.transactionType?.toLowerCase() === 'rental' || item.transactionType?.toLowerCase() === 'rent';
    if (filterType === 'sale') return item.transactionType?.toLowerCase() === 'sale';
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F5F5F4] text-neutral-900 font-sans pb-24">
      {/* Cover Image Header */}
      <div className="relative h-64 sm:h-80 w-full overflow-hidden border-b border-neutral-200">
        <img 
          src={activeCover} 
          alt={`${shopOwner.storeName || shopOwner.displayName} Cover`}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/60 via-transparent to-transparent" />
        
        {/* Back Link */}
        <div className="absolute top-6 left-6 z-10">
          <Link
            to="/marketplace"
            className="flex items-center gap-2 bg-white/90 hover:bg-white text-neutral-900 font-black text-[10px] tracking-widest uppercase px-4 py-2.5 rounded-full shadow-lg transition active:scale-95 border border-neutral-100"
          >
            <ArrowLeft size={12} />
            <span>Marketplace</span>
          </Link>
        </div>

        {/* Share Button */}
        <div className="absolute top-6 right-6 z-10">
          <button
            onClick={handleShareShop}
            className="flex items-center gap-2 bg-neutral-900/80 hover:bg-neutral-900 text-white font-black text-[10px] tracking-widest uppercase px-4 py-2.5 rounded-full shadow-lg transition active:scale-95 border border-neutral-800"
          >
            <Share2 size={12} />
            <span>Share Shop</span>
          </button>
        </div>
      </div>

      {/* Profile & Shop Info Container */}
      <div className="max-w-6xl mx-auto px-4 -mt-16 sm:-mt-20 relative z-20 space-y-8">
        {/* Main Info Card */}
        <div className="bg-white rounded-3xl border border-neutral-100 shadow-xl p-6 sm:p-10 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            {/* Logo, Name and Bio */}
            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
              <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl overflow-hidden border-4 border-white shadow-md bg-neutral-50 shrink-0">
                <img 
                  src={activeLogo} 
                  alt={shopOwner.storeName || shopOwner.displayName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3.5xl font-black uppercase tracking-tight text-neutral-900 leading-none">
                    {shopOwner.storeName || shopOwner.displayName || "Elite Gear Hub"}
                  </h1>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-[#ff4f3a]/10 border border-[#ff4f3a]/20 text-[#ff4f3a] text-[8px] font-black uppercase tracking-widest rounded-full leading-none">
                    <CheckCircle size={10} className="stroke-[3]" />
                    Verified Store
                  </span>
                </div>
                
                {shopOwner.storeBio ? (
                  <p className="text-neutral-500 font-medium text-xs sm:text-sm max-w-2xl leading-relaxed">
                    {shopOwner.storeBio}
                  </p>
                ) : (
                  <p className="text-neutral-400 italic text-xs">
                    Professional rental partner listed via Packer network. Direct checkout available.
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs font-semibold text-neutral-400">
                  {shopOwner.location && (
                    <div className="flex items-center gap-1.5">
                      <MapPin size={14} className="text-neutral-400" />
                      <span>{shopOwner.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Calendar size={14} />
                    <span>Member since {shopOwner.createdAt ? new Date(shopOwner.createdAt).getFullYear() : '2026'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Package size={14} />
                    <span>{listings.length} Active Listings</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Inquire Instant Button */}
            <div className="w-full sm:w-auto shrink-0 self-stretch sm:self-auto flex items-end sm:items-center">
              <button 
                type="button"
                onClick={() => setIsContactModalOpen(true)}
                className="w-full sm:w-auto text-center px-8 py-4 bg-[#ff4f3a] text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-[#e03d28] transition shadow-lg active:scale-95 whitespace-nowrap block cursor-pointer"
              >
                Inquire Directly
              </button>
            </div>
          </div>

          {/* Socials & Connect Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-6 border-t border-neutral-100">
            {/* Website */}
            <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/50 flex items-center justify-between group">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-neutral-100 text-neutral-600 rounded-xl flex items-center justify-center shrink-0">
                  <Globe size={16} />
                </div>
                <div className="min-w-0">
                  <span className="text-[8px] font-black uppercase tracking-widest text-neutral-400 block">Website</span>
                  {shopOwner.storeWebsite || shopOwner.website ? (
                    <a 
                      href={shopOwner.storeWebsite || shopOwner.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-bold text-xs text-neutral-700 hover:text-[#ff4f3a] transition truncate block"
                    >
                      {(shopOwner.storeWebsite || shopOwner.website)?.replace(/^https?:\/\/(www\.)?/, '')}
                    </a>
                  ) : (
                    <span className="text-neutral-400 text-xs italic">Not configured</span>
                  )}
                </div>
              </div>
              {(shopOwner.storeWebsite || shopOwner.website) && (
                <ExternalLink size={12} className="text-neutral-300 group-hover:text-neutral-500 transition shrink-0" />
              )}
            </div>

            {/* Email */}
            <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/50 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-neutral-100 text-neutral-600 rounded-xl flex items-center justify-center shrink-0">
                  <Mail size={16} />
                </div>
                <div className="min-w-0">
                  <span className="text-[8px] font-black uppercase tracking-widest text-neutral-400 block">Direct Email</span>
                  <a 
                    href={`mailto:${shopOwner.storeEmail || shopOwner.email}`}
                    className="font-bold text-xs text-neutral-700 hover:text-[#ff4f3a] transition truncate block"
                  >
                    {shopOwner.storeEmail || shopOwner.email || "No email listed"}
                  </a>
                </div>
              </div>
            </div>

            {/* Phone */}
            <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/50 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-neutral-100 text-neutral-600 rounded-xl flex items-center justify-center shrink-0">
                  <Phone size={16} />
                </div>
                <div className="min-w-0">
                  <span className="text-[8px] font-black uppercase tracking-widest text-neutral-400 block">Support Call</span>
                  {shopOwner.storePhone ? (
                    <a 
                      href={`tel:${shopOwner.storePhone}`} 
                      className="font-bold text-xs text-neutral-700 hover:text-[#ff4f3a] transition block"
                    >
                      {shopOwner.storePhone}
                    </a>
                  ) : (
                    <span className="text-neutral-400 text-xs italic">Not configured</span>
                  )}
                </div>
              </div>
            </div>

            {/* Social Channels Icons Row Block */}
            <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/50 flex items-center gap-3">
              <div className="w-9 h-9 bg-neutral-100 text-neutral-600 rounded-xl flex items-center justify-center shrink-0">
                <Compass size={16} />
              </div>
              <div className="flex-1">
                <span className="text-[8px] font-black uppercase tracking-widest text-neutral-400 block mb-1">Social Connect</span>
                <div className="flex items-center gap-2">
                  {shopOwner.storeTwitter ? (
                    <a 
                      href={`https://twitter.com/${shopOwner.storeTwitter.replace('@', '')}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-1 text-neutral-400 hover:text-neutral-900 hover:scale-110 transition"
                      title="Twitter / X"
                    >
                      <Twitter size={15} />
                    </a>
                  ) : null}

                  {shopOwner.storeInstagram ? (
                    <a 
                      href={`https://instagram.com/${shopOwner.storeInstagram.replace('@', '')}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-1 text-neutral-400 hover:text-neutral-900 hover:scale-110 transition"
                      title="Instagram"
                    >
                      <Instagram size={15} />
                    </a>
                  ) : null}

                  {shopOwner.storeLinkedin ? (
                    <a 
                      href={shopOwner.storeLinkedin.startsWith('http') ? shopOwner.storeLinkedin : `https://linkedin.com/in/${shopOwner.storeLinkedin}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-1 text-neutral-400 hover:text-neutral-900 hover:scale-110 transition"
                      title="LinkedIn"
                    >
                      <Linkedin size={15} />
                    </a>
                  ) : null}

                  {shopOwner.storeFacebook ? (
                    <a 
                      href={shopOwner.storeFacebook.startsWith('http') ? shopOwner.storeFacebook : `https://facebook.com/${shopOwner.storeFacebook}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-1 text-neutral-400 hover:text-neutral-900 hover:scale-110 transition"
                      title="Facebook"
                    >
                      <Facebook size={15} />
                    </a>
                  ) : null}

                  {!shopOwner.storeTwitter && !shopOwner.storeInstagram && !shopOwner.storeLinkedin && !shopOwner.storeFacebook && (
                    <span className="text-[10px] text-neutral-400 font-semibold italic">No social handles linked</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Listings Section */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-neutral-800">
                Active Listings Shelf
              </h2>
              <p className="text-xs text-neutral-500 font-medium">Browse verified assets published live by this organization.</p>
            </div>

            {/* Filter buttons */}
            <div className="flex bg-neutral-200/50 p-1 rounded-xl w-fit shrink-0 border border-neutral-250">
              <button 
                onClick={() => setFilterType('all')}
                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition ${filterType === 'all' ? 'bg-white text-neutral-920 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}
              >
                All ({listings.length})
              </button>
              <button 
                onClick={() => setFilterType('rent')}
                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition ${filterType === 'rent' ? 'bg-white text-neutral-920 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}
              >
                Rentals ({listings.filter(i => i.transactionType?.toLowerCase() === 'rental' || i.transactionType?.toLowerCase() === 'rent').length})
              </button>
              <button 
                onClick={() => setFilterType('sale')}
                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition ${filterType === 'sale' ? 'bg-white text-neutral-920 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}
              >
                For Sale ({listings.filter(i => i.transactionType?.toLowerCase() === 'sale').length})
              </button>
            </div>
          </div>

          {/* Grid View Of Items */}
          {filteredListings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredListings.map((item) => (
                <div 
                  key={item.id} 
                  className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden flex flex-col justify-between group hover:shadow-md hover:border-neutral-200 transition"
                >
                  <div className="p-6 space-y-4">
                    {/* Badge and Title */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2.5 py-1 text-[8px] font-black uppercase tracking-wider rounded-md leading-none ${
                        item.transactionType?.toLowerCase() === 'sale' ? 'bg-green-100 text-green-700 border border-green-200/40' : 'bg-blue-105 text-blue-600 border border-blue-200/40'
                      }`}>
                        {item.transactionType || "Rental"}
                      </span>
                      <span className="text-[10px] font-bold text-neutral-400 capitalize">
                        {item.category?.replace('-', ' ') || 'Production'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h3 className="font-extrabold text-base text-neutral-800 group-hover:text-[#ff4f3a] transition line-clamp-2 uppercase tracking-tight">
                        {item.name}
                      </h3>
                      <p className="text-xs text-neutral-400 font-medium line-clamp-2">
                        {item.description || "No description provided for index registry."}
                      </p>
                    </div>

                    {/* Pricing Display */}
                    <div className="pt-2 flex items-baseline justify-between">
                      <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Rate</span>
                      <span className="text-2xl font-black text-neutral-900">
                        {item.marketplacePrice ? `${getCurrencySymbol(item.marketplaceCurrency || globalCurrency)}${item.marketplacePrice}` : 'Free'}
                        <span className="text-[10px] font-bold text-neutral-400 lowercase font-mono">
                          {item.transactionType?.toLowerCase() === 'sale' ? '' : '/day'}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* View Details Button */}
                  <div className="px-6 pb-6 pt-2 border-t border-neutral-50 bg-neutral-50/50">
                    <button
                      onClick={() => navigate(`/marketplace/view/${item.id}`)}
                      className="w-full py-3 bg-neutral-900 text-white rounded-xl text-center font-black text-[10px] tracking-widest uppercase transition-colors group-hover:bg-[#ff4f3a]"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-16 text-center border border-neutral-100">
              <div className="w-16 h-16 rounded-full bg-neutral-50 border border-neutral-150 flex items-center justify-center mx-auto mb-4 text-neutral-400">
                <BoxIcon />
              </div>
              <h3 className="text-lg font-extrabold text-neutral-800 uppercase tracking-tight">No Items Found</h3>
              <p className="text-neutral-400 text-xs mt-1">This user doesn't have any items matching your selected filter.</p>
            </div>
          )}
        </div>
      </div>

      {/* Contact Options Card Modal */}
      <AnimatePresence>
        {isContactModalOpen && (
          <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white p-8 sm:p-10 rounded-[3rem] shadow-2xl w-full max-w-md space-y-8 text-neutral-900 border border-neutral-100"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-2xl font-black uppercase tracking-tighter">Contact Inquiries</h3>
                  <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Reach out to {shopOwner.storeName || shopOwner.displayName}</p>
                </div>
                <button 
                  onClick={() => setIsContactModalOpen(false)}
                  className="p-2 sm:p-3 hover:bg-neutral-50 rounded-full transition text-neutral-400 hover:text-neutral-900"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                {/* 1. WhatsApp Action */}
                {shopOwner.storePhone ? (
                  <a
                    href={`https://wa.me/${shopOwner.storePhone.replace(/[^0-9]/g, '')}?text=Hi%20there!%20I%20saw%20your%2520gear%20listings%20on%20Packer%20Tools%20and%2520wanted%20to%20inquire.`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-5 bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-100 rounded-2xl group transition"
                  >
                    <div className="w-12 h-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/10">
                      <MessageCircle size={22} />
                    </div>
                    <div className="flex-1 text-left">
                      <span className="text-[8px] font-black tracking-widest uppercase text-emerald-600 block">WhatsApp Chat</span>
                      <span className="font-extrabold text-neutral-800 text-sm">Send Instant Message</span>
                    </div>
                    <ExternalLink size={16} className="text-emerald-400 group-hover:translate-x-0.5 transition" />
                  </a>
                ) : null}

                {/* 2. Direct Email Action */}
                <div className="flex items-center gap-4 p-5 bg-rose-50/30 hover:bg-rose-50/70 border border-rose-100 rounded-2xl group transition relative">
                  <a
                    href={`mailto:${shopOwner.storeEmail || shopOwner.email}`}
                    className="absolute inset-0 z-0"
                  />
                  <div className="w-12 h-12 bg-[#ff4f3a] text-white rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-rose-500/10 z-10">
                    <Mail size={22} />
                  </div>
                  <div className="flex-1 text-left z-10">
                    <span className="text-[8px] font-black tracking-widest uppercase text-[#ff4f3a] block">Email Inbox</span>
                    <span className="font-extrabold text-neutral-800 text-xs truncate block max-w-[180px]">{shopOwner.storeEmail || shopOwner.email || "No email listed"}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(shopOwner.storeEmail || shopOwner.email || '');
                      toast.success("Email copied to clipboard!");
                    }}
                    className="p-2 hover:bg-white text-neutral-400 hover:text-neutral-600 rounded-lg transition z-20"
                    title="Copy Email Address"
                  >
                    <Copy size={16} />
                  </button>
                </div>

                {/* 3. Direct Phone Call Action */}
                {(shopOwner.storePhone) ? (
                  <div className="flex items-center gap-4 p-5 bg-neutral-50 hover:bg-neutral-100/70 border border-neutral-200/50 rounded-2xl group transition relative">
                    <a
                      href={`tel:${shopOwner.storePhone}`}
                      className="absolute inset-0 z-0"
                    />
                    <div className="w-12 h-12 bg-neutral-900 text-white rounded-xl flex items-center justify-center shrink-0 shadow-md z-10">
                      <Phone size={22} />
                    </div>
                    <div className="flex-1 text-left z-10">
                      <span className="text-[8px] font-black tracking-widest uppercase text-neutral-500 block">Phone call</span>
                      <span className="font-extrabold text-neutral-800 text-sm truncate block max-w-[180px]">{shopOwner.storePhone}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(shopOwner.storePhone || '');
                        toast.success("Phone number copied to clipboard!");
                      }}
                      className="p-2 hover:bg-white text-neutral-400 hover:text-neutral-600 rounded-lg transition z-20"
                      title="Copy Phone Number"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                ) : null}
              </div>

              <p className="text-[8.5px] uppercase font-bold tracking-tight text-neutral-400 italic text-center">
                * Please state that you found their inventory on Packer Tools when contacting.
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Simple placeholder icon
function BoxIcon() {
  return (
    <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}
