import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import {
  Sparkles, CreditCard, Building2, ShoppingBag, Wrench, Save, Upload, Plus, Trash2, AlertCircle, Coins,
  Activity, Layers, Cpu, Truck, QrCode, LogOut, CheckCircle2, User, Clock, ShieldCheck, Mail, Phone, MapPin,
  Globe, Info, FileText, Percent, HelpCircle, Laptop, Smartphone, Eye, Layout, Sliders, Check, Settings,
  Server, Lock, Camera
} from 'lucide-react';
import { AdminSettings, OnboardedCurrency, PaymentGatewayMethod, Plan, UserProfile } from '../types';
import AddPhotoWidget from './AddPhotoWidget';
import { toast } from 'sonner';

interface SettingsTabProps {
  settings: AdminSettings | null;
  setSettings: React.Dispatch<React.SetStateAction<AdminSettings | null>>;
  user?: UserProfile;
}

/** 
 * =========================================================================
 * 1. BRANDING & PLATFORM IDENTITY SETTINGS
 * =========================================================================
 */
export function BrandingSettingsTab({ settings, setSettings, user }: SettingsTabProps) {
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkHref, setNewLinkHref] = useState('');
  const [isExternal, setIsExternal] = useState(false);

  // States for dynamic logo/icon uploads using the AddPhotoWidget
  const [isPhotoWidgetOpen, setIsPhotoWidgetOpen] = useState(false);
  const [photoTarget, setPhotoTarget] = useState<'logo' | 'pwaIcon192' | 'pwaIcon512' | 'favicon' | null>(null);

  const handlePhotoAdded = (urls: string[]) => {
    if (urls.length > 0 && photoTarget) {
      const url = urls[0];
      setSettings((s) => {
        if (!s) return null;
        const b = s.branding || { companyName: '', logo: '', pwaName: '', pwaShortName: '', pwaBgColor: '', pwaThemeColor: '', pwaIcon192Url: '', pwaIcon512Url: '', faviconUrl: '' };
        if (photoTarget === 'logo') {
          return { ...s, branding: { ...b, logo: url } };
        } else if (photoTarget === 'favicon') {
          return { ...s, branding: { ...b, faviconUrl: url } };
        } else if (photoTarget === 'pwaIcon192') {
          return { ...s, branding: { ...b, pwaIcon192Url: url } };
        } else if (photoTarget === 'pwaIcon512') {
          return { ...s, branding: { ...b, pwaIcon512Url: url } };
        }
        return s;
      });
      toast.success(`Successfully uploaded branding/PWA asset!`);
    }
  };

  const handleAddFooterLink = () => {
    if (!newLinkLabel || !newLinkHref) {
      toast.error("Please provide both label and URL/href for the link.");
      return;
    }
    setSettings((s) => {
      if (!s) return null;
      const fCfg = s.footerNavConfig || { enabled: true, alignMobileCentred: false, links: [] };
      return {
        ...s,
        footerNavConfig: {
          ...fCfg,
          links: [...(fCfg.links || []), { label: newLinkLabel, href: newLinkHref, isExternal }]
        }
      };
    });
    setNewLinkLabel('');
    setNewLinkHref('');
    setIsExternal(false);
    toast.success("Footer link added dynamically!");
  };

  const handleRemoveFooterLink = (idx: number) => {
    setSettings((s) => {
      if (!s) return null;
      const fCfg = s.footerNavConfig || { enabled: true, alignMobileCentred: false, links: [] };
      const nextLinks = [...(fCfg.links || [])];
      nextLinks.splice(idx, 1);
      return {
        ...s,
        footerNavConfig: { ...fCfg, links: nextLinks }
      };
    });
    toast.success("Link removed.");
  };

  return (
    <div className="space-y-6">
      {/* Platform Name & Main Contact settings */}
      <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-neutral-50 pb-4">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded-xl">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="font-extrabold uppercase text-sm tracking-tight text-neutral-800">Platform Identity & Contact</h3>
            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Configure company metadata and user help points</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Platform Public Name</label>
            <input
              type="text"
              value={settings?.branding?.companyName || ''}
              onChange={(e) => {
                const val = e.target.value;
                setSettings(s => s ? { ...s, branding: { ...s.branding, companyName: val } } : null);
              }}
              className="w-full px-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60 text-xs font-bold font-sans text-neutral-800 outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 transition"
              placeholder="Packer Tools"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Corporate Support Email</label>
            <input
              type="email"
              value={settings?.contactEmail || ''}
              onChange={(e) => {
                const val = e.target.value;
                setSettings(s => s ? { ...s, contactEmail: val } : null);
              }}
              className="w-full px-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60 text-xs font-bold text-neutral-800 outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 transition"
              placeholder="support@packertools.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Support Phone Hotline</label>
            <input
              type="text"
              value={settings?.contactPhone || ''}
              onChange={(e) => {
                const val = e.target.value;
                setSettings(s => s ? { ...s, contactPhone: val } : null);
              }}
              className="w-full px-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60 text-xs font-bold text-neutral-800 outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 transition"
              placeholder="+679 330 1234"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Office Registered Address</label>
            <input
              type="text"
              value={settings?.contactAddress || ''}
              onChange={(e) => {
                const val = e.target.value;
                setSettings(s => s ? { ...s, contactAddress: val } : null);
              }}
              className="w-full px-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60 text-xs font-bold text-neutral-800 outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 transition"
              placeholder="12 Victoria Parade, Suva, Fiji"
            />
          </div>
        </div>

        <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100 flex items-start gap-3">
          <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-amber-800 uppercase tracking-tight">Active Platform Billing Tier</p>
            <p className="text-amber-700/80 leading-normal mt-0.5">Enables standard payment gateways and auto invoice runs across the entire database.</p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSettings(s => s ? { ...s, billingEnabled: !s.billingEnabled } : null)}
                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                  settings?.billingEnabled
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'
                }`}
              >
                {settings?.billingEnabled ? 'Billing Active (Online)' : 'Billing Suspended (Offline)'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* PWA / Icon Pack customization */}
      <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-neutral-50 pb-4">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded-xl">
            <Laptop size={18} />
          </div>
          <div>
            <h3 className="font-extrabold uppercase text-sm tracking-tight text-neutral-800">Dynamic PWA & Splash Logo Specs</h3>
            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Configure brand launcher icons, meta theme coloration, and layouts</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Platform White-label Logo (URL)</label>
            <div className="flex gap-3">
              <input
                type="text"
                value={settings?.branding?.logo || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setSettings(s => s ? { ...s, branding: { ...s.branding, logo: val } } : null);
                }}
                className="flex-1 px-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60 text-xs font-semibold outline-none"
                placeholder="https://images.unsplash.com/your-brand-logo.svg"
              />
              <button
                type="button"
                onClick={() => {
                  setPhotoTarget('logo');
                  setIsPhotoWidgetOpen(true);
                }}
                className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold uppercase transition shrink-0 flex items-center gap-1.5"
              >
                <Camera size={14} />
                <span>Upload</span>
              </button>
              <div className="w-10 h-10 bg-neutral-100 rounded-xl border border-neutral-200 flex items-center justify-center shrink-0">
                {settings?.branding?.logo ? (
                  <img src={settings.branding.logo} referrerPolicy="no-referrer" alt="Brand target" className="object-contain w-8 h-8 rounded" />
                ) : (
                  <Sparkles size={16} className="text-neutral-400" />
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Platform Favicon (URL)</label>
            <div className="flex gap-3">
              <input
                type="text"
                value={settings?.branding?.faviconUrl || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setSettings(s => s ? { ...s, branding: { ...s.branding, faviconUrl: val } } : null);
                }}
                className="flex-1 px-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60 text-xs font-semibold outline-none"
                placeholder="https://images.unsplash.com/your-brand-favicon.ico"
              />
              <button
                type="button"
                onClick={() => {
                  setPhotoTarget('favicon');
                  setIsPhotoWidgetOpen(true);
                }}
                className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold uppercase transition shrink-0 flex items-center gap-1.5"
              >
                <Camera size={14} />
                <span>Upload</span>
              </button>
              <div className="w-10 h-10 bg-neutral-100 rounded-xl border border-neutral-200 flex items-center justify-center shrink-0">
                {settings?.branding?.faviconUrl ? (
                  <img src={settings.branding.faviconUrl} referrerPolicy="no-referrer" alt="Favicon target" className="object-contain w-8 h-8 rounded" />
                ) : (
                  <Sparkles size={16} className="text-neutral-400" />
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">PWA Full App Title</label>
              <input
                type="text"
                value={settings?.branding?.pwaName || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setSettings(s => s ? { ...s, branding: { ...s.branding, pwaName: val } } : null);
                }}
                className="w-full px-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60 text-xs font-bold text-neutral-800 outline-none"
                placeholder="Packer Workspace"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">PWA Short Name</label>
              <input
                type="text"
                value={settings?.branding?.pwaShortName || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setSettings(s => s ? { ...s, branding: { ...s.branding, pwaShortName: val } } : null);
                }}
                className="w-full px-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60 text-xs font-bold text-neutral-800 outline-none"
                placeholder="Packer"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">PWA Splash Background Color</label>
              <input
                type="text"
                value={settings?.branding?.pwaBgColor || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setSettings(s => s ? { ...s, branding: { ...s.branding, pwaBgColor: val } } : null);
                }}
                className="w-full px-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60 text-xs font-bold text-neutral-800 font-mono outline-none"
                placeholder="#030712"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">PWA Theme Color</label>
              <input
                type="text"
                value={settings?.branding?.pwaThemeColor || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setSettings(s => s ? { ...s, branding: { ...s.branding, pwaThemeColor: val } } : null);
                }}
                className="w-full px-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60 text-xs font-bold text-neutral-800 font-mono outline-none"
                placeholder="#ff6200"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">192px Android Icon URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={settings?.branding?.pwaIcon192Url || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSettings(s => s ? { ...s, branding: { ...s.branding, pwaIcon192Url: val } } : null);
                  }}
                  className="flex-1 px-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60 text-xs font-semibold text-neutral-800 outline-none"
                  placeholder="https://images.unsplash.com/icon-192.png"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPhotoTarget('pwaIcon192');
                    setIsPhotoWidgetOpen(true);
                  }}
                  className="px-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold uppercase transition shrink-0 flex items-center gap-1"
                >
                  <Camera size={13} />
                  <span>Upload</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">512px iOS Splash Icon URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={settings?.branding?.pwaIcon512Url || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSettings(s => s ? { ...s, branding: { ...s.branding, pwaIcon512Url: val } } : null);
                  }}
                  className="flex-1 px-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60 text-xs font-semibold text-neutral-800 outline-none"
                  placeholder="https://images.unsplash.com/icon-512.png"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPhotoTarget('pwaIcon512');
                    setIsPhotoWidgetOpen(true);
                  }}
                  className="px-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold uppercase transition shrink-0 flex items-center gap-1"
                >
                  <Camera size={13} />
                  <span>Upload</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer system and links */}
      <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-neutral-50 pb-4">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded-xl">
            <Layout size={18} />
          </div>
          <div>
            <h3 className="font-extrabold uppercase text-sm tracking-tight text-neutral-800">Footer Widget Navigation Links</h3>
            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Configure client page navigation rules & external links</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3.5 bg-neutral-55 rounded-xl border border-neutral-150">
            <div>
              <p className="text-xs font-bold uppercase text-neutral-800">Display Corporate Footer</p>
              <p className="text-[8.5px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">Toggle navigation blocks visible on public pages</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSettings(s => {
                  if (!s) return null;
                  const fCfg = s.footerNavConfig || { enabled: true, alignMobileCentred: false, links: [] };
                  return { ...s, footerNavConfig: { ...fCfg, enabled: !fCfg.enabled } };
                });
              }}
              className={`w-10 h-5 rounded-full relative transition-colors ${settings?.footerNavConfig?.enabled !== false ? 'bg-primary' : 'bg-neutral-250'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${settings?.footerNavConfig?.enabled !== false ? 'right-0.5' : 'left-0.5'}`}></div>
            </button>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-neutral-55 rounded-xl border border-neutral-150">
            <div>
              <p className="text-xs font-bold uppercase text-neutral-800">Centred alignment on mobile Devices</p>
              <p className="text-[8.5px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5 font-sans">Enforce horizontal block spacing on phone screens</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSettings(s => {
                  if (!s) return null;
                  const fCfg = s.footerNavConfig || { enabled: true, alignMobileCentred: false, links: [] };
                  return { ...s, footerNavConfig: { ...fCfg, alignMobileCentred: !fCfg.alignMobileCentred } };
                });
              }}
              className={`w-10 h-5 rounded-full relative transition-colors ${settings?.footerNavConfig?.alignMobileCentred ? 'bg-primary' : 'bg-neutral-250'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${settings?.footerNavConfig?.alignMobileCentred ? 'right-0.5' : 'left-0.5'}`}></div>
            </button>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-neutral-55 rounded-xl border border-neutral-150">
            <div>
              <p className="text-xs font-bold uppercase text-neutral-800">Display "How It Works" Column</p>
              <p className="text-[8.5px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">Toggle visibility of rental client guidelines column in footer</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSettings(s => {
                  if (!s) return null;
                  const fCfg = s.footerNavConfig || { enabled: true, alignMobileCentred: false, links: [] };
                  return { ...s, footerNavConfig: { ...fCfg, showHowItWorks: fCfg.showHowItWorks === false ? true : false } };
                });
              }}
              className={`w-10 h-5 rounded-full relative transition-colors ${settings?.footerNavConfig?.showHowItWorks !== false ? 'bg-primary' : 'bg-neutral-250'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${settings?.footerNavConfig?.showHowItWorks !== false ? 'right-0.5' : 'left-0.5'}`}></div>
            </button>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-neutral-55 rounded-xl border border-neutral-150">
            <div>
              <p className="text-xs font-bold uppercase text-neutral-800">Display "Join Us" Column</p>
              <p className="text-[8.5px] text-neutral-400 font-bold uppercase tracking-widest mt-0.5">Toggle visibility of social network community column in footer</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSettings(s => {
                  if (!s) return null;
                  const fCfg = s.footerNavConfig || { enabled: true, alignMobileCentred: false, links: [] };
                  return { ...s, footerNavConfig: { ...fCfg, showJoinUs: fCfg.showJoinUs === false ? true : false } };
                });
              }}
              className={`w-10 h-5 rounded-full relative transition-colors ${settings?.footerNavConfig?.showJoinUs !== false ? 'bg-primary' : 'bg-neutral-250'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${settings?.footerNavConfig?.showJoinUs !== false ? 'right-0.5' : 'left-0.5'}`}></div>
            </button>
          </div>

          <div className="space-y-3 pt-2">
            <span className="text-[10px] font-black uppercase text-neutral-450 tracking-widest block font-mono">Current Custom Anchors</span>
            {settings?.footerNavConfig?.links && settings.footerNavConfig.links.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {settings.footerNavConfig.links.map((link, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-xl border border-neutral-150 text-xs font-semibold">
                    <div>
                      <span className="text-neutral-850 font-extrabold">{link.label}</span>
                      <span className="text-[10px] font-mono text-neutral-400 block break-all">{link.href}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFooterLink(idx)}
                      className="p-1 px-2.5 bg-neutral-150 hover:bg-neutral-250 rounded-lg text-neutral-500 hover:text-black font-bold uppercase text-[9px] transition"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-4 rounded-xl border border-dashed border-neutral-200 text-center text-[10px] text-neutral-400 font-bold italic uppercase block">No custom footer links found</p>
            )}

            {/* Quick Add Form Links */}
            <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/60 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="space-y-1.5 sm:col-span-1">
                <span className="text-[9px] font-black uppercase text-neutral-400 block tracking-widest font-mono">Anchor Title</span>
                <input
                  type="text"
                  value={newLinkLabel}
                  onChange={(e) => setNewLinkLabel(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none"
                  placeholder="Terms of Sale"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-1">
                <span className="text-[9px] font-black uppercase text-neutral-400 block tracking-widest font-mono">Path/Href URL</span>
                <input
                  type="text"
                  value={newLinkHref}
                  onChange={(e) => setNewLinkHref(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none"
                  placeholder="/terms"
                />
              </div>
              <div className="flex gap-2 items-center justify-between sm:justify-start h-8">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isExternal}
                    onChange={(e) => setIsExternal(e.target.checked)}
                    className="rounded text-primary focus:ring-primary w-3.5 h-3.5 border-neutral-300"
                  />
                  <span className="text-[10px] font-extrabold uppercase text-neutral-500 tracking-wider">New Tab</span>
                </label>
                <button
                  type="button"
                  onClick={handleAddFooterLink}
                  className="px-4 py-1.5 bg-neutral-900 border border-neutral-850 hover:bg-black text-white text-[10px] font-black uppercase rounded-lg tracking-wider"
                >
                  Add Link
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isPhotoWidgetOpen && user && (
        <AddPhotoWidget
          isOpen={isPhotoWidgetOpen}
          onClose={() => {
            setIsPhotoWidgetOpen(false);
            setPhotoTarget(null);
          }}
          onPhotoAdded={(urls) => {
            handlePhotoAdded(urls);
            setIsPhotoWidgetOpen(false);
            setPhotoTarget(null);
          }}
          user={user}
          adminSettings={settings}
          targetName={
            photoTarget === 'logo'
              ? 'Platform Logo'
              : photoTarget === 'favicon'
              ? 'Favicon'
              : photoTarget === 'pwaIcon192'
              ? '192px Android Icon'
              : '512px iOS Splash Icon'
          }
        />
      )}
    </div>
  );
}

/** 
 * =========================================================================
 * 2. BILLING, FEES & CURRENCY CONFIGURATION
 * =========================================================================
 */
export function BillingSettingsTab({ settings, setSettings }: SettingsTabProps) {
  // Modal state variables
  const [isAddingCurrency, setIsAddingCurrency] = useState(false);
  const [newCurrencyCode, setNewCurrencyCode] = useState('');
  const [newCurrencyName, setNewCurrencyName] = useState('');
  const [newCurrencySymbol, setNewCurrencySymbol] = useState('');
  const [expandedCurrencyCode, setExpandedCurrencyCode] = useState<string | null>(null);

  const [isAddingGateway, setIsAddingGateway] = useState(false);
  const [newGatewayType, setNewGatewayType] = useState<'paypal' | 'manual'>('paypal');
  const [newGatewayName, setNewGatewayName] = useState('');
  const [newGatewayInstructions, setNewGatewayInstructions] = useState('');
  const [newGatewayPaypalClientId, setNewGatewayPaypalClientId] = useState('');

  // Currency Handlers
  const handleAddCurrency = () => {
    if (!newCurrencyCode || !newCurrencyName || !newCurrencySymbol) {
      toast.error("Please fill in all currency details.");
      return;
    }
    setSettings((s) => {
      if (!s) return null;
      const currencies = s.onboardedCurrencies || [];
      if (currencies.some(c => c.code.toUpperCase() === newCurrencyCode.toUpperCase())) {
        toast.error("Currency already onboarded.");
        return s;
      }
      return {
        ...s,
        onboardedCurrencies: [
          ...currencies,
          {
            code: newCurrencyCode.toUpperCase(),
            name: newCurrencyName,
            symbol: newCurrencySymbol,
            isActive: true,
            paymentMethods: []
          }
        ]
      };
    });
    setNewCurrencyCode('');
    setNewCurrencyName('');
    setNewCurrencySymbol('');
    setIsAddingCurrency(false);
    toast.success("Currency added successfully!");
  };

  const handleToggleCurrency = (code: string) => {
    setSettings((s) => {
      if (!s) return null;
      const currencies = s.onboardedCurrencies || [];
      return {
        ...s,
        onboardedCurrencies: currencies.map(c => 
          c.code === code ? { ...c, isActive: !c.isActive } : c
        )
      };
    });
  };

  const handleRemoveCurrency = (code: string) => {
    setSettings((s) => {
      if (!s) return null;
      const currencies = s.onboardedCurrencies || [];
      return {
        ...s,
        onboardedCurrencies: currencies.filter(c => c.code !== code)
      };
    });
    toast.success(`${code} removed.`);
  };

  // Gateway Handlers
  const handleAddGatewayToCurrency = (currencyCode: string) => {
    if (!newGatewayName) {
      toast.error("Please specify a gateway name.");
      return;
    }
    setSettings((s) => {
      if (!s) return null;
      const currencies = s.onboardedCurrencies || [];
      const updated = currencies.map((curr) => {
        if (curr.code !== currencyCode) return curr;
        const methods = curr.paymentMethods || [];
        const nextGateway: PaymentGatewayMethod = {
          gateway: newGatewayType,
          name: newGatewayName,
          instructions: newGatewayType === 'manual' ? newGatewayInstructions : undefined,
          paypalClientId: newGatewayType === 'paypal' ? newGatewayPaypalClientId : undefined,
          enabled: true
        };
        return {
          ...curr,
          paymentMethods: [...methods, nextGateway]
        };
      });
      return { ...s, onboardedCurrencies: updated };
    });
    setIsAddingGateway(false);
    setNewGatewayName('');
    setNewGatewayInstructions('');
    setNewGatewayPaypalClientId('');
    toast.success("Gateway added to currency!");
  };

  const handleToggleGateway = (currencyCode: string, gatewayName: string) => {
    setSettings((s) => {
      if (!s) return null;
      const currencies = s.onboardedCurrencies || [];
      const updated = currencies.map((curr) => {
        if (curr.code !== currencyCode) return curr;
        const methods = curr.paymentMethods || [];
        return {
          ...curr,
          paymentMethods: methods.map(g => 
            g.name === gatewayName ? { ...g, enabled: !g.enabled } : g
          )
        };
      });
      return { ...s, onboardedCurrencies: updated };
    });
  };

  const handleRemoveGateway = (currencyCode: string, gatewayName: string) => {
    setSettings((s) => {
      if (!s) return null;
      const currencies = s.onboardedCurrencies || [];
      const updated = currencies.map((curr) => {
        if (curr.code !== currencyCode) return curr;
        const methods = curr.paymentMethods || [];
        return {
          ...curr,
          paymentMethods: methods.filter(g => g.name !== gatewayName)
        };
      });
      return { ...s, onboardedCurrencies: updated };
    });
    toast.success("Gateway deleted.");
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Currencies Dashboard */}
      <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-neutral-50 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded-xl">
              <Coins size={18} />
            </div>
            <div>
              <h3 className="font-extrabold uppercase text-sm tracking-tight text-neutral-800">Onboarded Currencies & Payment Gateways</h3>
              <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Multi-currency setup and regional PSP integration</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsAddingCurrency(!isAddingCurrency)}
            className="px-4 py-2 bg-neutral-900 border border-neutral-850 hover:bg-black text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition"
          >
            {isAddingCurrency ? 'Cancel' : 'Onboard Currency'}
          </button>
        </div>

        {isAddingCurrency && (
          <div className="p-5 bg-neutral-950 text-white rounded-2xl border border-neutral-800 space-y-4 font-sans ring-1 ring-primary/15 animate-fade-in">
            <p className="text-xs font-black uppercase text-primary tracking-widest font-mono">Setup Currency Node</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <span className="text-[8px] uppercase tracking-wider font-extrabold text-neutral-400">Code (ISO)</span>
                <input
                  type="text"
                  maxLength={3}
                  value={newCurrencyCode}
                  onChange={(e) => setNewCurrencyCode(e.target.value)}
                  className="w-full px-3 py-1.5 bg-neutral-900 rounded border border-neutral-800 text-xs font-extrabold"
                  placeholder="AUD"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[8px] uppercase tracking-wider font-extrabold text-neutral-400">Display Name</span>
                <input
                  type="text"
                  value={newCurrencyName}
                  onChange={(e) => setNewCurrencyName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-neutral-900 rounded border border-neutral-800 text-xs font-bold"
                  placeholder="Australian Dollar"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[8px] uppercase tracking-wider font-extrabold text-neutral-400">Display Symbol</span>
                <input
                  type="text"
                  value={newCurrencySymbol}
                  onChange={(e) => setNewCurrencySymbol(e.target.value)}
                  className="w-full px-3 py-1.5 bg-neutral-900 rounded border border-neutral-800 text-xs font-bold font-mono"
                  placeholder="A$"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleAddCurrency}
                className="px-4 py-1.5 bg-primary text-white text-[10px] uppercase font-black tracking-widest rounded-lg h-7.5"
              >
                Confirm Onboard
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {settings?.onboardedCurrencies && settings.onboardedCurrencies.length > 0 ? (
            settings.onboardedCurrencies.map((curr) => {
              const isExpanded = expandedCurrencyCode === curr.code;
              return (
                <div key={curr.code} className="p-4 bg-neutral-50/70 border border-neutral-100 rounded-2xl flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-white border border-neutral-200 text-xs font-black font-mono tracking-widest text-neutral-800 rounded-lg">{curr.code}</span>
                      <div>
                        <span className="text-xs font-black text-neutral-800">{curr.name}</span>
                        <span className="text-[10px] font-semibold text-neutral-400 block mt-0.5">Symbol representation: <strong className="font-mono text-neutral-600">{curr.symbol}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleCurrency(curr.code)}
                        className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                          curr.isActive ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-neutral-100 text-neutral-400'
                        }`}
                      >
                        {curr.isActive ? 'Active (Live)' : 'Disabled'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedCurrencyCode(isExpanded ? null : curr.code)}
                        className="text-[9px] font-black border border-neutral-200/60 hover:border-neutral-300 bg-white px-2.5 py-1 rounded-lg uppercase tracking-wider text-neutral-500"
                      >
                        {isExpanded ? 'Hide Gateways' : 'PSP Gateways'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveCurrency(curr.code)}
                        className="p-1 text-neutral-400 hover:text-red-500 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* expanded PSP Gateways */}
                  {isExpanded && (
                    <div className="pt-3 border-t border-neutral-200/60 space-y-3">
                      <div className="flex justify-between items-center bg-neutral-100/50 p-2.5 rounded-xl border border-neutral-200/50">
                        <span className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Payment Gateways for {curr.code}</span>
                        <button
                          type="button"
                          onClick={() => setIsAddingGateway(!isAddingGateway)}
                          className="px-2.5 py-1 bg-neutral-900 hover:bg-black text-white text-[9px] font-black uppercase rounded-md tracking-wider h-6 flex items-center gap-1"
                        >
                          <Plus size={10} />
                          <span>Add PSP</span>
                        </button>
                      </div>

                      {isAddingGateway && (
                        <div className="p-4 bg-neutral-900 text-zinc-200 rounded-xl space-y-3 text-xs border border-zinc-800">
                          <p className="font-black text-[10px] uppercase text-primary tracking-widest font-mono">Initialize Gateway Parameter</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <span className="text-[8px] uppercase tracking-wider text-neutral-400 block">Gateway Category</span>
                              <select
                                value={newGatewayType}
                                onChange={(e) => setNewGatewayType(e.target.value as any)}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1 text-xs text-white"
                              >
                                <option value="paypal">PayPal Express Checkout</option>
                                <option value="manual">Manual / BSP Bank Deposit</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[8px] uppercase tracking-wider text-neutral-400 block">Display Title Label</span>
                              <input
                                type="text"
                                value={newGatewayName}
                                onChange={(e) => setNewGatewayName(e.target.value)}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1 text-xs text-white"
                                placeholder={newGatewayType === 'paypal' ? 'PayPal Checkout' : 'Fiji BSP Deposit'}
                              />
                            </div>
                          </div>

                          {newGatewayType === 'paypal' ? (
                            <div className="space-y-1">
                              <span className="text-[8px] uppercase tracking-wider text-neutral-400 block font-mono">PayPal Client ID</span>
                              <input
                                type="text"
                                value={newGatewayPaypalClientId}
                                onChange={(e) => setNewGatewayPaypalClientId(e.target.value)}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1 text-[10px] text-white font-mono"
                                placeholder="AWr6... (Live/Sandbox clientId)"
                              />
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <span className="text-[8px] uppercase tracking-wider text-neutral-400 block font-mono">BSP Deposit/Transfer Instructions</span>
                              <textarea
                                value={newGatewayInstructions}
                                rows={2}
                                onChange={(e) => setNewGatewayInstructions(e.target.value)}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1 text-[10px] text-white"
                                placeholder="Bank: BSP Fiji. A/C Number: 1234567. Branch: Suva..."
                              />
                            </div>
                          )}

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleAddGatewayToCurrency(curr.code)}
                              className="px-3 py-1 bg-primary text-white text-[9px] uppercase font-bold rounded"
                            >
                              Connect PSP
                            </button>
                          </div>
                        </div>
                      )}

                      {curr.paymentMethods && curr.paymentMethods.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {curr.paymentMethods.map((g, gIdx) => (
                            <div key={gIdx} className="bg-white p-3 rounded-xl border border-neutral-150 flex flex-col justify-between gap-2 shadow-sm">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-extrabold text-neutral-800 uppercase flex items-center gap-1">
                                  <ShieldCheck size={12} className="text-primary" />
                                  <span>{g.name}</span>
                                </span>
                                <span className="text-[8px] font-mono text-neutral-400 uppercase bg-neutral-100 rounded px-1.5 py-0.5">{g.gateway}</span>
                              </div>
                              {g.instructions && (
                                <p className="text-[9px] text-neutral-500 font-semibold bg-neutral-50 p-2.5 rounded-lg whitespace-pre-wrap tracking-tight line-clamp-2 md:h-10 border border-neutral-100 font-mono italic">{g.instructions}</p>
                              )}
                              {g.paypalClientId && (
                                <p className="text-[8px] text-neutral-400 font-mono bg-neutral-50 p-1.5 px-2 rounded truncate">CID: {g.paypalClientId}</p>
                              )}
                              <div className="flex items-center justify-between pt-1 border-t border-neutral-100 mt-1">
                                <button
                                  type="button"
                                  onClick={() => handleToggleGateway(curr.code, g.name)}
                                  className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                    g.enabled ? 'bg-primary/20 text-primary' : 'bg-neutral-100 text-neutral-400'
                                  }`}
                                >
                                  {g.enabled ? 'Enabled' : 'Disabled'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveGateway(curr.code, g.name)}
                                  className="text-red-500 hover:text-red-700 text-[8px] font-black uppercase tracking-widest"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[9px] text-neutral-400 font-bold italic text-center uppercase py-2">No PSP Gateways integrated for this currency key</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <p className="p-6 border border-dashed rounded-2xl text-center text-xs text-neutral-400 font-bold uppercase italic">No active currencies onboarded</p>
          )}
        </div>
      </div>

      {/* Hire Commissions and Platform Service Fees Panel */}
      <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-neutral-50 pb-4">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded-xl">
            <Percent size={18} />
          </div>
          <div>
            <h3 className="font-extrabold uppercase text-sm tracking-tight text-neutral-800 font-sans">Hire Commissions & Transaction Fees</h3>
            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Configure general marketplace take-rate percentages or category overrides</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Service Fee/Profit strategy</label>
            <div className="grid grid-cols-3 gap-2">
              {(['percentage', 'amount', 'both'] as const).map((strategy) => (
                <button
                  type="button"
                  key={strategy}
                  onClick={() => {
                    setSettings(s => {
                      if (!s) return null;
                      const cfg = s.commissionConfig || { defaultPercentage: 5, defaultAmount: 1.5, strategy: 'percentage' };
                      return { ...s, commissionConfig: { ...cfg, strategy } };
                    });
                  }}
                  className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                    (settings?.commissionConfig?.strategy || 'percentage') === strategy
                      ? 'bg-neutral-900 border-neutral-900 text-white shadow-sm'
                      : 'bg-neutral-50 text-neutral-400 border-neutral-200/60 hover:border-neutral-300'
                  }`}
                >
                  {strategy}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-neutral-500 id-label tracking-wider">Default Rate Percentage (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={settings?.commissionConfig?.defaultPercentage ?? 5}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSettings(s => {
                    if (!s) return null;
                    const cfg = s.commissionConfig || { defaultPercentage: 5, defaultAmount: 1.5, strategy: 'percentage' };
                    return { ...s, commissionConfig: { ...cfg, defaultPercentage: val } };
                  });
                }}
                className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl outline-none font-bold text-xs"
                placeholder="5"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Default Flat/Gateway Fee ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={settings?.commissionConfig?.defaultAmount ?? 1.5}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSettings(s => {
                    if (!s) return null;
                    const cfg = s.commissionConfig || { defaultPercentage: 5, defaultAmount: 1.5, strategy: 'percentage' };
                    return { ...s, commissionConfig: { ...cfg, defaultAmount: val } };
                  });
                }}
                className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl outline-none font-bold text-xs font-mono"
                placeholder="1.50"
              />
            </div>
          </div>

          {/* Overrides displays */}
          <div className="pt-4 border-t border-neutral-100 space-y-4">
            <div>
              <p className="text-[10px] font-black uppercase text-neutral-500 tracking-wider font-mono">Commission Policy Custom Overrides</p>
              <p className="text-[10px] text-neutral-400 font-semibold mt-0.5">Define unique commissions for individual lists, categories, or tags</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Category Overrides lists */}
              <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-150 flex flex-col justify-between min-h-[100px]">
                <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">Category Overrides</span>
                {Object.entries(settings?.commissionConfig?.categoryOverrides || {}).length > 0 ? (
                  <div className="space-y-1.5 max-h-24 overflow-y-auto pt-1.5">
                    {Object.entries(settings?.commissionConfig?.categoryOverrides || {}).map(([key, val]) => (
                      <div key={key} className="flex justify-between items-center text-[9px] bg-white border border-neutral-200/50 p-1 px-2 rounded-md font-bold text-neutral-600">
                        <span>{key}: <strong className="text-neutral-800">{val.strategy === 'percentage' ? `${val.percentage}%` : `$${val.amount}`}</strong></span>
                        <button
                          type="button"
                          onClick={() => {
                            setSettings(s => {
                              if (!s || !s.commissionConfig) return null;
                              const overrides = { ...(s.commissionConfig.categoryOverrides || {}) };
                              delete overrides[key];
                              return { ...s, commissionConfig: { ...s.commissionConfig, categoryOverrides: overrides } };
                            });
                          }}
                          className="text-red-500 hover:text-red-700 hover:scale-105"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[9px] text-neutral-400 font-extrabold uppercase italic mt-2">Noneconfigured</p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const cat = prompt("Enter category name (e.g. Camera Bodies):");
                    if (!cat) return;
                    const pct = parseFloat(prompt("Enter percentage rate decimal (e.g. 8.5):") || '5');
                    setSettings(s => {
                      if (!s) return null;
                      const commissionConfig = s.commissionConfig || { defaultPercentage: 5, defaultAmount: 1.5, strategy: 'percentage' };
                      const categoryOverrides = commissionConfig.categoryOverrides || {};
                      return {
                        ...s,
                        commissionConfig: {
                          ...commissionConfig,
                          categoryOverrides: {
                            ...categoryOverrides,
                            [cat]: { percentage: pct, amount: 0, strategy: 'percentage' }
                          }
                        }
                      };
                    });
                    toast.success("Category override registered!");
                  }}
                  className="px-2 py-1 bg-white border border-neutral-250 hover:bg-neutral-50 text-[8px] font-black uppercase rounded mt-3 text-center block w-full shadow-sm"
                >
                  Configure Category Override
                </button>
              </div>

              {/* List Overrides */}
              <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-150 flex flex-col justify-between min-h-[100px]">
                <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">Packing list items Override</span>
                {Object.entries(settings?.commissionConfig?.listOverrides || {}).length > 0 ? (
                  <div className="space-y-1.5 max-h-24 overflow-y-auto pt-1.5">
                    {Object.entries(settings?.commissionConfig?.listOverrides || {}).map(([key, val]) => (
                      <div key={key} className="flex justify-between items-center text-[9px] bg-white border border-neutral-200/50 p-1 px-2 rounded-md font-bold text-neutral-600">
                        <span className="truncate w-20">List ID: {key}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSettings(s => {
                              if (!s || !s.commissionConfig) return null;
                              const overrides = { ...(s.commissionConfig.listOverrides || {}) };
                              delete overrides[key];
                              return { ...s, commissionConfig: { ...s.commissionConfig, listOverrides: overrides } };
                            });
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[9px] text-neutral-400 font-extrabold uppercase italic mt-2">Noneconfigured</p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const lId = prompt("Enter specific list template ID:");
                    if (!lId) return;
                    const val = parseFloat(prompt("Enter specific processing fee percentage:") || '3');
                    setSettings(s => {
                      if (!s) return null;
                      const commissionConfig = s.commissionConfig || { defaultPercentage: 5, defaultAmount: 1.5, strategy: 'percentage' };
                      const listOverrides = commissionConfig.listOverrides || {};
                      return {
                        ...s,
                        commissionConfig: {
                          ...commissionConfig,
                          listOverrides: {
                            ...listOverrides,
                            [lId]: { percentage: val, amount: 0, strategy: 'percentage' }
                          }
                        }
                      };
                    });
                    toast.success("List level fee overridden.");
                  }}
                  className="px-2 py-1 bg-white border border-neutral-250 hover:bg-neutral-50 text-[8px] font-black uppercase rounded mt-3 text-center block w-full shadow-sm"
                >
                  Add List Override
                </button>
              </div>

              {/* Single Item Overrides */}
              <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-150 flex flex-col justify-between min-h-[100px]">
                <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">Single Premium Gear Tag</span>
                {Object.entries(settings?.commissionConfig?.itemOverrides || {}).length > 0 ? (
                  <div className="space-y-1.5 max-h-24 overflow-y-auto pt-1.5">
                    {Object.entries(settings?.commissionConfig?.itemOverrides || {}).map(([key, val]) => (
                      <div key={key} className="flex justify-between items-center text-[9px] bg-white border border-neutral-200/50 p-1 px-2 rounded-md font-bold text-neutral-600">
                        <span className="truncate w-20">Item ID: {key}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSettings(s => {
                              if (!s || !s.commissionConfig) return null;
                              const overrides = { ...(s.commissionConfig.itemOverrides || {}) };
                              delete overrides[key];
                              return { ...s, commissionConfig: { ...s.commissionConfig, itemOverrides: overrides } };
                            });
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[9px] text-neutral-400 font-extrabold uppercase italic mt-2">Noneconfigured</p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const iId = prompt("Enter specific Asset Gear ID:");
                    if (!iId) return;
                    const val = parseFloat(prompt("Enter specialized item charge amount ($):") || '15');
                    setSettings(s => {
                      if (!s) return null;
                      const commissionConfig = s.commissionConfig || { defaultPercentage: 5, defaultAmount: 1.5, strategy: 'percentage' };
                      const itemOverrides = commissionConfig.itemOverrides || {};
                      return {
                        ...s,
                        commissionConfig: {
                          ...commissionConfig,
                          itemOverrides: {
                            ...itemOverrides,
                            [iId]: { percentage: 0, amount: val, strategy: 'amount' }
                          }
                        }
                      };
                    });
                    toast.success("Single asset rate cap applied.");
                  }}
                  className="px-2 py-1 bg-white border border-neutral-250 hover:bg-neutral-50 text-[8px] font-black uppercase rounded mt-3 text-center block w-full shadow-sm"
                >
                  Onboard Asset override
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 
 * =========================================================================
 * 3. MULTI-INDUSTRY VERTICAL SANDBOXES
 * =========================================================================
 */
export function MultiIndustrySettingsTab({ settings, setSettings }: SettingsTabProps) {
  const industries = [
    { id: 'film_media', name: 'Media & Film Production', desc: 'Sets terms to Camera, Lenses, Packing Lists, cases, and focal length configs' },
    { id: 'construction', name: 'Heavy Trades & Tools', desc: 'Configures sandbox items to Heavy Tools, Kits, Subcontractors & safety certificates' },
    { id: 'sports', name: 'Sports & Teams Training', desc: 'Catalog active athletic jerseys, training equipment, ball gauges, and team game day rosters' },
    { id: 'events_stage', name: 'A/V Stage & Live production', desc: 'Sets sandboxes to Truss components, Cabinets, Stage assets, power cables' },
    { id: 'medical_edu', name: 'Life Science & Bio Labs', desc: 'Provides specific terms for calibration intervals, serial numbers, sterile seals' },
    { id: 'it_hardware', name: 'Network Cabinets & Laptops', desc: 'Terms like hostnames, IP allocations, software stacks, rack coordinates' },
    { id: ' Packer_generic', name: 'Generic Warehouse Cargo & Lists', desc: 'Standard generic packing boxes, checklists, local transit bins, suppliers' }
  ];

  const handleToggleIndustry = (indId: string) => {
    setSettings((s) => {
      if (!s) return null;
      const mCfg = s.multiIndustryConfig || { enabledIndustries: [], customTerms: {} };
      const list = mCfg.enabledIndustries || [];
      const nextList = list.includes(indId) ? list.filter(id => id !== indId) : [...list, indId];
      return {
        ...s,
        multiIndustryConfig: {
          ...mCfg,
          enabledIndustries: nextList
        }
      };
    });
  };

  const handleUpdateCustomTerm = (industryId: string, field: string, value: string) => {
    setSettings((s) => {
      if (!s) return null;
      const mCfg = s.multiIndustryConfig || { enabledIndustries: [], customTerms: {} };
      const customTerms = mCfg.customTerms || {};
      const termsObj = customTerms[industryId] || {
        gearLabelSingular: 'Gear',
        gearLabelPlural: 'Gear Items',
        listLabelSingular: 'Packing List',
        listLabelPlural: 'Packing Lists',
        description: ''
      };
      return {
        ...s,
        multiIndustryConfig: {
          ...mCfg,
          customTerms: {
            ...customTerms,
            [industryId]: { ...termsObj, [field]: value }
          }
        }
      };
    });
  };

  return (
    <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm space-y-6 animate-fade-in">
      <div className="flex items-center gap-3 border-b border-neutral-50 pb-4">
        <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded-xl">
          <Building2 size={18} />
        </div>
        <div>
          <h3 className="font-extrabold uppercase text-sm tracking-tight text-neutral-800">Enterprise Multi-Industry Settings & Terms</h3>
          <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider font-sans">Toggle vertical sector sandboxes and redefine dynamic nomenclature</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {industries.map((ind) => {
            const isEnabled = settings?.multiIndustryConfig?.enabledIndustries?.includes(ind.id);
            const terms = settings?.multiIndustryConfig?.customTerms?.[ind.id] || {
              gearLabelSingular: '',
              gearLabelPlural: '',
              listLabelSingular: '',
              listLabelPlural: '',
              description: ''
            };

            return (
              <div key={ind.id} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/50 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-black text-xs uppercase text-neutral-850">{ind.name}</h4>
                    <p className="text-[9.5px] text-neutral-400 leading-normal mt-0.5 uppercase">{ind.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleIndustry(ind.id)}
                    className={`w-10 h-5 rounded-full relative transition-colors ${isEnabled ? 'bg-primary' : 'bg-neutral-200'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${isEnabled ? 'right-0.5' : 'left-0.5'}`}></div>
                  </button>
                </div>

                {isEnabled && (
                  <div className="space-y-2.5 pt-3 border-t border-neutral-200/60 text-xs animate-fade-in">
                    <p className="text-[8px] font-black uppercase text-primary tracking-widest font-mono leading-none">Custom Terms Nomenclature</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <span className="text-[8px] text-neutral-450 uppercase font-bold">Unites Singular</span>
                        <input
                          type="text"
                          value={terms.gearLabelSingular}
                          onChange={(e) => handleUpdateCustomTerm(ind.id, 'gearLabelSingular', e.target.value)}
                          className="w-full bg-white border border-neutral-200/60 rounded px-2 py-1 text-[10px] font-bold"
                          placeholder="Camera"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[8px] text-neutral-450 uppercase font-bold">Unites Plural</span>
                        <input
                          type="text"
                          value={terms.gearLabelPlural}
                          onChange={(e) => handleUpdateCustomTerm(ind.id, 'gearLabelPlural', e.target.value)}
                          className="w-full bg-white border border-neutral-200/60 rounded px-2 py-1 text-[10px] font-bold"
                          placeholder="Cameras"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[8px] text-neutral-450 uppercase font-bold">Cargo Folder (S)</span>
                        <input
                          type="text"
                          value={terms.listLabelSingular}
                          onChange={(e) => handleUpdateCustomTerm(ind.id, 'listLabelSingular', e.target.value)}
                          className="w-full bg-white border border-neutral-200/60 rounded px-2 py-1 text-[10px] font-bold"
                          placeholder="Packing List"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[8px] text-neutral-450 uppercase font-bold">Cargo Folder (P)</span>
                        <input
                          type="text"
                          value={terms.listLabelPlural}
                          onChange={(e) => handleUpdateCustomTerm(ind.id, 'listLabelPlural', e.target.value)}
                          className="w-full bg-white border border-neutral-200/60 rounded px-2 py-1 text-[10px] font-bold"
                          placeholder="Packing Lists"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** 
 * =========================================================================
 * 4. REGIONAL MARKETPLACE & TAXATION CUSTOMIZER 
 * =========================================================================
 */
export function MarketplaceSettingsTab({ settings, setSettings }: SettingsTabProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Launch country and duration limits */}
      <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-neutral-50 pb-4">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded-xl">
            <ShoppingBag size={18} />
          </div>
          <div>
            <h3 className="font-extrabold uppercase text-sm tracking-tight text-neutral-800">Marketplace Launch & Constraints</h3>
            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Configure regional restrictions, default currencies and durations</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Default Country Launch Node</label>
            <input
              type="text"
              value={settings?.marketplaceRegionConfig?.launchCountry || ''}
              onChange={(e) => {
                const val = e.target.value;
                setSettings(s => {
                  if (!s) return null;
                  const cfg = s.marketplaceRegionConfig || { launchCountry: 'Fiji', availableCountries: [], restrictToAvailableCountries: false };
                  return { ...s, marketplaceRegionConfig: { ...cfg, launchCountry: val } };
                });
              }}
              className="w-full px-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60 text-xs font-bold outline-none"
              placeholder="Fiji"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Allowed Regional Currency Symbol</label>
            <input
              type="text"
              value={settings?.marketplaceRegionConfig?.defaultCurrency || ''}
              onChange={(e) => {
                const val = e.target.value;
                setSettings(s => {
                  if (!s) return null;
                  const cfg = s.marketplaceRegionConfig || { launchCountry: 'Fiji', availableCountries: [], restrictToAvailableCountries: false };
                  return { ...s, marketplaceRegionConfig: { ...cfg, defaultCurrency: val } };
                });
              }}
              className="w-full px-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60 text-xs font-bold font-mono outline-none"
              placeholder="FJD"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Max hire duration hours</label>
            <input
              type="number"
              value={settings?.limits?.maxCheckoutDurationHours ?? 168}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 168;
                setSettings(s => {
                  if (!s) return null;
                  const cfg = s.limits || { maxCheckoutDurationHours: 168 };
                  return { ...s, limits: { ...cfg, maxCheckoutDurationHours: val } };
                });
              }}
              className="w-full px-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60 text-xs font-bold outline-none font-mono"
            />
          </div>

          <div className="flex items-center justify-between p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/60">
            <div>
              <p className="text-xs font-extrabold text-neutral-800 uppercase leading-none">Restrict checkout countries</p>
              <p className="text-[8px] text-neutral-450 uppercase mt-1">Warn if buyer of international country checks out</p>
            </div>
            <button
              type="button"
              onClick={() => setSettings(s => {
                if (!s) return null;
                const cfg = s.marketplaceRegionConfig || { launchCountry: 'Fiji', availableCountries: [], restrictToAvailableCountries: false };
                return { ...s, marketplaceRegionConfig: { ...cfg, restrictToAvailableCountries: !cfg.restrictToAvailableCountries } };
              })}
              className={`w-10 h-5 rounded-full relative transition-colors ${settings?.marketplaceRegionConfig?.restrictToAvailableCountries ? 'bg-primary' : 'bg-neutral-200'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${settings?.marketplaceRegionConfig?.restrictToAvailableCountries ? 'right-0.5' : 'left-0.5'}`}></div>
            </button>
          </div>
        </div>
      </div>

      {/* Fiji VAT and international custom country rates */}
      <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-neutral-50 pb-4">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded-xl">
            <Percent size={18} />
          </div>
          <div>
            <h3 className="font-extrabold uppercase text-sm tracking-tight text-neutral-800">Fiji VAT & Global Country Taxes Customization</h3>
            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Apply custom percentages for active regional vat categories</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Fiji FRCS Standard VAT Rate (%)</label>
              <input
                type="number"
                step="0.1"
                value={settings?.taxConfig?.fijiVatRate ?? 15}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setSettings(s => {
                    if (!s) return null;
                    const tCfg = s.taxConfig || { fijiVatRate: 15, fijiVatType: 'VIP' };
                    return { ...s, taxConfig: { ...tCfg, fijiVatRate: val } };
                  });
                }}
                className="w-full px-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60 text-xs font-bold text-neutral-800 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">FRCS VAT application Code</label>
              <div className="flex bg-neutral-50 border border-neutral-200/60 rounded-xl p-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setSettings(s => {
                    if (!s) return null;
                    const tCfg = s.taxConfig || { fijiVatRate: 15, fijiVatType: 'VIP' };
                    return { ...s, taxConfig: { ...tCfg, fijiVatType: 'VIP' } };
                  })}
                  className={`flex-1 text-center py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                    (settings?.taxConfig?.fijiVatType || 'VIP') === 'VIP' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-450 hover:text-neutral-800'
                  }`}
                >
                  VIP (VAT Inclusive)
                </button>
                <button
                  type="button"
                  onClick={() => setSettings(s => {
                    if (!s) return null;
                    const tCfg = s.taxConfig || { fijiVatRate: 15, fijiVatType: 'VIP' };
                    return { ...s, taxConfig: { ...tCfg, fijiVatType: 'VEP' } };
                  })}
                  className={`flex-1 text-center py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                    (settings?.taxConfig?.fijiVatType || 'VIP') === 'VEP' ? 'bg-[#ff4f3a] text-white shadow-sm' : 'text-neutral-450 hover:text-neutral-800'
                  }`}
                >
                  VEP (VAT Exclusive)
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-neutral-100 pt-4 space-y-3">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-extrabold block font-mono">International custom tax rates grid</span>
              <span className="text-[9px] text-neutral-400 font-semibold block uppercase">Custom dynamic overrides applied globally for checkout on overseas buyers</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {['United States', 'Australia', 'New Zealand', 'United Kingdom', 'Canada'].map((country) => {
                const config = settings?.taxConfig?.otherCountriesTaxRates?.[country] || { rate: 10, type: 'exclusive' };
                return (
                  <div key={country} className="p-3 bg-neutral-50 rounded-xl border border-neutral-150 flex flex-col gap-2">
                    <span className="text-[10px] font-black uppercase text-neutral-700">{country}</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[7px] uppercase font-black tracking-widest text-neutral-400 block font-mono">Tax Rate %</span>
                        <input
                          type="number"
                          step="0.1"
                          value={config.rate}
                          onChange={(e) => {
                            const r = parseFloat(e.target.value) || 0;
                            setSettings(s => {
                              if (!s) return null;
                              const tCfg = s.taxConfig || { fijiVatRate: 15, fijiVatType: 'VIP' };
                              const rates = tCfg.otherCountriesTaxRates || {};
                              return {
                                ...s,
                                taxConfig: { ...tCfg, otherCountriesTaxRates: { ...rates, [country]: { ...config, rate: r } } }
                              };
                            });
                          }}
                          className="w-full bg-white border border-neutral-200 rounded px-1.5 py-0.5 text-[9px] font-bold"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[7px] uppercase font-black tracking-widest text-neutral-400 block font-mono">Tax Type</span>
                        <select
                          value={config.type}
                          onChange={(e) => {
                            const ty = e.target.value as 'exclusive' | 'inclusive';
                            setSettings(s => {
                              if (!s) return null;
                              const tCfg = s.taxConfig || { fijiVatRate: 15, fijiVatType: 'VIP' };
                              const rates = tCfg.otherCountriesTaxRates || {};
                              return {
                                ...s,
                                taxConfig: { ...tCfg, otherCountriesTaxRates: { ...rates, [country]: { ...config, type: ty } } }
                              };
                            });
                          }}
                          className="w-full bg-white border border-neutral-200 rounded px-1.5 py-0.5 text-[9px] font-extrabold text-neutral-700"
                        >
                          <option value="exclusive">Exclusive</option>
                          <option value="inclusive">Inclusive</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Landing page copy customizers */}
      <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-neutral-50 pb-4">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded-xl">
            <Layout size={18} />
          </div>
          <div>
            <h3 className="font-extrabold uppercase text-sm tracking-tight text-neutral-800">Marketplace Landing Page Copywriting</h3>
            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Redefine banner promo headers, brand quotes, verification checks, and partner logs</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider font-mono">Hero Subtitle Badge Copy</label>
            <input
              type="text"
              value={settings?.marketplaceLandingPageConfig?.heroSubtitle || ''}
              onChange={(e) => {
                const val = e.target.value;
                setSettings(s => {
                  if (!s) return null;
                  const cfg = s.marketplaceLandingPageConfig || {};
                  return { ...s, marketplaceLandingPageConfig: { ...cfg, heroSubtitle: val } };
                });
              }}
              className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200/60 rounded-xl text-xs font-semibold outline-none"
              placeholder="Verified visual workspace logistics"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider font-mono">Hero Primary Headline Copy</label>
            <input
              type="text"
              value={settings?.marketplaceLandingPageConfig?.heroTitle || ''}
              onChange={(e) => {
                const val = e.target.value;
                setSettings(s => {
                  if (!s) return null;
                  const cfg = s.marketplaceLandingPageConfig || {};
                  return { ...s, marketplaceLandingPageConfig: { ...cfg, heroTitle: val } };
                });
              }}
              className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200/60 rounded-xl text-xs font-extrabold outline-none"
              placeholder="The most complete visual cargo & gear sharing network"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider font-mono">Hero Description Copy</label>
            <textarea
              rows={2}
              value={settings?.marketplaceLandingPageConfig?.heroDescription || ''}
              onChange={(e) => {
                const val = e.target.value;
                setSettings(s => {
                  if (!s) return null;
                  const cfg = s.marketplaceLandingPageConfig || {};
                  return { ...s, marketplaceLandingPageConfig: { ...cfg, heroDescription: val } };
                });
              }}
              className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200/60 rounded-xl text-xs font-semibold outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider font-mono">Partner logos header text</label>
              <input
                type="text"
                value={settings?.marketplaceLandingPageConfig?.partnerLogosText || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setSettings(s => {
                    if (!s) return null;
                    const cfg = s.marketplaceLandingPageConfig || {};
                    return { ...s, marketplaceLandingPageConfig: { ...cfg, partnerLogosText: val } };
                  });
                }}
                className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200/60 rounded-xl text-xs font-semibold outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider font-mono">Logos List (comma-separated)</label>
              <input
                type="text"
                value={settings?.marketplaceLandingPageConfig?.partnerLogosList?.join(', ') || ''}
                onChange={(e) => {
                  const val = e.target.value.split(',').map(logo => logo.trim()).filter(Boolean);
                  setSettings(s => {
                    if (!s) return null;
                    const cfg = s.marketplaceLandingPageConfig || {};
                    return { ...s, marketplaceLandingPageConfig: { ...cfg, partnerLogosList: val } };
                  });
                }}
                className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200/60 rounded-xl text-xs font-mono outline-none"
              />
            </div>
          </div>

          <p className="text-[9.5px] font-black uppercase text-neutral-450 tracking-wider font-mono pt-3 border-t border-neutral-100">Granular Page Section Display Toggles</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              { key: 'showPromotions', label: 'Show Dual Promos Banners', desc: 'Display student deals and insights' },
              { key: 'showStaffPicks', label: 'Show Staff Picks', desc: 'Featured editor recommended cargo' },
              { key: 'showCategories', label: 'Show Categories Slider', desc: 'Horizontal slider for fast taxonomy search' },
              { key: 'showGuarantees', label: 'Show List Your Gear CTA', desc: 'Secure transit guarantee marketing card' },
              { key: 'requiresEduVerification', label: 'Enforce Operator Edu Verification', desc: 'Mandatory ID upload for accessing student deals' },
              { key: 'showFeatured', label: 'Show Sponsored Featured Listings', desc: 'Ad placement spots' },
              { key: 'showShippedToYou', label: 'Show Nationwide Shipped To You', desc: 'Parcel post shippable equipment block' },
              { key: 'showLatestGear', label: 'Show Newly Onboarded Equipment', desc: 'Sort by listing launch date' },
              { key: 'showPopularItems', label: 'Show Highly Viewed Items', desc: 'Popular list queries' }
            ].map((sw) => {
              const active = (settings?.marketplaceLandingPageConfig as any)?.[sw.key] !== false;
              return (
                <div key={sw.key} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-150">
                  <div>
                    <span className="text-xs font-bold text-neutral-800 uppercase block leading-none">{sw.label}</span>
                    <span className="text-[8.5px] text-neutral-400 uppercase font-medium mt-1 block leading-none">{sw.desc}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSettings(s => {
                      if (!s) return null;
                      const cfg = s.marketplaceLandingPageConfig || {};
                      return { ...s, marketplaceLandingPageConfig: { ...cfg, [sw.key]: !active } };
                    })}
                    className={`w-10 h-5 rounded-full relative transition-colors ${active ? 'bg-primary' : 'bg-neutral-200'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${active ? 'right-0.5' : 'left-0.5'}`}></div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Markdown policy agreement contents */}
      <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-neutral-50 pb-4">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded-xl">
            <FileText size={18} />
          </div>
          <div>
            <h3 className="font-extrabold uppercase text-sm tracking-tight text-neutral-800">Markdown Legal Agreements Content</h3>
            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Redefine site privacy standards and general user terms of usage</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <span className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Privacy Policy Content (Markdown)</span>
            <textarea
              rows={8}
              value={settings?.privacyContent || ''}
              onChange={(e) => {
                const val = e.target.value;
                setSettings(s => s ? { ...s, privacyContent: val } : null);
              }}
              className="w-full p-4 bg-neutral-50 border border-neutral-200/60 rounded-xl text-[10.5px] font-mono outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Terms of Service Content (Markdown)</span>
            <textarea
              rows={8}
              value={settings?.termsContent || ''}
              onChange={(e) => {
                const val = e.target.value;
                setSettings(s => s ? { ...s, termsContent: val } : null);
              }}
              className="w-full p-4 bg-neutral-50 border border-neutral-200/60 rounded-xl text-[10.5px] font-mono outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** 
 * =========================================================================
 * 5. DATA MODULE WIDGETS & AI PARAMETERS
 * =========================================================================
 */
export function WidgetsSettingsTab({ settings, setSettings }: SettingsTabProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Dynamic modules rules: cost calculator, CRM, BOM Composer, AI autolabeling */}
      <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-neutral-50 pb-4">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded-xl">
            <Sliders size={18} />
          </div>
          <div>
            <h3 className="font-extrabold uppercase text-sm tracking-tight text-neutral-800">Module & Granular Widget Settings</h3>
            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Configure calculator thresholds, scanner delays, and auto duplication checking</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Project Cost Calculator */}
          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/60 space-y-3">
            <span className="text-[10px] font-black uppercase text-neutral-600 tracking-wider block font-mono">💼 Project Cost Calculator Policy</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-1">
                <span className="text-[8px] text-neutral-400 uppercase font-bold">Target Margin %</span>
                <input
                  type="number"
                  value={settings?.moduleWidgetConfigs?.projectCost?.defaultMarginTarget ?? 30}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 30;
                    setSettings(s => {
                      if (!s) return null;
                      const confs = s.moduleWidgetConfigs || {};
                      const pc = confs.projectCost || { defaultMarginTarget: 30, costAlarmThreshold: 10, markupStrategy: 'percentage' };
                      return { ...s, moduleWidgetConfigs: { ...confs, projectCost: { ...pc, defaultMarginTarget: val } } };
                    });
                  }}
                  className="w-full bg-white border border-neutral-200/60 rounded px-2.5 py-1 text-[10px] font-bold"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[8px] text-neutral-400 uppercase font-bold">Alarm Deviation %</span>
                <input
                  type="number"
                  value={settings?.moduleWidgetConfigs?.projectCost?.costAlarmThreshold ?? 10}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 10;
                    setSettings(s => {
                      if (!s) return null;
                      const confs = s.moduleWidgetConfigs || {};
                      const pc = confs.projectCost || { defaultMarginTarget: 30, costAlarmThreshold: 10, markupStrategy: 'percentage' };
                      return { ...s, moduleWidgetConfigs: { ...confs, projectCost: { ...pc, costAlarmThreshold: val } } };
                    });
                  }}
                  className="w-full bg-white border border-neutral-200/60 rounded px-2.5 py-1 text-[10px] font-bold"
                />
              </div>
            </div>
          </div>

          {/* Supplier CRM */}
          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/60 space-y-3">
            <span className="text-[10px] font-black uppercase text-neutral-600 tracking-wider block font-mono">🤝 Supplier & CRM procurement</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-1">
                <span className="text-[8px] text-neutral-400 uppercase font-bold">PO Code Prefix</span>
                <input
                  type="text"
                  value={settings?.moduleWidgetConfigs?.supplierManagement?.poPrefix || 'PO-'}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSettings(s => {
                      if (!s) return null;
                      const confs = s.moduleWidgetConfigs || {};
                      const smObj = confs.supplierManagement || { poPrefix: 'PO-', preferredTerms: 'Net 30', automaticReorder: false };
                      return { ...s, moduleWidgetConfigs: { ...confs, supplierManagement: { ...smObj, poPrefix: val } } };
                    });
                  }}
                  className="w-full bg-white border border-neutral-200/60 rounded px-2.5 py-1 text-[10px] font-bold"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[8px] text-neutral-400 uppercase font-bold">Payment Terms Net</span>
                <input
                  type="text"
                  value={settings?.moduleWidgetConfigs?.supplierManagement?.preferredTerms || 'Net 30'}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSettings(s => {
                      if (!s) return null;
                      const confs = s.moduleWidgetConfigs || {};
                      const smObj = confs.supplierManagement || { poPrefix: 'PO-', preferredTerms: 'Net 30', automaticReorder: false };
                      return { ...s, moduleWidgetConfigs: { ...confs, supplierManagement: { ...smObj, preferredTerms: val } } };
                    });
                  }}
                  className="w-full bg-white border border-neutral-200/60 rounded px-2.5 py-1 text-[10px] font-bold"
                />
              </div>
            </div>
          </div>

          {/* BOM Composer markup */}
          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/60 space-y-3">
            <span className="text-[10px] font-black uppercase text-neutral-600 tracking-wider block font-mono">📦 Bill Of Materials (BOM) Limits</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-1">
                <span className="text-[8px] text-neutral-450 uppercase font-bold text-neutral-400">Min markup Rate (%)</span>
                <input
                  type="number"
                  value={settings?.moduleWidgetConfigs?.bomManagement?.minBOMMarkup ?? 15}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 15;
                    setSettings(s => {
                      if (!s) return null;
                      const confs = s.moduleWidgetConfigs || {};
                      const bm = confs.bomManagement || { minBOMMarkup: 15, autoDepreciationFactor: 0.1, columnsToShow: [] };
                      return { ...s, moduleWidgetConfigs: { ...confs, bomManagement: { ...bm, minBOMMarkup: val } } };
                    });
                  }}
                  className="w-full bg-white border border-neutral-200/60 rounded px-2.5 py-1 text-[10px] font-bold"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[8px] text-neutral-450 uppercase font-bold text-neutral-400">Annual depreciation</span>
                <input
                  type="number"
                  step="0.01"
                  value={settings?.moduleWidgetConfigs?.bomManagement?.autoDepreciationFactor ?? 0.1}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0.1;
                    setSettings(s => {
                      if (!s) return null;
                      const confs = s.moduleWidgetConfigs || {};
                      const bm = confs.bomManagement || { minBOMMarkup: 15, autoDepreciationFactor: 0.1, columnsToShow: [] };
                      return { ...s, moduleWidgetConfigs: { ...confs, bomManagement: { ...bm, autoDepreciationFactor: val } } };
                    });
                  }}
                  className="w-full bg-white border border-neutral-200/60 rounded px-2.5 py-1 text-[10px] font-bold"
                />
              </div>
            </div>
          </div>

          {/* AI autolabeling */}
          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/60 space-y-3">
            <span className="text-[10px] font-black uppercase text-neutral-600 tracking-wider block font-mono">🔮 AI autolabeling credentials</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-1">
                <span className="text-[8px] text-neutral-450 uppercase font-bold text-neutral-400">Confidence Threshold %</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={settings?.moduleWidgetConfigs?.aiWizard?.confidenceThreshold ?? 70}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 70;
                    setSettings(s => {
                      if (!s) return null;
                      const confs = s.moduleWidgetConfigs || {};
                      const ai = confs.aiWizard || { activeModel: 'gemini-3.5-flash', maxTokens: 4000, confidenceThreshold: 70 };
                      return { ...s, moduleWidgetConfigs: { ...confs, aiWizard: { ...ai, confidenceThreshold: val } } };
                    });
                  }}
                  className="w-full bg-white border border-neutral-200/60 rounded px-2.5 py-1 text-[10px] font-bold"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[8px] text-neutral-450 uppercase font-bold text-neutral-400">Transit Buffer (%)</span>
                <input
                  type="number"
                  value={settings?.moduleWidgetConfigs?.logisticsDashboard?.transitBufferPercent ?? 12}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 12;
                    setSettings(s => {
                      if (!s) return null;
                      const confs = s.moduleWidgetConfigs || {};
                      const log = confs.logisticsDashboard || { mileageRate: 0.65, transitBufferPercent: 12, dispatchTimeoutHours: 4 };
                      return { ...s, moduleWidgetConfigs: { ...confs, logisticsDashboard: { ...log, transitBufferPercent: val } } };
                    });
                  }}
                  className="w-full bg-white border border-neutral-200/60 rounded px-2.5 py-1 text-[10px] font-bold"
                />
              </div>
            </div>
          </div>

          {/* Logistics mileage */}
          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/60 space-y-3">
            <span className="text-[10px] font-black uppercase text-neutral-600 tracking-wider block font-mono">🚚 Logistics Dispatch rates</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-1">
                <span className="text-[8px] text-neutral-450 uppercase font-bold text-neutral-400">Fiji Mileage multiplier</span>
                <input
                  type="number"
                  step="0.05"
                  value={settings?.moduleWidgetConfigs?.logisticsDashboard?.mileageRate ?? 0.65}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0.65;
                    setSettings(s => {
                      if (!s) return null;
                      const confs = s.moduleWidgetConfigs || {};
                      const log = confs.logisticsDashboard || { mileageRate: 0.65, transitBufferPercent: 12, dispatchTimeoutHours: 4 };
                      return { ...s, moduleWidgetConfigs: { ...confs, logisticsDashboard: { ...log, mileageRate: val } } };
                    });
                  }}
                  className="w-full bg-white border border-neutral-200/60 rounded px-2.5 py-1 text-[10px] font-mono font-bold"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[8px] text-neutral-450 uppercase font-bold text-neutral-400">Dispatch Timeout (Hrs)</span>
                <input
                  type="number"
                  value={settings?.moduleWidgetConfigs?.logisticsDashboard?.dispatchTimeoutHours ?? 4}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 4;
                    setSettings(s => {
                      if (!s) return null;
                      const confs = s.moduleWidgetConfigs || {};
                      const log = confs.logisticsDashboard || { mileageRate: 0.65, transitBufferPercent: 12, dispatchTimeoutHours: 4 };
                      return { ...s, moduleWidgetConfigs: { ...confs, logisticsDashboard: { ...log, dispatchTimeoutHours: val } } };
                    });
                  }}
                  className="w-full bg-white border border-neutral-200/60 rounded px-2.5 py-1 text-[10px] font-bold font-mono"
                />
              </div>
            </div>
          </div>

          {/* Gear library check */}
          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/60 space-y-2 select-none">
            <span className="text-[10px] font-black uppercase text-neutral-600 tracking-wider block font-mono">📷 Library Duplicate validation</span>
            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="text-[10px] font-extrabold text-neutral-800 uppercase leading-none">Prevent duplicate barcodes</p>
                <p className="text-[7.5px] text-neutral-400 uppercase leading-none mt-1">Warn if asset matches same reference tags</p>
              </div>
              <button
                type="button"
                onClick={() => setSettings(s => {
                  if (!s) return null;
                  const confs = s.moduleWidgetConfigs || {};
                  const gl = confs.gearLibrary || { defaultCurrency: 'FJD', enableDupCheck: true, defaultCondition: 'good' };
                  return { ...s, moduleWidgetConfigs: { ...confs, gearLibrary: { ...gl, enableDupCheck: !gl.enableDupCheck } } };
                })}
                className={`w-10 h-5 rounded-full relative transition-colors ${settings?.moduleWidgetConfigs?.gearLibrary?.enableDupCheck !== false ? 'bg-primary' : 'bg-neutral-200'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${settings?.moduleWidgetConfigs?.gearLibrary?.enableDupCheck !== false ? 'right-0.5' : 'left-0.5'}`}></div>
              </button>
            </div>
          </div>

          {/* Standardized Add Photo Widget Panel */}
          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/60 space-y-4 sm:col-span-2">
            <div className="flex items-center justify-between border-b border-neutral-200/50 pb-2">
              <span className="text-[10px] font-black uppercase text-neutral-600 tracking-wider block font-mono">📷 Standardized Add Photo Widget Policies</span>
              <span className="text-[8px] font-bold text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full uppercase tracking-widest">Active Standard</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Core Plan Rule */}
              <div className="p-3 bg-white border border-neutral-200/60 rounded-xl space-y-2">
                <span className="text-[9px] font-black uppercase text-neutral-500 tracking-widest block">🔒 Pricing Plan Rules</span>
                <div className="flex items-center justify-between">
                  <div className="leading-none pr-1">
                    <span className="text-[10px] font-extrabold text-neutral-800 uppercase block">Restrict by Plan</span>
                    <span className="text-[7.5px] text-neutral-400 block mt-0.5 leading-none">Pro / Enterprise plans get Pro widget; Free / Lite get Lite.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSettings(s => {
                      if (!s) return null;
                      const confs = s.moduleWidgetConfigs || {};
                      const pw = confs.photoWidget || { restrictByPlan: true, allowUrlPasteLite: false, allowClipboardLite: false, allowSystemSearchLite: false, allowUrlPastePro: true, allowClipboardPro: true, allowSystemSearchPro: true };
                      return { ...s, moduleWidgetConfigs: { ...confs, photoWidget: { ...pw, restrictByPlan: !pw.restrictByPlan } } };
                    })}
                    className={`w-10 h-5 rounded-full relative transition-colors shrink-0 ${settings?.moduleWidgetConfigs?.photoWidget?.restrictByPlan !== false ? 'bg-primary' : 'bg-neutral-200'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${settings?.moduleWidgetConfigs?.photoWidget?.restrictByPlan !== false ? 'right-0.5' : 'left-0.5'}`}></div>
                  </button>
                </div>
              </div>

              {/* Lite Version Config */}
              <div className="p-3 bg-white border border-neutral-200/60 rounded-xl space-y-2">
                <span className="text-[9px] font-black uppercase text-neutral-500 tracking-widest block">🌱 Lite Version Allowed Features</span>
                
                <div className="space-y-2 text-[10px]">
                  {/* URL Paste */}
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-neutral-700 uppercase">Allow Web URL Paste</span>
                    <button
                      type="button"
                      onClick={() => setSettings(s => {
                        if (!s) return null;
                        const confs = s.moduleWidgetConfigs || {};
                        const pw = confs.photoWidget || { restrictByPlan: true, allowUrlPasteLite: false, allowClipboardLite: false, allowSystemSearchLite: false, allowUrlPastePro: true, allowClipboardPro: true, allowSystemSearchPro: true };
                        return { ...s, moduleWidgetConfigs: { ...confs, photoWidget: { ...pw, allowUrlPasteLite: !pw.allowUrlPasteLite } } };
                      })}
                      className={`w-8 h-4 rounded-full relative transition-colors ${settings?.moduleWidgetConfigs?.photoWidget?.allowUrlPasteLite ? 'bg-primary' : 'bg-neutral-200'}`}
                    >
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${settings?.moduleWidgetConfigs?.photoWidget?.allowUrlPasteLite ? 'right-0.5' : 'left-0.5'}`}></div>
                    </button>
                  </div>

                  {/* Clipboard */}
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-neutral-700 uppercase">Allow Clipboard Paste</span>
                    <button
                      type="button"
                      onClick={() => setSettings(s => {
                        if (!s) return null;
                        const confs = s.moduleWidgetConfigs || {};
                        const pw = confs.photoWidget || { restrictByPlan: true, allowUrlPasteLite: false, allowClipboardLite: false, allowSystemSearchLite: false, allowUrlPastePro: true, allowClipboardPro: true, allowSystemSearchPro: true };
                        return { ...s, moduleWidgetConfigs: { ...confs, photoWidget: { ...pw, allowClipboardLite: !pw.allowClipboardLite } } };
                      })}
                      className={`w-8 h-4 rounded-full relative transition-colors ${settings?.moduleWidgetConfigs?.photoWidget?.allowClipboardLite ? 'bg-primary' : 'bg-neutral-200'}`}
                    >
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${settings?.moduleWidgetConfigs?.photoWidget?.allowClipboardLite ? 'right-0.5' : 'left-0.5'}`}></div>
                    </button>
                  </div>

                  {/* System Search */}
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-neutral-700 uppercase">Allow System Photo Lookup</span>
                    <button
                      type="button"
                      onClick={() => setSettings(s => {
                        if (!s) return null;
                        const confs = s.moduleWidgetConfigs || {};
                        const pw = confs.photoWidget || { restrictByPlan: true, allowUrlPasteLite: false, allowClipboardLite: false, allowSystemSearchLite: false, allowUrlPastePro: true, allowClipboardPro: true, allowSystemSearchPro: true };
                        return { ...s, moduleWidgetConfigs: { ...confs, photoWidget: { ...pw, allowSystemSearchLite: !pw.allowSystemSearchLite } } };
                      })}
                      className={`w-8 h-4 rounded-full relative transition-colors ${settings?.moduleWidgetConfigs?.photoWidget?.allowSystemSearchLite ? 'bg-primary' : 'bg-neutral-200'}`}
                    >
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${settings?.moduleWidgetConfigs?.photoWidget?.allowSystemSearchLite ? 'right-0.5' : 'left-0.5'}`}></div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Pro Version Config */}
              <div className="p-3 bg-white border border-neutral-200/60 rounded-xl space-y-2">
                <span className="text-[9px] font-black uppercase text-primary tracking-widest block">⚡ Pro Version Allowed Features</span>
                
                <div className="space-y-2 text-[10px]">
                  {/* URL Paste */}
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-neutral-700 uppercase">Allow Web URL Paste</span>
                    <button
                      type="button"
                      onClick={() => setSettings(s => {
                        if (!s) return null;
                        const confs = s.moduleWidgetConfigs || {};
                        const pw = confs.photoWidget || { restrictByPlan: true, allowUrlPasteLite: false, allowClipboardLite: false, allowSystemSearchLite: false, allowUrlPastePro: true, allowClipboardPro: true, allowSystemSearchPro: true };
                        return { ...s, moduleWidgetConfigs: { ...confs, photoWidget: { ...pw, allowUrlPastePro: pw.allowUrlPastePro === false ? true : false } } };
                      })}
                      className={`w-8 h-4 rounded-full relative transition-colors ${settings?.moduleWidgetConfigs?.photoWidget?.allowUrlPastePro !== false ? 'bg-primary' : 'bg-neutral-200'}`}
                    >
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${settings?.moduleWidgetConfigs?.photoWidget?.allowUrlPastePro !== false ? 'right-0.5' : 'left-0.5'}`}></div>
                    </button>
                  </div>

                  {/* Clipboard */}
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-neutral-700 uppercase">Allow Clipboard Paste</span>
                    <button
                      type="button"
                      onClick={() => setSettings(s => {
                        if (!s) return null;
                        const confs = s.moduleWidgetConfigs || {};
                        const pw = confs.photoWidget || { restrictByPlan: true, allowUrlPasteLite: false, allowClipboardLite: false, allowSystemSearchLite: false, allowUrlPastePro: true, allowClipboardPro: true, allowSystemSearchPro: true };
                        return { ...s, moduleWidgetConfigs: { ...confs, photoWidget: { ...pw, allowClipboardPro: pw.allowClipboardPro === false ? true : false } } };
                      })}
                      className={`w-8 h-4 rounded-full relative transition-colors ${settings?.moduleWidgetConfigs?.photoWidget?.allowClipboardPro !== false ? 'bg-primary' : 'bg-neutral-200'}`}
                    >
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${settings?.moduleWidgetConfigs?.photoWidget?.allowClipboardPro !== false ? 'right-0.5' : 'left-0.5'}`}></div>
                    </button>
                  </div>

                  {/* System Search */}
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-neutral-700 uppercase">Allow System Photo Lookup</span>
                    <button
                      type="button"
                      onClick={() => setSettings(s => {
                        if (!s) return null;
                        const confs = s.moduleWidgetConfigs || {};
                        const pw = confs.photoWidget || { restrictByPlan: true, allowUrlPasteLite: false, allowClipboardLite: false, allowSystemSearchLite: false, allowUrlPastePro: true, allowClipboardPro: true, allowSystemSearchPro: true };
                        return { ...s, moduleWidgetConfigs: { ...confs, photoWidget: { ...pw, allowSystemSearchPro: pw.allowSystemSearchPro === false ? true : false } } };
                      })}
                      className={`w-8 h-4 rounded-full relative transition-colors ${settings?.moduleWidgetConfigs?.photoWidget?.allowSystemSearchPro !== false ? 'bg-primary' : 'bg-neutral-200'}`}
                    >
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${settings?.moduleWidgetConfigs?.photoWidget?.allowSystemSearchPro !== false ? 'right-0.5' : 'left-0.5'}`}></div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Kiosk Mode Panel */}
          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/60 space-y-3 sm:col-span-2">
            <span className="text-[10px] font-black uppercase text-neutral-600 block font-mono tracking-wider">🖥️ Shared Kiosk Terminal parameters</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <span className="text-[8px] text-neutral-450 uppercase font-bold text-neutral-400">Logout Idle Time (Mins)</span>
                <input
                  type="number"
                  value={settings?.moduleWidgetConfigs?.kioskMode?.sessionTimeoutMinutes ?? 10}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 10;
                    setSettings(s => {
                      if (!s) return null;
                      const confs = s.moduleWidgetConfigs || {};
                      const k = confs.kioskMode || { sessionTimeoutMinutes: 10, idleTimerSeconds: 30, enforceSupervisorApproval: false };
                      return { ...s, moduleWidgetConfigs: { ...confs, kioskMode: { ...k, sessionTimeoutMinutes: val } } };
                    });
                  }}
                  className="w-full bg-white border border-neutral-200/60 rounded px-2.5 py-1 text-[10px] font-bold"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[8px] text-neutral-450 uppercase font-bold text-neutral-400">Idle Alert Timer (Secs)</span>
                <input
                  type="number"
                  value={settings?.moduleWidgetConfigs?.kioskMode?.idleTimerSeconds ?? 30}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 30;
                    setSettings(s => {
                      if (!s) return null;
                      const confs = s.moduleWidgetConfigs || {};
                      const k = confs.kioskMode || { sessionTimeoutMinutes: 10, idleTimerSeconds: 30, enforceSupervisorApproval: false };
                      return { ...s, moduleWidgetConfigs: { ...confs, kioskMode: { ...k, idleTimerSeconds: val } } };
                    });
                  }}
                  className="w-full bg-white border border-neutral-200/60 rounded px-2.5 py-1 text-[10px] font-bold"
                />
              </div>

              <div className="flex items-center justify-between p-2 bg-white border border-neutral-200/50 rounded-xl">
                <div className="text-left leading-none">
                  <span className="text-[8.5px] font-black uppercase text-neutral-800">Enforce Supervisor Sig</span>
                  <span className="text-[7px] text-neutral-400 block uppercase mt-0.5 mt-0.5 leading-none">Requires manual supervisor pin code confirmation</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSettings(s => {
                    if (!s) return null;
                    const confs = s.moduleWidgetConfigs || {};
                    const k = confs.kioskMode || { sessionTimeoutMinutes: 10, idleTimerSeconds: 30, enforceSupervisorApproval: false };
                    return { ...s, moduleWidgetConfigs: { ...confs, kioskMode: { ...k, enforceSupervisorApproval: !k.enforceSupervisorApproval } } };
                  })}
                  className={`w-10 h-5 rounded-full relative transition-colors shrink-0 ${settings?.moduleWidgetConfigs?.kioskMode?.enforceSupervisorApproval ? 'bg-primary' : 'bg-neutral-200'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${settings?.moduleWidgetConfigs?.kioskMode?.enforceSupervisorApproval ? 'right-0.5' : 'left-0.5'}`}></div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI, global usage limits, and model choice */}
      <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-neutral-50 pb-4">
          <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded-xl animate-spin">
            <Cpu size={18} />
          </div>
          <div>
            <h3 className="font-extrabold uppercase text-sm tracking-tight text-neutral-800">Advanced AI Engine Configurations</h3>
            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider font-sans">Configure platform-level assistant rules and select Gemini foundation models</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <span className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Assistant Interface Display Name</span>
            <input
              type="text"
              value={settings?.aiConfig?.smartPackerName || ''}
              onChange={(e) => {
                const val = e.target.value;
                setSettings(s => s ? { ...s, aiConfig: { ...s.aiConfig, smartPackerName: val } } : null);
              }}
              className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200/60 rounded-xl text-xs font-bold outline-none"
              placeholder="Packer Assistant"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Gemini Core Model Foundation</span>
            <select
              value={settings?.aiConfig?.model || 'gemini-3.5-flash'}
              onChange={(e) => {
                const val = e.target.value;
                setSettings(s => s ? { ...s, aiConfig: { ...s.aiConfig, model: val } } : null);
              }}
              className="w-full bg-neutral-50 border border-neutral-200/60 rounded-xl px-4 py-2.5 text-xs text-neutral-800 font-extrabold outline-none"
            >
              <option value="gemini-3.5-flash">Gemini 3.5 Flash (Ultra-Fast Auto Labeling & Speed)</option>
              <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Extreme Precision & Reasoning)</option>
              <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (High Efficiency)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Model tokens usage threshold cap</span>
            <input
              type="number"
              value={settings?.aiConfig?.maxTokensPerRequest ?? 4000}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 4000;
                setSettings(s => s ? { ...s, aiConfig: { ...s.aiConfig, maxTokensPerRequest: val } } : null);
              }}
              className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200/60 rounded-xl text-xs font-bold font-mono outline-none"
            />
          </div>

          <div className="flex items-center justify-between p-3.5 bg-neutral-50 rounded-xl border border-neutral-250 select-none">
            <div>
              <p className="text-xs font-bold text-neutral-800 uppercase leading-none">Enable AI caching layers</p>
              <p className="text-[8px] text-neutral-450 uppercase leading-none mt-1">Accelerates recurring product recommendations</p>
            </div>
            <button
              type="button"
              onClick={() => setSettings(s => s ? { ...s, aiConfig: { ...s.aiConfig, cachingEnabled: !s.aiConfig.cachingEnabled } } : null)}
              className={`w-10 h-5 rounded-full relative transition-colors ${settings?.aiConfig?.cachingEnabled ? 'bg-primary' : 'bg-neutral-200'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${settings?.aiConfig?.cachingEnabled ? 'right-0.5' : 'left-0.5'}`}></div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 
 * =========================================================================
 * 6. AUTOMATED EMAILS VISUAL CUSTOMIZER SETTINGS TAB
 * =========================================================================
 */
