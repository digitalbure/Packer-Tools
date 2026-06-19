import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useIndustry } from '../context/IndustryContext';
import { LayoutGrid, Package, QrCode, ListChecks, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';

interface MobileTabBarProps {
  user: UserProfile | null;
}

export default function MobileTabBar({ user }: MobileTabBarProps) {
  const location = useLocation();
  const { getAdjustedLabel } = useIndustry();
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

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
      to: '/kiosk',
      label: 'Kiosk',
      icon: (
        <div className="relative -top-5 flex items-center justify-center w-14 h-14 rounded-full bg-black text-white shadow-lg shadow-black/25 active:scale-95 transition-all duration-200 border-4 border-neutral-50">
          <QrCode className="w-6 h-6 text-white" />
        </div>
      ),
      activePattern: /^\/kiosk/
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

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden px-4 pb-4 pt-1 bg-gradient-to-t from-neutral-50/90 via-neutral-50/80 to-transparent pointer-events-none">
      <div className="w-full max-w-md mx-auto pointer-events-auto bg-white/95 backdrop-blur-xl rounded-[2rem] border border-neutral-100 shadow-2xl flex items-center justify-between py-2.5 px-3">
        {tabs.map((tab, idx) => {
          const isActive = tab.activePattern.test(location.pathname);
          const isCenterTab = idx === 2; // Kiosk button

          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`flex flex-col items-center justify-center flex-1 relative select-none ${
                isCenterTab ? 'h-10' : 'h-12'
              }`}
            >
              <div 
                className={`transition-all duration-300 ${
                  isCenterTab 
                    ? '' 
                    : isActive 
                      ? 'text-black scale-110' 
                      : 'text-neutral-400 hover:text-neutral-600'
                }`}
              >
                {tab.icon}
              </div>

              {!isCenterTab && (
                <span 
                  className={`text-[9px] font-black uppercase tracking-wider mt-1 transition-colors duration-250 truncate max-w-[70px] ${
                    isActive ? 'text-black font-extrabold' : 'text-neutral-400'
                  }`}
                >
                  {tab.label}
                </span>
              )}

              {isActive && !isCenterTab && (
                <span className="absolute bottom-0 w-1.5 h-1.5 rounded-full bg-black" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
