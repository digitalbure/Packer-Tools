import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  Plane, 
  FileSpreadsheet, 
  AlertTriangle, 
  CheckCircle2, 
  Download, 
  RefreshCw, 
  Sparkles, 
  Printer, 
  Edit2, 
  Check, 
  X, 
  TrendingUp, 
  ShieldAlert, 
  HelpCircle,
  Briefcase
} from 'lucide-react';
import { doc, updateDoc, getDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { PackingList, PackingItem } from '../types';
import { motion } from 'motion/react';
import { toast } from 'sonner';

interface CarnetWidgetProps {
  list: PackingList;
  items: PackingItem[];
  onUpdateItem: (itemId: string, updatedFields: Partial<PackingItem>) => Promise<void>;
  isOwner: boolean;
}

// Common HS Code patterns for mapping and suggestion
const COMMON_HS_CODES: { [key: string]: { code: string; desc: string } } = {
  camera: { code: '8525.89.3000', desc: 'Digital television cameras and video camera recorders' },
  lens: { code: '9002.11.9000', desc: 'Objective lenses for cameras, projectors or photographic enlargers' },
  light: { code: '9405.42.8400', desc: 'LED lighting equipment for photography and video' },
  tripod: { code: '9620.00.1500', desc: 'Monopods, bipods, tripods and similar articles of plastics' },
  battery: { code: '8507.60.0000', desc: 'Lithium-ion accumulators (rechargeable batteries)' },
  cable: { code: '8544.42.9090', desc: 'Insulated electric conductors for voltage not exceeding 1,000 V' },
  audio: { code: '8518.10.0000', desc: 'Microphones and stands therefor; loudspeakers' },
  monitor: { code: '8528.52.0000', desc: 'Flat panel video monitors capable of direct connection to computer' },
  case: { code: '4202.12.2020', desc: 'Structured flight cases, briefcases, camera cases of plastics/textiles' },
  wireless: { code: '8517.62.0050', desc: 'Machines for the reception, conversion and transmission of voice/images' },
  harness: { code: '6307.90.9891', desc: 'Safety harness and climbing straps of textile materials' },
  drill: { code: '8467.21.0010', desc: 'Hand-held rotary drills with self-contained electric motor' },
  sensor: { code: '9031.80.8085', desc: 'Measuring or checking instruments, appliances and machines' },
  ventilator: { code: '9019.20.0000', desc: 'Ozone therapy, oxygen therapy, aerosol therapy, artificial respiration apparatus' },
};

export default function CarnetWidget({ list, items, onUpdateItem, isOwner }: CarnetWidgetProps) {
  const [carnetHolder, setCarnetHolder] = useState(list.customFields?.carnetHolder || '');
  const [carnetNumber, setCarnetNumber] = useState(list.customFields?.carnetNumber || '');
  const [carnetAssociation, setCarnetAssociation] = useState(list.customFields?.carnetAssociation || 'USCIB (United States Council for International Business)');
  const [carnetDestination, setCarnetDestination] = useState(list.customFields?.carnetDestination || '');
  const [carnetPurpose, setCarnetPurpose] = useState(list.customFields?.carnetPurpose || 'Professional Equipment');
  
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [isSyncingWithLibrary, setIsSyncingWithLibrary] = useState(false);
  const [isSuggestingHSCodes, setIsSuggestingHSCodes] = useState(false);
  
  // Local state for inline item updates to prevent lag
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<{
    serialNumber?: string;
    price?: number;
    countryOfOrigin?: string;
    hsCode?: string;
    weight?: number;
    weightUnit?: 'g' | 'kg' | 'oz' | 'lb';
  }>({});

  // Bulk operation states
  const [bulkOrigin, setBulkOrigin] = useState('');
  const [showBulkOriginModal, setShowBulkOriginModal] = useState(false);

  // Sync state when list props change
  useEffect(() => {
    if (list.customFields) {
      setCarnetHolder(list.customFields.carnetHolder || '');
      setCarnetNumber(list.customFields.carnetNumber || '');
      setCarnetAssociation(list.customFields.carnetAssociation || 'USCIB (United States Council for International Business)');
      setCarnetDestination(list.customFields.carnetDestination || '');
      setCarnetPurpose(list.customFields.carnetPurpose || 'Professional Equipment');
    }
  }, [list]);

  const handleSaveMetadata = async () => {
    try {
      const listRef = doc(db, 'packingLists', list.id);
      await updateDoc(listRef, {
        'customFields.carnetHolder': carnetHolder,
        'customFields.carnetNumber': carnetNumber,
        'customFields.carnetAssociation': carnetAssociation,
        'customFields.carnetDestination': carnetDestination,
        'customFields.carnetPurpose': carnetPurpose,
      });
      setIsEditingMetadata(false);
      toast.success('Carnet trip details updated successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update carnet details.');
    }
  };

  const handleStartEditingItem = (item: PackingItem) => {
    setEditingItemId(item.id);
    setEditFields({
      serialNumber: item.serialNumber || '',
      price: item.price || 0,
      countryOfOrigin: item.countryOfOrigin || 'US',
      hsCode: item.hsCode || '',
      weight: item.weight || 0,
      weightUnit: item.weightUnit || 'kg'
    });
  };

  const handleSaveItemChanges = async (itemId: string) => {
    try {
      await onUpdateItem(itemId, editFields);
      setEditingItemId(null);
      toast.success('Customs details updated!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save item changes.');
    }
  };

  // Auto-Fill from main gear library
  const handleAutoFillFromLibrary = async () => {
    setIsSyncingWithLibrary(true);
    let successCount = 0;
    try {
      const gearRef = collection(db, 'gear');
      const gearSnap = await getDocs(gearRef);
      const gearMap = new Map<string, any>();
      gearSnap.forEach(d => gearMap.set(d.id, d.data()));

      for (const item of items) {
        if (item.gearId && gearMap.has(item.gearId)) {
          const gearItem = gearMap.get(item.gearId);
          const updates: Partial<PackingItem> = {};
          
          if (!item.serialNumber && gearItem.serialNumber) updates.serialNumber = gearItem.serialNumber;
          if (!item.price && gearItem.price) updates.price = gearItem.price;
          if (!item.weight && gearItem.weight) {
            updates.weight = gearItem.weight;
            updates.weightUnit = gearItem.weightUnit || 'kg';
          }
          if (!item.countryOfOrigin) updates.countryOfOrigin = 'US'; // Default back to US if missing

          if (Object.keys(updates).length > 0) {
            await onUpdateItem(item.id, updates);
            successCount++;
          }
        }
      }

      if (successCount > 0) {
        toast.success(`Synchronized ${successCount} items from your main Gear Library!`);
      } else {
        toast.info('No missing details found or matched with existing library items.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error auto-filling from Gear Library.');
    } finally {
      setIsSyncingWithLibrary(false);
    }
  };

  // AI HS Code Suggester (Maps items based on keywords)
  const handleSuggestHSCodes = async () => {
    setIsSuggestingHSCodes(true);
    let successCount = 0;
    try {
      for (const item of items) {
        if (!item.hsCode) {
          const nameLower = item.name.toLowerCase();
          let matchedCode = '';
          
          // Match keywords
          for (const [key, val] of Object.entries(COMMON_HS_CODES)) {
            if (nameLower.includes(key)) {
              matchedCode = val.code;
              break;
            }
          }

          // Fallback camera accessories
          if (!matchedCode && (nameLower.includes('accessory') || nameLower.includes('adapter') || nameLower.includes('rig') || nameLower.includes('mount'))) {
            matchedCode = '9002.11.9000'; // General Camera attachments
          }

          // Fallback electronics
          if (!matchedCode && (nameLower.includes('wireless') || nameLower.includes('transmitter') || nameLower.includes('receiver') || nameLower.includes('antenna'))) {
            matchedCode = '8517.62.0050';
          }

          if (matchedCode) {
            await onUpdateItem(item.id, { hsCode: matchedCode });
            successCount++;
          }
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully suggested and updated HS codes for ${successCount} items!`);
      } else {
        toast.info('All items already have HS codes, or no matches were found.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to suggest HS codes.');
    } finally {
      setIsSuggestingHSCodes(false);
    }
  };

  // Bulk Apply Origin Country to all items in list
  const handleApplyBulkOrigin = async () => {
    if (!bulkOrigin.trim()) {
      toast.error('Please specify a valid Country of Origin.');
      return;
    }
    
    try {
      // Direct Firestore batch updates to scale to 500 items comfortably
      const batch = writeBatch(db);
      let count = 0;
      
      for (const item of items) {
        const itemRef = doc(db, 'packingLists', list.id, 'items', item.id);
        batch.update(itemRef, { countryOfOrigin: bulkOrigin.toUpperCase().trim() });
        count++;
      }

      await batch.commit();
      toast.success(`Set Country of Origin to "${bulkOrigin.toUpperCase()}" for all ${count} items!`);
      setShowBulkOriginModal(false);
      setBulkOrigin('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to apply bulk origin country.');
    }
  };

  // CSV Generator for official Chamber of Commerce / Customs ATA Carnet list
  const handleExportCarnetCSV = () => {
    try {
      const headers = [
        'Item Number',
        'Description of Goods',
        'Trade Name / Brand & Model',
        'Serial Number / Identification Marks',
        'Number of Pieces',
        'Weight (kg)',
        'Value (USD)',
        'Country of Origin (ISO Code)',
        'HS Code'
      ];

      const rows = items.map((item, idx) => {
        // Convert ounces/lbs/grams to standard KG for customs consistency
        let weightKg = item.weight || 0;
        if (item.weightUnit === 'g') weightKg = weightKg / 1000;
        else if (item.weightUnit === 'lb') weightKg = weightKg * 0.45359237;
        else if (item.weightUnit === 'oz') weightKg = weightKg * 0.02834952;

        return [
          idx + 1,
          item.name || '',
          item.description || item.notes || 'Professional Gear',
          item.serialNumber || 'N/S (NO SERIAL)',
          1,
          weightKg.toFixed(3),
          item.price || 0,
          item.countryOfOrigin || 'US',
          item.hsCode || '8525.80' // default photographic gear classification
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(val => {
          const str = String(val).replace(/"/g, '""');
          return str.includes(',') || str.includes('\n') || str.includes('"') ? `"${str}"` : str;
        }).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${list.name.toLowerCase().replace(/\s+/g, '_')}_ata_carnet_manifest.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Customs-ready ATA Carnet manifest CSV downloaded!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to generate Carnet CSV.');
    }
  };

  // Calculations
  const totalValue = items.reduce((sum, item) => sum + (item.price || 0), 0);
  const totalWeightKg = items.reduce((sum, item) => {
    let w = item.weight || 0;
    if (item.weightUnit === 'g') return sum + (w / 1000);
    if (item.weightUnit === 'lb') return sum + (w * 0.45359);
    if (item.weightUnit === 'oz') return sum + (w * 0.02835);
    return sum + w;
  }, 0);

  // Missing values verification for Customs Compliance audit
  const missingSerials = items.filter(i => !i.serialNumber);
  const missingOrigins = items.filter(i => !i.countryOfOrigin);
  const missingPrices = items.filter(i => !i.price);
  const missingHsCodes = items.filter(i => !i.hsCode);

  const complianceIssuesCount = missingSerials.length + missingOrigins.length + missingPrices.length + missingHsCodes.length;
  const isFullyCompliant = complianceIssuesCount === 0;

  return (
    <div className="space-y-8" id="carnet-travel-widget">
      
      {/* Upper Analytics & Compliance Audit Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Compliance Status Bento Card */}
        <div className="lg:col-span-4 bg-white border border-neutral-150 rounded-[2rem] p-6 shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-neutral-500/5 rounded-bl-full pointer-events-none" />
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Customs Compliance</span>
              {isFullyCompliant ? (
                <span className="bg-emerald-50 text-emerald-600 border border-emerald-200/50 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg flex items-center gap-1">
                  <CheckCircle2 size={10} /> Ready for Travel
                </span>
              ) : (
                <span className="bg-amber-50 text-amber-700 border border-amber-200/50 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg flex items-center gap-1 animate-pulse">
                  <AlertTriangle size={10} /> Audit Issues ({complianceIssuesCount})
                </span>
              )}
            </div>

            <div>
              <h4 className="text-sm font-black uppercase tracking-tight text-neutral-800">Customs Clearance Audit</h4>
              <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
                ATA Carnets require active serial numbers, purchase prices, and country of origin certifications for border clearance.
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-neutral-50 mt-6 space-y-2">
            <div className="flex justify-between items-center text-xs font-bold text-neutral-600">
              <span className="flex items-center gap-1.5"><Briefcase size={12} className="text-neutral-400" /> Total Items</span>
              <span className="font-mono text-neutral-900">{items.length}</span>
            </div>
            <div className="flex justify-between items-center text-xs font-bold text-neutral-600">
              <span className="flex items-center gap-1.5"><Globe size={12} className="text-neutral-400" /> Missing Country Origin</span>
              <span className={`font-mono ${missingOrigins.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {missingOrigins.length}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs font-bold text-neutral-600">
              <span className="flex items-center gap-1.5"><ShieldAlert size={12} className="text-neutral-400" /> Missing Serial Numbers</span>
              <span className={`font-mono ${missingSerials.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {missingSerials.length}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs font-bold text-neutral-600">
              <span className="flex items-center gap-1.5"><TrendingUp size={12} className="text-neutral-400" /> Missing Item Value</span>
              <span className={`font-mono ${missingPrices.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {missingPrices.length}
              </span>
            </div>
          </div>
        </div>

        {/* Travel Analytics Bento Card */}
        <div className="lg:col-span-4 bg-white border border-neutral-150 rounded-[2rem] p-6 shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#0066cc]/5 rounded-bl-full pointer-events-none" />
          
          <div className="space-y-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Payload Statistics</span>
            <div className="space-y-1">
              <p className="text-[10px] uppercase font-bold text-neutral-400">Total Certified Weight</p>
              <p className="text-3xl font-black tracking-tight text-neutral-900">
                {totalWeightKg.toFixed(2)} <span className="text-sm font-bold text-neutral-500">kg</span>
              </p>
              <p className="text-[10px] text-neutral-400 font-mono font-bold uppercase mt-0.5">
                ≈ {(totalWeightKg * 2.20462).toFixed(2)} lbs
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-neutral-50 mt-6 space-y-4">
            <div>
              <p className="text-[10px] uppercase font-bold text-neutral-400">Estimated Customs Declared Value</p>
              <p className="text-3xl font-black tracking-tight text-[#0066cc]">
                ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-neutral-400 font-mono font-bold uppercase mt-0.5">
                Valued under standard ATA regulations
              </p>
            </div>
          </div>
        </div>

        {/* Travel Route & Document Settings Bento Card */}
        <div className="lg:col-span-4 bg-white border border-neutral-150 rounded-[2rem] p-6 shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#F27D26]/5 rounded-bl-full pointer-events-none" />
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Carnet Passport Metadata</span>
              <button 
                onClick={() => setIsEditingMetadata(!isEditingMetadata)}
                className="text-xs font-black uppercase tracking-wider text-primary hover:underline flex items-center gap-1 focus:outline-none"
              >
                {isEditingMetadata ? <X size={12} /> : <Edit2 size={12} />}
                {isEditingMetadata ? 'Cancel' : 'Edit Travel Specs'}
              </button>
            </div>

            {isEditingMetadata ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Carnet Document Number</label>
                  <input 
                    type="text" 
                    value={carnetNumber}
                    onChange={e => setCarnetNumber(e.target.value)}
                    placeholder="e.g. US-123456"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold text-neutral-800 outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Carnet Document Holder</label>
                  <input 
                    type="text" 
                    value={carnetHolder}
                    onChange={e => setCarnetHolder(e.target.value)}
                    placeholder="e.g. Acme Productions LLC"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold text-neutral-800 outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Countries of Transit & Destination</label>
                  <input 
                    type="text" 
                    value={carnetDestination}
                    onChange={e => setCarnetDestination(e.target.value)}
                    placeholder="e.g. GB, FR, DE, JP"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-bold text-neutral-800 outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <button
                  onClick={handleSaveMetadata}
                  className="w-full bg-neutral-900 hover:bg-black text-white text-[10px] font-black uppercase tracking-widest py-2 rounded-xl transition"
                >
                  Save Trip Parameters
                </button>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <p className="text-[9px] font-black uppercase text-neutral-400">Carnet Number</p>
                  <p className="font-mono font-black text-neutral-900">{carnetNumber || 'Not Configured (Draft)'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase text-neutral-400">Document Holder</p>
                  <p className="font-bold text-neutral-800">{carnetHolder || 'Acme Logistics Partner'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase text-neutral-400">Destination Countries</p>
                  <p className="font-bold text-neutral-800 flex items-center gap-1.5">
                    <Globe size={12} className="text-primary" />
                    {carnetDestination || 'Worldwide Transit'}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase text-neutral-400">National Association</p>
                  <p className="text-[10px] text-neutral-500 font-medium leading-tight">{carnetAssociation}</p>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Tooling / Operational Actions Drawer Bar */}
      <div className="bg-white border border-neutral-150 rounded-[2rem] p-4 sm:p-6 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary">
            <Plane className="rotate-45" size={20} />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-tight text-neutral-800">Carnet Logistics Desk</h4>
            <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Automated customs paperwork formatting engine</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Apply Bulk Origin Country */}
          <button
            onClick={() => setShowBulkOriginModal(true)}
            className="bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-700 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition flex items-center gap-1.5 shadow-sm"
          >
            <Globe size={12} />
            <span>Set Bulk Origin</span>
          </button>

          {/* Sync details with Main Gear Library */}
          <button
            onClick={handleAutoFillFromLibrary}
            disabled={isSyncingWithLibrary}
            className="bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-700 disabled:opacity-50 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw size={12} className={isSyncingWithLibrary ? 'animate-spin' : ''} />
            <span>Sync from Gear Lib</span>
          </button>

          {/* AI HS Code Suggester */}
          <button
            onClick={handleSuggestHSCodes}
            disabled={isSuggestingHSCodes}
            className="bg-[#0066cc]/10 text-[#0066cc] hover:bg-[#0066cc]/20 disabled:opacity-50 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition flex items-center gap-1.5 shadow-sm"
            title="Automatically suggest international Customs HS tariff codes using smart classification"
          >
            <Sparkles size={12} className={isSuggestingHSCodes ? 'animate-bounce text-[#0066cc]' : ''} />
            <span>AI HS Suggester</span>
          </button>

          {/* Export Manifest CSV */}
          <button
            onClick={handleExportCarnetCSV}
            className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition flex items-center gap-1.5 shadow-sm"
          >
            <Download size={12} />
            <span>Export ATA Carnet CSV</span>
          </button>
        </div>
      </div>

      {/* Main Customs Manifest Ledger Sheets */}
      <div className="bg-white rounded-[2rem] border border-neutral-150 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-neutral-900" />
        
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <div>
            <h3 className="text-md font-black uppercase tracking-tight text-neutral-800">Customs Manifest General List</h3>
            <p className="text-[10px] text-neutral-400 uppercase tracking-widest font-black mt-0.5">Itemized cargo certification sheet</p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 bg-neutral-100 px-3 py-1 rounded-full font-mono">
            {items.length} Items Loaded
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-100">
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-neutral-400 w-12">No.</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-neutral-400">Description of Goods (Brand & Model)</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-neutral-400">Serial No. / Marks</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-neutral-400">HS Tariff Code</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-neutral-400 w-24">Weight</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-neutral-400 w-28 text-right">Value (USD)</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-neutral-400 w-24">Origin</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-neutral-400 w-20 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-xs font-bold text-neutral-700">
              {items.map((item, idx) => {
                const isEditing = editingItemId === item.id;
                
                return (
                  <tr key={item.id} className={`hover:bg-neutral-50/50 transition-colors ${!item.serialNumber || !item.countryOfOrigin || !item.price ? 'bg-amber-500/[0.02]' : ''}`}>
                    
                    {/* Item Number */}
                    <td className="px-6 py-4 font-mono text-[10px] text-neutral-400">
                      {(idx + 1).toString().padStart(3, '0')}
                    </td>
                    
                    {/* Description of Goods */}
                    <td className="px-6 py-4">
                      <div className="font-black text-neutral-900 leading-tight">{item.name}</div>
                      <div className="text-[10px] text-neutral-400 font-medium max-w-xs truncate mt-0.5">
                        {item.description || item.notes || 'Professional logistics asset'}
                      </div>
                    </td>

                    {/* Serial Number */}
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editFields.serialNumber || ''}
                          onChange={e => setEditFields({ ...editFields, serialNumber: e.target.value })}
                          className="bg-white border border-neutral-350 rounded-lg px-2.5 py-1.5 text-xs font-mono w-full max-w-[140px] outline-none focus:ring-1 focus:ring-primary"
                          placeholder="Serial No."
                        />
                      ) : (
                        <div className="font-mono text-xs">
                          {item.serialNumber ? (
                            <span className="text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded-md">{item.serialNumber}</span>
                          ) : (
                            <span className="text-red-500 italic bg-red-50 border border-red-100/50 px-2 py-0.5 rounded-md flex items-center gap-1 w-max">
                              <AlertTriangle size={10} /> MISSING
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* HS Tariff Code */}
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editFields.hsCode || ''}
                          onChange={e => setEditFields({ ...editFields, hsCode: e.target.value })}
                          className="bg-white border border-neutral-350 rounded-lg px-2.5 py-1.5 text-xs font-mono w-full max-w-[120px] outline-none focus:ring-1 focus:ring-primary"
                          placeholder="e.g. 8525.80"
                        />
                      ) : (
                        <div className="font-mono text-xs">
                          {item.hsCode ? (
                            <span className="text-[#0066cc] bg-[#0066cc]/5 border border-[#0066cc]/10 px-2 py-0.5 rounded-md">{item.hsCode}</span>
                          ) : (
                            <span className="text-neutral-400 font-medium italic">Pending HS</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Weight */}
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <div className="flex gap-1 items-center">
                          <input
                            type="number"
                            value={editFields.weight || 0}
                            onChange={e => setEditFields({ ...editFields, weight: parseFloat(e.target.value) || 0 })}
                            className="bg-white border border-neutral-350 rounded-lg px-2.5 py-1.5 text-xs font-bold w-16 outline-none focus:ring-1 focus:ring-primary"
                          />
                          <select
                            value={editFields.weightUnit || 'kg'}
                            onChange={e => setEditFields({ ...editFields, weightUnit: e.target.value as any })}
                            className="bg-white border border-neutral-350 rounded-lg py-1.5 text-xs font-bold outline-none"
                          >
                            <option value="kg">kg</option>
                            <option value="g">g</option>
                            <option value="lb">lb</option>
                            <option value="oz">oz</option>
                          </select>
                        </div>
                      ) : (
                        <div className="text-neutral-800">
                          {item.weight ? `${item.weight} ${item.weightUnit || 'kg'}` : '--'}
                        </div>
                      )}
                    </td>

                    {/* Price / Declared Value */}
                    <td className="px-6 py-4 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editFields.price || 0}
                          onChange={e => setEditFields({ ...editFields, price: parseFloat(e.target.value) || 0 })}
                          className="bg-white border border-neutral-350 rounded-lg px-2.5 py-1.5 text-xs font-bold w-20 text-right outline-none focus:ring-1 focus:ring-primary"
                          placeholder="0.00"
                        />
                      ) : (
                        <div className="font-mono text-neutral-900">
                          {item.price ? (
                            `$${item.price.toFixed(2)}`
                          ) : (
                            <span className="text-red-500 bg-red-50 px-2 py-0.5 rounded border border-red-100/50">Missing Value</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Country of Origin */}
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editFields.countryOfOrigin || ''}
                          onChange={e => setEditFields({ ...editFields, countryOfOrigin: e.target.value.toUpperCase() })}
                          className="bg-white border border-neutral-350 rounded-lg px-2.5 py-1.5 text-xs font-bold w-16 text-center uppercase outline-none focus:ring-1 focus:ring-primary"
                          maxLength={3}
                        />
                      ) : (
                        <div className="uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-5 h-5 bg-neutral-100 rounded-md flex items-center justify-center text-[10px] font-black text-neutral-600 border border-neutral-200">
                            {item.countryOfOrigin || 'US'}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Action Operations */}
                    <td className="px-6 py-4 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleSaveItemChanges(item.id)}
                            className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition"
                            title="Save"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            onClick={() => setEditingItemId(null)}
                            className="p-1.5 bg-neutral-200 text-neutral-600 rounded-lg hover:bg-neutral-300 transition"
                            title="Cancel"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartEditingItem(item)}
                          className="p-1.5 text-neutral-400 hover:text-primary rounded-lg hover:bg-neutral-100 transition"
                          title="Edit Customs Data"
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Origin Assignment Modal */}
      {showBulkOriginModal && (
        <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2rem] p-6 max-w-sm w-full shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="text-sm font-black uppercase tracking-widest text-neutral-900">Set Bulk Origin</h3>
              <button onClick={() => setShowBulkOriginModal(false)} className="text-neutral-400 hover:text-black">
                <X size={16} />
              </button>
            </div>
            
            <p className="text-xs text-neutral-500 leading-relaxed font-semibold">
              Enter a 2-letter ISO Country Code (e.g. US, JP, DE, GB) to instantly assign as the country of origin for every item in this travel manifest.
            </p>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-1">ISO Country Code</label>
              <input
                type="text"
                value={bulkOrigin}
                onChange={e => setBulkOrigin(e.target.value.toUpperCase())}
                placeholder="e.g. US"
                maxLength={3}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-sm font-black uppercase tracking-wider text-neutral-800 outline-none focus:ring-2 focus:ring-primary focus:bg-white transition"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowBulkOriginModal(false)}
                className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl font-bold text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyBulkOrigin}
                className="flex-1 py-3 bg-neutral-900 hover:bg-black text-white rounded-xl font-black uppercase tracking-wider text-xs transition shadow-md"
              >
                Apply Bulk
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
