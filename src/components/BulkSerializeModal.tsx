import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Layers, Sliders, Play, Settings, AlertTriangle, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { InventoryItem } from '../pages/InventoryModule';

interface BulkSerializeModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: InventoryItem[];
  db: any;
  selectedInventoryId: string;
  isOnline: boolean;
  offlineSync: any;
  onComplete: () => void;
}

interface ItemConfig {
  itemId: string;
  prefix: string;
  startNum: string;
}

export default function BulkSerializeModal({
  isOpen,
  onClose,
  selectedItems,
  db,
  selectedInventoryId,
  isOnline,
  offlineSync,
  onComplete
}: BulkSerializeModalProps) {
  // We only show items that are currently under 'batch' mode (trackingMode !== 'individual')
  const batchItems = selectedItems.filter(item => item.trackingMode !== 'individual');

  const [globalPrefix, setGlobalPrefix] = useState('UID-');
  const [globalStartNum, setGlobalStartNum] = useState('1001');
  const [configs, setConfigs] = useState<Record<string, ItemConfig>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  // Initialize configurations when items change
  useEffect(() => {
    const newConfigs: Record<string, ItemConfig> = {};
    batchItems.forEach(item => {
      // Suggest prefix based on brand/name
      let suggestedPrefix = 'UID-';
      if (item.brand) {
        suggestedPrefix = `UID-${item.brand.replace(/\s+/g, '').toUpperCase().substring(0, 4)}-`;
      } else if (item.name) {
        suggestedPrefix = `UID-${item.name.replace(/\s+/g, '').toUpperCase().substring(0, 4)}-`;
      }
      newConfigs[item.id] = {
        itemId: item.id,
        prefix: suggestedPrefix,
        startNum: '1001'
      };
    });
    setConfigs(newConfigs);
  }, [selectedItems]);

  const handleApplyGlobal = () => {
    const updated = { ...configs };
    batchItems.forEach(item => {
      if (updated[item.id]) {
        updated[item.id].prefix = globalPrefix;
        updated[item.id].startNum = globalStartNum;
      }
    });
    setConfigs(updated);
    toast.info("Applied global settings to all selected items.");
  };

  const handleUpdateItemConfig = (itemId: string, field: 'prefix' | 'startNum', value: string) => {
    setConfigs(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  const handleBulkConvert = async () => {
    if (batchItems.length === 0) {
      toast.error("No eligible batch-mode items selected for conversion.");
      return;
    }

    setIsProcessing(true);
    let totalItemsSpawned = 0;

    try {
      const parentColRef = collection(db, 'inventories', selectedInventoryId, 'items');

      if (!isOnline) {
        // Queue operation helper for offline
        for (const item of batchItems) {
          const cfg = configs[item.id] || { prefix: 'UID-', startNum: '1001', itemId: item.id };
          const qtyToGen = item.quantity || 1;
          const startNo = parseInt(cfg.startNum) || 1;

          // Delete original offline queue or flag delete
          await offlineSync.queueOperation({
            type: 'delete',
            collectionPath: ['inventories', selectedInventoryId, 'items', item.id],
            docId: item.id,
            label: `Remove original batch asset: ${item.name}`
          });

          // Generate multiple individual copies offline
          for (let i = 1; i <= qtyToGen; i++) {
            const spawnedId = doc(parentColRef).id;
            const computedSerial = `${cfg.prefix}${startNo + (i - 1)}`;
            const spawnedName = qtyToGen > 1 ? `${item.name} [#${i}]` : item.name;

            const payload: any = {
              ...item,
              id: spawnedId,
              name: spawnedName,
              serialNumber: computedSerial,
              trackingMode: 'individual',
              quantity: 1,
              assetTag: `ASSET-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };

            await offlineSync.queueOperation({
              type: 'set',
              collectionPath: ['inventories', selectedInventoryId, 'items', spawnedId],
              docId: spawnedId,
              data: payload,
              label: `Spawn individual asset: ${spawnedName}`
            });
            totalItemsSpawned++;
          }
        }
        toast.success(`Successfully queued offline transition of ${batchItems.length} assets into ${totalItemsSpawned} individual UID entries!`);
      } else {
        // Online batch commits with 500 operations chuncking rule (from user_rules / AGENTS.md)
        // Each individual asset creation takes 1 'set' operation.
        // Each original asset delete takes 1 'delete' operation.
        let batch = writeBatch(db);
        let batchOpCount = 0;

        for (const item of batchItems) {
          const cfg = configs[item.id] || { prefix: 'UID-', startNum: '1001', itemId: item.id };
          const qtyToGen = item.quantity || 1;
          const startNo = parseInt(cfg.startNum) || 1;

          // Check operation limit (500 maximum)
          if (batchOpCount >= 490) {
            await batch.commit();
            batch = writeBatch(db);
            batchOpCount = 0;
          }

          // Delete the original batch asset item
          const origDocRef = doc(db, 'inventories', selectedInventoryId, 'items', item.id);
          batch.delete(origDocRef);
          batchOpCount++;

          // Generate separate individual entries
          for (let i = 1; i <= qtyToGen; i++) {
            if (batchOpCount >= 490) {
              await batch.commit();
              batch = writeBatch(db);
              batchOpCount = 0;
            }

            const newDocRef = doc(parentColRef);
            const computedSerial = `${cfg.prefix}${startNo + (i - 1)}`;
            const spawnedName = qtyToGen > 1 ? `${item.name} [#${i}]` : item.name;

            const payload = {
              ...item,
              id: newDocRef.id,
              name: spawnedName,
              serialNumber: computedSerial,
              trackingMode: 'individual' as const,
              quantity: 1,
              assetTag: `ASSET-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };

            batch.set(newDocRef, payload);
            batchOpCount++;
            totalItemsSpawned++;
          }
        }

        // Final commit if any operations remain
        if (batchOpCount > 0) {
          await batch.commit();
        }

        toast.success(`Successfully decomposed ${batchItems.length} batch items into ${totalItemsSpawned} individual assets!`);
      }

      onComplete();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("An error occurred during bulk UID serialization. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden border border-neutral-100 my-8"
      >
        {/* Header */}
        <div className="p-6 md:p-8 flex items-center justify-between border-b border-[#f4f4f5]">
          <div className="flex items-center gap-3">
            <span className="p-3 bg-[#0066cc] text-white rounded-2xl">
              <Layers size={22} className="animate-pulse" />
            </span>
            <div>
              <h3 className="text-lg font-black text-neutral-900 uppercase tracking-tight">Bulk Serialize Assets</h3>
              <p className="text-xs text-neutral-500 font-medium">Decompose bulk records into individual serial-tracked items with dynamic UIDs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 bg-neutral-50 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition duration-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 md:p-8 max-h-[60vh] overflow-y-auto space-y-6">
          {batchItems.length === 0 ? (
            <div className="p-8 text-center bg-amber-50/50 border border-dashed border-amber-200/60 rounded-3xl space-y-3">
              <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
              <p className="font-bold text-neutral-800 text-sm">No standard "Batch Mode" items selected.</p>
              <p className="text-xs text-neutral-500 max-w-md mx-auto leading-relaxed">
                All selected inventory rows are already in Individual tracking or have custom unique tags assigned. Select row items displaying the "📦 Batch" tag to convert them.
              </p>
            </div>
          ) : (
            <>
              {/* Introduction Notification Banner */}
              <div className="p-5 bg-[#0066cc]/5 border border-[#0066cc]/10 rounded-2xl flex gap-4">
                <Sliders className="w-5 h-5 text-[#0066cc] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-xs font-black uppercase text-[#0066cc] tracking-wider">How decomposing works</span>
                  <p className="text-xs text-neutral-600 leading-relaxed">
                    You have selected <strong>{batchItems.length}</strong> bulk resources. Based on their registered quantity owned, this conversion process will deploy/spawn a total of{' '}
                    <strong>{batchItems.reduce((acc, it) => acc + (it.quantity || 1), 0)}</strong> discrete entries, each assigned with quantity: 1, an auto-sequenced serial, and a separate tracking status!
                  </p>
                </div>
              </div>

              {/* Step 1: Global Setup Parameters */}
              <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-100 space-y-4">
                <div className="flex items-center gap-1.5 border-b border-neutral-200 pb-2">
                  <Settings size={14} className="text-neutral-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Apply Global UID Defaults</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black tracking-wider text-neutral-400 block">Global Prefix</label>
                    <input
                      type="text"
                      value={globalPrefix}
                      onChange={(e) => setGlobalPrefix(e.target.value)}
                      placeholder="e.g. UID-CAM-"
                      className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-[#0066cc] transition"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-black tracking-wider text-neutral-400 block">Global Start Number</label>
                    <input
                      type="text"
                      value={globalStartNum}
                      onChange={(e) => setGlobalStartNum(e.target.value)}
                      placeholder="e.g. 1001"
                      className="w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-[#0066cc] transition"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyGlobal}
                    className="w-full bg-neutral-900 border border-neutral-900 text-white text-xs font-black uppercase tracking-widest py-3 rounded-xl hover:bg-neutral-800 transition"
                  >
                    Set All Rows
                  </button>
                </div>
              </div>

              {/* Step 2: Individual Config Table */}
              <div className="space-y-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">Selected Items Configuration</span>
                <div className="border border-neutral-100 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-neutral-50 border-b border-neutral-100 text-[10px] font-black uppercase tracking-wider text-neutral-400">
                        <th className="px-4 py-3.5">Asset Detail</th>
                        <th className="px-4 py-3.5">Decomposed Copies</th>
                        <th className="px-4 py-3.5">Individual Serial Prefix</th>
                        <th className="px-4 py-3.5">Starting Number</th>
                        <th className="px-4 py-3.5 text-right">Serial Preview</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {batchItems.map(item => {
                        const cfg = configs[item.id] || { prefix: 'UID-', startNum: '1001', itemId: item.id };
                        const qty = item.quantity || 1;
                        const start = parseInt(cfg.startNum) || 1;
                        const previewEnd = start + (qty - 1);

                        return (
                          <tr key={item.id} className="hover:bg-neutral-50/40 transition-colors">
                            <td className="px-4 py-4">
                              <span className="font-bold text-neutral-800 block text-xs">{item.name}</span>
                              <span className="text-[10px] text-neutral-400 font-mono italic">{item.primaryCategory || 'No Category'}</span>
                            </td>
                            <td className="px-4 py-4">
                              <span className="px-2.5 py-1 bg-[#0066cc]/10 text-[#0066cc] font-black text-[10px] rounded-lg">
                                {qty} Individual copies
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <input
                                type="text"
                                value={cfg.prefix}
                                onChange={(e) => handleUpdateItemConfig(item.id, 'prefix', e.target.value)}
                                className="bg-white border border-neutral-200 rounded-xl px-3 py-1.5 text-xs w-32 outline-none focus:border-[#0066cc]"
                              />
                            </td>
                            <td className="px-4 py-4">
                              <input
                                type="text"
                                value={cfg.startNum}
                                onChange={(e) => handleUpdateItemConfig(item.id, 'startNum', e.target.value)}
                                className="bg-white border border-neutral-200 rounded-xl px-3 py-1.5 text-xs w-24 outline-none focus:border-[#0066cc]"
                              />
                            </td>
                            <td className="px-4 py-4 text-right">
                              <div className="text-[10px] text-neutral-600 font-mono bg-neutral-100 rounded px-2 py-1 inline-block text-left">
                                {qty > 1 ? (
                                  <>
                                    <div>{cfg.prefix}{start}</div>
                                    <div className="text-neutral-400 text-[8px] text-center border-t border-neutral-200 mt-0.5 pt-0.5">to</div>
                                    <div>{cfg.prefix}{previewEnd}</div>
                                  </>
                                ) : (
                                  <div>{cfg.prefix}{start}</div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 md:p-8 bg-neutral-50 border-t border-[#f4f4f5] flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-medium">
            <HelpCircle size={14} />
            <span>This process cannot be automatically undone.</span>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-6 py-3 border border-neutral-200 bg-white hover:bg-neutral-50 rounded-xl text-xs font-bold text-neutral-700 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isProcessing || batchItems.length === 0}
              onClick={handleBulkConvert}
              className="flex items-center justify-center gap-2 px-8 py-3 bg-[#0066cc] hover:bg-[#0055b3] text-white text-xs font-black uppercase tracking-widest rounded-xl transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin border-2 border-white border-t-transparent w-4 h-4 rounded-full" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Play size={14} className="fill-current" />
                  <span>Execute Conversion</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
