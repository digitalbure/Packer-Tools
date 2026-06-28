import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

const triggerHaptic = () => {
  if (typeof window !== 'undefined' && window.navigator && typeof window.navigator.vibrate === 'function') {
    try {
      window.navigator.vibrate(12);
    } catch (e) {
      // safe backup fallback
    }
  }
};
import { UserProfile, AdminSettings } from '../types';
import { useAuth } from '../providers/AuthProvider';
import { db, handleFirestoreError, OperationType, signInWithGoogle } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, getDocs } from 'firebase/firestore';
import PackerLogo from '../components/PackerLogo';
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
  { id: 'cinema-cameras', name: 'Cinema Cameras', count: 18960, image: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=400' },
  { id: 'cinema-lenses', name: 'Cinema Lenses', count: 10646, image: 'https://images.unsplash.com/photo-1617005082133-5c8cdd97eadd?auto=format&fit=crop&q=80&w=400' },
  { id: 'photography-lenses', name: 'Photography Lenses', count: 6830, image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=400' },
  { id: 'still-hybrid', name: 'Still / Hybrid Cameras', count: 3055, image: 'https://images.unsplash.com/photo-1495707902641-75cac588d2e9?auto=format&fit=crop&q=80&w=400' },
  { id: 'lighting-electric', name: 'Lighting / Electric', count: 16502, image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=400' },
  { id: 'audio', name: 'Audio Gear', count: 8620, image: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&q=80&w=400' },
  { id: 'ge-packages', name: 'G&E Packages', count: 618, image: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&q=80&w=400' },
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
        image: doc.data().image || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=400',
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
          rating: 5.0,
          reviews: 1,
          image: data.image || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=400',
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
          pickupLocationId: data.pickupLocationId || 'suva_depot',
          pickupCustomAddress: data.pickupCustomAddress || '',
          dropoffType: data.dropoffType || 'preset',
          dropoffLocationId: data.dropoffLocationId || 'suva_depot',
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
  const heroTitle = landingConfig.heroTitle || 'The largest, most trusted camera sharing community';
  const heroSubtitle = landingConfig.heroSubtitle || 'Packer verified marketplace';
  const heroDescription = landingConfig.heroDescription || 'Professional visual equipment hire & purchase marketplace. Connecting production crews on Viti Levu and beyond.';
  const showPromotions = landingConfig.showPromotions !== false;
  const bannerATitle = landingConfig.bannerATitle || 'Packer Insights';
  const bannerASubtitle = landingConfig.bannerASubtitle || 'Get the latest data on which products rented & sold best across major organizations.';
  const bannerAButtonText = landingConfig.bannerAButtonText || 'View Report';
  const bannerAImage = landingConfig.bannerAImage || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&q=80&w=400';
  const bannerBTitle = landingConfig.bannerBTitle || 'Exclusive Student Discounts';
  const bannerBSubtitle = landingConfig.bannerBSubtitle || 'Are you enrolled in film academy? Enjoy up to a 20% discount as a verified student operator.';
  const bannerBButtonText = landingConfig.bannerBButtonText || 'Claim Now';
  const bannerBImage = landingConfig.bannerBImage || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=300';
  const showStaffPicks = landingConfig.showStaffPicks !== false;
  const showFeatured = landingConfig.showFeatured !== false;
  const showShippedToYou = landingConfig.showShippedToYou !== false;
  const showLatestGear = landingConfig.showLatestGear !== false;
  const showPopularItems = landingConfig.showPopularItems !== false;
  const showCategories = landingConfig.showCategories !== false;
  const showGuarantees = landingConfig.showGuarantees !== false;
  const requiresEduVerification = landingConfig.requiresEduVerification !== false;
  const partnerLogosText = landingConfig.partnerLogosText || 'Members of Packer Network';
  const partnerLogosList = landingConfig.partnerLogosList || ['facebook', 'amazon studios', 'HBO', 'Disney'];

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
      return { subtotal: 0, taxAmount: 0, damageWaiver: 0, totalQuote: 0, isInclusive: true, taxPercent: 0 };
    }
    
    const baseSubtotal = selectedProduct.price * (selectedProduct.isSale ? 1 : bookingDays);
    const addonsSum = Array.from(selectedAddOns).reduce((sum, idx) => {
      const addon = selectedProduct.addOns?.[idx];
      return sum + (addon?.price || 0);
    }, 0) * (selectedProduct.isSale ? 1 : bookingDays);
    const subtotal = baseSubtotal + addonsSum;
    
    const damageWaiver = selectedProduct.isSale ? 0 : (isFiji ? 30 : 15);
    
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
      totalQuote = subtotal + damageWaiver;
    } else {
      taxAmount = subtotal * (taxPercent / 100);
      totalQuote = subtotal + damageWaiver + taxAmount;
    }
    
    return {
      subtotal,
      taxAmount,
      damageWaiver,
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

      if (selectedProduct.isUserListing) {
        // Real update to user packing list document to reflect the booking!
        const listRef = doc(db, 'packingLists', selectedProduct.id);
        await updateDoc(listRef, {
          bookingClientName: user?.displayName || user?.email?.split('@')[0] || 'Active Operator',
          bookingClientEmail: user?.email || 'guest-operator@packer.com',
          bookingClientSignature: user?.displayName || 'Digital Signature Signed',
          bookingPaidAt: new Date().toISOString(),
          rentalStatus: selectedProduct.isSale ? 'returned' : 'awaiting_payment',
          updatedAt: new Date().toISOString()
        });
      }

      // Also create a record in gearBookings collection for calendars/dashboards!
      const bookingData = {
        gearId: selectedProduct.id,
        gearName: selectedProduct.name,
        brand: selectedProduct.brand || 'Packer Partner',
        ownerId: selectedProduct.ownerId || 'platform_admin',
        clientName: user?.displayName || user?.email?.split('@')[0] || 'Active Operator',
        clientEmail: user?.email || 'guest-operator@packer.com',
        clientPhone: (user as any)?.phone || '+1 (555) 0199',
        startDate: rentStartDate,
        endDate: rentEndDate,
        depositAmount: selectedProduct.securityDeposit || 0,
        paymentStatus: 'Deposit Paid',
        reservationType: selectedProduct.isSale ? 'custom' : 'deposit',
        customConditions: ['Standard Marketplace Insurance Waiver', 'Owner Verification Complete'],
        createdAt: new Date().toISOString(),
        totalPrice: taxAndTotal.totalQuote,
        taxAmount: taxAndTotal.taxAmount,
        damageWaiver: taxAndTotal.damageWaiver,
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

      toast.success(`Booking request finalized & synced! Total Estimated cost: ${currencySymbol}${taxAndTotal.totalQuote.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
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

  return (
    <div 
      id="marketplace-landing-root" 
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="min-h-screen bg-white text-neutral-900 pb-20 font-sans selection:bg-neutral-900 selection:text-white relative"
    >
      {/* Mobile Pull-to-Refresh Visual Indicator */}
      <div 
        style={{ height: isRefreshing ? '50px' : `${pullProgress * 0.4}px`, opacity: isRefreshing || pullProgress > 10 ? 1 : 0 }}
        className="w-full flex items-center justify-center overflow-hidden transition-all duration-155 bg-white/40 rounded-2xl border border-neutral-200/50 text-neutral-600 gap-2 text-xs font-mono font-black uppercase tracking-wider select-none mb-4"
      >
        <RefreshCw size={14} className={`text-primary ${isRefreshing ? 'animate-spin' : ''}`} style={{ transform: isRefreshing ? 'none' : `rotate(${pullProgress * 3.6}deg)` }} />
        <span>{isRefreshing ? 'Synchronizing...' : pullProgress >= 85 ? 'Release to Sync' : 'Pull to Refresh'}</span>
      </div>
      
      {/* Clean Modern Symmetrical Top Navigation & Scheduler Section */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-8 space-y-6">
        
        {/* Compact custom header row specifying live workspace shift */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <PackerLogo variant="symbol-only" size={32} />
            <div>
              <span className="font-extrabold uppercase tracking-widest text-[#ff4f3a] text-[9px] block font-mono">Peer-To-Peer Hire</span>
              <span className="font-bold uppercase tracking-wider text-sm text-neutral-900 block -mt-0.5">Packer Marketplace</span>
            </div>
          </div>

          {user && (
            <div className="flex bg-neutral-100 p-1 rounded-2xl border border-neutral-200/40">
              <button 
                type="button"
                className="px-5 py-2 rounded-xl text-[10px] font-black bg-[#ff4f3a] text-white shadow-sm uppercase tracking-wider transition-all"
              >
                Marketplace Hub
              </button>
              <button 
                type="button"
                onClick={() => {
                  navigate('/dashboard');
                  toast.success("Switched to Packer Tools Workspace!");
                }}
                className="px-5 py-2 rounded-xl text-[10px] font-black text-neutral-500 hover:text-neutral-900 uppercase tracking-wider transition-all"
              >
                Packer Tools
              </button>
            </div>
          )}
        </div>

        {/* Dynamic Launch Notifications */}
        {!isAuthorized && (
          <div id="unauthorized-launch-ribbon" className="bg-neutral-950 text-amber-500 border border-amber-900/30 rounded-2xl p-3 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2.5 shadow-md">
            <Globe size={12} className="shrink-0 text-amber-500" />
            <span>⚠️ Soft Launch Notice: Active marketplace services are prioritized in {launchCountry}. Some features may be restricted for {user?.country || 'your current region'}.</span>
          </div>
        )}

        {/* Compact search & date duration board */}
        <div className="bg-neutral-900 text-white rounded-[2rem] p-6 md:p-8 space-y-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-3xl rounded-full pointer-events-none" />

          {/* Mode switch header row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                <span>Find & Reserve Premium Equipment</span>
              </h1>
              <p className="text-xs text-neutral-400 mt-1 uppercase font-bold tracking-wider">Instant deployment near {locationQuery} for organization members</p>
            </div>

            {/* Mode Switcher Rent vs Buy */}
            <div className="bg-neutral-950 p-1 rounded-xl flex items-center border border-neutral-800 self-start lg:self-auto">
              <button
                type="button"
                onClick={() => {
                  setCurrentMode('rent');
                  toast.info("Switched to Rent mode");
                }}
                className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${currentMode === 'rent' ? 'bg-[#ff4f3a] text-white shadow-md' : 'text-neutral-400 hover:text-white'}`}
              >
                Rent Gear
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentMode('buy');
                  toast.info("Switched to Buy & Sell mode");
                }}
                className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${currentMode === 'buy' ? 'bg-[#ff4f3a] text-white shadow-md' : 'text-neutral-400 hover:text-white'}`}
              >
                Buy / Sale
              </button>
            </div>
          </div>

          {/* Form Filter Row spanning search keyword config and location preferences */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 bg-neutral-950/80 border border-neutral-800/65 p-3 rounded-2xl shadow-inner">
            
            {/* 1. Keyword search input */}
            <div className="lg:col-span-6 flex items-center gap-2.5 px-3 py-1.5 border-b lg:border-b-0 lg:border-r border-neutral-800/60 shrink-0">
              <Search size={16} className="text-[#ff4f3a] shrink-0" />
              <div className="flex flex-col w-full">
                <label className="text-[8px] font-black uppercase tracking-widest text-[#ff4f3a]">Search Equipment</label>
                <input
                  type="text"
                  placeholder="e.g. Sony FX6, RED, Arri..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-white text-xs outline-none focus:ring-0 placeholder-neutral-600 font-bold mt-0.5"
                />
              </div>
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="p-1 hover:bg-neutral-800 rounded-full text-neutral-400 shrink-0">
                  <X size={10} />
                </button>
              )}
            </div>

            {/* 2. Location Select */}
            <div className="lg:col-span-4 flex items-center gap-2.5 px-3 py-1.5 shrink-0">
              <MapPin size={16} className="text-[#ff4f3a] shrink-0" />
              <div className="flex flex-col w-full">
                <label className="text-[8px] font-black uppercase tracking-widest text-neutral-500 font-bold">Dispatch Location</label>
                <input
                  type="text"
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  className="w-full bg-transparent text-white text-xs outline-none focus:ring-0 font-bold mt-0.5"
                />
              </div>
            </div>

            {/* 3. Search Trigger button */}
            <div className="lg:col-span-2 flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsSearchDrawerOpen(true);
                  toast.success(`Refined filters loaded for "${searchQuery || 'all equipment'}"!`);
                }}
                className="w-full bg-[#ff4f3a] hover:bg-[#e43f2a] active:scale-95 text-white font-black uppercase tracking-wider text-[10px] py-3 rounded-xl transition duration-150 flex items-center justify-center gap-1.5 shadow-md"
              >
                <Search size={12} />
                <span>Search</span>
              </button>
            </div>

          </div>
        </div>

        {/* Dynamic drawer activation indicator trigger button floating on side */}
        <div className="relative z-25 flex justify-end">
          <button
            type="button"
            onClick={() => setIsSearchDrawerOpen(true)}
            className="flex items-center gap-2 bg-[#ff4f3a] text-white text-[10px] font-black uppercase tracking-widest py-2.5 px-4 rounded-xl opacity-90 hover:opacity-100 transition shadow-lg shrink-0 mt-2"
          >
            <SlidersHorizontal size={12} />
            <span>Open Filters Drawer</span>
          </button>
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


      {/* 2. EXPLORE LAYOUT PANEL (Rentals, Buy-Sell, Gigs, Locations - MATCHING SCREENSHOT 1) */}
      <div id="explore-cards-section" className="max-w-7xl mx-auto px-6 md:px-12 py-12 space-y-6">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-neutral-900 uppercase">Explore Packer Marketplace</h2>
          <p className="text-xs text-neutral-400 font-semibold uppercase mt-1 tracking-wider">On-demand production components & services</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Rentals */}
          <div 
            onClick={() => {
              setCurrentMode('rent');
              setSearchQuery('');
              setSelectedCategory(null);
              toast.info("Viewing local gear rentals.");
              const section = document.getElementById('marketplace-products-display');
              if (section) section.scrollIntoView({ behavior: 'smooth' });
            }}
            className="group cursor-pointer border border-neutral-100 bg-neutral-50/40 hover:bg-white hover:border-neutral-200 p-5 rounded-2xl transition duration-200 flex items-start gap-4 shadow-xs"
          >
            <div className="w-10 h-10 bg-indigo-50 text-[#ff4f3a] rounded-xl flex items-center justify-center shrink-0 shadow-inner">
              <Camera size={18} />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-neutral-800 tracking-tight">Rentals</p>
              <p className="text-[10px] text-neutral-400 font-semibold uppercase mt-0.5">Local gear rentals</p>
            </div>
          </div>

          {/* Card 2: Buy & Sell */}
          <div 
            onClick={() => {
              setCurrentMode('buy');
              setSearchQuery('');
              setSelectedCategory(null);
              toast.info("Viewing buy & sell marketplace.");
              const section = document.getElementById('marketplace-products-display');
              if (section) section.scrollIntoView({ behavior: 'smooth' });
            }}
            className="group cursor-pointer border border-neutral-100 bg-neutral-50/40 hover:bg-white hover:border-neutral-200 p-5 rounded-2xl transition duration-200 flex items-start gap-4 shadow-xs"
          >
            <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center shrink-0 shadow-inner">
              <ShoppingBag size={18} />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-neutral-800 tracking-tight">Buy & Sell</p>
              <p className="text-[10px] text-neutral-400 font-semibold uppercase mt-0.5">New & used gear</p>
            </div>
          </div>

          {/* Card 3: Gigs (Hiring) */}
          <div 
            onClick={() => {
              toast.info("Scrolling down to active Freelancers directory");
              const section = document.getElementById('marketplace-crew-display');
              if (section) section.scrollIntoView({ behavior: 'smooth' });
            }}
            className="group cursor-pointer border border-neutral-100 bg-neutral-50/40 hover:bg-white hover:border-neutral-200 p-5 rounded-2xl transition duration-200 flex items-start gap-4 shadow-xs"
          >
            <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center shrink-0 shadow-inner">
              <UserCheck size={18} />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-neutral-800 tracking-tight">Gigs</p>
              <p className="text-[10px] text-neutral-400 font-semibold uppercase mt-0.5">Hire local creatives</p>
            </div>
          </div>

          {/* Card 4: Locations */}
          <div 
            onClick={() => {
              toast.info("Opening map visualization. Over 1,500 qualified studios catalogued");
            }}
            className="group cursor-pointer border border-neutral-100 bg-neutral-50/40 hover:bg-white hover:border-neutral-200 p-5 rounded-2xl transition duration-200 flex items-start gap-4 shadow-xs"
          >
            <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center shrink-0 shadow-inner">
              <MapPin size={18} />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-neutral-800 tracking-tight">Locations</p>
              <p className="text-[10px] text-neutral-400 font-semibold uppercase mt-0.5">For Film, Photo & Editing</p>
            </div>
          </div>

        </div>
      </div>


      {/* 3. DUAL ADVERTISING PROMOTION BANNERS (INSIGHTS AND STUDENT DISCOUNTS - MATCHING SCREENSHOT 1) */}
      {showPromotions && (
        <div id="marketplace-promotions" className="max-w-7xl mx-auto px-6 md:px-12 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Banner A */}
            <div className="bg-[#101524] text-white rounded-[2rem] overflow-hidden p-8 flex flex-col md:flex-row justify-between items-center gap-6 border border-neutral-850 shadow-xl relative">
              <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-sky-500/10 blur-[60px] pointer-events-none" />
              <div className="space-y-4 max-w-sm">
                <span className="inline-block bg-[#ff4f3a] text-white font-extrabold text-[8px] uppercase tracking-widest px-3 py-1 rounded-full">
                  ★ NEW FOR 2026
                </span>
                <h3 className="text-3xl font-black uppercase tracking-tight leading-tight">
                  {bannerATitle}
                </h3>
                <p className="text-neutral-400 text-xs font-medium leading-relaxed uppercase">
                  {bannerASubtitle}
                </p>
                <button 
                  onClick={() => toast.success("Feature action simulated inside this sandbox!")}
                  className="bg-white hover:bg-neutral-100 text-neutral-900 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition transform active:scale-95 text-center block md:inline-block"
                >
                  {bannerAButtonText}
                </button>
              </div>
              
              {/* Image visual object */}
              {bannerAImage && (
                <div className="w-48 h-40 relative rounded-2xl overflow-hidden shadow-2xl bg-neutral-900 border border-white/5">
                  <img 
                    src={bannerAImage} 
                    alt="Promo Banner object" 
                    className="w-full h-full object-cover object-center grayscale hover:grayscale-0 transition duration-500"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
            </div>

            {/* Banner B */}
            <div className="bg-[#1a1b35] text-white rounded-[2rem] overflow-hidden p-8 flex flex-col md:flex-row justify-between items-center gap-6 border border-neutral-850 shadow-xl relative">
              <div className="absolute bottom-0 left-0 w-[150px] h-[150px] bg-indigo-500/10 blur-[60px] pointer-events-none" />
              <div className="space-y-4 max-w-sm">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-black">∞</div>
                  <span className="font-extrabold text-[9px] uppercase tracking-widest text-[#ff4f3a]">
                    {requiresEduVerification ? "Verification Active" : "Special Rate Offer"}
                  </span>
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tight leading-tight">
                  {bannerBTitle}
                </h3>
                <p className="text-neutral-400 text-xs font-medium leading-relaxed uppercase">
                  {bannerBSubtitle}
                </p>
                <button 
                  onClick={() => toast.success("Verification dialog activated in user workspace.")}
                  className="bg-[#ff4f3a] hover:bg-[#e43f2a] text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition transform active:scale-95 text-center block md:inline-block"
                >
                  {bannerBButtonText}
                </button>
              </div>

              {/* Image visual object */}
              {bannerBImage && (
                <div className="w-48 h-40 relative rounded-2xl overflow-hidden shadow-2xl bg-neutral-900 border border-white/5">
                  <img 
                    src={bannerBImage} 
                    alt="Promo Banner Operator" 
                    className="w-full h-full object-cover object-center transform hover:scale-105 transition duration-500"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
            </div>

          </div>
        </div>
      )}


      {/* Dynamic Industry Filter & Layout Selector Header */}
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-6 border-b border-neutral-150 bg-neutral-50/20 mb-4 rounded-3xl">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase text-[#ff4f3a] tracking-widest">Industry focus switcher</p>
              <h3 className="text-sm font-extrabold text-neutral-800 uppercase tracking-tight mt-0.5">Select Sector Ecosystem</h3>
            </div>
            
            {/* View Grid/List & Sorting selector */}
            <div className="flex flex-wrap items-center gap-2.5">
              
              {/* SortingDropdown */}
              <div className="flex items-center gap-1.5 bg-white border border-neutral-200 rounded-xl px-3 py-1.5 shadow-xs">
                <ArrowUpDown size={11} className="text-neutral-400" />
                <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    toast.success(`Sorting updated: ${e.target.value}`);
                  }}
                  className="bg-transparent text-[10px] font-bold text-neutral-700 outline-none cursor-pointer uppercase pr-1"
                >
                  <option value="default">Default Priority</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="rating">Rating (Highest first)</option>
                  <option value="reviews">Reviews count</option>
                </select>
              </div>

              {/* View Layout Toggle */}
              <div className="flex bg-neutral-100 p-0.5 rounded-xl border border-neutral-200">
                <button
                  onClick={() => setViewType('grid')}
                  className={`p-1.5 rounded-lg ${viewType === 'grid' ? 'bg-white text-primary shadow-xs' : 'text-neutral-400 hover:text-neutral-600'}`}
                  title="Grid Layout View"
                >
                  <LayoutGrid size={13} />
                </button>
                <button
                  onClick={() => setViewType('list')}
                  className={`p-1.5 rounded-lg ${viewType === 'list' ? 'bg-white text-primary shadow-xs' : 'text-neutral-400 hover:text-neutral-600'}`}
                  title="List Layout View"
                >
                  <List size={13} />
                </button>
              </div>

            </div>
          </div>

          {/* Industry Buttons Swiper with scrollbar-none */}
          <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-none snap-x whitespace-nowrap scroll-smooth">
            {INDUSTRIES_MARKET.map((ind) => {
              const isSelected = selectedIndustry === ind.id;
              return (
                <button
                  key={ind.id}
                  onClick={() => {
                    setSelectedIndustry(ind.id);
                    setSelectedCategory(null);
                    toast.success(`Active industry changed to: ${ind.name}`);
                  }}
                  className={`px-4 py-2 rounded-2xl border text-[10px] font-extrabold uppercase transition duration-200 tracking-wider shrink-0 snap-align-start ${
                    isSelected 
                      ? 'bg-neutral-900 text-white border-neutral-900 shadow-md' 
                      : 'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                  }`}
                >
                  {ind.name}
                </button>
              );
            })}
          </div>

        </div>
      </div>

      {/* 4. DESIGN BROWSE CATEGORIES CAROUSEL (MATCHING SCREENSHOT 3) */}
      {showCategories && (
        <div id="marketplace-categories-section" className="max-w-7xl mx-auto px-6 md:px-12 py-10 space-y-6">
          <div className="flex items-end justify-between border-b border-neutral-100 pb-4">
            <div>
              <h2 className="text-xl font-extrabold text-neutral-900 uppercase tracking-tight">Browse Categories</h2>
              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mt-1">Near {locationQuery}</p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  toast.success("Filters reset: showing all categories.");
                }}
                className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400 hover:text-black transition"
              >
                View All Categories
              </button>
              <div className="flex gap-1">
                <button 
                  onClick={() => toast.info("Hold & drag to scroll categories horizontally.")}
                  className="w-7 h-7 bg-neutral-50 hover:bg-neutral-100 rounded-full flex items-center justify-center border border-neutral-200 text-neutral-600 transition"
                >
                  <ChevronLeft size={14} />
                </button>
                <button 
                  onClick={() => toast.info("Swipe panels to review more items.")}
                  className="w-7 h-7 bg-neutral-50 hover:bg-neutral-100 rounded-full flex items-center justify-center border border-neutral-200 text-neutral-600 transition"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Brand Logo Directory Horizontal Slider */}
          {dbBrands.length > 0 && (
            <div className="space-y-3 bg-neutral-50/50 p-5 rounded-[2rem] border border-neutral-150 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-black uppercase tracking-widest text-neutral-800">Filter by Brand Directory</h3>
                  <p className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">Quickly drill down to equipment from your favorite manufacturer</p>
                </div>
                {selectedBrandId && (
                  <button
                    onClick={() => {
                      setSelectedBrandId(null);
                      toast.success("Cleared brand filter");
                    }}
                    className="text-[10px] font-black uppercase tracking-wider text-rose-500 hover:text-rose-600 transition"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
              <div className="flex overflow-x-auto gap-3 py-1 pr-4 scrollbar-hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {dbBrands.map((brand) => {
                  const isSelected = selectedBrandId === brand.id;
                  const brandListingsCount = userListings.filter(l => l.brand?.toLowerCase() === brand.name?.toLowerCase() || l.brand?.toLowerCase() === brand.id?.toLowerCase()).length;
                  return (
                    <button
                      key={brand.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedBrandId(null);
                          toast.success("Cleared brand filter");
                        } else {
                          setSelectedBrandId(brand.id);
                          toast.success(`Filtering by ${brand.name}`);
                        }
                      }}
                      className={`flex items-center gap-2.5 px-4 py-2 rounded-2xl border transition duration-200 shrink-0 text-left ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm text-neutral-900'
                          : 'border-neutral-100 bg-white hover:border-neutral-200 hover:bg-neutral-50 text-neutral-600'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-lg overflow-hidden bg-white border border-neutral-150 flex items-center justify-center p-0.5 shrink-0">
                        {brand.logo ? (
                          <img
                            src={brand.logo}
                            alt={brand.name}
                            className="max-w-full max-h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-400 bg-neutral-100 text-[8px] font-black uppercase">
                            {brand.name.slice(0, 2)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-tight leading-none">{brand.name}</p>
                        <p className="text-[8px] text-neutral-400 font-bold uppercase mt-0.5 font-mono">{brandListingsCount} listings</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Categories grid horizontal layout */}
          <div className="flex overflow-x-auto gap-4 py-2 pr-4 scrollbar-hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {activeCategories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <div 
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(isSelected ? null : cat.id);
                    toast.success(isSelected ? "Cleared category filter" : `Showing ${cat.name} only`);
                  }}
                  className={`flex-none w-[170px] bg-neutral-50 hover:bg-white cursor-pointer rounded-2xl p-3 border hover:border-neutral-300 hover:shadow-md transition duration-200 space-y-3 shrink-0 ${isSelected ? 'border-[#ff4f3a] bg-rose-50/10' : 'border-neutral-100'}`}
                >
                  {/* Category block thumb */}
                  <div className="w-full h-24 overflow-hidden rounded-xl bg-neutral-100 relative">
                    <img 
                      src={cat.image} 
                      alt={cat.name} 
                      className="w-full h-full object-cover transform hover:scale-110 transition duration-300"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute bottom-1.5 right-1.5 bg-neutral-900/80 text-white font-mono text-[7.5px] font-bold uppercase tracking-widest px-2 py-0.5 rounded">
                      {cat.count.toLocaleString()} Listings
                    </div>
                  </div>
                  <div className="space-y-0.5 px-0.5">
                    <p className="text-[10px] font-black uppercase text-neutral-800 line-clamp-1 truncate">{cat.name}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* 5. INTERACTIVE PRODUCTS DISPLAY PANELS FOR SELECTION (RENTALS, SHIPPING & BUY COMPILATIONS) */}
      <div id="marketplace-products-display" className="max-w-7xl mx-auto px-6 md:px-12 py-6 space-y-12">
        
        {/* Dynamic header summary matching current mode toggles */}
        <div className="bg-neutral-50 rounded-2xl p-6 border border-neutral-100 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ff4f3a]" />
              <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800">
                Viewing: {currentMode === 'rent' ? 'Popular Equipment for Rent' : 'Hot Equipment Listings for Sale'}
              </h3>
            </div>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
              Filtered to: <span className="text-black font-black">{selectedCategory ? CATEGORIES.find(c => c.id === selectedCategory)?.name : 'All Categories'}</span> 
              {searchQuery && ` containing query "${searchQuery}"`}
            </p>
          </div>

          <div className="flex gap-2">
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-[9px] font-black uppercase tracking-wider hover:bg-neutral-100 transition"
              >
                Clear Category Filter
              </button>
            )}
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-[9px] font-black uppercase tracking-wider hover:bg-neutral-100 transition"
              >
                Clear Search
              </button>
            )}
          </div>
        </div>

        {/* Smart Lens Sub-Taxonomy Filter Panel */}
        {(selectedCategory === 'cinema-lenses' || selectedCategory === 'photography-lenses') && (
          <div className="bg-neutral-50/50 rounded-2xl p-5 border border-neutral-150 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
              <span className="text-xs font-black text-neutral-800 uppercase tracking-wider">🔬 Smart Lens Taxonomy filters</span>
              <button
                onClick={() => {
                  setSelectedLensType(null);
                  setSelectedLensMount(null);
                  toast.success("Lens sub-filters reset");
                }}
                className="text-[9px] font-black uppercase text-rose-500 hover:text-rose-600 transition"
              >
                Reset Specs
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block">Filter Lens Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: null, label: 'All Types' },
                    { id: 'Prime', label: 'Prime' },
                    { id: 'Zoom', label: 'Zoom' },
                    { id: 'Cinema Prime', label: 'Cinema Prime' },
                    { id: 'Cinema Zoom', label: 'Cinema Zoom' },
                    { id: 'Anamorphic', label: 'Anamorphic' }
                  ].map((t) => (
                    <button
                      key={t.id || 'all'}
                      onClick={() => setSelectedLensType(t.id)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition ${
                        selectedLensType === t.id
                          ? 'bg-neutral-900 text-white shadow-xs'
                          : 'bg-white border border-neutral-200 text-neutral-500 hover:bg-neutral-50 hover:border-neutral-300'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block">Filter Lens Mount</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: null, label: 'All Mounts' },
                    { id: 'PL-Mount', label: 'PL Mount' },
                    { id: 'E-Mount', label: 'Sony E' },
                    { id: 'EF-Mount', label: 'Canon EF' },
                    { id: 'RF-Mount', label: 'Canon RF' },
                    { id: 'Z-Mount', label: 'Nikon Z' }
                  ].map((m) => (
                    <button
                      key={m.id || 'all'}
                      onClick={() => setSelectedLensMount(m.id)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition ${
                        selectedLensMount === m.id
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white border border-neutral-200 text-neutral-500 hover:bg-neutral-50 hover:border-neutral-300'
                      }`}
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
        <div className="space-y-6">
          <div className="flex items-center justify-between uppercase">
            <h3 className="text-sm font-black tracking-widest text-[#ff4f3a]">
              {currentMode === 'rent' ? 'Popular Products for Rent' : 'Equipment Listed for Sale'}
            </h3>
            <span className="text-[9px] font-mono font-bold text-neutral-400">Total Items: {loadingListings ? 'Loading...' : filteredProducts.length}</span>
          </div>

          {loadingListings ? (
            viewType === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {Array.from({ length: 10 }).map((_, index) => (
                  <div key={index} className="bg-white rounded-2xl overflow-hidden border border-neutral-100 flex flex-col justify-between h-[360px] animate-pulse">
                    <div className="h-44 w-full bg-neutral-100" />
                    <div className="p-4 space-y-3 flex-grow flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="h-3 bg-neutral-200/60 rounded w-1/4 animate-pulse" />
                        <div className="h-5 bg-neutral-200/60 rounded w-3/4 animate-pulse" />
                        <div className="h-3 bg-neutral-200/60 rounded w-1/2 animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <div className="h-3 bg-neutral-200/60 rounded w-1/3 animate-pulse" />
                        <div className="h-4 bg-neutral-200/60 rounded w-1/4 animate-pulse" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-4 w-full max-w-full overflow-hidden">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="bg-white rounded-2xl border border-neutral-100 p-4 flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center w-full animate-pulse">
                    <div className="h-40 sm:h-32 w-full sm:w-44 bg-neutral-100 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-3 py-2 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="h-3 bg-neutral-200/60 rounded w-16" />
                        <div className="h-3 bg-neutral-200/60 rounded w-12" />
                      </div>
                      <div className="h-6 bg-neutral-200/60 rounded w-2/3" />
                      <div className="h-4 bg-neutral-200/60 rounded w-1/2" />
                      <div className="h-3 bg-neutral-200/60 rounded w-24" />
                    </div>
                    <div className="w-full sm:w-32 flex flex-col items-stretch sm:items-end gap-2 shrink-0">
                      <div className="h-4 bg-neutral-200/60 rounded w-16" />
                      <div className="h-8 bg-neutral-200/60 rounded w-24 sm:w-full" />
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-neutral-100 rounded-[2rem] space-y-4">
              <ShieldAlert size={32} className="mx-auto text-neutral-300 animate-pulse" />
              <p className="text-[10px] font-black tracking-widest uppercase">No exact matches in catalog database</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory(null);
                  toast.success("Filters cleared!");
                }}
                className="bg-neutral-900 text-white rounded-xl py-2 px-4 text-[9px] font-black tracking-widest uppercase"
              >
                Reset Searches
              </button>
            </div>
          ) : viewType === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {filteredProducts.map((product) => {
                const isFav = favoriteItems.has(product.id);
                return (
                  <div 
                    key={product.id}
                    onClick={() => {
                      if (product.isUserListing) {
                        navigate('/marketplace/' + product.id);
                      } else {
                        setSelectedProduct(product);
                        setIsBookingModalOpen(true);
                      }
                    }}
                    className={`group cursor-pointer bg-white rounded-2xl overflow-hidden hover:shadow-xl transition duration-300 flex flex-col justify-between ${
                      product.sponsored ? 'border-2 border-indigo-600/30 bg-indigo-50/5' :
                      product.featured ? 'border-2 border-amber-500/30' : 'border border-neutral-100'
                    }`}
                  >
                    {/* Item Image with favorite trigger */}
                    <div className="h-44 w-full bg-neutral-50 relative overflow-hidden shrink-0">
                      <img 
                        src={product.image} 
                        alt={product.name} 
                        className="w-full h-full object-cover object-center transform group-hover:scale-105 transition duration-500"
                        referrerPolicy="no-referrer"
                      />
                      
                      {/* Top elements */}
                      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                        {product.sponsored ? (
                          <span className="bg-indigo-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded tracking-wide shadow-sm flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                            Sponsored Ad
                          </span>
                        ) : product.featured ? (
                          <span className="bg-amber-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded tracking-wide shadow-sm">
                            ★ Staff Pick
                          </span>
                        ) : product.isSale ? (
                          <span className="bg-[#ff4f3a] text-white text-[8px] font-black uppercase px-2 py-0.5 rounded tracking-wide shadow-sm">
                            For Sale
                          </span>
                        ) : product.instantBook ? (
                          <span className="bg-emerald-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded tracking-wide shadow-sm">
                            Instant Book
                          </span>
                        ) : (
                          <span className="bg-neutral-900/60 text-white text-[7.5px] font-black uppercase px-1.5 py-0.5 rounded tracking-wide backdrop-blur-md">
                            Daily Rent
                          </span>
                        )}

                        <button
                          onClick={(e) => toggleFavorite(product.id, e)}
                          className="w-7 h-7 bg-white/90 rounded-full flex items-center justify-center text-neutral-500 hover:text-[#ff4f3a] transition shadow shadow-neutral-350"
                        >
                          <Heart size={14} className={isFav ? 'fill-red-500 text-red-500' : ''} />
                        </button>
                      </div>

                      {/* Bottom shipping banner */}
                      {product.isShipped && (
                        <div className="absolute bottom-0 left-0 right-0 bg-blue-650/90 bg-indigo-900 text-white text-center py-1 text-[7.5px] uppercase tracking-widest font-black">
                          🚚 {product.shippingDays}-5 Days Shipped Delivery
                        </div>
                      )}
                    </div>

                    {/* Meta data */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {product.brand && (() => {
                            const brandObj = dbBrands.find(b => b.name?.toLowerCase() === product.brand.toLowerCase() || b.id?.toLowerCase() === product.brand.toLowerCase());
                            return brandObj?.logo ? (
                              <img
                                src={brandObj.logo}
                                alt={product.brand}
                                className="h-3 w-auto object-contain rounded opacity-75 shrink-0"
                                referrerPolicy="no-referrer"
                              />
                            ) : null;
                          })()}
                          <p className="text-[9px] font-mono font-bold text-neutral-400 uppercase tracking-widest truncate">
                            {product.brand}
                          </p>
                        </div>
                        <h4 className="text-[10.5px] font-black uppercase text-neutral-800 line-clamp-2 leading-snug group-hover:text-black" title={product.name}>
                          {product.name}
                        </h4>
                        {(product.category === 'cinema-lenses' || product.category === 'photography-lenses') && (product.lensType || product.lensMount) && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {product.lensType && (
                              <span className="px-1.5 py-0.5 bg-neutral-100 text-neutral-600 rounded text-[7.5px] font-black uppercase tracking-wider font-sans border border-neutral-150">
                                {product.lensType}
                              </span>
                            )}
                            {product.lensMount && (
                              <span className="px-1.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded text-[7.5px] font-black uppercase tracking-wider font-sans">
                                {product.lensMount}
                              </span>
                            )}
                          </div>
                        )}
                        {product.sponsored && product.adHeadline && (
                          <div className="mt-1.5 px-2 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-[8px] font-extrabold text-indigo-700 select-none leading-normal">
                            📢 {product.adHeadline}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        {/* Rating row */}
                        <div className="flex items-center gap-1">
                          <Star size={10} className="fill-amber-400 text-amber-400 shrink-0" />
                          <span className="text-[9.5px] font-black text-neutral-700">{product.rating}</span>
                          <span className="text-[8.5px] text-neutral-400 font-bold uppercase">({product.reviews} reviews)</span>
                        </div>

                        {/* Owner details */}
                        {product.ownerName && (
                          <div className="flex items-center gap-1 border-t border-neutral-100 pt-1.5 text-[8.5px] text-neutral-400 font-bold uppercase tracking-wider">
                            <span>Owner: </span>
                            <span className="text-neutral-600 truncate">{product.ownerName}</span>
                          </div>
                        )}

                        {/* Pricing details */}
                        <div className="flex items-baseline justify-between pt-1 border-t border-neutral-50">
                          <div>
                            <span className="text-sm font-black text-neutral-900">
                              {currencySymbol}{product.price ? product.price.toLocaleString() : 'Call'}
                            </span>
                            <span className="text-[8.5px] text-neutral-400 font-bold uppercase ml-0.5">
                              {product.isSale ? '' : '/day'}
                            </span>
                          </div>
                          
                          {product.originalPrice && (
                            <span className="text-[9px] text-neutral-400 line-through font-bold">
                              {currencySymbol}{product.originalPrice.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Premium List View Row Layout */
            <div className="flex flex-col gap-4 w-full max-w-full overflow-hidden">
              {filteredProducts.map((product) => {
                const isFav = favoriteItems.has(product.id);
                return (
                  <div 
                    key={product.id}
                    onClick={() => {
                      if (product.isUserListing) {
                        navigate('/marketplace/' + product.id);
                      } else {
                        setSelectedProduct(product);
                        setIsBookingModalOpen(true);
                      }
                    }}
                    className={`group cursor-pointer bg-white rounded-2xl overflow-hidden hover:shadow-xl transition duration-300 border p-4 flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center w-full max-w-full ${
                      product.sponsored ? 'border-indigo-600/30 bg-indigo-55/10 bg-indigo-50/5' :
                      product.featured ? 'border-amber-500/30' : 'border-neutral-100'
                    }`}
                  >
                    {/* List Left: Visual image frame */}
                    <div className="h-40 sm:h-32 w-full sm:w-44 bg-neutral-50 relative overflow-hidden rounded-xl shrink-0">
                      <img 
                        src={product.image} 
                        alt={product.name} 
                        className="w-full h-full object-cover object-center transform group-hover:scale-105 transition duration-500"
                        referrerPolicy="no-referrer"
                      />
                      
                      <div className="absolute top-2 left-2 flex flex-col gap-1">
                        {product.sponsored ? (
                          <span className="bg-indigo-600 text-white text-[6.5px] font-black uppercase px-1.5 py-0.5 rounded tracking-wide font-mono">
                            Sponsored
                          </span>
                        ) : product.featured ? (
                          <span className="bg-amber-500 text-white text-[6.5px] font-black uppercase px-1.5 py-0.5 rounded tracking-wide font-mono">
                            ★ Staff Pick
                          </span>
                        ) : product.isSale ? (
                          <span className="bg-[#ff4f3a] text-white text-[7px] font-black uppercase px-1.5 py-0.5 rounded tracking-wide font-mono">
                            For Sale
                          </span>
                        ) : null}
                      </div>

                      <button
                        onClick={(e) => toggleFavorite(product.id, e)}
                        className="absolute bottom-2 right-2 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center text-neutral-500 hover:text-[#ff4f3a] transition shadow"
                      >
                        <Heart size={12} className={isFav ? 'fill-red-500 text-red-500' : ''} />
                      </button>
                    </div>

                    {/* List Middle: Descriptive items */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[8.5px] font-mono font-bold text-neutral-400 uppercase tracking-widest">{product.brand}</span>
                        {product.industry && (
                          <span className="text-[7.5px] bg-neutral-100 text-neutral-500 font-extrabold uppercase px-1.5 py-0.2 rounded tracking-wide font-mono">
                            {product.industry}
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs sm:text-sm font-black uppercase text-neutral-800 line-clamp-1 leading-snug group-hover:text-black">
                        {product.name}
                      </h4>
                      
                      {/* Rating details & Owner details in list format */}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1">
                          <Star size={10} className="fill-amber-400 text-amber-400 shrink-0" />
                          <span className="text-[9.5px] font-black text-neutral-700">{product.rating}</span>
                          <span className="text-[8.5px] text-neutral-400 font-bold uppercase">({product.reviews} reviews)</span>
                        </div>
                        {product.ownerName && (
                          <div className="hidden sm:block text-[8.5px] text-neutral-400 font-bold uppercase tracking-wider">
                            <span>Owner: </span>
                            <span className="text-neutral-600">{product.ownerName}</span>
                          </div>
                        )}
                        {product.isShipped && (
                          <span className="text-[7.5px] bg-indigo-50 text-indigo-750 text-indigo-650 font-black uppercase px-2 py-0.5 rounded">
                            🚚 Priority Shipping Available
                          </span>
                        )}
                      </div>

                      {product.sponsored && product.adHeadline && (
                        <p className="text-[9px] font-semibold text-indigo-600">📢 {product.adHeadline}</p>
                      )}
                    </div>

                    {/* List Right: Dynamic pricing and book button */}
                    <div className="flex sm:flex-col justify-between sm:justify-center items-center sm:items-end gap-3 shrink-1 sm:shrink-0 w-full sm:w-auto border-t sm:border-t-0 border-neutral-150 pt-3 sm:pt-0">
                      <div className="text-right">
                        <p className="text-[8.5px] text-neutral-400 font-bold uppercase">Estimated rate</p>
                        <div className="flex items-baseline justify-end">
                          <span className="text-base font-black text-neutral-900 leading-none">
                            {currencySymbol}{product.price ? product.price.toLocaleString() : 'Call'}
                          </span>
                          <span className="text-[8.5px] text-neutral-400 font-bold uppercase ml-0.5">
                            {product.isSale ? '' : '/day'}
                          </span>
                        </div>
                      </div>

                      <button
                        className="bg-neutral-900 text-white rounded-xl py-1.5 px-4 text-[9px] font-black tracking-widest uppercase hover:bg-[#ff4f3a] transition duration-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProduct(product);
                          setIsBookingModalOpen(true);
                        }}
                      >
                        {product.isSale ? 'Inquire' : 'Rent Now'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 5B. RENTALS SHIPPED TO YOU (ONLY VISIBLE ON RENT MODE - MATCHING SCREENSHOT 3) */}
        {showShippedToYou && currentMode === 'rent' && (
          <div className="space-y-6 pt-6 border-t border-neutral-100">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-[#ff4f3a]">Rentals Shipped to You</h3>
              <p className="text-[10px] text-neutral-400 font-bold uppercase mt-1 tracking-wider">Rentals shipped directly to your doorstep with damage protection</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {getShippedItems().slice(0, 5).map((product) => {
                const isFav = favoriteItems.has(product.id);
                return (
                  <div 
                    key={product.id}
                    onClick={() => {
                      setSelectedProduct(product);
                      setIsBookingModalOpen(true);
                    }}
                    className="group cursor-pointer bg-white rounded-2xl border border-neutral-100 overflow-hidden hover:border-neutral-300 hover:shadow-xl transition duration-200 flex flex-col justify-between"
                  >
                    <div className="h-40 w-full bg-neutral-50 relative overflow-hidden shrink-0">
                      <img 
                        src={product.image} 
                        alt={product.name} 
                        className="w-full h-full object-cover transform group-hover:scale-105 transition duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
                        <span className="bg-indigo-600 text-white text-[7px] font-black uppercase px-2 py-0.5 rounded">
                          Shipped
                        </span>
                        <button
                          onClick={(e) => toggleFavorite(product.id, e)}
                          className="w-6 h-6 bg-white/95 rounded-full flex items-center justify-center text-neutral-500 hover:text-[#ff4f3a]"
                        >
                          <Heart size={12} className={isFav ? 'fill-red-500 text-red-500' : ''} />
                        </button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-indigo-900 text-white text-center py-1 text-[7px] uppercase tracking-widest font-black">
                        3-5 Days Free Express
                      </div>
                    </div>

                    <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                      <div className="space-y-1">
                        <p className="text-[8px] font-mono text-neutral-400 uppercase tracking-widest">{product.brand}</p>
                        <h4 className="text-[10px] font-black uppercase text-neutral-800 line-clamp-1">{product.name}</h4>
                      </div>

                      <div className="space-y-1 text-[8.5px] font-bold text-neutral-500 uppercase">
                        <div>Price: <span className="text-neutral-900 font-extrabold">{currencySymbol}{product.price}/day</span></div>
                        <div className="truncate">Source: {product.ownerName}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>


      {/* FEATURED GEAR SECTION */}
      {showFeatured && (
        <div id="featured-gear-section" className="max-w-7xl mx-auto px-6 md:px-12 py-12 space-y-8">
          <div>
            <h2 className="text-xl font-extrabold text-neutral-900 uppercase tracking-tight">Featured Gear</h2>
            <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider mt-1">Premium visual equipment handpicked for our network near {locationQuery}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {getFeaturedItems().slice(0, 4).map((product) => {
              const isFav = favoriteItems.has(product.id);
              return (
                <div 
                  key={product.id}
                  onClick={() => {
                    setSelectedProduct(product);
                    setIsBookingModalOpen(true);
                  }}
                  className="group cursor-pointer bg-white rounded-3xl border border-neutral-100 overflow-hidden hover:shadow-2xl transition duration-200 flex flex-col justify-between"
                >
                  <div className="h-44 w-full bg-neutral-50 relative overflow-hidden shrink-0">
                    <img 
                      src={product.image} 
                      alt={product.name} 
                      className="w-full h-full object-cover object-center transform group-hover:scale-105 transition duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                      <span className="bg-yellow-400 text-neutral-900 text-[8px] font-black uppercase px-2 py-0.5 rounded tracking-wider shadow">
                        ★ FEATURED
                      </span>
                      <button
                        onClick={(e) => toggleFavorite(product.id, e)}
                        className="w-7 h-7 bg-white/95 rounded-full flex items-center justify-center text-neutral-500 hover:text-red-500"
                      >
                        <Heart size={14} className={isFav ? 'fill-red-500 text-red-500' : ''} />
                      </button>
                    </div>
                  </div>

                  <div className="p-5 space-y-3.5 flex-1 flex flex-col justify-between">
                    <div className="space-y-1">
                      <p className="text-[8.5px] font-mono text-neutral-400 uppercase tracking-widest">{product.brand}</p>
                      <h4 className="text-[10.5px] font-black uppercase text-neutral-800 line-clamp-2 leading-relaxed" title={product.name}>
                        {product.name}
                      </h4>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                      <div>
                        <span className="text-sm font-black text-[#ff4f3a]">{currencySymbol}{product.price}</span>
                        <span className="text-[8.5px] text-neutral-400 font-semibold uppercase">/day</span>
                      </div>
                      <span className="text-[8.5px] text-neutral-400 font-black uppercase tracking-wider">
                        ⚡ INSTANT BOOK
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* LATEST GEAR SECTION */}
      {showLatestGear && (
        <div id="latest-gear-section" className="bg-neutral-50 py-16 border-y border-neutral-100 mb-6">
          <div className="max-w-7xl mx-auto px-6 md:px-12 space-y-8 animate-in fade-in duration-300">
            <div>
              <span className="bg-emerald-600 text-white text-[8px] font-black uppercase px-2.5 py-1 rounded-full tracking-wider shadow-sm">
                Newly Onboarded
              </span>
              <h2 className="text-xl font-extrabold text-neutral-900 uppercase tracking-tight mt-3">Latest Gear near {locationQuery}</h2>
              <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider mt-1">Automatically displaying recently listed products listed by organization members</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {getLatestItems().slice(0, 4).map((product) => {
                const isFav = favoriteItems.has(product.id);
                return (
                  <div 
                    key={product.id}
                    onClick={() => {
                      setSelectedProduct(product);
                      setIsBookingModalOpen(true);
                    }}
                    className="group cursor-pointer bg-white rounded-3xl border border-neutral-100 overflow-hidden hover:shadow-2xl transition duration-200 flex flex-col justify-between"
                  >
                    <div className="h-44 w-full bg-neutral-50 relative overflow-hidden shrink-0">
                      <img 
                        src={product.image} 
                        alt={product.name} 
                        className="w-full h-full object-cover object-center transform group-hover:scale-105 transition duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                        <span className="bg-emerald-600 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded tracking-wider shadow">
                          🆕 NEWLY LISTED
                        </span>
                        <button
                          onClick={(e) => toggleFavorite(product.id, e)}
                          className="w-7 h-7 bg-white/95 rounded-full flex items-center justify-center text-neutral-500 hover:text-red-500"
                        >
                          <Heart size={14} className={isFav ? 'fill-red-500 text-red-500' : ''} />
                        </button>
                      </div>
                    </div>

                    <div className="p-5 space-y-3.5 flex-1 flex flex-col justify-between">
                      <div className="space-y-1">
                        <p className="text-[8.5px] font-mono text-neutral-400 uppercase tracking-widest">{product.brand}</p>
                        <h4 className="text-[10.5px] font-black uppercase text-neutral-800 line-clamp-2 leading-relaxed" title={product.name}>
                          {product.name}
                        </h4>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                        <div>
                          <span className="text-sm font-black text-[#ff4f3a]">{currencySymbol}{product.price}</span>
                          <span className="text-[8.5px] text-neutral-400 font-semibold uppercase">/day</span>
                        </div>
                        <span className="text-[8.5px] text-neutral-400 font-bold uppercase tracking-wider">
                          {product.ownerName || 'Verified List'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}


      {/* POPULAR ITEMS / REVERED SECTOR GEAR SECTION */}
      {showPopularItems && (
        <div id="popular-gear-section" className="max-w-7xl mx-auto px-6 md:px-12 py-12 space-y-8">
          <div>
            <h2 className="text-xl font-extrabold text-neutral-900 uppercase tracking-tight">Most Popular Equipment</h2>
            <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider mt-1">High-utilization camera bodies and prime optics checked out this week</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {getPopularItems().slice(0, 4).map((product) => {
              const isFav = favoriteItems.has(product.id);
              return (
                <div 
                  key={product.id}
                  onClick={() => {
                    setSelectedProduct(product);
                    setIsBookingModalOpen(true);
                  }}
                  className="group cursor-pointer bg-white rounded-3xl border border-neutral-100 overflow-hidden hover:shadow-2xl transition duration-200 flex flex-col justify-between"
                >
                  <div className="h-44 w-full bg-neutral-50 relative overflow-hidden shrink-0">
                    <img 
                      src={product.image} 
                      alt={product.name} 
                      className="w-full h-full object-cover object-center transform group-hover:scale-105 transition duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                      <span className="bg-[#ff4f3a] text-white text-[8px] font-black uppercase px-2 py-0.5 rounded tracking-wider shadow">
                        🔥 HOT PICK
                      </span>
                      <button
                        onClick={(e) => toggleFavorite(product.id, e)}
                        className="w-7 h-7 bg-white/95 rounded-full flex items-center justify-center text-neutral-500 hover:text-red-500"
                      >
                        <Heart size={14} className={isFav ? 'fill-red-500 text-red-500' : ''} />
                      </button>
                    </div>
                  </div>

                  <div className="p-5 space-y-3.5 flex-1 flex flex-col justify-between">
                    <div className="space-y-1">
                      <p className="text-[8.5px] font-mono text-neutral-400 uppercase tracking-widest">{product.brand}</p>
                      <h4 className="text-[10.5px] font-black uppercase text-neutral-800 line-clamp-2 leading-relaxed" title={product.name}>
                        {product.name}
                      </h4>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                      <div>
                        <span className="text-sm font-black text-[#ff4f3a]">{currencySymbol}{product.price}</span>
                        <span className="text-[8.5px] text-neutral-400 font-semibold uppercase">/day</span>
                      </div>
                      <span className="text-[8.5px] text-neutral-400 font-bold uppercase tracking-wider flex items-center gap-1">
                        <Star size={10} className="fill-amber-400 text-amber-400 text-yellow-500" />
                        <span>4.9 ({product.reviews || 12})</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {showStaffPicks && (
        <div id="staff-picks-section" className="max-w-7xl mx-auto px-6 md:px-12 py-16 space-y-8">
          <div>
            <h2 className="text-xl font-extrabold text-neutral-900 uppercase tracking-tight">Staff Rental Picks</h2>
            <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider mt-1">Handpicked rigs verified for compatibility and output quality near {locationQuery}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {getStaffPicksItems().map((product) => {
              const isFav = favoriteItems.has(product.id);
              return (
                <div 
                  key={product.id}
                  onClick={() => {
                    setSelectedProduct(product);
                    setIsBookingModalOpen(true);
                  }}
                  className="group cursor-pointer bg-white rounded-3xl border border-neutral-105 overflow-hidden hover:shadow-2xl transition duration-200 flex flex-col justify-between shadow-xs"
                >
                  <div className="h-44 w-full bg-neutral-50 relative overflow-hidden shrink-0">
                    <img 
                      src={product.image} 
                      alt={product.name} 
                      className="w-full h-full object-cover object-center transform group-hover:scale-105 transition duration-550"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                      <span className="bg-[#ff4f3a] text-white text-[8px] font-black uppercase px-2 py-0.5 rounded tracking-wider shadow">
                        ★ STAFF PICK
                      </span>
                      <button
                        onClick={(e) => toggleFavorite(product.id, e)}
                        className="w-7 h-7 bg-white/95 rounded-full flex items-center justify-center text-neutral-500 hover:text-red-500"
                      >
                        <Heart size={14} className={isFav ? 'fill-red-500 text-red-500' : ''} />
                      </button>
                    </div>
                  </div>

                  <div className="p-5 space-y-3.5 flex-1 flex flex-col justify-between">
                    <div className="space-y-1">
                      <p className="text-[8.5px] font-mono text-neutral-400 uppercase tracking-widest">{product.brand}</p>
                      <h4 className="text-[10.5px] font-black uppercase text-neutral-800 line-clamp-2 leading-relaxed" title={product.name}>
                        {product.name}
                      </h4>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
                      <div>
                        <span className="text-sm font-black text-[#ff4f3a]">{currencySymbol}{product.price}</span>
                        <span className="text-[8.5px] text-neutral-400 font-semibold uppercase">/day</span>
                      </div>
                      <span className="text-[8.5px] text-neutral-400 font-black uppercase tracking-wider">
                        ⚡ INSTANT BOOK
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* 8. LIST YOUR GEAR PANEL CTA (MATCHING SCREENSHOT 5) */}
      {showGuarantees && (
        <div id="list-your-gear-banner" className="max-w-7xl mx-auto px-6 md:px-12 py-10">
          <div className="bg-neutral-50 rounded-[3rem] p-10 md:p-14 text-center border border-neutral-150 space-y-8 max-w-5xl mx-auto shadow-xl relative overflow-hidden">
            {/* Top circle aesthetic decoration */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-rose-500/5 blur-[50px] rounded-full pointer-events-none" />

            <div className="space-y-4">
              <h2 className="text-3xl md:text-4xl font-extrabold text-neutral-900 tracking-tight uppercase">
                Rent or Sell your Camera Gear
              </h2>
              <p className="text-neutral-550 text-xs font-semibold leading-relaxed max-w-2xl mx-auto uppercase tracking-wider text-neutral-400">
                Join thousands of gear owners who have listed over <span className="font-extrabold text-neutral-900">$1 billion</span> worth of professional gear catalogued.
              </p>
            </div>

            {/* Core values block columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left py-6 md:py-10">
              {/* Sub column 1 */}
              <div className="bg-white border border-neutral-150 rounded-3xl p-6 md:p-6 space-y-3.5 shadow-md hover:shadow-lg transition-all duration-300">
                <div className="w-10 h-10 bg-rose-50 text-[#ff4f3a] rounded-xl flex items-center justify-center shrink-0">
                  <DollarSign size={18} />
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-xs font-black uppercase text-neutral-800 tracking-wider">Earn money renting your gear</h4>
                  <p className="text-[10px] text-neutral-500 leading-relaxed font-semibold uppercase">
                    Put your gear to work while you aren't using it. Meet local creatives and make extra cash renting your scope to them. Soon, your gear will pay for itself!
                  </p>
                </div>
              </div>

              {/* Sub column 2 */}
              <div className="bg-white border border-neutral-150 rounded-3xl p-6 md:p-6 space-y-3.5 shadow-md hover:shadow-lg transition-all duration-300">
                <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center shrink-0">
                  <ShoppingBag size={18} />
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-xs font-black uppercase text-neutral-800 tracking-wider">Sell your gear, keep more of your money</h4>
                  <p className="text-[10px] text-[#ff4f3a] leading-relaxed font-black uppercase">
                    Promote your gear to a vibrant community of filmmakers and photographers nationwide, enjoy significant seller protections, and only pay a 5% fee - with a maximum cap of $500.
                  </p>
                </div>
              </div>

              {/* Sub column 3 */}
              <div className="bg-white border border-neutral-150 rounded-3xl p-6 md:p-6 space-y-3.5 shadow-md hover:shadow-lg transition-all duration-300">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center shrink-0">
                  <CheckCircle2 size={18} />
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-xs font-black uppercase text-neutral-800 tracking-wider">Renter & Seller Guarantees</h4>
                  <p className="text-[10px] text-neutral-500 leading-relaxed font-semibold uppercase">
                    Integrate premium insurance coverages. Packer Tools offers an extensive selection of coverage options as well as renter and seller guarantees to ensure everyone feels safe and protected.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3.5 pt-4">
              <button
                onClick={handleOpenListGear}
                className="inline-flex bg-[#ff4f3a] hover:bg-[#e43f2a] hover:scale-[1.02] text-white font-black text-xs uppercase tracking-widest px-10 py-4 rounded-xl shadow-xl transition"
              >
                List your gear
              </button>
              <div className="flex justify-center gap-6 text-[9.5px] font-black uppercase tracking-wider text-neutral-450 text-neutral-500">
                <span onClick={() => { navigate('/help?category=packer-tools-academy'); toast.info("Renting guides loaded in Help Center!"); }} className="cursor-pointer hover:text-black transition underline">Learn about renting</span>
                <span onClick={() => { navigate('/help?category=getting-started'); toast.info("Selling policies loaded in Help Center!"); }} className="cursor-pointer hover:text-black transition underline">Learn about selling</span>
              </div>
            </div>

          </div>
        </div>
      )}


      {/* Custom dark footer removed and integrated into global bottom corporate footer */}


      {/* DETAIL DIALOG / BOOKING MODAL FOR PRODUCTS */}
      <AnimatePresence>
        {isBookingModalOpen && selectedProduct && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsBookingModalOpen(false);
                setSelectedProduct(null);
              }}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] p-8 border border-neutral-100 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[8px] font-black uppercase tracking-widest text-[#ff4f3a] flex items-center gap-1.5">
                    {selectedProduct.brand && (() => {
                      const brandObj = dbBrands.find(b => b.name?.toLowerCase() === selectedProduct.brand.toLowerCase() || b.id?.toLowerCase() === selectedProduct.brand.toLowerCase());
                      return brandObj?.logo ? (
                        <img
                          src={brandObj.logo}
                          alt={selectedProduct.brand}
                          className="h-2.5 w-auto object-contain rounded opacity-75 inline"
                          referrerPolicy="no-referrer"
                        />
                      ) : null;
                    })()}
                    <span>{selectedProduct.brand} • {selectedProduct.model || 'GENERIC'}</span>
                  </span>
                  <h3 className="text-lg font-black uppercase tracking-tighter text-neutral-800 mt-1">
                    Book Placement: {selectedProduct.name}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setIsBookingModalOpen(false);
                    setSelectedProduct(null);
                  }}
                  className="bg-neutral-105 hover:bg-neutral-200 text-neutral-600 p-1 px-1.5 rounded-lg text-xs transition"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Product Preview box */}
              <div className="flex gap-4 border-y border-neutral-100 py-4">
                <div className="w-20 h-20 bg-neutral-50 rounded-xl overflow-hidden shrink-0">
                  <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="space-y-1 my-auto">
                  <div className="flex items-center gap-1">
                    <Star size={10} className="fill-amber-400 text-amber-400" />
                    <span className="text-[10px] font-black text-neutral-700">{selectedProduct.rating} ({selectedProduct.reviews} reviews)</span>
                  </div>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase mt-0.5 font-mono">Listed Price: {currencySymbol}{selectedProduct.price}{selectedProduct.isSale ? '' : '/day'}</p>
                  <p className="text-[9px] text-[#ff4f3a] font-extrabold uppercase">Owner Verified: {selectedProduct.ownerName || 'Verified Partner'}</p>
                </div>
              </div>

              {/* Form Input fields */}
              <form onSubmit={handleBookingSubmit} className="space-y-4">
                {!selectedProduct.isSale ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Rental duration (Days)</label>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        {[1, 3, 7, 14].map((days) => (
                          <button
                            key={days}
                            type="button"
                            onClick={() => {
                              setBookingDays(days);
                              const start = new Date(rentStartDate);
                              const newEnd = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
                              setRentEndDate(newEnd.toISOString().split('T')[0]);
                            }}
                            className={`py-2 rounded-xl text-xs font-black transition-all ${bookingDays === days ? 'bg-[#ff4f3a] text-white shadow-md' : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700'}`}
                          >
                            {days} {days === 1 ? 'Day' : 'Days'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Compact Date/Time inputs inside Booking Process */}
                    <div className="grid grid-cols-2 gap-3 pt-1 border-t border-neutral-100/65 text-left">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Pick-up Date</label>
                        <input 
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
                          className="w-full bg-neutral-50 hover:bg-neutral-100 text-neutral-800 text-xs font-bold border border-neutral-200/60 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-[#ff4f3a]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Drop-off Date</label>
                        <input 
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
                          className="w-full bg-neutral-50 hover:bg-neutral-100 text-neutral-800 text-xs font-bold border border-neutral-200/60 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-[#ff4f3a]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1 text-left">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Pick-up Time</label>
                      <input 
                        type="time"
                        value={rentTime}
                        onChange={(e) => setRentTime(e.target.value)}
                        className="w-full bg-neutral-50 hover:bg-neutral-100 text-neutral-800 text-xs font-bold border border-neutral-200/60 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-[#ff4f3a]"
                      />
                    </div>

                    {/* Customizable Pickup and Dropoff Widget */}
                    <div className="space-y-1 text-left">
                      <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Dispatch Routing Logistics</label>
                      <PickupDropoffWidget 
                        onChange={setPickupDropoffState} 
                        initialState={{
                          pickupType: selectedProduct?.pickupType || 'preset',
                          pickupLocationId: selectedProduct?.pickupLocationId || 'suva_depot',
                          pickupCustomAddress: selectedProduct?.pickupCustomAddress || '',
                          dropoffType: selectedProduct?.dropoffType || 'preset',
                          dropoffLocationId: selectedProduct?.dropoffLocationId || 'suva_depot',
                          dropoffCustomAddress: selectedProduct?.dropoffCustomAddress || '',
                        }}
                      />
                    </div>

                    {/* Optional Rental Add-ons Checklist */}
                    {selectedProduct.addOns && selectedProduct.addOns.length > 0 && (
                      <div className="space-y-2 border-t border-neutral-100 pt-3 text-left">
                        <label className="text-[9px] font-black uppercase tracking-widest text-[#ff4f3a]">Optional Rental Add-Ons</label>
                        <p className="text-[10px] text-neutral-400 leading-normal">Rent these bundled accessories at heavily promotional rates:</p>
                        <div className="border border-neutral-100 rounded-2xl divide-y divide-neutral-100 overflow-hidden bg-neutral-50/50">
                          {selectedProduct.addOns.map((add, idx) => {
                            const isSelected = selectedAddOns.has(idx);
                            return (
                              <label key={idx} className="flex items-center justify-between p-2.5 hover:bg-neutral-50 cursor-pointer select-none transition">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {
                                      const updated = new Set(selectedAddOns);
                                      if (isSelected) {
                                        updated.delete(idx);
                                      } else {
                                        updated.add(idx);
                                      }
                                      setSelectedAddOns(updated);
                                    }}
                                    className="h-4 w-4 text-[#ff4f3a] border-neutral-300 rounded focus:ring-0 cursor-pointer"
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-bold text-[11px] text-neutral-800">{add.name}</span>
                                    {add.notes && (
                                      <span className="text-[9px] text-neutral-400 font-medium italic">{add.notes}</span>
                                    )}
                                    <span className="text-[9px] text-[#ff4f3a]/80 font-bold uppercase tracking-wide">
                                      {add.type ? (() => {
                                        switch (add.type) {
                                          case 'Organizer': return '🎒 Organizer';
                                          case 'Accessory': return '🕶️ Accessory';
                                          case 'Consumable': return '🔋 Consumable';
                                          case 'Attachment': return '⛓️ Attachment';
                                          case 'Add On': return '🔌 Add-On';
                                          case 'Software': return '💿 Software';
                                          case 'Mod': return '🔧 Custom Mod';
                                          default: return '📦 Ancillary';
                                        }
                                      })() : '🕶️ Accessory'}
                                    </span>
                                  </div>
                                </div>
                                <span className="font-extrabold text-xs text-emerald-600">
                                  {add.price === 0 ? 'FREE' : `+ ${currencySymbol}${add.price}/day`}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-rose-50/50 p-4 border border-rose-100/50 rounded-2xl text-[10px] text-neutral-500 leading-relaxed">
                    <span className="font-black uppercase text-[#ff4f3a]">Buy Out Option Selected</span><br/>
                    Standard seller security escorting is active. An invoice and escrow voucher will generate for you upon dispatch request.
                  </div>
                )}

                {/* Submitting booking checkout summary details */}
                {(() => {
                  const { subtotal, taxAmount, damageWaiver, totalQuote, isInclusive, taxPercent } = calculateTaxAndTotal();
                  return (
                    <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100 space-y-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500">Estimate Pricing Breakdown</p>
                      
                      <div className="flex justify-between items-center text-xs text-neutral-600">
                        <span className="font-semibold uppercase text-[9px]">{selectedProduct.isSale ? 'Outright purchase cost' : `Daily Rate x ${bookingDays} Days`}</span>
                        <span className="font-black text-neutral-900">{currencySymbol}{(selectedProduct.price * (selectedProduct.isSale ? 1 : bookingDays)).toLocaleString()}</span>
                      </div>

                      {!selectedProduct.isSale && selectedAddOns.size > 0 && (
                        <div className="flex justify-between items-center text-xs text-neutral-600">
                          <span className="font-semibold uppercase text-[9px]">Add-Ons ({selectedAddOns.size} selected)</span>
                          <span className="font-black text-emerald-600">
                            + {currencySymbol}{(Array.from(selectedAddOns).reduce((sum, idx) => sum + (selectedProduct.addOns?.[idx]?.price || 0), 0) * bookingDays).toLocaleString()}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between items-center text-xs text-neutral-600 border-b border-rose-100 pb-1.5 font-sans">
                        <span className="font-semibold uppercase text-[9px]">Platform Service / Damage Waiver Fees</span>
                        <span className="font-bold text-neutral-700">{currencySymbol}{damageWaiver.toLocaleString()}</span>
                      </div>

                      {/* Dynamic Tax Component displaying exact VAT % / GST config details */}
                      <div className="flex justify-between items-center text-xs text-neutral-600 pb-1.5 font-sans border-b border-neutral-200/60">
                        <div className="flex flex-col">
                          <span className="font-semibold uppercase text-[9.5px] text-neutral-700">Tax Platform Service Fees</span>
                          <span className="text-[7.5px] uppercase text-neutral-400 font-bold -mt-0.5 leading-none">
                            {isFiji 
                              ? `Fiji VAT (${taxPercent}%) ${isInclusive ? 'Included (VIP)' : 'VEP added'}` 
                              : `Tax / GST (${taxPercent}%) ${isInclusive ? 'Included' : 'Exclusive'}`}
                          </span>
                        </div>
                        <span className="font-bold text-neutral-700">
                          {isInclusive ? '(Included) ' : '+ '}{currencySymbol}{taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-xs text-neutral-800 pt-1">
                        <span className="font-black uppercase text-[10px]">Total Quote</span>
                        <span className="font-black text-sm text-[#ff4f3a]">
                          {currencySymbol}{totalQuote.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsBookingModalOpen(false);
                      setSelectedProduct(null);
                    }}
                    className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 font-black uppercase tracking-widest text-[9px] py-3.5 rounded-xl transition"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={!isAuthorized && restrictToAvailableCountries}
                    className={`flex-1 font-black uppercase tracking-widest text-[9px] py-3.5 rounded-xl transition shadow ${(!isAuthorized && restrictToAvailableCountries) ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed' : 'bg-neutral-900 hover:bg-[#ff4f3a] text-white'}`}
                  >
                    {!isAuthorized && restrictToAvailableCountries 
                      ? 'Service Unavailable in Region' 
                      : (selectedProduct.isSale ? 'Send Purchase Request' : 'Send Booking Request')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* MESSAGE AND HIRE DIRECT PANEL MODAL FOR CREWS */}
      <AnimatePresence>
        {isMessageModalOpen && selectedCrew && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsMessageModalOpen(false);
                setSelectedCrew(null);
              }}
              className="absolute inset-0 bg-neutral-900/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] p-8 border border-neutral-100 shadow-2xl space-y-6"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[8px] font-black uppercase tracking-widest text-neutral-400">
                    Direct dispatcher
                  </span>
                  <h3 className="text-lg font-black uppercase tracking-tighter text-neutral-800 mt-1">
                    Inquire Hire: {selectedCrew.name}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setIsMessageModalOpen(false);
                    setSelectedCrew(null);
                  }}
                  className="bg-neutral-105 hover:bg-neutral-200 text-neutral-600 p-1 px-1.5 rounded-lg text-xs transition"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Brief profile info card */}
              <div className="flex gap-4 border-y border-neutral-100 py-4">
                <div className="w-16 h-16 bg-neutral-100 rounded-2xl overflow-hidden shrink-0 border">
                  <img src={selectedCrew.image} alt={selectedCrew.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="space-y-1 my-auto">
                  <h4 className="text-xs font-black uppercase text-neutral-800">{selectedCrew.name}</h4>
                  <p className="text-[10px] text-neutral-400 font-semibold uppercase">{selectedCrew.title}</p>
                  <p className="text-[9px] text-[#ff4f3a] font-black uppercase">Response Time: Under 1 hour</p>
                </div>
              </div>

              {/* Message inputs form */}
              <form onSubmit={handleMessageCrewSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Inquiry message & dates</label>
                  <textarea
                    rows={4}
                    required
                    value={crewMessageText}
                    onChange={(e) => setCrewMessageText(e.target.value)}
                    placeholder={`Hi ${selectedCrew.name.split(' ')[0]}, I would like to inquire about your availability matching editorial shoot specs near ${locationQuery} on...`}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl p-4 text-xs font-semibold outline-none focus:bg-white leading-relaxed text-neutral-800 placeholder-neutral-400"
                  />
                </div>

                <div className="p-4 bg-blue-50/40 rounded-2xl border border-blue-100/50 flex gap-3 text-[10px] text-blue-800 leading-relaxed">
                  <Info size={16} className="shrink-0 mt-0.5 text-blue-600" />
                  <p>
                    All communication is logged for security protection. Packer Marketplace guarantees payment safety escrows and visual damage waivers for on-set accidents.
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMessageModalOpen(false);
                      setSelectedCrew(null);
                    }}
                    className="flex-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 font-extrabold uppercase tracking-wider text-[10px] py-3.5 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-[#ff4f3a] hover:bg-[#e43f2a] text-white font-black uppercase tracking-widest text-[9px] py-3.5 rounded-xl transition shadow"
                  >
                    Dispatch Message
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 11. LIST YOUR GEAR OVERLAY DIALOG */}
      <AnimatePresence>
        {isListGearModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full text-white space-y-6 shadow-2xl relative"
            >
              <button
                onClick={() => setIsListGearModalOpen(false)}
                className="absolute top-4 right-4 text-neutral-400 hover:text-white p-2 rounded-xl transition"
              >
                <X size={20} />
              </button>

              {/* Option 1: Unregistered User */}
              {!user && (
                <div className="space-y-6 text-center py-6">
                  <div className="w-16 h-16 bg-rose-500/10 text-[#ff4f3a] rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                    <UserCheck size={32} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black uppercase tracking-tight">Create an Account to List Equipment</h3>
                    <p className="text-xs text-neutral-400 leading-relaxed max-w-md mx-auto uppercase font-bold tracking-wider">
                      Our secure peer-to-peer visual gear workspace requires registered profiles. Sign in with Google to establish your shopfront.
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await signInWithGoogle();
                        setIsListGearModalOpen(false);
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                    className="inline-flex items-center gap-2 bg-[#ff4f3a] hover:bg-[#e43f2a] text-white font-black text-xs uppercase tracking-widest px-8 py-3.5 rounded-xl shadow-lg transition"
                  >
                    <Globe size={14} />
                    <span>Sign In with Google</span>
                  </button>
                </div>
              )}

              {/* Option 2: Registered User but Unverified KYC */}
              {user && user.kycStatus !== 'verified' && (
                <div className="space-y-6 text-center py-6">
                  <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                    <ShieldAlert size={32} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black uppercase tracking-tight">Identity & Business Setup Required</h3>
                    <p className="text-xs text-neutral-400 leading-relaxed max-w-md mx-auto uppercase font-bold tracking-wider">
                      Current KYC Status: <span className="text-amber-500 font-extrabold">{user.kycStatus || 'not_started'}</span>
                    </p>
                    <p className="text-xs text-neutral-400 leading-relaxed max-w-md mx-auto">
                      Under administrative guidelines, all active lenders in the region must verify business ownership, license registrations, or identities before deploying commercial gear listings.
                    </p>
                  </div>
                  <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={() => {
                        setIsListGearModalOpen(false);
                        navigate('/profile?tab=kyc');
                      }}
                      className="bg-[#ff4f3a] hover:bg-[#e43f2a] text-white font-black text-xs uppercase tracking-widest px-8 py-3.5 rounded-xl shadow-lg transition"
                    >
                      Complete KYC Verification Form
                    </button>
                    <button
                      onClick={() => setIsListGearModalOpen(false)}
                      className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-black text-xs uppercase tracking-widest px-6 py-3.5 rounded-xl transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              {/* Option 3: Verified User (Select List / Kit to Add) */}
              {user && user.kycStatus === 'verified' && (
                <div className="space-y-6">
                  <div className="border-b border-neutral-850 pb-4">
                    <span className="text-[10px] font-black tracking-widest text-[#ff4f3a] uppercase block animate-pulse">Verified Member Hub</span>
                    <h3 className="text-xl font-black uppercase tracking-tight">Select Packing Lists & Projects to List</h3>
                    <p className="text-[11px] text-neutral-400 leading-relaxed font-semibold uppercase mt-0.5">
                      Enable marketplace visibility for any of your custom kits and set daily rental price rates catalogued.
                    </p>
                  </div>

                  {loadingListsAndProjects ? (
                    <div className="py-12 text-center text-xs font-bold text-neutral-500 uppercase tracking-widest animate-pulse">
                      Syncing items and project files...
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {/* Project Filter Selector */}
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Select Project Filter (Optional)</label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setSelectedProjectId(null)}
                            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all ${
                              selectedProjectId === null
                                ? 'bg-[#ff4f3a] text-white border-[#ff4f3a] shadow-md'
                                : 'bg-neutral-850 text-neutral-400 border-neutral-800 hover:border-neutral-700'
                            }`}
                          >
                            All Projects & Lists
                          </button>
                          {userProjects.map(proj => (
                            <button
                              key={proj.id}
                              onClick={() => setSelectedProjectId(proj.id)}
                              className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all ${
                                selectedProjectId === proj.id
                                  ? 'bg-[#ff4f3a] text-white border-[#ff4f3a] shadow-md'
                                  : 'bg-neutral-850 text-neutral-400 border-neutral-800 hover:border-neutral-700'
                              }`}
                            >
                              {proj.name || 'Unnamed Project'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Lists Segment */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-neutral-500">
                          <span>Packing Lists & Kits for Rent/Sell</span>
                          <span>{userOwnLists.filter(l => !selectedProjectId || l.projectId === selectedProjectId).length} Found</span>
                        </div>

                        <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
                          {userOwnLists
                            .filter(l => !selectedProjectId || l.projectId === selectedProjectId)
                            .length === 0 ? (
                              <div className="text-center py-10 bg-neutral-850/50 rounded-2xl border border-neutral-800/40 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                                No checklists or gear packages matched the criteria. Create a packing list or add kits in lists first!
                              </div>
                            ) : (
                              userOwnLists
                                .filter(l => !selectedProjectId || l.projectId === selectedProjectId)
                                .map((list) => {
                                  const isListed = list.marketplaceEnabled === true;
                                  const currentVal = listingPriceMap[list.id] ?? 150;

                                  return (
                                    <div key={list.id} className="bg-neutral-850 p-4 rounded-2xl border border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                      <div className="space-y-1">
                                        <span className="text-[9px] font-black uppercase tracking-wider text-[#ff4f3a]">
                                          {list.brand || 'Custom'} {list.model || 'Kit'}
                                        </span>
                                        <h4 className="text-xs font-extrabold uppercase leading-tight">{list.name}</h4>
                                        <div className="flex items-center gap-1.5 text-[9px] text-neutral-400 font-semibold uppercase">
                                          <span>{list.itemsCount || 0} ITEMS</span>
                                          <span>•</span>
                                          <span>{isListed ? `Listed at $${list.marketplacePrice}/day` : 'Not Listed'}</span>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 justify-end">
                                        <div className="flex items-center gap-1 bg-neutral-900 px-3 py-1.5 rounded-xl border border-neutral-800">
                                          <span className="text-neutral-450 text-[10px] font-bold">$</span>
                                          <input
                                            type="number"
                                            value={currentVal}
                                            onChange={(e) => {
                                              const parsed = parseInt(e.target.value) || 0;
                                              setListingPriceMap(prev => ({ ...prev, [list.id]: parsed }));
                                            }}
                                            className="w-12 bg-transparent text-white text-[10px] font-black focus:ring-0 outline-none text-right"
                                            placeholder="150"
                                          />
                                          <span className="text-neutral-450 text-[9px] font-bold">/DAY</span>
                                        </div>

                                        <button
                                          onClick={() => handleToggleMarketplace(list.id, !isListed)}
                                          className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl transition ${
                                            isListed
                                              ? 'bg-neutral-800 text-red-400 border border-red-950/20 hover:text-red-300'
                                              : 'bg-[#ff4f3a] text-white hover:bg-[#e43f2a]'
                                          }`}
                                        >
                                          {isListed ? 'De-list' : 'List now'}
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })
                            )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Action Button (FAB) for Quick Listing */}
      <div className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-40">
        <button
          type="button"
          onClick={() => {
            triggerHaptic();
            handleOpenListGear();
          }}
          className="bg-[#ff4f3a] hover:bg-[#e43f2a] text-white p-4 rounded-full shadow-2xl flex items-center justify-center transition-all active:scale-90 duration-75 border border-[#ff4f3a] focus:outline-none hover:shadow-[#ff4f3a]/30"
          aria-label="List your gear"
          title="List your gear"
        >
          <Plus size={24} className="text-white" />
        </button>
      </div>

    </div>
  );
}
