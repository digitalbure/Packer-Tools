import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Cpu, Layers, Zap, CheckCircle2, CloudOff, Database, Smartphone, QrCode, Terminal, HelpCircle } from 'lucide-react';

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WhatsNewModal({ isOpen, onClose }: WhatsNewModalProps) {
  const [activeTab, setActiveTab] = useState<'all' | '5.8.0' | '5.7.0' | '5.6.0' | '5.5.0' | '5.4.0' | '5.3.0'>('all');

  const releases = [
    {
      version: 'v5.8.0',
      tag: 'Latest',
      tagBg: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      title: 'Physical Avery Sheets Mode & Storage Safeguards',
      date: 'July 2026',
      icon: Sparkles,
      color: 'text-primary',
      updates: [
        {
          title: 'Avery Label Sheet Designer',
          desc: 'Toggle between standard ribbons and physical multi-column label sheets (Avery 5160, 5161, 5162, etc.). Custom-tailor margins, row layouts, and spacing presets effortlessly.',
          badge: 'Avery Printing'
        },
        {
          title: 'Start Slot Selector',
          desc: 'Select a custom starting label slot when printing partially-used Avery sheets to prevent unnecessary material waste.',
          badge: 'Start Slot'
        },
        {
          title: 'Storage Exhaustion Monkey-Patch',
          desc: 'Engineered automatic interceptors for localStorage and sessionStorage, auto-purging obsolete cache entries on private-browsing QuotaExceeded errors.',
          badge: 'Crash Protection'
        }
      ]
    },
    {
      version: 'v5.7.0',
      tag: 'Bulk Operations',
      tagBg: 'bg-indigo-50 text-indigo-700 border-indigo-100',
      title: 'Bulk List Copying & Multi-Select Operations',
      date: 'July 2026',
      icon: Sparkles,
      color: 'text-primary',
      updates: [
        {
          title: 'Cross-List Bulk Copying',
          desc: 'Allows users to replicate selected gear library items completely into custom inventory sheets or packing lists, complete with automatic item instantiation.',
          badge: 'List Copy'
        },
        {
          title: 'Fast Status Updates',
          desc: 'Instantly transitions selected assets across Available, In Use, Maintenance, Retired, or Missing states, utilizing chunked Firestore batches.',
          badge: 'Bulk Status'
        },
        {
          title: 'Real-time List Sync',
          desc: 'Configured deep-listening subscriptions for active packing lists, enabling on-the-fly list creations and exports in the multi-select terminal.',
          badge: 'List Sync'
        }
      ]
    },
    {
      version: 'v5.6.0',
      tag: 'Stability Upgrade',
      tagBg: 'bg-neutral-50 text-neutral-600 border-neutral-200/50',
      title: 'Mobile Direct Load & Loading Safeguards',
      date: 'July 2026',
      icon: Sparkles,
      color: 'text-rose-500',
      updates: [
        {
          title: 'Direct Item Loading',
          desc: 'Allows items to be loaded directly to new or existing lists/inventories from the mobile central Add menu without requiring prior library registration.',
          badge: 'Direct Load'
        },
        {
          title: 'Multi-Way Cross Synchronization',
          desc: 'Choose to automatically register directly loaded items to the Central Gear Library, or replicate them across both packing lists and custom sheet inventories.',
          badge: 'Flexible Sync'
        },
        {
          title: 'Loading Skeleton Safety Fallbacks',
          desc: 'Added 2.5-second automated fallbacks to real-time sync connections, ensuring the app gracefully bypasses slow database snapshots and never remains stuck.',
          badge: 'Timeout Safeguards'
        }
      ]
    },
    {
      version: 'v5.5.0',
      tag: 'Offline Sync',
      tagBg: 'bg-indigo-50 text-indigo-700 border-indigo-100',
      title: 'Service Worker IndexedDB Caching',
      date: 'July 2026',
      icon: CloudOff,
      color: 'text-emerald-500',
      updates: [
        {
          title: 'Resilient SW Caching',
          desc: 'Primary gear library list and custom inventories are cached locally inside the Service Worker\'s IndexedDB, avoiding blank screens.',
          badge: 'IndexedDB'
        },
        {
          title: 'Automated Offline Failover',
          desc: 'The app seamlessly detects project read-quota exceptions or internet outages and instantly feeds records from the local database.',
          badge: 'Auto-Failover'
        }
      ]
    },
    {
      version: 'v5.4.0',
      tag: 'UI Refresh',
      tagBg: 'bg-indigo-50 text-indigo-700 border-indigo-100',
      title: 'Fluid Mobile Experiences',
      date: 'May 2026',
      icon: Smartphone,
      color: 'text-indigo-500',
      updates: [
        {
          title: 'Spring Bottom Tab Bar',
          desc: 'A gorgeous, ergonomic mobile navigation bar featuring custom micro-animations, quick-action center, and responsive sub-menu drawers.',
          badge: 'Spring Physics'
        },
        {
          title: 'Lazy Page Performance',
          desc: 'Core dashboard assets are split-chunked to load on demand, reducing start-up package size by up to 45%.',
          badge: 'Performance'
        }
      ]
    },
    {
      version: 'v5.3.0',
      tag: 'Major Engine Upgrade',
      tagBg: 'bg-primary/5 text-primary border-primary/10',
      title: 'Enterprise Auditing & Batch Security',
      date: 'March 2026',
      icon: Sparkles,
      color: 'text-primary',
      updates: [
        {
          title: '500-Item Bulk Partitioning',
          desc: 'Safeguarded all bulk allocations and inventory assignments with loop-based partition chunking, strictly honoring Firestore\'s 500 write-batch limit.',
          badge: 'Batch Safe'
        },
        {
          title: 'Cost-Slasher Analytics Queries',
          desc: 'Switched from client-side array pulling to serverless metadata aggregations via getCountFromServer, cutting project storage read billing.',
          badge: 'Serverless'
        },
        {
          title: 'Interactive QR Label Printers',
          desc: 'Added bulk barcode layout selector print sheets, featuring responsive grid sizing and custom asset code layout presets.',
          badge: 'QR Printer'
        },
        {
          title: 'Signature Kiosk Terminals',
          desc: 'Introduced the standalone Kiosk Mode featuring digital signature canvas captures for verified gear handovers.',
          badge: 'Secure Checkout'
        }
      ]
    }
  ];

  const filteredReleases = activeTab === 'all' 
    ? releases 
    : releases.filter(r => r.version === `v${activeTab}`);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-neutral-950/40 backdrop-blur-md"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative bg-white border border-neutral-100 shadow-2xl rounded-[2.5rem] w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden z-10 font-sans"
          >
            {/* Header */}
            <div className="p-6 sm:p-8 border-b border-neutral-100 flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-primary/10 text-primary rounded-xl shrink-0">
                    <Sparkles size={16} className="animate-pulse" />
                  </span>
                  <span className="text-[10px] uppercase font-black tracking-widest text-neutral-400">Changelog Hub</span>
                </div>
                <h3 className="text-2xl font-black text-neutral-950 uppercase tracking-tight">
                  What's New in Packer Tools
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-neutral-50 rounded-2xl text-neutral-400 hover:text-neutral-700 transition"
                title="Close Modal"
              >
                <X size={20} className="stroke-[2.5]" />
              </button>
            </div>

            {/* Quick Filter Tabs */}
            <div className="px-6 sm:px-8 py-3 bg-neutral-50 border-b border-neutral-100 flex gap-2 overflow-x-auto scrollbar-none">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border transition ${
                  activeTab === 'all'
                    ? 'bg-neutral-950 border-neutral-950 text-white shadow-sm'
                    : 'bg-white border-neutral-200/60 text-neutral-500 hover:bg-neutral-100'
                }`}
              >
                All Releases
              </button>
              {releases.map((r) => (
                <button
                  key={r.version}
                  onClick={() => setActiveTab(r.version.replace('v', '') as any)}
                  className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border transition whitespace-nowrap ${
                    activeTab === r.version.replace('v', '')
                      ? 'bg-neutral-950 border-neutral-950 text-white shadow-sm'
                      : 'bg-white border-neutral-200/60 text-neutral-500 hover:bg-neutral-100'
                  }`}
                >
                  {r.version} {r.version === 'v5.3.0' && '⭐'}
                </button>
              ))}
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 min-h-0">
              {filteredReleases.map((release, rIdx) => {
                const IconComponent = release.icon;
                return (
                  <div key={release.version} className="space-y-4">
                    {/* Version Banner Title */}
                    <div className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-2">
                      <div className="flex items-center gap-2.5">
                        <span className={`p-2 rounded-2xl bg-neutral-50 ${release.color}`}>
                          <IconComponent size={18} className="stroke-[2.5]" />
                        </span>
                        <div>
                          <span className="font-extrabold text-neutral-950 text-lg tracking-tight">
                            {release.version}: {release.title}
                          </span>
                          <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                            Released {release.date}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-xl border ${release.tagBg}`}>
                        {release.tag}
                      </span>
                    </div>

                    {/* Feature Cards Grid */}
                    <div className="grid grid-cols-1 gap-3.5 pl-1">
                      {release.updates.map((update, uIdx) => (
                        <div 
                          key={uIdx} 
                          className="p-5 bg-neutral-50 border border-neutral-100 rounded-3xl space-y-2 group hover:bg-white hover:border-neutral-200/80 transition-all duration-200"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <h4 className="font-extrabold text-neutral-900 text-sm flex items-center gap-2">
                              <span className="text-primary">•</span>
                              {update.title}
                            </h4>
                            <span className="text-[9px] font-black uppercase tracking-widest bg-white border border-neutral-200/50 px-2 py-0.5 rounded-md text-neutral-400 group-hover:text-neutral-500 transition-colors">
                              {update.badge}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-500 font-medium leading-relaxed">
                            {update.desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer Information */}
            <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between gap-4 text-xs font-semibold text-neutral-400">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase font-black">
                <Terminal size={14} className="text-neutral-400" />
                <span>PACKER ENGINE CORE STABLE</span>
              </div>
              <span className="text-[10px] uppercase font-black tracking-wide">
                Build v5.8.0
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
