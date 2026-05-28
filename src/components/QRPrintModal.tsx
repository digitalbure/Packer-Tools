import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Printer, Check, Search, Tag, QrCode, Settings2, Layout, Maximize2, Type, Eye, EyeOff, Info, Sparkles } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { GearItem, UserProfile } from '../types';

interface PrintableItem {
  id: string;
  name: string;
  assetTag: string;
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
}

interface QRPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: PrintableItem[];
  user?: UserProfile | null;
}

const PRESETS: Record<LabelConfig['layout'], Partial<LabelConfig>> = {
  standard: { width: 76, height: 50, qrSize: 35, fontSize: 10, columns: 3 },
  square: { width: 25, height: 25, qrSize: 18, fontSize: 6, columns: 6 },
  cable: { width: 100, height: 12, qrSize: 10, fontSize: 6, columns: 2 },
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
  { id: 'custom', name: 'Custom Dimensions', width: 76, height: 50, qrSize: 35, fontSize: 10, columns: 3, layout: 'standard' },
  { id: 'dymo30334', name: 'Dymo 30334 (2.25" x 1.25")', width: 57, height: 32, qrSize: 22, fontSize: 8, columns: 4, layout: 'standard' },
  { id: 'brotherTZe', name: 'Brother TZe (12mm Tape / Wrap)', width: 36, height: 12, qrSize: 9, fontSize: 6, columns: 5, layout: 'cable' },
  { id: 'brotherTZe24', name: 'Brother TZe (24mm Ribbon)', width: 50, height: 24, qrSize: 18, fontSize: 8, columns: 4, layout: 'standard' },
  { id: 'averyA4', name: 'Standard Avery A4 (63.5 x 33.9mm)', width: 64, height: 34, qrSize: 24, fontSize: 9, columns: 3, layout: 'standard' },
  { id: 'square', name: 'Square Sticker (25 x 25mm)', width: 25, height: 25, qrSize: 18, fontSize: 6, columns: 6, layout: 'square' },
  { id: 'cable', name: 'Heavy Duty Cable Wrap', width: 100, height: 12, qrSize: 10, fontSize: 6, columns: 2, layout: 'cable' },
  { id: 'tiny', name: 'Micro Tag (12 x 12mm)', width: 12, height: 12, qrSize: 10, fontSize: 0, columns: 8, layout: 'tiny' }
];

