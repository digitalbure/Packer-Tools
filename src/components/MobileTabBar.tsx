import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useIndustry } from '../context/IndustryContext';
import { LayoutGrid, Package, QrCode, ListChecks, User, Plus, FileText, X } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'motion/react';
import { UserProfile } from '../types';

interface MobileTabBarProps {
  user: UserProfile | null;
}

export default function MobileTabBar({ user }: MobileTabBarProps) {
  const location = useLocation();
  const { getAdjustedLabel, customTerms } = useIndustry();
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Auto-detect mobile keyboard focus to prevent layout shifting
  useEffect(() => {
    const handleResize = () => {
      // If viewport height drops drastically relative to width, keyboard is likely open
      if (window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        const totalHeight = window.innerHeight;
        // Keyboard typically occupies at least 25% of screen height
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
