import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  Database, 
  Trash2, 
  AlertCircle, 
  X,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { offlineSync, OfflineOperation } from '../services/offlineSync';

interface OfflineSyncWidgetProps {
  isCollapsed?: boolean;
}

export default function OfflineSyncWidget({ isCollapsed = false }: OfflineSyncWidgetProps) {
  const [queue, setQueue] = useState<OfflineOperation[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = offlineSync.subscribe((currentQueue, online, syncing) => {
      setQueue(currentQueue);
      setIsOnline(online);
      setIsSyncing(syncing);
    });
    return () => unsubscribe();
  }, []);

  const handleSyncNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOnline) return;
    offlineSync.syncAll();
  };

  const handleRemoveItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    offlineSync.removeOperation(id);
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to discard all pending offline updates? These changes will be lost.')) {
      offlineSync.clearQueue();
    }
  };

  const pendingCount = queue.length;

  return (
    <>
      {/* Sidebar Widget Trigger */}
      <div 
        id="offline-sync-widget"
        onClick={() => setIsOpen(true)}
        className={`group relative flex items-center justify-between p-3 rounded-xl cursor-pointer select-none transition-all border ${
          isOnline 
            ? 'bg-neutral-50/70 border-neutral-100/60 hover:bg-neutral-50' 
            : 'bg-amber-50/60 border-amber-100 hover:bg-amber-50'
        } ${isCollapsed ? 'justify-center p-2.5' : ''}`}
      >
        <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="relative">
            {isOnline ? (
              <Cloud className={`text-emerald-500 shrink-0 ${isSyncing ? 'animate-pulse' : ''}`} size={20} />
            ) : (
              <CloudOff className="text-amber-500 shrink-0 animate-pulse" size={20} />
            )}
            {pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black font-mono text-white ring-2 ring-white">
                {pendingCount}
              </span>
            )}
          </div>
          
          {!isCollapsed && (
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold text-neutral-800">
                {isOnline ? 'Cloud Sync Online' : 'Offline Mode'}
              </span>
              <span className="text-[10px] font-medium text-neutral-500">
                {isSyncing 
                  ? 'Syncing changes...' 
                  : pendingCount > 0 
                    ? `${pendingCount} pending updates` 
                    : 'System up to date'}
              </span>
            </div>
          )}
        </div>

        {!isCollapsed && pendingCount > 0 && isOnline && (
          <button
            onClick={handleSyncNow}
            disabled={isSyncing}
            className={`p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all ${isSyncing ? 'animate-spin' : ''}`}
            title="Sync offline queue now"
          >
            <RefreshCw size={12} />
          </button>
        )}
      </div>

      {/* Operational Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                    {isOnline ? <Cloud size={20} /> : <CloudOff size={20} />}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-neutral-800">Offline Synchronization Manager</h3>
                    <p className="text-xs text-neutral-500 font-medium leading-none mt-1">
                      Connection: <span className={isOnline ? 'text-emerald-500 font-bold' : 'text-amber-500 font-bold'}>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-neutral-100 rounded-xl text-neutral-400 hover:text-neutral-600 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Operations logs list */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {pendingCount === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="p-4 bg-emerald-50 text-emerald-500 rounded-full mb-4">
                      <CheckCircle2 size={36} />
                    </div>
                    <h4 className="font-bold text-neutral-800">No Operations Pending</h4>
                    <p className="text-sm text-neutral-500 max-w-xs mt-1">
                      Everything is fully synchronized with the cloud sandbox database instance.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                      <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                        Pending Queue ({pendingCount} Item{pendingCount > 1 ? 's' : ''})
                      </div>
                      <button
                        onClick={handleClearAll}
                        className="text-xs font-bold text-red-500 hover:text-red-700 flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-red-50 transition-all"
                      >
                        <Trash2 size={12} /> Discard All Changes
                      </button>
                    </div>

                    <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                      {queue.map((op) => (
                        <div 
                          key={op.id}
                          className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left ${
                            op.status === 'failed' 
                              ? 'bg-red-50/50 border-red-100' 
                              : op.status === 'syncing'
                                ? 'bg-indigo-50/50 border-indigo-100'
                                : 'bg-neutral-50/50 border-neutral-100'
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className="mt-0.5">
                              {op.type === 'set' && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[8px] font-black tracking-wider uppercase font-mono">
                                  Add
                                </span>
                              )}
                              {op.type === 'update' && (
                                <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[8px] font-black tracking-wider uppercase font-mono">
                                  Edit
                                </span>
                              )}
                              {op.type === 'delete' && (
                                <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[8px] font-black tracking-wider uppercase font-mono">
                                  Del
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h5 className="font-bold text-sm text-neutral-800 truncate leading-snug">
                                {op.label}
                              </h5>
                              <p className="font-mono text-[9px] text-neutral-400 mt-0.5 truncate uppercase tracking-tight">
                                File Path: {op.collectionPath.join('/')}
                              </p>
                              {op.error && (
                                <p className="text-[10px] text-red-500 font-bold mt-1 flex items-center gap-1">
                                  <AlertCircle size={10} /> Error: {op.error}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            {op.status === 'syncing' ? (
                              <RefreshCw size={14} className="text-indigo-500 animate-spin" />
                            ) : (
                              <button
                                onClick={(e) => handleRemoveItem(op.id, e)}
                                className="p-1.5 bg-neutral-150 hover:bg-red-100 hover:text-red-600 rounded-xl text-neutral-400 transition-all"
                                title="Discard update change"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Educational/Assurance Banner */}
                <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-100 flex items-start gap-3">
                  <Database size={16} className="text-neutral-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-neutral-600 leading-relaxed font-medium">
                    <strong className="text-neutral-800">Durable Offline Storage Pattern</strong>: 
                    If you close this tab or lose connection completely, changes are safely cached in IndexedDB inside your browser's persistent service worker wrapper client-thread.
                  </p>
                </div>
              </div>

              {/* Action Footer */}
              <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end gap-3">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-neutral-600 hover:bg-neutral-100 rounded-2xl transition-all"
                >
                  Close
                </button>
                
                {pendingCount > 0 && (
                  <button
                    onClick={handleSyncNow}
                    disabled={!isOnline || isSyncing}
                    className="px-5 py-2 text-sm font-bold bg-neutral-900 text-white rounded-2xl hover:bg-black transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" /> Completing Sync...
                      </>
                    ) : (
                      <>
                        <RefreshCw size={14} /> Synchronize Queue Now
                      </>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
