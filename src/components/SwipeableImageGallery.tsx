import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SwipeableImageGalleryProps {
  photoUrls: string[];
  itemName: string;
}

export const SwipeableImageGallery: React.FC<SwipeableImageGalleryProps> = ({ photoUrls, itemName }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragStartX, setDragStartX] = useState<number | null>(null);

  if (!photoUrls || photoUrls.length === 0) return null;

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % photoUrls.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + photoUrls.length) % photoUrls.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setDragStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (dragStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = dragStartX - touchEndX;

    if (diff > 50) {
      handleNext();
    } else if (diff < -50) {
      handlePrev();
    }
    setDragStartX(null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragStartX(e.clientX);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (dragStartX === null) return;
    const diff = dragStartX - e.clientX;

    if (diff > 50) {
      handleNext();
    } else if (diff < -50) {
      handlePrev();
    }
    setDragStartX(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 block">Photo Gallery</span>
        <span className="text-[9px] font-bold text-neutral-500 bg-neutral-100 px-2.5 py-0.5 rounded-full font-mono">
          {currentIndex + 1} / {photoUrls.length}
        </span>
      </div>
      <div 
        className="relative aspect-video w-full max-h-80 md:max-h-96 rounded-2xl overflow-hidden border border-neutral-200 bg-neutral-100 group select-none cursor-grab active:cursor-grabbing"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setDragStartX(null)}
      >
        {/* Images with transition */}
        <div className="w-full h-full relative overflow-hidden">
          <AnimatePresence initial={false} mode="wait">
            <motion.img
              key={currentIndex}
              src={photoUrls[currentIndex]}
              alt={`${itemName} ${currentIndex + 1}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="w-full h-full object-cover pointer-events-none"
              referrerPolicy="no-referrer"
            />
          </AnimatePresence>
        </div>

        {/* Navigation Arrows */}
        {photoUrls.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 bg-white/80 hover:bg-white text-neutral-800 rounded-full flex items-center justify-center shadow-md transition opacity-0 group-hover:opacity-100 focus:opacity-100 z-10 cursor-pointer"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 bg-white/80 hover:bg-white text-neutral-800 rounded-full flex items-center justify-center shadow-md transition opacity-0 group-hover:opacity-100 focus:opacity-100 z-10 cursor-pointer"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}

        {/* Dot Indicators */}
        {photoUrls.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 bg-black/25 backdrop-blur-md px-3 py-1.5 rounded-full">
            {photoUrls.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${
                  currentIndex === idx ? 'bg-white w-3' : 'bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
