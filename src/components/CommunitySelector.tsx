import React, { useState, useEffect, useRef } from 'react';
import { Globe, MapPin, Compass, ArrowRight, Check, Sparkles, Building, Loader2, AlertCircle, Phone, Landmark, Navigation, Search } from 'lucide-react';
import { AdminSettings, AppCommunity, UserProfile } from '../types';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';

interface CommunitySelectorProps {
  adminSettings: AdminSettings | null;
  selectedCommunity: string | null;
  onSelect: (communityId: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  isDismissible?: boolean;
  user?: UserProfile | null;
}

const FIJI_CITIES_TOWNS = [
  "Suva",
  "Nadi",
  "Lautoka",
  "Labasa",
  "Nausori",
  "Savusavu",
  "Sigatoka",
  "Ba",
  "Tavua",
  "Rakiraki",
  "Lami",
  "Levuka",
  "Other"
];

const FIJI_PROVINCES = [
  "Ba",
  "Bua",
  "Cakaudrove",
  "Kadavu",
  "Lau",
  "Lomaiviti",
  "Macuata",
  "Nadroga-Navosa",
  "Naitasiri",
  "Namosi",
  "Ra",
  "Rewa",
  "Serua",
  "Tailevu",
  "Rotuma",
  "Other"
];

const CITY_TO_PROVINCE_MAP: Record<string, string> = {
  "Suva": "Rewa",
  "Nadi": "Ba",
  "Lautoka": "Ba",
  "Labasa": "Macuata",
  "Nausori": "Tailevu",
  "Savusavu": "Cakaudrove",
  "Sigatoka": "Nadroga-Navosa",
  "Ba": "Ba",
  "Tavua": "Ba",
  "Rakiraki": "Ra",
  "Lami": "Rewa",
  "Levuka": "Lomaiviti"
};

export default function CommunitySelector({
  adminSettings,
  selectedCommunity,
  onSelect,
  isOpen = true,
  onClose,
  isDismissible = false,
  user
}: CommunitySelectorProps) {
  const [step, setStep] = useState<'select' | 'fiji_setup'>('select');
  const [checkingLocation, setCheckingLocation] = useState(false);
  const [detectedCountry, setDetectedCountry] = useState<{ name: string; code: string; isSupported: boolean } | null>(null);
  const [customSearchQuery, setCustomSearchQuery] = useState('');
  const [dontShowAgain, setDontShowAgain] = useState(() => {
    return localStorage.getItem('packer_dont_show_community_selector') === 'true';
  });

  // Fiji preference form states
  const [fijiCity, setFijiCity] = useState(user?.fijiCity || '');
  const [fijiProvince, setFijiProvince] = useState(user?.fijiProvince || '');
  const [fijiPhone, setFijiPhone] = useState(user?.phoneNumber || user?.fijiPhone || '');
  const [fijiCityCustom, setFijiCityCustom] = useState('');
  const [fijiProvinceCustom, setFijiProvinceCustom] = useState('');
  const [savingFijiDetails, setSavingFijiDetails] = useState(false);

  // Load Google Maps API for Autocomplete dynamically
  const apiKey = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const autocompleteInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);

  useEffect(() => {
    if (!apiKey) return;
    if ((window as any).google?.maps?.places) {
      setGoogleMapsLoaded(true);
      return;
    }

    const existingScript = document.getElementById('google-maps-places-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => setGoogleMapsLoaded(true));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-places-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', () => setGoogleMapsLoaded(true));
    document.head.appendChild(script);
  }, [apiKey]);

