import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, 
  Clock, 
  Calendar, 
  Navigation, 
  Compass, 
  ChevronRight, 
  Building, 
  Info,
  Truck,
  ArrowRightLeft
} from 'lucide-react';

export interface PickupDropoffState {
  pickupType: 'preset' | 'custom';
  pickupLocationId: string;
  pickupCustomAddress: string;
  pickupTimeSlot: string;
  pickupNotes: string;
  dropoffType: 'preset' | 'custom';
  dropoffLocationId: string;
  dropoffCustomAddress: string;
  dropoffTimeSlot: string;
  dropoffNotes: string;
  distanceKm: number;
  transitCost: number;
}

interface PickupDropoffWidgetProps {
  onChange: (state: PickupDropoffState) => void;
  initialState?: Partial<PickupDropoffState>;
}

export interface PresetLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  type: 'depot' | 'airport' | 'agency';
  icon: string;
}

export const PRESET_LOCATIONS: PresetLocation[] = [
  {
    id: 'suva_depot',
    name: 'Suva Film Studio & Logistics Depot',
    address: '12 Queen Elizabeth Dr, Suva',
    city: 'Suva',
    lat: -18.1416,
    lng: 178.4419,
    type: 'depot',
    icon: '🏢'
  },
  {
    id: 'nadi_airport',
    name: 'Nadi Aviation Cargo Terminal',
    address: 'Nadi International Airport, Queens Rd',
    city: 'Nadi',
    lat: -17.7554,
    lng: 177.4432,
    type: 'airport',
    icon: '✈️'
  },
  {
    id: 'pac_harbour',
    name: 'Pacific Harbour Camera Lounge',
    address: 'Hibiscus Highway, Pacific Harbour',
    city: 'Pacific Harbour',
    lat: -18.2541,
    lng: 178.0717,
    type: 'agency',
    icon: '🎥'
  }
];

const TIME_SLOTS = [
  { id: 'morning', label: 'Morning (08:00 AM - 12:00 PM)' },
  { id: 'afternoon', label: 'Afternoon (12:00 PM - 04:00 PM)' },
  { id: 'evening', label: 'Evening (04:00 PM - 08:00 PM)' },
  { id: 'night', label: 'Overnight lock drop (08:00 PM - 12:00 AM)' }
];

