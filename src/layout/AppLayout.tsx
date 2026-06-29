import React from 'react';
import { useAuth } from '../providers/AuthProvider';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import MobileTabBar from '../components/MobileTabBar';
import WorkflowLayout from '../components/WorkflowLayout';
import Footer from '../components/Footer';
import CommunitySelector from '../components/CommunitySelector';
import Onboarding from '../components/Onboarding';
import AddGearModal from '../components/AddGearModal';
import QuickActionsDrawer from '../components/QuickActionsDrawer';
import CommandPalette from '../components/CommandPalette';
import BetaProspectGate from '../components/BetaProspectGate';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp, Layers, AlertTriangle, ExternalLink, X } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db, logout } from '../firebase';
import { IndustryProvider } from '../context/IndustryContext';
import GroupsDrawer from '../components/GroupsDrawer';

export interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [isGroupsDrawerOpen, setIsGroupsDrawerOpen] = React.useState(false);
  const [quotaExceeded, setQuotaExceeded] = React.useState(() => {
    return typeof window !== 'undefined' && !!(window as any).__firestore_quota_exceeded__;
  });

  React.useEffect(() => {
    const handleQuotaExceeded = () => {
      setQuotaExceeded(true);
    };
    window.addEventListener('firestore_quota_exceeded', handleQuotaExceeded);
    return () => {
      window.removeEventListener('firestore_quota_exceeded', handleQuotaExceeded);
    };
  }, []);
  const {
    user, setUser,
    adminSettings,
    isInvited,
    selectedCommunity, setSelectedCommunity,
    isCommunitySelectorOpen, setIsCommunitySelectorOpen,
    isSidebarCollapsed, setIsSidebarCollapsed,
    isMobileSidebarOpen, setIsMobileSidebarOpen,
    landingView, setLandingView,
    listsCount,
    currentHash,
    toggleLayoutTheme,
    isLayoutHidden,
    showScrollTop
  } = useAuth();

  const isBetaRestricted = adminSettings?.betaModeEnabled && user && !user.isSuperAdmin && isInvited === false;

  if (isBetaRestricted) {
    return <BetaProspectGate user={user} onLogout={logout} />;
  }

  return (
    <IndustryProvider user={user} adminSettings={adminSettings}>
      <div className="flex flex-col w-full min-h-screen">
        <AnimatePresence>
          {quotaExceeded && (
            <motion.div
              id="firestore-quota-alert-banner"
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="w-full bg-gradient-to-r from-amber-600 via-[#F27D26] to-amber-600 text-white px-4 py-3 text-xs sm:text-sm font-semibold flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg z-[9999] relative border-b border-amber-500/30"
            >
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-1.5 rounded-lg shrink-0">
                  <AlertTriangle size={16} className="text-white animate-pulse" />
                </div>
                <div>
                  <span className="font-extrabold uppercase tracking-wide mr-2">Database Quota Exceeded:</span>
                  <span className="opacity-95 font-medium">Your Firebase project "packer-tools" has reached its free daily Firestore read units limit. The app has switched to cached offline mode. Resets at midnight Pacific Time.</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href="https://console.firebase.google.com/project/packer-tools/firestore/databases/ai-studio-8af96458-c1d9-4cdf-9c9a-815dee7f9c70/data?openUpgradeDialog=true"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white hover:bg-white/95 text-neutral-900 px-3.5 py-1.5 rounded-xl font-bold uppercase tracking-wider text-[10px] sm:text-xs transition flex items-center gap-1.5 shadow-md active:scale-95 whitespace-nowrap"
                >
                  <span>Upgrade / Enable Billing</span>
                  <ExternalLink size={12} />
                </a>
                <button
                  type="button"
                  onClick={() => setQuotaExceeded(false)}
                  className="hover:bg-white/10 p-1.5 rounded-lg transition text-white"
                  title="Dismiss"
                >
                  <X size={14} className="stroke-[3]" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={`flex-1 flex overflow-hidden w-full ${user && user.layoutTheme === 'workflow' && !isLayoutHidden ? 'bg-[#111113] text-[#dfdfe5]' : 'bg-neutral-50 text-neutral-900'}`}>
        {user && user.layoutTheme === 'workflow' && !isLayoutHidden ? (
          <WorkflowLayout
            user={user}
            setUser={setUser}
            adminSettings={adminSettings}
            selectedCommunity={selectedCommunity}
            onOpenSelector={() => setIsCommunitySelectorOpen(true)}
            onToggleLayoutTheme={toggleLayoutTheme}
          >
            {children}
          </WorkflowLayout>
        ) : (
          <>
            {user && !isLayoutHidden && (
              <Sidebar 
                user={user} 
                adminSettings={adminSettings} 
                isCollapsed={isSidebarCollapsed} 
                setIsCollapsed={setIsSidebarCollapsed} 
                isMobileOpen={isMobileSidebarOpen}
                setIsMobileOpen={setIsMobileSidebarOpen}
                listsCount={listsCount}
              />
            )}
            
            <div className="flex-1 min-w-0 flex flex-col min-h-screen transition-all duration-300 font-sans">
              {!isLayoutHidden && (
                <Navbar 
                  user={user} 
                  adminSettings={adminSettings} 
                  onMenuClick={() => setIsMobileSidebarOpen(true)} 
                  selectedCommunity={selectedCommunity}
                  onOpenSelector={() => setIsCommunitySelectorOpen(true)}
                  landingView={landingView}
                  setLandingView={setLandingView}
                  onToggleLayoutTheme={toggleLayoutTheme}
                />
              )}
              <main className={`flex-1 w-full overflow-y-auto flex flex-col justify-between ${
                isLayoutHidden 
                  ? `max-w-none px-0 py-0 sm:px-0 sm:py-0 ${(currentHash.startsWith('#/p/') || currentHash.startsWith('#/gear/')) ? 'bg-neutral-50' : 'bg-neutral-900'}` 
                  : 'max-w-[1700px] mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-28 md:pb-8'
              }`}>
                <div className="flex-1">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {children}
                  </motion.div>
                </div>
                {!isLayoutHidden && (
                  <Footer 
                    adminSettings={adminSettings} 
                    selectedCommunity={selectedCommunity}
                    onOpenSelector={() => setIsCommunitySelectorOpen(true)}
                    user={user}
                  />
                )}
              </main>
            </div>
          </>
        )}

        {/* Dynamic Geographic Community Router Portal */}
        <CommunitySelector
          user={user}
          adminSettings={adminSettings}
          selectedCommunity={selectedCommunity}
          isOpen={isCommunitySelectorOpen && (user ? !!user.onboardingCompleted : true)}
          onSelect={async (mId) => {
            localStorage.setItem("packer_selected_community", mId);
            setSelectedCommunity(mId);
            setIsCommunitySelectorOpen(false);
            if (user) {
              try {
                const userRef = doc(db, 'users', user.uid);
                await setDoc(userRef, { selectedCommunity: mId }, { merge: true });
                setUser(prev => prev ? { ...prev, selectedCommunity: mId } : null);
              } catch (err) {
                console.error("Failed to sync selected community to Firestore:", err);
              }
            }
          }}
          onClose={() => setIsCommunitySelectorOpen(false)}
          isDismissible={selectedCommunity !== null}
        />

        {user && !user.onboardingCompleted && (
          <Onboarding 
            user={user} 
            onComplete={() => {
              setUser({ ...user, onboardingCompleted: true });
              if (!selectedCommunity) {
                setIsCommunitySelectorOpen(true);
              }
            }} 
          />
        )}

        {user && !isLayoutHidden && <MobileTabBar user={user} />}
        {user && <AddGearModal user={user} adminSettings={adminSettings} />}
        {user && <QuickActionsDrawer user={user} />}
        {user && <GroupsDrawer user={user} isOpen={isGroupsDrawerOpen} onClose={() => setIsGroupsDrawerOpen(false)} />}
        {user && (
          <CommandPalette 
            onToggleSidebar={() => setIsSidebarCollapsed(prev => !prev)} 
          />
        )}

        <AnimatePresence>
          {user && !isLayoutHidden && (
            <motion.button
              id="groups-floating-trigger"
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              onClick={() => setIsGroupsDrawerOpen(true)}
              className="fixed bottom-24 right-5 z-40 p-3 rounded-full bg-neutral-950 border border-neutral-800 text-white shadow-2xl hover:bg-black active:scale-95 transition-all flex items-center justify-center pointer-events-auto group focus:outline-none"
              title="Open Groups Module"
            >
              <Layers size={18} className="stroke-[2.5]" />
            </motion.button>
          )}
          {showScrollTop && (
            <motion.button
              id="back-to-top"
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="fixed bottom-36 right-5 z-40 p-3 rounded-full bg-neutral-900 border border-neutral-800 text-white shadow-2xl hover:bg-black active:scale-95 transition-all flex items-center justify-center pointer-events-auto group focus:outline-none"
              title="Back to Top"
            >
              <ArrowUp size={18} className="stroke-[3] group-hover:-translate-y-0.5 transition-transform" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  </IndustryProvider>
  );
};
