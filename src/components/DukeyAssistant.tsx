import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  X, 
  Sparkles, 
  RotateCcw, 
  Package,
  ArrowLeft
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
  embedded?: boolean;
  activeSection?: string;
  activePath?: string;
  fullHeight?: boolean;
  onBack?: () => void;
}

export default function DukeyAssistant({ 
  user, 
  embedded = false, 
  activeSection = '', 
  activePath = '',
  fullHeight = false,
  onBack
}: DukeyAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Chatbot states
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Real-time states to sync with Gemini
  const [gearItems, setGearItems] = useState<any[]>([]);
  const [packingLists, setPackingLists] = useState<any[]>([]);
  const [customInventories, setCustomInventories] = useState<any[]>([]);
  const [containers, setContainers] = useState<any[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto resize the text box based on user input content (similar to Gemini text box)
  useEffect(() => {
    if (!embedded) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
  }, [inputValue, embedded]);

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
      
      let greeting = `👋 Hey **${userName}**! I'm **Dukey**, your expert gear architect and packing advisor. 
 
I understand equipment tracking, cable bundles, Pelican setups, and visual asset designer grids. Below you can chat with me! To print adhesive tags, open the **Quick Actions drawer** (via the red Zap icon on the right edge) and select **Print Adhesive Tags** to launch the physical designer!

`;

      if (isSuper) {
        greeting += `🛠️ **Super Admin Access Approved.** I have indexed your live database of **${gearItems.length} items** and can help run real-time audits or configuration tasks!`;
      } else if (user.plan === 'pro' || user.plan === 'enterprise') {
        greeting += `✨ **${planName} Plan Active.** All specialized features (AI Assistant, Cable wrap indicators, custom layouts) are fully online.`;
      } else {
        greeting += `🎒 **Free Plan lounge.** Feel free to query packing rules or load high-density stickers!`;
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

      // If user asks about print tags, qr codes, adhesive or labels, give them a specialized answer and prompt switching tabs!
      const isQrInquiry = /print|qr|adhesive|tag|label|barcode/i.test(rawText);

      const res = await authenticatedFetch('/api/dukey-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: rawText,
          history: chatHistory.slice(-10),
          gear: (gearItems || []).slice(0, 50).map((g: any) => ({
            name: g.name || '',
            brand: g.brand || '',
            model: g.model || '',
            primaryCategory: g.primaryCategory || '',
            quantity: typeof g.quantity === 'number' ? g.quantity : 1,
            status: g.status || ''
          })),
          packingLists: (packingLists || []).slice(0, 10).map((l: any) => ({
            title: l.title || '',
            status: l.status || '',
            itemsCount: l.items?.length || 0
          })),
          customInventories: (customInventories || []).slice(0, 5).map((inv: any) => ({
            name: inv.name || '',
            items: (inv.items || []).slice(0, 10).map((i: any) => ({
              name: i.name || '',
              brand: i.brand || '',
              quantity: typeof i.qty === 'number' ? i.qty : 1
            }))
          })),
          containers: (containers || []).slice(0, 10).map((c: any) => ({
            name: c.name || '',
            type: c.type || '',
            currentWeight: c.currentWeight || 0
          })),
          userProfile: {
            displayName: user.displayName,
            email: user.email,
            isSuperAdmin: user.isSuperAdmin || false,
            role: user.role || 'viewer',
            plan: user.plan || 'free'
          },
          activePath: activePath || window.location.hash,
          activeSection: activeSection || 'General Dashboard'
        })
      });

      if (!res.ok) throw new Error("Dukey's frequency scrambled");

      const data = await res.json();
      let responseText = data.text || '';
      
      if (isQrInquiry) {
        responseText += `\n\n🎯 **Dukey Operator Advice:** I've noticed you are asking about QR or adhesive printing! You can open the **Quick Actions panel** (via the red Zap icon on the right edge of your screen) and select **Print Adhesive Tags (QR)**. This opens the dynamic layout designer where you can configure sizes, custom XLR/SDI cable tags, and sync titles!`;
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'dukey',
        text: responseText,
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
    const prompts = [
      "How do I print adhesive wraps?",
      "How many lenses do we have?",
      "Optimize my Pelican weight list",
      "Explain XLR Cable wrap-around colors"
    ];
    return prompts;
  };

  if (fullHeight) {
    return (
      <div className="w-full h-full flex flex-col bg-neutral-950 text-neutral-200">
        {/* Full-width elegant header with ArrowLeft back button */}
        <div className="p-4 border-b border-neutral-850 bg-neutral-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1 px-2.5 bg-neutral-850 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 rounded-lg text-neutral-300 transition cursor-pointer flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest leading-none shrink-0"
              title="Return to Utilities"
            >
              <ArrowLeft size={11} className="text-[#ff4f3a]" />
              <span>Back</span>
            </button>
            <div className="flex items-center gap-2">
              {/* Rounded square icon style of (green black orange blue) */}
              <div className="w-9 h-9 bg-gradient-to-tr from-orange-500 to-red-500 flex items-center justify-center rounded-xl text-white relative shadow-md">
                <Bot size={20} className="text-white" />
                <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-neutral-950 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 leading-none">
                  <span className="font-extrabold text-[11px] uppercase tracking-wider text-[#ff4f3a]">Dukey AI</span>
                  <span className="text-[7px] bg-[#ff4f3a]/25 text-[#ff4f3a] border border-[#ff4f3a]/30 px-1 py-0.2 rounded font-black uppercase tracking-wider leading-none">Page Aware</span>
                </div>
                <p className="text-[9px] text-neutral-400 font-bold mt-1 uppercase leading-none">
                  Exploring: <span className="text-white normal-case font-semibold">{activeSection || 'General Area'}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleResetChat}
              className="p-1.5 px-2.5 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 tracking-wider font-extrabold text-[9px] uppercase transition cursor-pointer border border-neutral-800 hover:border-neutral-700 bg-neutral-900 leading-none"
              title="Reset conversation"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Chat Message Lists - FULL drawer height */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-3 rounded-2xl text-xs max-w-[85%] leading-relaxed break-words ${
                msg.sender === 'user' 
                  ? 'bg-[#ff4f3a] text-white font-medium rounded-tr-none text-[12px] shadow-md' 
                  : 'bg-neutral-900 border border-neutral-850 text-neutral-100 rounded-tl-none font-medium text-[12px] shadow-sm'
              }`}>
                {msg.sender === 'dukey' ? (
                  <div className="prose prose-sm prose-invert max-w-none text-[12px] text-neutral-200 leading-relaxed space-y-1.5">
                    <Markdown>{msg.text}</Markdown>
                  </div>
                ) : (
                  msg.text
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start animate-fade-in">
              <div className="px-3 py-2.5 bg-neutral-900 border border-neutral-850 rounded-2xl rounded-tl-none flex items-center gap-2 shadow-sm">
                <Sparkles size={12} className="text-[#ff4f3a] animate-spin" />
                <span className="text-[10px] text-neutral-400 animate-pulse uppercase font-black tracking-wider">Dukey is processing...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Suggestions block */}
        {messages.length > 0 && !isLoading && (
          <div className="p-3 bg-neutral-900/40 border-t border-neutral-850 space-y-1.5 shrink-0">
            <header className="flex items-center gap-1.5 px-1 text-[8px] font-black uppercase text-neutral-400 tracking-wider">
              <Sparkles size={10} className="text-[#ff4f3a]" />
              <span>Suggested Queries</span>
            </header>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {getSuggestedPrompts().map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(p)}
                  className="text-[10px] bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 px-2.5 py-1.5 rounded-lg transition text-left cursor-pointer shrink-0 leading-tight"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dynamic growing text box with auto-resize */}
        <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="p-4 border-t border-neutral-850 bg-neutral-900 shrink-0">
          <div className="relative flex items-end bg-neutral-950 border border-neutral-850 rounded-xl p-2 focus-within:border-neutral-700 transition">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Ask Dukey anything..."
              className="flex-1 max-h-[120px] min-h-[30px] bg-transparent text-white text-xs placeholder-neutral-500 focus:outline-none resize-none px-2 py-1.5 leading-normal font-medium"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="p-2 bg-[#ff4f3a] hover:bg-opacity-95 disabled:bg-neutral-850 disabled:text-neutral-500 rounded-lg text-white transition flex items-center justify-center cursor-pointer shrink-0"
            >
              <Send size={12} />
            </button>
          </div>
          <div className="flex items-center justify-between text-[8px] text-neutral-500 mt-1.5 px-1 font-black uppercase tracking-wider">
            <span>Shift+Enter for newline</span>
            <span>Uplink Active</span>
          </div>
        </form>
      </div>
    );
  }

  if (embedded) {
    return (
      <div className="bg-neutral-900 text-white rounded-2xl p-4 border border-neutral-800 text-[10px] leading-relaxed shadow-lg flex flex-col gap-3">
        {/* Header with rounded square avatar */}
        <div className="flex items-center justify-between pb-2 border-b border-neutral-850">
          <div className="flex items-center gap-2.5">
            {/* Rounded square icon */}
            <div className="w-10 h-10 bg-neutral-950 border-2 border-neutral-855 flex items-center justify-center rounded-xl text-primary relative shadow-md">
              <Bot size={22} className="text-[#ff4f3a] hover:scale-105 transition-transform" />
              <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-neutral-950 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-extrabold text-[11px] uppercase tracking-wider text-[#ff4f3a]">Dukey AI</span>
                <span className="text-[7px] bg-[#ff4f3a]/20 text-[#ff4f3a] border border-[#ff4f3a]/30 px-1 py-0.2 rounded font-black uppercase tracking-wider">Page Aware</span>
              </div>
              <p className="text-[9px] text-neutral-400 font-bold mt-1 uppercase leading-none">
                Exploring: <span className="text-white normal-case font-semibold">{activeSection || 'General Area'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleResetChat}
              className="p-1 px-1.5 text-neutral-500 hover:text-neutral-300 rounded hover:bg-neutral-800 tracking-wider font-extrabold text-[8px] uppercase transition cursor-pointer"
              title="Reset conversation"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Chat Message Lists */}
        <div className="max-h-[190px] min-h-[50px] overflow-y-auto space-y-3.5 pr-1 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-2.5 rounded-xl text-xs max-w-[90%] leading-relaxed break-words ${
                msg.sender === 'user' 
                  ? 'bg-[#ff4f3a] text-white font-medium rounded-tr-none text-[11px]' 
                  : 'bg-neutral-950 text-neutral-200 border border-neutral-850 rounded-tl-none font-medium'
              }`}>
                {msg.sender === 'dukey' ? (
                  <div className="prose prose-sm prose-invert max-w-none text-[11px] text-neutral-250 leading-normal space-y-1">
                    <Markdown>{msg.text}</Markdown>
                  </div>
                ) : (
                  msg.text
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="px-2.5 py-2 bg-neutral-950 border border-neutral-855 rounded-xl rounded-tl-none flex items-center gap-2">
                <Sparkles size={11} className="text-[#ff4f3a] animate-spin" />
                <span className="text-[9px] text-neutral-400 animate-pulse uppercase font-black">Dukey is processing...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Suggestions block */}
        {messages.length > 0 && !isLoading && (
          <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pt-1 border-t border-neutral-855">
            {getSuggestedPrompts().map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(p)}
                className="text-[9px] bg-neutral-950 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-855 px-2 py-1 rounded transition text-left cursor-pointer shrink-0 leading-tight"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Dynamic growing text box with auto-resize */}
        <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="mt-1">
          <div className="relative flex items-end bg-neutral-950 border border-neutral-855 rounded-xl p-1.5 focus-within:border-neutral-700 transition">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Ask Dukey anything..."
              className="flex-1 max-h-[100px] min-h-[24px] bg-transparent text-white text-xs placeholder-neutral-600 focus:outline-none resize-none px-2 py-1 leading-normal font-medium"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="p-1 px-1.5 bg-[#ff4f3a] hover:bg-opacity-95 disabled:bg-neutral-850 disabled:text-neutral-600 rounded-lg text-white transition flex items-center justify-center cursor-pointer shrink-0"
            >
              <Send size={11} />
            </button>
          </div>
          <div className="flex items-center justify-between text-[7.5px] text-neutral-500 mt-1 px-1 font-bold uppercase tracking-wider">
            <span>Shift+Enter for newline</span>
            <span>Uplink Active</span>
          </div>
        </form>
      </div>
    );
  }

  return (
    <>
      {/* Floating Sparkle/Bot trigger Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2.5 bg-neutral-900 border border-neutral-800 text-white hover:bg-neutral-800 px-4.5 py-3 rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.25)] hover:shadow-[0_8px_32px_rgba(242,125,38,0.25)] active:scale-95 transition-all group pointer-events-auto cursor-pointer"
          id="dukey-trigger-btn"
          type="button"
        >
          <div className="relative">
            <Bot size={20} className="text-primary group-hover:scale-110 transition-transform" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping text-transparent">●</span>
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
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[70]"
              id="dukey-backdrop"
            />

            {/* Sliding Container Drawer panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-neutral-950 text-neutral-250 shadow-2xl z-[80] flex flex-col border-l border-neutral-800 font-sans"
              id="dukey-chat-drawer"
            >
              {/* Obsidian Glossy Custom Header */}
              <div className="p-4 border-b border-neutral-800 bg-neutral-900 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-primary/10 border border-primary/25 flex items-center justify-center rounded-xl text-primary font-black text-lg relative">
                    <Bot size={20} className="relative z-10" />
                    <div className="absolute inset-0 bg-primary/5 rounded-xl animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 leading-snug">
                      <span className="font-black text-sm uppercase tracking-wider text-white">Dukey</span>
                      <span className="text-[9px] bg-primary/20 text-primary border border-primary/30 px-1.5 py-0.5 rounded font-black uppercase tracking-widest">Expert AI</span>
                    </div>
                    <p className="text-[10px] text-neutral-400 font-medium">Assistant & Printing Portal</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleResetChat}
                    className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
                    title="Reset Dukey Chat"
                    type="button"
                  >
                    <RotateCcw size={14} />
                  </button>
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
                    title="Close Dukey Panel"
                    type="button"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Active Scope and statistics bar */}
              <div className="px-4 py-2 bg-neutral-900/40 border-b border-neutral-850 flex items-center justify-between text-[10px] text-neutral-400">
                <div className="flex items-center gap-1">
                  <Package size={11} className="text-neutral-500" />
                  <span>Gear Assets indexed: <strong>{gearItems.length} styles</strong></span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                  <span className="font-bold text-neutral-300 capitalize">{user.role || 'viewer'} • {user.plan || 'Free'}</span>
                </div>
              </div>

              {/* TAB 1: ORIGINAL GEMINI CHAT BOT */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className="flex gap-2.5 max-w-[85%]">
                        {msg.sender === 'dukey' && (
                          <div className="w-7 h-7 bg-primary/10 border border-primary/25 rounded-lg flex items-center justify-center shrink-0 text-primary pt-0.5">
                            <Bot size={14} />
                          </div>
                        )}
                        <div>
                          <div
                            className={`p-3 rounded-2xl ${
                              msg.sender === 'user'
                                ? 'bg-primary text-white font-medium rounded-tr-none text-xs'
                                : 'bg-neutral-900 border border-neutral-800 text-neutral-100 rounded-tl-none text-xs'
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
                        <div className="w-7 h-7 bg-primary/10 border border-primary/25 rounded-lg flex items-center justify-center shrink-0 text-primary animate-spin">
                          <Sparkles size={13} />
                        </div>
                        <div className="p-3 bg-neutral-900 border border-neutral-800 text-neutral-100 rounded-2xl rounded-tl-none flex items-center gap-2">
                          <span className="text-xs text-neutral-400 font-bold animate-pulse">Dukey is parsing logs...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={chatEndRef} />
                </div>

                {/* Suggestions block */}
                {messages.length > 0 && !isLoading && (
                  <div className="p-3 bg-neutral-900/30 border-t border-neutral-900 space-y-1.5 shrink-0">
                    <header className="flex items-center gap-1 px-1.5 text-[9px] font-black uppercase text-neutral-400 tracking-wider">
                      <Sparkles size={11} className="text-primary" />
                      <span>Query Assistant Guides</span>
                    </header>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-0.5">
                      {getSuggestedPrompts().map((prompt, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSendMessage(prompt)}
                          className="text-[10px] bg-neutral-950 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 px-2.5 py-1.5 rounded-lg transition text-left cursor-pointer shrink-0"
                          type="button"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Input form */}
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
                      placeholder="Ask Dukey about gear rules, lists or tag designs..."
                      className="flex-1 bg-neutral-950 border border-neutral-800 focus:border-primary/50 text-white rounded-xl px-3 py-2.5 text-xs placeholder-neutral-500 font-medium focus:outline-none transition"
                      disabled={isLoading}
                    />
                    <button
                      type="submit"
                      className="p-2.5 bg-primary hover:bg-opacity-90 disabled:bg-neutral-800 disabled:text-neutral-500 text-white rounded-xl transition flex items-center justify-center shrink-0 cursor-pointer"
                      disabled={!inputValue.trim() || isLoading}
                    >
                      <Send size={14} />
                    </button>
                  </form>
                </div>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
