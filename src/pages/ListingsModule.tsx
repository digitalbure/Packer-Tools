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
  Bookmark
} from 'lucide-react';
import { toast } from 'sonner';

interface ListingsModuleProps {
  user: UserProfile;
  adminSettings: AdminSettings | null;
}

export default function ListingsModule({ user, adminSettings }: ListingsModuleProps) {
  const [activeSubTab, setActiveSubTab] = useState<'console' | 'bookings' | 'settings'>('console');
  const [lists, setLists] = useState<PackingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreatingListing, setIsCreatingListing] = useState(false);
  const [showEditPriceModal, setShowEditPriceModal] = useState<PackingList | null>(null);

  // New Listing Form Field States
  const [newListName, setNewListName] = useState('');
  const [newListPrice, setNewListPrice] = useState(120);
  const [newListCurrency, setNewListCurrency] = useState('USD');
  const [newListDetails, setNewListDetails] = useState('');
  const [newListDeposit, setNewListDeposit] = useState(150);

  // Edit Price Form State
  const [editPrice, setEditPrice] = useState(0);
  const [editDeposit, setEditDeposit] = useState(0);
  const [editDetails, setEditDetails] = useState('');
  const [editCurrency, setEditCurrency] = useState('USD');

  const navigate = useNavigate();
  const location = useLocation();

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
        rentalStatus: 'awaiting_payment'
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
        updatedAt: new Date().toISOString()
      });
      toast.success("Listing prices and description updated successfully!");
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
                  { label: 'Settled Gear volume', value: `$${totalSettledRevenue.toLocaleString()}`, color: 'bg-primary', format: 'cash' },
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
                                    {list.marketplaceCurrency === 'FJD' ? 'FJ$' : '$'}
                                    {list.marketplacePrice || 120} / day
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-neutral-400 font-semibold leading-none pt-1 border-t border-neutral-150">
                                  <span>Deposit fee:</span>
                                  <span className="font-mono text-neutral-800">
                                    {list.marketplaceCurrency === 'FJD' ? 'FJ$' : '$'}
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
                              {item.marketplaceCurrency === 'FJD' ? 'FJ$' : '$'}
                              {item.marketplacePrice || 120}
                            </h3>
                            <span className="text-[9px] text-neutral-400 font-medium block">
                              Holds Security Deposit: {item.marketplaceCurrency === 'FJD' ? 'FJ$' : '$'}{item.securityDeposit ?? 150}
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
      </AnimatePresence>
    </div>
  );
}
