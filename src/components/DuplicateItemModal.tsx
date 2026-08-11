import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, Plus, Minus, Check, X, Layers, Tag, ShieldCheck, AlertCircle, Sparkles, Box } from 'lucide-react';
import { generateDuplicateName, generateDuplicateAssetTag } from '../utils/duplicateUtils';
import { hapticLight, hapticSuccess } from '../utils/haptics';

export interface DuplicateModalResult {
  copyCount: number;
  resetStatus: boolean;
  clearSerial: boolean;
  clearAssignment: boolean;
  duplicateAddOns: boolean;
  namingFormat: 'bracket' | 'copy';
}

interface DuplicateItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    id: string;
    name: string;
    brand?: string;
    assetTag?: string;
    photoUrls?: string[];
    category?: string;
    serialNumber?: string;
    addOns?: any[];
  } | null;
  batchCount?: number; // If duplicating selected batch items
  existingNames?: string[];
  existingTags?: string[];
  onConfirm: (config: DuplicateModalResult) => Promise<void>;
}

export default function DuplicateItemModal({
  isOpen,
  onClose,
  item,
  batchCount = 1,
  existingNames = [],
  existingTags = [],
  onConfirm
}: DuplicateItemModalProps) {
  const [copyCount, setCopyCount] = useState<number>(1);
  const [resetStatus, setResetStatus] = useState<boolean>(true);
  const [clearSerial, setClearSerial] = useState<boolean>(true);
  const [clearAssignment, setClearAssignment] = useState<boolean>(true);
  const [duplicateAddOns, setDuplicateAddOns] = useState<boolean>(true);
  const [namingFormat, setNamingFormat] = useState<'bracket' | 'copy'>('bracket');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Live preview of generated names & tags
  const livePreviewItems = useMemo(() => {
    if (!item) return [];
    const previews: { name: string; tag: string }[] = [];
    const usedTags = [...existingTags];
    const usedNames = [...existingNames];

    for (let i = 1; i <= Math.min(copyCount, 5); i++) {
      const idx = i + 1; // #2, #3, etc.
      let name = generateDuplicateName(item.name, idx, usedNames);
      if (namingFormat === 'copy') {
        const base = item.name.replace(/\s*\[#\d+\]|\s*\(Copy\s*\d+\)/gi, '').trim();
        name = `${base} (Copy ${i})`;
      }
      const tag = generateDuplicateAssetTag(item.assetTag, usedTags);
      
      usedNames.push(name);
      usedTags.push(tag);

      previews.push({ name, tag });
    }
    return previews;
  }, [item, copyCount, namingFormat, existingNames, existingTags]);

  if (!isOpen || (!item && batchCount <= 1)) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    hapticLight();
    setIsSubmitting(true);
    try {
      await onConfirm({
        copyCount,
        resetStatus,
        clearSerial,
        clearAssignment,
        duplicateAddOns,
        namingFormat
      });
      hapticSuccess();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-[#141418] border border-neutral-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden text-neutral-200"
        >
          {/* Header */}
          <div className="p-5 bg-[#18181d] border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#0066cc] text-white rounded-2xl shadow-lg shadow-[#0066cc]/20 shrink-0">
                <Copy size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-tight">
                  {batchCount > 1 ? `Duplicate ${batchCount} Selected Items` : 'Duplicate Equipment Asset'}
                </h3>
                <p className="text-xs text-neutral-400">
                  Clone asset specifications, auto-generate tags, and configure copy quantities.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-5">
            {/* Target Item Summary */}
            {item && batchCount <= 1 && (
              <div className="p-3.5 rounded-2xl bg-[#1a1a20] border border-neutral-800/80 flex items-center gap-3">
                {item.photoUrls && item.photoUrls[0] ? (
                  <img
                    src={item.photoUrls[0]}
                    alt={item.name}
                    className="w-12 h-12 rounded-xl object-cover border border-neutral-700/80 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-400 shrink-0">
                    <Box size={22} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] font-black uppercase text-[#0066cc] tracking-widest block">Original Source Asset</span>
                  <h4 className="font-extrabold text-sm text-white truncate">{item.name}</h4>
                  <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                    {item.brand || 'General'} • {item.assetTag || 'TAG-PENDING'} {item.category ? `• ${item.category}` : ''}
                  </p>
                </div>
              </div>
            )}

            {/* Quantity Counter */}
            <div className="space-y-2">
              <label className="text-xs font-extrabold uppercase text-neutral-300 tracking-wider block">
                Number of Copies to Create
              </label>
              <div className="flex items-center gap-3 bg-[#1a1a20] border border-neutral-800 p-2 rounded-2xl">
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setCopyCount(Math.max(1, copyCount - 1));
                  }}
                  className="p-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl transition disabled:opacity-30"
                  disabled={copyCount <= 1}
                >
                  <Minus size={16} />
                </button>

                <div className="flex-1 text-center">
                  <span className="text-2xl font-black text-white">{copyCount}</span>
                  <span className="text-xs text-neutral-400 ml-2 font-extrabold">
                    {copyCount === 1 ? 'Duplicate Unit' : 'Duplicate Units'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setCopyCount(Math.min(20, copyCount + 1));
                  }}
                  className="p-2 bg-[#0066cc] hover:bg-[#0052a3] text-white rounded-xl transition disabled:opacity-30"
                  disabled={copyCount >= 20}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* Naming Style Option */}
            <div className="space-y-2">
              <label className="text-xs font-extrabold uppercase text-neutral-300 tracking-wider block">
                Naming Suffix Pattern
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setNamingFormat('bracket');
                  }}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    namingFormat === 'bracket'
                      ? 'bg-[#0066cc]/15 border-[#0066cc] text-white'
                      : 'bg-[#1a1a20] border-neutral-800 text-neutral-400 hover:bg-neutral-800'
                  }`}
                >
                  <span className="text-xs font-bold block">Numbered Brackets</span>
                  <span className="text-[10px] font-mono text-neutral-400 block mt-0.5">e.g. Asset [#2], [#3]</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    hapticLight();
                    setNamingFormat('copy');
                  }}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    namingFormat === 'copy'
                      ? 'bg-[#0066cc]/15 border-[#0066cc] text-white'
                      : 'bg-[#1a1a20] border-neutral-800 text-neutral-400 hover:bg-neutral-800'
                  }`}
                >
                  <span className="text-xs font-bold block">Copy Suffix</span>
                  <span className="text-[10px] font-mono text-neutral-400 block mt-0.5">e.g. Asset (Copy 1)</span>
                </button>
              </div>
            </div>

            {/* Toggle Switch Options */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-extrabold uppercase text-neutral-300 tracking-wider block">
                Cloning Rules & Settings
              </label>
              
              <div className="bg-[#1a1a20] border border-neutral-800 rounded-2xl divide-y divide-neutral-800/80">
                <label className="p-3 flex items-center justify-between cursor-pointer hover:bg-neutral-800/40 transition">
                  <div>
                    <span className="text-xs font-bold text-white block">Reset Status to "Available"</span>
                    <span className="text-[10px] text-neutral-400 block">Ensures duplicated gear starts unassigned and ready in warehouse.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={resetStatus}
                    onChange={(e) => setResetStatus(e.target.checked)}
                    className="w-4 h-4 accent-[#0066cc] rounded cursor-pointer"
                  />
                </label>

                <label className="p-3 flex items-center justify-between cursor-pointer hover:bg-neutral-800/40 transition">
                  <div>
                    <span className="text-xs font-bold text-white block">Clear Serial Numbers</span>
                    <span className="text-[10px] text-neutral-400 block">Prevents duplicate physical serial number collisions.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={clearSerial}
                    onChange={(e) => setClearSerial(e.target.checked)}
                    className="w-4 h-4 accent-[#0066cc] rounded cursor-pointer"
                  />
                </label>

                <label className="p-3 flex items-center justify-between cursor-pointer hover:bg-neutral-800/40 transition">
                  <div>
                    <span className="text-xs font-bold text-white block">Clear Active Checkout Holder</span>
                    <span className="text-[10px] text-neutral-400 block">Resets checked-out user and team assignment.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={clearAssignment}
                    onChange={(e) => setClearAssignment(e.target.checked)}
                    className="w-4 h-4 accent-[#0066cc] rounded cursor-pointer"
                  />
                </label>

                {item?.addOns && item.addOns.length > 0 && (
                  <label className="p-3 flex items-center justify-between cursor-pointer hover:bg-neutral-800/40 transition">
                    <div>
                      <span className="text-xs font-bold text-white block">Duplicate Kit Add-Ons ({item.addOns.length})</span>
                      <span className="text-[10px] text-neutral-400 block">Clones bundled accessories, caps, cables & ancillary gear.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={duplicateAddOns}
                      onChange={(e) => setDuplicateAddOns(e.target.checked)}
                      className="w-4 h-4 accent-[#0066cc] rounded cursor-pointer"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Generated Items Live Preview */}
            {livePreviewItems.length > 0 && batchCount <= 1 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-extrabold uppercase text-neutral-400 tracking-wider block">
                  Generated Items Preview ({copyCount})
                </span>
                <div className="bg-[#111115] border border-neutral-800 rounded-2xl p-2.5 space-y-1.5 max-h-32 overflow-y-auto">
                  {livePreviewItems.map((pv, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs px-2.5 py-1.5 bg-[#18181d] rounded-xl border border-neutral-800/60">
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <Tag size={12} className="text-[#0066cc] shrink-0" />
                        <span className="font-bold text-white truncate">{pv.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-neutral-400 bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded-lg shrink-0">
                        {pv.tag}
                      </span>
                    </div>
                  ))}
                  {copyCount > 5 && (
                    <p className="text-[10px] text-neutral-500 text-center font-bold pt-1">
                      + {copyCount - 5} more auto-generated item records...
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold rounded-xl transition"
                disabled={isSubmitting}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-[#0066cc] hover:bg-[#0052a3] text-white text-xs font-black uppercase tracking-wider rounded-xl transition flex items-center gap-2 shadow-lg shadow-[#0066cc]/20 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Cloning Assets...</span>
                ) : (
                  <>
                    <Copy size={15} />
                    <span>Confirm Duplicate ({copyCount * batchCount})</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
