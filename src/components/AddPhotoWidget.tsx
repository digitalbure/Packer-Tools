import React, { useState, useEffect } from 'react';
import { Camera, Upload, ClipboardCheck, X, Search, Loader2, Link, Check, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { compressImage } from '../lib/imageUtils';
import { UserProfile, AdminSettings } from '../types';
import { db } from '../firebase';
import { collection, getDocs, query, limit } from 'firebase/firestore';

interface AddPhotoWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoAdded: (urls: string[]) => void;
  user: UserProfile;
  adminSettings: AdminSettings | null;
  targetName?: string;
  systemPhotos?: { url: string; itemName: string; itemBrand?: string; isChild?: boolean }[];
}

export default function AddPhotoWidget({
  isOpen,
  onClose,
  onPhotoAdded,
  user,
  adminSettings,
  targetName = 'item',
  systemPhotos = []
}: AddPhotoWidgetProps) {
  const [searchText, setSearchText] = useState('');
  const [selectedSystemPhotos, setSelectedSystemPhotos] = useState<string[]>([]);
  const [dbPhotos, setDbPhotos] = useState<{ url: string; itemName: string; itemBrand?: string; isChild?: boolean }[]>([]);
  const [loadingDbPhotos, setLoadingDbPhotos] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  // 1. Determine Plan (Pro / Enterprise plan users get the full Pro Version, others get Lite)
  const isProOrEnterprisePlan = user?.plan && (
    user.plan.toLowerCase() === 'pro' || 
    user.plan.toLowerCase() === 'enterprise'
  );

  // 2. Read widget overrides from global Admin Settings
  const photoConfig = adminSettings?.moduleWidgetConfigs?.photoWidget;
  const restrictByPlan = photoConfig?.restrictByPlan ?? true;

  // Active status of Pro mode
  const isProMode = restrictByPlan ? isProOrEnterprisePlan : true;

  // Granular settings depending on active mode (Pro vs Lite)
  const allowUrlPaste = isProMode 
    ? (photoConfig?.allowUrlPastePro ?? true) 
    : (photoConfig?.allowUrlPasteLite ?? false);

  const allowClipboard = isProMode 
    ? (photoConfig?.allowClipboardPro ?? true) 
    : (photoConfig?.allowClipboardLite ?? false);

  const allowSystemSearch = isProMode 
    ? (photoConfig?.allowSystemSearchPro ?? true) 
    : (photoConfig?.allowSystemSearchLite ?? false);

  // Background fetch of system photos if search is permitted
  useEffect(() => {
    if (!isOpen || !user?.uid || !allowSystemSearch) return;

    const fetchPhotos = async () => {
      setLoadingDbPhotos(true);
      try {
        const q = query(collection(db, 'users', user.uid, 'gearLibrary'), limit(120));
        const snap = await getDocs(q);
        const photos: any[] = [];
        snap.docs.forEach(doc => {
          const data = doc.data();
          if (data.photoUrls && Array.isArray(data.photoUrls)) {
            data.photoUrls.forEach((url: string) => {
              if (url && !photos.some(p => p.url === url)) {
                photos.push({
                  url,
                  itemName: data.name || 'Unnamed Gear',
                  itemBrand: data.brand || '',
                  isChild: false
                });
              }
            });
          }
        });
        setDbPhotos(photos);
      } catch (err) {
        console.error("Error fetching database photos for AddPhotoWidget:", err);
      } finally {
        setLoadingDbPhotos(false);
      }
    };

    fetchPhotos();
  }, [isOpen, user?.uid, allowSystemSearch]);

  // Combine parent supplied photos + dynamically fetched photos
  const allPhotos = [...systemPhotos, ...dbPhotos].filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);

  const filteredPhotos = allPhotos.filter(p => {
    const term = searchText.toLowerCase();
    return (
      p.itemName?.toLowerCase().includes(term) ||
      p.itemBrand?.toLowerCase().includes(term)
    );
  });

  // Photo handlers
  const handlePhotoUploadEvent = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        try {
          const compressed = await compressImage(files[i]);
          urls.push(compressed);
        } catch (err) {
          toast.error(`Failed to process ${files[i].name}`);
        }
      }
      if (urls.length > 0) {
        onPhotoAdded(urls);
        toast.success(`Successfully added ${urls.length} photo(s)`);
        onClose();
      }
    }
  };

  const processPasteFile = async (file: File) => {
    try {
      const compressed = await compressImage(file);
      onPhotoAdded([compressed]);
      toast.success("Successfully added pasted photo!");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to process pasted image file.");
    }
  };

  const handleClipboardPaste = async () => {
    if (!allowClipboard) {
      toast.error("Clipboard pasting is disabled on your current plan/settings.");
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      let found = false;
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            const blob = await item.getType(type);
            const file = new File([blob], "pasted-image.png", { type });
            await processPasteFile(file);
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (!found) {
        toast.error("No image found on clipboard. Try copying an image file first.");
      }
    } catch (err) {
      toast.error("Clipboard permission denied or no image found. Try pasting directly using keyboard shortcut.");
    }
  };

  // Global paste handler
  useEffect(() => {
    if (!isOpen || !allowClipboard) return;
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            await processPasteFile(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, [isOpen, allowClipboard]);

  const handleAddWebUrl = () => {
    const val = urlInput.trim();
    if (val) {
      if (!val.startsWith('http://') && !val.startsWith('https://') && !val.startsWith('data:image')) {
        toast.error("Please enter a valid URL starting with http:// or https://");
        return;
      }
      onPhotoAdded([val]);
      toast.success("Successfully added image from web link!");
      setUrlInput('');
      onClose();
    } else {
      toast.error("Please enter a valid image URL first.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[280] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto min-w-0"
        id="standard-photo-picker-container"
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50 min-w-0">
          <div className="min-w-0 flex-1 pr-2">
            <h3 className="text-lg sm:text-xl font-black tracking-tight text-neutral-900 flex flex-wrap items-center gap-2">
              <Camera className="text-primary animate-pulse shrink-0" size={20} />
              <span className="truncate">Add Photo</span>
              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border tracking-widest shrink-0 ${isProMode ? 'bg-primary/10 text-primary border-primary/20' : 'bg-neutral-100 text-neutral-400 border-neutral-200'}`}>
                {isProMode ? 'Pro Version' : 'Lite Version'}
              </span>
            </h3>
            <p className="text-[10px] sm:text-xs font-bold text-neutral-400 uppercase tracking-wider mt-1 truncate">
              Select photo source for {targetName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-xl transition text-neutral-400 hover:text-neutral-900 shrink-0"
            id="photo-picker-close-btn"
          >
            <X size={20} />
          </button>
        </div>

        {/* Hidden inputs */}
        <input
          type="file"
          multiple
          accept="image/*"
          id="photo-picker-upload-input"
          className="hidden"
          onChange={handlePhotoUploadEvent}
        />
        <input
          type="file"
          accept="image/*"
          capture="environment"
          id="photo-picker-camera-input"
          className="hidden"
          onChange={handlePhotoUploadEvent}
        />

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 sm:space-y-6 min-w-0">
          {/* Main Actions Row */}
          <div className={`grid gap-2 sm:gap-4 ${allowClipboard ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <button
              type="button"
              onClick={() => document.getElementById('photo-picker-upload-input')?.click()}
              className="flex flex-col items-center justify-center p-3 sm:p-6 bg-neutral-50 border border-neutral-200 hover:border-primary hover:bg-primary/5 rounded-2xl transition group text-center space-y-1.5 sm:space-y-2 min-w-0"
              id="upload-photo-btn"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white flex items-center justify-center border border-neutral-200 text-neutral-600 group-hover:bg-primary group-hover:text-white transition shadow-sm shrink-0">
                <Upload size={16} className="sm:w-[18px] sm:h-[18px]" />
              </div>
              <span className="text-[9px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest text-neutral-700 leading-tight">Upload Photo/file</span>
            </button>

            <button
              type="button"
              onClick={() => document.getElementById('photo-picker-camera-input')?.click()}
              className="flex flex-col items-center justify-center p-3 sm:p-6 bg-neutral-50 border border-neutral-200 hover:border-primary hover:bg-primary/5 rounded-2xl transition group text-center space-y-1.5 sm:space-y-2 min-w-0"
              id="camera-photo-btn"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white flex items-center justify-center border border-neutral-200 text-neutral-600 group-hover:bg-primary group-hover:text-white transition shadow-sm shrink-0">
                <Camera size={16} className="sm:w-[18px] sm:h-[18px]" />
              </div>
              <span className="text-[9px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest text-neutral-700 leading-tight">Take Photo (Camera)</span>
            </button>

            {allowClipboard && (
              <button
                type="button"
                onClick={handleClipboardPaste}
                className="flex flex-col items-center justify-center p-3 sm:p-6 bg-neutral-50 border border-neutral-200 hover:border-primary hover:bg-primary/5 rounded-2xl transition group text-center space-y-1.5 sm:space-y-2 min-w-0"
                id="clipboard-photo-btn"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white flex items-center justify-center border border-neutral-200 text-neutral-600 group-hover:bg-primary group-hover:text-white transition shadow-sm shrink-0">
                  <ClipboardCheck size={16} className="sm:w-[18px] sm:h-[18px]" />
                </div>
                <span className="text-[9px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest text-neutral-700 leading-tight">Paste Clipboard</span>
              </button>
            )}
          </div>

          {/* Web URL Input (Pro only or permitted by custom setting) */}
          {allowUrlPaste ? (
            <div className="bg-neutral-50 p-4 sm:p-6 rounded-2xl border border-neutral-200/60 space-y-3 min-w-0 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 min-w-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Add via Web URL / Direct Image Link</span>
                <span className="text-[8px] font-bold text-neutral-400 uppercase">Bypasses local storage</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full min-w-0">
                <input
                  type="url"
                  placeholder="Paste direct photo link (e.g. Unsplash, Imgur)..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full sm:flex-1 min-w-0 max-w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary transition placeholder-neutral-400 text-neutral-800"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddWebUrl();
                    }
                  }}
                  id="photo-picker-url-input"
                />
                <button
                  type="button"
                  onClick={handleAddWebUrl}
                  className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition shrink-0 shadow-sm active:scale-95 flex items-center justify-center"
                >
                  Add Link
                </button>
              </div>
            </div>
          ) : (
            restrictByPlan && (
              <div className="bg-neutral-50/50 p-4 rounded-xl border border-neutral-150 text-center">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                  💡 Web URL & Clipboard pasting are Pro plan features.
                </p>
              </div>
            )
          )}

          {/* Search System / Database photos */}
          {allowSystemSearch && (
            <div className="space-y-4 pt-2 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Select Existing Item Photos</span>
                <div className="relative w-full sm:w-48 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
                  <input
                    type="text"
                    placeholder="Search library..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-9 pr-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Photos grid */}
              <div className="space-y-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block px-1">Other Lab / Library photos</span>
                {loadingDbPhotos ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-neutral-400 text-xs">
                    <Loader2 className="animate-spin" size={16} />
                    <span className="font-bold uppercase tracking-wider">Searching library...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-3 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                    {filteredPhotos.map((p, idx) => {
                      const isSelected = selectedSystemPhotos.includes(p.url);
                      return (
                        <button
                          key={`all-${idx}`}
                          type="button"
                          onClick={() => {
                            setSelectedSystemPhotos(prev =>
                              prev.includes(p.url) ? prev.filter(u => u !== p.url) : [...prev, p.url]
                            );
                          }}
                          className={`relative group h-20 rounded-xl overflow-hidden border transition text-left ${isSelected ? 'border-primary ring-2 ring-primary' : 'border-neutral-200 hover:border-neutral-400'}`}
                        >
                          <img src={p.url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1 text-[7px] text-white font-mono truncate">
                            {p.itemName}
                          </div>
                          {isSelected && (
                            <div className="absolute top-1 right-1 bg-primary text-white p-0.5 rounded-full shadow-md">
                              <Check size={10} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                    {filteredPhotos.length === 0 && (
                      <div className="col-span-4 text-center py-8 text-xs font-bold text-neutral-400">
                        No images found matching filter.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex gap-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3.5 bg-white border border-neutral-200 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-100 transition text-[10px] uppercase tracking-widest"
          >
            Cancel
          </button>
          {allowSystemSearch && (
            <button
              type="button"
              disabled={selectedSystemPhotos.length === 0}
              onClick={() => {
                onPhotoAdded(selectedSystemPhotos);
                setSelectedSystemPhotos([]);
                toast.success(`Successfully loaded ${selectedSystemPhotos.length} photo(s)`);
                onClose();
              }}
              className="flex-1 py-3.5 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition shadow-lg text-[10px] uppercase tracking-widest disabled:opacity-30 disabled:pointer-events-none"
            >
              Confirm ({selectedSystemPhotos.length}) Photos
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
