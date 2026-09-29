import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { hapticLight } from '../utils/haptics';

const triggerHaptic = () => {
  hapticLight();
};
import { UserProfile, AdminSettings } from '../types';
import { useAuth } from '../providers/AuthProvider';
import { db, handleFirestoreError, OperationType, signInWithGoogle } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, getDocs } from 'firebase/firestore';
import PackerLogo from '../components/PackerLogo';
import { computeDeposit } from '../booking/depositPolicy';
import '../booking/booking.css';
import '../marketplace/brand.css';
import { useLandingFonts } from '../components/landing/useLandingFonts';
import PickupDropoffWidget, { PickupDropoffState } from '../components/PickupDropoffWidget';
import { 
  Search, 
  MapPin, 
  SlidersHorizontal, 
  X, 
  ChevronRight, 
  Star, 
  Calendar, 
  Check, 
  UserCheck, 
  DollarSign, 
  ShoppingBag, 
  Flame, 
  HelpCircle, 
  Info, 
  Play, 
  Tv, 
  ArrowRight, 
  CheckCircle2, 
  Heart,
  ShieldAlert,
  ChevronLeft,
  Mail,
  Camera,
  Map,
  Filter,
  Globe,
  Hammer,
  Wrench,
  Package,
  LayoutGrid,
  List,
  ArrowUpDown,
  Plus,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

// High-quality mock data mimicking a professional gear marketplace layout
interface CategoryItem {
  id: string;
  name: string;
  count: number;
  image: string;
}

interface ProductItem {
  id: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviews: number;
  image: string;
  ownerName?: string;
  ownerId?: string;
  ownerRating?: number;
  instantBook?: boolean;
  shippingDays?: number;
  isShipped?: boolean;
  isSale?: boolean;
  industry?: string;
  sponsored?: boolean;
  featured?: boolean;
  featuredPriority?: number;
  isUserListing?: boolean;
  securityDeposit?: number;
  pickupType?: 'preset' | 'custom';
  pickupLocationId?: string;
  pickupCustomAddress?: string;
  dropoffType?: 'preset' | 'custom';
  dropoffLocationId?: string;
  dropoffCustomAddress?: string;
  addOns?: Array<{
    itemId?: string;
    name: string;
    price: number;
    useDefaultPrice?: boolean;
    type?: 'Organizer' | 'Accessory' | 'Consumable' | 'Attachment' | 'Add On' | 'Software' | 'Mod' | 'Other';
    notes?: string;
  }>;
}

interface CrewItem {
  id: string;
  name: string;
  title: string;
  rating: number;
  reviews: number;
  image: string;
  skills: string[];
  bio: string;
  videoUrl?: string;
  isVerified?: boolean;
}

const CATEGORIES: CategoryItem[] = [
  { id: 'cinema-cameras', name: 'Cinema Cameras', count: 0, image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=400' },
  { id: 'cinema-lenses', name: 'Cinema Lenses', count: 0, image: 'https://images.unsplash.com/photo-1617005082133-5c8cdd97eadd?auto=format&fit=crop&q=80&w=400' },
  { id: 'photography-lenses', name: 'Photography Lenses', count: 0, image: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&q=80&w=400' },
  { id: 'still-hybrid', name: 'Still / Hybrid Cameras', count: 0, image: 'https://images.unsplash.com/photo-1495707902641-75cac588d2e9?auto=format&fit=crop&q=80&w=400' },
  { id: 'lighting-electric', name: 'Lighting / Electric', count: 0, image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=400' },
  { id: 'audio', name: 'Audio Gear', count: 0, image: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&q=80&w=400' },
  { id: 'ge-packages', name: 'G&E Packages', count: 0, image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&q=80&w=400' },
];

const POPULAR_PRODUCTS: ProductItem[] = [];

const SHIPPED_PRODUCTS: ProductItem[] = [];

const SALES_PRODUCTS: ProductItem[] = [];

const CREW_LIST: CrewItem[] = [];

const STAFF_PICKS: ProductItem[] = [];

const INDUSTRIES_MARKET = [
  { id: 'all', name: 'View All Industries', description: 'Explore items globally' },
  { id: 'production', name: 'Pro AV & Cinema', description: 'Cameras, Sound, and G&E Kits' },
  { id: 'construction', name: 'Heavy Construction', description: 'Excavators, Drills, and Hoists' },
  { id: 'automotive', name: 'Automotive & Garage', description: 'Lift Jacks, diagnostics, wrenches' },
  { id: 'medical', name: 'Medical Devices', description: 'ECG Monitors, Ultrasounds, and Lab kits' },
  { id: 'general_logistics', name: 'Warehouse Logistics', description: 'Forklifts, Hand Trucks, and Flight trunks' },
  { id: 'sports', name: 'Sports & Teams Training', description: 'Jerseys, helmets, training cones & goalie kits' }
];

const EXTRA_CATEGORIES: CategoryItem[] = [
  // Construction
  { id: 'heavy-machinery', name: 'Heavy Machinery & Cranes', count: 0, image: 'https://images.unsplash.com/photo-1579684389781-71fa80d34154?auto=format&fit=crop&q=80&w=400' },
  { id: 'power-tools', name: 'Industrial Power Tools', count: 0, image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&q=80&w=400' },
  { id: 'site-scaffolding', name: 'Hoists & Scaffold Systems', count: 0, image: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&q=80&w=400' },
  { id: 'welding-assemblies', name: 'Welding & Arc Outfits', count: 0, image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80&w=400' },

  // Automotive
  { id: 'diagnostics', name: 'Garages & Calibration Diagnostics', count: 0, image: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&q=80&w=400' },
  { id: 'lifting-jacks', name: 'Pneumatic Lifting Jacks & Ramps', count: 0, image: 'https://images.unsplash.com/photo-1530047625168-4b18df2df4f6?auto=format&fit=crop&q=80&w=400' },
  { id: 'power-air-tools', name: 'Air Compressors & Impact Tools', count: 0, image: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?auto=format&fit=crop&q=80&w=400' },
  { id: 'mechanical-handtools', name: 'Heavy Wrench & Storage Cabinets', count: 0, image: 'https://images.unsplash.com/photo-1534224039826-c7a0eda0e6b3?auto=format&fit=crop&q=80&w=400' },

  // Medical
  { id: 'imaging', name: 'Medical Ultrasound & Scopes', count: 0, image: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=400' },
  { id: 'patient-monitors', name: 'Care Vitals & ECG Monitors', count: 0, image: 'https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&q=80&w=400' },
  { id: 'clinical-pipettes', name: 'Lab Clinical Micropipettes', count: 0, image: 'https://images.unsplash.com/photo-1579154204601-01588f351167?auto=format&fit=crop&q=80&w=400' },
  { id: 'surgical-support', name: 'Minor Surgical Light & Otoscopes', count: 0, image: 'https://images.unsplash.com/photo-1584515901307-a5418eb66a8a?auto=format&fit=crop&q=80&w=400' },

  // General logistics
  { id: 'warehouse-logistics', name: 'Propane Forklifts & Shifters', count: 0, image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=400' },
  { id: 'platform-carts', name: 'High Capacity Flatbed Dollies', count: 0, image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&q=80&w=400' },
  { id: 'flight-cases', name: 'Flight Cases & G&E Pack Trunks', count: 0, image: 'https://images.unsplash.com/photo-1601042879364-f3947d3f9c16?auto=format&fit=crop&q=80&w=400' },

  // Sports
  { id: 'sports-kits', name: 'Team Sports Kits & Gear', count: 0, image: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&q=80&w=400' },
  { id: 'jerseys-protective', name: 'Jerseys & Protective Helmets', count: 0, image: 'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?auto=format&fit=crop&q=80&w=400' },
  { id: 'training-accessories', name: 'Cones, Whistles & Hurdles', count: 0, image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&q=80&w=400' }
];

const MULTI_INDUSTRY_PRODUCTS: ProductItem[] = [];

interface MarketplaceProps {
  user?: UserProfile | null;
  adminSettings?: AdminSettings | null;
}

export default function Marketplace({ user, adminSettings }: MarketplaceProps = {}) {
  useLandingFonts();
  const navigate = useNavigate();
  const { formatCurrency, convertCurrency, selectedCurrency } = useAuth();
  const [currentMode, setCurrentMode] = useState<'rent' | 'buy'>('rent');
  const [searchQuery, setSearchQuery] = useState('');
  const [userListings, setUserListings] = useState<any[]>([]);
  const [dbCategories, setDbCategories] = useState<any[]>([]);
  const [dbBrands, setDbBrands] = useState<any[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'marketplaceBrands'), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || '',
        logo: doc.data().logo || '',
        description: doc.data().description || ''
      }));
      setDbBrands(docs);
    }, (error) => {
      console.warn('marketplaceBrands subscription skipped or failed:', error);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'marketplaceCategories'), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || '',
        image: doc.data().image || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&q=80&w=400',
        count: 0
      }));
      setDbCategories(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'marketplaceCategories');
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'packingLists'),
      where('marketplaceEnabled', '==', true)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbListings = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'Untitled List',
          brand: data.brand || 'Custom Bundle',
          model: data.model || 'Kit',
          category: data.category || 'cinema-cameras',
          price: Number(data.marketplacePrice || 0),
          originalPrice: data.originalPrice ? Number(data.originalPrice) : undefined,
          rating: 0,
          reviews: 0,
          image: data.image || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&q=80&w=400',
          ownerName: data.ownerEmail ? data.ownerEmail.split('@')[0] : 'Owner',
          ownerId: data.ownerId || '',
          ownerRating: 5.0,
          instantBook: true,
          isUserListing: true,
          isSale: data.transactionType === 'sale',
          featured: data.featured || false,
          sponsored: data.sponsored || false,
          adHeadline: data.adHeadline || '',
          moderationStatus: data.moderationStatus || 'approved',
          description: data.marketplaceDetails || data.description || '',
          securityDeposit: data.securityDeposit || 0,
          bookingClientName: data.bookingClientName || null,
          pickupType: data.pickupType || 'preset',
          pickupLocationId: data.pickupLocationId || '',
          pickupCustomAddress: data.pickupCustomAddress || '',
          dropoffType: data.dropoffType || 'preset',
          dropoffLocationId: data.dropoffLocationId || '',
          dropoffCustomAddress: data.dropoffCustomAddress || '',
          status: data.status || 'Active',
        };
      }).filter(item => item.moderationStatus !== 'suspended' && item.status !== 'Draft');
      setUserListings(dbListings);
      setLoadingListings(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'packingLists (marketplaceEnabled)');
      setLoadingListings(false);
    });
    return () => unsubscribe();
  }, []);

  const convertedUserListings = React.useMemo(() => {
    return userListings.map(listing => {
      const origCurrency = listing.currency || 'USD';
      return {
        ...listing,
        price: convertCurrency(listing.price, origCurrency, selectedCurrency),
        originalPrice: listing.originalPrice ? convertCurrency(listing.originalPrice, origCurrency, selectedCurrency) : undefined,
        securityDeposit: listing.securityDeposit ? convertCurrency(listing.securityDeposit, origCurrency, selectedCurrency) : undefined,
      };
    });
  }, [userListings, selectedCurrency, convertCurrency]);

  const launchCountry = adminSettings?.marketplaceRegionConfig?.launchCountry || 'Fiji';
  const availableCountries = adminSettings?.marketplaceRegionConfig?.availableCountries || ['Fiji', 'United States', 'Australia', 'New Zealand', 'United Kingdom', 'Canada'];
  const restrictToAvailableCountries = adminSettings?.marketplaceRegionConfig?.restrictToAvailableCountries || false;

  const landingConfig = adminSettings?.marketplaceLandingPageConfig || {};
  const heroTitle = landingConfig.heroTitle || 'Rent and buy production gear';
  const heroSubtitle = landingConfig.heroSubtitle || 'Packer marketplace';
  const heroDescription = landingConfig.heroDescription || 'Professional visual equipment for hire and purchase, listed by production companies and rental houses.';
  // Promotion banners are admin-configured only. There are no default offers: nothing is shown until a title is set.
  const bannerATitle = landingConfig.bannerATitle || '';
  const bannerASubtitle = landingConfig.bannerASubtitle || '';
  const bannerAButtonText = landingConfig.bannerAButtonText || 'Learn more';
  const bannerAImage = landingConfig.bannerAImage || '';
  const bannerBTitle = landingConfig.bannerBTitle || '';
  const bannerBSubtitle = landingConfig.bannerBSubtitle || '';
  const bannerBButtonText = landingConfig.bannerBButtonText || 'Learn more';
  const bannerBImage = landingConfig.bannerBImage || '';
  const showPromotions = landingConfig.showPromotions !== false && !!(bannerATitle || bannerBTitle);
  const showStaffPicks = landingConfig.showStaffPicks !== false;
  const showFeatured = landingConfig.showFeatured !== false;
  const showShippedToYou = landingConfig.showShippedToYou !== false;
  const showLatestGear = landingConfig.showLatestGear !== false;
  const showPopularItems = landingConfig.showPopularItems !== false;
  const showCategories = landingConfig.showCategories !== false;
  const showGuarantees = landingConfig.showGuarantees !== false;
  const requiresEduVerification = landingConfig.requiresEduVerification !== false;

  const activeCountry = user?.country || launchCountry || 'Fiji';
  const isFiji = activeCountry === 'Fiji';

  const isAuthorized = user?.country 
    ? availableCountries.includes(user.country)
    : true;

  const [locationQuery, setLocationQuery] = useState(user?.location || (isFiji ? 'Suva, Fiji' : 'Los Angeles, CA'));

  useEffect(() => {
    if (user?.location) {
      setLocationQuery(user.location);
    } else if (isFiji) {
      setLocationQuery('Suva, Fiji');
    } else {
      setLocationQuery('Los Angeles, CA');
    }
  }, [isFiji, user?.location]);

  const defaultCurrency = adminSettings?.marketplaceRegionConfig?.defaultCurrency;
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
    currencySymbol = isFiji ? 'FJ$' : '$';
  }


  const [isSearchDrawerOpen, setIsSearchDrawerOpen] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullProgress, setPullProgress] = useState(0);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [isPulling, setIsPulling] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const toastId = toast.loading("Synchronizing Marketplace catalog...");
    try {
      await getDocs(collection(db, 'listings'));
      toast.success("Synchronized: Marketplace listings up-to-date!", { id: toastId });
    } catch (err) {
      console.warn("Pull-to-refresh sync failed:", err);
      toast.error("Synchronization failed.", { id: toastId });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setTouchStartY(e.touches[0].pageY);
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling || touchStartY === null || window.scrollY > 0) return;
    const currentY = e.touches[0].pageY;
    const diffY = currentY - touchStartY;
    if (diffY > 0) {
      const progress = Math.min((diffY / 120) * 100, 100);
      setPullProgress(progress);
    } else {
      setPullProgress(0);
    }
  };

  const handleTouchEnd = () => {
    if (isPulling) {
      if (pullProgress >= 85) {
        handleRefresh();
      }
      setIsPulling(false);
      setTouchStartY(null);
      setPullProgress(0);
    }
  };
  
  // Filtering & Modal parameters
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedIndustry, setSelectedIndustry] = useState<string>('all');
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [selectedLensType, setSelectedLensType] = useState<string | null>(null);
  const [selectedLensMount, setSelectedLensMount] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>('default');
  const [viewType, setViewType] = useState<'grid' | 'list'>('grid');
  const [favoriteItems, setFavoriteItems] = useState<Set<string>>(new Set());
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [selectedCrew, setSelectedCrew] = useState<CrewItem | null>(null);
  
  // Custom interactive flow state
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingDays, setBookingDays] = useState(3);
  const [rentStartDate, setRentStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [rentEndDate, setRentEndDate] = useState(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [rentTime, setRentTime] = useState('09:00');
  const [selectedAddOns, setSelectedAddOns] = useState<Set<number>>(new Set());
  const [pickupDropoffState, setPickupDropoffState] = useState<PickupDropoffState | null>(null);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [crewMessageText, setCrewMessageText] = useState('');

  // List Your Gear State Management
  const [isListGearModalOpen, setIsListGearModalOpen] = useState(false);
  const [userOwnLists, setUserOwnLists] = useState<any[]>([]);
  const [userProjects, setUserProjects] = useState<any[]>([]);
  const [loadingListsAndProjects, setLoadingListsAndProjects] = useState(false);
  const [listingPriceMap, setListingPriceMap] = useState<{ [id: string]: number }>({});
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const handleOpenListGear = async () => {
    setIsListGearModalOpen(true);
    if (!user) return; // Unregistered doesn't need to load
    if (user.kycStatus !== 'verified') return; // Unverified doesn't need to load lists yet

    setLoadingListsAndProjects(true);
    try {
      // 1. Fetch Packing Lists
      const qLists = query(collection(db, 'packingLists'), where('ownerId', '==', user.uid));
      const snapLists = await getDocs(qLists);
      const listsData = snapLists.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUserOwnLists(listsData);

      // Initialize default pricing inputs for those lists
      const pMap: { [id: string]: number } = {};
      listsData.forEach((l: any) => {
        pMap[l.id] = Number(l.marketplacePrice || l.price || 150);
      });
      setListingPriceMap(pMap);

      // 2. Fetch Projects
      const qProjects = query(collection(db, 'projects'), where('ownerId', '==', user.uid));
      const snapProjects = await getDocs(qProjects);
      const projectsData = snapProjects.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUserProjects(projectsData);
    } catch (err) {
      console.error("Error loading user lists/projects:", err);
      toast.error("Could not load your lists and projects.");
    } finally {
      setLoadingListsAndProjects(false);
    }
  };

  const handleToggleMarketplace = async (listId: string, enabled: boolean) => {
    const specifiedPrice = listingPriceMap[listId] || 150;
    try {
      const listRef = doc(db, 'packingLists', listId);
      await updateDoc(listRef, {
        marketplaceEnabled: enabled,
        marketplacePrice: specifiedPrice,
        transactionType: 'rent',
        moderationStatus: 'approved'
      });
      toast.success(enabled ? `Listed on Marketplace for $${specifiedPrice}/day!` : "Removed from Marketplace.");
      
      setUserOwnLists(prev => prev.map(l => l.id === listId ? { ...l, marketplaceEnabled: enabled, marketplacePrice: specifiedPrice } : l));
    } catch (err) {
      console.error(err);
      toast.error("Could not update listing preference.");
    }
  };

  // Automatically calculate custom rental duration bookingDays based on selected dates
  useEffect(() => {
    try {
      const start = new Date(rentStartDate).getTime();
      const end = new Date(rentEndDate).getTime();
      const diffTime = end - start;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      // clamp to at least 1 day
      const daysCalculated = diffDays > 0 ? diffDays : 1;
      setBookingDays(daysCalculated);
    } catch (e) {
      setBookingDays(3);
    }
  }, [rentStartDate, rentEndDate]);
  
  // Categories reference carousel scroll indices
  const [categoryScrollIndex, setCategoryScrollIndex] = useState(0);

  // Search suggestions that appear dynamically as user types
  const popularKeywords = ['fx6', 'fx3', 'camera', 'sony fx6 full-frame cinema camera', 'sony fx3 full-frame cinema camera'];

  const calculateTaxAndTotal = () => {
    if (!selectedProduct) {
      return { subtotal: 0, taxAmount: 0, deposit: 0, totalQuote: 0, isInclusive: true, taxPercent: 0 };
    }
    
    const baseSubtotal = selectedProduct.price * (selectedProduct.isSale ? 1 : bookingDays);
    const addonsSum = Array.from(selectedAddOns).reduce((sum, idx) => {
      const addon = selectedProduct.addOns?.[idx];
      return sum + (addon?.price || 0);
    }, 0) * (selectedProduct.isSale ? 1 : bookingDays);
    const subtotal = baseSubtotal + addonsSum;
    
    // Packer Tools does not charge or hold this deposit; it's shown so the renter knows what the
    // owner will ask for, and the two arrange it directly.
    const deposit = selectedProduct.isSale ? 0 : computeDeposit(
      adminSettings?.moduleWidgetConfigs?.depositPolicy,
      selectedProduct.price,
      selectedProduct.securityDeposit
    );
    
    let taxPercent = 0;
    let isInclusive = true;
    
    if (isFiji) {
      taxPercent = adminSettings?.taxConfig?.fijiVatRate ?? 15;
      isInclusive = (adminSettings?.taxConfig?.fijiVatType || 'VIP') === 'VIP';
    } else {
      const internationalcfg = adminSettings?.taxConfig?.otherCountriesTaxRates?.[activeCountry] || { rate: 10, type: 'exclusive' };
      taxPercent = internationalcfg.rate;
      isInclusive = internationalcfg.type === 'inclusive';
    }
    
    let taxAmount = 0;
    let totalQuote = 0;
    
    if (isInclusive) {
      taxAmount = subtotal - (subtotal / (1 + (taxPercent / 100)));
      totalQuote = subtotal + deposit;
    } else {
      taxAmount = subtotal * (taxPercent / 100);
      totalQuote = subtotal + deposit + taxAmount;
    }
    
    return {
      subtotal,
      taxAmount,
      deposit,
      totalQuote,
      isInclusive,
      taxPercent
    };
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!isBookingModalOpen) {
      setSelectedAddOns(new Set());
    }
  }, [isBookingModalOpen]);

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const newFavs = new Set(favoriteItems);
    if (newFavs.has(id)) {
      newFavs.delete(id);
      toast.info('Removed from saved wishlist');
    } else {
      newFavs.add(id);
      toast.success('Added to saved wishlist!');
    }
    setFavoriteItems(newFavs);
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    try {
      const taxAndTotal = calculateTaxAndTotal();

      if (!user?.email) {
        toast.error('Add an email to your account before requesting a booking.');
        return;
      }

      if (selectedProduct.isUserListing) {
        // Real update to user packing list document to reflect the booking!
        const listRef = doc(db, 'packingLists', selectedProduct.id);
        await updateDoc(listRef, {
          bookingClientName: user.displayName || user.email.split('@')[0],
          bookingClientEmail: user.email,
          rentalStatus: 'awaiting_owner_confirmation',
          updatedAt: new Date().toISOString()
        });
      }

      // Also create a record in gearBookings collection for calendars/dashboards!
      const bookingData = {
        gearId: selectedProduct.id,
        gearName: selectedProduct.name,
        brand: selectedProduct.brand || '',
        ownerId: selectedProduct.ownerId || 'platform_admin',
        clientName: user.displayName || user.email.split('@')[0],
        clientEmail: user.email,
        clientPhone: (user as any)?.phone || '',
        startDate: rentStartDate,
        endDate: rentEndDate,
        depositAmount: taxAndTotal.deposit,
        paymentStatus: 'Awaiting owner confirmation',
        reservationType: selectedProduct.isSale ? 'custom' : 'deposit',
        customConditions: [],
        createdAt: new Date().toISOString(),
        totalPrice: taxAndTotal.totalQuote,
        taxAmount: taxAndTotal.taxAmount,
        deposit: taxAndTotal.deposit,
        taxPercent: taxAndTotal.taxPercent,
        isTaxInclusive: taxAndTotal.isInclusive,
        transactionType: selectedProduct.isSale ? 'sale' : 'rent',
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

      toast.success(`Booking request sent. Estimated total: ${currencySymbol}${taxAndTotal.totalQuote.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    } catch (error) {
      console.error("Error creating synced booking:", error);
      toast.error("Failed to complete marketplace booking sync.");
    } finally {
      setIsBookingModalOpen(false);
      setSelectedProduct(null);
      setPickupDropoffState(null);
    }
  };

  const handleMessageCrewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success(`Inquiry dispatched to ${selectedCrew?.name}! They average response time under 1 hour.`);
    setIsMessageModalOpen(false);
    setCrewMessageText('');
    setSelectedCrew(null);
  };

  // Dynamic categories and industry filter logic
  const activeIndustryFilter = (item: any) => {
    if (selectedIndustry === 'all') return true;
    const itemInd = item.industry || 'production';
    return itemInd === selectedIndustry;
  };

  const allRentals = convertedUserListings.filter(l => !l.isSale).filter(activeIndustryFilter);

  const allSales = convertedUserListings.filter(l => l.isSale).filter(activeIndustryFilter);

  const getCategoriesList = () => {
    const baseCats = dbCategories.length > 0 ? dbCategories : [...CATEGORIES, ...EXTRA_CATEGORIES];
    if (selectedIndustry === 'all') {
      return baseCats;
    } else if (selectedIndustry === 'production') {
      return baseCats.filter(c => ['cinema-cameras', 'cinema-lenses', 'photography-lenses', 'still-hybrid', 'lighting-electric', 'audio', 'ge-packages'].includes(c.id));
    } else {
      if (selectedIndustry === 'construction') {
        return baseCats.filter(c => ['heavy-machinery', 'power-tools', 'site-scaffolding', 'welding-assemblies'].includes(c.id));
      } else if (selectedIndustry === 'automotive') {
        return baseCats.filter(c => ['diagnostics', 'lifting-jacks', 'power-air-tools', 'mechanical-handtools'].includes(c.id));
      } else if (selectedIndustry === 'medical') {
        return baseCats.filter(c => ['imaging', 'patient-monitors', 'clinical-pipettes', 'surgical-support'].includes(c.id));
      } else if (selectedIndustry === 'general_logistics') {
        return baseCats.filter(c => ['warehouse-logistics', 'platform-carts', 'flight-cases'].includes(c.id));
      } else if (selectedIndustry === 'sports') {
        return baseCats.filter(c => ['sports-kits', 'jerseys-protective', 'training-accessories'].includes(c.id));
      }
      return baseCats;
    }
  };

  const activeCategories = getCategoriesList().map(c => ({
    ...c,
    count: convertedUserListings.filter(l => l.category === c.id).length
  }));

  const filteredProducts = (currentMode === 'rent' ? allRentals : allSales)
    .filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.model.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory ? item.category === selectedCategory : true;

      // Smart Brand Filter
      let matchesBrand = true;
      if (selectedBrandId) {
        const targetBrand = dbBrands.find(b => b.id === selectedBrandId);
        if (targetBrand) {
          const itemBrandLower = item.brand?.toLowerCase() || '';
          const targetBrandLower = targetBrand.name?.toLowerCase() || '';
          matchesBrand = itemBrandLower === targetBrandLower || itemBrandLower === selectedBrandId.toLowerCase();
        }
      }

      // Smart Lens Taxonomy filters
      let matchesLensSpec = true;
      if (selectedCategory === 'cinema-lenses' || selectedCategory === 'photography-lenses') {
        if (selectedLensType) {
          const itemLensType = (item.lensType || '').toLowerCase();
          const targetLensType = selectedLensType.toLowerCase();
          if (itemLensType !== targetLensType) {
            const nameLower = item.name.toLowerCase();
            const descLower = (item.description || '').toLowerCase();
            const matchesFuzzy = nameLower.includes(targetLensType) || descLower.includes(targetLensType);
            if (!matchesFuzzy) matchesLensSpec = false;
          }
        }
        if (selectedLensMount) {
          const itemLensMount = (item.lensMount || '').toLowerCase();
          const targetLensMount = selectedLensMount.toLowerCase();
          if (!itemLensMount.includes(targetLensMount)) {
            const nameLower = item.name.toLowerCase();
            const descLower = (item.description || '').toLowerCase();
            const matchesFuzzy = nameLower.includes(targetLensMount) || descLower.includes(targetLensMount);
            if (!matchesFuzzy) matchesLensSpec = false;
          }
        }
      }

      return matchesSearch && matchesCategory && matchesBrand && matchesLensSpec;
    })
    .sort((a: any, b: any) => {
      if (sortBy === 'price-asc') {
        return a.price - b.price;
      } else if (sortBy === 'price-desc') {
        return b.price - a.price;
      } else if (sortBy === 'rating') {
        return (b.rating || 0) - (a.rating || 0);
      } else if (sortBy === 'reviews') {
        return (b.reviews || 0) - (a.reviews || 0);
      }
      
      // Prioritize Sponsored Ads first, then Featured items, then custom priority sorting
      if (a.sponsored && !b.sponsored) return -1;
      if (!a.sponsored && b.sponsored) return 1;
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      const weightA = a.featuredPriority || 0;
      const weightB = b.featuredPriority || 0;
      return weightB - weightA;
    });

  const getShippedItems = () => {
    return convertedUserListings.filter(l => l.isShipped || l.shippingDays).slice(0, 5);
  };

  const getFeaturedItems = () => {
    return convertedUserListings.filter(l => l.featured || l.instantBook || l.marketplaceEnabled).slice(0, 4);
  };

  const getStaffPicksItems = () => {
    return convertedUserListings.filter(l => l.sponsored || l.featured).slice(0, 4);
  };

  const getLatestItems = () => {
    return [...convertedUserListings].reverse().slice(0, 5);
  };

  const getPopularItems = () => {
    return [...convertedUserListings].sort((a,b) => (b.reviews || 0) - (a.reviews || 0)).slice(0, 5);
  };

  // Shared card for the curated rails below (shipped/featured/latest/popular/staff picks) — same
  // mk-item system as the main grid, with a text badge instead of a bespoke emoji per rail.
  const renderRailCard = (product: any, badge?: string) => {
    const isFav = favoriteItems.has(product.id);
    return (
      <div
        key={product.id}
        className="mk-item"
        role="button"
        tabIndex={0}
        onClick={() => { setSelectedProduct(product); setIsBookingModalOpen(true); }}
      >
        <div className="mk-item__photo">
          <img src={product.image} alt={product.name} referrerPolicy="no-referrer" />
          {badge && <span className="mk-item__flag">{badge}</span>}
          <button
            onClick={(e) => toggleFavorite(product.id, e)}
            aria-label={isFav ? 'Remove from saved' : 'Save this listing'}
            style={{ position: 'absolute', top: '.5rem', right: '.5rem', width: '1.75rem', height: '1.75rem', borderRadius: '50%', background: '#fff', border: '2px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Heart size={13} className={isFav ? 'fill-red-500 text-red-500' : ''} />
          </button>
        </div>
        <div className="mk-item__body">
          <div>
            <p className="mk-item__brand">{product.brand}</p>
            <h4 className="mk-item__name" title={product.name}>{product.name}</h4>
          </div>
          <div className="mk-item__foot">
            <span className="mk-item__price">
              {currencySymbol}{product.price ? product.price.toLocaleString() : 'Call'}
              {!product.isSale && <span> /day</span>}
            </span>
            <span className="mk-item__brand" style={{ marginTop: 0 }}>{product.ownerName || 'Owner'}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      id="marketplace-landing-root"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="mk-browse min-h-screen pb-20 relative"
    >
      {/* Mobile pull-to-refresh indicator */}
      <div
        style={{ height: isRefreshing ? '50px' : `${pullProgress * 0.4}px`, opacity: isRefreshing || pullProgress > 10 ? 1 : 0 }}
        className="w-full flex items-center justify-center overflow-hidden transition-all duration-155 select-none"
      >
        <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} style={{ color: 'var(--hazard)', transform: isRefreshing ? 'none' : `rotate(${pullProgress * 3.6}deg)` }} />
        <span className="mk-browse__eyebrow" style={{ marginLeft: '.5rem' }}>{isRefreshing ? 'Refreshing...' : pullProgress >= 85 ? 'Release to refresh' : 'Pull to refresh'}</span>
      </div>

      <div className="mk-browse__inner">
        <div className="mk-browse__header">
          <div className="mk-browse__brand">
            <PackerLogo variant="symbol-only" size={32} />
            <div>
              <span className="mk-browse__eyebrow">Rent gear from other crews</span>
              <span className="mk-browse__wordmark" style={{ display: 'block', marginTop: '.125rem' }}>Packer Marketplace</span>
            </div>
          </div>

          {user && (
            <div className="mk-browse__switch">
              <button type="button" aria-pressed="true">Marketplace</button>
              <button
                type="button"
                aria-pressed="false"
                onClick={() => navigate('/dashboard')}
              >
                Packer Tools
              </button>
            </div>
          )}
        </div>

        {!isAuthorized && (
          <div id="unauthorized-launch-ribbon" className="mk-browse__notice">
            The marketplace is live first in {launchCountry}. Some listings may not reach {user?.country || 'your region'} yet.
          </div>
        )}

        <div className="mk-hero">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h1 className="mk-hero__title">{heroTitle}</h1>
              <p className="mk-hero__sub">{heroSubtitle} — browsing near {locationQuery}.</p>
            </div>

            <div className="mk-browse__switch" style={{ background: 'transparent', borderColor: '#3a3f43' }}>
              <button
                type="button"
                aria-pressed={currentMode === 'rent'}
                onClick={() => setCurrentMode('rent')}
                style={currentMode === 'rent' ? { background: 'var(--hazard)', color: 'var(--ink)' } : { color: '#9AA1A6' }}
              >
                Rent
              </button>
              <button
                type="button"
                aria-pressed={currentMode === 'buy'}
                onClick={() => setCurrentMode('buy')}
                style={currentMode === 'buy' ? { background: 'var(--hazard)', color: 'var(--ink)' } : { color: '#9AA1A6' }}
              >
                Buy
              </button>
            </div>
          </div>

          <div className="mk-hero__row">
            <div className="mk-hero__field">
              <label htmlFor="mk-search">Search equipment</label>
              <input
                id="mk-search"
                type="text"
                placeholder="e.g. Sony FX6, RED, Arri"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="mk-hero__field">
              <label htmlFor="mk-location">Near</label>
              <input
                id="mk-location"
                type="text"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
              />
            </div>
            <button type="button" className="mk__btn mk__btn--primary" onClick={() => setIsSearchDrawerOpen(true)}>
              <SlidersHorizontal size={14} />
              <span>Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* SEARCH FILTERS DRAWER (INTEGRATED INTERACTIVE COMPONENT MATCHING SCREENSHOT 2) */}
      <AnimatePresence>
        {isSearchDrawerOpen && (
          <div className="fixed inset-0 z-[600] flex justify-start">
            
            {/* Dark blur overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSearchDrawerOpen(false)}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-xs cursor-pointer"
            />

            {/* Left Drawer Container body */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 24, stiffness: 200 }}
              className="relative w-full max-w-[340px] h-full bg-[#1b191c] text-white shadow-2xl border-r border-neutral-800 flex flex-col justify-between overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-neutral-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={16} className="text-[#ff4f3a]" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">Search Filters</h3>
                </div>
                <button 
                  onClick={() => setIsSearchDrawerOpen(false)}
                  className="p-1 px-1.5 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-lg transition"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Drawer Scrollable Body Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* 1. Mode selection */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Listing Type</p>
                  <div className="grid grid-cols-2 gap-2 bg-neutral-900 p-1 rounded-xl border border-neutral-800">
                    <button
                      onClick={() => setCurrentMode('rent')}
                      className={`py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition ${currentMode === 'rent' ? 'bg-[#ff4f3a] text-white' : 'text-neutral-400 hover:text-white'}`}
                    >
                      Rent
                    </button>
                    <button
                      onClick={() => setCurrentMode('buy')}
                      className={`py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition ${currentMode === 'buy' ? 'bg-[#ff4f3a] text-white' : 'text-neutral-400 hover:text-white'}`}
                    >
                      Buy
                    </button>
                  </div>
                </div>

                {/* 2. Location details chip select */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Pickup Preference</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button 
                      onClick={() => toast.success("Pickup & Shipping option prioritized!")}
                      className="px-2 py-1.5 bg-neutral-900 border border-neutral-800 text-[9px] font-extrabold uppercase rounded-lg text-[#ff4f3a]"
                    >
                      Pickup + Ship
                    </button>
                    <button 
                      onClick={() => {
                        if (user?.location) {
                          setLocationQuery(user.location);
                          toast.success(`Filtered for listings near your location: ${user.location}`);
                        } else {
                          toast.error("Set your custom location under User Profile first!");
                        }
                      }}
                      className={`px-2 py-1.5 bg-neutral-900 border border-neutral-800 text-[9px] font-extrabold uppercase rounded-lg transition ${
                        user?.location && locationQuery === user.location ? 'text-[#ff4f3a] border-[#ff4f3a]/20' : 'text-neutral-300'
                      }`}
                    >
                      {user?.location ? `Near ${user.location.split(',')[0]}` : 'Near Me'}
                    </button>
                    <button 
                      onClick={() => toast.success("Refined interactive schedules enabled.")}
                      className="px-2 py-1.5 bg-neutral-900 border border-neutral-800 text-[9px] font-extrabold uppercase rounded-lg text-neutral-300"
                    >
                      Select Dates
                    </button>
                  </div>
                </div>

                {/* 3. Text search within drawer */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Keyword Search</p>
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="e.g. Cinema rig..."
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl py-2.5 pl-9 pr-4 text-xs font-semibold outline-none focus:border-neutral-700 text-white placeholder-neutral-600"
                    />
                    <Search size={14} className="absolute left-3 top-3.5 text-neutral-500" />
                  </div>
                </div>

                {/* 4. Popular Searches matches exact lists (From Screenshot 2) */}
                <div className="space-y-2.5">
                  <p className="text-[10px] font-black tracking-widest text-[#ff4f3a] uppercase">Popular Searches</p>
                  <div className="flex flex-wrap gap-2">
                    {popularKeywords.map((keyword, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSearchQuery(keyword);
                          toast.success(`Filtered list for: ${keyword}`);
                        }}
                        className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-[10px] text-neutral-300 transition shrink-0 uppercase tracking-wider text-left line-clamp-1 truncate max-w-full font-semibold"
                      >
                        {keyword}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. Clear filter button */}
                {(searchQuery || selectedCategory) && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory(null);
                      toast.success("Surgical search filters wiped clean!");
                    }}
                    className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-xs font-black uppercase tracking-widest rounded-xl transition text-center shrink-0 border border-neutral-800"
                  >
                    Clear All Filters
                  </button>
                )}

              </div>

              {/* Drawer Footer info details */}
              <div className="p-6 bg-neutral-900 border-t border-neutral-800/80 text-[9px] font-mono tracking-widest uppercase text-neutral-500 shrink-0">
                Active Listings Count: {filteredProducts.length}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      <div id="explore-cards-section" className="mk-browse__inner" style={{ paddingTop: 0 }}>
        <h2 className="mk-rail__title">Get started</h2>

        <div className="mk-links">
          <button
            type="button"
            className="mk-link"
            onClick={() => {
              setCurrentMode('rent');
              setSearchQuery('');
              setSelectedCategory(null);
              document.getElementById('marketplace-products-display')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <span className="mk-link__icon"><Camera size={16} /></span>
            <span>
              <span className="mk-link__name">Rentals</span>
              <span className="mk-link__desc">Local gear rentals</span>
            </span>
          </button>

          <button
            type="button"
            className="mk-link"
            onClick={() => {
              setCurrentMode('buy');
              setSearchQuery('');
              setSelectedCategory(null);
              document.getElementById('marketplace-products-display')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <span className="mk-link__icon"><ShoppingBag size={16} /></span>
            <span>
              <span className="mk-link__name">Buy &amp; sell</span>
              <span className="mk-link__desc">New and used gear</span>
            </span>
          </button>

          <button
            type="button"
            className="mk-link"
            onClick={() => document.getElementById('marketplace-crew-display')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <span className="mk-link__icon"><UserCheck size={16} /></span>
            <span>
              <span className="mk-link__name">Gigs</span>
              <span className="mk-link__desc">Hire local creatives</span>
            </span>
          </button>

          <button
            type="button"
            className="mk-link"
            onClick={() => toast.info('A map view is not built yet.')}
          >
            <span className="mk-link__icon"><MapPin size={16} /></span>
            <span>
              <span className="mk-link__name">Locations</span>
              <span className="mk-link__desc">Film, photo and editing spaces</span>
            </span>
          </button>
        </div>
      </div>


      {/* 3. DUAL ADVERTISING PROMOTION BANNERS (ADMIN-CONFIGURED ONLY) */}
      {showPromotions && (
        <div id="marketplace-promotions" className="mk-browse__inner" style={{ paddingTop: 0 }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {bannerATitle && (
              <div className="mk__card mk__panel mk__panel--dark" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ display: 'grid', gap: '.75rem', maxWidth: '22rem' }}>
                  <span className="mk__tag">Featured</span>
                  <h3 className="mk__h1" style={{ fontSize: 'clamp(1.25rem, 3vw, 1.75rem)' }}>{bannerATitle}</h3>
                  <p style={{ color: '#9AA1A6', fontSize: '.875rem', margin: 0 }}>{bannerASubtitle}</p>
                  <button
                    type="button"
                    onClick={() => toast.info('This banner is informational only.')}
                    className="mk__btn mk__btn--primary"
                    style={{ alignSelf: 'flex-start' }}
                  >
                    {bannerAButtonText}
                  </button>
                </div>
                {bannerAImage && (
                  <div className="mk__photo" style={{ width: '12rem', height: '10rem', flex: 'none' }}>
                    <img src={bannerAImage} alt="" referrerPolicy="no-referrer" />
                  </div>
                )}
              </div>
            )}

            {bannerBTitle && (
              <div className="mk__card mk__panel mk__panel--dark" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ display: 'grid', gap: '.75rem', maxWidth: '22rem' }}>
                  <span className="mk__tag">{requiresEduVerification ? 'Verification required' : 'Special rate'}</span>
                  <h3 className="mk__h1" style={{ fontSize: 'clamp(1.25rem, 3vw, 1.75rem)' }}>{bannerBTitle}</h3>
                  <p style={{ color: '#9AA1A6', fontSize: '.875rem', margin: 0 }}>{bannerBSubtitle}</p>
                  <button
                    type="button"
                    onClick={() => toast.info('This banner is informational only.')}
                    className="mk__btn mk__btn--primary"
                    style={{ alignSelf: 'flex-start' }}
                  >
                    {bannerBButtonText}
                  </button>
                </div>
                {bannerBImage && (
                  <div className="mk__photo" style={{ width: '12rem', height: '10rem', flex: 'none' }}>
                    <img src={bannerBImage} alt="" referrerPolicy="no-referrer" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Industry filter and sort/view controls */}
      <div className="mk-browse__inner mk-rail" style={{ paddingTop: 0, paddingBottom: 0 }}>
        <div className="mk-rail__head">
          <div>
            <p className="mk-browse__eyebrow">Filter by industry</p>
            <h3 className="mk-rail__title" style={{ fontSize: '1rem' }}>Browse by sector</h3>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '.625rem' }}>
            <label className="mk__label" style={{ display: 'flex', alignItems: 'center', gap: '.375rem', textTransform: 'none' }}>
              <ArrowUpDown size={12} />
              Sort
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="mk__btn"
                style={{ minHeight: '2.25rem', padding: '.375rem .625rem', fontSize: '.75rem' }}
              >
                <option value="default">Default</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="rating">Rating</option>
                <option value="reviews">Most reviewed</option>
              </select>
            </label>

            <div className="mk-browse__switch">
              <button type="button" aria-pressed={viewType === 'grid'} onClick={() => setViewType('grid')} title="Grid view">
                <LayoutGrid size={14} />
              </button>
              <button type="button" aria-pressed={viewType === 'list'} onClick={() => setViewType('list')} title="List view">
                <List size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="mk-rail__scroll">
          {INDUSTRIES_MARKET.map((ind) => {
            const isSelected = selectedIndustry === ind.id;
            return (
              <button
                key={ind.id}
                type="button"
                onClick={() => {
                  setSelectedIndustry(ind.id);
                  setSelectedCategory(null);
                }}
                className="mk__btn"
                style={{ flex: 'none', ...(isSelected ? { background: 'var(--ink)', color: '#fff' } : {}) }}
              >
                {ind.name}
              </button>
            );
          })}
        </div>
      </div>

      {showCategories && (
        <div id="marketplace-categories-section" className="mk-browse__inner mk-rail" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <div className="mk-rail__head">
            <div>
              <h2 className="mk-rail__title">Browse categories</h2>
              <p className="mk-browse__eyebrow" style={{ marginTop: '.25rem' }}>Near {locationQuery}</p>
            </div>
            {selectedCategory && (
              <button type="button" onClick={() => setSelectedCategory(null)} className="mk__btn" style={{ minHeight: '2.25rem', padding: '.375rem .875rem', fontSize: '.75rem' }}>
                Clear category
              </button>
            )}
          </div>

          {dbBrands.length > 0 && (
            <div style={{ marginTop: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="mk__label" style={{ fontSize: '.8125rem' }}>Filter by brand</h3>
                {selectedBrandId && (
                  <button type="button" onClick={() => setSelectedBrandId(null)} className="mk__label" style={{ color: 'var(--bad)', cursor: 'pointer', background: 'none', border: 'none' }}>
                    Clear
                  </button>
                )}
              </div>
              <div className="mk-rail__scroll">
                {dbBrands.map((brand) => {
                  const isSelected = selectedBrandId === brand.id;
                  const brandListingsCount = userListings.filter(l => l.brand?.toLowerCase() === brand.name?.toLowerCase() || l.brand?.toLowerCase() === brand.id?.toLowerCase()).length;
                  return (
                    <button
                      key={brand.id}
                      onClick={() => setSelectedBrandId(isSelected ? null : brand.id)}
                      className="mk-cat"
                      aria-pressed={isSelected}
                      style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.5rem .75rem' }}
                    >
                      <span style={{ width: '1.5rem', height: '1.5rem', borderRadius: 4, overflow: 'hidden', background: 'var(--tape)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                        {brand.logo ? (
                          <img src={brand.logo} alt={brand.name} referrerPolicy="no-referrer" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        ) : (
                          <span style={{ fontSize: '.625rem', fontWeight: 800 }}>{brand.name.slice(0, 2)}</span>
                        )}
                      </span>
                      <span style={{ textAlign: 'left' }}>
                        <span className="mk-cat__name" style={{ padding: 0, display: 'block' }}>{brand.name}</span>
                        {brandListingsCount > 0 && <span className="mk-browse__eyebrow" style={{ fontSize: '.625rem' }}>{brandListingsCount} listings</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mk-rail__scroll">
            {activeCategories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(isSelected ? null : cat.id)}
                  className="mk-cat"
                  aria-pressed={isSelected}
                >
                  <span className="mk-cat__thumb">
                    <img src={cat.image} alt="" referrerPolicy="no-referrer" />
                    {cat.count > 0 && <span className="mk-cat__count">{cat.count.toLocaleString()}</span>}
                  </span>
                  <span className="mk-cat__name">{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}


      {/* 5. INTERACTIVE PRODUCTS DISPLAY PANELS FOR SELECTION (RENTALS, SHIPPING & BUY COMPILATIONS) */}
      <div id="marketplace-products-display" className="mk-browse__inner" style={{ paddingTop: 0 }}>

        {/* Dynamic header summary matching current mode toggles */}
        <div className="mk__wrap" style={{ maxWidth: 'none', padding: 0, gap: '.5rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <h3 className="mk__label" style={{ fontSize: '.8125rem', textTransform: 'none', color: 'var(--ink)' }}>
                Showing {currentMode === 'rent' ? 'equipment for rent' : 'equipment for sale'}
              </h3>
              <p className="mk__label" style={{ marginTop: '.125rem' }}>
                {selectedCategory ? CATEGORIES.find(c => c.id === selectedCategory)?.name : 'All categories'}
                {searchQuery && ` matching "${searchQuery}"`}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '.5rem' }}>
              {selectedCategory && (
                <button type="button" onClick={() => setSelectedCategory(null)} className="mk__btn" style={{ minHeight: '2.25rem', padding: '.375rem .875rem', fontSize: '.75rem' }}>
                  Clear category
                </button>
              )}
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} className="mk__btn" style={{ minHeight: '2.25rem', padding: '.375rem .875rem', fontSize: '.75rem' }}>
                  Clear search
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Lens sub-filters (type / mount) — shown only when browsing lens categories */}
        {(selectedCategory === 'cinema-lenses' || selectedCategory === 'photography-lenses') && (
          <div className="mk__note" style={{ marginTop: '1.5rem', display: 'grid', gap: '.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="mk__label" style={{ color: 'var(--ink)' }}>Lens specs</span>
              <button
                type="button"
                onClick={() => { setSelectedLensType(null); setSelectedLensMount(null); }}
                className="mk__label"
                style={{ color: 'var(--bad)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Reset
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div style={{ display: 'grid', gap: '.375rem' }}>
                <label className="mk__label">Lens type</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.375rem' }}>
                  {[
                    { id: null, label: 'All types' },
                    { id: 'Prime', label: 'Prime' },
                    { id: 'Zoom', label: 'Zoom' },
                    { id: 'Cinema Prime', label: 'Cinema prime' },
                    { id: 'Cinema Zoom', label: 'Cinema zoom' },
                    { id: 'Anamorphic', label: 'Anamorphic' }
                  ].map((t) => (
                    <button
                      key={t.id || 'all'}
                      type="button"
                      onClick={() => setSelectedLensType(t.id)}
                      className="mk__btn"
                      style={{ minHeight: '2rem', padding: '.25rem .75rem', fontSize: '.75rem', ...(selectedLensType === t.id ? { background: 'var(--ink)', color: '#fff' } : {}) }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gap: '.375rem' }}>
                <label className="mk__label">Lens mount</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.375rem' }}>
                  {[
                    { id: null, label: 'All mounts' },
                    { id: 'PL-Mount', label: 'PL mount' },
                    { id: 'E-Mount', label: 'Sony E' },
                    { id: 'EF-Mount', label: 'Canon EF' },
                    { id: 'RF-Mount', label: 'Canon RF' },
                    { id: 'Z-Mount', label: 'Nikon Z' }
                  ].map((m) => (
                    <button
                      key={m.id || 'all'}
                      type="button"
                      onClick={() => setSelectedLensMount(m.id)}
                      className="mk__btn"
                      style={{ minHeight: '2rem', padding: '.25rem .75rem', fontSize: '.75rem', ...(selectedLensMount === m.id ? { background: 'var(--ink)', color: '#fff' } : {}) }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5A. CURRENT MODE FILTERED PRODUCTS GRID */}
        <div style={{ marginTop: '1.5rem' }}>
          <div className="mk-rail__head" style={{ marginTop: 0 }}>
            <h3 className="mk-rail__title" style={{ fontSize: '1rem' }}>
              {currentMode === 'rent' ? 'Equipment for rent' : 'Equipment for sale'}
            </h3>
            <span className="mk__label">{loadingListings ? 'Loading' : `${filteredProducts.length} items`}</span>
          </div>

          {loadingListings ? (
            viewType === 'grid' ? (
              <div className="mk-grid">
                {Array.from({ length: 10 }).map((_, index) => (
                  <div key={index} className="mk-item" style={{ height: '18rem' }}>
                    <div className="mk-item__photo" style={{ background: 'var(--raised)' }} />
                    <div className="mk-item__body">
                      <div style={{ height: '.5rem', width: '40%', background: 'var(--raised)', borderRadius: 2 }} />
                      <div style={{ height: '.875rem', width: '80%', background: 'var(--raised)', borderRadius: 2 }} />
                      <div style={{ height: '.75rem', width: '55%', background: 'var(--raised)', borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '.75rem', marginTop: '1.25rem' }}>
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="mk-item" style={{ flexDirection: 'row', height: '8rem' }}>
                    <div className="mk-item__photo" style={{ width: '8rem', flex: 'none', background: 'var(--raised)' }} />
                    <div className="mk-item__body" style={{ flex: 1 }}>
                      <div style={{ height: '.5rem', width: '30%', background: 'var(--raised)', borderRadius: 2 }} />
                      <div style={{ height: '.875rem', width: '60%', background: 'var(--raised)', borderRadius: 2 }} />
                      <div style={{ height: '.75rem', width: '40%', background: 'var(--raised)', borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : filteredProducts.length === 0 ? (
            <div className="mk-empty">
              <p>No listings match these filters yet.</p>
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSelectedCategory(null); }}
                className="mk__btn"
                style={{ margin: '.75rem auto 0', minHeight: '2.25rem', padding: '.375rem 1rem', fontSize: '.75rem' }}
              >
                Clear filters
              </button>
            </div>
          ) : viewType === 'grid' ? (
            <div className="mk-grid">
              {filteredProducts.map((product) => {
                const isFav = favoriteItems.has(product.id);
                const flag = product.sponsored ? 'Sponsored'
                  : product.featured ? 'Featured'
                  : product.isSale ? 'For sale'
                  : product.instantBook ? 'Instant book'
                  : 'Daily rent';
                return (
                  <div
                    key={product.id}
                    className="mk-item"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (product.isUserListing) {
                        navigate('/marketplace/' + product.id);
                      } else {
                        setSelectedProduct(product);
                        setIsBookingModalOpen(true);
                      }
                    }}
                  >
                    <div className="mk-item__photo">
                      <img src={product.image} alt={product.name} referrerPolicy="no-referrer" />
                      <span className="mk-item__flag">{flag}</span>
                      <button
                        onClick={(e) => toggleFavorite(product.id, e)}
                        aria-label={isFav ? 'Remove from saved' : 'Save this listing'}
                        style={{ position: 'absolute', top: '.5rem', right: '.5rem', width: '1.75rem', height: '1.75rem', borderRadius: '50%', background: '#fff', border: '2px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Heart size={13} className={isFav ? 'fill-red-500 text-red-500' : ''} />
                      </button>
                      {product.isShipped && (
                        <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--ink)', color: '#fff', textAlign: 'center', padding: '.1875rem 0', fontSize: '.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.03em' }}>
                          Ships in {product.shippingDays}–5 days
                        </span>
                      )}
                    </div>

                    <div className="mk-item__body">
                      <div>
                        <p className="mk-item__brand">{product.brand}</p>
                        <h4 className="mk-item__name" title={product.name}>{product.name}</h4>
                        {(product.category === 'cinema-lenses' || product.category === 'photography-lenses') && (product.lensType || product.lensMount) && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.25rem', marginTop: '.375rem' }}>
                            {product.lensType && <span className="mk__tag" style={{ fontSize: '.625rem', padding: '.0625rem .375rem' }}>{product.lensType}</span>}
                            {product.lensMount && <span className="mk__tag" style={{ fontSize: '.625rem', padding: '.0625rem .375rem' }}>{product.lensMount}</span>}
                          </div>
                        )}
                        {product.sponsored && product.adHeadline && (
                          <p className="mk__note" style={{ marginTop: '.375rem', padding: '.375rem .5rem', fontSize: '.6875rem' }}>{product.adHeadline}</p>
                        )}
                      </div>

                      {product.rating > 0 && (
                        <div className="mk-item__rating">
                          <Star size={10} className="fill-amber-400 text-amber-400" />
                          <span>{product.rating} ({product.reviews})</span>
                        </div>
                      )}

                      {product.ownerName && (
                        <p className="mk-item__brand" style={{ borderTop: '2px dashed var(--concrete)', paddingTop: '.375rem' }}>
                          {product.ownerName}
                        </p>
                      )}

                      <div className="mk-item__foot">
                        <span className="mk-item__price">
                          {currencySymbol}{product.price ? product.price.toLocaleString() : 'Call'}
                          {!product.isSale && <span> /day</span>}
                        </span>
                        {product.originalPrice && (
                          <span style={{ fontSize: '.6875rem', color: 'var(--ink-soft)', textDecoration: 'line-through' }}>
                            {currencySymbol}{product.originalPrice.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List view rows — same mk-item system as the grid cards, laid out as a row */
            <div style={{ display: 'grid', gap: '.75rem', marginTop: '1.25rem' }}>
              {filteredProducts.map((product) => {
                const isFav = favoriteItems.has(product.id);
                const flag = product.sponsored ? 'Sponsored'
                  : product.featured ? 'Featured'
                  : product.isSale ? 'For sale'
                  : product.instantBook ? 'Instant book'
                  : 'Daily rent';
                return (
                  <div
                    key={product.id}
                    className="mk-item"
                    role="button"
                    tabIndex={0}
                    style={{ flexDirection: 'row', alignItems: 'stretch' }}
                    onClick={() => {
                      if (product.isUserListing) {
                        navigate('/marketplace/' + product.id);
                      } else {
                        setSelectedProduct(product);
                        setIsBookingModalOpen(true);
                      }
                    }}
                  >
                    <div className="mk-item__photo" style={{ width: '11rem', flex: 'none' }}>
                      <img src={product.image} alt={product.name} referrerPolicy="no-referrer" />
                      <span className="mk-item__flag">{flag}</span>
                      <button
                        onClick={(e) => toggleFavorite(product.id, e)}
                        aria-label={isFav ? 'Remove from saved' : 'Save this listing'}
                        style={{ position: 'absolute', top: '.5rem', right: '.5rem', width: '1.75rem', height: '1.75rem', borderRadius: '50%', background: '#fff', border: '2px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Heart size={13} className={isFav ? 'fill-red-500 text-red-500' : ''} />
                      </button>
                    </div>

                    <div className="mk-item__body" style={{ flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                          <p className="mk-item__brand" style={{ margin: 0 }}>{product.brand}</p>
                          {product.industry && <span className="mk__tag" style={{ fontSize: '.625rem', padding: '.0625rem .375rem' }}>{product.industry}</span>}
                        </div>
                        <h4 className="mk-item__name" style={{ WebkitLineClamp: 1, fontSize: '.9375rem' }} title={product.name}>{product.name}</h4>

                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '.75rem', marginTop: '.25rem' }}>
                          {product.rating > 0 && (
                            <div className="mk-item__rating">
                              <Star size={10} className="fill-amber-400 text-amber-400" />
                              <span>{product.rating} ({product.reviews})</span>
                            </div>
                          )}
                          {product.ownerName && <span className="mk-item__brand">{product.ownerName}</span>}
                          {product.isShipped && <span className="mk__tag" style={{ fontSize: '.625rem', padding: '.0625rem .375rem' }}>Ships in {product.shippingDays}–5 days</span>}
                        </div>

                        {product.sponsored && product.adHeadline && (
                          <p className="mk__note" style={{ marginTop: '.375rem', padding: '.375rem .5rem', fontSize: '.6875rem', display: 'inline-block' }}>{product.adHeadline}</p>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '.5rem', flex: 'none' }}>
                        <span className="mk-item__price" style={{ fontSize: '1.125rem' }}>
                          {currencySymbol}{product.price ? product.price.toLocaleString() : 'Call'}
                          {!product.isSale && <span> /day</span>}
                        </span>
                        <button
                          type="button"
                          className="mk__btn mk__btn--primary"
                          style={{ minHeight: '2rem', padding: '.375rem .875rem', fontSize: '.75rem' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProduct(product);
                            setIsBookingModalOpen(true);
                          }}
                        >
                          {product.isSale ? 'Inquire' : 'Rent now'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 5B. RENTALS SHIPPED TO YOU (ONLY VISIBLE ON RENT MODE) */}
        {showShippedToYou && currentMode === 'rent' && (
          <div className="mk-rail" style={{ borderTop: '2px solid var(--concrete)', paddingTop: '1.5rem' }}>
            <div className="mk-rail__head">
              <div>
                <h3 className="mk-rail__title" style={{ fontSize: '1rem' }}>Shipped to you</h3>
                <p className="mk-browse__eyebrow" style={{ marginTop: '.25rem' }}>Rentals shipped to your address, tracked and insured</p>
              </div>
            </div>
            <div className="mk-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(10rem, 1fr))' }}>
              {getShippedItems().slice(0, 5).map((product) => renderRailCard(product, 'Ships to you'))}
            </div>
          </div>
        )}

      </div>

      {/* FEATURED GEAR SECTION */}
      {showFeatured && (
        <div id="featured-gear-section" className="mk-browse__inner mk-rail">
          <div className="mk-rail__head">
            <div>
              <h2 className="mk-rail__title">Featured gear</h2>
              <p className="mk-browse__eyebrow" style={{ marginTop: '.25rem' }}>Highlighted listings near {locationQuery}</p>
            </div>
          </div>
          <div className="mk-grid">
            {getFeaturedItems().slice(0, 4).map((product) => renderRailCard(product, 'Featured'))}
          </div>
        </div>
      )}

      {/* LATEST GEAR SECTION */}
      {showLatestGear && (
        <div id="latest-gear-section" className="mk-browse" style={{ marginTop: '1.5rem' }}>
          <div className="mk-browse__inner mk-rail" style={{ paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
            <div className="mk-rail__head">
              <div>
                <h2 className="mk-rail__title">Latest gear</h2>
                <p className="mk-browse__eyebrow" style={{ marginTop: '.25rem' }}>Recently listed near {locationQuery}</p>
              </div>
            </div>
            <div className="mk-grid">
              {getLatestItems().slice(0, 4).map((product) => renderRailCard(product, 'New'))}
            </div>
          </div>
        </div>
      )}

      {/* POPULAR ITEMS SECTION */}
      {showPopularItems && (
        <div id="popular-gear-section" className="mk-browse__inner mk-rail">
          <div className="mk-rail__head">
            <div>
              <h2 className="mk-rail__title">Popular equipment</h2>
              <p className="mk-browse__eyebrow" style={{ marginTop: '.25rem' }}>Most-reviewed camera bodies and prime optics</p>
            </div>
          </div>
          <div className="mk-grid">
            {getPopularItems().slice(0, 4).map((product) => renderRailCard(product, 'Popular'))}
          </div>
        </div>
      )}

      {showStaffPicks && (
        <div id="staff-picks-section" className="mk-browse__inner mk-rail">
          <div className="mk-rail__head">
            <div>
              <h2 className="mk-rail__title">Staff picks</h2>
              <p className="mk-browse__eyebrow" style={{ marginTop: '.25rem' }}>Rigs checked for compatibility and condition near {locationQuery}</p>
            </div>
          </div>
          <div className="mk-grid">
            {getStaffPicksItems().map((product) => renderRailCard(product, 'Staff pick'))}
          </div>
        </div>
      )}

      {/* 8. LIST YOUR GEAR PANEL CTA */}
      {showGuarantees && (
        <div id="list-your-gear-banner" className="mk-browse__inner" style={{ paddingTop: '1.5rem' }}>
          <div className="mk__card mk__panel--dark" style={{ padding: '2rem', textAlign: 'center', display: 'grid', gap: '2rem' }}>
            <div style={{ display: 'grid', gap: '.5rem', maxWidth: '34rem', margin: '0 auto' }}>
              <h2 className="mk__h1" style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2rem)' }}>Rent or sell your gear</h2>
              <p style={{ color: '#9AA1A6', fontSize: '.875rem', margin: 0 }}>
                List gear you own for other crews to rent, or find what you need nearby.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ textAlign: 'left' }}>
              <div className="mk__card" style={{ padding: '1.25rem', display: 'grid', gap: '.625rem' }}>
                <div className="mk__badge" style={{ width: '2.5rem', height: '2.5rem' }}>
                  <DollarSign size={18} />
                </div>
                <div>
                  <h4 className="mk__value">Earn renting your gear</h4>
                  <p className="mk__label" style={{ textTransform: 'none', marginTop: '.25rem' }}>
                    Put gear to work while you're not using it. Rent it to other crews and arrange payment directly.
                  </p>
                </div>
              </div>

              <div className="mk__card" style={{ padding: '1.25rem', display: 'grid', gap: '.625rem' }}>
                <div className="mk__badge" style={{ width: '2.5rem', height: '2.5rem' }}>
                  <ShoppingBag size={18} />
                </div>
                <div>
                  <h4 className="mk__value">Sell your gear</h4>
                  <p className="mk__label" style={{ textTransform: 'none', marginTop: '.25rem' }}>
                    List gear for other crews to buy. Packer Tools doesn't take a cut — you and the buyer arrange payment directly.
                  </p>
                </div>
              </div>

              <div className="mk__card" style={{ padding: '1.25rem', display: 'grid', gap: '.625rem' }}>
                <div className="mk__badge" style={{ width: '2.5rem', height: '2.5rem' }}>
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h4 className="mk__value">You arrange the details</h4>
                  <p className="mk__label" style={{ textTransform: 'none', marginTop: '.25rem' }}>
                    Packer Tools doesn't provide insurance or hold payment in escrow. Agree on deposit, damage cover and payment directly before handover.
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '1rem', justifyItems: 'center' }}>
              <button type="button" onClick={handleOpenListGear} className="mk__btn mk__btn--primary">
                List your gear
              </button>
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <button type="button" onClick={() => navigate('/help?category=packer-tools-academy')} className="mk__label" style={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  Learn about renting
                </button>
                <button type="button" onClick={() => navigate('/help?category=getting-started')} className="mk__label" style={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  Learn about selling
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Custom dark footer removed and integrated into global bottom corporate footer */}


      {/* DETAIL DIALOG / BOOKING MODAL FOR PRODUCTS */}
      <AnimatePresence>
        {isBookingModalOpen && selectedProduct && (
          <div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsBookingModalOpen(false);
                setSelectedProduct(null);
              }}
              className="mk-modal__backdrop"
            />

            <div className="mk-modal__wrap">
              <motion.div
                initial={{ scale: 0.97, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.97, opacity: 0 }}
                className="mk-modal__panel mk"
              >
                <div className="mk-modal__head">
                  <div>
                    <span className="mk__label" style={{ display: 'flex', alignItems: 'center', gap: '.375rem' }}>
                      {selectedProduct.brand && (() => {
                        const brandObj = dbBrands.find(b => b.name?.toLowerCase() === selectedProduct.brand.toLowerCase() || b.id?.toLowerCase() === selectedProduct.brand.toLowerCase());
                        return brandObj?.logo ? (
                          <img src={brandObj.logo} alt={selectedProduct.brand} referrerPolicy="no-referrer" style={{ height: '.75rem', width: 'auto', objectFit: 'contain', opacity: .8 }} />
                        ) : null;
                      })()}
                      <span>{selectedProduct.brand}{selectedProduct.model ? ` · ${selectedProduct.model}` : ''}</span>
                    </span>
                    <h3 className="mk-modal__title">{selectedProduct.isSale ? 'Buy' : 'Book'}: {selectedProduct.name}</h3>
                  </div>
                  <button
                    type="button"
                    className="mk-modal__close"
                    onClick={() => { setIsBookingModalOpen(false); setSelectedProduct(null); }}
                    aria-label="Close"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="mk-modal__body">
                  <div className="mk-modal__preview">
                    <div className="mk-modal__thumb">
                      <img src={selectedProduct.image} alt={selectedProduct.name} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ display: 'grid', gap: '.25rem', alignContent: 'center' }}>
                      {selectedProduct.rating > 0 && (
                        <span className="mk-item__rating">
                          <Star size={11} className="fill-amber-400 text-amber-400" />
                          <span>{selectedProduct.rating} ({selectedProduct.reviews} reviews)</span>
                        </span>
                      )}
                      <span className="mk-item__price">{currencySymbol}{selectedProduct.price}{selectedProduct.isSale ? '' : <span> /day</span>}</span>
                      <span className="mk__label">Owner: {selectedProduct.ownerName || 'Not named'}</span>
                    </div>
                  </div>

                  <form onSubmit={handleBookingSubmit} style={{ display: 'grid', gap: '1.25rem' }}>
                    {!selectedProduct.isSale ? (
                      <div style={{ display: 'grid', gap: '1rem' }}>
                        <div>
                          <label className="mk__label">Rental length</label>
                          <div className="mk-days" style={{ marginTop: '.375rem' }}>
                            {[1, 3, 7, 14].map((days) => (
                              <button
                                key={days}
                                type="button"
                                aria-pressed={bookingDays === days}
                                onClick={() => {
                                  setBookingDays(days);
                                  const start = new Date(rentStartDate);
                                  const newEnd = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
                                  setRentEndDate(newEnd.toISOString().split('T')[0]);
                                }}
                              >
                                {days} {days === 1 ? 'day' : 'days'}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="bk__row">
                          <div className="bk__field">
                            <label className="bk__label" htmlFor="mk-pickup-date">Pickup date</label>
                            <input
                              id="mk-pickup-date"
                              className="bk__input"
                              type="date"
                              value={rentStartDate}
                              onChange={(e) => {
                                setRentStartDate(e.target.value);
                                const start = new Date(e.target.value);
                                const end = new Date(rentEndDate);
                                if (end <= start) {
                                  const newEnd = new Date(start.getTime() + bookingDays * 24 * 60 * 60 * 1000);
                                  setRentEndDate(newEnd.toISOString().split('T')[0]);
                                }
                              }}
                            />
                          </div>
                          <div className="bk__field">
                            <label className="bk__label" htmlFor="mk-return-date">Return date</label>
                            <input
                              id="mk-return-date"
                              className="bk__input"
                              type="date"
                              value={rentEndDate}
                              onChange={(e) => {
                                setRentEndDate(e.target.value);
                                const start = new Date(rentStartDate);
                                const end = new Date(e.target.value);
                                if (end > start) {
                                  const diffTime = end.getTime() - start.getTime();
                                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                  setBookingDays(diffDays > 0 ? diffDays : 1);
                                }
                              }}
                            />
                          </div>
                        </div>

                        <div className="bk__field">
                          <label className="bk__label" htmlFor="mk-pickup-time">Pickup time</label>
                          <input id="mk-pickup-time" className="bk__input" type="time" value={rentTime} onChange={(e) => setRentTime(e.target.value)} />
                        </div>

                        <div className="bk__field">
                          <span className="bk__label">Pickup and return</span>
                          <PickupDropoffWidget
                            onChange={setPickupDropoffState}
                            ownerId={selectedProduct.ownerId}
                            initialState={{
                              pickupType: selectedProduct?.pickupType || 'preset',
                              pickupLocationId: selectedProduct?.pickupLocationId || '',
                              pickupCustomAddress: selectedProduct?.pickupCustomAddress || '',
                              dropoffType: selectedProduct?.dropoffType || 'preset',
                              dropoffLocationId: selectedProduct?.dropoffLocationId || '',
                              dropoffCustomAddress: selectedProduct?.dropoffCustomAddress || '',
                            }}
                          />
                        </div>

                        {selectedProduct.addOns && selectedProduct.addOns.length > 0 && (
                          <fieldset className="bk__fs">
                            <legend>Optional extras from the owner</legend>
                            {selectedProduct.addOns.map((add, idx) => {
                              const isSelected = selectedAddOns.has(idx);
                              return (
                                <label key={idx} className="mk-addon">
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {
                                        const updated = new Set(selectedAddOns);
                                        if (isSelected) updated.delete(idx); else updated.add(idx);
                                        setSelectedAddOns(updated);
                                      }}
                                    />
                                    <span>
                                      <span style={{ display: 'block', fontWeight: 700, fontSize: '.8125rem' }}>{add.name}</span>
                                      {add.notes && <span style={{ display: 'block', fontSize: '.6875rem', color: 'var(--ink-soft)' }}>{add.notes}</span>}
                                    </span>
                                  </span>
                                  <span style={{ fontWeight: 800, fontSize: '.8125rem', color: 'var(--ok)' }}>
                                    {add.price === 0 ? 'Free' : `+${currencySymbol}${add.price}/day`}
                                  </span>
                                </label>
                              );
                            })}
                          </fieldset>
                        )}
                      </div>
                    ) : (
                      <p className="mk__note">The owner will contact you directly to arrange payment and dispatch.</p>
                    )}

                    {(() => {
                      const { taxAmount, deposit, totalQuote, isInclusive, taxPercent } = calculateTaxAndTotal();
                      return (
                        <div className="bk__sum">
                          <div className="bk__line">
                            <span>{selectedProduct.isSale ? 'Purchase price' : `${currencySymbol}${selectedProduct.price} × ${bookingDays} ${bookingDays === 1 ? 'day' : 'days'}`}</span>
                            <span>{currencySymbol}{(selectedProduct.price * (selectedProduct.isSale ? 1 : bookingDays)).toLocaleString()}</span>
                          </div>

                          {!selectedProduct.isSale && selectedAddOns.size > 0 && (
                            <div className="bk__line">
                              <span>Extras ({selectedAddOns.size})</span>
                              <span>+{currencySymbol}{(Array.from(selectedAddOns).reduce((sum, idx) => sum + (selectedProduct.addOns?.[idx]?.price || 0), 0) * bookingDays).toLocaleString()}</span>
                            </div>
                          )}

                          {deposit > 0 && (
                            <div className="bk__line">
                              <span>Refundable deposit</span>
                              <span>{currencySymbol}{deposit.toLocaleString()}</span>
                            </div>
                          )}

                          <div className="bk__line">
                            <span>{isFiji ? `Fiji VAT (${taxPercent}%)` : `Tax (${taxPercent}%)`}{isInclusive ? ' included' : ''}</span>
                            <span>{isInclusive ? '' : '+'}{currencySymbol}{taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>

                          <div className="bk__line bk__line--total">
                            <span>Estimated total</span>
                            <span>{currencySymbol}{totalQuote.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <p className="bk__note">The owner confirms this request. Nothing is charged here.</p>
                        </div>
                      );
                    })()}

                    <div style={{ display: 'flex', gap: '.75rem' }}>
                      <button
                        type="button"
                        onClick={() => { setIsBookingModalOpen(false); setSelectedProduct(null); }}
                        className="mk__btn"
                        style={{ flex: 1 }}
                      >
                        Close
                      </button>
                      <button
                        type="submit"
                        disabled={!isAuthorized && restrictToAvailableCountries}
                        className="mk__btn mk__btn--primary"
                        style={{ flex: 1 }}
                      >
                        {!isAuthorized && restrictToAvailableCountries
                          ? 'Not available in your region'
                          : (selectedProduct.isSale ? 'Send purchase request' : 'Send booking request')}
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>


      {/* MESSAGE AND HIRE DIRECT PANEL MODAL FOR CREWS */}
      <AnimatePresence>
        {isMessageModalOpen && selectedCrew && (
          <div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsMessageModalOpen(false); setSelectedCrew(null); }}
              className="mk-modal__backdrop"
            />
            <div className="mk-modal__wrap">
              <motion.div
                initial={{ scale: 0.97, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.97, opacity: 0 }}
                className="mk-modal__panel mk"
              >
                <div className="mk-modal__head">
                  <div>
                    <span className="mk__label">Message a crew member</span>
                    <h3 className="mk-modal__title">{selectedCrew.name}</h3>
                  </div>
                  <button
                    type="button"
                    className="mk-modal__close"
                    onClick={() => { setIsMessageModalOpen(false); setSelectedCrew(null); }}
                    aria-label="Close"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="mk-modal__body">
                  <div className="mk-modal__preview">
                    <div className="mk-modal__thumb">
                      <img src={selectedCrew.image} alt={selectedCrew.name} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div style={{ display: 'grid', gap: '.25rem', alignContent: 'center' }}>
                      <span className="mk__value">{selectedCrew.title}</span>
                      <span className="mk__label">Usually replies within an hour</span>
                    </div>
                  </div>

                  <form onSubmit={handleMessageCrewSubmit} style={{ display: 'grid', gap: '1rem' }}>
                    <div>
                      <label className="mk__label">Message</label>
                      <textarea
                        rows={4}
                        required
                        value={crewMessageText}
                        onChange={(e) => setCrewMessageText(e.target.value)}
                        placeholder={`Hi ${selectedCrew.name.split(' ')[0]}, are you available near ${locationQuery} on...`}
                        className="bk__input"
                        style={{ width: '100%', resize: 'vertical', marginTop: '.375rem' }}
                      />
                    </div>

                    <div className="mk__note" style={{ display: 'flex', gap: '.625rem' }}>
                      <Info size={16} style={{ flexShrink: 0, marginTop: '.125rem' }} />
                      <p style={{ margin: 0 }}>
                        This message goes straight to {selectedCrew.name.split(' ')[0]}. Agree on rate, dates and payment directly with them.
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '.75rem' }}>
                      <button
                        type="button"
                        onClick={() => { setIsMessageModalOpen(false); setSelectedCrew(null); }}
                        className="mk__btn"
                        style={{ flex: 1 }}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="mk__btn mk__btn--primary" style={{ flex: 1 }}>
                        Send message
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* 11. LIST YOUR GEAR OVERLAY DIALOG */}
      <AnimatePresence>
        {isListGearModalOpen && (
          <div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsListGearModalOpen(false)}
              className="mk-modal__backdrop"
            />
            <div className="mk-modal__wrap">
              <motion.div
                initial={{ scale: 0.97, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.97, opacity: 0 }}
                className="mk-modal__panel mk"
                style={{ maxWidth: '38rem' }}
              >
                <div className="mk-modal__head">
                  <h3 className="mk-modal__title">List your gear</h3>
                  <button type="button" className="mk-modal__close" onClick={() => setIsListGearModalOpen(false)} aria-label="Close">
                    <X size={14} />
                  </button>
                </div>

                <div className="mk-modal__body">
                  {/* Option 1: Unregistered user */}
                  {!user && (
                    <div style={{ textAlign: 'center', display: 'grid', gap: '1.25rem', padding: '1rem 0' }}>
                      <div className="mk__badge" style={{ margin: '0 auto' }}>
                        <UserCheck size={28} />
                      </div>
                      <div>
                        <h4 className="mk__value" style={{ fontSize: '1rem' }}>Sign in to list equipment</h4>
                        <p className="mk__label" style={{ textTransform: 'none', marginTop: '.375rem' }}>
                          Listing gear needs a packer.tools account.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await signInWithGoogle();
                            setIsListGearModalOpen(false);
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                        className="mk__btn mk__btn--primary"
                        style={{ margin: '0 auto' }}
                      >
                        <Globe size={14} />
                        <span>Sign in with Google</span>
                      </button>
                    </div>
                  )}

                  {/* Option 2: Registered but unverified KYC */}
                  {user && user.kycStatus !== 'verified' && (
                    <div style={{ textAlign: 'center', display: 'grid', gap: '1.25rem', padding: '1rem 0' }}>
                      <div className="mk__badge mk__badge--bad" style={{ margin: '0 auto' }}>
                        <ShieldAlert size={28} />
                      </div>
                      <div>
                        <h4 className="mk__value" style={{ fontSize: '1rem' }}>Identity verification required</h4>
                        <p className="mk__label" style={{ textTransform: 'none', marginTop: '.375rem' }}>
                          Status: {user.kycStatus || 'not started'}. Listing gear for rent or sale requires a verified identity, so other users know who they're dealing with.
                        </p>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.75rem', justifyContent: 'center' }}>
                        <button type="button" onClick={() => { setIsListGearModalOpen(false); navigate('/profile?tab=kyc'); }} className="mk__btn mk__btn--primary">
                          Verify identity
                        </button>
                        <button type="button" onClick={() => setIsListGearModalOpen(false)} className="mk__btn">
                          Close
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Option 3: Verified user — select lists/kits to list */}
                  {user && user.kycStatus === 'verified' && (
                    <div style={{ display: 'grid', gap: '1.25rem' }}>
                      <p className="mk__label" style={{ textTransform: 'none' }}>
                        Turn on marketplace visibility for any of your packing lists or kits, and set the daily rate.
                      </p>

                      {loadingListsAndProjects ? (
                        <p className="mk__label" style={{ textAlign: 'center', padding: '2rem 0' }}>Loading your lists…</p>
                      ) : (
                        <>
                          {userProjects.length > 0 && (
                            <div style={{ display: 'grid', gap: '.5rem' }}>
                              <label className="mk__label">Filter by project</label>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem' }}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedProjectId(null)}
                                  className="mk__btn"
                                  style={{ minHeight: '2rem', padding: '.25rem .75rem', fontSize: '.75rem', ...(selectedProjectId === null ? { background: 'var(--ink)', color: '#fff' } : {}) }}
                                >
                                  All projects
                                </button>
                                {userProjects.map(proj => (
                                  <button
                                    key={proj.id}
                                    type="button"
                                    onClick={() => setSelectedProjectId(proj.id)}
                                    className="mk__btn"
                                    style={{ minHeight: '2rem', padding: '.25rem .75rem', fontSize: '.75rem', ...(selectedProjectId === proj.id ? { background: 'var(--ink)', color: '#fff' } : {}) }}
                                  >
                                    {proj.name || 'Unnamed project'}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div style={{ display: 'grid', gap: '.625rem', maxHeight: '20rem', overflowY: 'auto' }}>
                            {userOwnLists.filter(l => !selectedProjectId || l.projectId === selectedProjectId).length === 0 ? (
                              <div className="mk-empty">No lists match yet. Create a packing list first.</div>
                            ) : (
                              userOwnLists
                                .filter(l => !selectedProjectId || l.projectId === selectedProjectId)
                                .map((list) => {
                                  const isListed = list.marketplaceEnabled === true;
                                  const currentVal = listingPriceMap[list.id] ?? 150;
                                  return (
                                    <div key={list.id} className="mk__card" style={{ padding: '.875rem 1rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '.75rem' }}>
                                      <div>
                                        <p className="mk__label">{list.brand || 'Custom'} {list.model || 'Kit'}</p>
                                        <h4 className="mk__value">{list.name}</h4>
                                        <p className="mk__label" style={{ textTransform: 'none' }}>
                                          {list.itemsCount || 0} items · {isListed ? `Listed at ${currencySymbol}${list.marketplacePrice}/day` : 'Not listed'}
                                        </p>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '.625rem' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '.25rem', border: '2px solid var(--ink)', borderRadius: 4, padding: '.25rem .5rem' }}>
                                          <span className="mk__label">{currencySymbol}</span>
                                          <input
                                            type="number"
                                            value={currentVal}
                                            onChange={(e) => setListingPriceMap(prev => ({ ...prev, [list.id]: parseInt(e.target.value) || 0 }))}
                                            style={{ width: '3rem', border: 'none', outline: 'none', textAlign: 'right', font: '700 .8125rem Barlow, sans-serif' }}
                                          />
                                          <span className="mk__label">/day</span>
                                        </label>
                                        <button type="button" onClick={() => handleToggleMarketplace(list.id, !isListed)} className="mk__btn" style={{ minHeight: '2rem', padding: '.375rem .75rem', fontSize: '.75rem' }}>
                                          {isListed ? 'Remove listing' : 'List now'}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Action Button (FAB) for Quick Listing */}
      <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 40 }}>
        <button
          type="button"
          onClick={() => { triggerHaptic(); handleOpenListGear(); }}
          className="mk__btn mk__btn--primary"
          style={{ width: '3.25rem', height: '3.25rem', borderRadius: '50%', padding: 0 }}
          aria-label="List your gear"
          title="List your gear"
        >
          <Plus size={22} />
        </button>
      </div>

    </div>
  );
}
