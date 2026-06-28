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
import { ArrowUp, Layers } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db, logout } from '../firebase';
import { IndustryProvider } from '../context/IndustryContext';
import GroupsDrawer from '../components/GroupsDrawer';

export interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [isGroupsDrawerOpen, setIsGroupsDrawerOpen] = React.useState(false);
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
      <div className={`min-h-screen font-sans flex overflow-hidden w-full ${user && user.layoutTheme === 'workflow' && !isLayoutHidden ? 'bg-[#111113] text-[#dfdfe5]' : 'bg-neutral-50 text-neutral-900'}`}>
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
    </IndustryProvider>
  );
};
