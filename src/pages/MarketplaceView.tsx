import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { db, auth } from '../firebase';
import { PackingList, PackingItem, Contact, AdminSettings } from '../types';
import { 
  Package, 
  CheckCircle2, 
  Clock, 
  Tag, 
  Info, 
  ArrowRight,
  ShoppingBag,
  Truck,
  ShieldCheck,
  QrCode,
  ExternalLink,
  Link2,
  Share2
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      setCurrentUser(authUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
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

        // Fetch items
        const itemsSnap = await getDocs(collection(db, 'packingLists', id, 'items'));
        const itemsData = itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PackingItem[];
        setItems(itemsData.sort((a, b) => (a.order || 0) - (b.order || 0)));

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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F4]">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Check if marketplace visibility is restricted to signed in users
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

  return (
    <div className="min-h-screen bg-[#F5F5F4] text-[#1A1A1A] font-sans">
      <main className="grid lg:grid-cols-2 min-h-screen">
        {/* Left Pane: Info & Action */}
        <div className="p-8 md:p-16 lg:p-24 flex flex-col justify-center bg-white border-r border-neutral-100">
          <div className="max-w-xl space-y-12">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  list.transactionType === 'Sale' ? 'bg-green-100 text-green-600' :
                  list.transactionType === 'Rental' ? 'bg-blue-100 text-blue-600' :
                  'bg-neutral-100 text-neutral-600'
                }`}>
                  {list.transactionType || 'Listing'}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                  Status: {list.status}
                </span>
              </div>
              <h1 className="text-6xl md:text-8xl font-black tracking-tighter uppercase leading-[0.85]">
                {list.name}
              </h1>
              <p className="text-xl text-neutral-500 leading-relaxed font-medium">
                {list.description || 'No description provided for this listing.'}
              </p>
              {list.marketplaceDetails && (
                <div className="p-6 bg-neutral-50 rounded-[2rem] border border-neutral-100 space-y-3">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-400">
                    <Info size={14} />
                    <span>Marketplace Notes</span>
                  </div>
                  <div className="text-sm text-neutral-600 leading-relaxed whitespace-pre-wrap">
                    <ReactMarkdown>{list.marketplaceDetails}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-8 py-8 border-y border-neutral-100">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">Price</div>
                <div className="text-4xl font-black tracking-tight">
                  {list.price ? `${list.currency || '$'}${list.price}` : 'Free / Gift'}
                </div>
              </div>
              {recipient && (
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2">Recipient</div>
                  <div className="text-xl font-bold">{recipient.name}</div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              {list.status === 'Sent' && (
                <button 
                  onClick={handleMarkReceived}
                  className="w-full py-6 bg-primary text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-primary/90 transition shadow-2xl shadow-primary/20 flex items-center justify-center gap-4 group"
                >
                  Confirm Receipt
                  <CheckCircle2 size={24} className="group-hover:scale-110 transition-transform" />
                </button>
              )}
              
              {list.status === 'Received' && (
                <div className="w-full py-6 bg-green-50 text-green-600 rounded-[2rem] font-black uppercase tracking-widest flex items-center justify-center gap-4 border border-green-100">
                  Package Received
                  <CheckCircle2 size={24} />
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="p-6 bg-neutral-50 rounded-[2rem] text-center space-y-2">
                  <Truck size={20} className="mx-auto text-neutral-400" />
                  <div className="text-[8px] font-black uppercase tracking-widest text-neutral-400">Shipping</div>
                  <div className="text-[10px] font-bold">Verified</div>
                </div>
                <div className="p-6 bg-neutral-50 rounded-[2rem] text-center space-y-2">
                  <ShieldCheck size={20} className="mx-auto text-neutral-400" />
                  <div className="text-[8px] font-black uppercase tracking-widest text-neutral-400">Security</div>
                  <div className="text-[10px] font-bold">Protected</div>
                </div>
                <div className="p-6 bg-neutral-50 rounded-[2rem] text-center space-y-2">
                  <QrCode size={20} className="mx-auto text-neutral-400" />
                  <div className="text-[8px] font-black uppercase tracking-widest text-neutral-400">Tracking</div>
                  <div className="text-[10px] font-bold">Enabled</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Pane: Items List */}
        <div className="bg-[#1A1A1A] text-white p-8 md:p-16 lg:p-24 overflow-y-auto max-h-screen">
          <div className="max-w-xl mx-auto space-y-12">
            <header className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tighter">Included Items</h2>
                <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">{items.length} Items in this package</p>
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
                      toast.success('Link copied to clipboard!');
                    });
                  }}
                  className="p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition text-white/60 hover:text-white"
                  title="Share Listing"
                >
                  <Share2 size={20} />
                </button>
                <div className="text-right">
                  <div className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1">Total Value</div>
                  <div className="text-2xl font-black">{list.price ? `${list.currency || '$'}${list.price}` : 'N/A'}</div>
                </div>
              </div>
            </header>

            <div className="space-y-4">
              {items.map((item, index) => (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  key={item.id}
                  className="bg-white/5 border border-white/10 p-6 rounded-[2rem] flex items-center gap-6 hover:bg-white/10 transition-all group"
                >
                  <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center overflow-hidden">
                    {item.photoUrls?.[0] ? (
                      <img 
                        src={item.photoUrls[0]} 
                        alt={item.name} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Package size={24} className="text-white/20" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold uppercase tracking-tight text-lg">{item.name}</h4>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                        TAG: {item.assetTag}
                      </span>
                      {item.aiLabel && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                          {item.aiLabel}
                        </span>
                      )}
                    </div>
                    {item.relatedItemIds && item.relatedItemIds.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2 items-center">
                        <Link2 size={10} className="text-white/40" />
                        {item.relatedItemIds.map(relatedId => {
                          const relatedItem = items.find(i => i.id === relatedId);
                          if (!relatedItem) return null;
                          return (
                            <span 
                              key={relatedId}
                              className="text-[9px] font-bold uppercase tracking-widest text-white/60 bg-white/5 px-2 py-0.5 rounded-full border border-white/10"
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

            <footer className="pt-12 border-t border-white/10 text-center space-y-6">
              <p className="text-white/40 text-sm leading-relaxed">
                This packing list is powered by <span className="text-white font-bold">SMART PACKER</span>. 
                Scan the QR code on the physical package to verify contents.
              </p>
              <div className="flex justify-center gap-4">
                <button className="p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition">
                  <ExternalLink size={20} className="text-white/60" />
                </button>
                <button className="p-4 bg-white/5 rounded-2xl hover:bg-white/10 transition">
                  <ShoppingBag size={20} className="text-white/60" />
                </button>
              </div>
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
}
