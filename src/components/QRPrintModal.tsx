import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Printer, 
  Check, 
  Search, 
  Tag, 
  QrCode, 
  Settings2, 
  Layout, 
  Maximize2, 
  Type, 
  Eye, 
  EyeOff, 
  Info, 
  Sparkles, 
  Sliders, 
  Edit3, 
  Paintbrush, 
  Save, 
  Layers, 
  Cable, 
  Tv, 
  ShieldAlert, 
  ArrowRightLeft 
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { GearItem, UserProfile } from '../types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';

interface PrintableItem {
  id: string;
  name: string;
  assetTag?: string;
  brand?: string;
  category?: string;
  ownerId?: string;
}

interface LabelConfig {
  width: number; // mm
  height: number; // mm
  qrSize: number; // mm
  fontSize: number; // pt
  showName: boolean;
  showBrand: boolean;
  showTag: boolean;
  layout: 'standard' | 'square' | 'cable' | 'tiny';
  columns: number;

  // QR Code Designer Attributes
  qrFgColor: string;
  qrBgColor: string;
  qrErrorLevel: 'L' | 'M' | 'Q' | 'H';
  qrCornersRounded: boolean;

  // Device & Cable Configurator Attributes
  cableType: 'xlr' | 'sdi' | 'fiber' | 'hdmi' | 'power' | 'other';
  cableLength: string; 
  cableBandColor: string; 
  cableDirection: 'input_output' | 'none';
  
  deviceClass: string; 
  deviceCondition: string; 
  deviceWeight: string; 
  deviceWarningBorder: boolean;
}

interface QRPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: PrintableItem[];
  user?: UserProfile | null;
}

const PRESETS: Record<LabelConfig['layout'], Partial<LabelConfig>> = {
  standard: { width: 76, height: 50, qrSize: 32, fontSize: 10, columns: 3 },
  square: { width: 25, height: 25, qrSize: 18, fontSize: 6, columns: 6 },
  cable: { width: 100, height: 16, qrSize: 12, fontSize: 7, columns: 2 },
  tiny: { width: 12, height: 12, qrSize: 10, fontSize: 0, showName: false, showBrand: false, showTag: false, columns: 8 },
};

interface LabelTemplate {
  id: string;
  name: string;
  width: number;
  height: number;
  qrSize: number;
  fontSize: number;
  columns: number;
  layout: LabelConfig['layout'];
}

const TEMPLATES: LabelTemplate[] = [
  { id: 'custom', name: '✏️ Custom Dimensions', width: 76, height: 50, qrSize: 32, fontSize: 10, columns: 3, layout: 'standard' },
  { id: 'dymo30334', name: 'Dymo 30334 (2.25\" x 1.25\")', width: 57, height: 32, qrSize: 22, fontSize: 8, columns: 4, layout: 'standard' },
  { id: 'brotherTZe', name: 'Brother TZe (12mm Tape Wrap)', width: 36, height: 12, qrSize: 9, fontSize: 6, columns: 5, layout: 'cable' },
  { id: 'brotherTZe24', name: 'Brother TZe (24mm Ribbon)', width: 50, height: 24, qrSize: 18, fontSize: 8, columns: 4, layout: 'standard' },
  { id: 'averyA4', name: 'Avery A4 Standard (63.5 x 33.9mm)', width: 64, height: 34, qrSize: 24, fontSize: 9, columns: 3, layout: 'standard' },
  { id: 'square', name: 'Square Sticker (25 x 25mm)', width: 25, height: 25, qrSize: 18, fontSize: 6, columns: 6, layout: 'square' },
  { id: 'cable', name: 'Heavy Duty Cable Wrap Ribbon', width: 100, height: 16, qrSize: 12, fontSize: 7, columns: 2, layout: 'cable' },
  { id: 'tiny', name: 'Micro Tag Dot (12 x 12mm)', width: 12, height: 12, qrSize: 10, fontSize: 0, columns: 8, layout: 'tiny' }
];

