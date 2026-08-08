import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, AlertTriangle, X, Loader2 } from 'lucide-react';

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
  itemName?: string;
  itemCount?: number;
  confirmText?: string;
  cancelText?: string;
  isDeleting?: boolean;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description = "This action will permanently delete the item from your list. This action cannot be undone.",
  itemName,
  itemCount,
  confirmText = "Delete Item",
  cancelText = "Cancel",
  isDeleting = false,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleConfirmClick = async () => {
    try {
      setIsSubmitting(true);
      await onConfirm();
    } catch (err) {
      console.error("Deletion confirmation error:", err);
    } finally {
      setIsSubmitting(false);
      onClose();
    }
  };

  const loading = isDeleting || isSubmitting;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-neutral-950/60 backdrop-blur-md">
          {/* Backdrop Click */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={loading ? undefined : onClose}
            className="absolute inset-0"
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden z-10"
          >
            {/* Top Close Button */}
            <button
              onClick={onClose}
              disabled={loading}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-neutral-100 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200 transition flex items-center justify-center cursor-pointer disabled:opacity-50"
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>

            <div className="p-6 sm:p-8 space-y-5 text-center">
              {/* Warning Icon Badge */}
              <div className="mx-auto w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shadow-sm relative">
                <Trash2 size={28} className="stroke-[2.2]" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-sm">
                  <AlertTriangle size={12} strokeWidth={3} />
                </div>
              </div>

              {/* Text Header */}
              <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-black tracking-tight text-neutral-900">
                  {title}
                </h3>
                <p className="text-xs sm:text-sm text-neutral-500 font-medium leading-relaxed max-w-sm mx-auto">
                  {description}
                </p>
              </div>

              {/* Item Name / Count Highlight Box */}
              {(itemName || (itemCount !== undefined && itemCount > 0)) && (
                <div className="p-3.5 bg-neutral-50 border border-neutral-200/80 rounded-2xl flex items-center justify-center gap-2.5 text-left">
                  <div className="w-8 h-8 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0 font-bold text-xs">
                    <Trash2 size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">
                      Target Selection
                    </div>
                    <div className="text-xs font-black text-neutral-900 truncate">
                      {itemName || `${itemCount} selected ${itemCount === 1 ? 'item' : 'items'}`}
                    </div>
                  </div>
                  {itemCount !== undefined && itemCount > 1 && (
                    <span className="px-2.5 py-1 bg-red-500 text-white text-[10px] font-black rounded-lg uppercase tracking-wider">
                      {itemCount} Items
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Footer Action Buttons */}
            <div className="p-4 sm:p-6 bg-neutral-50/80 border-t border-neutral-100 flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 py-3.5 px-4 bg-white border border-neutral-200 text-neutral-700 rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-neutral-100 transition shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {cancelText}
              </button>

              <button
                type="button"
                onClick={handleConfirmClick}
                disabled={loading}
                className="flex-1 py-3.5 px-4 bg-red-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-red-700 transition shadow-lg shadow-red-600/25 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>{confirmText}</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmDeleteModal;