  useEffect(() => {
    if (!googleMapsLoaded || !autocompleteInputRef.current || step !== 'fiji_setup') return;

    try {
      const google = (window as any).google;
      if (!google || !google.maps || !google.maps.places) return;

      const autocomplete = new google.maps.places.Autocomplete(autocompleteInputRef.current, {
        types: ['(cities)'],
        componentRestrictions: { country: 'fj' },
        fields: ['address_components', 'formatted_address', 'geometry', 'name']
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place || !place.address_components) return;

        let detectedCity = place.name || '';
        let detectedProvince = '';

        for (const component of place.address_components) {
          const types = component.types;
          if (types.includes('locality')) {
            detectedCity = component.long_name;
          } else if (types.includes('administrative_area_level_1')) {
            detectedProvince = component.long_name;
          } else if (types.includes('administrative_area_level_2') && !detectedProvince) {
            detectedProvince = component.long_name;
          }
        }

        if (detectedCity) {
          const normalizedCity = FIJI_CITIES_TOWNS.find(
            c => c.toLowerCase() === detectedCity.toLowerCase()
          );
          if (normalizedCity) {
            setFijiCity(normalizedCity);
            setFijiCityCustom('');
            
            // Auto fill province from local map if Google did not supply administrative_area
            if (!detectedProvince) {
              const localProvince = CITY_TO_PROVINCE_MAP[normalizedCity];
              if (localProvince) {
                detectedProvince = localProvince;
              }
            }
          } else {
            setFijiCity('Other');
            setFijiCityCustom(detectedCity);
          }
        }

        if (detectedProvince) {
          const normalizedProvince = FIJI_PROVINCES.find(
            p => p.toLowerCase().replace(/[^a-z0-9]/g, '') === detectedProvince.toLowerCase().replace(/[^a-z0-9]/g, '')
          );
          if (normalizedProvince) {
            setFijiProvince(normalizedProvince);
            setFijiProvinceCustom('');
          } else {
            setFijiProvince('Other');
            setFijiProvinceCustom(detectedProvince);
          }
        }

        toast.success(`Google Autocomplete configured location to ${detectedCity}${detectedProvince ? `, ${detectedProvince}` : ''}!`);
      });

      autocompleteRef.current = autocomplete;
    } catch (err) {
      console.warn("Could not load Google Autocomplete:", err);
    }
  }, [googleMapsLoaded, step]);

  const handleDontShowAgainChange = (checked: boolean) => {
    setDontShowAgain(checked);
    if (checked) {
      localStorage.setItem('packer_dont_show_community_selector', 'true');
    } else {
      localStorage.removeItem('packer_dont_show_community_selector');
    }
  };

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

  const checkFijiDetailsExists = () => {
    const userKey = user?.uid ? `packer_fiji_details_${user.uid}` : `packer_fiji_details_anonymous`;
    const stored = localStorage.getItem(userKey) || localStorage.getItem('packer_fiji_details_universal');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.city && parsed.province && parsed.phone) {
          return parsed;
        }
      } catch (e) {
        console.error("Failed to parse stored fiji details", e);
      }
    }
    
    // Check user profile properties if persistent in Firestore
    if (user?.fijiCity || user?.fijiProvince) {
      return {
        city: user.fijiCity,
        province: user.fijiProvince,
        phone: user.phoneNumber || user.fijiPhone || ''
      };
    }
    return null;
  };

  const handleSelection = (communityId: string) => {
    if (communityId === 'fiji') {
      const existingDetails = checkFijiDetailsExists();
      if (existingDetails) {
        // Device or user has already supplied these details. Skip asking!
        onSelect('fiji');
        toast.success("Welcome back! Active Fiji session loaded.");
      } else {
        // Not configured before. Require details setup first.
        setStep('fiji_setup');
      }
    } else {
      onSelect(communityId);
    }
  };

  const handleSaveFijiDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCity = fijiCity === "Other" ? fijiCityCustom.trim() : fijiCity;
    const finalProvince = fijiProvince === "Other" ? fijiProvinceCustom.trim() : fijiProvince;
    const finalPhone = fijiPhone.trim();

    if (!finalCity) {
      toast.error("Please select or type your City or Town");
      return;
    }
    if (!finalProvince) {
      toast.error("Please select or type your Province");
      return;
    }
    if (!finalPhone) {
      toast.error("Please enter your Phone Number");
      return;
    }

    // Direct phone standard check (at least 7 numbers)
    const digitsOnly = finalPhone.replace(/\D/g, '');
    if (digitsOnly.length < 7) {
      toast.error("Please enter a valid Fiji contact number (minimum 7 digits)");
      return;
    }

    setSavingFijiDetails(true);
    try {
      const details = {
        city: finalCity,
        province: finalProvince,
        phone: finalPhone,
        timestamp: Date.now()
      };

      // 1. Cache to device localStorage
      const userKey = user?.uid ? `packer_fiji_details_${user.uid}` : `packer_fiji_details_anonymous`;
      localStorage.setItem(userKey, JSON.stringify(details));
      localStorage.setItem('packer_fiji_details_universal', JSON.stringify(details));

      // 2. Persist in cloud database if user is authenticated, protecting user mapping
      if (user?.uid) {
        try {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            fijiCity: finalCity,
            fijiProvince: finalProvince,
            phoneNumber: finalPhone,
            fijiPhone: finalPhone,
            fijiDetailsCaptured: true,
            fijiDetailsCapturedAt: new Date().toISOString()
          });
        } catch (dbErr) {
          console.error("Firestore sync failed, local details saved:", dbErr);
        }
      }

      toast.success(`Fiji localized routing set to ${finalCity}, ${finalProvince}!`);
      onSelect('fiji');
    } catch (err) {
      console.error(err);
      toast.error("An error occurred active-mapping the portal preferences. Please retry.");
    } finally {
      setSavingFijiDetails(false);
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
        
        {step === 'select' ? (
          <>
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
              <p className="text-sm text-neutral-500 font-medium mt-1 font-sans">
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
                    onClick={() => handleSelection(recommendedCommunity.id)}
                    className="flex items-center justify-between gap-4 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-800 text-xs font-semibold cursor-pointer hover:bg-emerald-100/60 transition group"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl shrink-0">{recommendedCommunity.flag}</span>
                      <div className="text-left">
                        <span className="font-bold text-emerald-900 block font-sans">
                          Detected Location: {detectedCountry.name}
                        </span>
                        <span className="text-emerald-700 text-[11px] font-sans">
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
                      <span className="text-amber-700 text-[11px] block leading-relaxed font-sans">
                        A localized community marketplace has not been set up for your region yet. You are highly welcome to explore other open community hubs below or enter our Global site!
                      </span>
                    </div>
                  </div>
                )
              ) : (
                <div className="flex items-center justify-between gap-4 p-4 bg-neutral-50 rounded-2xl border border-neutral-150 text-neutral-500 text-xs font-semibold">
                  <span className="font-medium text-[11px] text-neutral-500 font-sans">Location block or lookup delayed. Please browse communities manually.</span>
                  <button 
                    onClick={detectLocation}
                    className="text-[10px] bg-white border border-neutral-200 px-2.5 py-1.5 rounded-lg font-black uppercase tracking-wider text-neutral-600 hover:bg-neutral-100 font-sans"
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
                    className="px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold w-48 focus:ring-2 focus:ring-primary outline-none transition font-sans"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-3.5">
                  {filteredCommunities.map((c) => {
                    const isSelected = selectedCommunity === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => handleSelection(c.id)}
                        className={`p-5 rounded-2xl border transition-all text-left flex flex-col justify-between gap-4 cursor-pointer relative group ${
                          isSelected 
                            ? 'bg-neutral-900 text-white border-neutral-900 shadow-lg' 
                            : 'bg-white text-neutral-800 border-neutral-200/80 hover:border-primary/45 hover:shadow-md'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <span className="text-2xl">{c.flag}</span>
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-sans">
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
                            <p className={`text-[9px] font-black mt-2 inline-block px-2 py-0.5 rounded uppercase font-sans ${isSelected ? 'bg-neutral-800 text-primary-light text-[#FF5500]' : 'bg-neutral-50 text-neutral-400'}`}>
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
                  onClick={() => handleSelection('global')}
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

            {/* Informative Footer banner with Don't Show Again option */}
            <div className="p-6 bg-neutral-50 border-t border-neutral-150 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4">
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <input 
                  type="checkbox"
                  id="dont_show_again_checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => handleDontShowAgainChange(e.target.checked)}
                  className="rounded border-neutral-300 text-primary focus:ring-primary h-4 w-4 transition cursor-pointer accent-orange-500"
                />
                <span className="text-xs font-semibold text-neutral-600 group-hover:text-neutral-900 transition font-sans">
                  Don't Show Again
                </span>
              </label>
              <p className="text-[10px] text-neutral-400 font-mono font-bold uppercase tracking-wider">
                🔒 Secured & Localized via Packer Tools Multi-Tenant Architecture
              </p>
            </div>
          </>
        ) : (
          /* Fijisetup setup form steps */
          <form onSubmit={handleSaveFijiDetails} className="flex flex-col flex-1 overflow-hidden">
            {/* Header of setup portal */}
            <div className="p-8 border-b border-neutral-100 shrink-0 text-left relative z-10 bg-neutral-50">
              <div className="flex items-center gap-2.5">
                <span className="text-3xl">🇫🇯</span>
                <div>
                  <h3 className="text-2xl font-black text-neutral-900 tracking-tight">
                    Fiji Community Verification
                  </h3>
                  <p className="text-xs font-mono font-black text-[#FF5500] uppercase tracking-widest mt-0.5">
                    Localized Setup Registry
                  </p>
                </div>
              </div>
              <p className="text-xs text-neutral-500 mt-3 font-sans leading-relaxed">
                As we establish the premier collaborative gear-sharing network in Fiji, we secure our public market routing by matching operators to their local cities and verified contacts.
              </p>
            </div>

            {/* Main setup scroll container */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6 text-left">
              
              {/* Google Places Autocomplete Search Box */}
              {apiKey ? (
                <div className="space-y-2 bg-[#002f6c]/5 border border-[#002f6c]/10 p-5 rounded-3xl relative">
                  <div className="flex items-center gap-2 text-neutral-800 font-bold text-xs uppercase tracking-wider font-sans">
                    <Sparkles size={14} className="text-[#FF5500] animate-pulse" />
                    <span>Instant City Autocomplete (Google Places)</span>
                  </div>
                  <div className="relative font-sans">
                    <input
                      ref={autocompleteInputRef}
                      type="text"
                      placeholder="Type a city or town to auto-complete..."
                      className="w-full pl-10 pr-4 py-3 bg-white border border-neutral-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-primary focus:bg-white outline-none transition font-sans text-neutral-800 placeholder-neutral-400"
                    />
                    <Search className="absolute left-3.5 top-3.5 text-neutral-400" size={16} />
                  </div>
                  <p className="text-[10px] text-neutral-500 font-sans leading-normal">
                    Fiji country code lock active. Type any town (e.g. Suva, Nadi, Lautoka, Macuata) to instantly populate City & Province fields below.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-neutral-100/60 border border-neutral-200/40 rounded-2xl">
                  <p className="text-[10px] text-neutral-500 font-sans leading-relaxed">
                    💡 <strong>Instant Search API available:</strong> To activate Google Autocomplete location sync, define <code>GOOGLE_MAPS_PLATFORM_KEY</code> under Admin settings or AI Studio configuration secrets.
                  </p>
                </div>
              )}

              {/* City or Town selection */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-neutral-800 font-bold text-sm font-sans">
                  <Landmark size={16} className="text-primary" />
                  <span>Choose City or Town</span>
                </div>
                <select
                  value={fijiCity}
                  onChange={(e) => {
                    const selectedVal = e.target.value;
                    setFijiCity(selectedVal);
                    if (selectedVal !== "Other") {
                      setFijiCityCustom('');
                      // Auto-fill province from map
                      const matchedProvince = CITY_TO_PROVINCE_MAP[selectedVal];
                      if (matchedProvince) {
                        setFijiProvince(matchedProvince);
                        setFijiProvinceCustom('');
                        toast.info(`Auto-detected Province: ${matchedProvince} based on your selected City/Town.`);
                      }
                    }
                  }}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-primary focus:bg-white outline-none transition font-sans"
                  required
                >
                  <option value="">-- Select Fiji City or Town --</option>
                  {FIJI_CITIES_TOWNS.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>

                {fijiCity === "Other" && (
                  <div className="mt-2.5">
                    <input
                      type="text"
                      placeholder="Type your specific town name..."
                      value={fijiCityCustom}
                      onChange={(e) => {
                        const customVal = e.target.value;
                        setFijiCityCustom(customVal);
                        
                        // Case-insensitive automatic lookup for typed custom town
                        const matchedKey = Object.keys(CITY_TO_PROVINCE_MAP).find(
                          k => k.toLowerCase() === customVal.trim().toLowerCase()
                        );
                        if (matchedKey) {
                          const matchedProvince = CITY_TO_PROVINCE_MAP[matchedKey];
                          setFijiProvince(matchedProvince);
                          setFijiProvinceCustom('');
                          toast.info(`Auto-detected Province: ${matchedProvince} for "${customVal}"`);
                        }
                      }}
                      className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary outline-none transition font-sans"
                      required
                    />
                  </div>
                )}
              </div>

              {/* Province selection */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-neutral-800 font-bold text-sm font-sans">
                  <Navigation size={16} className="text-primary" />
                  <span>Choose Province Location</span>
                </div>
                <select
                  value={fijiProvince}
                  onChange={(e) => {
                    setFijiProvince(e.target.value);
                    if (e.target.value !== "Other") setFijiProvinceCustom('');
                  }}
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-primary focus:bg-white outline-none transition font-sans"
                  required
                >
                  <option value="">-- Select Fiji Province --</option>
                  {FIJI_PROVINCES.map((prov) => (
                    <option key={prov} value={prov}>{prov}</option>
                  ))}
                </select>

                {fijiProvince === "Other" && (
                  <div className="mt-2.5">
                    <input
                      type="text"
                      placeholder="Type your specific province..."
                      value={fijiProvinceCustom}
                      onChange={(e) => setFijiProvinceCustom(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-neutral-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary outline-none transition font-sans"
                      required
                    />
                  </div>
                )}
              </div>

              {/* Phone number capture */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-neutral-800 font-bold text-sm font-sans">
                  <Phone size={16} className="text-primary" />
                  <span>Operator Contact Phone Number</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-neutral-100 border border-neutral-200 px-3.5 py-3 rounded-2xl font-mono text-xs font-black text-neutral-500">
                    +679
                  </span>
                  <input
                    type="tel"
                    placeholder="e.g. 9451234 or 7234567"
                    value={fijiPhone}
                    onChange={(e) => setFijiPhone(e.target.value)}
                    className="flex-1 px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-primary focus:bg-white outline-none transition font-sans"
                    required
                  />
                </div>
                <p className="text-[10px] text-neutral-400 font-mono leading-relaxed pl-1">
                  * Keeps your identity verified on this device and avoids prompt loops on subsequent entries.
                </p>
              </div>

            </div>

            {/* Footer of Setup window flow */}
            <div className="p-6 bg-neutral-50 border-t border-neutral-150 shrink-0 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setStep('select')}
                className="px-5 py-3 border border-neutral-200 bg-white hover:bg-neutral-100 font-bold text-xs uppercase text-neutral-700 rounded-2xl cursor-pointer transition"
              >
                Back To List
              </button>

              <button
                type="submit"
                disabled={savingFijiDetails}
                className="px-6 py-3 bg-neutral-900 border border-neutral-900 hover:bg-neutral-800 text-white font-black text-xs uppercase tracking-wider rounded-2xl cursor-pointer transition flex items-center gap-2 disabled:opacity-50"
              >
                {savingFijiDetails ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    <span>Activating...</span>
                  </>
                ) : (
                  <>
                    <span>Verify & Enter Fiji Portal</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
