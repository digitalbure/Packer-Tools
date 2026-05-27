import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { doc, getDoc, collection, query, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { PackingList, PackingItem } from '../types';
import { Package, Tag, Info, ExternalLink, ChevronRight, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';

export default function PackingListBioView() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [list, setList] = useState<PackingList | null>(null);
  const [items, setItems] = useState<PackingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      
      try {
        const listRef = doc(db, 'packingLists', id);
        const listSnap = await getDoc(listRef);
        
        if (!listSnap.exists()) {
          setError("Packing list not found.");
          setLoading(false);
          return;
        }
        
        const listData = { id: listSnap.id, ...listSnap.data() } as PackingList;
        
        // Check share token - lists are private by default unless a token is set and matches
        if (!listData.shareToken || listData.shareToken !== token) {
          setError("Access denied. This list is private or the share link is invalid.");
          setLoading(false);
          return;
        }
        
        setList(listData);
        
        const itemsRef = collection(db, 'packingLists', id, 'items');
        const itemsSnap = await getDocs(query(itemsRef));
        const fetchedItems = itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PackingItem[];
        setItems(fetchedItems.sort((a, b) => (a.order || 0) - (b.order || 0)));
        
      } catch (err) {
        console.error("Error fetching bio view:", err);
        setError("An error occurred while loading the list.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id, token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-900 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !list) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-white p-8 text-center space-y-6">
        <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center">
          <Info size={40} />
        </div>
        <h1 className="text-2xl font-black">{error || "Something went wrong"}</h1>
        <p className="text-neutral-400">Please contact the brand or the person who shared this list.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white font-sans selection:bg-primary selection:text-white">
      {/* Brand Header */}
      <div className="relative pt-16 pb-12 px-6 flex flex-col items-center text-center space-y-6">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 bg-white rounded-3xl overflow-hidden shadow-2xl border-4 border-neutral-800 flex items-center justify-center"
        >
          {list.brandLogo ? (
            <img src={list.brandLogo} alt={list.brandName} className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
          ) : (
            <Package size={40} className="text-neutral-900" />
          )}
        </motion.div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight">{list.name}</h1>
          {list.brandName && (
            <p className="text-primary font-bold uppercase tracking-widest text-xs">Official {list.brandName} Packing List</p>
          )}
        </div>
        
        {list.description && (
          <p className="text-neutral-400 max-w-md text-sm leading-relaxed">{list.description}</p>
        )}
      </div>

      {/* Items List - Bio Style */}
      <div className="max-w-md mx-auto px-6 pb-24 space-y-4">
        {items.map((item, idx) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="group relative bg-neutral-800/50 backdrop-blur border border-neutral-700/50 rounded-2xl overflow-hidden hover:bg-neutral-800 transition-all duration-300"
          >
            <div className="flex items-center p-4 gap-4">
              <div className="w-16 h-16 bg-neutral-700 rounded-xl overflow-hidden flex-shrink-0 border border-neutral-600">
                {item.photoUrls?.[0] ? (
                  <img src={item.photoUrls[0]} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-500">
                    <Package size={24} />
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg truncate">
                  <ReactMarkdown components={{ p: 'span' }}>{item.name}</ReactMarkdown>
                </h3>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-500">
                  <Tag size={10} />
                  <span>{item.assetTag}</span>
                  {item.aiLabel && (
                    <>
                      <span className="w-1 h-1 bg-neutral-700 rounded-full"></span>
                      <span className="text-primary">{item.aiLabel}</span>
                    </>
                  )}
                </div>
              </div>
              
              <div className="text-neutral-600 group-hover:text-primary transition-colors">
                <ChevronRight size={20} />
              </div>
            </div>
            
            {/* Expanded Info on Hover (Optional) or just keep it clean */}
            {item.description && (
              <div className="px-4 pb-4 text-xs text-neutral-500 leading-relaxed border-t border-neutral-700/30 pt-3 mt-1">
                {item.description}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Footer Branding */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-neutral-900 to-transparent flex justify-center">
        <div className="flex items-center gap-2 px-4 py-2 bg-neutral-800/80 backdrop-blur rounded-full border border-neutral-700 shadow-xl">
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Powered by</span>
          <span className="text-[10px] font-black text-white uppercase tracking-widest">GearPack</span>
        </div>
      </div>
    </div>
  );
}
