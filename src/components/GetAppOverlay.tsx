import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Download,
  Smartphone,
  X,
  CheckCircle2,
  Zap,
  QrCode,
  WifiOff,
  Share,
  PlusSquare,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import PackerLogo from './PackerLogo';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface GetAppOverlayProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export default function GetAppOverlay({ forceOpen, onClose }: GetAppOverlayProps) {
  const { isReadyToInstall, isInstalled, triggerInstall } = usePWAInstall();
  const [isOpen, setIsOpen] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Detect Mobile & iOS
    const ua = navigator.userAgent || '';
    const mobileCheck = /Mobi|Android|iPhone|iPad|iPod/i.test(ua) || window.innerWidth < 768;
    const iosCheck = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;

    setIsMobileDevice(mobileCheck);
    setIsIOS(iosCheck);

    // Explicit listener for manual trigger event (e.g. from buttons/menu items)
    const handleOpenOverlay = () => {
      setIsOpen(true);
    };

    window.addEventListener('open-get-app-overlay', handleOpenOverlay);

    // Auto-open logic on mobile if not standalone and not dismissed this session
    const isDismissed = sessionStorage.getItem('pwa_get_app_dismissed') === 'true';
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;

    if (!isStandalone && !isDismissed && (mobileCheck || forceOpen)) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1500);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('open-get-app-overlay', handleOpenOverlay);
    };
  }, [forceOpen]);

  // Sync if forceOpen prop changes
  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
    }
  }, [forceOpen]);

  // Handle Close / Dismiss
  const handleDismiss = () => {
    sessionStorage.setItem('pwa_get_app_dismissed', 'true');
    setIsOpen(false);
    if (onClose) onClose();
  };

  // Handle Install Action
  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      await triggerInstall();
    } finally {
      setIsInstalling(false);
    }
  };

  // If already running standalone or component closed, do not render modal unless forced
  if (isInstalled && !forceOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4 select-none">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleDismiss}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal / Bottom Sheet Card */}
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md bg-neutral-900 border-t sm:border border-neutral-800 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl overflow-hidden z-10 text-white"
          >
            {/* Ambient Background Glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Top Close Button */}
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
              title="Close"
            >
              <X size={20} />
            </button>

            {/* Content Container */}
            <div className="flex flex-col items-center text-center space-y-4">
              {/* App Icon Badge */}
              <div className="relative">
                <PackerLogo variant="app-icon" size={48} className="shadow-2xl ring-4 ring-neutral-800" />
                <span className="absolute -bottom-1 -right-1 p-1 bg-primary text-white rounded-full shadow-lg">
                  <Smartphone size={14} />
                </span>
              </div>

              {/* Title & Subtitle */}
              <div>
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-primary/20 text-primary border border-primary/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Sparkles size={11} />
                    <span>Official Mobile App</span>
                  </span>
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight text-white">
                  Get Packer.Tools
                </h3>
                <p className="text-xs text-neutral-400 font-medium mt-1 max-w-xs leading-relaxed">
                  Install the native web app on your home screen for instant gear management, offline mode, and camera barcode scanning.
                </p>
              </div>

              {/* Feature Highlights Grid */}
              <div className="w-full grid grid-cols-3 gap-2 bg-neutral-950/80 border border-neutral-800 p-3 rounded-2xl text-left my-1">
                <div className="flex flex-col items-center text-center p-1">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-1.5">
                    <Zap size={16} />
                  </div>
                  <span className="text-[10px] font-bold text-neutral-200">Instant Load</span>
                  <span className="text-[8px] text-neutral-500">Zero lag</span>
                </div>

                <div className="flex flex-col items-center text-center p-1 border-x border-neutral-800/80">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-1.5">
                    <WifiOff size={16} />
                  </div>
                  <span className="text-[10px] font-bold text-neutral-200">Offline Sync</span>
                  <span className="text-[8px] text-neutral-500">Works everywhere</span>
                </div>

                <div className="flex flex-col items-center text-center p-1">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-1.5">
                    <QrCode size={16} />
                  </div>
                  <span className="text-[10px] font-bold text-neutral-200">Cam Scanner</span>
                  <span className="text-[8px] text-neutral-500">Fast checkouts</span>
                </div>
              </div>

              {/* iOS-specific Step-by-Step Instructions */}
              {isIOS ? (
                <div className="w-full bg-neutral-950 border border-neutral-800 p-3.5 rounded-2xl text-left space-y-2">
                  <p className="text-[11px] font-extrabold uppercase text-amber-400 flex items-center gap-1.5">
                    <Smartphone size={13} />
                    <span>How to install on iOS Safari:</span>
                  </p>
                  <ol className="text-[11px] text-neutral-300 space-y-1.5 font-medium pl-1">
                    <li className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-200 text-[10px] font-black flex items-center justify-center shrink-0">1</span>
                      <span>Tap the <strong className="text-white">Share</strong> button in Safari (<Share size={12} className="inline mx-0.5 text-blue-400" /> icon).</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-200 text-[10px] font-black flex items-center justify-center shrink-0">2</span>
                      <span>Scroll down and select <strong className="text-white">Add to Home Screen</strong> (<PlusSquare size={12} className="inline mx-0.5 text-emerald-400" />).</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-200 text-[10px] font-black flex items-center justify-center shrink-0">3</span>
                      <span>Tap <strong className="text-white">Add</strong> to complete installation.</span>
                    </li>
                  </ol>
                </div>
              ) : null}

              {/* Action Buttons */}
              <div className="w-full space-y-2 pt-1">
                {!isIOS && (
                  <button
                    type="button"
                    onClick={handleInstallClick}
                    disabled={isInstalling}
                    className="w-full py-3.5 px-4 bg-primary hover:bg-primary/90 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-xl flex items-center justify-center gap-2 transition active:scale-98 disabled:opacity-50 cursor-pointer"
                  >
                    <Download size={16} />
                    <span>{isInstalling ? 'Installing App...' : 'Add to Home Screen'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleDismiss}
                  className="w-full py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs rounded-2xl transition cursor-pointer"
                >
                  {isIOS ? 'Got It' : 'Maybe Later'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
