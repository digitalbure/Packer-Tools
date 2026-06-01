import React, { useState, useEffect } from 'react';
import { Globe, MapPin, Compass, ArrowRight, Check, Sparkles, Building, Loader2, AlertCircle } from 'lucide-react';
import { AdminSettings, AppCommunity } from '../types';

interface CommunitySelectorProps {
  adminSettings: AdminSettings | null;
  selectedCommunity: string | null;
  onSelect: (communityId: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  isDismissible?: boolean;
}

export default function CommunitySelector({
  adminSettings,
  selectedCommunity,
  onSelect,
  isOpen = true,
  onClose,
  isDismissible = false
}: CommunitySelectorProps) {
  const [checkingLocation, setCheckingLocation] = useState(false);
  const [detectedCountry, setDetectedCountry] = useState<{ name: string; code: string; isSupported: boolean } | null>(null);
  const [customSearchQuery, setCustomSearchQuery] = useState('');

  // Default communities if none are set yet in database
  const activeCommunities = adminSettings?.communities || [
    { id: 'fiji', name: 'Fiji Community', country: 'Fiji', countryCode: 'FJ', currency: 'FJD', flag: '🇫🇯', companyName: 'Packer Tools Fiji', isActive: true },
    { id: 'australia', name: 'Australian Community', country: 'Australia', countryCode: 'AU', currency: 'AUD', flag: '🇦🇺', companyName: 'Packer Tools Australia', isActive: true },
    { id: 'new_zealand', name: 'New Zealand Community', country: 'New Zealand', countryCode: 'NZ', currency: 'NZD', flag: '🇳🇿', companyName: 'Packer Tools New Zealand', isActive: true }
  ];

  const enabledCommunities = activeCommunities.filter(c => c.isActive);

  useEffect(() => {
    if (isOpen) {
      detectLocation();
    }
  }, [isOpen]);

  const detectLocation = async () => {
    setCheckingLocation(true);
    setDetectedCountry(null);

    // 1. Try free public IP-geolocation API
    try {
      const res = await fetch('https://freeipapi.app/api/json');
      if (res.ok) {
        const data = await res.json();
        const code = data.countryCode; // e.g. "FJ", "AU", "NZ", "US"
        const name = data.countryName;
        
        const isSupported = enabledCommunities.some(c => c.countryCode.toUpperCase() === code.toUpperCase());
        setDetectedCountry({ name, code, isSupported });
        setCheckingLocation(false);
        return;
      }
    } catch (e) {
      console.warn("IP Geolocation API fell back to coordinate bounding boxes:", e);
    }

    // 2. Fallback to coordinate estimates via browser navigator.geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;

          // Estimate based on closest target country
          const distToFiji = Math.sqrt(Math.pow(lat - (-18), 2) + Math.pow(lng - 178, 2));
          const distToOz = Math.sqrt(Math.pow(lat - (-25), 2) + Math.pow(lng - 133, 2));
          const distToNZ = Math.sqrt(Math.pow(lat - (-41), 2) + Math.pow(lng - 174, 2));

          let code = 'US';
          let name = 'United States';

          if (distToFiji < 7) {
            code = 'FJ';
            name = 'Fiji';
          } else if (distToOz < 18) {
            code = 'AU';
            name = 'Australia';
          } else if (distToNZ < 8) {
            code = 'NZ';
            name = 'New Zealand';
          }

          const isSupported = enabledCommunities.some(c => c.countryCode.toUpperCase() === code.toUpperCase());
          setDetectedCountry({ name, code, isSupported });
          setCheckingLocation(false);
        },
        () => {
          // If permission denied or error, default to null
          setDetectedCountry(null);
          setCheckingLocation(false);
        },
        { timeout: 4000 }
      );
    } else {
      setCheckingLocation(false);
    }
  };

  if (!isOpen) return null;

  // Find dynamic recommendation based on detected country code
  const recommendedCommunity = detectedCountry 
    ? enabledCommunities.find(c => c.countryCode.toUpperCase() === detectedCountry.code.toUpperCase())
    : null;

  const filteredCommunities = enabledCommunities.filter(c => 
    c.name.toLowerCase().includes(customSearchQuery.toLowerCase()) ||
    c.country.toLowerCase().includes(customSearchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[100] bg-neutral-950/70 backdrop-blur-md flex items-center justify-center p-4 md:p-6 overflow-y-auto font-sans">
      <div className="bg-white rounded-[2.5rem] border border-neutral-100 max-w-2xl w-full shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Decorative corner accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10" />
        
        {/* Upper Brand Header */}
        <div className="p-8 border-b border-neutral-100 shrink-0 text-left relative z-10">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/15 text-primary rounded-full text-[10px] font-black uppercase tracking-widest">
              <Compass size={12} className="animate-spin-slow" />
              <span>Workspace Portal Locator</span>
            </div>
            {isDismissible && onClose && (
              <button 
                onClick={onClose}
                className="text-neutral-400 hover:text-neutral-600 font-bold text-xs uppercase cursor-pointer"
              >
                Close ✕
              </button>
            )}
          </div>
          <h2 className="text-3xl font-black text-neutral-900 tracking-tight mt-4">
            Select Your Active Community
          </h2>
          <p className="text-sm text-neutral-500 font-medium mt-1">
            Choose your localized geographic workspace community to discover marketplace gear listings, or choose the Global site.
          </p>
        </div>

        {/* Dynamic Location Detection Badge */}
        <div className="px-8 pt-6 shrink-0 text-left">
          {checkingLocation ? (
            <div className="flex items-center gap-2 px-4 py-3 bg-neutral-50 rounded-2xl border border-neutral-150 text-neutral-500 text-xs font-semibold">
              <Loader2 size={14} className="animate-spin text-primary" />
              <span>Identifying your system coordinates and geographical country code...</span>
            </div>
          ) : detectedCountry ? (
            detectedCountry.isSupported && recommendedCommunity ? (
              <div 
                onClick={() => onSelect(recommendedCommunity.id)}
                className="flex items-center justify-between gap-4 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-800 text-xs font-semibold cursor-pointer hover:bg-emerald-100/60 transition group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl shrink-0">{recommendedCommunity.flag}</span>
                  <div className="text-left">
                    <span className="font-bold text-emerald-900 block font-sans">
                      Detected Location: {detectedCountry.name}
                    </span>
                    <span className="text-emerald-700 text-[11px]">
                      Recommended Community Workspace available! Click to entry.
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 font-black uppercase tracking-wider text-[10px] text-emerald-700 bg-white px-3 py-1.5 rounded-xl border border-emerald-200 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-transparent transition-all">
                  <span>Enter</span>
                  <ArrowRight size={12} />
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-800 text-xs text-left font-sans flex items-start gap-2.5">
                <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-amber-900 block">
                    Community Unavailable for {detectedCountry.name} ({detectedCountry.code})
                  </span>
                  <span className="text-amber-700 text-[11px] block leading-relaxed">
                    A localized community marketplace has not been set up for your region yet. You are highly welcome to explore other open community hubs below or enter our Global site!
                  </span>
                </div>
              </div>
            )
          ) : (
            <div className="flex items-center justify-between gap-4 p-4 bg-neutral-50 rounded-2xl border border-neutral-150 text-neutral-500 text-xs font-semibold">
              <span className="font-medium text-[11px] text-neutral-500">Location block or lookup delayed. Please browse communities manually.</span>
              <button 
                onClick={detectLocation}
                className="text-[10px] bg-white border border-neutral-200 px-2.5 py-1.5 rounded-lg font-black uppercase tracking-wider text-neutral-600 hover:bg-neutral-100"
              >
                Retry GPS/IP
              </button>
            </div>
          )}
        </div>

        {/* Scrollable Communities Workspace Selector Grid */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="space-y-3 text-left">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 font-mono">
                Available Communities ({filteredCommunities.length})
              </label>
              <input
                type="text"
                placeholder="Search community country..."
                value={customSearchQuery}
                onChange={(e) => setCustomSearchQuery(e.target.value)}
                className="px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold w-48 focus:ring-2 focus:ring-primary outline-none transition"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3.5">
              {filteredCommunities.map((c) => {
                const isSelected = selectedCommunity === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => onSelect(c.id)}
                    className={`p-5 rounded-2xl border transition-all text-left flex flex-col justify-between gap-4 cursor-pointer relative group ${
                      isSelected 
                        ? 'bg-neutral-900 text-white border-neutral-900 shadow-lg' 
                        : 'bg-white text-neutral-800 border-neutral-200/80 hover:border-primary/45 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-2xl">{c.flag}</span>
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px]">
                          ✓
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className={`font-black uppercase tracking-tight text-sm ${isSelected ? 'text-white' : 'text-neutral-900'}`}>
                        {c.name}
                      </h4>
                      <p className={`text-[10px] font-mono mt-0.5 ${isSelected ? 'text-neutral-400' : 'text-neutral-500'}`}>
                        {c.country} • Currency: {c.currency}
                      </p>
                      {c.companyName && (
                        <p className={`text-[9px] font-black mt-2 inline-block px-2 py-0.5 rounded uppercase ${isSelected ? 'bg-neutral-800 text-primary-light text-[#FF5500]' : 'bg-neutral-50 text-neutral-400'}`}>
                          {c.companyName}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Alternative option: Global Site */}
          <div className="space-y-2 text-left pt-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 font-mono">
              Universal Platform Entry
            </label>
            <button
              onClick={() => onSelect('global')}
              className={`w-full p-5 rounded-2xl border transition-all text-left flex items-center justify-between cursor-pointer group ${
                selectedCommunity === 'global'
                  ? 'bg-neutral-900 text-white border-neutral-900 shadow-lg'
                  : 'bg-white text-neutral-800 border-neutral-200 hover:border-primary/45 hover:shadow-md'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${selectedCommunity === 'global' ? 'bg-primary/20 text-primary' : 'bg-neutral-50 text-neutral-400'}`}>
                  <Globe size={22} className={selectedCommunity === 'global' ? 'animate-spin-slow' : ''} />
                </div>
                <div className="text-left font-sans">
                  <h4 className={`font-black uppercase tracking-tight text-sm ${selectedCommunity === 'global' ? 'text-white' : 'text-neutral-900'}`}>
                    Global Site (Universal Packer Tools)
                  </h4>
                  <p className={`text-xs ${selectedCommunity === 'global' ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    Access Packer Tools without active regional marketplaces (Main visual gear logistics)
                  </p>
                </div>
              </div>
              <div className="w-5 h-5 rounded-full bg-neutral-100 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                →
              </div>
            </button>
          </div>
        </div>

        {/* Informative Footer banner */}
        <div className="p-6 bg-neutral-50 border-t border-neutral-150 text-center shrink-0">
          <p className="text-[10px] text-neutral-400 font-mono font-bold uppercase tracking-wider">
            🔒 Secured & Localized via Packer Tools Multi-Tenant Architecture
          </p>
        </div>

      </div>
    </div>
  );
}
