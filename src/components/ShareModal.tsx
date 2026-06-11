import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  Copy, 
  Mail, 
  MessageCircle, 
  Calendar, 
  ExternalLink, 
  Package, 
  Layers, 
  Info,
  QrCode
} from 'lucide-react';
import { toast } from 'sonner';

interface ShareModalProps {
  type: 'gear' | 'kit' | 'list';
  data: any; // GearItem or PackingList
  onClose: () => void;
  user?: any;
}

export default function ShareModal({ type, data, onClose, user }: ShareModalProps) {
  const [showQr, setShowQr] = useState(false);
  if (!data) return null;

  // Determine item specifics
  const isGear = type === 'gear' || type === 'kit';
  const name = data.name || 'Untitled Item';
  const description = data.description || 'No description provided.';
  const category = data.category || (isGear ? 'Equipment' : 'Packing List');
  
  // Construct the shareable bio/profile link
  let shareUrl = '';
  if (isGear) {
    const ownerId = data.ownerId || user?.uid || '';
    shareUrl = `${window.location.origin}/#/gear/${data.id}?owner=${ownerId}`;
  } else {
    shareUrl = `${window.location.origin}/#/p/${data.id}${data.shareToken ? `?token=${data.shareToken}` : ''}`;
  }

  // Determine if available for booking
  let isAvailableForBooking = false;
  if (isGear) {
    isAvailableForBooking = data.isAvailableForRent === true || 
                            data.secondaryCategories?.includes('Rentable') || 
                            data.isAvailableForRent !== false; // matching standard behavior
  } else {
    isAvailableForBooking = data.transactionType === 'Rental' || 
                            data.marketplaceEnabled === true || 
                            data.isPublic === true;
  }

  // Sharing handlers
  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success('Share link successfully copied to your clipboard!');
  };

  const handleShareWhatsApp = () => {
    const textMsg = `Check out this ${isGear ? (type === 'kit' ? 'gear kit' : 'gear item') : 'packing list'} "${name}" on Packer Tools. ${isAvailableForBooking ? 'Available for rent/booking directly here: ' : 'View details here: '} ${shareUrl}`;
    const url = `https://wa.me/?text=${encodeURIComponent(textMsg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    toast.info('Opening WhatsApp share link...');
  };

  const handleShareEmail = () => {
    const subject = `Packer Tools - Share: ${name}`;
    const bodyStr = `Hi,\n\nI wanted to share this with you on Packer Tools:\n\nName: ${name}\nDescription: ${description}\n\nYou can view and directly ${isAvailableForBooking ? 'book' : 'access'} this here:\n${shareUrl}\n\nBest regards,\nPacker Team`;
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyStr)}`;
    window.location.href = mailto;
    toast.info('Launching mail app...');
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-neutral-950/80 backdrop-blur-md"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 25 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 25 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="w-full max-w-lg bg-white rounded-[2.5rem] border border-neutral-100 shadow-2xl p-6 sm:p-8 relative z-10 space-y-6 text-left max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
              {type === 'kit' && <Layers size={11} />}
              {type === 'gear' && <Package size={11} />}
              {type === 'list' && <Calendar size={11} />}
              <span>Share Portal</span>
            </span>
            <h3 className="text-xl font-black text-neutral-900 tracking-tight uppercase leading-none">
              Share {type === 'kit' ? 'Kit Item' : type === 'gear' ? 'Equipment' : 'Packing List'}
            </h3>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-700 bg-neutral-50 rounded-xl hover:bg-neutral-100 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Info Callout */}
        <div className="bg-neutral-50 border border-neutral-200/50 p-4 rounded-2xl flex items-start gap-3">
          <Info size={16} className="text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-neutral-500 font-medium leading-relaxed">
            Send directly to clients, partners, or booking teams. Customers can view item photos, specifications, and request secure reservations instantly.
          </p>
        </div>

        {/* THE VISUAL SHARED CARD PREVIEW */}
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Card Preview (Click opens profile page)</label>
          
          <div 
            onClick={() => window.open(shareUrl, '_blank', 'noopener,noreferrer')}
            className="group bg-white rounded-[2rem] border border-neutral-100 shadow-lg scale-100 hover:scale-[1.01] hover:border-neutral-200 cursor-pointer overflow-hidden transition-all duration-300 flex flex-col min-w-0"
          >
            {/* Visual Header / Cover */}
            <div className="relative aspect-[16/9] sm:aspect-[16/8] bg-neutral-50 overflow-hidden shrink-0">
              {isGear && data.photoUrls?.[0] ? (
                <img 
                  referrerPolicy="no-referrer"
                  src={data.photoUrls[0]} 
                  alt={name} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-neutral-900 to-neutral-800 flex flex-col justify-center items-center p-6 text-center text-white relative">
                  <div className="absolute top-4 left-4 text-[10px] uppercase font-black tracking-widest opacity-40">PACKER TEMPLATE</div>
                  <Calendar size={32} className="text-primary/75 mb-2" />
                  <span className="text-xs font-bold font-mono tracking-widest opacity-60">#{data.id?.slice(-6).toUpperCase() || 'LIST'}</span>
                </div>
              )}

              {/* Badges */}
              <div className="absolute top-4 right-4 flex gap-1.5 z-10">
                <span className="px-2.5 py-1 bg-white/95 backdrop-blur-md rounded-full text-[8.5px] font-bold text-neutral-900 uppercase shadow-sm">
                  {category}
                </span>
                {isAvailableForBooking && (
                  <span className="px-2.5 py-1 bg-emerald-600 rounded-full text-[8.5px] font-black text-white uppercase shadow-sm">
                    ● Rentable Hold Active
                  </span>
                )}
              </div>
            </div>

            {/* Core Card Content */}
            <div className="p-5 flex-1 flex flex-col space-y-3 justify-between">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#0066cc]">
                    {data.brand || 'Packer Pro Tool'}
                  </p>
                  <p className="text-[9px] font-mono text-neutral-400 font-bold">
                    {isGear ? `Weight: ${data.weight ? `${data.weight}g` : 'N/A'}` : `${data.items?.length || 0} items`}
                  </p>
                </div>
                <h4 className="font-extrabold text-lg text-neutral-950 uppercase tracking-tight line-clamp-1 group-hover:text-primary transition duration-200">
                  {name}
                </h4>
                <p className="text-xs text-neutral-500 font-medium line-clamp-2 leading-relaxed">
                  {description}
                </p>
              </div>

              {/* BOOK NOW OR PREVIEW ACTION BUTTON INSIDE CARD */}
              <div className="pt-2 border-t border-dotted border-neutral-100 flex items-center justify-between">
                <div>
                  {isGear ? (
                    data.rentalPrice ? (
                      <span className="font-mono text-xs font-black text-neutral-900">
                        {data.currency || '$'}{data.rentalPrice}/day
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wide">Catalog Reference</span>
                    )
                  ) : (
                    data.price ? (
                      <span className="font-mono text-xs font-black text-neutral-900">
                        {data.currency || '$'}{data.price} package
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wide">Public Packing Checklist</span>
                    )
                  )}
                </div>

                {isAvailableForBooking ? (
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap"
                  >
                    <Calendar size={11} className="text-primary" />
                    <span>Book Now</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="flex items-center gap-1 px-4 py-2 bg-neutral-100 text-neutral-600 rounded-xl text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
                  >
                    <span>View Bio Info</span>
                    <ExternalLink size={10} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Input link field */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Shareable Item Bio Link</label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="flex-1 p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold font-mono text-neutral-600 select-all outline-none"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-4 bg-neutral-950 hover:bg-neutral-800 text-white transition rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Copy size={13} />
              <span>Copy</span>
            </button>
          </div>
        </div>

        {/* EXPLICIT SHARE CHANNELS (WhatsApp, Copy Link, Share on Email, QR Code) */}
        <div className="pt-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 block mb-2 text-center" id="lbl-share-channels">Share directly via</label>
          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="flex flex-col items-center justify-center p-2.5 bg-[#25D366]/5 hover:bg-[#25D366]/10 text-[#128C7E] rounded-2xl border border-[#25D366]/10 transition-all duration-200 cursor-pointer hover:shadow-md group"
              title="Share via WhatsApp"
              id="btn-whatsapp-share"
            >
              <MessageCircle size={20} className="text-[#25D366] group-hover:scale-110 transition shrink-0 mb-1" />
              <span className="text-[9px] font-black uppercase tracking-wider">WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="flex flex-col items-center justify-center p-2.5 bg-neutral-50 hover:bg-neutral-100 text-neutral-800 rounded-2xl border border-neutral-200 transition-all duration-200 cursor-pointer hover:shadow-md group"
              title="Copy link to clipboard"
              id="btn-copy-share"
            >
              <Copy size={20} className="text-neutral-500 group-hover:scale-110 transition shrink-0 mb-1" />
              <span className="text-[9px] font-black uppercase tracking-wider">Copy Link</span>
            </button>

            <button
              type="button"
              onClick={handleShareEmail}
              className="flex flex-col items-center justify-center p-2.5 bg-blue-50/50 hover:bg-blue-100/70 text-blue-900 rounded-2xl border border-blue-100 transition-all duration-200 cursor-pointer hover:shadow-md group"
              title="Share via Email"
              id="btn-email-share"
            >
              <Mail size={20} className="text-blue-500 group-hover:scale-110 transition shrink-0 mb-1" />
              <span className="text-[9px] font-black uppercase tracking-wider">Email</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowQr(!showQr);
                if (!showQr) toast.success("QR Code generated successfully!");
              }}
              className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border transition-all duration-200 cursor-pointer hover:shadow-md group ${
                showQr 
                  ? 'bg-primary/20 border-primary text-primary' 
                  : 'bg-indigo-50/50 hover:bg-indigo-100 border-indigo-150 text-indigo-950'
              }`}
              title="Toggle QR Code display"
              id="btn-qr-share"
            >
              <QrCode size={20} className={`${showQr ? 'text-primary' : 'text-indigo-650'} group-hover:scale-110 transition shrink-0 mb-1`} />
              <span className="text-[9px] font-black uppercase tracking-wider">QR Code</span>
            </button>
          </div>
        </div>

        {/* INTERACTIVE QR CODE SCREEN */}
        {showQr && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 bg-neutral-50 rounded-3xl border border-neutral-200/50 flex flex-col items-center text-center space-y-4"
            id="qr-view-container"
          >
            <div className="relative p-4 bg-white rounded-2xl shadow-md border border-neutral-100 flex items-center justify-center">
              {/* QR scanner camera corners */}
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary rounded-tl-md"></div>
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary rounded-tr-md"></div>
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary rounded-bl-md"></div>
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary rounded-br-md"></div>

              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(shareUrl)}`}
                alt="QR Code Scan Target"
                className="w-40 h-40 object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            
            <div className="space-y-1">
              <h5 className="text-[10px] font-black uppercase tracking-widest text-neutral-800">Scan to View Info</h5>
              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wide max-w-[280px]">
                Open your device camera or scanner app to load this shared {type === 'kit' ? 'gear kit' : type === 'gear' ? 'equipment' : 'packing list'} instantly.
              </p>
            </div>
          </motion.div>
        )}

        {/* Footer closes */}
        <div className="pt-2 border-t border-neutral-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 bg-neutral-100 hover:bg-neutral-250 text-neutral-700 rounded-xl font-bold text-xs uppercase cursor-pointer"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