export default function PickupDropoffWidget({ onChange, initialState }: PickupDropoffWidgetProps) {
  const [pickupType, setPickupType] = useState<'preset' | 'custom'>(
    initialState?.pickupType || 'preset'
  );
  const [pickupLocationId, setPickupLocationId] = useState(
    initialState?.pickupLocationId || 'suva_depot'
  );
  const [pickupCustomAddress, setPickupCustomAddress] = useState(
    initialState?.pickupCustomAddress || ''
  );
  const [pickupTimeSlot, setPickupTimeSlot] = useState(
    initialState?.pickupTimeSlot || 'morning'
  );
  const [pickupNotes, setPickupNotes] = useState(
    initialState?.pickupNotes || ''
  );

  const [dropoffType, setDropoffType] = useState<'preset' | 'custom'>(
    initialState?.dropoffType || 'preset'
  );
  const [dropoffLocationId, setDropoffLocationId] = useState(
    initialState?.dropoffLocationId || 'suva_depot'
  );
  const [dropoffCustomAddress, setDropoffCustomAddress] = useState(
    initialState?.dropoffCustomAddress || ''
  );
  const [dropoffTimeSlot, setDropoffTimeSlot] = useState(
    initialState?.dropoffTimeSlot || 'afternoon'
  );
  const [dropoffNotes, setDropoffNotes] = useState(
    initialState?.dropoffNotes || ''
  );

  // Dynamic route rendering state
  const [distance, setDistance] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);

  // Calculate distance & simulated dispatch rates
  useEffect(() => {
    let pLat = -18.1416, pLng = 178.4419;
    let dLat = -18.1416, dLng = 178.4419;

    if (pickupType === 'preset') {
      const found = PRESET_LOCATIONS.find(l => l.id === pickupLocationId);
      if (found) {
        pLat = found.lat;
        pLng = found.lng;
      }
    } else {
      // Custom coordinates simulation
      pLat = -17.95;
      pLng = 177.8;
    }

    if (dropoffType === 'preset') {
      const found = PRESET_LOCATIONS.find(l => l.id === dropoffLocationId);
      if (found) {
        dLat = found.lat;
        dLng = found.lng;
      }
    } else {
      dLat = -18.05;
      dLng = 178.2;
    }

    // Haversine distance simulation
    const R = 6371; // km
    const dLatRad = ((dLat - pLat) * Math.PI) / 180;
    const dLngRad = ((dLng - pLng) * Math.PI) / 180;
    const a =
      Math.sin(dLatRad / 2) * Math.sin(dLatRad / 2) +
      Math.cos((pLat * Math.PI) / 180) *
        Math.cos((dLat * Math.PI) / 180) *
        Math.sin(dLngRad / 2) *
        Math.sin(dLngRad / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    let calculatedKm = R * c;

    if (calculatedKm === 0) {
      if (pickupType === 'custom' || dropoffType === 'custom') {
        calculatedKm = 48.6; // fallback for customized points
      } else {
        calculatedKm = 0; // Same location default
      }
    }

    // Round
    const roundedKm = parseFloat(calculatedKm.toFixed(1));
    setDistance(roundedKm);

    // Simulated transit cost (FJ$ 1.50 per km base + base handling fees)
    const cost = roundedKm > 0 ? parseFloat((15 + roundedKm * 1.65).toFixed(2)) : 0;
    setEstimatedCost(cost);

    // Emit change upwards
    onChange({
      pickupType,
      pickupLocationId,
      pickupCustomAddress,
      pickupTimeSlot,
      pickupNotes,
      dropoffType,
      dropoffLocationId,
      dropoffCustomAddress,
      dropoffTimeSlot,
      dropoffNotes,
      distanceKm: roundedKm,
      transitCost: cost
    });
  }, [
    pickupType,
    pickupLocationId,
    pickupCustomAddress,
    pickupTimeSlot,
    pickupNotes,
    dropoffType,
    dropoffLocationId,
    dropoffCustomAddress,
    dropoffTimeSlot,
    dropoffNotes,
    onChange
  ]);

  const activePickupName = pickupType === 'preset' 
    ? PRESET_LOCATIONS.find(l => l.id === pickupLocationId)?.name || 'Studio Depot'
    : pickupCustomAddress || 'Custom Location Point';

  const activeDropoffName = dropoffType === 'preset'
    ? PRESET_LOCATIONS.find(l => l.id === dropoffLocationId)?.name || 'Studio Depot'
    : dropoffCustomAddress || 'Custom Drop Point';

  const sameLocation = pickupType === 'preset' && dropoffType === 'preset' && pickupLocationId === dropoffLocationId;

  return (
    <div className="bg-neutral-50/50 p-4 sm:p-6 rounded-[2rem] border border-neutral-150 space-y-6">
      <div className="flex items-center justify-between border-b border-neutral-200/50 pb-3">
        <div className="flex items-center gap-2">
          <Navigation size={16} className="text-primary animate-pulse" />
          <h4 className="text-xs font-black uppercase tracking-wider text-neutral-800">Customized Pickup & Dropoff Planner</h4>
        </div>
        <span className="text-[9px] bg-neutral-200/60 text-neutral-500 font-extrabold px-2 py-0.5 rounded-full font-mono">
          Interactive Routing Engine
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* PICKUP SECTION */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-black tracking-widest text-[#0066cc] flex items-center gap-1">
              <span>🟢</span> Pickup Logistics
            </span>
            <div className="flex bg-neutral-200 p-0.5 rounded-lg text-[9px] font-bold">
              <button
                type="button"
                onClick={() => setPickupType('preset')}
                className={`px-2 py-1 rounded-md transition ${pickupType === 'preset' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500'}`}
              >
                Depots
              </button>
              <button
                type="button"
                onClick={() => setPickupType('custom')}
                className={`px-2 py-1 rounded-md transition ${pickupType === 'custom' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500'}`}
              >
                Custom Address
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {pickupType === 'preset' ? (
              <motion.div
                key="preset-pickup"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="space-y-2"
              >
                <label className="text-[10px] text-neutral-450 block font-bold">Select Depot Point</label>
                <div className="space-y-2">
                  {PRESET_LOCATIONS.map((loc) => {
                    const isSelected = pickupLocationId === loc.id;
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => setPickupLocationId(loc.id)}
                        className={`w-full p-3 rounded-xl border text-left flex items-start gap-2.5 transition ${
                          isSelected 
                            ? 'bg-white border-[#0066cc] outline outline-1 outline-[#0066cc] shadow-xs' 
                            : 'bg-white/80 border-neutral-150 hover:border-neutral-250 hover:bg-white'
                        }`}
                      >
                        <span className="text-lg">{loc.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-neutral-900 truncate leading-snug">{loc.name}</p>
                          <p className="text-[10px] text-neutral-400 truncate mt-0.5">{loc.address}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="custom-pickup"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="space-y-2"
              >
                <label className="text-[10px] text-neutral-450 block font-bold">Enter Custom Street Address / Venue</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3.5 text-neutral-400">📍</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Grand Pacific Hotel, Victoria Parade, Suva"
                    value={pickupCustomAddress}
                    onChange={(e) => setPickupCustomAddress(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl text-xs font-bold text-neutral-900 outline-none focus:ring-1 focus:ring-[#0066cc]"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pickup time slot and extra instructions */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-neutral-450 block font-bold">Target Time Slot</label>
              <select
                value={pickupTimeSlot}
                onChange={(e) => setPickupTimeSlot(e.target.value)}
                className="w-full p-2 bg-white border border-neutral-200 rounded-lg text-[11px] font-black text-neutral-800"
              >
                {TIME_SLOTS.map(t => (
                  <option key={t.id} value={t.id}>{t.label.split(' (')[0]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-neutral-450 block font-bold">Courier Notes</label>
              <input
                type="text"
                placeholder="Gate code, loading dock etc"
                value={pickupNotes}
                onChange={(e) => setPickupNotes(e.target.value)}
                className="w-full p-2 bg-white border border-neutral-200 rounded-lg text-[11px] font-medium text-neutral-800"
              />
            </div>
          </div>
        </div>

        {/* DROPOFF SECTION */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-black tracking-widest text-[#ff4f3a] flex items-center gap-1">
              <span>🔴</span> Dropoff Logistics
            </span>
            <div className="flex bg-neutral-200 p-0.5 rounded-lg text-[9px] font-bold">
              <button
                type="button"
                onClick={() => setDropoffType('preset')}
                className={`px-2 py-1 rounded-md transition ${dropoffType === 'preset' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500'}`}
              >
                Depots
              </button>
              <button
                type="button"
                onClick={() => setDropoffType('custom')}
                className={`px-2 py-1 rounded-md transition ${dropoffType === 'custom' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500'}`}
              >
                Custom Address
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {dropoffType === 'preset' ? (
              <motion.div
                key="preset-dropoff"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="space-y-2"
              >
                <label className="text-[10px] text-neutral-450 block font-bold">Select Return Point</label>
                <div className="space-y-2">
                  {PRESET_LOCATIONS.map((loc) => {
                    const isSelected = dropoffLocationId === loc.id;
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => setDropoffLocationId(loc.id)}
                        className={`w-full p-3 rounded-xl border text-left flex items-start gap-2.5 transition ${
                          isSelected 
                            ? 'bg-white border-[#ff4f3a] outline outline-1 outline-[#ff4f3a] shadow-xs' 
                            : 'bg-white/80 border-neutral-150 hover:border-neutral-250 hover:bg-white'
                        }`}
                      >
                        <span className="text-lg">{loc.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-neutral-900 truncate leading-snug">{loc.name}</p>
                          <p className="text-[10px] text-neutral-400 truncate mt-0.5">{loc.address}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="custom-dropoff"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="space-y-2"
              >
                <label className="text-[10px] text-neutral-450 block font-bold">Enter Custom return Address / Venue</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3.5 text-neutral-400">📍</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Fiji National University, Queens Highway, Nadi"
                    value={dropoffCustomAddress}
                    onChange={(e) => setDropoffCustomAddress(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-neutral-200 rounded-xl text-xs font-bold text-neutral-900 outline-none focus:ring-1 focus:ring-[#ff4f3a]"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dropoff time slot and extra instructions */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-neutral-450 block font-bold">Target Time Slot</label>
              <select
                value={dropoffTimeSlot}
                onChange={(e) => setDropoffTimeSlot(e.target.value)}
                className="w-full p-2 bg-white border border-neutral-200 rounded-lg text-[11px] font-black text-neutral-800"
              >
                {TIME_SLOTS.map(t => (
                  <option key={t.id} value={t.id}>{t.label.split(' (')[0]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-neutral-450 block font-bold">Return Instructions</label>
              <input
                type="text"
                placeholder="Leave with keybox, checkin, etc"
                value={dropoffNotes}
                onChange={(e) => setDropoffNotes(e.target.value)}
                className="w-full p-2 bg-white border border-neutral-200 rounded-lg text-[11px] font-medium text-neutral-800"
              />
            </div>
          </div>
        </div>
      </div>

      {/* DYNAMIC ITINERARY & VISUAL SCHEMATICS COMPONENT */}
      <div className="p-5 bg-white rounded-3xl border border-neutral-150 space-y-4">
        {/* Dynamic Schema Illustration */}
        <div className="relative bg-neutral-900 h-28 rounded-2xl overflow-hidden flex items-center justify-between px-6 sm:px-12 border border-neutral-950">
          <div className="absolute inset-0 bg-radial-gradient from-transparent to-neutral-950 opacity-60" />
          
          {/* Animated radar rings and grid scan lines */}
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:100%_8px] pointer-events-none" />
          
          {/* Track line connector */}
          <div className="absolute left-16 right-16 top-1/2 h-0.5 border-t border-dashed border-neutral-700 -translate-y-1/2 pointer-events-none" />
          
          {distance > 0 && !sameLocation && (
            <motion.div 
              initial={{ left: '15%' }}
              animate={{ left: '85%' }}
              transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
              className="absolute top-1/2 -translate-y-1.5 w-3 h-3 bg-emerald-500 rounded-full blur-xs shadow-[0_0_10px_#10b981]"
            />
          )}

          {/* Node 1: Pickup */}
          <div className="relative z-10 flex flex-col items-center space-y-1 text-center">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500 text-blue-400 flex items-center justify-center font-black text-sm">
              🏁
            </div>
            <div className="max-w-[100px]">
              <p className="text-[9px] font-black uppercase text-blue-400 tracking-tight block truncate">
                {pickupType === 'preset' ? PRESET_LOCATIONS.find(l => l.id === pickupLocationId)?.city : 'CUSTOM'}
              </p>
              <p className="text-[8px] font-mono text-neutral-500 truncate block">
                {TIME_SLOTS.find(t => t.id === pickupTimeSlot)?.label.split(' ')[0]}
              </p>
            </div>
          </div>

          {/* Middle Stats Route Indicator */}
          <div className="relative z-10 flex flex-col items-center space-y-1">
            <span className="text-[8px] bg-neutral-800 text-neutral-300 font-extrabold px-2.5 py-1 rounded-full border border-neutral-700 tracking-widest uppercase">
              {sameLocation ? 'SAME DEPOT COLLECT' : `${distance} KM DISTANCE`}
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-neutral-400">⏱️ Est. Transit:</span>
              <span className="text-[10px] font-mono font-black text-emerald-400">
                {sameLocation ? 'Self-Serve (0 mins)' : `${Math.ceil(distance * 1.35)} mins`}
              </span>
            </div>
          </div>

          {/* Node 2: Dropoff */}
          <div className="relative z-10 flex flex-col items-center space-y-1 text-center">
            <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500 text-red-500 flex items-center justify-center font-black text-sm">
              🛑
            </div>
            <div className="max-w-[100px]">
              <p className="text-[9px] font-black uppercase text-red-400 tracking-tight block truncate">
                {dropoffType === 'preset' ? PRESET_LOCATIONS.find(l => l.id === dropoffLocationId)?.city : 'CUSTOM'}
              </p>
              <p className="text-[8px] font-mono text-neutral-500 truncate block">
                {TIME_SLOTS.find(t => t.id === dropoffTimeSlot)?.label.split(' ')[0]}
              </p>
            </div>
          </div>
        </div>

        {/* Text descriptions and dynamic price quote details */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left border-t border-neutral-100 pt-3">
          <div className="space-y-1 max-w-md">
            <h5 className="text-[11px] font-black uppercase text-neutral-800 flex items-center gap-1">
              <span>📋</span> Active Rental Route Log
            </h5>
            <p className="text-[10px] text-neutral-500 font-medium leading-relaxed">
              Gear leaves <strong className="text-neutral-800">"{activePickupName}"</strong> is scheduled for dropoff back at <strong className="text-neutral-800">"{activeDropoffName}"</strong>.
            </p>
          </div>
          
          <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-200 flex items-center gap-3 shrink-0">
            <div className="text-right">
              <span className="text-[8px] text-neutral-450 uppercase font-black tracking-widest block">Transit Carrier Payout</span>
              <strong className="text-sm font-black text-neutral-900 font-mono">
                {sameLocation ? 'FJ$ 0.00' : `FJ$ ${estimatedCost}`}
              </strong>
            </div>
            <div className="w-7 h-7 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-600 flex items-center justify-center">
              <Truck size={14} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
