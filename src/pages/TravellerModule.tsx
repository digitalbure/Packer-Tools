import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc } from 'firebase/firestore';
import { 
  Globe, 
  Sparkles, 
  Plane, 
  MapPin, 
  Calendar, 
  Briefcase, 
  Check, 
  Clock, 
  TrendingUp, 
  AlertOctagon, 
  ArrowRight,
  ShieldAlert,
  Sliders,
  Trash2,
  Plus
} from 'lucide-react';
import { db } from '../firebase';
import { UserProfile, AdminSettings, Reminder } from '../types';
import { toast } from 'sonner';

interface TravellerModuleProps {
  user: UserProfile;
  adminSettings: AdminSettings | null;
}

interface ItineraryDay {
  dayNumber: number;
  title: string;
  activities: string[];
}

interface TravelChecklistSuggestion {
  name: string;
  category: string;
  reason: string;
  quantity: number;
  weightGrams: number; // For Flight Weight Analyzer
  included: boolean;
}

interface TravelReminder {
  dueDateOffsetDays: number;
  title: string;
  message: string;
  sync: boolean;
}

export default function TravellerModule({ user, adminSettings }: TravellerModuleProps) {
  const navigate = useNavigate();
  
  // States
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [purpose, setPurpose] = useState('Photography shoot');
  const [climate, setClimate] = useState('Warm & Tropical');
  const [transport, setTransport] = useState('Commercial Flight');

  const [isGenerating, setIsGenerating] = useState(false);
  const [aiWarningMessage, setAiWarningMessage] = useState('');

  // Sourced AI results
  const [itineraryDays, setItineraryDays] = useState<ItineraryDay[]>([]);
  const [packingList, setPackingList] = useState<TravelChecklistSuggestion[]>([]);
  const [reminders, setReminders] = useState<TravelReminder[]>([]);

  // Suitcase Limit Parameter
  const SUITCASE_LIMIT_KG = 23; 
  const DEFAULT_SUITCASE_SHELL_WEIGHT_KG = 3.5; 

  // Helper calculation for flight weight solver
  const computeTotalCheckedWeight = () => {
    const itemsWeight = packingList
      .filter(i => i.included)
      .reduce((acc, curr) => acc + (curr.weightGrams * curr.quantity), 0) / 1000; // to kg
    return parseFloat((itemsWeight + DEFAULT_SUITCASE_SHELL_WEIGHT_KG).toFixed(2));
  };

  const handleApplyPreset = (dest: string, purp: string, clim: string, trans: string) => {
    setDestination(dest);
    setPurpose(purp);
    setClimate(clim);
    setTransport(trans);
    
    // Set mock dates starting week from today
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 7);
    const inAWeek = new Date();
    inAWeek.setDate(inAWeek.getDate() + 11);
    
    setStartDate(tomorrow.toISOString().split('T')[0]);
    setEndDate(inAWeek.toISOString().split('T')[0]);
    toast.info(`Travel template loaded: ${dest}`);
  };

  const handleGenerateItinerary = async () => {
    if (!destination.trim()) {
      toast.warning("Specify destination (e.g., 'Nadi, Fiji' or 'Paris, France') before proceeding.");
      return;
    }
    if (!startDate || !endDate) {
      toast.warning("Select Departure and Return dates to calculate schedule times.");
      return;
    }

    setIsGenerating(true);
    setAiWarningMessage('');
    setItineraryDays([]);
    setPackingList([]);
    setReminders([]);

    try {
      const response = await fetch('/api/generate-travel-itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination,
          startDate,
          endDate,
          purpose,
          climate,
          transport
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.aiWarning) {
        setAiWarningMessage(data.aiWarning);
      }

      setItineraryDays(data.itineraryDays || []);
      
      // Map suggested checklist with automated estimated weights
      const mappedChecklist: TravelChecklistSuggestion[] = (data.packingChecklist || []).map((item: any) => {
        let weightG = 250; // standard item
        const nameL = item.name.toLowerCase();
        
        if (nameL.includes("camera") || nameL.includes("body")) weightG = 800;
        else if (nameL.includes("lens") || nameL.includes("focal")) weightG = 700;
        else if (nameL.includes("charger") || nameL.includes("power")) weightG = 300;
        else if (nameL.includes("jacket") || nameL.includes("coat")) weightG = 1200;
        else if (nameL.includes("boot") || nameL.includes("shoe")) weightG = 1000;
        else if (nameL.includes("passport") || nameL.includes("paper")) weightG = 50;

        return {
          name: item.name || 'Essential travel item',
          category: item.category || 'Accessories',
          reason: item.reason || 'Requested travel necessity.',
          quantity: item.quantity || 1,
          weightGrams: weightG,
          included: true
        };
      });

      setPackingList(mappedChecklist);

      const mappedReminders: TravelReminder[] = (data.reminders || []).map((item: any) => ({
        dueDateOffsetDays: item.dueDateOffsetDays || 0,
        title: item.title || 'Travel Reminder',
        message: item.message || 'Complete scheduled preparation.',
        sync: true
      }));

      setReminders(mappedReminders);
      toast.success("AI travel itinerary & packing checklist fully compiled.");
    } catch (err) {
      console.error("Traveller API call error:", err);
      toast.error("Failed to compile Travel AI. Using default tropical template guidelines.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleChecklist = (idx: number) => {
    setPackingList(prev => prev.map((item, id) => 
      id === idx ? { ...item, included: !item.included } : item
    ));
  };

  const handleUpdateChecklistItem = (idx: number, field: keyof TravelChecklistSuggestion, value: any) => {
    setPackingList(prev => prev.map((item, id) => 
      id === idx ? { ...item, [field]: value } : item
    ));
  };

  const handleAddCustomChecklistRow = () => {
    const newItem: TravelChecklistSuggestion = {
      name: 'Custom Luggage Item',
      category: 'Accessories',
      reason: 'User manual addition.',
      quantity: 1,
      weightGrams: 300,
      included: true
    };
    setPackingList(prev => [...prev, newItem]);
    toast.success("Additional custom luggage item appended.");
  };

  const handleRemoveChecklistItem = (idx: number) => {
    setPackingList(prev => prev.filter((_, id) => id !== idx));
    toast.info("Travel item dismissed.");
  };

  const handleToggleReminderSync = (idx: number) => {
    setReminders(prev => prev.map((rem, id) => 
      id === idx ? { ...rem, sync: !rem.sync } : rem
    ));
  };

  const handleCompileEverythingAndCommit = async () => {
    const activeGoods = packingList.filter(item => item.included && item.name.trim() !== '');
    if (activeGoods.length === 0) {
      toast.warning("Confirm at least one item row is verified for your suitcase list.");
      return;
    }

    try {
      // 1. Commit Travel Packing List to collection(db, 'packingLists')
      const travelListPayload = {
        ownerId: user.uid,
        ownerEmail: user.email || '',
        name: `Travel Packing: ${destination}`,
        description: `Travel payload from ${startDate} to ${endDate} for ${purpose}. Climate: ${climate}`,
        isTemplate: false,
        status: 'Active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        itemsCount: activeGoods.length
      };

      const docRef = await addDoc(collection(db, 'packingLists'), travelListPayload);
      const newListId = docRef.id;

      // 2. Add individual items
      for (let i = 0; i < activeGoods.length; i++) {
        const item = activeGoods[i];
        
        const itemPayload = {
          listId: newListId,
          name: item.name,
          quantity: item.quantity,
          status: 'pending',
          priority: 'High',
          order: i,
          reasoning: item.reason,
          category: item.category,
          estimatedWeight: item.weightGrams,
          weightUnit: 'g',
          assetTag: `TRAV-${String(Date.now()).slice(-6)}-${i}`,
          photoUrls: [],
          createdAt: new Date().toISOString()
        };

        await addDoc(collection(db, 'packingLists', newListId, 'items'), itemPayload);
      }

      // 3. Sync reminders to collection(db, 'reminders')
      const activeReminders = reminders.filter(r => r.sync);
      for (const rem of activeReminders) {
        // Calculate dynamic due date based on offset days and Departure date
        const baseDate = new Date(startDate);
        baseDate.setDate(baseDate.getDate() + rem.dueDateOffsetDays);
        
        const reminderPayload = {
          ownerId: user.uid,
          listId: newListId,
          itemName: rem.title,
          type: 'pack',
          dueDate: baseDate.toISOString().split('T')[0],
          status: 'pending',
          message: `${rem.message} / Destination: ${destination}`,
          createdAt: new Date().toISOString()
        };

        await addDoc(collection(db, 'reminders'), reminderPayload);
      }

      toast.success("Travel list compiled & reminders synchronized successfully!");
      navigate(`/list/${newListId}`);
    } catch (err) {
      console.error("Error committing travel registry documents:", err);
      toast.error("An error occurred compiling documents to Firestore.");
    }
  };

  const currentCheckedWeight = computeTotalCheckedWeight();
  const weightPercentage = Math.min(100, (currentCheckedWeight / SUITCASE_LIMIT_KG) * 100);

  return (
    <div id="traveller-workstation" className="max-w-6xl mx-auto px-4 py-8 space-y-8 text-neutral-800">
      
      {/* Visual Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-100 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-1 px-2.5 bg-neutral-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest">
              Itinerary & Logs
            </span>
            <span className="flex items-center gap-1 text-xs text-primary font-bold">
              <Globe size={14} /> Travel Companion Module
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-neutral-900">
            Traveller Hub
          </h1>
          <p className="text-sm text-neutral-500 mt-1 max-w-2xl">
            Streamline your routes, pack optimal gear list configurations, monitor checked aviation weight limits, and schedule alerts relative to your departure dates.
          </p>
        </div>

        {/* Airport Quick Templates */}
        <div className="flex gap-2.5 flex-wrap shrink-0">
          <button 
            onClick={() => handleApplyPreset("Nadi, Fiji", "Tropical Photography Shoot", "Warm & Tropical", "Flight to Fiji (FJ-781)")}
            className="p-2.5 px-4 bg-white border border-neutral-200 rounded-xl hover:border-neutral-900 text-xs font-bold transition shadow-sm inline-flex items-center gap-1.5"
          >
            🏝️ Fiji Trip
          </button>
          <button 
            onClick={() => handleApplyPreset("Paris, France", "Leisure / City Explorations", "Wet & Rainy", "High-Speed Rail TGV")}
            className="p-2.5 px-4 bg-white border border-neutral-200 hover:border-neutral-900 rounded-xl text-xs font-bold transition shadow-sm inline-flex items-center gap-1.5"
          >
            🗼 Paris Rail
          </button>
        </div>
      </div>

      {/* Main Parameters Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Input specifications Panel */}
        <div className="lg:col-span-4 bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm space-y-5">
          <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400">
            Trip Parameters
          </h3>

          <div className="space-y-4">
            {/* Destination inputs */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                Where are you traveling to?
              </label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-3.5 text-neutral-400" size={16} />
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. Suva, Fiji or Tokyo, Japan"
                  className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-250 rounded-xl focus:bg-white focus:outline-none focus:border-neutral-900 text-xs font-bold text-neutral-800"
                />
              </div>
            </div>

            {/* Travel schedule */}
            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                  Departure Date
                </label>
                <div className="relative">
                  <Calendar className="absolute right-3 top-3 text-neutral-400 pointer-events-none" size={14} />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full pr-8 pl-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold focus:bg-white focus:outline-none focus:border-neutral-900"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                  Return Date
                </label>
                <div className="relative">
                  <Calendar className="absolute right-3 top-3 text-neutral-400 pointer-events-none" size={14} />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full pr-8 pl-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold focus:bg-white focus:outline-none focus:border-neutral-900"
                  />
                </div>
              </div>
            </div>

            {/* Purpose */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                Travel Purpose / Mission
              </label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold focus:bg-white focus:outline-none focus:border-neutral-900"
              >
                <option value="Photography shoot">🎥 Photography & Pro Media shoot</option>
                <option value="Leisure Holiday">🌴 Leisure / Holiday adventure</option>
                <option value="Business seminar">💼 Corporate Business Seminar</option>
                <option value="Outdoors expedition">🏕️ Mountain Wilderness Expedition</option>
              </select>
            </div>

            {/* Weather / Climate */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                Expected Weather Climate
              </label>
              <select
                value={climate}
                onChange={(e) => setClimate(e.target.value)}
                className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold focus:bg-white focus:outline-none focus:border-neutral-900"
              >
                <option value="Warm & Tropical">☀️ Warm, Sunny & Tropical climates</option>
                <option value="Cool & Mountainous">🌲 Windy, Cool Mountain altitudes</option>
                <option value="Snowy & Freezing">❄️ Winter / Snowy & Freezing blocks</option>
                <option value="Wet & Rainy">🌧️ Heavy Monsoon / Wet and Rainy days</option>
              </select>
            </div>

            {/* Transport type */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                Mode of Transport
              </label>
              <select
                value={transport}
                onChange={(e) => setTransport(e.target.value)}
                className="w-full p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold focus:bg-white focus:outline-none focus:border-neutral-900"
              >
                <option value="Commercial Flight">✈️ International Commercial Flight</option>
                <option value="Car Roadtrip">🚗 Interstate Car Roadtrip / Highway</option>
                <option value="High-Speed Rail">🚄 Express high-speed rail / Train route</option>
                <option value="Cargo Ferry">🚢 Sea ferry cargo boat / Vessel transits</option>
              </select>
            </div>

            <button
              onClick={handleGenerateItinerary}
              disabled={isGenerating}
              className="w-full flex items-center justify-center gap-2 bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-100 disabled:text-neutral-400 py-3 rounded-xl font-black text-xs shadow transition mt-2"
            >
              {isGenerating ? (
                <>
                  <span className="h-3 w-3 border-2 border-neutral-300 border-t-neutral-800 animate-spin rounded-full inline-block" />
                  Analyzing Travel Logs...
                </>
              ) : (
                <>
                  <Sparkles size={14} /> Calculate Schedule & Payload
                </>
              )}
            </button>
          </div>
        </div>

        {/* AI Travel Outputs timeline */}
        <div className="lg:col-span-8 bg-neutral-50/50 outline outline-1 outline-neutral-200/60 rounded-3xl p-6 min-h-[400px] flex flex-col justify-between">
          
          {itineraryDays.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3.5 my-auto">
              <div className="w-14 h-14 bg-white border border-neutral-200 text-neutral-400 rounded-2xl flex items-center justify-center shadow-sm">
                <Globe size={24} />
              </div>
              <h4 className="font-extrabold text-neutral-900 text-sm">Travel Canvas Idle</h4>
              <p className="text-xs text-neutral-400 max-w-sm leading-relaxed">
                Enter your schedule parameters on the left to synthesize personalized transport itineraries, luggage checklist matches, and reminders setup.
              </p>
            </div>
          ) : (
            <div className="space-y-8 animate-fade-in">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-neutral-900">
                    Day-By-Day Itinerary Planner
                  </h3>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Suggested high-efficiency scheduling loops compiled for: <b className="text-neutral-700">{destination}</b>
                  </p>
                </div>
                {aiWarningMessage && (
                  <span className="p-1 px-2.5 bg-orange-50 border border-orange-100 text-orange-700 text-[9px] font-black uppercase tracking-wide rounded-full shrink-0">
                    Offline Presets
                  </span>
                )}
              </div>

              {/* Day rows timeline */}
              <div className="relative border-l-2 border-neutral-200 pl-6 ml-3.5 space-y-7 pb-2">
                {itineraryDays.map((day) => (
                  <div key={day.dayNumber} className="relative space-y-2">
                    {/* Circle marker */}
                    <div className="absolute -left-[31px] top-1.5 w-4.5 h-4.5 bg-neutral-900 text-white border-2 border-white rounded-full flex items-center justify-center text-[9px] font-black">
                      {day.dayNumber}
                    </div>

                    <h4 className="text-xs font-black text-neutral-900 uppercase tracking-tight">
                      Day {day.dayNumber}: {day.title}
                    </h4>

                    <ul className="space-y-1.5 pl-2">
                      {day.activities.map((act, aIdx) => (
                        <li key={aIdx} className="text-xs text-neutral-500 leading-relaxed list-disc list-outside ml-3.5">
                          {act}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prompt warning if matching AI */}
          {itineraryDays.length > 0 && aiWarningMessage && (
            <div className="border-t border-neutral-100/80 pt-4 text-[10px] text-orange-600 font-bold italic leading-relaxed">
              ⚠️ {aiWarningMessage}
            </div>
          )}
        </div>
      </div>

      {/* Checklist, Suitcase Solver & Reminders */}
      {packingList.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">

          {/* Checklist column - 7 cols */}
          <div className="lg:col-span-7 bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-neutral-900">
                  Recommended Travel Packlist
                </h3>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Suggested essentials for this transport mode and climate.
                </p>
              </div>

              <button
                onClick={handleAddCustomChecklistRow}
                className="p-1 px-3 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg text-[11px] font-bold text-neutral-600 inline-flex items-center gap-1 transition"
              >
                <Plus size={12} /> Add Row
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-100 text-[9px] font-black uppercase tracking-widest text-neutral-400">
                    <th className="py-2.5 px-1 w-10">Use</th>
                    <th className="py-2.5 px-3 min-w-[140px]">Item specifications</th>
                    <th className="py-2.5 px-3 w-20 text-center">Qty</th>
                    <th className="py-2.5 px-3 w-28">Est Weight</th>
                    <th className="py-2.5 px-1 text-right w-10">Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {packingList.map((item, idx) => (
                    <tr 
                      key={idx}
                      className={`border-b border-neutral-100 text-xs hover:bg-neutral-50/50 transition-colors ${
                        !item.included ? 'opacity-40' : ''
                      }`}
                    >
                      <td className="py-3 px-1">
                        <button
                          onClick={() => handleToggleChecklist(idx)}
                          className={`w-4.5 h-4.5 rounded border flex items-center justify-center transition-all ${
                            item.included 
                              ? 'bg-neutral-900 border-neutral-900 text-white' 
                              : 'border-neutral-300 hover:border-neutral-900'
                          }`}
                        >
                          {item.included && <Check size={10} strokeWidth={3} />}
                        </button>
                      </td>

                      <td className="py-3 px-3 space-y-0.5">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleUpdateChecklistItem(idx, 'name', e.target.value)}
                          className="font-bold text-neutral-800 bg-transparent focus:outline-none w-full border-b border-transparent hover:border-neutral-200 focus:border-neutral-900"
                        />
                        <div className="text-[10px] text-neutral-400 block truncate" title={item.reason}>
                          {item.reason}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <input
                          type="number"
                          min="1"
                          max="99"
                          value={item.quantity}
                          onChange={(e) => handleUpdateChecklistItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-12 p-1 border border-neutral-200 text-center rounded bg-neutral-50 font-bold focus:bg-white"
                        />
                      </td>

                      <td className="py-3 px-1.5 focus-within:z-10">
                        <div className="flex items-center gap-1.5 bg-neutral-50 border border-neutral-250 p-1 px-2 rounded-lg max-w-[90px]">
                          <input
                            type="number"
                            value={item.weightGrams}
                            onChange={(e) => handleUpdateChecklistItem(idx, 'weightGrams', parseInt(e.target.value) || 0)}
                            className="w-12 text-center bg-transparent text-[11px] font-bold focus:outline-none focus:text-neutral-900 text-neutral-700"
                          />
                          <span className="text-[10px] text-neutral-400 font-bold">g</span>
                        </div>
                      </td>

                      <td className="py-3 px-1 text-right">
                        <button
                          onClick={() => handleRemoveChecklistItem(idx)}
                          className="text-neutral-450 hover:text-red-500 p-1 rounded-md"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>

          {/* Suitcase solver weight progress & Reminders Tab - 5 cols */}
          <div className="lg:col-span-5 space-y-8">
            
            {/* Checked Suitcase Analyzer */}
            <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400">
                Cabin Case Weight Analyzer
              </h3>

              <div className="space-y-3 p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs text-neutral-500">Suite Checked Payload</span>
                    <span className="text-2xl font-black text-neutral-905">{currentCheckedWeight} kg</span>
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] text-neutral-400">Standard Airline Limit</span>
                    <span className="text-xs font-black text-neutral-700">{SUITCASE_LIMIT_KG}.0 kg</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-neutral-200 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 rounded-full ${
                      currentCheckedWeight > SUITCASE_LIMIT_KG
                        ? 'bg-rose-500 animate-pulse'
                        : currentCheckedWeight >= SUITCASE_LIMIT_KG - 3
                        ? 'bg-orange-400'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${weightPercentage}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-neutral-400">Bag Shell Base: {DEFAULT_SUITCASE_SHELL_WEIGHT_KG}kg</span>
                  
                  {currentCheckedWeight > SUITCASE_LIMIT_KG ? (
                    <span className="text-rose-600 block shrink-0 flex items-center gap-1">
                      <ShieldAlert size={12} /> OVERWEIGHT LIMIT
                    </span>
                  ) : (
                    <span className="text-emerald-600 block shrink-0 flex items-center gap-0.5">
                      <Check size={12} strokeWidth={3} /> Cargo parameters within guidelines
                    </span>
                  )}
                </div>
              </div>

            </div>

            {/* Travel-specific Reminders module */}
            <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400">
                  Pre-Departure Alerts Setup
                </h3>
                <span className="text-[9px] text-neutral-400 font-bold uppercase tracking-widest bg-neutral-100 p-0.5 px-1.5 rounded">
                  Firestore Sync
                </span>
              </div>

              <div className="space-y-4">
                {reminders.map((rem, idx) => (
                  <div 
                    key={idx} 
                    className={`p-4 bg-neutral-50 border border-neutral-100 rounded-2xl flex items-start gap-3 transition-opacity ${
                      !rem.sync ? 'opacity-40' : ''
                    }`}
                  >
                    <button
                      onClick={() => handleToggleReminderSync(idx)}
                      className={`w-4.5 h-4.5 rounded border mt-0.5 shrink-0 flex items-center justify-center transition ${
                        rem.sync 
                          ? 'bg-neutral-900 border-neutral-900 text-white' 
                          : 'border-neutral-300 hover:border-neutral-900 bg-white'
                      }`}
                    >
                      {rem.sync && <Check size={10} strokeWidth={3} />}
                    </button>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-neutral-900">
                          {rem.title}
                        </span>
                        <span className="text-[9px] font-bold p-0.5 px-1.5 rounded bg-neutral-200 text-neutral-600">
                          {rem.dueDateOffsetDays === 0 
                            ? 'Departure Day' 
                            : rem.dueDateOffsetDays > 0 
                            ? `+${rem.dueDateOffsetDays} Days`
                            : `${rem.dueDateOffsetDays} Days`}
                        </span>
                      </div>
                      <p className="text-[10px] text-neutral-500 leading-relaxed">
                        {rem.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

            </div>

            {/* Grand Action buttons */}
            <div className="flex flex-col gap-3.5 pt-2">
              <button
                onClick={handleCompileEverythingAndCommit}
                className="w-full flex items-center justify-center gap-2 bg-neutral-950 text-white hover:bg-neutral-900 py-3 rounded-2xl font-black text-xs shadow-lg transform hover:-translate-y-0.5 transition"
              >
                <Check size={14} strokeWidth={3} /> Commit to Packer Tools Packing-Lists
              </button>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
