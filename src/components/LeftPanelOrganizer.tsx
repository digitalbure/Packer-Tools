import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowUp, 
  ArrowDown, 
  Check, 
  RotateCcw, 
  Palette, 
  Eye, 
  EyeOff, 
  Pin, 
  PinOff, 
  Sparkles, 
  Sliders, 
  ListChecks, 
  Plus, 
  LayoutDashboard, 
  Layers, 
  QrCode, 
  Printer, 
  Box, 
  Wrench, 
  Building2, 
  Truck, 
  Users, 
  HelpCircle,
  Paintbrush
} from 'lucide-react';
import { UserProfile, LeftPanelCustomization } from '../types';
import { 
  BUTTON_COLOR_PRESETS, 
  DEFAULT_QUICK_ACCESS_ITEMS, 
  getButtonStyleClasses, 
  saveLeftPanelCustomization 
} from '../lib/leftPanelUtils';
import { toast } from 'sonner';

interface LeftPanelOrganizerProps {
  user: UserProfile;
  onUpdate: (updatedUser: UserProfile) => void;
  compact?: boolean;
}

export interface EditableLeftPanelItem {
  id: string;
  label: string;
  to: string;
  iconName: string;
  inQuickAccess: boolean;
  isFilled: boolean;
  color: string;
  hidden: boolean;
  order: number;
}

const MASTER_LEFT_PANEL_ITEMS: { id: string; label: string; to: string; iconName: string; defaultColor: string; defaultFilled: boolean; defaultQuick: boolean }[] = [
  { id: 'quick_lists', label: 'Lists', to: '/dashboard?tab=lists', iconName: 'ListChecks', defaultColor: 'indigo', defaultFilled: true, defaultQuick: true },
  { id: 'quick_add_gear', label: 'Add Gear', to: '/library?addGear=true', iconName: 'Plus', defaultColor: 'dark', defaultFilled: true, defaultQuick: true },
  { id: 'quick_new_list', label: 'New List', to: '/dashboard?create=true', iconName: 'Plus', defaultColor: 'orange', defaultFilled: true, defaultQuick: true },
  { id: 'quick_dashboard', label: 'Dashboard', to: '/dashboard', iconName: 'LayoutDashboard', defaultColor: 'slate', defaultFilled: false, defaultQuick: true },
  { id: 'quick_organizer', label: 'Organizer', to: '/organizer', iconName: 'Layers', defaultColor: 'slate', defaultFilled: false, defaultQuick: true },
  { id: 'quick_scan', label: 'Scan to Pack', to: '/scan/new', iconName: 'QrCode', defaultColor: 'dark', defaultFilled: true, defaultQuick: true },
  { id: 'quick_label_studio', label: 'Label Studio', to: '#label-studio', iconName: 'Printer', defaultColor: 'emerald', defaultFilled: true, defaultQuick: true },
  { id: 'nav_library', label: 'Gear Library', to: '/library', iconName: 'Box', defaultColor: 'violet', defaultFilled: false, defaultQuick: false },
  { id: 'nav_inventory', label: 'Inventories', to: '/inventory', iconName: 'Layers', defaultColor: 'cyan', defaultFilled: false, defaultQuick: false },
  { id: 'nav_organization', label: 'Organization', to: '/organization', iconName: 'Building2', defaultColor: 'rose', defaultFilled: false, defaultQuick: false },
  { id: 'nav_logistics', label: 'Logistics', to: '/logistics', iconName: 'Truck', defaultColor: 'amber', defaultFilled: false, defaultQuick: false },
  { id: 'nav_systems', label: 'Systems Builder', to: '/systems-builder', iconName: 'Wrench', defaultColor: 'teal', defaultFilled: false, defaultQuick: false },
  { id: 'nav_marketplace', label: 'Marketplace', to: '/marketplace', iconName: 'Users', defaultColor: 'sky', defaultFilled: false, defaultQuick: false },
];

