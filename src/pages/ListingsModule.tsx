import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, PackingList, AdminSettings } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, 
  Tag, 
  Plus, 
  DollarSign, 
  Calendar, 
  Check, 
  X, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  ShoppingBag, 
  Globe, 
  Info,
  Clock,
  Trash2,
  Sliders,
  TrendingUp,
  FileText,
  Bookmark,
  Copy,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { isFeatureEnabled } from '../lib/featureUtils';
import UpgradeNowModal from '../components/UpgradeNowModal';
import { Lock, Shield, Crown } from 'lucide-react';

interface ListingsModuleProps {
  user: UserProfile;
  adminSettings: AdminSettings | null;
}

export default function ListingsModule({ user, adminSettings }: ListingsModuleProps) {
  const [activeSubTab, setActiveSubTab] = useState<'console' | 'bookings' | 'gear-bookings' | 'settings'>('console');
  const [lists, setLists] = useState<PackingList[]>([]);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

  // Gear Bookings and Reservation State
  const [gearBookings, setGearBookings] = useState<any[]>([]);
  const [userGear, setUserGear] = useState<any[]>([]);
  const [customConditions, setCustomConditions] = useState<string[]>([
    "Paid Deposit Confirmed", 
    "Valid ID Verified on Checkout", 
    "Signed Equipment Indemnity Contract", 
    "COI (Certificate of Insurance) on file"
  ]);
  const [newCondition, setNewCondition] = useState("");
  const [isReserveModalOpen, setIsReserveModalOpen] = useState(false);

  // Manual booking sub-form states
  const [selectedGearId, setSelectedGearId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [depositPaid, setDepositPaid] = useState(false);
  const [selectedBookingConditions, setSelectedBookingConditions] = useState<string[]>([]);
  const [reservationType, setReservationType] = useState<'free' | 'deposit' | 'custom'>('deposit');

  // Calendar State
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(5); // 0-indexed, 5 = June
  const [loading, setLoading] = useState(true);
  const [isCreatingListing, setIsCreatingListing] = useState(false);
  const [showEditPriceModal, setShowEditPriceModal] = useState<PackingList | null>(null);

  // New Listing Form Field States
  const [newListName, setNewListName] = useState('');
  const [newListPrice, setNewListPrice] = useState(120);
  const [newListCurrency, setNewListCurrency] = useState('USD');
  const [newListDetails, setNewListDetails] = useState('');
  const [newListDeposit, setNewListDeposit] = useState(150);
  const [newListCategory, setNewListCategory] = useState('cinema-cameras');
  const [newListTransactionType, setNewListTransactionType] = useState<'rent' | 'sale'>('rent');

  // Edit Price Form State
  const [editPrice, setEditPrice] = useState(0);
  const [editDeposit, setEditDeposit] = useState(0);
  const [editDetails, setEditDetails] = useState('');
  const [editCurrency, setEditCurrency] = useState('USD');
  const [editCategory, setEditCategory] = useState('cinema-cameras');
  const [editTransactionType, setEditTransactionType] = useState<'rent' | 'sale'>('rent');

  const navigate = useNavigate();
  const location = useLocation();

  const getCurrencySymbol = (code: string | undefined): string => {
    const targetCode = code || adminSettings?.marketplaceRegionConfig?.defaultCurrency || 'USD';
    switch (targetCode.toUpperCase()) {
      case 'FJD': return 'FJ$';
      case 'AUD': return 'A$';
      case 'NZD': return 'NZ$';
      case 'GBP': return '£';
      case 'CAD': return 'C$';
      case 'EUR': return '€';
      case 'USD': return '$';
      default: return '$';
    }
  };

  useEffect(() => {
    if (adminSettings?.marketplaceRegionConfig?.defaultCurrency) {
      setNewListCurrency(adminSettings.marketplaceRegionConfig.defaultCurrency);
      setEditCurrency(adminSettings.marketplaceRegionConfig.defaultCurrency);
    }
  }, [adminSettings]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('create') === 'true') {
      setIsCreatingListing(true);
      // Clean query parameter
      navigate('/listings', { replace: true });
    }
  }, [location.search, navigate]);

  useEffect(() => {
    if (!user?.uid) return;
    const qLists = query(collection(db, 'packingLists'), where('ownerId', '==', user.uid));
    const unsubscribe = onSnapshot(qLists, (snapshot) => {
      const fetchedLists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PackingList[];
      setLists(fetchedLists.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setLoading(false);
    }, (error) => {
      console.error("Error listening to user packing lists:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user.uid]);

  // Fetch user's own gear items
  useEffect(() => {
    if (!user?.uid) return;
    const qGear = query(collection(db, 'users', user.uid, 'gearLibrary'));
    const unsubscribe = onSnapshot(qGear, (snapshot) => {
      const fetchedGear = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUserGear(fetchedGear);
    }, (err) => {
      console.error("Error fetching gear library:", err);
    });
    return () => unsubscribe();
  }, [user.uid]);

  // Fetch reservations (bookings)
  useEffect(() => {
    if (!user?.uid) return;
    const qBookings = query(collection(db, 'gearBookings'), where('ownerId', '==', user.uid));
    const unsubscribe = onSnapshot(qBookings, (snapshot) => {
      const fetchedBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      // Sort by startDate ascending
      fetchedBookings.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      setGearBookings(fetchedBookings);
    }, (err) => {
      console.error("Error listening to gear bookings:", err);
    });
    return () => unsubscribe();
  }, [user.uid]);

  // Fetch custom conditions
  useEffect(() => {
    if (!user?.uid) return;
    const qConditions = query(collection(db, 'users', user.uid, 'bookingConditions'));
    getDocs(qConditions).then(snapshot => {
      if (!snapshot.empty) {
        const condList = snapshot.docs.map(doc => doc.data().name as string);
        setCustomConditions(condList);
      }
    }).catch(e => console.error("Error getting custom conditions:", e));
  }, [user.uid]);

  const handleSaveManualReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGearId || !clientName || !startDate || !endDate) {
      toast.error("Please fill required fields (Gear item, Client Name, and Dates)");
      return;
    }

    const gearItem = userGear.find(g => g.id === selectedGearId);
    if (!gearItem) return;

    try {
      const bookingData = {
        gearId: selectedGearId,
        gearName: `${gearItem.brand || ''} ${gearItem.model || gearItem.name}`.trim(),
        brand: gearItem.brand || '',
        ownerId: user.uid,
        clientName,
        clientEmail,
        clientPhone,
        startDate,
        endDate,
        depositAmount: gearItem.rentalDeposit || 0,
        paymentStatus: reservationType === 'free' ? 'Free' : (depositPaid ? 'Deposit Paid' : 'Pending Deposit'),
        reservationType,
        customConditions: selectedBookingConditions,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'gearBookings'), bookingData);

      // Reset form
      setSelectedGearId("");
      setClientName("");
      setClientEmail("");
      setClientPhone("");
      setStartDate("");
      setEndDate("");
      setDepositPaid(false);
      setSelectedBookingConditions([]);
      setIsReserveModalOpen(false);

      toast.success("Advance reservation booked and calendar locked!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to register advance reservation");
    }
  };

  const handleAddCondition = async () => {
    if (!newCondition.trim()) return;
    const trimmed = newCondition.trim();
    if (customConditions.includes(trimmed)) {
      toast.error("Condition already exists");
      return;
    }
    const updated = [...customConditions, trimmed];
    setCustomConditions(updated);
    setNewCondition("");
    toast.success("Custom booking condition saved!");
    
    try {
      await addDoc(collection(db, 'users', user.uid, 'bookingConditions'), { name: trimmed });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCondition = async (index: number) => {
    const val = customConditions[index];
    const updated = customConditions.filter((_, idx) => idx !== index);
    setCustomConditions(updated);
    toast.info("Booking requirement removed");

    try {
      const q = query(collection(db, 'users', user.uid, 'bookingConditions'), where('name', '==', val));
      const snap = await getDocs(q);
      snap.forEach(async (d) => {
        await deleteDoc(doc(db, 'users', user.uid, 'bookingConditions', d.id));
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    if (!window.confirm("Are you sure you want to cancel this reservation? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, 'gearBookings', bookingId));
      toast.success("Reservation canceled and calendar dates freed.");
    } catch (e) {
      console.error(e);
      toast.error("Failed to cancel reservation.");
    }
  };

  const handleToggleDepositPayment = async (booking: any) => {
    try {
      const nextPaid = booking.paymentStatus === 'Deposit Paid' ? 'Pending Deposit' : 'Deposit Paid';
      await updateDoc(doc(db, 'gearBookings', booking.id), {
        paymentStatus: nextPaid
      });
      toast.success(`Booking payment status set to: ${nextPaid}`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to update payment status.");
    }
  };

  // Handle Quick Listing Creation
  const handleCreateQuickListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    try {
      const docRef = await addDoc(collection(db, 'packingLists'), {
        ownerId: user.uid,
        ownerEmail: user.email,
        name: newListName,
        description: newListDetails || 'Marketplace Gear List',
        isTemplate: false,
        shareToken: Math.random().toString(36).substring(2, 15),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'Active',
        marketplaceEnabled: true,
        marketplacePrice: Number(newListPrice),
        marketplaceCurrency: newListCurrency,
        marketplaceDetails: newListDetails,
        securityDeposit: Number(newListDeposit),
        rentalStatus: 'awaiting_payment',
        category: newListCategory,
        transactionType: newListTransactionType
      });

      toast.success("Quick Marketplace Listing created successfully!");
      setIsCreatingListing(false);
      setNewListName('');
      setNewListDetails('');
      setNewListPrice(120);
      setNewListDeposit(150);
      navigate(`/list/${docRef.id}`);
    } catch (error) {
      console.error("Error creating quick listing:", error);
      toast.error("Failed to create marketplace listing.");
    }
  };

  // Convert regular Packing List to Marketplace Listing
  const handleToggleMarketplace = async (list: PackingList, enabled: boolean) => {
    try {
      const listRef = doc(db, 'packingLists', list.id);
      await updateDoc(listRef, {
        marketplaceEnabled: enabled,
        marketplacePrice: list.marketplacePrice || 100,
        marketplaceCurrency: list.marketplaceCurrency || user.activeMarketplaceCurrencies?.[0] || 'USD',
        securityDeposit: list.securityDeposit || 120,
        updatedAt: new Date().toISOString()
      });
      toast.success(enabled ? "Packing list is now live on the Marketplace!" : "Listing successfully removed from the Marketplace.");
    } catch (error) {
      console.error("Error toggling marketplace listing:", error);
      toast.error("Failed to update listing marketplace availability.");
    }
  };

  // Handle Edit Price Form Save
  const handleSavePriceEdit = async () => {
    if (!showEditPriceModal) return;
    try {
      const listRef = doc(db, 'packingLists', showEditPriceModal.id);
      await updateDoc(listRef, {
        marketplacePrice: Number(editPrice),
        securityDeposit: Number(editDeposit),
        marketplaceDetails: editDetails,
        marketplaceCurrency: editCurrency,
        category: editCategory,
        transactionType: editTransactionType,
        updatedAt: new Date().toISOString()
      });
      toast.success("Listing prices, details, categories and sync status updated successfully!");
      setShowEditPriceModal(null);
    } catch (error) {
      console.error("Error saving price edit:", error);
      toast.error("Failed to save changes.");
    }
  };

  // Handle order transition
  const handleUpdateRentalStatus = async (listId: string, nextStatus: 'awaiting_payment' | 'awaiting_release' | 'released' | 'returned') => {
    try {
      const listRef = doc(db, 'packingLists', listId);
      await updateDoc(listRef, {
        rentalStatus: nextStatus,
        updatedAt: new Date().toISOString()
      });
      toast.success(`Rental status advanced to: ${nextStatus.replace('_', ' ').toUpperCase()}`);
    } catch (error) {
      console.error("Error updating rental status:", error);
      toast.error("Failed to update order stage.");
    }
  };

  const marketplaceActiveListings = lists.filter(l => l.marketplaceEnabled);
  const bookingRentals = lists.filter(l => l.marketplaceEnabled && l.bookingClientName);

  // Revenue analytics computes
  const totalListingsCount = marketplaceActiveListings.length;
  const activeBookingsCount = bookingRentals.filter(l => l.rentalStatus !== 'returned').length;
  const completedBookingsCount = bookingRentals.filter(l => l.rentalStatus === 'returned').length;
  const totalSettledRevenue = bookingRentals
    .filter(l => l.rentalStatus === 'released' || l.rentalStatus === 'returned')
    .reduce((acc, l) => acc + (l.marketplacePrice || 0), 0);

  const activeCurrencies = user.activeMarketplaceCurrencies || ['USD'];
  const currencySymbol = activeCurrencies[0] === 'FJD' ? 'FJ$' : '$';

  if (!isFeatureEnabled('marketplaceListings', user, adminSettings)) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center max-w-2xl mx-auto space-y-8">
        <div className="relative">
          {/* Decorative Background Glow */}
          <div className="absolute -inset-4 bg-gradient-to-r from-[#ff4f3a]/20 to-amber-500/10 rounded-full blur-xl opacity-75" />
          
          <div className="relative w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 border border-amber-200 shadow-lg">
            <Lock size={36} className="stroke-[2.5]" />
          </div>
        </div>

        <div className="space-y-3">
          <span className="px-3 py-1 bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] font-black uppercase tracking-widest rounded-full">
            Restricted Module
          </span>
          <h1 className="text-3xl sm:text-4.5xl font-black uppercase tracking-tighter text-neutral-900 leading-none">
            Marketplace Listings Locked
          </h1>
          <p className="text-neutral-500 text-sm font-medium leading-relaxed">
            Your current subscription tier does not permit listing rental/sale inventory on the public Rent & Buy Marketplace.
            Upgrade to a premium tier to begin publishing gear packages, accepting manual deposits, and managing escrow booking contracts.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full text-left pt-2">
          <div className="p-4 bg-white rounded-2xl border border-neutral-100 shadow-sm flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-650 flex items-center justify-center shrink-0">
              <Check size={18} />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-tight">Unlimited Listings</div>
              <div className="text-[10px] text-neutral-400 font-semibold mt-0.5">Publish and manage unlimited rent/buy gears.</div>
            </div>
          </div>

          <div className="p-4 bg-white rounded-2xl border border-neutral-100 shadow-sm flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-650 flex items-center justify-center shrink-0">
              <Check size={18} />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-tight">Escrow Hires Tracking</div>
              <div className="text-[10px] text-neutral-400 font-semibold mt-0.5">Automated deposit guarantees & conditions logs.</div>
            </div>
          </div>
        </div>

        <button 
          onClick={() => setIsUpgradeModalOpen(true)}
          className="px-8 py-4 bg-neutral-900 hover:bg-black text-white font-extrabold text-xs uppercase tracking-widest rounded-2xl transition shadow-xl hover:shadow-black/10 active:scale-95 cursor-pointer"
        >
          Upgrade Your Workspace
        </button>

        <UpgradeNowModal
          isOpen={isUpgradeModalOpen}
          onClose={() => setIsUpgradeModalOpen(false)}
          user={user}
          adminSettings={adminSettings}
          restrictedFeatureName="Marketplace Listings Module"
          onSuccess={(newPlan) => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Header and Welcome */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
              <Tag size={22} className="stroke-[2.5]" />
            </div>
            <h1 className="text-4xl font-black tracking-tight text-neutral-900">Listings Dashboard</h1>
          </div>
          <p className="text-neutral-500 text-sm">Manage gear rentals, marketplace lists, booking hires, and sale settings.</p>
        </div>
        <button
          onClick={() => setIsCreatingListing(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/95 transition shadow-lg shrink-0 cursor-pointer"
        >
          <Plus size={18} />
          <span>Create Quick Listing</span>
        </button>
      </header>

      {/* Tabs Menu */}
      <div className="flex items-center gap-1 bg-neutral-150 p-1 rounded-2xl w-fit">
        <button
          onClick={() => setActiveSubTab('console')}
          className={`px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'console' 
              ? 'bg-white text-primary shadow-sm' 
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          <ShoppingBag size={16} />
          <span>My Active Listings ({totalListingsCount})</span>
        </button>
        <button
          onClick={() => setActiveSubTab('bookings')}
          className={`px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'bookings' 
              ? 'bg-white text-primary shadow-sm' 
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          <Calendar size={16} />
          <span>Sales & Rentals ({bookingRentals.length})</span>
        </button>
        <button
          onClick={() => setActiveSubTab('gear-bookings')}
          className={`px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'gear-bookings' 
              ? 'bg-white text-primary shadow-sm' 
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          <Calendar size={16} className="text-[#3b82f6]" />
          <span>Gear Reservations & Links ({gearBookings.length})</span>
        </button>
        <button
          onClick={() => setActiveSubTab('settings')}
          className={`px-6 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'settings' 
              ? 'bg-white text-primary shadow-sm' 
              : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          <Sliders size={16} />
          <span>Pricing & Escrow Limits</span>
        </button>
      </div>

      {/* Sub-Views Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
          className="space-y-8"
        >
          {/* TAB 1: Listings Console */}
          {activeSubTab === 'console' && (
            <div className="space-y-8">
              {/* Stats Overview */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {[
                  { label: 'Total active Listings', value: totalListingsCount, color: 'bg-indigo-500', format: 'number' },
                  { label: 'Active Rentals', value: activeBookingsCount, color: 'bg-amber-500', format: 'number' },
                  { label: 'Completed Rentals', value: completedBookingsCount, color: 'bg-emerald-500', format: 'number' },
                  { label: 'Settled Gear volume', value: `${currencySymbol}${totalSettledRevenue.toLocaleString()}`, color: 'bg-primary', format: 'cash' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-neutral-450 uppercase tracking-widest">{stat.label}</span>
                      <span className={`w-2 h-2 rounded-full ${stat.color}`}></span>
                    </div>
                    <h3 className="text-3xl font-black text-neutral-900 tracking-tight font-mono">{stat.value}</h3>
                  </div>
                ))}
              </div>

              {/* Instructions Callout */}
              <div className="bg-neutral-50 p-6 rounded-3xl border border-neutral-200/50 flex flex-col md:flex-row md:items-center gap-5 justify-between">
                <div className="space-y-1">
                  <h4 className="font-bold text-neutral-900 flex items-center gap-2">
                    <Info size={16} className="text-primary" />
                    <span>Double-Pipeline Integration model</span>
                  </h4>
                  <p className="text-xs text-neutral-550 leading-relaxed font-semibold max-w-2xl">
                    You can quickly list items on the marketplace using two powerful pipelines:
                    (1) create a clean Packing List right here specifically optimized for hiring out, or
                    (2) go to your current standard workspace Packing Lists below and toggle them to "live" to instantly enable renters to book.
                  </p>
                </div>
              </div>

              {/* Listings Grids */}
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-neutral-900 uppercase tracking-tight flex items-center gap-2">
                  <Package size={18} />
                  <span>Interactive Workspace lists</span>
                </h3>

                {loading ? (
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-48 bg-neutral-100 rounded-3xl animate-pulse"></div>
                    ))}
                  </div>
                ) : lists.length === 0 ? (
                  <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-neutral-200">
                    <ShoppingBag className="mx-auto text-neutral-200 mb-4 animate-bounce" size={44} />
                    <h4 className="font-extrabold uppercase text-xs tracking-wider text-neutral-700">No Lists to view</h4>
                    <p className="text-xs text-neutral-450 mt-1 max-w-sm mx-auto">Create a packing list or listing item to offer professional rentals to the crew!</p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {lists.map((list) => {
                      const isMarketActive = list.marketplaceEnabled;
                      return (
                        <div 
                          key={list.id} 
                          className={`bg-white rounded-[2rem] border transition-all duration-300 overflow-hidden flex flex-col justify-between ${
                            isMarketActive ? 'border-emerald-200 shadow-md ring-1 ring-emerald-100' : 'border-neutral-100 shadow-sm hover:shadow-md'
                          }`}
                        >
                          {/* Top Tag Header */}
                          <div className="p-6 pb-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                                isMarketActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-neutral-100 text-neutral-600'
                              }`}>
                                {isMarketActive ? '🟢 Live on Marketplace' : '⚫ Private / Inactive'}
                              </span>
                              <span className="text-[10px] text-neutral-405 font-semibold font-mono">
                                List v{list.version || 1}
                              </span>
                            </div>

                            <div className="space-y-1 text-left">
                              <h4 className="font-black text-neutral-950 text-lg group-hover:text-primary transition-colors truncate">
                                {list.name}
                              </h4>
                              <p className="text-xs text-neutral-500 line-clamp-2 min-h-[32px]">
                                {list.description || 'No additional gear specifications provided.'}
                              </p>
                            </div>

                            {/* Rent info snippet */}
                            {isMarketActive && (
                              <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100 space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Rate</span>
                                  <span className="font-black text-neutral-900 text-base font-mono">
                                    {getCurrencySymbol(list.marketplaceCurrency)}
                                    {list.marketplacePrice || 120} / day
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-neutral-400 font-semibold leading-none pt-1 border-t border-neutral-150">
                                  <span>Deposit fee:</span>
                                  <span className="font-mono text-neutral-800">
                                    {getCurrencySymbol(list.marketplaceCurrency)}
                                    {list.securityDeposit || 150}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Trigger Buttons Footer */}
                          <div className="p-4 bg-neutral-50/50 border-t border-neutral-100 flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                handleToggleMarketplace(list, !isMarketActive);
                              }}
                              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex-1 text-center ${
                                isMarketActive 
                                  ? 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200' 
                                  : 'bg-[#ff4f3a] text-white hover:bg-primary/90 shadow-sm'
                              }`}
                            >
                              {isMarketActive ? 'Take Down' : 'List Live'}
                            </button>

                            {isMarketActive ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditPrice(list.marketplacePrice || 120);
                                  setEditDeposit(list.securityDeposit || 150);
                                  setEditDetails(list.marketplaceDetails || '');
                                  setEditCurrency(list.marketplaceCurrency || 'USD');
                                  setEditCategory(list.category || 'cinema-cameras');
                                  setEditTransactionType(list.transactionType === 'Sale' ? 'sale' : 'rent');
                                  setShowEditPriceModal(list);
                                }}
                                className="px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow transition"
                              >
                                Edit Offer
                              </button>
                            ) : (
                              <Link
                                to={`/list/${list.id}`}
                                className="px-4 py-2.5 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 rounded-xl text-xs font-black uppercase tracking-wider transition text-center"
                              >
                                View Items
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Sales & Rental Bookings */}
          {activeSubTab === 'bookings' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-neutral-900 uppercase tracking-tight flex items-center gap-2">
                  <Bookmark size={18} className="text-[#3b82f6]" />
                  <span>Live client reservations</span>
                </h3>
                <span className="text-xs bg-neutral-150 font-bold px-3 py-1 rounded-full text-neutral-600">
                  {bookingRentals.length} active escrows
                </span>
              </div>

              {bookingRentals.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-neutral-100 shadow-sm">
                  <Clock className="mx-auto text-neutral-200 mb-4 animate-spin duration-3000" size={44} />
                  <h4 className="font-extrabold uppercase text-xs tracking-wider text-neutral-700">No Active Hires Received</h4>
                  <p className="text-xs text-neutral-450 mt-1 max-w-sm mx-auto">When production crews rent your kit, active leases, security holds, and digital logs appear right here!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {bookingRentals.map((item) => {
                    return (
                      <div key={item.id} className="bg-white rounded-[2rem] border border-neutral-100 shadow-sm overflow-hidden p-6 sm:p-8 grid md:grid-cols-12 gap-6 items-center">
                        
                        {/* Column 1: Item and Details */}
                        <div className="md:col-span-4 space-y-3 text-left">
                          <span className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded-full ${
                            item.rentalStatus === 'returned' ? 'bg-emerald-50 text-emerald-700' :
                            item.rentalStatus === 'released' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                            item.rentalStatus === 'awaiting_release' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                            'bg-neutral-100 text-neutral-600'
                          }`}>
                            {item.rentalStatus?.toUpperCase()?.replace('_', ' ') || 'AWAITING DISPATCH'}
                          </span>
                          <div>
                            <h4 className="font-black text-neutral-950 text-lg leading-tight">{item.name}</h4>
                            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider font-mono mt-1">
                              ID: {item.id}
                            </p>
                          </div>
                          {item.bookingPaidAt && (
                            <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                              <CheckCircle2 size={12} className="text-emerald-500" />
                              <span>Paid & Cleared: {new Date(item.bookingPaidAt).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>

                        {/* Column 2: Client Ledger */}
                        <div className="md:col-span-4 bg-neutral-50 p-4 rounded-2xl border border-neutral-100 text-left space-y-2">
                          <span className="text-[9px] text-neutral-400 uppercase font-black tracking-widest">Hirer / Crew</span>
                          <div className="space-y-1">
                            <p className="text-sm font-bold text-neutral-900">{item.bookingClientName || 'Guest Operator'}</p>
                            <p className="text-xs text-neutral-400 font-medium truncate">{item.bookingClientEmail || 'no-email@unbooked.com'}</p>
                          </div>
                          
                          {/* Digital Signature Spec if exists */}
                          {item.bookingClientSignature ? (
                            <div className="pt-2 border-t border-neutral-200/65">
                              <span className="text-[8px] text-neutral-400 font-bold uppercase tracking-widest block pb-1">Signed Digital verification</span>
                              <p className="font-signature text-xs text-emerald-700 font-semibold italic select-none">
                                {item.bookingClientSignature}
                              </p>
                            </div>
                          ) : (
                            <div className="pt-2 border-t border-neutral-200/65 flex items-center gap-1 text-[10px] text-amber-600 font-medium leading-none">
                              <AlertCircle size={10} />
                              <span>Self-checkout signature pending</span>
                            </div>
                          )}
                        </div>

                        {/* Column 3: Hire pricing and dispatch triggers */}
                        <div className="md:col-span-4 flex flex-col justify-center items-end sm:items-end gap-3 text-right">
                          <div className="space-y-0.5 pb-2">
                            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block leading-none">Rental Earning</span>
                            <h3 className="text-2xl font-black text-neutral-950 font-mono">
                              {getCurrencySymbol(item.marketplaceCurrency)}
                              {item.marketplacePrice || 120}
                            </h3>
                            <span className="text-[9px] text-neutral-400 font-medium block">
                              Holds Security Deposit: {getCurrencySymbol(item.marketplaceCurrency)}{item.securityDeposit ?? 150}
                            </span>
                          </div>

                          {/* Order State Controllers */}
                          <div className="flex flex-wrap gap-2 justify-end w-full">
                            {item.rentalStatus === 'awaiting_payment' && (
                              <button
                                onClick={() => handleUpdateRentalStatus(item.id, 'awaiting_release')}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow cursor-pointer text-center"
                              >
                                Clear Received E-Payment
                              </button>
                            )}

                            {item.rentalStatus === 'awaiting_release' && (
                              <button
                                onClick={() => handleUpdateRentalStatus(item.id, 'released')}
                                className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow cursor-pointer text-center"
                              >
                                Release Gear (OUT)
                              </button>
                            )}

                            {item.rentalStatus === 'released' && (
                              <button
                                onClick={() => handleUpdateRentalStatus(item.id, 'returned')}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow cursor-pointer text-center"
                              >
                                Check-in Complete (RETURNED)
                              </button>
                            )}

                            {item.rentalStatus === 'returned' && (
                              <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl font-bold uppercase tracking-wider">
                                <CheckCircle2 size={14} />
                                <span>Escrow Released & Complete</span>
                              </div>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Gear Reservations & Customized Booking links */}
          {activeSubTab === 'gear-bookings' && (
            <div className="space-y-8 text-left">
              
              {/* Info Header Card */}
              <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 p-8 rounded-[2.5rem] text-white flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-black tracking-widest text-[#0066cc]">Gear Booking Desk</span>
                  <h3 className="text-3xl font-black tracking-tight">Advanced Reserve & Booking Links</h3>
                  <p className="text-neutral-400 text-xs max-w-xl">
                    Generate booking links for rentable gear items, handle custom client requests, schedule reserve times, and manage conditions set by you.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsReserveModalOpen(true)}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white text-neutral-950 font-black rounded-xl text-xs uppercase tracking-wider hover:bg-neutral-100 transition shadow shrink-0 cursor-pointer"
                >
                  <Plus size={16} />
                  <span>Reserve Gear in Advance</span>
                </button>
              </div>

              <div className="grid lg:grid-cols-12 gap-8">
                
                {/* LEFT: Calendar Schedules & Reservations Ledger */}
                <div className="lg:col-span-8 space-y-8">
                  
                  {/* Monthly Calendar Tracker */}
                  <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-neutral-100 shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-extrabold text-neutral-900 flex items-center gap-2">
                          <Calendar size={18} className="text-[#0066cc]" />
                          <span>Interactive Booking Calendar</span>
                        </h4>
                        <p className="text-[11px] text-neutral-400 mt-0.5">Visual monthly scheduler for gear inventory holds.</p>
                      </div>

                      {/* Month Switcher */}
                      <div className="flex items-center gap-2 bg-neutral-100 p-1.5 rounded-xl">
                        <button
                          type="button"
                          onClick={() => {
                            if (currentMonth === 0) {
                              setCurrentMonth(11);
                              setCurrentYear(prev => prev - 1);
                            } else {
                              setCurrentMonth(prev => prev - 1);
                            }
                          }}
                          className="p-1 hover:bg-white rounded-lg text-neutral-700 transition cursor-pointer"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <span className="text-xs font-black min-w-[100px] text-center text-neutral-800">
                          {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][currentMonth]} {currentYear}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (currentMonth === 11) {
                              setCurrentMonth(0);
                              setCurrentYear(prev => prev + 1);
                            } else {
                              setCurrentMonth(prev => prev + 1);
                            }
                          }}
                          className="p-1 hover:bg-white rounded-lg text-neutral-700 transition cursor-pointer"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Calendar Grid */}
                    <div>
                      {/* Week headers */}
                      <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] text-neutral-400 uppercase tracking-widest pb-3 border-b border-neutral-100">
                        <span>Sun</span>
                        <span>Mon</span>
                        <span>Tue</span>
                        <span>Wed</span>
                        <span>Thu</span>
                        <span>Fri</span>
                        <span>Sat</span>
                      </div>

                      <div className="grid grid-cols-7 gap-1.5 pt-3">
                        {/* Empty/blank slots */}
                        {Array(new Date(currentYear, currentMonth, 1).getDay()).fill(null).map((_, idx) => (
                          <div key={`blank-${idx}`} className="aspect-video bg-neutral-50/50 rounded-lg" />
                        ))}

                        {/* Month Days */}
                        {Array.from({ length: new Date(currentYear, currentMonth + 1, 0).getDate() }, (_, i) => i + 1).map((dayNum) => {
                          const dayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                          const dayBookings = gearBookings.filter(b => dayStr >= b.startDate && dayStr <= b.endDate);
                          const isBooked = dayBookings.length > 0;

                          return (
                            <div 
                              key={`day-${dayNum}`} 
                              className={`aspect-video rounded-xl p-1.5 border flex flex-col justify-between align-start relative hover:border-neutral-400 transition ${
                                isBooked 
                                  ? 'bg-amber-50/40 border-amber-200 shadow-sm' 
                                  : 'bg-white border-neutral-100/80'
                              }`}
                            >
                              <span className={`text-[10px] font-black font-mono leading-none ${isBooked ? 'text-amber-800' : 'text-neutral-500'}`}>
                                {dayNum}
                              </span>

                              {isBooked && (
                                <div className="space-y-0.5 overflow-hidden">
                                  {dayBookings.slice(0, 2).map((b, bIdx) => (
                                    <div 
                                      key={bIdx} 
                                      className="text-[8.5px] leading-tight font-extrabold bg-amber-150 text-amber-950 px-1 py-0.5 rounded truncate"
                                      title={`${b.clientName} booked: ${b.gearName}`}
                                    >
                                      {b.clientName}: {b.gearName}
                                    </div>
                                  ))}
                                  {dayBookings.length > 2 && (
                                    <div className="text-[7.5px] font-bold text-amber-600 font-mono leading-none">
                                      + {dayBookings.length - 2} more...
                                    </div>
                                  )}
                                operational conditions</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Booking Ledger (Reservations List) */}
                  <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-neutral-100 shadow-sm space-y-6">
                    <div>
                      <h4 className="font-extrabold text-neutral-900">Reservations & Lock logs</h4>
                      <p className="text-xs text-neutral-400 mt-1">Full registry of active manual holds and client gear reservations.</p>
                    </div>

                    {gearBookings.length === 0 ? (
                      <div className="border border-dashed border-neutral-200 p-12 text-center rounded-2xl">
                        <Clock className="stroke-[1.5] text-neutral-350 mx-auto mb-3" size={32} />
                        <p className="text-xs text-neutral-500 italic">No bookings scheduled on the ledger.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {gearBookings.map((booking) => (
                          <div 
                            key={booking.id} 
                            className="p-5 bg-neutral-50/70 border border-neutral-200/50 rounded-2xl flex flex-col md:flex-row gap-4 justify-between items-start md:items-center text-left"
                          >
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
                                  booking.paymentStatus === 'Deposit Paid' ? 'bg-emerald-100 text-emerald-800' : 
                                  booking.paymentStatus === 'Free' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {booking.paymentStatus}
                                </span>
                                <span className="text-[10px] text-neutral-400 font-medium font-mono">
                                  Reserved: {booking.startDate} to {booking.endDate}
                                </span>
                              </div>

                              <div>
                                <h5 className="font-black text-neutral-900 text-sm">
                                  {booking.gearName}
                                </h5>
                                <p className="text-xs text-neutral-500 mt-0.5">
                                  Hirer: <strong className="text-neutral-900">{booking.clientName}</strong> {booking.clientEmail ? `• ${booking.clientEmail}` : ''} {booking.clientPhone ? `• ${booking.clientPhone}` : ''}
                                </p>
                              </div>

                              {booking.customConditions && booking.customConditions.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-1">
                                  {booking.customConditions.map((cond: string, cIdx: number) => (
                                    <span key={cIdx} className="text-[8px] font-black uppercase bg-neutral-200 text-neutral-700 px-2 py-0.5 rounded-md">
                                      ✓ {cond}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                              {booking.paymentStatus !== 'Free' && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleDepositPayment(booking)}
                                  className="px-3 py-1.5 bg-white text-neutral-700 border border-neutral-200 rounded-lg text-[10px] font-black uppercase tracking-widest hover:border-neutral-400 transition cursor-pointer"
                                >
                                  {booking.paymentStatus === 'Deposit Paid' ? 'Mark Unpaid' : 'Mark Paid'}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteBooking(booking.id)}
                                className="p-2 text-neutral-400 hover:text-red-600 bg-white border border-neutral-200 hover:border-red-200 rounded-lg transition shadow-sm cursor-pointer"
                                title="Cancel Hold"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT: Booking Links Generator & Custom Requirements */}
                <div className="lg:col-span-4 space-y-8">
                  
                  {/* Booking Links Section */}
                  <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-neutral-100 shadow-sm space-y-6 text-left">
                    <div>
                      <h4 className="font-extrabold text-neutral-900 flex items-center gap-2">
                        <Tag size={18} className="text-[#3b82f6]" />
                        <span>Send Booking Links</span>
                      </h4>
                      <p className="text-[11px] text-neutral-400 mt-0.5">Copy shareable reservation checkout links to email or message clients.</p>
                    </div>

                    <div className="space-y-4">
                      {userGear.filter(item => item.secondaryCategories?.includes('Rentable') || item.isAvailableForRent).length === 0 ? (
                        <div className="text-center py-6 bg-neutral-50 rounded-xl border border-neutral-100">
                          <p className="text-[10px] text-neutral-400 italic">No Rentable gear found in your library. Enable rentable profile inside Edit Gear form first.</p>
                        </div>
                      ) : (
                        userGear.filter(item => item.secondaryCategories?.includes('Rentable') || item.isAvailableForRent).map((item) => {
                          const link = `${window.location.origin}/gear/${item.id}?book=true`;
                          return (
                            <div key={item.id} className="p-3.5 bg-neutral-50/50 border border-neutral-100 rounded-xl space-y-2.5">
                              <div>
                                <h5 className="text-[11px] font-black text-neutral-900 truncate">{item.brand} {item.model || item.name}</h5>
                                <p className="text-[9px] text-neutral-400 font-mono mt-0.5">
                                  Price: {item.currency || '$'}{item.rentalPrice || 45}/day • Hourly: {item.currency || '$'}{item.rentalHourlyPrice || 10}/hr
                                </p>
                              </div>
                              <div className="flex gap-1.5">
                                <input
                                  type="text"
                                  readOnly
                                  value={link}
                                  onClick={(e) => (e.target as HTMLInputElement).select()}
                                  className="flex-1 bg-white border border-neutral-200 text-[9px] px-2 py-1 rounded text-neutral-500 font-mono select-all outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(link);
                                    toast.success("Booking copy link verified!");
                                  }}
                                  className="p-1 px-2 bg-[#ff4f3a] text-white rounded text-[10px] font-bold hover:bg-primary transition cursor-pointer flex items-center gap-1 shrink-0"
                                >
                                  <Copy size={10} />
                                  <span>Copy</span>
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Customize Conditions Setup */}
                  <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-neutral-100 shadow-sm space-y-6 text-left">
                    <div>
                      <h4 className="font-extrabold text-neutral-900">Customized Conditions</h4>
                      <p className="text-[11px] text-neutral-400 mt-0.5">Set up custom criteria clients must fulfill before reserving kit.</p>
                    </div>

                    {/* Requirements input and save */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="e.g. Valid Driver License"
                        value={newCondition}
                        onChange={(e) => setNewCondition(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddCondition();
                        }}
                        className="flex-1 p-2 border border-neutral-250 rounded-xl text-xs font-semibold outline-none focus:ring-1 focus:ring-[#ff4f3a]"
                      />
                      <button
                        type="button"
                        onClick={handleAddCondition}
                        className="p-2 px-3 bg-neutral-950 hover:bg-neutral-800 text-white font-black rounded-xl text-xs uppercase cursor-pointer"
                      >
                        Add
                      </button>
                    </div>

                    {/* Requirement display items */}
                    <div className="space-y-2 pt-2">
                      {customConditions.map((cond, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-neutral-50 border border-neutral-150 rounded-xl text-left">
                          <span className="text-[10px] text-neutral-700 font-bold">✓ {cond}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteCondition(idx)}
                            className="text-neutral-400 hover:text-red-500 transition cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

              </div>
            </div>
          )}

          {/* TAB 3: Pricing & Escrow Limits */}
          {activeSubTab === 'settings' && (
            <div className="bg-white p-8 sm:p-10 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-8 text-left">
              <div className="space-y-2 border-b border-neutral-100 pb-6">
                <h3 className="text-2xl font-black text-neutral-900 tracking-tight flex items-center gap-2">
                  <Globe size={22} className="text-primary" />
                  <span>Marketplace Escrow Controls</span>
                </h3>
                <p className="text-neutral-500 text-xs">Verify which fiat currencies are onboarded on your Profile to receive digital bookings from local networks.</p>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                {/* Active settings review */}
                <div className="space-y-6">
                  <h4 className="text-sm font-black uppercase tracking-widest text-neutral-400">Merchant Settings</h4>
                  <div className="bg-neutral-50 p-6 rounded-3xl border border-neutral-150 space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b border-neutral-250">
                      <span className="text-xs text-neutral-500 font-semibold">Merchant Country:</span>
                      <strong className="text-sm font-black text-neutral-800 uppercase tracking-tight">{user.country || "Fiji Island Hub"}</strong>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-neutral-250">
                      <span className="text-xs text-neutral-500 font-semibold">Active Currencies:</span>
                      <strong className="text-sm font-black text-[#ff4f3a] font-mono">{activeCurrencies.join(', ')}</strong>
                    </div>
                    <div className="flex justify-between items-center pb-3 border-b border-neutral-250">
                      <span className="text-xs text-neutral-500 font-semibold">Custom default booking Fee:</span>
                      <strong className="text-sm font-black text-neutral-800 font-mono">{user.defaultBookingFee ?? 10}%</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-neutral-500 font-semibold">Default Security Deposit:</span>
                      <strong className="text-sm font-black text-neutral-800 font-mono">${user.defaultSecurityDeposit ?? 150}</strong>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/profile')}
                    className="px-5 py-3.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow transition text-center inline-block cursor-pointer"
                  >
                    Adjust Merchant Settings inside Profile
                  </button>
                </div>

                {/* Direct info note card */}
                <div className="bg-primary/5 p-6 sm:p-8 rounded-3xl border border-primary/10 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-extrabold uppercase text-xs tracking-wider text-primary">SLA & Financial Escrow protections</h4>
                    <p className="text-xs text-neutral-600 leading-relaxed font-medium">
                      All transaction payouts are executed via local bank wires aligned by Packer Tools Fiji Escrow logs. Renters pay the booking fee and the safety security deposit. The security deposit is held in high-security escrow until the operator triggers the "Check-in Complete" returned flag. If items are missing, the security deposit is subject to claim.
                    </p>
                  </div>
                  <div className="p-4 bg-white/60 border border-primary/10 rounded-2xl text-[10px] text-neutral-500 font-semibold italic leading-relaxed">
                    *Tip: Maintain photographs inside your Gear Library before dispatching items to verify claims smoothly.
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* MODAL 1: Create Listing Details Dialog */}
      <AnimatePresence>
        {isCreatingListing && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreatingListing(false)}
              className="absolute inset-0 bg-neutral-950/70 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] border border-neutral-100 shadow-2xl p-6 sm:p-10 w-full max-w-xl relative z-10 space-y-6 text-left"
            >
              <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="text-[#ff4f3a]" size={20} />
                  <h3 className="text-xl font-black text-neutral-900 tracking-tight uppercase">New Marketplace Offer</h3>
                </div>
                <button 
                  onClick={() => setIsCreatingListing(false)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-700 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition duration-150"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateQuickListing} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Packing List Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sony FX3 Cinema Core Package"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-[#ff4f3a] transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Rental Price / Day</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
                      <input
                        type="number"
                        min="1"
                        required
                        value={newListPrice}
                        onChange={(e) => setNewListPrice(Number(e.target.value))}
                        className="w-full pl-8 pr-3 p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-900 outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Security Deposit</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
                      <input
                        type="number"
                        min="0"
                        required
                        value={newListDeposit}
                        onChange={(e) => setNewListDeposit(Number(e.target.value))}
                        className="w-full pl-8 pr-3 p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-900 outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Currency</label>
                    <select
                      value={newListCurrency}
                      onChange={(e) => setNewListCurrency(e.target.value)}
                      className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold outline-none text-neutral-800"
                    >
                      {activeCurrencies.map(code => (
                        <option key={code} value={code}>{code}</option>
                      ))}
                    </select>
                  </div>
                  <div className="pt-5 text-[10px] text-neutral-400 font-semibold italic leading-snug">
                    *Default limits are aligned by currency settings
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Offer Category</label>
                    <select
                      value={newListCategory}
                      onChange={(e) => setNewListCategory(e.target.value)}
                      className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold outline-none text-neutral-800 animate-fade-in"
                    >
                      <option value="cinema-cameras">Cinema Cameras</option>
                      <option value="cinema-lenses">Cinema Lenses</option>
                      <option value="photography-lenses">Photography Lenses</option>
                      <option value="still-hybrid">Still / Hybrid Cameras</option>
                      <option value="lighting-electric">Lighting / Electric</option>
                      <option value="audio">Audio Gear</option>
                      <option value="ge-packages">G&E Packages</option>
                      <option value="heavy-machinery">Heavy Machinery & Cranes</option>
                      <option value="power-tools">Power Tools</option>
                      <option value="site-scaffolding">Site Scaffolding</option>
                      <option value="diagnostics">Diagnostics</option>
                      <option value="imaging">Imaging</option>
                      <option value="patient-monitors">Patient Monitors</option>
                      <option value="clinical-pipettes">Clinical Pipettes</option>
                      <option value="warehouse-logistics">Warehouse Logistics</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Offering Type</label>
                    <select
                      value={newListTransactionType}
                      onChange={(e) => setNewListTransactionType(e.target.value as any)}
                      className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold outline-none text-neutral-800 animate-fade-in"
                    >
                      <option value="rent">Rent Out</option>
                      <option value="sale">Sell Outright</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Marketplace Details / Description</label>
                  <textarea
                    rows={3}
                    placeholder="Provide condition, included lenses, cases or batteries..."
                    value={newListDetails}
                    onChange={(e) => setNewListDetails(e.target.value)}
                    className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-850 outline-none focus:ring-2 focus:ring-[#ff4f3a] transition resize-none"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCreatingListing(false)}
                    className="px-5 py-3.5 bg-neutral-150 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-black uppercase tracking-widest transition flex-1 text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-3.5 bg-[#ff4f3a] hover:bg-primary/90 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition flex-1 text-center cursor-pointer"
                  >
                    Publish Listing
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Edit Listing Price Override Dialog */}
      <AnimatePresence>
        {showEditPriceModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditPriceModal(null)}
              className="absolute inset-0 bg-neutral-950/70 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] border border-neutral-100 shadow-2xl p-6 sm:p-10 w-full max-w-md relative z-10 space-y-6 text-left"
            >
              <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                <div className="flex items-center gap-2">
                  <Sliders className="text-[#3b82f6]" size={18} />
                  <h3 className="text-lg font-black text-neutral-900 tracking-tight uppercase">Update Financial Pricing</h3>
                </div>
                <button 
                  onClick={() => setShowEditPriceModal(null)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-700 bg-neutral-50 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Offer Price Per Day</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
                    <input
                      type="number"
                      required
                      value={editPrice}
                      onChange={(e) => setEditPrice(Number(e.target.value))}
                      className="w-full pl-8 pr-3 p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-900 outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Assigned Escrow Deposit</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
                    <input
                      type="number"
                      required
                      value={editDeposit}
                      onChange={(e) => setEditDeposit(Number(e.target.value))}
                      className="w-full pl-8 pr-3 p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-900 outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Merchant currency</label>
                  <select
                    value={editCurrency}
                    onChange={(e) => setEditCurrency(e.target.value)}
                    className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold outline-none text-neutral-800"
                  >
                    {activeCurrencies.map(code => (
                      <option key={code} value={code}>{code}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Offer Category</label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold outline-none text-neutral-800"
                    >
                      <option value="cinema-cameras">Cinema Cameras</option>
                      <option value="cinema-lenses">Cinema Lenses</option>
                      <option value="photography-lenses">Photography Lenses</option>
                      <option value="still-hybrid">Still / Hybrid Cameras</option>
                      <option value="lighting-electric">Lighting / Electric</option>
                      <option value="audio">Audio Gear</option>
                      <option value="ge-packages">G&E Packages</option>
                      <option value="heavy-machinery">Heavy Machinery & Cranes</option>
                      <option value="power-tools">Power Tools</option>
                      <option value="site-scaffolding">Site Scaffolding</option>
                      <option value="diagnostics">Diagnostics</option>
                      <option value="imaging">Imaging</option>
                      <option value="patient-monitors">Patient Monitors</option>
                      <option value="clinical-pipettes">Clinical Pipettes</option>
                      <option value="warehouse-logistics">Warehouse Logistics</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Offering Type</label>
                    <select
                      value={editTransactionType}
                      onChange={(e) => setEditTransactionType(e.target.value as any)}
                      className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold outline-none text-neutral-800"
                    >
                      <option value="rent">Rent Out</option>
                      <option value="sale">Sell Outright</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Offer specs / description</label>
                  <textarea
                    rows={3}
                    value={editDetails}
                    onChange={(e) => setEditDetails(e.target.value)}
                    className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-semibold outline-none resize-none"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEditPriceModal(null)}
                    className="px-4 py-3 bg-neutral-150 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-black uppercase tracking-widest transition flex-1 text-center"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSavePriceEdit}
                    className="px-4 py-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow transition flex-1 text-center"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
        {/* MODAL 3: Reserve Gear In Advance Manual Form */}
        {isReserveModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReserveModalOpen(false)}
              className="absolute inset-0 bg-neutral-950/70 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] border border-neutral-100 shadow-2xl p-6 sm:p-10 w-full max-w-xl relative z-10 space-y-6 text-left max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="text-[#ff4f3a]" size={20} />
                  <h3 className="text-xl font-black text-neutral-900 tracking-tight uppercase">Reserve Gear in Advance</h3>
                </div>
                <button 
                  onClick={() => setIsReserveModalOpen(false)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-700 bg-neutral-50 rounded-lg hover:bg-neutral-100 transition duration-150"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveManualReservation} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Select Equipment to Reserve</label>
                  <select
                    required
                    value={selectedGearId}
                    onChange={(e) => setSelectedGearId(e.target.value)}
                    className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-800 focus:ring-1 focus:ring-primary outline-none"
                  >
                    <option value="">-- Choose rentable gear item --</option>
                    {userGear.filter(g => g.secondaryCategories?.includes('Rentable') || g.isAvailableForRent).map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.brand} {g.model || g.name} ({g.currency || '$'}{g.rentalPrice || 45}/day)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Client / Booker Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe / Fiji Film Crew"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-900 outline-none focus:ring-1 focus:ring-primary transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Client Email (Optional)</label>
                    <input
                      type="email"
                      placeholder="client@gmail.com"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-semibold outline-none text-neutral-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Client Phone (Optional)</label>
                    <input
                      type="text"
                      placeholder="+679 123456"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-semibold outline-none text-neutral-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Lock Start Date</label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold outline-none text-neutral-800 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Lock End Date</label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-bold outline-none text-neutral-800 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1 pb-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Terms / Reservation Rule</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'free', label: 'Free reserve' },
                      { key: 'deposit', label: 'Deposit request' },
                      { key: 'custom', label: 'Custom guidelines' }
                    ].map((mode) => (
                      <button
                        key={mode.key}
                        type="button"
                        onClick={() => setReservationType(mode.key as any)}
                        className={`p-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition ${
                          reservationType === mode.key 
                            ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm'
                            : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                {reservationType === 'deposit' && (
                  <label className="flex items-center gap-2 bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={depositPaid}
                      onChange={(e) => setDepositPaid(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-0 cursor-pointer h-4 w-4"
                    />
                    <div className="text-left">
                      <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest block">Security Deposit Paid In Advance?</span>
                      <span className="text-[9px] text-[#0066cc] block">Marks holding fee escrow as paid.</span>
                    </div>
                  </label>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Active Checkin Requirements</label>
                  <div className="grid grid-cols-2 gap-2 bg-neutral-50 p-3 rounded-xl max-h-[140px] overflow-y-auto border border-neutral-150">
                    {customConditions.map((cond) => {
                      const isSelected = selectedBookingConditions.includes(cond);
                      return (
                        <button
                          type="button"
                          key={cond}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedBookingConditions(prev => prev.filter(c => c !== cond));
                            } else {
                              setSelectedBookingConditions(prev => [...prev, cond]);
                            }
                          }}
                          className={`flex items-start text-left gap-1.5 p-2 rounded-lg border text-[10px] font-bold uppercase transition ${
                            isSelected 
                              ? 'bg-white border-neutral-900 outline outline-1 outline-neutral-900 text-neutral-950'
                              : 'bg-white border-neutral-200 hover:border-neutral-300 text-neutral-500'
                          }`}
                        >
                          <span className="text-neutral-900 leading-none">{isSelected ? '✓' : '○'}</span>
                          <span className="truncate">{cond}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsReserveModalOpen(false)}
                    className="px-5 py-3.5 bg-neutral-150 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-black uppercase tracking-widest transition flex-1 text-center cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-3.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition flex-1 text-center cursor-pointer"
                  >
                    Create Reservation
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