export function EmailBrandingSettingsTab({ settings, setSettings }: SettingsTabProps) {
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkHref, setNewLinkHref] = useState('');
  const [previewTemplate, setPreviewTemplate] = useState<'verification' | 'admin_notification' | 'general_notification'>('verification');
  const [testRecipientEmail, setTestRecipientEmail] = useState('');
  const [isTestingEmail, setIsTestingEmail] = useState(false);

  const handleAddField = <K extends keyof NonNullable<AdminSettings['emailBranding']>>(
    key: K,
    value: NonNullable<AdminSettings['emailBranding']>[K]
  ) => {
    setSettings((s) => {
      if (!s) return null;
      const eb = s.emailBranding || {};
      return {
        ...s,
        emailBranding: {
          ...eb,
          [key]: value
        }
      };
    });
  };

  const handleAddFooterLink = () => {
    if (!newLinkLabel.trim() || !newLinkHref.trim()) {
      toast.error("Please enter both dynamic anchor text and destination URL.");
      return;
    }
    setSettings((s) => {
      if (!s) return null;
      const eb = s.emailBranding || {};
      const currentLinks = eb.footerLinks || [];
      return {
        ...s,
        emailBranding: {
          ...eb,
          footerLinks: [...currentLinks, { label: newLinkLabel.trim(), href: newLinkHref.trim() }]
        }
      };
    });
    setNewLinkLabel('');
    setNewLinkHref('');
    toast.success("Active link appended to email footer template layout.");
  };

  const handleRemoveFooterLink = (idx: number) => {
    setSettings((s) => {
      if (!s) return null;
      const eb = s.emailBranding || {};
      const currentLinks = eb.footerLinks || [];
      const updated = currentLinks.filter((_, i) => i !== idx);
      return {
        ...s,
        emailBranding: {
          ...eb,
          footerLinks: updated
        }
      };
    });
    toast.success("Link removed from email footer template.");
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipientEmail.trim() || !testRecipientEmail.includes('@')) {
      toast.error("Please enter a valid target email address.");
      return;
    }

    setIsTestingEmail(true);
    try {
      const { emailService } = await import('../services/emailService');
      
      let res;
      if (previewTemplate === 'verification') {
        res = await emailService.sendVerificationEmail(
          testRecipientEmail.trim(),
          "524389",
          "Verification Tester",
          settings
        );
      } else if (previewTemplate === 'admin_notification') {
        res = await emailService.sendAdminNotification(
          testRecipientEmail.trim(),
          "Test administrative system ping",
          "Verification check executed from the automated visual branding panel.",
          {
            "Trigger Type": "Custom Design Test Run",
            "Dispatched By": "Workspace Admin Operator",
            "Security Level": "SECURE"
          },
          settings
        );
      } else {
        res = await emailService.sendNotification(
          testRecipientEmail.trim(),
          "Custom Brand Notice Dispatched",
          "Operational Notice dynamic test run",
          "Success! If you see this message, your automated email system is successfully compiling customized styles, custom colors, and footer layout configuration settings in real-time. Feel free to use this system to send branded alerts, list handovers, or verification logins!",
          window.location.origin + "/admin",
          "Review Settings Dashboard",
          settings
        );
      }

      if (res && res.simulated) {
        toast.info("Sandbox Active: Real email simulated in offline developer console (unconfigured server key). Recipient email: " + testRecipientEmail);
      } else {
        toast.success(`Active Resend dispatch successful to ${testRecipientEmail}!`);
      }
    } catch (err: any) {
      toast.error(`Email dispatch failed: ${err.message || err}`);
    } finally {
      setIsTestingEmail(false);
    }
  };

  const companyName = settings?.emailBranding?.companyName || settings?.branding?.companyName || "Packer Tools";
  const logoUrl = settings?.emailBranding?.logoUrl || settings?.branding?.logo || "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=600&auto=format&fit=crop";
  const primaryColor = settings?.emailBranding?.primaryColor || settings?.branding?.primaryColor || "#FF5500";
  const footerText = settings?.emailBranding?.footerText || "";
  const footerLinks = settings?.emailBranding?.footerLinks || [];
  const defaultFromType = settings?.emailBranding?.defaultFromType || 'no-reply';

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Upper header segment wrapper */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-neutral-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2.5 text-neutral-900">
            <Mail className="text-primary animate-pulse" size={24} />
            <span>Automated Emails Visual Customizer</span>
          </h2>
          <p className="font-semibold text-neutral-500 text-xs">
            Design, preview, and test-dispatch high-fidelity transactional emails including verification codes and admin notifications.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-neutral-900 text-white rounded-full text-[10px] font-mono font-black uppercase tracking-widest self-start">
          <span>Resend SDK Engine</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* Left column inputs config form block */}
        <div className="xl:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-neutral-50 pb-4">
              <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded-xl">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="font-extrabold uppercase text-xs tracking-tight text-neutral-800">Visual Identity Specs</h3>
                <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider">Configure metadata overrides and layout branding</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Company name block signature override */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Email Corporate Name</label>
                <input
                  type="text"
                  value={settings?.emailBranding?.companyName || ''}
                  onChange={(e) => handleAddField('companyName', e.target.value)}
                  placeholder={settings?.branding?.companyName || "Packer Tools"}
                  className="w-full px-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60 text-xs font-bold text-neutral-800 outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 transition"
                />
                <span className="text-[9px] text-neutral-400 block font-medium">Overrides core branding name in operational emails of packer tools.</span>
              </div>

              {/* Logo URL configuration */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Email Branded Logo (URL)</label>
                <input
                  type="text"
                  value={settings?.emailBranding?.logoUrl || ''}
                  onChange={(e) => handleAddField('logoUrl', e.target.value)}
                  placeholder={settings?.branding?.logo || "https://images.unsplash.com/photo-example.png"}
                  className="w-full px-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60 text-xs font-bold text-neutral-800 outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 transition"
                />
              </div>

              {/* Color picker segment */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Accent Theme Color Coloration (Hex)</label>
                <div className="flex gap-3 items-center">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => handleAddField('primaryColor', e.target.value)}
                    className="w-10 h-10 border-0 outline-none rounded-xl cursor-pointer shrink-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={settings?.emailBranding?.primaryColor || ''}
                    onChange={(e) => handleAddField('primaryColor', e.target.value)}
                    placeholder={settings?.branding?.primaryColor || "#FF5500"}
                    className="flex-1 px-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60 text-xs font-bold font-mono text-neutral-800 outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 transition"
                  />
                </div>
              </div>

              {/* Sender addresses preference defaults list choice */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Default Sender Prefix</label>
                <select
                  value={defaultFromType}
                  onChange={(e) => handleAddField('defaultFromType', e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60 text-xs font-bold text-neutral-800 outline-none focus:bg-white transition"
                >
                  <option value="no-reply">no-reply@ (No Reply Address)</option>
                  <option value="hi">hi@ (General Hello Point)</option>
                  <option value="team">team@ (Corporate Workspace Team)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Email Custom Footers Customizer Anchor Container */}
          <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-neutral-50 pb-4">
              <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded-xl">
                <Sliders size={18} />
              </div>
              <div>
                <h3 className="font-extrabold uppercase text-xs tracking-tight text-neutral-800">Custom Email Footer Template</h3>
                <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider">Configure text disclaimers & footer navigation links</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Paragraph footer disclaimer Text */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Footer Disclaimer / Address Details</label>
                <textarea
                  value={footerText}
                  onChange={(e) => handleAddField('footerText', e.target.value)}
                  rows={2}
                  maxLength={180}
                  placeholder="You have received this letter because your email requested identity verification or security validation details on this device."
                  className="w-full px-4 py-3 bg-neutral-50 rounded-2xl border border-neutral-200/60 text-xs font-semibold text-neutral-850 outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 transition resize-none"
                />
              </div>

              {/* Display list of current customized email navigation layout list links */}
              <div className="space-y-3">
                <span className="text-[9.5px] font-black uppercase text-neutral-450 tracking-wider block font-mono">Footer Navigation Anchors ({footerLinks.length})</span>
                {footerLinks.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {footerLinks.map((link, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 bg-neutral-50 rounded-xl border border-neutral-150 text-xs font-semibold">
                        <div>
                          <span className="text-neutral-800 font-extrabold">{link.label}</span>
                          <span className="text-[9px] font-mono text-neutral-400 block">{link.href}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveFooterLink(idx)}
                          className="p-1 px-2.5 bg-neutral-100 hover:bg-neutral-200 rounded-lg text-neutral-500 hover:text-red-600 font-bold uppercase text-[8px] transition"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="p-3 rounded-xl border border-dashed border-neutral-200 text-center text-[9px] text-neutral-400 font-bold italic uppercase block">No custom email links added</p>
                )}

                <div className="bg-neutral-50 p-2.5 rounded-2xl border border-neutral-200/60 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Label (e.g. Terms)"
                      value={newLinkLabel}
                      onChange={(e) => setNewLinkLabel(e.target.value)}
                      className="bg-white border border-neutral-200 rounded-lg px-2 py-1 text-[10px] font-semibold outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Href (e.g. /terms)"
                      value={newLinkHref}
                      onChange={(e) => setNewLinkHref(e.target.value)}
                      className="bg-white border border-neutral-200 rounded-lg px-2 py-1 text-[10px] font-semibold outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddFooterLink}
                    className="w-full py-1 bg-neutral-900 border border-neutral-800 hover:bg-black text-white text-[9px] font-black uppercase rounded-lg tracking-wider"
                  >
                    + Add Footer Link Anchor
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Beautiful rendered output design system mockup */}
        <div className="xl:col-span-7 space-y-6">
          <div className="bg-neutral-900 p-6 md:p-8 rounded-[2.5rem] border border-neutral-800 shadow-2xl relative text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-850 pb-4 mb-6">
              <div className="space-y-0.5">
                <span className="text-[10px] font-black text-[#FF5500] uppercase tracking-widest block font-mono">💻 Core WYSIWYG Renderer</span>
                <h3 className="text-white text-lg font-black uppercase tracking-tight">E-Mail Live Layout Previewer</h3>
              </div>
              {/* Dynamic sub selector tabs */}
              <div className="flex bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-[10px] font-bold self-start">
                <button
                  type="button"
                  onClick={() => setPreviewTemplate('verification')}
                  className={`px-3 py-1.5 rounded-lg transition-all text-xs ${previewTemplate === 'verification' ? 'bg-primary text-white font-black' : 'text-neutral-400 hover:text-neutral-100'}`}
                >
                  Verify Access
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTemplate('admin_notification')}
                  className={`px-3 py-1.5 rounded-lg transition-all text-xs ${previewTemplate === 'admin_notification' ? 'bg-primary text-white font-black' : 'text-neutral-400 hover:text-neutral-100'}`}
                >
                  Admin Alert
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTemplate('general_notification')}
                  className={`px-3 py-1.5 rounded-lg transition-all text-xs ${previewTemplate === 'general_notification' ? 'bg-primary text-white font-black' : 'text-neutral-400 hover:text-neutral-100'}`}
                >
                  Branded Notice
                </button>
              </div>
            </div>

            {/* Email Canvas Mock Block */}
            <div className="bg-neutral-100 rounded-[2rem] p-4 md:p-8 border border-neutral-200 overflow-hidden text-[#1e293b] font-sans">
              <div className="max-w-[480px] mx-auto bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-md">
                
                {/* Dynamically Styled Header based on customize inputs */}
                {previewTemplate === 'verification' ? (
                  <div className="p-6 text-center text-white flex flex-col items-center justify-center" style={{ backgroundColor: primaryColor }}>
                    <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-3">
                      <img src={logoUrl} referrerPolicy="no-referrer" alt="Custom logo preview" className="object-contain max-h-8 max-w-[120px]" />
                    </div>
                    <h2 className="margin-0 text-md font-black uppercase tracking-wider">Verification Bureau</h2>
                  </div>
                ) : previewTemplate === 'admin_notification' ? (
                  <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-700">
                    <span className="font-extrabold text-[10px] uppercase tracking-wider">🚨 {companyName} Admin Panel</span>
                    <img src={logoUrl} referrerPolicy="no-referrer" alt="Custom logo preview" className="object-contain max-h-5 max-w-[80px]" />
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-800 text-white flex flex-col items-center justify-center">
                    <img src={logoUrl} referrerPolicy="no-referrer" alt="Custom logo preview" className="object-contain max-h-12 max-w-[140px] mb-3" />
                    <h1 className="margin-0 text-lg font-black uppercase tracking-tight">OPERATIONAL NOTICE</h1>
                  </div>
                )}

                {/* Card Template Body Contents preview fields */}
                <div className="p-6 md:p-8 space-y-4 text-left">
                  {previewTemplate === 'verification' ? (
                    <div className="space-y-4 text-center">
                      <p className="text-xs text-neutral-600 font-bold mt-0">Bula Vinaka, <strong>John Operator</strong>,</p>
                      <p className="text-[11px] text-neutral-500 leading-relaxed leading-normal">
                        Use the following secure, temporary access validation token block to verify your workspace identity for {companyName}:
                      </p>
                      <div className="font-mono text-xl md:text-2xl font-black tracking-widest p-4 rounded-xl border border-orange-150 inline-block bg-orange-50/50" style={{ color: primaryColor, borderColor: `${primaryColor}20` }}>
                        524389
                      </div>
                      <p className="text-[9px] text-neutral-400 italic">This code will expire shortly. If you did not request this login credentials set, disregard this email.</p>
                    </div>
                  ) : previewTemplate === 'admin_notification' ? (
                    <div className="space-y-3">
                      <h4 className="font-extrabold text-neutral-900 text-sm border-b pb-2">Test administrative system ping</h4>
                      <p className="text-xs text-neutral-500 leading-relaxed">An administrative event or notification was raised by the workspace platform operations:</p>
                      
                      <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-150 text-[10px] space-y-1">
                        <table className="w-full text-left">
                          <tbody>
                            <tr className="border-b border-neutral-100">
                              <td className="font-bold uppercase text-neutral-400 py-1">Trigger Type:</td>
                              <td className="font-mono py-1">Custom Design Test Run</td>
                            </tr>
                            <tr className="border-b border-neutral-100">
                              <td className="font-bold uppercase text-neutral-400 py-1">Dispatched By:</td>
                              <td className="font-mono py-1">Workspace Admin Operator</td>
                            </tr>
                            <tr>
                              <td className="font-bold uppercase text-neutral-400 py-1">Security Level:</td>
                              <td className="font-mono py-1 font-bold text-red-600">SECURE</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <p className="text-[9px] text-[#854d0e] bg-yellow-50 border border-yellow-250 p-2.5 rounded-lg">
                        ⚠️ This is an webmaster automated notification email dispatch. Action may be required at the main panel of your secure Packer Tools deployment.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 text-center md:text-left">
                      <p className="text-xs text-neutral-600 leading-relaxed font-semibold">
                        Success! If you see this message, your automated email system is successfully compiling customized styles, custom colors, and footer layout configuration settings in real-time. Feel free to use this system to send branded alerts, list handovers, or verification logins!
                      </p>
                      <div className="text-center py-2">
                        <span className="px-5 py-2 rounded-xl text-white text-[10px] font-black uppercase tracking-wider transition inline-block cursor-pointer shadow-sm shadow-[#FF5500]/20" style={{ backgroundColor: primaryColor }}>
                          REVIEW SETTINGS DASHBOARD
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Dynamically Styled Email footers mapping customization preview */}
                <div className="p-6 bg-neutral-50 border-t border-neutral-150 text-center text-[10px] text-neutral-400 flex flex-col items-center justify-center gap-1.5 font-sans leading-relaxed">
                  {previewTemplate === 'general_notification' && (
                    <p className="mb-1 text-[9.5px] font-semibold text-neutral-500 font-sans">
                      For dynamic assistance, drop a line to <span style={{ color: primaryColor, fontWeight: 'bold' }}>support@packer.tools</span>.
                    </p>
                  )}
                  
                  <p className="text-[9px] font-semibold">© {new Date().getFullYear()} {companyName} Team logistics.</p>
                  
                  {footerLinks.length > 0 && (
                    <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1">
                      {footerLinks.map((link, lIdx) => (
                        <React.Fragment key={lIdx}>
                          {lIdx > 0 && <span className="text-neutral-300"> | </span>}
                          <span className="font-black" style={{ color: primaryColor }}>
                            {link.label}
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                  )}

                  {footerText && (
                    <p className="text-[9px] text-neutral-400 leading-normal max-w-[360px] mx-auto mt-2 italic font-medium font-sans border-t border-neutral-200/60 pt-2">
                      {footerText}
                    </p>
                  )}
                </div>

              </div>
            </div>
          </div>

          {/* Test Dispatch Sender launcher widget console */}
          <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h4 className="font-black text-xs text-neutral-800 uppercase tracking-tight block">Send Test Branded Email Transaction</h4>
            </div>
            
            <p className="text-xs text-neutral-500">
              Fire a real transactional test mail to verify layout formatting and inbox rendering speed directly via proxying.
            </p>

            <form onSubmit={handleSendTestEmail} className="grid sm:grid-cols-4 gap-3 items-end">
              <div className="sm:col-span-2 space-y-1">
                <span className="text-[9px] font-black uppercase text-neutral-400 block tracking-widest font-mono">Recipient Email</span>
                <input
                  type="email"
                  value={testRecipientEmail}
                  onChange={(e) => setTestRecipientEmail(e.target.value)}
                  placeholder="test@packer.tools"
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-primary/20 outline-none"
                  required
                />
              </div>

              <div className="sm:col-span-1 space-y-1">
                <span className="text-[9px] font-black uppercase text-neutral-400 block tracking-widest font-mono">Preset Template</span>
                <div className="bg-neutral-50 p-2 py-1 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold capitalize text-neutral-700 truncate min-w-0 h-[38px] flex items-center">
                  {previewTemplate.replace('_', ' ')}
                </div>
              </div>

              <div className="sm:col-span-1">
                <button
                  type="submit"
                  disabled={isTestingEmail}
                  className="w-full py-2 bg-neutral-900 border border-neutral-850 text-white font-black text-xs uppercase rounded-xl tracking-wider transition hover:bg-neutral-800 flex items-center justify-center gap-2 h-[38px] disabled:opacity-50"
                >
                  {isTestingEmail ? 'Sending...' : 'Send Test'}
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}

/**
 * =========================================================================
 * 7. SMTP TRANSMISSION SETTINGS TAB
 * =========================================================================
 */
export function SmtpSettingsTab({ settings, setSettings }: SettingsTabProps) {
  const [testRecipient, setTestRecipient] = useState('');
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleUpdateSmtp = <K extends keyof NonNullable<AdminSettings['smtp']>>(
    key: K,
    value: NonNullable<AdminSettings['smtp']>[K]
  ) => {
    setSettings((s) => {
      if (!s) return null;
      const currentSmtp = s.smtp || {};
      return {
        ...s,
        smtp: {
          ...currentSmtp,
          [key]: value
        }
      };
    });
  };

  const handleSendSmtpTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testRecipient.trim() || !testRecipient.includes('@')) {
      toast.error("Please enter a valid recipient email address.");
      return;
    }

    setIsTestingSmtp(true);
    try {
      const { emailService } = await import('../services/emailService');
      const res = await emailService.sendNotification(
        testRecipient.trim(),
        "SMTP Diagnostic Dispatch",
        "SMTP Server Verification Check",
        "Congratulations! Your custom SMTP transmission settings have been compiled successfully inside the Packer Tools communications engine. Transactions are now routing properly.",
        window.location.origin + "/admin",
        "Return to Admin Panel",
        settings
      );

      if (res && res.simulated) {
        toast.info("Sandbox Simulation Mode: Node.js server lacks backend SMTP support, but custom configuration handles parsing correctly.");
      } else {
        toast.success(`Active SMTP test dispatched successfully to ${testRecipient}!`);
      }
    } catch (err: any) {
      toast.error(`SMTP transmission failed: ${err.message || err}`);
    } finally {
      setIsTestingSmtp(false);
    }
  };

  const smtp = settings?.smtp || {};
  const isEnabled = !!smtp.enabled;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Tab Header segment */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-neutral-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2.5 text-neutral-900">
            <Server className="text-primary animate-pulse" size={24} />
            <span>SMTP Server Settings</span>
          </h2>
          <p className="font-semibold text-neutral-500 text-xs">
            Configure host, gateway ports, and secure authentication to route all automatic, welcome, and verification emails via standard custom SMPT servers rather than external presets.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-neutral-900 text-white rounded-full text-[10px] font-mono font-black uppercase tracking-widest self-start">
          <span>SMTP Gateway Engine</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* Left inputs config column (7 cols) */}
        <div className="xl:col-span-7 space-y-6">
          <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-neutral-100 shadow-sm space-y-6">
            
            {/* Active Switch Toggle with status label */}
            <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-200/60">
              <div className="space-y-0.5">
                <span className="text-xs font-black uppercase text-neutral-800 tracking-tight block">Use Custom SMTP Server</span>
                <span className="text-[10px] font-medium text-neutral-400 block">Deploy custom SMTP relays for all outbound communications.</span>
              </div>
              <button
                type="button"
                onClick={() => handleUpdateSmtp('enabled', !isEnabled)}
                className={`w-14 h-8 rounded-full transition-colors relative cursor-pointer outline-none focus:ring-2 focus:ring-primary/20 ${
                  isEnabled ? 'bg-primary' : 'bg-neutral-300'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 bg-white w-6 h-6 rounded-full transition-transform shadow-md ${
                    isEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Input fields */}
            <div className={`space-y-4 transition-opacity duration-300 ${isEnabled ? 'opacity-100' : 'opacity-60 pointer-events-none'}`}>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* SMTP Host address field */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">SMTP Server Host</label>
                  <input
                    type="text"
                    value={smtp.host || ''}
                    onChange={(e) => handleUpdateSmtp('host', e.target.value)}
                    placeholder="smtp.mail.me.com"
                    className="w-full px-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60 text-xs font-bold text-neutral-800 outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 transition"
                  />
                </div>

                {/* Port configuration field */}
                <div className="sm:col-span-1 space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">Port</label>
                  <input
                    type="number"
                    value={smtp.port || ''}
                    onChange={(e) => handleUpdateSmtp('port', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                    placeholder="587"
                    className="w-full px-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60 text-xs font-bold text-neutral-800 outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 transition"
                  />
                </div>
              </div>

              {/* SMTP Username/Email address field */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">SMTP Username / User</label>
                <div className="relative">
                  <input
                    type="text"
                    value={smtp.user || ''}
                    onChange={(e) => handleUpdateSmtp('user', e.target.value)}
                    placeholder="example@icloud.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60 text-xs font-bold text-neutral-800 outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 transition"
                  />
                  <Mail className="absolute left-3.5 top-3 text-neutral-400" size={14} />
                </div>
                <span className="text-[9px] text-neutral-400 block font-medium">The username or address with which you authenticate to your SMTP provider.</span>
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">SMTP Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={smtp.pass || ''}
                    onChange={(e) => handleUpdateSmtp('pass', e.target.value)}
                    placeholder="••••••••••••••••"
                    className="w-full pl-10 pr-12 py-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60 text-xs font-bold text-neutral-800 outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 transition"
                  />
                  <Lock className="absolute left-3.5 top-3 text-neutral-400" size={14} />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2 px-2 py-1 text-[8px] bg-neutral-100 hover:bg-neutral-200 font-mono text-neutral-600 rounded uppercase tracking-wider"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <span className="text-[9px] text-neutral-400 block font-medium">We recommend using App-Specific passwords rather than primary logons for increased protection.</span>
              </div>

            </div>

            {/* Test Connection module segment */}
            <div className={`pt-4 border-t border-neutral-100/70 ${isEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <div className="bg-neutral-50 p-4 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="text-emerald-600" size={16} />
                  <span className="text-[10px] font-black uppercase text-neutral-800 tracking-wide">SMTP Integrity Test</span>
                </div>
                <p className="text-[10px] text-neutral-500 font-semibold">
                  Send an on-demand verification diagnostic e-mail block instantly to test server handshakes and verify authorization.
                </p>
                <form onSubmit={handleSendSmtpTestEmail} className="flex gap-2 items-center">
                  <input
                    type="email"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    placeholder="test@packer.tools"
                    className="flex-1 px-3 py-2 bg-white border border-neutral-200/60 rounded-xl text-xs font-mono"
                    required={isEnabled}
                  />
                  <button
                    type="submit"
                    disabled={isTestingSmtp || !isEnabled}
                    className="bg-neutral-900 border border-neutral-850 hover:bg-neutral-800 text-white font-black text-[9px] uppercase tracking-widest px-4 py-2.5 rounded-xl transition disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {isTestingSmtp ? 'Sending...' : 'Test SMTP'}
                  </button>
                </form>
              </div>
            </div>

          </div>
        </div>

        {/* Right Help Segment section (5 cols) */}
        <div className="xl:col-span-5 space-y-6">
          
          {/* Apple Mail Custom Guide (iCloud SMTP) */}
          <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm space-y-4">
            <div className="flex items-start gap-3 border-b border-neutral-50 pb-3">
              <span className="text-xl">🍏</span>
              <div>
                <h3 className="font-extrabold uppercase text-xs tracking-tight text-neutral-800">Apple iCloud Mail Settings</h3>
                <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider">Guide for utilizing Apple accounts</p>
              </div>
            </div>

            <p className="text-xs text-neutral-500 leading-relaxed font-medium">
              Absolutely! You can utilize the official iCloud SMTP server to route all outbound transaction mails. Follow these strict authentication parameters to ensure delivery:
            </p>

            <div className="space-y-2 bg-neutral-50 p-4 rounded-2xl border border-neutral-150 text-[11px] font-mono">
              <div className="flex justify-between py-1 border-b border-neutral-200/40">
                <span className="text-neutral-400">SMTP Host:</span>
                <span className="font-bold text-neutral-800 select-all">smtp.mail.me.com</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-200/40">
                <span className="text-neutral-400">SMTP Port:</span>
                <span className="font-bold text-neutral-800">587</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-200/40">
                <span className="text-neutral-400">Secure Protocol:</span>
                <span className="font-bold text-neutral-800">STARTTLS</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-200/40">
                <span className="text-neutral-400">SMTP Username:</span>
                <span className="font-bold text-neutral-800 text-right select-all">Your full iCloud email (e.g., mail@icloud.com)</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-neutral-400">SMTP Password:</span>
                <span className="font-bold text-red-600 text-right">App-Specific Password</span>
              </div>
            </div>

            {/* Crucial Instructions Alert Warning Panel */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[10px] text-amber-800 leading-relaxed space-y-1 shadow-sm">
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wide">
                <Info size={12} className="shrink-0" />
                <span>Prerequisite: Generate App Password</span>
              </div>
              <p className="font-medium">
                Do <strong>NOT</strong> write your main Apple ID login password above. Apple enforces 2-Factor Authentication globally, which prevents basic passwords from accessing raw SMTP gateways.
              </p>
              <ol className="list-decimal pl-4 space-y-0.5 mt-1 font-semibold">
                <li>Sign in to your account page at <a href="https://appleid.apple.com" target="_blank" rel="noreferrer" className="underline font-black">appleid.apple.com</a>.</li>
                <li>Navigate to the <strong>Sign-In and Security</strong> subsegment.</li>
                <li>Select the <strong>App-Specific Passwords</strong> dashboard option.</li>
                <li>Click <strong>Generate an app-specific password</strong>, input Name (e.g., <code className="bg-amber-100 font-mono px-1 rounded">Packer Tools</code>), copy the secret 16-character phrase, and paste it into the password field on the left.</li>
              </ol>
            </div>
          </div>

          {/* Secure Credential Advice info block */}
          <div className="bg-neutral-50 p-5 rounded-2xl border border-neutral-200/60 text-xs text-neutral-500 space-y-2">
            <span className="font-black text-[10px] uppercase tracking-wider text-neutral-700 block">🔒 High-Security Encrypted Storage</span>
            <p className="leading-relaxed">
              SMTP credential records are processed and synchronized inside Packer Tools using absolute cloud security guidelines. Key parameters reside globally under adminSettings in Firestore, restricting read-dispatch lookup access exclusively to super administrators.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}

/** 
 * =========================================================================
 * 9. COUNTRIES & REGIONAL COMMUNITIES SETTINGS TAB
 * =========================================================================
 */
export function CommunitiesSettingsTab({ settings, setSettings }: SettingsTabProps) {
  const currentCommunities = settings?.communities || [
    { id: 'fiji', name: 'Fiji Community', country: 'Fiji', countryCode: 'FJ', currency: 'FJD', flag: '🇫🇯', companyName: 'Packer Tools Fiji', isActive: true },
    { id: 'australia', name: 'Australian Community', country: 'Australia', countryCode: 'AU', currency: 'AUD', flag: '🇦🇺', companyName: 'Packer Tools Australia', isActive: true },
    { id: 'new_zealand', name: 'New Zealand Community', country: 'New Zealand', countryCode: 'NZ', currency: 'NZD', flag: '🇳🇿', companyName: 'Packer Tools New Zealand', isActive: true }
  ];

  const handleSave = async () => {
    try {
      await updateDoc(doc(db, 'adminSettings', 'global'), {
        ...settings,
        communities: currentCommunities
      } as any);
      toast.success("Localized geographical communities deploy synchronized across platform.");
    } catch (err) {
      toast.error("Failed to deploy communities config: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 shadow-sm space-y-6 text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-2xl font-black text-neutral-900 flex items-center gap-2">
              <MapPin className="text-primary" />
              <span>Regional Countries & Communities Portal</span>
            </h3>
            <p className="text-sm text-neutral-500 font-medium mt-1">
              Configure localized geographic country community workspaces. Add regional presets, specify tax structures (GST, VAT), currencies, and toggle Location-Based verification and onboarding.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const newComm = {
                id: `comm_${Date.now()}`,
                name: 'New Community',
                country: 'Fiji',
                countryCode: 'FJ',
                currency: 'FJD',
                flag: '🇫🇯',
                companyName: 'Packer Tools Team',
                isActive: true,
                taxName: 'GST',
                taxRate: 15,
                locationOnboardEnabled: false,
                locationOnboardRadiusKm: 50
              };
              setSettings(s => {
                if (!s) return null;
                const list = s.communities || [
                  { id: 'fiji', name: 'Fiji Community', country: 'Fiji', countryCode: 'FJ', currency: 'FJD', flag: '🇫🇯', companyName: 'Packer Tools Fiji', isActive: true },
                  { id: 'australia', name: 'Australian Community', country: 'Australia', countryCode: 'AU', currency: 'AUD', flag: '🇦🇺', companyName: 'Packer Tools Australia', isActive: true },
                  { id: 'new_zealand', name: 'New Zealand Community', country: 'New Zealand', countryCode: 'NZ', currency: 'NZD', flag: '🇳🇿', companyName: 'Packer Tools New Zealand', isActive: true }
                ];
                return { ...s, communities: [...list, newComm] };
              });
              toast.success("Blank community template added! Please customize below.");
            }}
            className="px-6 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-wider hover:scale-[1.02] active:scale-95 transition flex items-center gap-2 shrink-0 h-fit"
          >
            <Plus size={16} />
            <span>Add Community Hub</span>
          </button>
        </div>

        <div className="border-t border-neutral-100 pt-6 space-y-6">
          {currentCommunities.length === 0 ? (
            <div className="p-8 text-center bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
              <p className="font-bold text-neutral-400">No geographic communities configured.</p>
              <p className="text-xs text-neutral-400 mt-1">Click the "Add Community Hub" button to deploy your first region.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {currentCommunities.map((comm, index) => (
                <div key={comm.id} className="p-6 bg-neutral-50 border border-neutral-200/80 rounded-2xl space-y-4 relative hover:shadow-sm transition">
                  <div className="flex items-center justify-between border-b border-neutral-200/50 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{comm.flag || '🌐'}</span>
                      <span className="font-extrabold uppercase text-xs tracking-wider text-neutral-900">{comm.name || 'Unnamed Community'}</span>
                      <span className="text-[10px] font-mono text-neutral-400">({comm.id})</span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSettings(s => {
                            if (!s) return null;
                            const list = s.communities ? [...s.communities] : [
                              { id: 'fiji', name: 'Fiji Community', country: 'Fiji', countryCode: 'FJ', currency: 'FJD', flag: '🇫🇯', companyName: 'Packer Tools Fiji', isActive: true },
                              { id: 'australia', name: 'Australian Community', country: 'Australia', countryCode: 'AU', currency: 'AUD', flag: '🇦🇺', companyName: 'Packer Tools Australia', isActive: true },
                              { id: 'new_zealand', name: 'New Zealand Community', country: 'New Zealand', countryCode: 'NZ', currency: 'NZD', flag: '🇳🇿', companyName: 'Packer Tools New Zealand', isActive: true }
                            ];
                            list[index] = { ...list[index], isActive: !list[index].isActive };
                            return { ...s, communities: list };
                          });
                          toast.success(`${comm.name || 'Community'} status updated to: ${!comm.isActive ? 'Active' : 'Disabled / Deactivated'}`);
                        }}
                        className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-md border transition-all ${
                          comm.isActive 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-neutral-200 text-neutral-500 border-neutral-300'
                        }`}
                      >
                        {comm.isActive ? 'Active' : 'Deactivated'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSettings(s => {
                            if (!s) return null;
                            const list = s.communities ? [...s.communities] : [
                              { id: 'fiji', name: 'Fiji Community', country: 'Fiji', countryCode: 'FJ', currency: 'FJD', flag: '🇫🇯', companyName: 'Packer Tools Fiji', isActive: true },
                              { id: 'australia', name: 'Australian Community', country: 'Australia', countryCode: 'AU', currency: 'AUD', flag: '🇦🇺', companyName: 'Packer Tools Australia', isActive: true },
                              { id: 'new_zealand', name: 'New Zealand Community', country: 'New Zealand', countryCode: 'NZ', currency: 'NZD', flag: '🇳🇿', companyName: 'Packer Tools New Zealand', isActive: true }
                            ];
                            const updated = list.filter((_, idx) => idx !== index);
                            return { ...s, communities: updated };
                          });
                          toast.error("Community removed from list");
                        }}
                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition"
                        title="Delete community workspace"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Config Inputs Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Community Name</label>
                      <input
                        type="text"
                        value={comm.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSettings(s => {
                            if (!s) return null;
                            const list = s.communities ? [...s.communities] : [];
                            list[index] = { ...list[index], name: val };
                            return { ...s, communities: list };
                          });
                        }}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 font-bold outline-none focus:ring-1 focus:ring-primary text-neutral-800"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Country Location</label>
                      <input
                        type="text"
                        value={comm.country}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSettings(s => {
                            if (!s) return null;
                            const list = s.communities ? [...s.communities] : [];
                            list[index] = { ...list[index], country: val };
                            return { ...s, communities: list };
                          });
                        }}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 font-bold outline-none focus:ring-1 focus:ring-primary text-neutral-800"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Currency Code</label>
                      <input
                        type="text"
                        value={comm.currency}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSettings(s => {
                            if (!s) return null;
                            const list = s.communities ? [...s.communities] : [];
                            list[index] = { ...list[index], currency: val };
                            return { ...s, communities: list };
                          });
                        }}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 font-mono outline-none focus:ring-1 focus:ring-primary text-neutral-800"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Flag Emoji</label>
                      <input
                        type="text"
                        value={comm.flag}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSettings(s => {
                            if (!s) return null;
                            const list = s.communities ? [...s.communities] : [];
                            list[index] = { ...list[index], flag: val };
                            return { ...s, communities: list };
                          });
                        }}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-center outline-none focus:ring-1 focus:ring-primary text-neutral-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1 font-sans">
                      <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Community URL ID Prefix</label>
                      <input
                        type="text"
                        value={comm.id}
                        onChange={(e) => {
                          const val = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
                          setSettings(s => {
                            if (!s) return null;
                            const list = s.communities ? [...s.communities] : [];
                            list[index] = { ...list[index], id: val };
                            return { ...s, communities: list };
                          });
                        }}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 font-mono outline-none focus:ring-1 focus:ring-primary text-neutral-800"
                        placeholder="e.g. australia"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Localized Entity Branding Override</label>
                      <input
                        type="text"
                        value={comm.companyName || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSettings(s => {
                            if (!s) return null;
                            const list = s.communities ? [...s.communities] : [];
                            list[index] = { ...list[index], companyName: val };
                            return { ...s, communities: list };
                          });
                        }}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 font-bold outline-none focus:ring-1 focus:ring-primary text-neutral-800"
                        placeholder="e.g. Packer Tools Fiji"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs pt-4 border-t border-neutral-200/50">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">ISO Country Code</label>
                      <input
                        type="text"
                        maxLength={2}
                        value={comm.countryCode}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          setSettings(s => {
                            if (!s) return null;
                            const list = s.communities ? [...s.communities] : [];
                            list[index] = { ...list[index], countryCode: val };
                            return { ...s, communities: list };
                          });
                        }}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 font-mono font-bold outline-none focus:ring-1 focus:ring-primary text-neutral-800"
                        placeholder="e.g. AU"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Tax Type Name</label>
                      <input
                        type="text"
                        value={comm.taxName || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSettings(s => {
                            if (!s) return null;
                            const list = s.communities ? [...s.communities] : [];
                            list[index] = { ...list[index], taxName: val };
                            return { ...s, communities: list };
                          });
                        }}
                        placeholder="e.g. GST"
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 font-bold outline-none focus:ring-1 focus:ring-primary text-neutral-800"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Tax Rate Percentage (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={comm.taxRate !== undefined ? comm.taxRate : ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                          setSettings(s => {
                            if (!s) return null;
                            const list = s.communities ? [...s.communities] : [];
                            list[index] = { ...list[index], taxRate: val };
                            return { ...s, communities: list };
                          });
                        }}
                        placeholder="e.g. 15"
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 font-bold outline-none focus:ring-1 focus:ring-primary text-neutral-800"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Location Onboarding</label>
                      <div className="flex items-center h-10">
                        <label className="inline-flex items-center cursor-pointer gap-2">
                          <input
                            type="checkbox"
                            checked={!!comm.locationOnboardEnabled}
                            onChange={(e) => {
                              const val = e.target.checked;
                              setSettings(s => {
                                if (!s) return null;
                                const list = s.communities ? [...s.communities] : [];
                                list[index] = { ...list[index], locationOnboardEnabled: val };
                                return { ...s, communities: list };
                              });
                            }}
                            className="rounded border-neutral-300 text-primary focus:ring-primary"
                          />
                          <span className="text-[11px] font-bold uppercase text-neutral-600">Geo-Verification</span>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Verification Boundary (km)</label>
                      <input
                        type="number"
                        disabled={!comm.locationOnboardEnabled}
                        value={comm.locationOnboardRadiusKm !== undefined ? comm.locationOnboardRadiusKm : ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                          setSettings(s => {
                            if (!s) return null;
                            const list = s.communities ? [...s.communities] : [];
                            list[index] = { ...list[index], locationOnboardRadiusKm: val };
                            return { ...s, communities: list };
                          });
                        }}
                        placeholder="e.g. 100"
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 font-bold outline-none focus:ring-1 focus:ring-primary text-neutral-800 disabled:bg-neutral-100 disabled:opacity-50"
                      />
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t border-neutral-100">
          <button
            type="button"
            onClick={handleSave}
            className="px-12 py-5 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-105 active:scale-95 transition shadow-2xl flex items-center gap-3"
          >
            <Save size={20} />
            <span>Deploy Communities</span>
          </button>
        </div>
      </div>
    </div>
  );
}

