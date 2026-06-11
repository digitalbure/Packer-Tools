import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  X, 
  Sparkles, 
  RotateCcw, 
  Layers, 
  HelpCircle, 
  User, 
  ShieldAlert, 
  Package, 
  Zap,
  Info 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import Markdown from 'react-markdown';
import { authenticatedFetch } from '../lib/api';

interface Message {
  id: string;
  sender: 'user' | 'dukey';
  text: string;
  timestamp: Date;
}

interface DukeyAssistantProps {
  user: UserProfile;
}

export default function DukeyAssistant({ user }: DukeyAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Real-time states to sync with Gemini
  const [gearItems, setGearItems] = useState<any[]>([]);
  const [packingLists, setPackingLists] = useState<any[]>([]);
  const [customInventories, setCustomInventories] = useState<any[]>([]);
  const [containers, setContainers] = useState<any[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to real-time collections for precision context
  useEffect(() => {
    if (!user) return;

    const qGear = query(collection(db, 'users', user.uid, 'gearLibrary'));
    const unsubGear = onSnapshot(qGear, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGearItems(items);
    }, (error) => {
      console.warn("DukeyAssistant: Error listening to gear library:", error);
    });

    const qList = query(collection(db, 'packingLists'), where('ownerId', '==', user.uid));
    const unsubList = onSnapshot(qList, (snapshot) => {
      const lists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPackingLists(lists);
    }, (error) => {
      console.warn("DukeyAssistant: Error listening to packing lists:", error);
    });

    // Real-time custom inventories sheet integration with sub-items resolving
    const qInvs = query(collection(db, 'inventories'));
    const unsubInvs = onSnapshot(qInvs, async (snapshot) => {
      const allInvs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      const userInvs = allInvs.filter((inv: any) => 
        inv.ownerId === user.uid ||
        inv.ownerEmail?.toLowerCase() === user.email?.toLowerCase() ||
        inv.collaborators?.some((c: any) => c.email?.toLowerCase() === user.email?.toLowerCase())
      );
      
      try {
        const resolvedInvs = await Promise.all(
          userInvs.map(async (inv) => {
            try {
              const itemsSnap = await getDocs(collection(db, 'inventories', inv.id, 'items'));
              const items = itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
              return { ...inv, items };
            } catch (e) {
              console.error("Error fetching items for inventory", inv.id, e);
              return { ...inv, items: [] };
            }
          })
        );
        setCustomInventories(resolvedInvs);
      } catch (err) {
        console.error("Error subresolving inventories", err);
      }
    }, (error) => {
      console.warn("DukeyAssistant: Error listening to inventories:", error);
    });

    const qContainers = query(collection(db, 'users', user.uid, 'containers'));
    const unsubContainers = onSnapshot(qContainers, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setContainers(items);
    }, (error) => {
      console.warn("DukeyAssistant: Error listening to containers:", error);
    });

    return () => {
      unsubGear();
      unsubList();
      unsubInvs();
      unsubContainers();
    };
  }, [user]);

  // Handle global shortcut/trigger to open Dukey assistant
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
    };
    window.addEventListener('open-dukey', handleOpen);
    return () => {
      window.removeEventListener('open-dukey', handleOpen);
    };
  }, []);

  // Set up initial greeting based on the user's role and plan
  useEffect(() => {
    if (messages.length === 0 && user) {
      const isSuper = user.isSuperAdmin;
      const userName = user.displayName || user.email.split('@')[0];
      const planName = (user.plan || 'Free').toUpperCase();
      
      let greeting = `👋 Hey **${userName}**! I'm **Dukey**, your expert gear architect and packing strategist. 

I understand equipment integration, camera rigs, power management, storage compliance, and can help you organize packs instantly!

`;

      if (isSuper) {
        greeting += `🛠️ **Super Admin Access Approved.** I have indexed your live database of **${gearItems.length} items** and **${packingLists.length} packing lists**. Ask me system level reports, statistics, or audit query details!`;
      } else if (user.plan === 'pro' || user.plan === 'enterprise') {
        greeting += `✨ **${planName} Plan Active.** All specialized features (AI Wizard, Custom Cases, Rack allocations) are online. Ready to optimize your high-stakes logistics or inventory weight?`;
      } else {
        greeting += `🎒 **Free Plan Lounge.** I see you have **${gearItems.length}/25 gear items** registered. Ask me general packing advice or how to expand list assemblies! *Tip: Upgrading to Pro lets us track more gear and build travel kits!*`;
      }

      setMessages([
        {
          id: 'welcome',
          sender: 'dukey',
          text: greeting,
          timestamp: new Date()
        }
      ]);
    }
  }, [user, gearItems.length, packingLists.length, messages.length]);

  // Handle scrolling to bottom of messages
  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const rawText = textToSend || inputValue;
    if (!rawText.trim() || isLoading) return;

    const userMsgId = Date.now().toString();
    const newUserMessage: Message = {
      id: userMsgId,
      sender: 'user',
      text: rawText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newUserMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const chatHistory = messages.map(msg => ({
        sender: msg.sender,
        text: msg.text
      }));

      const res = await authenticatedFetch('/api/dukey-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: rawText,
          history: chatHistory.slice(-10),
          gear: (gearItems || []).slice(0, 100).map((g: any) => ({
            name: g.name || '',
            brand: g.brand || '',
            model: g.model || '',
            primaryCategory: g.primaryCategory || '',
            quantity: typeof g.quantity === 'number' ? g.quantity : 1,
            status: g.status || ''
          })),
          packingLists: (packingLists || []).slice(0, 20).map((l: any) => ({
            title: l.title || '',
            status: l.status || '',
            itemsCount: l.items?.length || 0
          })),
          customInventories: (customInventories || []).slice(0, 10).map((inv: any) => ({
            name: inv.name || '',
            items: (inv.items || []).slice(0, 20).map((i: any) => ({
              name: i.name || '',
              brand: i.brand || '',
              quantity: typeof i.quantity === 'number' ? i.quantity : (typeof i.qty === 'number' ? i.qty : 1),
              primaryCategory: i.primaryCategory || i.cat || ''
            }))
          })),
          containers: (containers || []).slice(0, 20).map((c: any) => ({
            name: c.name || '',
            type: c.type || '',
            model: c.model || '',
            weightLimit: c.weightLimit || null,
            currentWeight: c.currentWeight || 0
          })),
          userProfile: {
            displayName: user.displayName,
            email: user.email,
            isSuperAdmin: user.isSuperAdmin || false,
            role: user.role || 'viewer',
            plan: user.plan || 'free'
          },
          recentViews: (() => {
            try {
              return JSON.parse(localStorage.getItem("packer_recent_views") || "[]");
            } catch (e) {
              return [];
            }
          })()
        })
      });

      if (!res.ok) throw new Error("Dukey's frequency scrambled");

      const data = await res.json();
      
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'dukey',
        text: data.text || "I processed your request but returned a blank thought. Try rephrasing!",
        timestamp: new Date()
      }]);
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'dukey',
        text: "⚠️ **System Overload:** Dukey failed to transmit a response. Let me check the integration grids and try again!",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetChat = () => {
    setMessages([]);
  };

  // Pre-compiled contextual prompt recommendations
  const getSuggestedPrompts = () => {
    const prompts = [];
    
    // Check local equipment list
    const hasLenses = gearItems.some(i => 
      i.primaryCategory === 'Lens' || 
      i.name?.toLowerCase().includes('lens') || 
      i.model?.toLowerCase().includes('lens')
    );
    const hasBatteries = gearItems.some(i => 
      i.name?.toLowerCase().includes('battery') || 
      i.name?.toLowerCase().includes('v-mount') ||
      i.primaryCategory === 'Power'
    );

    if (hasLenses) {
      prompts.push("How many lenses are there?");
    } else {
      prompts.push("Suggest camera lenses or setups");
    }

    if (hasBatteries) {
      prompts.push("How many batteries do we have?");
    } else {
      prompts.push("How should I pack power equipment?");
    }

    if (containers && containers.length > 0) {
      prompts.push(`Suggest storage layouts for my ${containers[0].name || 'cases'}`);
    } else {
      prompts.push("Suggest storage containers & Pelican setups");
    }

    if (customInventories && customInventories.length > 0) {
      prompts.push(`Suggest kit builds using ${customInventories[0].name || 'our inventory'}`);
    } else {
      prompts.push("Suggest custom kit builds & upgrades");
    }

    return prompts.slice(0, 4);
  };

  return (
    <>
      {/* Floating Sparkle/Bot trigger Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2.5 bg-neutral-900 border border-neutral-800 text-white hover:bg-neutral-800 px-4.5 py-3 rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.25)] hover:shadow-[0_8px_32px_rgba(242,125,38,0.25)] active:scale-95 transition-all group pointer-events-auto cursor-pointer"
          id="dukey-trigger-btn"
        >
          <div className="relative">
            <Bot size={20} className="text-primary group-hover:scale-115 transition-transform" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-neutral-900" />
          </div>
          <span className="font-extrabold text-xs uppercase tracking-wider">Ask Dukey</span>
        </button>
      </div>

      {/* Floating Sidebar Chat Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop cover overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs z-[70]"
              id="dukey-backdrop"
            />

            {/* Sliding Container Drawer panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-neutral-950 text-neutral-200 shadow-2xl z-[80] flex flex-col border-l border-neutral-800"
              id="dukey-chat-drawer"
            >
              {/* Obsidian Glossy Custom Header */}
              <div className="p-4.5 border-b border-neutral-800 bg-neutral-900 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 border border-primary/20 flex items-center justify-center rounded-xl text-primary font-black text-lg relative">
                    <Bot size={22} className="relative z-10" />
                    <div className="absolute inset-0 bg-primary/5 rounded-xl animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 leading-snug">
                      <span className="font-black text-sm uppercase tracking-wider text-white">Dukey</span>
                      <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 px-1.5 py-0.5 rounded font-black uppercase tracking-widest">Expert AI</span>
                    </div>
                    <p className="text-[10px] text-neutral-400 font-medium">Platform Knowledge Engine</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleResetChat}
                    className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
                    title="Reset Dukey Chat"
                  >
                    <RotateCcw size={15} />
                  </button>
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
                    title="Close Dukey Panel"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Scope and role statistics bar */}
              <div className="px-4.5 py-2 bg-neutral-900/50 border-b border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
                <div className="flex items-center gap-1">
                  <Package size={12} className="text-neutral-500" />
                  <span>Library context: <strong>{gearItems.length} items</strong></span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  <span className="font-bold text-neutral-300 capitalize">{user.role || 'viewer'} • {user.plan || 'Free'}</span>
                </div>
              </div>

              {/* Custom Chat Feed Area */}
              <div className="flex-1 overflow-y-auto p-4.5 space-y-4 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className="flex gap-2.5 max-w-[85%]">
                      {msg.sender === 'dukey' && (
                        <div className="w-7 h-7 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center shrink-0 text-primary pt-0.5">
                          <Bot size={15} />
                        </div>
                      )}
                      <div>
                        <div
                          className={`p-3 rounded-2xl ${
                            msg.sender === 'user'
                              ? 'bg-primary text-white font-medium rounded-tr-none'
                              : 'bg-neutral-900 border border-neutral-800 text-neutral-100 rounded-tl-none'
                          }`}
                        >
                          {msg.sender === 'dukey' ? (
                            <div className="prose prose-sm prose-invert max-w-none text-xs leading-relaxed space-y-1.5 text-neutral-200">
                              <Markdown>{msg.text}</Markdown>
                            </div>
                          ) : (
                            <p className="text-xs break-words leading-relaxed">{msg.text}</p>
                          )}
                        </div>
                        <span className="text-[9px] text-neutral-500 mt-1 block px-1 text-right">
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="flex gap-2.5 max-w-[85%]">
                      <div className="w-7 h-7 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center shrink-0 text-primary animate-spin">
                        <Sparkles size={14} />
                      </div>
                      <div className="p-3 bg-neutral-900 border border-neutral-800 text-neutral-100 rounded-2xl rounded-tl-none flex items-center gap-2">
                        <span className="text-xs text-neutral-400 font-bold animate-pulse">Dukey is analyzing lists...</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={chatEndRef} />
              </div>

              {/* Suggestions / Prompt recommendations panel */}
              {messages.length > 0 && !isLoading && (
                <div className="p-3 bg-neutral-900/40 border-t border-neutral-900 space-y-1.5 shrink-0">
                  <header className="flex items-center gap-1 px-1.5 text-[10px] font-black uppercase text-neutral-500 tracking-wider">
                    <Sparkles size={11} className="text-primary" />
                    <span>Inquire Dukey</span>
                  </header>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 scrollbar-hide">
                    {getSuggestedPrompts().map((prompt, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(prompt)}
                        className="text-[10px] bg-neutral-950 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 px-2.5 py-1.5 rounded-lg transition text-left cursor-pointer active:scale-95 shrink-0"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Box Controls */}
              <div className="p-4 border-t border-neutral-800 bg-neutral-900 shrink-0">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Ask Dukey about gear, counts, assembly or rules..."
                    className="flex-1 bg-neutral-950 border border-neutral-800 focus:border-primary/50 text-white rounded-xl px-3 py-2.5 text-xs placeholder-neutral-500 font-medium focus:outline-none transition"
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    className="p-2.5 bg-primary hover:bg-opacity-90 disabled:bg-neutral-800 disabled:text-neutral-500 text-white rounded-xl transition flex items-center justify-center shrink-0 cursor-pointer"
                    disabled={!inputValue.trim() || isLoading}
                  >
                    <Send size={15} />
                  </button>
                </form>
                
                {/* Upgrade advise for Free Tier */}
                {user.plan !== 'pro' && user.plan !== 'enterprise' && (
                  <div className="mt-2.5 flex items-start gap-1 px-1 text-[9px] text-neutral-500 select-none">
                    <Info size={10} className="text-primary shrink-0 mt-0.5" />
                    <span>Unlocked with Dukey: auto-assembly analysis, weight-distribution modeling, and up to 10,000 gear limits.</span>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
