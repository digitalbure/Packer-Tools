import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useIndustry } from '../context/IndustryContext';
import { 
  LayoutGrid, 
  Package, 
  QrCode, 
  ListChecks, 
  User, 
  Plus, 
  FileText, 
  X, 
  ListPlus, 
  Loader2, 
  Check, 
  Database 
} from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'motion/react';
import { UserProfile } from '../types';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  doc, 
  setDoc 
} from 'firebase/firestore';
import { toast } from 'sonner';

interface MobileTabBarProps {
  user: UserProfile | null;
}

export default function MobileTabBar({ user }: MobileTabBarProps) {
  const location = useLocation();
  const { getAdjustedLabel, customTerms } = useIndustry();
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // States for Load Direct Item modal
  const [isLoadDirectModalOpen, setIsLoadDirectModalOpen] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('Other');
  const [itemBrand, setItemBrand] = useState('');
  const [itemModel, setItemModel] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [targetType, setTargetType] = useState<'packingList' | 'inventory'>('packingList');
  const [targetSelection, setTargetSelection] = useState<'existing' | 'new'>('existing');
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [newListName, setNewListName] = useState('');
  const [syncToGear, setSyncToGear] = useState(true);
  const [syncToOther, setSyncToOther] = useState(false);
  const [otherTargetId, setOtherTargetId] = useState('');

  // Firestore fetch states
  const [userPackingLists, setUserPackingLists] = useState<any[]>([]);
  const [userInventories, setUserInventories] = useState<any[]>([]);
  const [fetchingLists, setFetchingLists] = useState(false);
  const [isSubmittingDirectLoad, setIsSubmittingDirectLoad] = useState(false);

  // Auto-detect mobile keyboard focus to prevent layout shifting
  useEffect(() => {
    const handleResize = () => {
      if (window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        const totalHeight = window.innerHeight;
        if (viewportHeight < totalHeight * 0.75) {
          setIsKeyboardOpen(true);
        } else {
          setIsKeyboardOpen(false);
        }
      }
    };

    window.visualViewport?.addEventListener('resize', handleResize);
    window.addEventListener('resize', handleResize);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Fetch packing lists & custom inventories for the direct load dropdowns
  useEffect(() => {
    if (!isLoadDirectModalOpen || !user?.uid) return;

    setFetchingLists(true);
    const qLists = query(collection(db, 'packingLists'), where('ownerId', '==', user.uid));
    const qInvs = query(collection(db, 'inventories'), where('ownerId', '==', user.uid));

    Promise.all([
      getDocs(qLists).then(snap => {
        const lists = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUserPackingLists(lists);
      }).catch(err => console.error("Error fetching packing lists:", err)),

      getDocs(qInvs).then(snap => {
        const invs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUserInventories(invs);
      }).catch(err => console.error("Error fetching inventories:", err))
    ]).finally(() => {
      setFetchingLists(false);
    });
  }, [isLoadDirectModalOpen, user?.uid]);

  if (!user || isKeyboardOpen) return null;

  // Tabs configured with routes and custom labels
  const tabs = [
    {
      to: '/dashboard',
      label: 'Home',
      icon: <LayoutGrid className="w-5 h-5 transition-transform duration-200" />,
      activePattern: /^\/dashboard/
    },
    {
      to: '/library',
      label: getAdjustedLabel('library') || 'Library',
      icon: <Package className="w-5 h-5 transition-transform duration-200" />,
      activePattern: /^\/library/
    },
    {
      to: '',
      label: 'Add',
      icon: (
        <motion.div 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.85 }}
          transition={{ type: 'spring', stiffness: 500, damping: 15 }}
          className="relative -top-5 flex items-center justify-center w-14 h-14 rounded-full bg-black text-white shadow-lg shadow-black/25 border-4 border-neutral-50"
        >
          <motion.div
            animate={{ rotate: isMenuOpen ? 135 : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="flex items-center justify-center"
          >
            <Plus className="w-6 h-6 text-white stroke-[2.5]" />
          </motion.div>
        </motion.div>
      ),
      activePattern: /^\/kiosk/,
      isAction: true
    },
    {
      to: '/inventory',
      label: getAdjustedLabel('inventory') || 'Inventory',
      icon: <ListChecks className="w-5 h-5 transition-transform duration-200" />,
      activePattern: /^\/inventory/
    },
    {
      to: '/profile',
      label: 'Profile',
      icon: user.photoURL ? (
        <img 
          src={user.photoURL} 
          alt={user.displayName} 
          className="w-5 h-5 rounded-full border border-neutral-300 object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <User className="w-5 h-5 transition-transform duration-200" />
      ),
      activePattern: /^\/profile/
    }
  ];

  const menuContainerVariants: Variants = {
    hidden: { opacity: 0, y: 80, scale: 0.96 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring',
        damping: 24,
        stiffness: 280,
        staggerChildren: 0.05,
        delayChildren: 0.02
      }
    },
    exit: {
      opacity: 0,
      y: 60,
      scale: 0.96,
      transition: {
        duration: 0.18,
        ease: 'easeOut'
      }
    }
  };

  const menuItemVariants: Variants = {
    hidden: { opacity: 0, y: 15, scale: 0.98 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 20
      }
    }
  };

  const handleDirectLoadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;
    if (!itemName.trim()) {
      toast.error("Item Name is required");
      return;
    }

    if (targetSelection === 'existing' && !selectedTargetId) {
      toast.error(`Please select an existing ${targetType === 'packingList' ? 'Packing List' : 'Custom Sheet'}`);
      return;
    }

    if (targetSelection === 'new' && !newListName.trim()) {
      toast.error(`Please provide a name for the new ${targetType === 'packingList' ? 'Packing List' : 'Custom Sheet'}`);
      return;
    }

    setIsSubmittingDirectLoad(true);
    const loadingToastId = toast.loading("Loading item directly to target...");
    try {
      let finalTargetId = selectedTargetId;

      // Step 1: Create New List if requested
      if (targetSelection === 'new') {
        if (targetType === 'packingList') {
          const newListRef = await addDoc(collection(db, 'packingLists'), {
            name: newListName.trim(),
            description: `Created via Direct Load Menu`,
            ownerId: user.uid,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            stage: 'proposed',
            version: 1,
            collaboratorIds: [],
            collaboratorEmails: []
          });
          finalTargetId = newListRef.id;
          toast.success(`Created Packing List: "${newListName}"`);
        } else {
          const newInvRef = doc(collection(db, 'inventories'));
          await setDoc(newInvRef, {
            id: newInvRef.id,
            name: newListName.trim(),
            description: `Created via Direct Load Menu`,
            ownerId: user.uid,
            ownerEmail: user.email || '',
            visibility: {
              orgIds: [],
              deptIds: [],
              teamIds: []
            },
            collaborators: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          finalTargetId = newInvRef.id;
          toast.success(`Created Custom Inventory Sheet: "${newListName}"`);
        }
      }

      // Step 2: Add Item to chosen list
      if (targetType === 'packingList') {
        await addDoc(collection(db, 'packingLists', finalTargetId, 'items'), {
          name: itemName.trim(),
          listId: finalTargetId,
          aiLabel: itemCategory,
          status: 'pending',
          priority: 'Medium',
          photoUrls: [],
          quantity: itemQuantity,
          assetTag: `DL-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
          createdAt: new Date().toISOString(),
          notes: (itemBrand || itemModel) ? `Brand: ${itemBrand}, Model: ${itemModel}` : 'Loaded directly via Mobile Quick Create',
          description: 'Loaded directly'
        });
      } else {
        const itemDocRef = doc(collection(db, 'inventories', finalTargetId, 'items'));
        await setDoc(itemDocRef, {
          id: itemDocRef.id,
          name: itemName.trim(),
          category: itemCategory,
          brand: itemBrand || '',
          model: itemModel || '',
          quantity: itemQuantity,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'available',
          condition: 'good',
          trackingMode: 'batch',
          ownerId: user.uid
        });
      }

      // Step 3: Optional Sync - Register to Central Gear Library
      if (syncToGear) {
        await addDoc(collection(db, 'users', user.uid, 'gearLibrary'), {
          name: itemName.trim(),
          brand: itemBrand || '',
          model: itemModel || '',
          category: itemCategory,
          primaryCategory: itemCategory,
          quantity: itemQuantity,
          price: 0,
          currency: '$',
          condition: 'good',
          weight: 0,
          weightUnit: 'g',
          photoUrls: ['https://picsum.photos/seed/gear/400/400'],
          secondaryCategories: [],
          description: 'Loaded directly from mobile menu',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        toast.success("Also registered to Central Gear Library!");
      }

      // Step 4: Optional Cross-Sync - Sync to the OTHER list type if selected
      if (syncToOther && otherTargetId) {
        if (targetType === 'packingList') {
          const replicaDocRef = doc(collection(db, 'inventories', otherTargetId, 'items'));
          await setDoc(replicaDocRef, {
            id: replicaDocRef.id,
            name: itemName.trim(),
            category: itemCategory,
            brand: itemBrand || '',
            model: itemModel || '',
            quantity: itemQuantity,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'available',
            condition: 'good',
            trackingMode: 'batch',
            ownerId: user.uid
          });
          toast.success("Replicated item to Custom Sheet!");
        } else {
          await addDoc(collection(db, 'packingLists', otherTargetId, 'items'), {
            name: itemName.trim(),
            listId: otherTargetId,
            aiLabel: itemCategory,
            status: 'pending',
            priority: 'Medium',
            photoUrls: [],
            quantity: itemQuantity,
            assetTag: `DL-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
            createdAt: new Date().toISOString(),
            notes: (itemBrand || itemModel) ? `Brand: ${itemBrand}, Model: ${itemModel}` : 'Loaded directly via Mobile Quick Create',
            description: 'Loaded directly'
          });
          toast.success("Replicated item to Packing List!");
        }
      }

      toast.success("Success! Direct item loaded successfully.", { id: loadingToastId });
      
      // Reset form states
      setItemName('');
      setItemBrand('');
      setItemModel('');
      setItemQuantity(1);
      setItemCategory('Other');
      setNewListName('');
      setSelectedTargetId('');
      setOtherTargetId('');
      setSyncToGear(true);
      setSyncToOther(false);
      
      setIsLoadDirectModalOpen(false);
      
      // Notify active listeners
      window.dispatchEvent(new CustomEvent('direct-item-added'));
    } catch (err: any) {
      console.error(err);
      toast.error(`Error loading item: ${err.message || String(err)}`, { id: loadingToastId });
    } finally {
      setIsSubmittingDirectLoad(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-neutral-950/40 backdrop-blur-sm z-30 md:hidden"
            />
            
            {/* Slide-up Menu */}
            <motion.div
              variants={menuContainerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed bottom-24 left-4 right-4 z-40 md:hidden bg-white/95 backdrop-blur-2xl rounded-[2.5rem] border border-neutral-100 p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                <h3 className="text-sm font-black uppercase tracking-wider text-neutral-800">Quick Create Menu</h3>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-1.5 rounded-full bg-neutral-50 text-neutral-500 hover:text-neutral-800 transition"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {/* Brand New Load Direct Item button */}
                <motion.div
                  variants={menuItemVariants}
                  whileHover={{ scale: 1.01, x: 2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsLoadDirectModalOpen(true);
                    }}
                    className="flex items-center gap-4 p-3.5 rounded-2xl bg-gradient-to-r from-neutral-900 to-neutral-800 text-white hover:opacity-95 transition border border-neutral-800 w-full text-left"
                  >
                    <div className="w-10 h-10 bg-white/10 text-rose-300 rounded-xl flex items-center justify-center shrink-0">
                      <ListPlus size={20} />
                    </div>
                    <div className="text-left font-sans">
                      <p className="text-xs font-bold">Load Direct Item</p>
                      <p className="text-[10px] text-neutral-300 font-medium leading-none mt-0.5">Load directly to new or existing list / custom sheet</p>
                    </div>
                  </button>
                </motion.div>

                <motion.div
                  variants={menuItemVariants}
                  whileHover={{ scale: 1.01, x: 2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    to="/library?addGear=true"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-4 p-3.5 rounded-2xl bg-neutral-50 hover:bg-neutral-100 transition border border-neutral-100/50 w-full"
                  >
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                      <Package size={20} />
                    </div>
                    <div className="text-left font-sans">
                      <p className="text-xs font-black text-neutral-800">Add Central Item</p>
                      <p className="text-[10px] text-neutral-400 font-semibold leading-none mt-0.5">Register new {customTerms?.gearLabelSingular || 'gear'} item</p>
                    </div>
                  </Link>
                </motion.div>

                <motion.div
                  variants={menuItemVariants}
                  whileHover={{ scale: 1.01, x: 2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    to="/dashboard?addList=true"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-4 p-3.5 rounded-2xl bg-neutral-50 hover:bg-neutral-100 transition border border-neutral-100/50 w-full"
                  >
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                      <ListChecks size={20} />
                    </div>
                    <div className="text-left font-sans">
                      <p className="text-xs font-black text-neutral-800">Create Packing List</p>
                      <p className="text-[10px] text-neutral-400 font-semibold leading-none mt-0.5">Setup travel checklist or dispatch log</p>
                    </div>
                  </Link>
                </motion.div>

                <motion.div
                  variants={menuItemVariants}
                  whileHover={{ scale: 1.01, x: 2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    to="/inventory?addSheet=true"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-4 p-3.5 rounded-2xl bg-neutral-50 hover:bg-neutral-100 transition border border-neutral-100/50 w-full"
                  >
                    <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                      <FileText size={20} />
                    </div>
                    <div className="text-left font-sans">
                      <p className="text-xs font-black text-neutral-800">Create Custom Sheet</p>
                      <p className="text-[10px] text-neutral-400 font-semibold leading-none mt-0.5">Create custom location inventory sheet</p>
                    </div>
                  </Link>
                </motion.div>

                <motion.div
                  variants={menuItemVariants}
                  whileHover={{ scale: 1.01, x: 2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    to="/kiosk"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-4 p-3.5 rounded-2xl bg-neutral-50 hover:bg-neutral-100 transition border border-neutral-100/50 w-full"
                  >
                    <div className="w-10 h-10 bg-sky-50 text-sky-600 rounded-xl flex items-center justify-center shrink-0">
                      <QrCode size={20} />
                    </div>
                    <div className="text-left font-sans">
                      <p className="text-xs font-black text-neutral-800">Scan QR Code / Kiosk</p>
                      <p className="text-[10px] text-neutral-400 font-semibold leading-none mt-0.5">Open self-checkout scan terminal</p>
                    </div>
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Load Direct Item Modal Overlay */}
      <AnimatePresence>
        {isLoadDirectModalOpen && (
          <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden border border-neutral-100 shadow-2xl flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50 shrink-0">
                <div className="flex items-center gap-2">
                  <ListPlus className="w-5 h-5 text-neutral-800" />
                  <h3 className="text-sm font-black text-neutral-800 uppercase tracking-wide">Load Direct Item</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLoadDirectModalOpen(false)}
                  className="p-1.5 rounded-full bg-neutral-200/50 hover:bg-neutral-200 text-neutral-500 hover:text-neutral-800 transition"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleDirectLoadSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Item Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-600 uppercase tracking-wide">Asset Name *</label>
                  <input
                    type="text"
                    required
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-black text-neutral-800 bg-neutral-50"
                    placeholder="e.g. Sony FX3 or Torque Wrench"
                  />
                </div>

                {/* Category & Quantity */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-600 uppercase tracking-wide">Category</label>
                    <select
                      value={itemCategory}
                      onChange={(e) => setItemCategory(e.target.value)}
                      className="w-full px-3 py-3 rounded-xl border border-neutral-200 text-xs focus:outline-none focus:ring-2 focus:ring-black bg-neutral-50 text-neutral-800"
                    >
                      <option value="Camera">Camera</option>
                      <option value="Lens">Lens</option>
                      <option value="Audio">Audio</option>
                      <option value="Lighting">Lighting</option>
                      <option value="Support">Support</option>
                      <option value="Electronics">Electronics</option>
                      <option value="Cables">Cables</option>
                      <option value="Power">Power</option>
                      <option value="Accessories">Accessories</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-600 uppercase tracking-wide">Quantity</label>
                    <div className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-xl p-1 justify-between h-[46px]">
                      <button
                        type="button"
                        onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
                        className="w-8 h-8 rounded-lg bg-white shadow-sm text-neutral-700 font-bold active:scale-90 transition flex items-center justify-center text-sm"
                      >
                        -
                      </button>
                      <span className="text-sm font-black text-neutral-800">{itemQuantity}</span>
                      <button
                        type="button"
                        onClick={() => setItemQuantity(itemQuantity + 1)}
                        className="w-8 h-8 rounded-lg bg-white shadow-sm text-neutral-700 font-bold active:scale-90 transition flex items-center justify-center text-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Make & Model */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-600 uppercase tracking-wide">Brand (Optional)</label>
                    <input
                      type="text"
                      value={itemBrand}
                      onChange={(e) => setItemBrand(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-xs focus:outline-none focus:ring-2 focus:ring-black text-neutral-800 bg-neutral-50"
                      placeholder="e.g. Sony"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-600 uppercase tracking-wide">Model (Optional)</label>
                    <input
                      type="text"
                      value={itemModel}
                      onChange={(e) => setItemModel(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-xs focus:outline-none focus:ring-2 focus:ring-black text-neutral-800 bg-neutral-50"
                      placeholder="e.g. FX3"
                    />
                  </div>
                </div>

                <div className="border-t border-neutral-100 pt-4 space-y-3">
                  <h4 className="text-xs font-black text-neutral-700 uppercase tracking-wider">Target Destination</h4>
                  
                  {/* Select target list type */}
                  <div className="grid grid-cols-2 gap-2 bg-neutral-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setTargetType('packingList');
                        setSelectedTargetId('');
                      }}
                      className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                        targetType === 'packingList' ? 'bg-white text-black shadow-sm' : 'text-neutral-500'
                      }`}
                    >
                      <Database size={13} />
                      Packing List
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetType('inventory');
                        setSelectedTargetId('');
                      }}
                      className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                        targetType === 'inventory' ? 'bg-white text-black shadow-sm' : 'text-neutral-500'
                      }`}
                    >
                      <FileText size={13} />
                      Custom Sheet
                    </button>
                  </div>

                  {/* Select Selection Mode: Existing or New */}
                  <div className="grid grid-cols-2 gap-2 bg-neutral-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setTargetSelection('existing')}
                      className={`py-2 text-xs font-bold rounded-lg transition-all ${
                        targetSelection === 'existing' ? 'bg-white text-black shadow-sm' : 'text-neutral-500'
                      }`}
                    >
                      Select Existing
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetSelection('new')}
                      className={`py-2 text-xs font-bold rounded-lg transition-all ${
                        targetSelection === 'new' ? 'bg-white text-black shadow-sm' : 'text-neutral-500'
                      }`}
                    >
                      Create New List
                    </button>
                  </div>

                  {/* Render conditional inputs */}
                  {fetchingLists ? (
                    <div className="flex items-center justify-center gap-2 py-4">
                      <Loader2 className="w-5 h-5 text-neutral-600 animate-spin" />
                      <span className="text-xs text-neutral-500 font-bold">Fetching available lists...</span>
                    </div>
                  ) : targetSelection === 'existing' ? (
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-wide">
                        Choose {targetType === 'packingList' ? 'Packing List' : 'Custom Sheet'} *
                      </label>
                      {targetType === 'packingList' ? (
                        <select
                          value={selectedTargetId}
                          onChange={(e) => setSelectedTargetId(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-neutral-50 text-neutral-800"
                        >
                          <option value="">-- Choose List --</option>
                          {userPackingLists.map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                      ) : (
                        <select
                          value={selectedTargetId}
                          onChange={(e) => setSelectedTargetId(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-neutral-50 text-neutral-800"
                        >
                          <option value="">-- Choose Custom Sheet --</option>
                          {userInventories.map(inv => (
                            <option key={inv.id} value={inv.id}>{inv.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-wide">
                        New {targetType === 'packingList' ? 'Packing List' : 'Custom Sheet'} Name *
                      </label>
                      <input
                        type="text"
                        value={newListName}
                        onChange={(e) => setNewListName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-black text-neutral-800 bg-neutral-50"
                        placeholder={`Enter name for new ${targetType === 'packingList' ? 'Packing List' : 'Custom Sheet'}`}
                      />
                    </div>
                  )}
                </div>

                {/* Double-Write / Synchronization Checkboxes */}
                <div className="border-t border-neutral-100 pt-4 space-y-2.5">
                  <h4 className="text-xs font-black text-neutral-700 uppercase tracking-wider">Sync Options</h4>
                  
                  <label className="flex items-center gap-3 cursor-pointer select-none py-1">
                    <input
                      type="checkbox"
                      checked={syncToGear}
                      onChange={(e) => setSyncToGear(e.target.checked)}
                      className="rounded border-neutral-300 text-black focus:ring-black w-4 h-4 accent-neutral-900"
                    />
                    <span className="text-xs font-bold text-neutral-700">Also register to Central Gear Library</span>
                  </label>

                  {/* Replicate / cross sync options */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={syncToOther}
                        onChange={(e) => setSyncToOther(e.target.checked)}
                        className="rounded border-neutral-300 text-black focus:ring-black w-4 h-4 accent-neutral-900"
                      />
                      <span className="text-xs font-bold text-neutral-700">
                        {targetType === 'packingList' ? 'Also replicate to a Custom Sheet' : 'Also replicate to a Packing List'}
                      </span>
                    </label>

                    {syncToOther && (
                      <div className="pl-7 mt-1.5">
                        {targetType === 'packingList' ? (
                          <select
                            value={otherTargetId}
                            onChange={(e) => setOtherTargetId(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-xs focus:outline-none focus:ring-2 focus:ring-black bg-neutral-50 text-neutral-800"
                          >
                            <option value="">-- Select Custom Sheet --</option>
                            {userInventories.map(inv => (
                              <option key={inv.id} value={inv.id}>{inv.name}</option>
                            ))}
                          </select>
                        ) : (
                          <select
                            value={otherTargetId}
                            onChange={(e) => setOtherTargetId(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-xs focus:outline-none focus:ring-2 focus:ring-black bg-neutral-50 text-neutral-800"
                          >
                            <option value="">-- Select Packing List --</option>
                            {userPackingLists.map(l => (
                              <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-4 sticky bottom-0 bg-white border-t border-neutral-100 flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsLoadDirectModalOpen(false)}
                    className="flex-1 py-3 text-sm font-bold border border-neutral-200 rounded-xl hover:bg-neutral-50 active:scale-98 transition text-neutral-600 text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingDirectLoad}
                    className="flex-1 py-3 text-sm font-bold bg-neutral-950 text-white rounded-xl hover:bg-black active:scale-98 transition flex items-center justify-center gap-2"
                  >
                    {isSubmittingDirectLoad ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Loading...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 text-white" />
                        <span>Load Item</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden px-4 pb-4 pt-1 bg-gradient-to-t from-neutral-50/90 via-neutral-50/80 to-transparent pointer-events-none">
        <div className="w-full max-w-md mx-auto pointer-events-auto bg-white/95 backdrop-blur-xl rounded-[2rem] border border-neutral-100 shadow-2xl flex items-center justify-between py-2.5 px-3">
          {tabs.map((tab, idx) => {
            const isCenterTab = idx === 2; // Add button
            
            if (isCenterTab) {
              return (
                <button
                  key="add-action-button"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="flex flex-col items-center justify-center flex-1 h-10 relative select-none cursor-pointer focus:outline-none"
                >
                  <div className="transition-all duration-300">
                    {tab.icon}
                  </div>
                </button>
              );
            }

            const isActive = tab.activePattern?.test(location.pathname);

            return (
              <Link
                key={tab.to}
                to={tab.to || '#'}
                className="flex flex-col items-center justify-center flex-1 h-12 relative select-none"
              >
                <div 
                  className={`transition-all duration-300 ${
                    isActive 
                      ? 'text-black scale-110' 
                      : 'text-neutral-400 hover:text-neutral-600'
                  }`}
                >
                  {tab.icon}
                </div>

                <span 
                  className={`text-[9px] font-black uppercase tracking-wider mt-1 transition-colors duration-250 truncate max-w-[70px] ${
                    isActive ? 'text-black font-extrabold' : 'text-neutral-400'
                  }`}
                >
                  {tab.label}
                </span>

                {isActive && (
                  <span className="absolute bottom-0 w-1.5 h-1.5 rounded-full bg-black" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