export const LeftPanelOrganizer: React.FC<LeftPanelOrganizerProps> = ({
  user,
  onUpdate,
  compact = false
}) => {
  const existingCustomization: LeftPanelCustomization = user.layoutPreferences?.leftPanelCustomization || {};

  // Build initial list
  const [items, setItems] = useState<EditableLeftPanelItem[]>(() => {
    const savedConfigs = existingCustomization.itemConfigs || {};
    const savedQuickIds = existingCustomization.quickAccessItemIds;
    const savedOrder = existingCustomization.navItemIdsOrder;

    let list: EditableLeftPanelItem[] = MASTER_LEFT_PANEL_ITEMS.map((master, idx) => {
      const cfg = savedConfigs[master.id] || savedConfigs[master.to] || {};
      const inQuickAccess = cfg.inQuickAccess !== undefined 
        ? cfg.inQuickAccess 
        : (savedQuickIds ? savedQuickIds.includes(master.id) : master.defaultQuick);
      
      return {
        id: master.id,
        label: cfg.label || master.label,
        to: master.to,
        iconName: master.iconName,
        inQuickAccess: !!inQuickAccess,
        isFilled: cfg.isFilled !== undefined ? cfg.isFilled : master.defaultFilled,
        color: cfg.color || master.defaultColor,
        hidden: !!cfg.hidden,
        order: cfg.order !== undefined ? cfg.order : idx
      };
    });

    if (savedOrder && savedOrder.length > 0) {
      list.sort((a, b) => {
        const idxA = savedOrder.indexOf(a.id);
        const idxB = savedOrder.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.order - b.order;
      });
    } else {
      list.sort((a, b) => a.order - b.order);
    }

    return list;
  });

  const [activeTab, setActiveTab] = useState<'quick' | 'nav' | 'presets'>('quick');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  // Helper icon renderer
  const renderIcon = (iconName: string, size = 18) => {
    switch (iconName) {
      case 'ListChecks': return <ListChecks size={size} />;
      case 'Plus': return <Plus size={size} />;
      case 'LayoutDashboard': return <LayoutDashboard size={size} />;
      case 'Layers': return <Layers size={size} />;
      case 'QrCode': return <QrCode size={size} />;
      case 'Printer': return <Printer size={size} />;
      case 'Box': return <Box size={size} />;
      case 'Wrench': return <Wrench size={size} />;
      case 'Building2': return <Building2 size={size} />;
      case 'Truck': return <Truck size={size} />;
      case 'Users': return <Users size={size} />;
      default: return <HelpCircle size={size} />;
    }
  };

  // Reorder items
  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;
    // update order indexes
    newItems.forEach((it, idx) => { it.order = idx; });
    setItems(newItems);
  };

  // Toggle quick access
  const toggleQuickAccess = (id: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, inQuickAccess: !item.inQuickAccess };
      }
      return item;
    }));
  };

  // Toggle fill background
  const toggleFill = (id: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, isFilled: !item.isFilled };
      }
      return item;
    }));
  };

  // Set color
  const setColor = (id: string, color: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, color };
      }
      return item;
    }));
  };

  // Toggle hidden
  const toggleHidden = (id: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, hidden: !item.hidden };
      }
      return item;
    }));
  };

  // Apply Presets
  const applyPreset = (presetName: 'default' | 'vibrant' | 'dark' | 'ghost') => {
    setSelectedPreset(presetName);
    setItems(prev => prev.map(item => {
      if (presetName === 'default') {
        const original = MASTER_LEFT_PANEL_ITEMS.find(m => m.id === item.id);
        return {
          ...item,
          color: original?.defaultColor || 'slate',
          isFilled: original?.defaultFilled || false,
          inQuickAccess: original?.defaultQuick || false,
          hidden: false
        };
      }
      if (presetName === 'vibrant') {
        const colors = ['orange', 'indigo', 'emerald', 'violet', 'rose', 'cyan', 'amber'];
        const randomColor = colors[Math.abs(item.id.length) % colors.length];
        return {
          ...item,
          color: randomColor,
          isFilled: true,
          inQuickAccess: true
        };
      }
      if (presetName === 'dark') {
        return {
          ...item,
          color: 'dark',
          isFilled: true
        };
      }
      if (presetName === 'ghost') {
        return {
          ...item,
          color: 'slate',
          isFilled: false
        };
      }
      return item;
    }));
    toast.success(`Applied ${presetName.toUpperCase()} left panel style preset!`);
  };

  // Save changes
  const handleSave = async () => {
    setIsSaving(true);
    const itemConfigs: { [id: string]: any } = {};
    const quickAccessItemIds: string[] = [];
    const navItemIdsOrder: string[] = [];

    items.forEach((item, idx) => {
      itemConfigs[item.id] = {
        label: item.label,
        inQuickAccess: item.inQuickAccess,
        isFilled: item.isFilled,
        color: item.color,
        hidden: item.hidden,
        order: idx
      };
      if (item.inQuickAccess && !item.hidden) {
        quickAccessItemIds.push(item.id);
      }
      navItemIdsOrder.push(item.id);
    });

    const customizationPayload: LeftPanelCustomization = {
      isEditModeActive: true,
      quickAccessItemIds,
      navItemIdsOrder,
      itemConfigs
    };

    const success = await saveLeftPanelCustomization(user, customizationPayload, onUpdate);
    setIsSaving(false);

    if (success) {
      toast.success("Left Panel & Quick Access preferences saved successfully!");
    } else {
      toast.error("Failed to save left panel settings. Please try again.");
    }
  };

  const quickItems = items.filter(i => i.inQuickAccess && !i.hidden);
  const navItemsList = items.filter(i => !i.hidden);

  return (
    <div className="bg-white rounded-3xl border border-neutral-150 p-5 sm:p-6 space-y-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-neutral-100">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-500 via-[#F27D26] to-amber-500 text-white rounded-2xl shadow-md">
            <Sliders size={20} className="stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-base font-black uppercase tracking-tight text-neutral-900 flex items-center gap-2">
              Organize Left Panel & Quick Access
              <span className="text-[10px] bg-indigo-50 text-indigo-700 font-extrabold px-2 py-0.5 rounded-full border border-indigo-200 uppercase tracking-widest">
                Interactive Customizer
              </span>
            </h3>
            <p className="text-xs text-neutral-400 font-bold mt-0.5">
              Rearrange menu items, select quick access shortcuts, toggle filled button backgrounds, and choose custom colors.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => applyPreset('default')}
            className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl font-bold text-xs transition flex items-center gap-1.5"
            title="Reset to defaults"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 bg-[#F27D26] hover:bg-[#d96818] text-white rounded-xl font-extrabold text-xs shadow-lg shadow-[#F27D26]/20 transition flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            {isSaving ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <Check size={16} className="stroke-[3]" />
            )}
            <span>Save Preferences</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-neutral-100 p-1.5 rounded-2xl">
        <button
          type="button"
          onClick={() => setActiveTab('quick')}
          className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'quick' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <Pin size={14} />
          <span>Quick Access Buttons ({quickItems.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('nav')}
          className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'nav' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <Sliders size={14} />
          <span>Left Panel Rearrange ({items.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('presets')}
          className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'presets' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <Paintbrush size={14} />
          <span>Style Presets</span>
        </button>
      </div>

      {/* LIVE PREVIEW BOX */}
      <div className="bg-neutral-900 rounded-3xl p-4 text-white space-y-3 shadow-inner">
        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-neutral-400">
          <span className="flex items-center gap-1.5">
            <Sparkles size={12} className="text-[#F27D26]" /> Live Left Panel Preview
          </span>
          <span className="text-neutral-500">{quickItems.length} Quick Access Buttons Active</span>
        </div>

        {/* Render preview grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {quickItems.map(item => {
            const styleClasses = getButtonStyleClasses(item.color, item.isFilled);
            return (
              <div
                key={`preview-${item.id}`}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl font-bold text-xs transition-all ${styleClasses}`}
              >
                {renderIcon(item.iconName, 16)}
                <span className="truncate">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* TAB CONTENT: QUICK ACCESS BUTTONS */}
      {activeTab === 'quick' && (
        <div className="space-y-4">
          <p className="text-xs text-neutral-500 font-medium">
            Toggle which items appear as high-priority quick access buttons at the top of your left panel. Choose custom fill backgrounds and color accents for each button.
          </p>

          <div className="space-y-3">
            {items.map((item, index) => {
              const preset = BUTTON_COLOR_PRESETS.find(p => p.id === item.color) || BUTTON_COLOR_PRESETS[0];

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    item.inQuickAccess 
                      ? 'bg-white border-neutral-200 shadow-sm' 
                      : 'bg-neutral-50/70 border-neutral-150 opacity-70'
                  }`}
                >
                  {/* Item Left Info */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveItem(index, 'up')}
                        disabled={index === 0}
                        className="p-1 text-neutral-400 hover:text-neutral-900 disabled:opacity-20 transition"
                        title="Move Up"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveItem(index, 'down')}
                        disabled={index === items.length - 1}
                        className="p-1 text-neutral-400 hover:text-neutral-900 disabled:opacity-20 transition"
                        title="Move Down"
                      >
                        <ArrowDown size={14} />
                      </button>
                    </div>

                    {/* Preview Button */}
                    <div className={`p-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shrink-0 ${getButtonStyleClasses(item.color, item.isFilled)}`}>
                      {renderIcon(item.iconName, 16)}
                      <span>{item.label}</span>
                    </div>
                  </div>

                  {/* Controls Right */}
                  <div className="flex flex-wrap items-center gap-3 self-end md:self-auto">
                    {/* In Quick Access Toggle */}
                    <button
                      type="button"
                      onClick={() => toggleQuickAccess(item.id)}
                      className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition flex items-center gap-1.5 border ${
                        item.inQuickAccess 
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                          : 'bg-neutral-100 border-neutral-200 text-neutral-500'
                      }`}
                    >
                      {item.inQuickAccess ? <Pin size={13} className="fill-indigo-700" /> : <PinOff size={13} />}
                      <span>{item.inQuickAccess ? 'In Quick Access' : 'Pin to Quick Access'}</span>
                    </button>

                    {/* Filled Background Toggle */}
                    <button
                      type="button"
                      onClick={() => toggleFill(item.id)}
                      className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition flex items-center gap-1.5 border ${
                        item.isFilled 
                          ? 'bg-neutral-900 text-white border-neutral-900' 
                          : 'bg-white text-neutral-700 border-neutral-300'
                      }`}
                    >
                      <Palette size={13} />
                      <span>{item.isFilled ? 'Solid Fill' : 'Ghost Outline'}</span>
                    </button>

                    {/* Color Swatch Picker */}
                    <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl border border-neutral-200">
                      {BUTTON_COLOR_PRESETS.slice(0, 7).map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setColor(item.id, c.id)}
                          style={{ backgroundColor: c.hex }}
                          className={`w-5 h-5 rounded-full transition-transform ${
                            item.color === c.id ? 'scale-125 ring-2 ring-offset-1 ring-neutral-900' : 'hover:scale-110 opacity-80'
                          }`}
                          title={c.name}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB CONTENT: LEFT PANEL REARRANGE */}
      {activeTab === 'nav' && (
        <div className="space-y-4">
          <p className="text-xs text-neutral-500 font-medium">
            Drag or click arrows to rearrange the order of navigation links on your left panel. You can also hide links you rarely use.
          </p>

          <div className="space-y-2">
            {items.map((item, index) => (
              <div
                key={`nav-rearrange-${item.id}`}
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                  item.hidden ? 'bg-neutral-100/50 border-neutral-200 opacity-50' : 'bg-white border-neutral-200 shadow-sm'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-neutral-400">
                    <span className="text-[10px] font-black w-4 text-center">{index + 1}</span>
                    <button
                      type="button"
                      onClick={() => moveItem(index, 'up')}
                      disabled={index === 0}
                      className="p-1 hover:text-neutral-900 disabled:opacity-20 transition"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(index, 'down')}
                      disabled={index === items.length - 1}
                      className="p-1 hover:text-neutral-900 disabled:opacity-20 transition"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-neutral-100 rounded-xl text-neutral-700">
                      {renderIcon(item.iconName, 16)}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-neutral-900 block">{item.label}</span>
                      <span className="text-[10px] text-neutral-400 font-medium">{item.to}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleHidden(item.id)}
                    className={`p-2 rounded-xl transition ${
                      item.hidden ? 'bg-amber-100 text-amber-800' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                    title={item.hidden ? 'Show on Panel' : 'Hide from Panel'}
                  >
                    {item.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: STYLE PRESETS */}
      {activeTab === 'presets' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 bg-neutral-50 border border-neutral-200 rounded-2xl space-y-3">
            <h4 className="text-xs font-black uppercase text-neutral-900 tracking-wider">Default Balanced</h4>
            <p className="text-[11px] text-neutral-500">
              Original Packer Tools clean hierarchy with mixed solid badges and subtle navigation shortcuts.
            </p>
            <button
              type="button"
              onClick={() => applyPreset('default')}
              className="w-full py-2.5 bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-800 rounded-xl font-extrabold text-xs transition"
            >
              Apply Default Theme
            </button>
          </div>

          <div className="p-5 bg-neutral-50 border border-neutral-200 rounded-2xl space-y-3">
            <h4 className="text-xs font-black uppercase text-indigo-700 tracking-wider">Vibrant Rainbow</h4>
            <p className="text-[11px] text-neutral-500">
              High-visibility colorful filled buttons for rapid visual recognition during fast-paced operations.
            </p>
            <button
              type="button"
              onClick={() => applyPreset('vibrant')}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-extrabold text-xs transition shadow-md shadow-indigo-600/20"
            >
              Apply Vibrant Theme
            </button>
          </div>

          <div className="p-5 bg-neutral-50 border border-neutral-200 rounded-2xl space-y-3">
            <h4 className="text-xs font-black uppercase text-neutral-900 tracking-wider">Executive Charcoal</h4>
            <p className="text-[11px] text-neutral-500">
              Sleek dark monochrome filled buttons for high contrast corporate workspaces.
            </p>
            <button
              type="button"
              onClick={() => applyPreset('dark')}
              className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-extrabold text-xs transition shadow-md"
            >
              Apply Dark Stealth
            </button>
          </div>

          <div className="p-5 bg-neutral-50 border border-neutral-200 rounded-2xl space-y-3">
            <h4 className="text-xs font-black uppercase text-neutral-700 tracking-wider">Subtle Ghost Outlines</h4>
            <p className="text-[11px] text-neutral-500">
              Minimalist thin outlines with no solid backgrounds for a clean, non-distracting left sidebar.
            </p>
            <button
              type="button"
              onClick={() => applyPreset('ghost')}
              className="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl font-extrabold text-xs transition"
            >
              Apply Ghost Style
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeftPanelOrganizer;
