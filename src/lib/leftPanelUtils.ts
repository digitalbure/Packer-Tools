import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, LeftPanelCustomization } from '../types';

export interface QuickAccessPresetItem {
  id: string;
  label: string;
  to: string;
  defaultColor: string;
  defaultFilled: boolean;
  iconName: string;
}

export const DEFAULT_QUICK_ACCESS_ITEMS: QuickAccessPresetItem[] = [
  { id: 'quick_lists', label: 'Lists', to: '/dashboard?tab=lists', defaultColor: 'indigo', defaultFilled: true, iconName: 'ListChecks' },
  { id: 'quick_add_gear', label: 'Add Gear', to: '/library?addGear=true', defaultColor: 'dark', defaultFilled: true, iconName: 'Plus' },
  { id: 'quick_new_list', label: 'New List', to: '/dashboard?create=true', defaultColor: 'orange', defaultFilled: true, iconName: 'Plus' },
  { id: 'quick_dashboard', label: 'Dashboard', to: '/dashboard', defaultColor: 'slate', defaultFilled: false, iconName: 'LayoutDashboard' },
  { id: 'quick_organizer', label: 'Organizer', to: '/organizer', defaultColor: 'slate', defaultFilled: false, iconName: 'Layers' },
  { id: 'quick_scan', label: 'Scan to Pack', to: '/scan/new', defaultColor: 'dark', defaultFilled: true, iconName: 'QrCode' },
  { id: 'quick_label_studio', label: 'Label Studio', to: '#label-studio', defaultColor: 'emerald', defaultFilled: true, iconName: 'Printer' },
];

export interface ColorPreset {
  id: string;
  name: string;
  bgFilled: string;
  bgOutline: string;
  hex: string;
}

export const BUTTON_COLOR_PRESETS: ColorPreset[] = [
  { id: 'indigo', name: 'Indigo', bgFilled: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20', bgOutline: 'bg-indigo-50/80 text-indigo-700 border border-indigo-200 hover:bg-indigo-100', hex: '#4f46e5' },
  { id: 'orange', name: 'Primary Orange', bgFilled: 'bg-[#F27D26] hover:bg-[#d96818] text-white shadow-lg shadow-[#F27D26]/20', bgOutline: 'bg-orange-50/80 text-orange-700 border border-orange-200 hover:bg-orange-100', hex: '#F27D26' },
  { id: 'emerald', name: 'Emerald Green', bgFilled: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20', bgOutline: 'bg-emerald-50/80 text-emerald-700 border border-emerald-200 hover:bg-emerald-100', hex: '#10b981' },
  { id: 'dark', name: 'Charcoal Dark', bgFilled: 'bg-neutral-900 hover:bg-neutral-800 text-white shadow-lg shadow-neutral-900/20', bgOutline: 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border border-neutral-250', hex: '#171717' },
  { id: 'violet', name: 'Deep Violet', bgFilled: 'bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-600/20', bgOutline: 'bg-violet-50/80 text-violet-700 border border-violet-200 hover:bg-violet-100', hex: '#8b5cf6' },
  { id: 'rose', name: 'Crimson Rose', bgFilled: 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/20', bgOutline: 'bg-rose-50/80 text-rose-700 border border-rose-200 hover:bg-rose-100', hex: '#f43f5e' },
  { id: 'amber', name: 'Amber Gold', bgFilled: 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20', bgOutline: 'bg-amber-50/80 text-amber-800 border border-amber-200 hover:bg-amber-100', hex: '#f59e0b' },
  { id: 'cyan', name: 'Electric Cyan', bgFilled: 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-lg shadow-cyan-600/20', bgOutline: 'bg-cyan-50/80 text-cyan-800 border border-cyan-200 hover:bg-cyan-100', hex: '#06b6d4' },
  { id: 'sky', name: 'Sky Blue', bgFilled: 'bg-sky-600 hover:bg-sky-700 text-white shadow-lg shadow-sky-600/20', bgOutline: 'bg-sky-50/80 text-sky-700 border border-sky-200 hover:bg-sky-100', hex: '#0284c7' },
  { id: 'teal', name: 'Teal Blue', bgFilled: 'bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-600/20', bgOutline: 'bg-teal-50/80 text-teal-700 border border-teal-200 hover:bg-teal-100', hex: '#0d9488' },
  { id: 'slate', name: 'Slate Gray', bgFilled: 'bg-slate-700 hover:bg-slate-800 text-white shadow-lg shadow-slate-700/20', bgOutline: 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-250', hex: '#334155' },
];

export function getButtonStyleClasses(colorId: string = 'slate', isFilled: boolean = false, isActive: boolean = false): string {
  const preset = BUTTON_COLOR_PRESETS.find(p => p.id === colorId) || BUTTON_COLOR_PRESETS[3]; // default dark or slate
  if (isActive) {
    return 'bg-accent text-white shadow-lg shadow-accent/20 border-none';
  }
  return isFilled ? preset.bgFilled : preset.bgOutline;
}

export async function saveLeftPanelCustomization(
  user: UserProfile,
  customization: LeftPanelCustomization,
  onUpdate?: (updatedUser: UserProfile) => void
): Promise<boolean> {
  try {
    const userRef = doc(db, 'users', user.uid);
    const updatedPreferences = {
      ...(user.layoutPreferences || {}),
      leftPanelCustomization: customization
    };
    await updateDoc(userRef, {
      layoutPreferences: updatedPreferences
    });
    if (onUpdate) {
      onUpdate({
        ...user,
        layoutPreferences: updatedPreferences
      });
    }
    return true;
  } catch (error) {
    console.error("Error saving left panel customization:", error);
    return false;
  }
}