export default function QRPrintModal({ isOpen, onClose, items, user }: QRPrintModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [showDesign, setShowDesign] = useState(true);
  const [smartMode, setSmartMode] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('custom');
  
  // Designer Tab switcher
  const [designerTab, setDesignerTab] = useState<'basic' | 'qr_style' | 'device_cable' | 'data_edit'>('basic');
  
  // Local reactive list offsets to edit labels before printing
  const [editedItems, setEditedItems] = useState<Record<string, { name: string; brand: string; assetTag: string }>>({});
  
  // Item currently selected for editing in Tab 4
  const [focusedItemId, setFocusedItemId] = useState<string>('');

  const [config, setConfig] = useState<LabelConfig>({
    width: 76,
    height: 50,
    qrSize: 32,
    fontSize: 10,
    showName: true,
    showBrand: true,
    showTag: true,
    layout: 'standard',
    columns: 3,
    
    // QR Appearance variables
    qrFgColor: '#000000',
    qrBgColor: '#ffffff',
    qrErrorLevel: 'H',
    qrCornersRounded: false,

    // Design Configurator variables
    cableType: 'xlr',
    cableLength: '25ft',
    cableBandColor: '#ef4444', // Red
    cableDirection: 'input_output',
    
    deviceClass: 'CLASS A',
    deviceCondition: 'EXCELLENT',
    deviceWeight: '4.5 kg',
    deviceWarningBorder: false
  });

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId === 'custom') return;
    const selected = TEMPLATES.find(t => t.id === templateId);
    if (selected) {
      setSmartMode(false);
      setConfig(prev => ({
        ...prev,
        width: selected.width,
        height: selected.height,
        qrSize: selected.qrSize,
        fontSize: selected.fontSize,
        layout: selected.layout,
        columns: selected.columns,
        showName: selected.layout !== 'tiny',
        showBrand: selected.layout !== 'tiny',
        showTag: selected.layout !== 'tiny'
      }));
    }
  };

  const applyPreset = (layout: LabelConfig['layout']) => {
    setSmartMode(false);
    setConfig(prev => ({
      ...prev,
      ...PRESETS[layout],
      layout
    }));
    if (layout === 'standard') setSelectedTemplateId('custom');
    else if (layout === 'square') setSelectedTemplateId('square');
    else if (layout === 'cable') setSelectedTemplateId('cable');
    else if (layout === 'tiny') setSelectedTemplateId('tiny');
  };

  const getSmartConfig = (item: PrintableItem): LabelConfig => {
    if (!smartMode) return config;
    
    const name = item.name.toLowerCase();
    const category = item.category?.toLowerCase() || '';
    const brandStr = item.brand?.toLowerCase() || '';

    if (name.includes('cable') || name.includes('xlr') || name.includes('sdi') || name.includes('fiber') || name.includes('hdmi') || category.includes('cable') || category.includes('cables')) {
      // Determine default colors & sizes
      let col = '#ef4444';
      let cType: LabelConfig['cableType'] = 'other';
      if (name.includes('fiber')) { col = '#f59e0b'; cType = 'fiber'; } // Orange
      else if (name.includes('sdi')) { col = '#3b82f6'; cType = 'sdi'; } // Blue
      else if (name.includes('xlr')) { col = '#10b981'; cType = 'xlr'; } // Emerald
      else if (name.includes('power')) { col = '#8b5cf6'; cType = 'power'; } // Violet
      else if (name.includes('hdmi')) { col = '#ec4899'; cType = 'hdmi'; } // Pink

      return { 
        ...config, 
        ...PRESETS.cable, 
        layout: 'cable',
        cableType: cType,
        cableBandColor: col,
        cableLength: name.match(/\d+(ft|m)/i)?.[0] || '25ft'
      };
    }
    if (name.includes('pelican') || name.includes('case') || name.includes('trunk') || category.includes('case')) {
      return { ...config, ...PRESETS.standard, layout: 'standard', deviceWarningBorder: true };
    }
    if (name.includes('adapter') || name.includes('dongle') || name.includes('tiny') || name.includes('small') || category.includes('accessory')) {
      return { ...config, ...PRESETS.tiny, layout: 'tiny' };
    }
    if (name.includes('lens') || name.includes('camera') || name.includes('body') || name.includes('monitor')) {
      return { ...config, ...PRESETS.square, layout: 'square' };
    }
    return config;
  };

  const filteredItems = useMemo(() => items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.assetTag || '').toLowerCase().includes(searchTerm.toLowerCase())
  ), [items, searchTerm]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
      if (focusedItemId === id) setFocusedItemId('');
    } else {
      next.add(id);
      setFocusedItemId(id);
    }
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
      setFocusedItemId('');
    } else {
      const allSelected = new Set(filteredItems.map(i => i.id));
      setSelectedIds(allSelected);
      if (filteredItems.length > 0) setFocusedItemId(filteredItems[0].id);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const selectedItems = items.filter(i => selectedIds.has(i.id));

  // Edit fields handler for localized asset data overrides
  const handleEditField = (itemId: string, field: 'name' | 'brand' | 'assetTag', value: string) => {
    setEditedItems(prev => {
      const original = items.find(i => i.id === itemId);
      const current = prev[itemId] || {
        name: original?.name || '',
        brand: original?.brand || original?.category || 'General',
        assetTag: original?.assetTag || ''
      };
      return {
        ...prev,
        [itemId]: {
          ...current,
          [field]: value
        }
      };
    });
  };

  // Commit changes directly back to Firestore
  const handleSaveToFirestore = async (itemId: string) => {
    const updated = editedItems[itemId];
    if (!updated) return;
    
    try {
      const docRef = doc(db, 'users', user?.uid || 'global', 'gearLibrary', itemId);
      await updateDoc(docRef, {
        name: updated.name,
        brand: updated.brand,
        assetTag: updated.assetTag
      });
      toast.success("Successfully updated asset parameters inside Firebase!");
    } catch (e) {
      console.error("Firebase update failed:", e);
      toast.error("Saved in preview only. Make sure you are the authorized asset group owner.");
    }
  };

  const getResolvedItem = (item: PrintableItem) => {
    const edit = editedItems[item.id];
    return {
      ...item,
      name: edit ? edit.name : item.name,
      brand: edit ? edit.brand : (item.brand || item.category || 'General'),
      assetTag: edit ? edit.assetTag : (item.assetTag || 'TAG-PENDING')
    };
  };

  const currentFocusedItem = useMemo(() => {
    if (!focusedItemId) return null;
    const rawItem = items.find(i => i.id === focusedItemId);
    if (!rawItem) return null;
    return getResolvedItem(rawItem);
  }, [focusedItemId, editedItems, items]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-neutral-950/80 backdrop-blur-md z-[150] flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:inset-auto font-sans"
          id="qr-print-workspace"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="bg-white w-full max-w-7xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-neutral-100 print:shadow-none print:rounded-none print:max-h-none print:w-auto print:h-auto"
          >
            {/* Header Area */}
            <div className="p-6 bg-neutral-50/50 border-b border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-center sm:text-left">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-black tracking-widest bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md inline-block select-none">
                    PACKER SYSTEM v5.3.0 Stable
                  </span>
                  <h2 className="text-2xl font-black tracking-tight flex items-center justify-center sm:justify-start gap-1.5 uppercase">
                    <QrCode size={24} className="text-primary" />
                    <span>Industrial adhesive Label Designer</span>
                  </h2>
                  <p className="text-xs text-neutral-500 italic">
                    Customize physical adhesive layouts, colors, cable wrap loops, and edit tag specs instantly.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2.5 shrink-0">
                <button 
                  onClick={() => setShowDesign(!showDesign)}
                  className={`flex items-center gap-1.5 px-4.5 py-2.5 rounded-xl font-bold text-xs transition ${
                    showDesign ? 'bg-neutral-900 text-white shadow' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                  type="button"
                >
                  <Settings2 size={15} />
                  <span>{showDesign ? 'Hide Design Rails' : 'Configure Layout'}</span>
                </button>

                <button
                  onClick={handlePrint}
                  disabled={selectedIds.size === 0}
                  className="flex items-center gap-1.5 px-6 py-2.5 bg-primary text-white rounded-xl text-xs font-black uppercase hover:bg-opacity-95 transition disabled:opacity-40 disabled:shadow-none cursor-pointer"
                  type="button"
                >
                  <Printer size={15} />
                  <span>Print {selectedIds.size > 0 ? `(${selectedIds.size})` : ''} Tags</span>
                </button>
                
                <button 
                  onClick={onClose} 
                  className="p-2 hover:bg-neutral-100 rounded-xl transition cursor-pointer"
                  type="button"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row print:block">
              
              {/* Left Control Rail: Workspace Configuration */}
              <AnimatePresence>
                {showDesign && (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 340, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="border-r border-neutral-100 flex flex-col shrink-0 overflow-hidden print:hidden bg-neutral-900 text-neutral-200"
                    id="designer-config-rail"
                  >
                    {/* Inner tab selectors */}
                    <div className="grid grid-cols-4 bg-neutral-950 border-b border-neutral-800 text-[10px] font-black uppercase text-center text-neutral-400">
                      <button
                        onClick={() => setDesignerTab('basic')}
                        className={`py-3 transition flex flex-col items-center gap-1 border-r border-neutral-800 select-none ${designerTab === 'basic' ? 'bg-neutral-900 text-white border-b-2 border-b-primary font-bold' : 'hover:bg-neutral-900/50'}`}
                      >
                        <Layout size={12} />
                        <span>Basic</span>
                      </button>
                      <button
                        onClick={() => setDesignerTab('qr_style')}
                        className={`py-3 transition flex flex-col items-center gap-1 border-r border-neutral-800 select-none ${designerTab === 'qr_style' ? 'bg-neutral-900 text-white border-b-2 border-b-primary font-bold' : 'hover:bg-neutral-900/50'}`}
                      >
                        <Paintbrush size={12} />
                        <span>Style</span>
                      </button>
                      <button
                        onClick={() => setDesignerTab('device_cable')}
                        className={`py-3 transition flex flex-col items-center gap-1 border-r border-neutral-800 select-none ${designerTab === 'device_cable' ? 'bg-neutral-900 text-white border-b-2 border-b-primary font-bold' : 'hover:bg-neutral-900/50'}`}
                      >
                        <Cable size={12} />
                        <span>Special</span>
                      </button>
                      <button
                        onClick={() => setDesignerTab('data_edit')}
                        className={`py-3 transition flex flex-col items-center gap-1 select-none ${designerTab === 'data_edit' ? 'bg-neutral-900 text-white border-b-2 border-b-primary font-bold' : 'hover:bg-neutral-900/50'}`}
                      >
                        <Edit3 size={12} />
                        <span>Edit</span>
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5.5 space-y-6">

                      {/* Tab 1: Dimensions & Layout Parameters */}
                      {designerTab === 'basic' && (
                        <div className="space-y-5 animate-in fade-in duration-300">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                                <Sparkles size={12} className="text-primary animate-pulse" />
                                <span>SMART PLACEMENTS</span>
                              </span>
                              <button
                                onClick={() => setSmartMode(!smartMode)}
                                className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${
                                  smartMode ? 'bg-primary' : 'bg-neutral-800'
                                }`}
                                type="button"
                              >
                                <span
                                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                    smartMode ? 'translate-x-[22px]' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </div>
                            <p className="text-[10px] text-neutral-400 font-medium leading-relaxed">
                              Smart Mode automatically matches structural layouts to specific assets (cable ribbons for wires, high-density tags for camera gears).
                            </p>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">Preset Label Materials</label>
                            <select
                              value={selectedTemplateId}
                              onChange={(e) => handleTemplateChange(e.target.value)}
                              className="w-full p-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs font-bold outline-none text-neutral-200 focus:border-primary cursor-pointer"
                            >
                              {TEMPLATES.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-3 pt-2 border-t border-neutral-800">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">Custom Ribbon Sizing (mm)</span>
                            <div className="grid grid-cols-2 gap-3.5">
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-neutral-500 uppercase">Width</label>
                                <input 
                                  type="number" 
                                  value={config.width} 
                                  onChange={(e) => {
                                    setConfig(prev => ({ ...prev, width: Number(e.target.value) }));
                                    setSelectedTemplateId('custom');
                                  }}
                                  className="w-full p-2 bg-neutral-950 border border-neutral-800 text-white rounded-lg text-xs font-bold outline-none focus:border-primary"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-neutral-500 uppercase">Height</label>
                                <input 
                                  type="number" 
                                  value={config.height} 
                                  onChange={(e) => {
                                    setConfig(prev => ({ ...prev, height: Number(e.target.value) }));
                                    setSelectedTemplateId('custom');
                                  }}
                                  className="w-full p-2 bg-neutral-950 border border-neutral-800 text-white rounded-lg text-xs font-bold outline-none focus:border-primary"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3.5 pt-2 border-t border-neutral-800">
                            <div className="flex justify-between items-center text-[10px] font-bold text-neutral-400">
                              <span>QR MATRIX CORE SIZE</span>
                              <span className="font-mono text-primary font-black">{config.qrSize}mm</span>
                            </div>
                            <input 
                              type="range" 
                              min="5" 
                              max={Math.min(config.width, config.height) - 2} 
                              value={config.qrSize} 
                              onChange={(e) => {
                                setConfig(prev => ({ ...prev, qrSize: Number(e.target.value) }));
                                setSelectedTemplateId('custom');
                              }}
                              className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-primary"
                            />
                          </div>

                          <div className="space-y-3.5 pt-2 border-t border-neutral-800">
                            <div className="flex justify-between items-center text-[10px] font-bold text-neutral-400">
                              <span>LABEL FONT DEPTH</span>
                              <span className="font-mono text-primary font-black">{config.fontSize}pt</span>
                            </div>
                            <input 
                              type="range" 
                              min="5" 
                              max="18" 
                              value={config.fontSize} 
                              onChange={(e) => {
                                setConfig(prev => ({ ...prev, fontSize: Number(e.target.value) }));
                                setSelectedTemplateId('custom');
                              }}
                              className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-primary"
                            />
                          </div>

                          <div className="space-y-2.5 pt-2 border-t border-neutral-800">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">Print Columns Count</span>
                            <div className="grid grid-cols-4 gap-1">
                              {[1, 2, 3, 4].map(c => (
                                <button
                                  key={c}
                                  onClick={() => setConfig(prev => ({ ...prev, columns: c }))}
                                  className={`py-1.5 rounded-lg text-xs font-black border transition ${config.columns === c ? 'bg-primary/20 border-primary text-primary' : 'bg-neutral-950 border-neutral-800 text-neutral-400'}`}
                                  type="button"
                                >
                                  {c} Col
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2 pt-2 border-t border-neutral-800">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">Interactive Elements</span>
                            <div className="grid grid-cols-1 gap-2">
                              {[
                                { key: 'showName', label: 'Display Item Name' },
                                { key: 'showBrand', label: 'Display Brand / Category' },
                                { key: 'showTag', label: 'Display Asset ID Tag' },
                              ].map(opt => (
                                <button
                                  key={opt.key}
                                  onClick={() => setConfig(prev => ({ ...prev, [opt.key]: !prev[opt.key as keyof LabelConfig] }))}
                                  className="flex items-center justify-between p-2.5 bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 rounded-xl text-xs font-bold transition text-left"
                                  type="button"
                                >
                                  <span className="text-neutral-300">{opt.label}</span>
                                  <span className={`text-[9px] px-2 py-0.5 rounded font-black ${config[opt.key as keyof LabelConfig] ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'}`}>
                                    {config[opt.key as keyof LabelConfig] ? 'ACTIVE' : 'OFF'}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Tab 2: Custom QR Appearance Designer */}
                      {designerTab === 'qr_style' && (
                        <div className="space-y-5 animate-in fade-in duration-300">
                          <h3 className="text-xs uppercase font-extrabold tracking-widest text-primary border-b border-neutral-800 pb-1.5 flex items-center gap-1">
                            <Paintbrush size={14} />
                            <span>QR Code Colorist</span>
                          </h3>

                          {/* FG Color */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider block">QR Matrix Foreground (Hex)</label>
                            <div className="flex gap-2">
                              <input 
                                type="color" 
                                value={config.qrFgColor} 
                                onChange={(e) => setConfig(prev => ({ ...prev, qrFgColor: e.target.value }))}
                                className="w-8 h-8 rounded-lg bg-transparent border border-neutral-850 cursor-pointer outline-none shrink-0"
                              />
                              <input 
                                type="text" 
                                value={config.qrFgColor} 
                                onChange={(e) => setConfig(prev => ({ ...prev, qrFgColor: e.target.value }))}
                                className="flex-1 px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white uppercase font-bold"
                              />
                            </div>
                            <div className="flex gap-1">
                              {['#000000', '#1d4ed8', '#15803d', '#b91c1c', '#7c3aed'].map(c => (
                                <button
                                  key={c}
                                  onClick={() => setConfig(prev => ({ ...prev, qrFgColor: c }))}
                                  className="w-5 h-5 rounded-full border border-neutral-700 hover:scale-110 transition cursor-pointer"
                                  style={{ backgroundColor: c }}
                                  type="button"
                                />
                              ))}
                            </div>
                          </div>

                          {/* BG Color */}
                          <div className="space-y-2 pt-2 border-t border-neutral-800">
                            <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider block">QR Canvas Background (Hex)</label>
                            <div className="flex gap-2">
                              <input 
                                type="color" 
                                value={config.qrBgColor} 
                                onChange={(e) => setConfig(prev => ({ ...prev, qrBgColor: e.target.value }))}
                                className="w-8 h-8 rounded-lg bg-transparent border border-neutral-850 cursor-pointer outline-none shrink-0"
                              />
                              <input 
                                type="text" 
                                value={config.qrBgColor} 
                                onChange={(e) => setConfig(prev => ({ ...prev, qrBgColor: e.target.value }))}
                                className="flex-1 px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white uppercase font-bold"
                              />
                            </div>
                            <div className="flex gap-1">
                              {['#ffffff', '#fafafa', '#fef2f2', '#f0fdf4', '#eff6ff'].map(c => (
                                <button
                                  key={c}
                                  onClick={() => setConfig(prev => ({ ...prev, qrBgColor: c }))}
                                  className="w-5 h-5 rounded-full border border-neutral-700 hover:scale-110 transition cursor-pointer"
                                  style={{ backgroundColor: c }}
                                  type="button"
                                />
                              ))}
                            </div>
                          </div>

                          {/* Error block lvl */}
                          <div className="space-y-2 pt-2 border-t border-neutral-800">
                            <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider block">Error Correction Level (ECC)</label>
                            <div className="grid grid-cols-4 gap-1">
                              {['L', 'M', 'Q', 'H'].map(lvl => (
                                <button
                                  key={lvl}
                                  onClick={() => setConfig(prev => ({ ...prev, qrErrorLevel: lvl as any }))}
                                  className={`py-1.5 rounded-lg text-xs font-black border transition ${config.qrErrorLevel === lvl ? 'bg-primary/20 border-primary text-primary' : 'bg-neutral-950 border-neutral-800 text-neutral-400'}`}
                                  type="button"
                                >
                                  {lvl} {lvl === 'H' ? '💎' : ''}
                                </button>
                              ))}
                            </div>
                            <p className="text-[9px] text-neutral-500 italic mt-0.5">High ECC (H) permits scanning even with 30% label tears or logo overlaps.</p>
                          </div>

                          {/* Rounded Corner styling */}
                          <button
                            onClick={() => setConfig(prev => ({ ...prev, qrCornersRounded: !prev.qrCornersRounded }))}
                            className="w-full flex items-center justify-between p-3 bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 rounded-xl text-xs font-bold transition text-left"
                            type="button"
                          >
                            <span className="text-neutral-300">Rounded Canvas Border</span>
                            <span className={`text-[9px] px-2 py-0.5 rounded font-black ${config.qrCornersRounded ? 'bg-primary/20 text-primary' : 'bg-neutral-800 text-neutral-400'}`}>
                              {config.qrCornersRounded ? 'ROUNDED' : 'SQUARE'}
                            </span>
                          </button>
                        </div>
                      )}

                      {/* Tab 3: Cable & Device QR Configurator and Presets */}
                      {designerTab === 'device_cable' && (
                        <div className="space-y-5 animate-in fade-in duration-300">
                          
                          {/* Cable Section */}
                          <div className="space-y-3 p-3 bg-neutral-950 rounded-2xl border border-neutral-800">
                            <h4 className="text-xs font-black uppercase text-primary flex items-center gap-1.5 border-b border-neutral-800 pb-1.5">
                              <Cable size={13} />
                              <span>Heavy Duty Cable Configurator</span>
                            </h4>

                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-neutral-500 uppercase">Cable Standard Type</label>
                              <select
                                value={config.cableType}
                                onChange={(e) => setConfig(prev => ({ ...prev, cableType: e.target.value as any }))}
                                className="w-full p-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white font-bold outline-none cursor-pointer"
                              >
                                <option value="xlr">🎤 XLR Microphone / Audio</option>
                                <option value="sdi">📹 SDI Pro Video Channel</option>
                                <option value="fiber">⚡ Optical fiber Feed</option>
                                <option value="hdmi">📺 High Definition HDMI</option>
                                <option value="power">🔌 Heavy Main Power Cable</option>
                                <option value="other">⚙️ Custom Segment / Wire</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-neutral-500 uppercase">Interactive Cable Length</label>
                              <input 
                                type="text"
                                placeholder="e.g. 25ft, 100ft, 15m"
                                value={config.cableLength}
                                onChange={(e) => setConfig(prev => ({ ...prev, cableLength: e.target.value }))}
                                className="w-full p-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white font-bold outline-none"
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="text-[9px] font-bold text-neutral-500 uppercase">Ident Band Color Pin</label>
                              <div className="flex gap-2">
                                <input 
                                  type="color" 
                                  value={config.cableBandColor} 
                                  onChange={(e) => setConfig(prev => ({ ...prev, cableBandColor: e.target.value }))}
                                  className="w-7 h-7 rounded-lg bg-transparent border border-neutral-800 cursor-pointer outline-none shrink-0"
                                />
                                <div className="flex gap-1 items-center flex-1">
                                  {['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#ffffff', '#8b5cf6'].map(c => (
                                    <button
                                      key={c}
                                      onClick={() => setConfig(prev => ({ ...prev, cableBandColor: c }))}
                                      className={`w-4 h-4 rounded-full hover:scale-110 transition ${config.cableBandColor === c ? 'ring-2 ring-primary ring-offset-2 ring-offset-neutral-950' : ''}`}
                                      style={{ backgroundColor: c }}
                                      type="button"
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => setConfig(prev => ({ ...prev, cableDirection: prev.cableDirection === 'none' ? 'input_output' : 'none' }))}
                              className="w-full flex items-center justify-between p-2 bg-neutral-900/50 rounded-xl text-[10px] font-extrabold text-neutral-300"
                              type="button"
                            >
                              <span>Append Direct Flow Arrows</span>
                              <span className="text-xs text-primary">{config.cableDirection !== 'none' ? 'M ➔ F ON' : 'OFF'}</span>
                            </button>
                          </div>

                          {/* Device Section */}
                          <div className="space-y-3 p-3 bg-neutral-950 rounded-2xl border border-neutral-800">
                            <h4 className="text-xs font-black uppercase text-primary flex items-center gap-1.5 border-b border-neutral-800 pb-1.5">
                              <Tv size={13} />
                              <span>Rig & Hardware Module Config</span>
                            </h4>

                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-neutral-500 uppercase">Security Frame Border</label>
                              <button
                                onClick={() => setConfig(prev => ({ ...prev, deviceWarningBorder: !prev.deviceWarningBorder }))}
                                className={`w-full p-2 rounded-xl text-xs font-black border transition text-center ${config.deviceWarningBorder ? 'bg-amber-950 border-amber-600 text-amber-300' : 'bg-neutral-900 border-neutral-800 text-neutral-450'}`}
                                type="button"
                              >
                                {config.deviceWarningBorder ? '⚠️ SECURE INDUSTRIAL BORDER ACTIVE' : 'STEEL STANDARD LAYOUT'}
                              </button>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-neutral-500 uppercase">Device Class Label</label>
                              <input 
                                type="text"
                                placeholder="e.g. CLASS A, CRITICAL UNIT"
                                value={config.deviceClass}
                                onChange={(e) => setConfig(prev => ({ ...prev, deviceClass: e.target.value }))}
                                className="w-full p-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white font-bold outline-none"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-neutral-500 uppercase">Device Physical Weight</label>
                              <input 
                                type="text"
                                placeholder="e.g. 14.2 kg, 35 lbs"
                                value={config.deviceWeight}
                                onChange={(e) => setConfig(prev => ({ ...prev, deviceWeight: e.target.value }))}
                                className="w-full p-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white font-bold outline-none"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-neutral-500 uppercase">Condition Verification Stamp</label>
                              <input 
                                type="text"
                                placeholder="e.g. EXCELLENT, FIELD READY"
                                value={config.deviceCondition}
                                onChange={(e) => setConfig(prev => ({ ...prev, deviceCondition: e.target.value }))}
                                className="w-full p-2 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white font-bold outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Tab 4: Local Live Asset Label Editors & Direct SQL Push */}
                      {designerTab === 'data_edit' && (
                        <div className="space-y-5 animate-in fade-in duration-300">
                          <h3 className="text-xs uppercase font-extrabold tracking-widest text-primary border-b border-neutral-800 pb-1.5 flex items-center gap-1.5">
                            <Edit3 size={14} />
                            <span>Preview Text Override & Sync</span>
                          </h3>

                          {focusedItemId ? (
                            <div className="p-4.5 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-4">
                              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                                <span className="text-[10px] font-black uppercase text-neutral-400">Tweak Item label</span>
                                <span className="text-[9px] bg-neutral-800 text-white px-2 py-0.5 rounded font-mono font-bold truncate max-w-[120px]">
                                  {focusedItemId.slice(-6)}
                                </span>
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[9px] font-bold text-neutral-500 uppercase">Print Name</label>
                                <input 
                                  type="text"
                                  value={currentFocusedItem?.name || ''}
                                  onChange={(e) => handleEditField(focusedItemId, 'name', e.target.value)}
                                  className="w-full p-2.5 bg-neutral-900 border border-neutral-805 rounded-xl text-xs text-white font-bold outline-none focus:border-primary"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[9px] font-bold text-neutral-500 uppercase">Print Category / Brand</label>
                                <input 
                                  type="text"
                                  value={currentFocusedItem?.brand || ''}
                                  onChange={(e) => handleEditField(focusedItemId, 'brand', e.target.value)}
                                  className="w-full p-2.5 bg-neutral-900 border border-neutral-805 rounded-xl text-xs text-white font-bold outline-none focus:border-primary"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[9px] font-bold text-neutral-500 uppercase">Print Asset Tag ID</label>
                                <input 
                                  type="text"
                                  value={currentFocusedItem?.assetTag || ''}
                                  onChange={(e) => handleEditField(focusedItemId, 'assetTag', e.target.value)}
                                  className="w-full p-2.5 bg-neutral-900 border border-neutral-805 rounded-xl text-xs text-white font-semibold outline-none focus:border-primary"
                                />
                              </div>

                              <div className="pt-2 flex flex-col gap-1.5">
                                <button
                                  onClick={() => handleSaveToFirestore(focusedItemId)}
                                  className="w-full py-2 bg-primary text-white hover:bg-opacity-95 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-1 cursor-pointer"
                                  title="Sync overrides back to database permanently"
                                  type="button"
                                >
                                  <Save size={13} />
                                  <span>Sync To Cloud Database</span>
                                </button>
                                <p className="text-[9px] text-neutral-500 text-center leading-normal">
                                  Instantly rewrite this equipment name & status inside your Cloud Firestore workspace.
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="p-8 text-center text-xs text-neutral-500 italic bg-neutral-950 rounded-2xl border border-neutral-800">
                              Choose a tag in the right preview pane or the select checklist below to customize its text in real-time.
                            </div>
                          )}

                          {selectedItems.length > 0 && (
                            <div className="space-y-2">
                              <span className="text-[10px] font-black uppercase text-neutral-400 block pb-1 border-b border-neutral-850">Selected Print Queue ({selectedItems.length})</span>
                              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1.5">
                                {selectedItems.map(item => {
                                  const rItem = getResolvedItem(item);
                                  return (
                                    <button
                                      key={item.id}
                                      onClick={() => setFocusedItemId(item.id)}
                                      className={`w-full p-2 bg-neutral-950 hover:bg-neutral-900 rounded-xl border text-left transition ${focusedItemId === item.id ? 'border-primary' : 'border-neutral-800'}`}
                                      type="button"
                                    >
                                      <p className="text-xs font-black text-white truncate">{rItem.name}</p>
                                      <p className="text-[9px] text-neutral-450 tracking-wide font-mono truncate">{rItem.assetTag}</p>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Central Area: Grid Filter Selection & Print Rendering */}
              <div className="flex-1 overflow-hidden flex flex-col print:block">
                
                {/* Selection Bar: Hidden on Print */}
                <div className="p-6 bg-white border-b border-neutral-100 space-y-4 print:hidden">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={17} />
                      <input
                        type="text"
                        placeholder="Filter active gear by name, brand or serial/asset tag..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-2xl text-xs font-medium outline-none focus:ring-2 focus:ring-primary focus:bg-white transition"
                        id="filter-tag-search"
                      />
                    </div>

                    {/* Physical Label Presets shortcuts */}
                    <div className="flex items-center gap-2 bg-neutral-50 pl-4 pr-2 py-1.5 border border-neutral-200 rounded-2xl shrink-0">
                      <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider shrink-0">Layout preset:</label>
                      <select
                        value={config.layout}
                        onChange={(e) => applyPreset(e.target.value as any)}
                        className="bg-transparent py-1.5 text-xs font-bold outline-none cursor-pointer text-neutral-800"
                      >
                        <option value="standard">Standard Card Size</option>
                        <option value="square">Square sticker</option>
                        <option value="cable">Wrap-around Cable Tail</option>
                        <option value="tiny">Tiny circular Dot</option>
                      </select>
                    </div>

                    <button
                      onClick={selectAll}
                      className="px-5 py-2.5 bg-neutral-100 text-neutral-600 rounded-2xl text-xs font-bold hover:bg-neutral-200 transition shrink-0"
                      type="button"
                    >
                      {selectedIds.size === filteredItems.length ? '🧹 Deselect Workspace' : '✅ Select All filtered'}
                    </button>
                  </div>

                  {/* Multi-Select Horizontal Carousel */}
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 border border-dashed border-neutral-100 rounded-2xl bg-neutral-50/40">
                    {filteredItems.map(item => {
                      const rItem = getResolvedItem(item);
                      const isSelected = selectedIds.has(item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => toggleSelect(item.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition text-xs font-semibold ${
                            isSelected
                              ? 'bg-primary/10 border-primary text-primary font-bold'
                              : 'bg-white border-neutral-250 text-neutral-500 hover:border-neutral-350 shadow-sm'
                          }`}
                          type="button"
                        >
                          {isSelected && <Check size={12} />}
                          <span className="truncate max-w-[150px]">{rItem.name}</span>
                        </button>
                      );
                    })}
                    {filteredItems.length === 0 && (
                      <p className="text-neutral-400 text-xs italic py-2 px-1">No items match your search term.</p>
                    )}
                  </div>
                </div>

                {/* Print Layout Engine Stage */}
                <div className="flex-1 overflow-y-auto p-8 bg-neutral-100 print:bg-white print:p-0">
                  <div 
                    className="grid gap-6 print:gap-1 p-2 justify-center"
                    style={{ 
                      gridTemplateColumns: smartMode ? 'repeat(auto-fill, minmax(220px, 1fr))' : `repeat(${config.columns}, minmax(0, max-content))`,
                      display: 'grid'
                    }}
                    id="printed-sticker-grid"
                  >
                    {selectedItems.length === 0 ? (
                      <div className="col-span-full py-24 text-center space-y-4 print:hidden bg-white rounded-3xl border border-neutral-200 border-dashed p-6 max-w-lg mx-auto">
                        <div className="w-16 h-16 bg-primary/5 border border-primary/15 text-primary rounded-full flex items-center justify-center mx-auto">
                          <Tag size={28} />
                        </div>
                        <h4 className="text-base font-black uppercase text-neutral-800">Your design plate is empty!</h4>
                        <p className="text-neutral-500 text-xs leading-relaxed">
                          Click any of the equipment tag pills above to insert them into your live design preview workspace.
                        </p>
                      </div>
                    ) : (
                      selectedItems.map(item => {
                        const itemConfig = getSmartConfig(item);
                        const rItem = getResolvedItem(item);
                        
                        // Decide specific render attributes for devices vs cables
                        const isCable = itemConfig.layout === 'cable';
                        
                        return (
                          <div 
                            key={item.id} 
                            onClick={() => setFocusedItemId(item.id)}
                            className={`bg-white text-black border/90 shadow-sm hover:ring-2 hover:ring-primary transition cursor-pointer print:border-black print:rounded-none print:shadow-none print:break-inside-avoid overflow-hidden relative flex ${
                              isCable ? 'flex-row items-center border border-neutral-300' : 'flex-col items-center justify-between border border-neutral-200'
                            } ${focusedItemId === item.id ? 'ring-2 ring-primary border-primary hover:ring-offset-2' : ''}`}
                            style={{ 
                              width: `${itemConfig.width}mm`,
                              height: `${itemConfig.height}mm`,
                              padding: itemConfig.layout === 'tiny' ? '1mm' : (isCable ? '1mm 3mm' : '3mm'),
                              backgroundColor: itemConfig.qrBgColor,
                              boxSizing: 'border-box'
                            }}
                          >
                            
                            {/* Layout specific render styles */}
                            {isCable ? (
                              /* Cable Layout Loop Design */
                              <div className="w-full h-full flex items-center relative gap-2">
                                
                                {/* 1. Length/Tag Color Indicator Band Wrap Tail */}
                                <div 
                                  className="absolute left-0 top-0 bottom-0 w-3 shrink-0 print:border-r print:border-black"
                                  style={{ backgroundColor: itemConfig.cableBandColor }}
                                />
                                
                                {/* 2. Inner QR Code wrap */}
                                <div 
                                  className="p-0.5 bg-white border border-neutral-200 rounded shrink-0 ml-3 print:border-black print:p-0"
                                  style={{ width: `${itemConfig.qrSize}mm`, height: `${itemConfig.qrSize}mm` }}
                                >
                                  <QRCodeCanvas
                                    value={`${window.location.origin}/#/gear/${item.id}`}
                                    size={itemConfig.qrSize * 3.78}
                                    level={itemConfig.qrErrorLevel}
                                    fgColor={itemConfig.qrFgColor}
                                    bgColor={itemConfig.qrBgColor}
                                    includeMargin={false}
                                    style={{ width: '100%', height: '100%' }}
                                  />
                                </div>

                                {/* 3. Cable Specific description details */}
                                <div className="flex-1 min-w-0 pr-1 flex flex-col justify-center text-left leading-none" style={{ fontSize: `${itemConfig.fontSize}pt` }}>
                                  <div className="flex items-center gap-1 mb-0.5">
                                    <span className="text-[7px] font-black uppercase tracking-wider bg-black text-white px-1 rounded-sm shrink-0">
                                      {itemConfig.cableType.toUpperCase()}
                                    </span>
                                    <span className="text-[7.5px] text-neutral-800 font-extrabold truncate uppercase font-mono">
                                      {itemConfig.cableLength}
                                    </span>
                                    {itemConfig.cableDirection !== 'none' && (
                                      <span className="text-[6.5px] font-mono text-neutral-500 font-extrabold shrink-0">
                                        M➔F
                                      </span>
                                    )}
                                  </div>
                                  {itemConfig.showName && (
                                    <p className="font-extrabold text-[8px] text-neutral-900 truncate uppercase tracking-tight">
                                      {rItem.name}
                                    </p>
                                  )}
                                  {itemConfig.showTag && (
                                    <p className="text-[6px] font-mono font-bold text-neutral-500 mt-0.5 select-all">
                                      {rItem.assetTag}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ) : (
                              /* Standard/Square/Tiny Industrial and Device badge layouts */
                              <div className="w-full h-full flex flex-col justify-between items-center relative">
                                
                                {/* Secure Device Warning stripe */}
                                {itemConfig.deviceWarningBorder && (
                                  <div className="absolute inset-0 border-4 border-amber-400 pointer-events-none print:border-black" style={{ borderStyle: 'double' }}>
                                    {/* Stripes Accent background */}
                                    <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400 print:bg-black" />
                                  </div>
                                )}

                                {/* Card Header section */}
                                {itemConfig.layout !== 'tiny' && (
                                  <div className={`w-full flex justify-between items-start ${itemConfig.deviceWarningBorder ? 'px-1.5 pt-1.5' : ''}`}>
                                    {itemConfig.showTag && (
                                      <div className="text-left leading-none">
                                        <span className="text-[6px] font-black uppercase text-neutral-400 tracking-wider">Asset System</span>
                                        <p className="text-[8.5px] font-mono font-black text-neutral-900">{rItem.assetTag}</p>
                                      </div>
                                    )}
                                    <div className="text-right leading-none flex flex-col items-end">
                                      {itemConfig.showBrand && (
                                        <span className="text-[6.5px] font-extrabold text-neutral-500 uppercase tracking-widest truncate max-w-[80px]">
                                          {rItem.brand}
                                        </span>
                                      )}
                                      {itemConfig.deviceWarningBorder && (
                                        <span className="text-[5.5px] uppercase font-bold text-red-500 shrink-0">
                                          {itemConfig.deviceClass}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* QR Canvas Frame */}
                                <div 
                                  className={`bg-white p-1 rounded-sm border shrink-0 ${itemConfig.qrCornersRounded ? 'rounded-xl' : ''}`}
                                  style={{ 
                                    width: `${itemConfig.qrSize}mm`, 
                                    height: `${itemConfig.qrSize}mm`,
                                    borderColor: '#e5e7eb'
                                  }}
                                >
                                  <QRCodeCanvas
                                    value={`${window.location.origin}/#/gear/${item.id}`}
                                    size={itemConfig.qrSize * 3.78}
                                    level={itemConfig.qrErrorLevel}
                                    fgColor={itemConfig.qrFgColor}
                                    bgColor={itemConfig.qrBgColor}
                                    includeMargin={false}
                                    style={{ width: '100%', height: '100%' }}
                                  />
                                </div>

                                {/* Label description text */}
                                {itemConfig.layout !== 'tiny' && (
                                  <div 
                                    className={`w-full text-center space-y-0.5 leading-none mb-1 ${itemConfig.deviceWarningBorder ? 'pb-1' : ''}`}
                                    style={{ fontSize: `${itemConfig.fontSize}pt` }}
                                  >
                                    {itemConfig.showName && (
                                      <p className="font-black truncate uppercase tracking-tight text-neutral-900 px-1">
                                        {rItem.name}
                                      </p>
                                    )}

                                    {/* Physical specs (weight & conditions) */}
                                    {itemConfig.deviceWarningBorder && (
                                      <div className="flex items-center justify-center gap-1.5 text-[6px] font-sans font-extrabold text-neutral-600">
                                        <span>WT: {itemConfig.deviceWeight}</span>
                                        <span>•</span>
                                        <span className="text-amber-600 font-black">{itemConfig.deviceCondition}</span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Tiny identifier bottom helper */}
                                {itemConfig.layout === 'standard' && !itemConfig.deviceWarningBorder && (
                                  <div className="absolute bottom-0 left-0 right-0 flex justify-center opacity-40">
                                    <p className="text-[5px] text-neutral-400 font-mono font-bold uppercase tracking-wider">Scan via Packer Tools</p>
                                  </div>
                                )}

                              </div>
                            )}

                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Footer Controls: Hidden on Print */}
                <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
                  <div className="flex items-center gap-2 text-xs font-bold text-neutral-500">
                    <div className="w-2.5 h-2.5 bg-primary rounded-full animate-ping"></div>
                    <span>Staging Plate: {selectedIds.size} labels loaded. Previews live-render on A4 grid paper.</span>
                  </div>
                  
                  <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                    Tip: Direct double-click on inputs to instantly override model numbers
                  </p>
                </div>

              </div>

            </div>
          </motion.div>

          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              body * {
                visibility: hidden !important;
              }
              #qr-print-workspace, #qr-print-workspace * {
                visibility: visible !important;
              }
              #qr-print-workspace {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                height: auto !important;
                background: white !important;
                padding: 0 !important;
                margin: 0 !important;
              }
              #designer-config-rail, .print\\:hidden, button, select, input {
                display: none !important;
              }
              #printed-sticker-grid {
                grid-template-columns: repeat(${config.columns}, min-content) !important;
                gap: 1.5mm !important;
                padding: 0 !important;
                margin: 0 !important;
                background: white !important;
                display: grid !important;
              }
            }
          `}} />
        </div>
      )}
    </AnimatePresence>
  );
}