export default function QRPrintModal({ isOpen, onClose, items, user }: QRPrintModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [showDesign, setShowDesign] = useState(false);
  const [smartMode, setSmartMode] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('custom');
  
  const isPro = user?.plan === 'pro' || user?.plan === 'enterprise';

  const [config, setConfig] = useState<LabelConfig>({
    width: 76,
    height: 50,
    qrSize: 35,
    fontSize: 10,
    showName: true,
    showBrand: true,
    showTag: true,
    layout: 'standard',
    columns: 3
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
    const brand = item.brand?.toLowerCase() || '';

    if (name.includes('cable') || name.includes('xlr') || name.includes('hdmi') || name.includes('power') || category.includes('cable')) {
      return { ...config, ...PRESETS.cable, layout: 'cable' };
    }
    if (name.includes('pelican') || name.includes('case') || name.includes('trunk') || category.includes('case')) {
      return { ...config, ...PRESETS.standard, layout: 'standard' };
    }
    if (name.includes('adapter') || name.includes('dongle') || name.includes('tiny') || name.includes('small')) {
      return { ...config, ...PRESETS.tiny, layout: 'tiny' };
    }
    if (name.includes('lens') || name.includes('camera') || name.includes('body')) {
      return { ...config, ...PRESETS.square, layout: 'square' };
    }
    return config;
  };

  const filteredItems = useMemo(() => items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.assetTag.toLowerCase().includes(searchTerm.toLowerCase())
  ), [items, searchTerm]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(i => i.id)));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const selectedItems = items.filter(i => selectedIds.has(i.id));

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:inset-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:shadow-none print:rounded-none print:max-h-none print:w-auto print:h-auto"
          >
            {/* Header - Hidden on Print */}
            <div className="p-8 border-b border-neutral-100 flex items-center justify-between print:hidden">
              <div className="flex items-center gap-4">
                <div className="space-y-1">
                  <h2 className="text-2xl font-black">QR Print Workspace</h2>
                  <p className="text-xs text-neutral-500">Design and print asset tags in bulk</p>
                </div>
                {isPro && (
                  <button 
                    onClick={() => setShowDesign(!showDesign)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition ${
                      showDesign ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    <Settings2 size={18} />
                    <span>Design Workspace</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrint}
                  disabled={selectedIds.size === 0}
                  className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none"
                >
                  <Printer size={20} />
                  <span>Print {selectedIds.size > 0 ? `(${selectedIds.size})` : ''} Labels</span>
                </button>
                <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-xl transition">
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex print:block">
              {/* Sidebar Controls - Hidden on Print */}
              <AnimatePresence>
                {showDesign && isPro && (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 320, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="border-r border-neutral-100 overflow-y-auto print:hidden bg-neutral-50/50"
                  >
                    <div className="p-6 space-y-8">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-neutral-400">
                            <Sparkles size={14} className="text-primary" />
                            <span>Smart Labels</span>
                          </div>
                          <button
                            onClick={() => setSmartMode(!smartMode)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                              smartMode ? 'bg-primary' : 'bg-neutral-200'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                smartMode ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                        <p className="text-[10px] text-neutral-500 font-medium leading-relaxed">
                          Automatically choose the best layout based on item type (e.g. cable wraps for XLR, tiny labels for adapters).
                        </p>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-neutral-400">
                          <Layout size={14} />
                          <span>Layout Presets</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {(['standard', 'square', 'cable', 'tiny'] as const).map((p) => (
                            <button
                              key={p}
                              onClick={() => applyPreset(p)}
                              className={`p-3 rounded-xl border text-xs font-bold capitalize transition ${
                                config.layout === p ? 'bg-primary/10 border-primary text-primary' : 'bg-white border-neutral-200 hover:border-neutral-300'
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-neutral-400">
                          <Layout size={14} />
                          <span>Physical Label Size</span>
                        </div>
                        <select
                          value={selectedTemplateId}
                          onChange={(e) => handleTemplateChange(e.target.value)}
                          className="w-full p-3 bg-white border border-neutral-200 rounded-xl text-xs font-bold outline-none cursor-pointer text-neutral-800 focus:ring-2 focus:ring-primary"
                        >
                          {TEMPLATES.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-neutral-400">
                          <Maximize2 size={14} />
                          <span>Dimensions (mm)</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-neutral-500">Width</label>
                            <input 
                              type="number" 
                              value={config.width} 
                              onChange={(e) => {
                                setConfig(prev => ({ ...prev, width: Number(e.target.value) }));
                                setSelectedTemplateId('custom');
                              }}
                              className="w-full p-2 bg-white border border-neutral-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-neutral-500">Height</label>
                            <input 
                              type="number" 
                              value={config.height} 
                              onChange={(e) => {
                                setConfig(prev => ({ ...prev, height: Number(e.target.value) }));
                                setSelectedTemplateId('custom');
                              }}
                              className="w-full p-2 bg-white border border-neutral-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-neutral-500">QR Size ({config.qrSize}mm)</label>
                          <input 
                            type="range" 
                            min="5" 
                            max={Math.min(config.width, config.height)} 
                            value={config.qrSize} 
                            onChange={(e) => {
                              setConfig(prev => ({ ...prev, qrSize: Number(e.target.value) }));
                              setSelectedTemplateId('custom');
                            }}
                            className="w-full h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-primary"
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-neutral-400">
                          <Type size={14} />
                          <span>Typography</span>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-neutral-500">Font Size ({config.fontSize}pt)</label>
                          <input 
                            type="range" 
                            min="0" 
                            max="24" 
                            value={config.fontSize} 
                            onChange={(e) => {
                              setConfig(prev => ({ ...prev, fontSize: Number(e.target.value) }));
                              setSelectedTemplateId('custom');
                            }}
                            className="w-full h-1.5 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-primary"
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-neutral-400">
                          <Eye size={14} />
                          <span>Visibility</span>
                        </div>
                        <div className="space-y-2">
                          {[
                            { key: 'showName', label: 'Item Name' },
                            { key: 'showBrand', label: 'Brand/Category' },
                            { key: 'showTag', label: 'Asset Tag Text' }
                          ].map((opt) => (
                            <button
                              key={opt.key}
                              onClick={() => setConfig(prev => ({ ...prev, [opt.key]: !prev[opt.key as keyof LabelConfig] }))}
                              className="w-full flex items-center justify-between p-3 bg-white border border-neutral-200 rounded-xl text-xs font-bold hover:bg-neutral-50 transition"
                            >
                              <span>{opt.label}</span>
                              {config[opt.key as keyof LabelConfig] ? <Eye size={14} className="text-primary" /> : <EyeOff size={14} className="text-neutral-300" />}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex gap-3">
                        <Info size={16} className="text-primary shrink-0 mt-0.5" />
                        <p className="text-[10px] text-primary font-medium leading-relaxed">
                          Pro Tip: For cable wraps, use the 'Cable' preset and wrap the long end around the wire.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex-1 overflow-hidden flex flex-col print:block">
                {/* Selection Area - Hidden on Print */}
                <div className="p-8 border-b border-neutral-100 space-y-4 print:hidden">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                    <input
                      type="text"
                      placeholder="Search gear by name, brand or asset tag..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-primary transition"
                    />
                  </div>

                  {/* Physical Label Template Select */}
                  <div className="flex items-center gap-2 bg-neutral-100/60 pl-4 pr-2 py-1.5 border border-neutral-200 rounded-2xl shrink-0">
                    <label className="text-[10px] font-black uppercase text-neutral-400 tracking-wider shrink-0">Label Size:</label>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => handleTemplateChange(e.target.value)}
                      className="bg-transparent py-2 rounded-xl text-xs font-bold outline-none cursor-pointer text-neutral-800"
                    >
                      {TEMPLATES.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={selectAll}
                    className="px-6 py-3 bg-neutral-100 text-neutral-600 rounded-2xl font-bold hover:bg-neutral-200 transition text-sm shrink-0"
                  >
                    {selectedIds.size === filteredItems.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2">
                  {filteredItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => toggleSelect(item.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition text-xs font-bold ${
                        selectedIds.has(item.id)
                          ? 'bg-primary/10 border-primary text-primary'
                          : 'bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300'
                      }`}
                    >
                      {selectedIds.has(item.id) && <Check size={14} />}
                      <span>{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview / Print Area */}
              <div className="flex-1 overflow-y-auto p-8 bg-neutral-50 print:bg-white print:p-0">
                <div 
                  className="grid gap-6 print:gap-0"
                  style={{ 
                    gridTemplateColumns: smartMode ? 'repeat(auto-fill, minmax(200px, 1fr))' : `repeat(${config.columns}, 1fr)`,
                    display: 'grid'
                  }}
                >
                  {selectedItems.length === 0 ? (
                    <div className="col-span-full py-20 text-center space-y-4 print:hidden">
                      <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto text-neutral-300">
                        <Tag size={32} />
                      </div>
                      <p className="text-neutral-400 font-medium">No items selected for printing</p>
                    </div>
                  ) : (
                    selectedItems.map(item => {
                      const itemConfig = getSmartConfig(item);
                      return (
                        <div 
                          key={item.id} 
                          className={`bg-white border border-neutral-200 shadow-sm flex items-center justify-center text-center print:border-neutral-300 print:rounded-none print:shadow-none print:break-inside-avoid overflow-hidden relative ${
                            itemConfig.layout === 'cable' ? 'flex-row' : 'flex-col'
                          }`}
                          style={{ 
                            width: `${itemConfig.width}mm`,
                            height: `${itemConfig.height}mm`,
                            padding: itemConfig.layout === 'tiny' ? '1mm' : '4mm',
                            margin: '0 auto'
                          }}
                        >
                          {itemConfig.layout !== 'tiny' && (
                            <div className={`w-full flex justify-between items-start mb-2 ${itemConfig.layout === 'cable' ? 'hidden' : ''}`}>
                              {itemConfig.showTag && (
                                <div className="text-left">
                                  <p className="text-[8px] font-black uppercase tracking-widest text-neutral-400">Asset Tag</p>
                                  <p className="text-[10px] font-mono font-bold">{item.assetTag}</p>
                                </div>
                              )}
                              <QrCode size={12} className="text-neutral-300" />
                            </div>
                          )}
                          
                          <div 
                            className="bg-white p-1 rounded-lg border border-neutral-100 shrink-0"
                            style={{ width: `${itemConfig.qrSize}mm`, height: `${itemConfig.qrSize}mm` }}
                          >
                            <QRCodeCanvas
                              value={item.id ? `${window.location.origin}/gear/${item.id}?owner=${item.ownerId || user?.uid || ''}` : item.assetTag}
                              size={itemConfig.qrSize * 3.78} // mm to px approx
                              level="H"
                              includeMargin={false}
                              style={{ width: '100%', height: '100%' }}
                            />
                          </div>

                          {(itemConfig.showName || itemConfig.showBrand) && (
                            <div 
                              className={`space-y-0.5 ${itemConfig.layout === 'cable' ? 'ml-4 text-left' : 'mt-2'}`}
                              style={{ fontSize: `${itemConfig.fontSize}pt` }}
                            >
                              {itemConfig.showName && <p className="font-black leading-tight">{item.name}</p>}
                              {itemConfig.showBrand && (
                                <p className="text-[0.7em] text-neutral-500 font-bold uppercase tracking-wider">
                                  {item.brand || item.category}
                                </p>
                              )}
                            </div>
                          )}

                          {itemConfig.layout === 'standard' && (
                            <div className="absolute bottom-2 left-0 right-0 flex justify-center opacity-30">
                              <p className="text-[6px] text-neutral-300 font-mono">SCAN TO IDENTIFY</p>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer - Hidden on Print */}
            <div className="p-8 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between print:hidden">
              <div className="flex items-center gap-4 text-sm text-neutral-500">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-primary rounded-full"></div>
                  <span>{selectedIds.size} Items Selected</span>
                </div>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                Tip: Use 2x3" adhesive labels for best results
              </p>
            </div>
          </motion.div>

          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              body * {
                visibility: hidden;
              }
              .print\\:block, .print\\:block * {
                visibility: visible;
              }
              .print\\:block {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
              }
              .print\\:hidden {
                display: none !important;
              }
            }
          `}} />
        </div>
      )}
    </AnimatePresence>
  );
}
