import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '../firebase';
import { UserProfile, AdminSettings } from '../types';
import { motion } from 'motion/react';
import { useIndustry } from '../context/IndustryContext';
import { User, Mail, Globe, MapPin, Building, Twitter, Instagram, Linkedin, Save, Camera, ShieldCheck, Zap, Package, Server, Home, BarChart3, Key, Copy, Code, RefreshCw, Check, ChevronRight, Plus, AlertCircle, CheckCircle2, Lock, ExternalLink, ShieldAlert, Award, Sun, Moon, Smartphone, Download, Layout, LayoutDashboard } from 'lucide-react';
import { getUsage } from '../lib/limitUtils';
import PaymentModal from '../components/PaymentModal';
import UpgradeNowModal from '../components/UpgradeNowModal';
import AITokenUsageChart from '../components/AITokenUsageChart';
import { useTheme } from '../context/ThemeContext';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { authenticatedFetch } from '../lib/api';

interface ProfilePageProps {
  user: UserProfile;
  onUpdate: (updatedUser: UserProfile) => void;
  adminSettings: AdminSettings | null;
}

export default function ProfilePage({ user, onUpdate, adminSettings }: ProfilePageProps) {
  const location = useLocation();
  const { getAdjustedLabel } = useIndustry();
  const searchParams = new URLSearchParams(location.search);
  const activeTab = searchParams.get('tab') || 'about';

  const { theme, setTheme } = useTheme();
  const { isReadyToInstall, isInstalled, triggerInstall } = usePWAInstall();
  const [profileBillingCycle, setProfileBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [isEditing, setIsEditing] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isUpgradeNowModalOpen, setIsUpgradeNowModalOpen] = useState(false);
  const [restrictedFeature, setRestrictedFeature] = useState('Developer API Settings');
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<any>(null);
  const [formData, setFormData] = useState<Partial<UserProfile>>({
    displayName: user.displayName,
    bio: user.bio || '',
    website: user.website || '',
    location: user.location || '',
    company: user.company || '',
    isProfilePublic: user.isProfilePublic || false,
    socialLinks: {
      twitter: user.socialLinks?.twitter || '',
      instagram: user.socialLinks?.instagram || '',
      linkedin: user.socialLinks?.linkedin || '',
    }
  });

  // Active Beta Notification Handshake States
  const [testWelcomeEmail, setTestWelcomeEmail] = useState(user.email || '');
  const [testWelcomeName, setTestWelcomeName] = useState(user.displayName || '');
  const [testMessage, setTestMessage] = useState('Urgent: Need to procure 10 additional Dymo 30334 sticker labels for the backup mountaineering expedition.');
  const [welcomeSending, setWelcomeSending] = useState(false);
  const [contactSending, setContactSending] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    simulated: boolean;
    html?: string;
    notice?: string;
    recipient?: string;
    subject?: string;
  } | null>(null);
  const [showTestHtml, setShowTestHtml] = useState(false);

  // KYC and Store Profile Configuration state
  const [storeCustomUrl, setStoreCustomUrl] = useState(user.storeCustomUrl || '');
  const [storeName, setStoreName] = useState(user.storeName || user.displayName || '');
  const [storeBio, setStoreBio] = useState(user.storeBio || user.bio || '');
  const [storeLogo, setStoreLogo] = useState(user.storeLogo || user.photoURL || '');
  const [storeCoverImage, setStoreCoverImage] = useState(user.storeCoverImage || '');
  const [storeWebsite, setStoreWebsite] = useState(user.storeWebsite || user.website || '');
  const [storeEmail, setStoreEmail] = useState(user.storeEmail || user.email || '');
  const [storePhone, setStorePhone] = useState(user.storePhone || '');
  const [storeTwitter, setStoreTwitter] = useState(user.storeTwitter || '');
  const [storeInstagram, setStoreInstagram] = useState(user.storeInstagram || '');
  const [storeLinkedin, setStoreLinkedin] = useState(user.storeLinkedin || '');
  const [storeFacebook, setStoreFacebook] = useState(user.storeFacebook || '');
  const [kycFullIdName, setKycFullIdName] = useState(user.kycFullIdName || user.displayName || '');
  const [kycIdType, setKycIdType] = useState<'passport' | 'national_id' | 'drivers_license'>(user.kycIdType || 'passport');
  const [kycIdNumber, setKycIdNumber] = useState(user.kycIdNumber || '');
  const [isSubmittingKyc, setIsSubmittingKyc] = useState(false);
  const [isSavingStore, setIsSavingStore] = useState(false);

  // Fiji Business Setup & FRCS Compliance KYC state fields
  const [fijiBusinessStatus, setFijiBusinessStatus] = useState<'not_started' | 'registered' | 'platform_representation'>(user.fijiBusinessStatus || 'not_started');
  const [fijiFrcsTin, setFijiFrcsTin] = useState(user.fijiFrcsTin || '');
  const [fijiBusinessLicenseNumber, setFijiBusinessLicenseNumber] = useState(user.fijiBusinessLicenseNumber || '');
  const [fijiBusinessRegisteredName, setFijiBusinessRegisteredName] = useState(user.fijiBusinessRegisteredName || '');
  const [fijiBusinessType, setFijiBusinessType] = useState<'sole_trader' | 'partnership' | 'company' | 'cooperative'>(user.fijiBusinessType || 'sole_trader');
  const [fijiUsePlatformBusinessLicense, setFijiUsePlatformBusinessLicense] = useState<boolean>(user.fijiUsePlatformBusinessLicense || false);
  const [fijiAllowPackerListToList, setFijiAllowPackerListToList] = useState<boolean>(user.fijiAllowPackerListToList || false);
  const [isSavingKycFiji, setIsSavingKycFiji] = useState(false);

  const handleSaveStoreProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingStore(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const updateData = {
        storeCustomUrl,
        storeName,
        storeBio,
        storeLogo,
        storeCoverImage,
        storeWebsite,
        storeEmail,
        storePhone,
        storeTwitter,
        storeInstagram,
        storeLinkedin,
        storeFacebook
      };
      await updateDoc(userRef, updateData);
      onUpdate({
        ...user,
        ...updateData
      });
      toast.success("Shopfront profile updated successfully!");
    } catch (err) {
      console.error("Error saving store profile:", err);
      toast.error("Failed to persist shopfront settings.");
    } finally {
      setIsSavingStore(false);
    }
  };

  const handleSaveFijiKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingKycFiji(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const updateData = {
        fijiBusinessStatus,
        fijiFrcsTin,
        fijiBusinessLicenseNumber,
        fijiBusinessRegisteredName,
        fijiBusinessType,
        fijiUsePlatformBusinessLicense,
        fijiAllowPackerListToList,
        kycStatus: (fijiBusinessStatus !== 'not_started' ? 'verified' : 'not_started') as 'not_started' | 'pending' | 'verified' | 'rejected',
      };
      await updateDoc(userRef, updateData);
      onUpdate({
        ...user,
        ...updateData
      });
      toast.success("Fiji FRCS Business Compliance details saved successfully!");
    } catch (err) {
      console.error("Error saving Fiji KYC profile:", err);
      toast.error("Failed to persist compliance settings.");
    } finally {
      setIsSavingKycFiji(false);
    }
  };

  useEffect(() => {
    const fetchUsage = async () => {
      const usageData = await getUsage(user, adminSettings);
      setUsage(usageData);
    };
    fetchUsage();
  }, [user, adminSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, formData);
      onUpdate({ ...user, ...formData });
      setIsEditing(false);
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialChange = (platform: keyof NonNullable<UserProfile['socialLinks']>, value: string) => {
    setFormData(prev => ({
      ...prev,
      socialLinks: {
        ...prev.socialLinks,
        [platform]: value
      }
    }));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 sm:space-y-12 pb-24 px-4 sm:px-0">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 sm:gap-8 text-center sm:text-left">
        <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
          <div className="relative group">
            <img 
              src={user.photoURL} 
              alt={user.displayName} 
              className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl border-4 border-white shadow-2xl grayscale hover:grayscale-0 transition-all duration-500" 
            />
            <div className="absolute -bottom-2 -right-2 w-8 h-8 sm:w-10 sm:h-10 bg-primary text-white rounded-xl flex items-center justify-center shadow-lg">
              <Camera size={16} className="sm:hidden" />
              <Camera size={20} className="hidden sm:block" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3">
              <h1 className="text-2xl sm:text-4xl font-black tracking-tighter uppercase">{user.displayName}</h1>
              {user.plan !== 'free' && (
                <span className="px-3 py-1 bg-accent text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-glow">
                  {adminSettings?.plans?.find(p => p.id === user.plan || p.name.toLowerCase() === user.plan?.toLowerCase())?.name || user.plan}
                </span>
              )}
            </div>
            <p className="text-neutral-500 font-medium break-all">{user.email}</p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs font-bold uppercase tracking-widest text-neutral-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-primary" />
                Joined {new Date(user.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        {(activeTab === 'about' || activeTab === 'connect') && (
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`w-full sm:w-auto px-8 py-3 rounded-full font-bold uppercase text-xs tracking-widest transition-all ${
              isEditing ? 'bg-neutral-100 text-neutral-600' : 'bg-primary text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5'
            }`}
          >
            {isEditing ? 'Cancel' : 'Edit Profile'}
          </button>
        )}
      </header>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        transition={{ duration: 0.25 }}
        className="space-y-8 sm:space-y-12"
      >
        {activeTab === 'about' && (
          <section className="bg-white p-5 sm:p-10 rounded-2xl sm:rounded-[3rem] border border-primary/5 shadow-sm space-y-6 sm:space-y-8 animate-fade-in animate-duration-300">
            <h3 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
              <User className="text-primary" />
              <span>About Me</span>
            </h3>
            
            {isEditing ? (
              <form onSubmit={handleSave} className="space-y-6 col-span-full">
                <div className="space-y-2">
                  <label className="micro-label">Display Name</label>
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-neutral-50 border border-neutral-100 rounded-2xl focus:ring-2 focus:ring-primary outline-none transition"
                  />
                </div>
                <div className="space-y-2">
                  <label className="micro-label">Bio</label>
                  <textarea
                    rows={4}
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Tell us about yourself or your brand..."
                    className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-neutral-50 border border-neutral-100 rounded-2xl focus:ring-2 focus:ring-primary outline-none transition resize-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <label className="micro-label">Company</label>
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-neutral-50 border border-neutral-100 rounded-2xl focus:ring-2 focus:ring-primary outline-none transition"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="micro-label">Location</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-neutral-50 border border-neutral-100 rounded-2xl focus:ring-2 focus:ring-primary outline-none transition"
                    />
                  </div>
                </div>

                <div className="p-5 bg-neutral-50 rounded-2xl border border-neutral-100/80 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-black uppercase tracking-wider text-neutral-800 block">Public Profile Directory Visibility</span>
                    <p className="text-[10px] text-neutral-400 font-bold uppercase leading-relaxed">Toggle to list your branding profile details publicly so other team operators can discover and contact you.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isProfilePublic: !formData.isProfilePublic })}
                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 outline-none shrink-0 ${formData.isProfilePublic ? 'bg-[#ff4f3a]' : 'bg-neutral-300'}`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${formData.isProfilePublic ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 sm:py-5 bg-primary text-white rounded-2xl font-black uppercase tracking-widest hover:bg-primary/90 transition shadow-xl flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {loading ? 'Saving...' : (
                    <>
                      <Save size={20} />
                      Save Changes
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="space-y-6 sm:space-y-8">
                <p className="text-base sm:text-lg text-neutral-600 leading-relaxed font-medium break-words">
                  {user.bio || 'No bio provided yet. Tell the world about your gear management style.'}
                </p>
                <div className="grid grid-cols-2 gap-4 sm:gap-8 pt-6 sm:pt-8 border-t border-primary/5">
                  <div className="space-y-1 min-w-0">
                    <div className="micro-label">Company</div>
                    <div className="flex items-center gap-2 font-bold text-sm sm:text-base truncate">
                      <Building size={16} className="text-primary shrink-0" />
                      <span className="truncate">{user.company || 'Not specified'}</span>
                    </div>
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="micro-label">Location</div>
                    <div className="flex items-center gap-2 font-bold text-sm sm:text-base truncate">
                      <MapPin size={16} className="text-primary shrink-0" />
                      <span className="truncate">{user.location || 'Not specified'}</span>
                    </div>
                  </div>
                </div>
                <div className="pt-6 border-t border-primary/5 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Directory Visibility</span>
                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${user.isProfilePublic ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-600'}`}>
                    {user.isProfilePublic ? 'Listed as Public Profile' : 'Private Profile (Hidden)'}
                  </span>
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === 'preferences' && (
          /* Marketplace Equipment Rental Settings */
          <section className="bg-white p-5 sm:p-10 rounded-2xl sm:rounded-[3rem] border border-primary/5 shadow-sm space-y-6 sm:space-y-8 animate-fade-in animate-duration-300">
            <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
              <Globe className="text-primary shrink-0" />
              <span>Rental Marketplace Settings</span>
            </h3>
            <p className="text-sm text-neutral-500 leading-relaxed font-semibold">
              If you list equipment for rent or sale, activate the currencies below that you wish to accept in your marketplace.
            </p>

            <div className="space-y-4">
              <label className="text-xs font-black uppercase tracking-wider text-neutral-400 block pb-2">Select Active Currencies</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(adminSettings?.onboardedCurrencies || [
                  { code: 'USD', name: 'US Dollar', symbol: '$', isActive: true },
                  { code: 'FJD', name: 'Fijian Dollar', symbol: 'FJ$', isActive: true }
                ]).filter(c => c.isActive).map((c) => {
                  const activatedList = user.activeMarketplaceCurrencies || ['USD'];
                  const isChecked = activatedList.includes(c.code);
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={async () => {
                        let updated: string[];
                        if (isChecked) {
                          // Prevent disabling if it is the only one
                          if (activatedList.length <= 1) {
                            toast.error("You must have at least one active currency enabled for rentals.");
                            return;
                          }
                          updated = activatedList.filter(code => code !== c.code);
                        } else {
                          updated = [...activatedList, c.code];
                        }
                        try {
                          const userRef = doc(db, 'users', user.uid);
                          await updateDoc(userRef, { activeMarketplaceCurrencies: updated });
                          onUpdate({ ...user, activeMarketplaceCurrencies: updated });
                          toast.success(`Marketplace currency ${c.code} toggled successfully!`);
                        } catch (err) {
                          console.error(err);
                          toast.error("Error updating marketplace settings.");
                        }
                      }}
                      className={`p-4 rounded-2xl border text-left transition flex items-center justify-between gap-3 ${
                        isChecked 
                          ? 'bg-neutral-900 text-white border-neutral-900 shadow-lg' 
                          : 'bg-neutral-50 text-neutral-700 border-neutral-200/60 hover:bg-neutral-100'
                      }`}
                    >
                      <div>
                        <span className="font-extrabold block text-sm tracking-tight">{c.code} ({c.symbol})</span>
                        <span className="text-[10px] opacity-75 block font-bold uppercase tracking-wider">{c.name}</span>
                      </div>
                      <div className={`p-1.5 rounded-full ${isChecked ? 'bg-white text-neutral-900' : 'bg-neutral-200 text-neutral-500'}`}>
                        {isChecked ? <Check size={12} className="stroke-[3]" /> : <Plus size={12} className="stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Geographical Operating Region for User */}
              <div className="pt-8 border-t border-neutral-100 space-y-4">
                <div>
                  <h4 className="text-sm font-black uppercase tracking-tight text-neutral-800">Primary Marketplace Country</h4>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1">Specify your geographic physical location. Packer Tools availability varies by country.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-black text-neutral-400">Select Operating Location</label>
                    <select
                      value={user.country || 'Fiji'}
                      onChange={async (e) => {
                        const newCountry = e.target.value;
                        try {
                          const userRef = doc(db, 'users', user.uid);
                          await updateDoc(userRef, { country: newCountry });
                          
                          // Pre-select appropriate active currency based on selected country
                          let updatedCurrencies = user.activeMarketplaceCurrencies || ['USD'];
                          if (newCountry === 'Fiji') {
                            if (!updatedCurrencies.includes('FJD')) {
                              updatedCurrencies = [...updatedCurrencies, 'FJD'];
                              await updateDoc(userRef, { activeMarketplaceCurrencies: updatedCurrencies });
                            }
                          }
                          
                          onUpdate({ ...user, country: newCountry, activeMarketplaceCurrencies: updatedCurrencies });
                          toast.success(`Operating region switched to ${newCountry}!`);
                        } catch (err) {
                          console.error(err);
                          toast.error("Error updating location region setting.");
                        }
                      }}
                      className="w-full px-5 py-3.5 bg-neutral-50 border border-neutral-200/60 rounded-2xl outline-none focus:ring-2 focus:ring-primary transition font-bold text-neutral-800"
                    >
                      <option value="Fiji">Fiji (Launch Country / Active Hub)</option>
                      <option value="United States">United States</option>
                      <option value="Australia">Australia</option>
                      <option value="New Zealand">New Zealand</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Canada">Canada</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] uppercase tracking-widest font-black text-neutral-400 block pb-1">Geographic Service Status</span>
                    {(user.country === 'Fiji' || !user.country || (adminSettings?.marketplaceRegionConfig?.availableCountries || ['Fiji']).includes(user.country || 'Fiji')) ? (
                      <div className="p-4 bg-emerald-50 border border-emerald-500/20 rounded-2xl text-[10px] text-emerald-800 leading-relaxed">
                        <span className="font-black uppercase text-emerald-600 block pb-0.5">🟢 PARTNER REGION ACTIVE</span>
                        Packer Tools is fully active in <strong className="font-extrabold uppercase">{user.country || 'Fiji'}</strong>. You can safely rent, list camera gear, buy out products, and benefit from complete local escrows and visual booking protection.
                      </div>
                    ) : (
                      <div className="p-4 bg-amber-50 border border-amber-500/20 rounded-2xl text-[10px] text-amber-800 leading-relaxed">
                        <span className="font-black uppercase text-amber-600 block pb-0.5">⚠️ SOFT LAUNCH WARNING</span>
                        Packer Tools operations are not fully launched in <strong className="font-extrabold uppercase">{user.country}</strong>. Active servers are currently focused on Fiji. Safe escrow deposits may be limited.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* View Density Preferences */}
              <div className="pt-8 border-t border-neutral-100 space-y-4">
                <div>
                  <h4 className="text-sm font-black uppercase tracking-tight text-neutral-800">Application View Density</h4>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1">Configure your global layout preference for listings and tables across all asset modules.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const userRef = doc(db, 'users', user.uid);
                        await updateDoc(userRef, { viewDensity: 'comfortable' });
                        onUpdate({ ...user, viewDensity: 'comfortable' });
                        toast.success("Comfortable layout mode enabled!");
                      } catch (err) {
                        console.error(err);
                        toast.error("Error setting layout density.");
                      }
                    }}
                    className={`p-5 rounded-2xl border text-left transition-all relative ${
                      (user.viewDensity || 'comfortable') === 'comfortable'
                        ? 'bg-neutral-900 text-white border-neutral-900 shadow-lg'
                        : 'bg-neutral-50 text-neutral-700 border-neutral-200/60 hover:bg-neutral-100'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-extrabold block text-sm tracking-tight">Comfortable View (Visual/Cards)</span>
                        <p className={`text-[10px] mt-1.5 leading-relaxed font-semibold ${(user.viewDensity || 'comfortable') === 'comfortable' ? 'text-neutral-350' : 'text-neutral-450'}`}>
                          Maximizes negative space, emphasizing visual card structures, detailed item information, and friendly media-rich packaging.
                        </p>
                      </div>
                      <div className={`p-1.5 rounded-full shrink-0 ml-3 ${(user.viewDensity || 'comfortable') === 'comfortable' ? 'bg-white text-neutral-900' : 'bg-neutral-200 text-neutral-500'}`}>
                        <Check size={12} className="stroke-[3]" />
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const userRef = doc(db, 'users', user.uid);
                        await updateDoc(userRef, { viewDensity: 'compact' });
                        onUpdate({ ...user, viewDensity: 'compact' });
                        toast.success("Compact layout mode enabled!");
                      } catch (err) {
                        console.error(err);
                        toast.error("Error setting layout density.");
                      }
                    }}
                    className={`p-5 rounded-2xl border text-left transition-all relative ${
                      user.viewDensity === 'compact'
                        ? 'bg-neutral-900 text-white border-neutral-900 shadow-lg'
                        : 'bg-neutral-50 text-neutral-700 border-neutral-200/60 hover:bg-neutral-100'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-extrabold block text-sm tracking-tight">Compact View (Dense Tables)</span>
                        <p className={`text-[10px] mt-1.5 leading-relaxed font-semibold ${user.viewDensity === 'compact' ? 'text-neutral-350' : 'text-neutral-450'}`}>
                          Condenses rows, maximizes field-level visibility on tables, and packs as much operational metadata as possible onto the screen.
                        </p>
                      </div>
                      <div className={`p-1.5 rounded-full shrink-0 ml-3 ${user.viewDensity === 'compact' ? 'bg-white text-neutral-900' : 'bg-neutral-200 text-neutral-500'}`}>
                        <Check size={12} className="stroke-[3]" />
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Dashboard Layout Preferences */}
              <div className="pt-8 border-t border-neutral-100 space-y-4">
                <div>
                  <h4 className="text-sm font-black uppercase tracking-tight text-neutral-800">Dashboard Layout Mode</h4>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1">Configure your Workspace landing interface density.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const userRef = doc(db, 'users', user.uid);
                        await updateDoc(userRef, { dashboardMode: 'minimal' });
                        onUpdate({ ...user, dashboardMode: 'minimal' });
                        toast.success("Dashboard switched to Minimal Overview!");
                      } catch (err) {
                        console.error(err);
                        toast.error("Error setting dashboard preference.");
                      }
                    }}
                    className={`p-5 rounded-2xl border text-left transition-all relative ${
                      (user.dashboardMode || 'minimal') === 'minimal'
                        ? 'bg-neutral-900 text-white border-neutral-900 shadow-lg'
                        : 'bg-neutral-50 text-neutral-700 border-neutral-200/60 hover:bg-neutral-100'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-extrabold block text-sm tracking-tight">Minimalist Hub (Default)</span>
                        <p className={`text-[10px] mt-1.5 leading-relaxed font-semibold ${(user.dashboardMode || 'minimal') === 'minimal' ? 'text-neutral-350' : 'text-neutral-450'}`}>
                          Reduces visual overwhelm by displaying only direct, high-value quick action triggers: Packing List, Asset Inventory, Rack, System Build, and Listing.
                        </p>
                      </div>
                      <div className={`p-1.5 rounded-full shrink-0 ml-3 ${(user.dashboardMode || 'minimal') === 'minimal' ? 'bg-white text-neutral-900' : 'bg-neutral-200 text-neutral-500'}`}>
                        <Check size={12} className="stroke-[3]" />
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const userRef = doc(db, 'users', user.uid);
                        await updateDoc(userRef, { dashboardMode: 'all' });
                        onUpdate({ ...user, dashboardMode: 'all' });
                        toast.success("Dashboard switched to Comprehensive Overview!");
                      } catch (err) {
                        console.error(err);
                        toast.error("Error setting dashboard preference.");
                      }
                    }}
                    className={`p-5 rounded-2xl border text-left transition-all relative ${
                      user.dashboardMode === 'all'
                        ? 'bg-neutral-900 text-white border-neutral-900 shadow-lg'
                        : 'bg-neutral-50 text-neutral-700 border-neutral-200/60 hover:bg-neutral-100'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-extrabold block text-sm tracking-tight">Compendious (Show All)</span>
                        <p className={`text-[10px] mt-1.5 leading-relaxed font-semibold ${user.dashboardMode === 'all' ? 'text-neutral-350' : 'text-neutral-450'}`}>
                          Unlocks the complete suite, offering live analytic charts, recent checklist tables, upcoming transaction reminders, and the Kiosk Mode terminal.
                        </p>
                      </div>
                      <div className={`p-1.5 rounded-full shrink-0 ml-3 ${user.dashboardMode === 'all' ? 'bg-white text-neutral-900' : 'bg-neutral-200 text-neutral-500'}`}>
                        <Check size={12} className="stroke-[3]" />
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Quick Actions Drawer Preference */}
              <div className="pt-8 border-t border-neutral-100 space-y-4">
                <div>
                  <h4 className="text-sm font-black uppercase tracking-tight text-neutral-800">Quick Actions Overlay Widget</h4>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1">Enable or disable the floating Quick Actions slider on the edge of your screen.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const userRef = doc(db, 'users', user.uid);
                        await updateDoc(userRef, { disableQuickActions: false });
                        onUpdate({ ...user, disableQuickActions: false });
                        toast.success("Quick Actions enabled successfully!");
                      } catch (err) {
                        console.error(err);
                        toast.error("Error updating preference.");
                      }
                    }}
                    className={`p-5 rounded-2xl border text-left transition-all relative ${
                      !user.disableQuickActions
                        ? 'bg-neutral-900 text-white border-neutral-900 shadow-lg'
                        : 'bg-neutral-50 text-neutral-700 border-neutral-200/60 hover:bg-neutral-100'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-extrabold block text-sm tracking-tight">Show Floating Widget</span>
                        <p className={`text-[10px] mt-1.5 leading-relaxed font-semibold ${!user.disableQuickActions ? 'text-neutral-350' : 'text-neutral-450'}`}>
                          Keep the amber-accented sliding drawer active globally for fast CSV exports, QR tags printing, and maintenance auditing.
                        </p>
                      </div>
                      <div className={`p-1.5 rounded-full shrink-0 ml-3 ${!user.disableQuickActions ? 'bg-white text-neutral-900' : 'bg-neutral-200 text-neutral-500'}`}>
                        <Check size={12} className="stroke-[3]" />
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const userRef = doc(db, 'users', user.uid);
                        await updateDoc(userRef, { disableQuickActions: true });
                        onUpdate({ ...user, disableQuickActions: true });
                        toast.success("Quick Actions floating widget hidden!");
                      } catch (err) {
                        console.error(err);
                        toast.error("Error updating preference.");
                      }
                    }}
                    className={`p-5 rounded-2xl border text-left transition-all relative ${
                      user.disableQuickActions
                        ? 'bg-neutral-900 text-white border-neutral-900 shadow-lg'
                        : 'bg-neutral-50 text-neutral-700 border-neutral-200/60 hover:bg-neutral-100'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-extrabold block text-sm tracking-tight">Hide Floating Widget</span>
                        <p className={`text-[10px] mt-1.5 leading-relaxed font-semibold ${user.disableQuickActions ? 'text-neutral-350' : 'text-neutral-450'}`}>
                          Removes the side-tab toggle from all screens. You can still access deep diagnostics directly from your administrative workspace dashboards.
                        </p>
                      </div>
                      <div className={`p-1.5 rounded-full shrink-0 ml-3 ${user.disableQuickActions ? 'bg-white text-neutral-900' : 'bg-neutral-200 text-neutral-500'}`}>
                        <Check size={12} className="stroke-[3]" />
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Customizable Dashboard Widgets & Quick Access Buttons Preferences */}
              <div className="pt-8 border-t border-neutral-100 space-y-6">
                <div>
                  <h4 className="text-sm font-black uppercase tracking-tight text-neutral-800">Custom Dashboard Column & Widget Builder</h4>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1">
                    Control which widgets, alerts, charts, and operational consoles are rendered on your administrative homepage workspace.
                  </p>
                </div>

                <div className="bg-neutral-50 p-5 rounded-3xl border border-neutral-150 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Widget Toggle: Stats Summary Cards */}
                    <div className="flex items-center justify-between p-3.5 bg-white border border-neutral-100 rounded-2xl">
                      <div className="space-y-0.5">
                        <span className="text-xs font-black uppercase tracking-tight text-neutral-800 block">Performance Metric Cards</span>
                        <p className="text-[9px] text-neutral-400 font-bold uppercase block">Kit Value, Audit Score, and Total Weight trackers</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const current = user.layoutPreferences || {};
                          const updated = {
                            ...current,
                            showStatsCards: current.showStatsCards === false ? true : false
                          };
                          try {
                            const userRef = doc(db, 'users', user.uid);
                            await updateDoc(userRef, { layoutPreferences: updated });
                            onUpdate({ ...user, layoutPreferences: updated });
                            toast.success("Stats summary metric cards preference updated!");
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 outline-none shrink-0 border ${
                          (user.layoutPreferences?.showStatsCards !== false) ? 'bg-[#ff4f3a] border-[#ff4f3a]' : 'bg-neutral-200 border-neutral-300'
                        }`}
                      >
                        <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ${
                          (user.layoutPreferences?.showStatsCards !== false) ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>

                    {/* Widget Toggle: Active Deployments distribution chart */}
                    <div className="flex items-center justify-between p-3.5 bg-white border border-neutral-100 rounded-2xl">
                      <div className="space-y-0.5">
                        <span className="text-xs font-black uppercase tracking-tight text-neutral-800 block">Deployments chart</span>
                        <p className="text-[9px] text-neutral-400 font-bold uppercase block">Bar chart of weight and valuation distributions</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const current = user.layoutPreferences || {};
                          const updated = {
                            ...current,
                            showDistributionChart: current.showDistributionChart === false ? true : false
                          };
                          try {
                            const userRef = doc(db, 'users', user.uid);
                            await updateDoc(userRef, { layoutPreferences: updated });
                            onUpdate({ ...user, layoutPreferences: updated });
                            toast.success("Deployments distribution chart preference updated!");
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 outline-none shrink-0 border ${
                          (user.layoutPreferences?.showDistributionChart !== false) ? 'bg-[#ff4f3a] border-[#ff4f3a]' : 'bg-neutral-200 border-neutral-300'
                        }`}
                      >
                        <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ${
                          (user.layoutPreferences?.showDistributionChart !== false) ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>

                    {/* Widget Toggle: Gear Maintenance Center */}
                    <div className="flex items-center justify-between p-3.5 bg-white border border-neutral-100 rounded-2xl">
                      <div className="space-y-0.5">
                        <span className="text-xs font-black uppercase tracking-tight text-neutral-800 block">Maintenance Alerts Panel</span>
                        <p className="text-[9px] text-neutral-400 font-bold uppercase block">Display gear service countdowns and imminent repairs</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const current = user.layoutPreferences || {};
                          const updated = {
                            ...current,
                            showMaintenanceAlerts: current.showMaintenanceAlerts === false ? true : false
                          };
                          try {
                            const userRef = doc(db, 'users', user.uid);
                            await updateDoc(userRef, { layoutPreferences: updated });
                            onUpdate({ ...user, layoutPreferences: updated });
                            toast.success("Maintenance alerts panel preference updated!");
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 outline-none shrink-0 border ${
                          (user.layoutPreferences?.showMaintenanceAlerts !== false) ? 'bg-[#ff4f3a] border-[#ff4f3a]' : 'bg-neutral-200 border-neutral-300'
                        }`}
                      >
                        <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ${
                          (user.layoutPreferences?.showMaintenanceAlerts !== false) ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>

                    {/* Widget Toggle: Recent Packing Lists */}
                    <div className="flex items-center justify-between p-3.5 bg-white border border-neutral-100 rounded-2xl">
                      <div className="space-y-0.5">
                        <span className="text-xs font-black uppercase tracking-tight text-neutral-800 block">Recent Packing Lists</span>
                        <p className="text-[9px] text-neutral-400 font-bold uppercase block">Fast links to your recently accessed templates & sheets</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const current = user.layoutPreferences || {};
                          const updated = {
                            ...current,
                            showRecentLists: current.showRecentLists === false ? true : false
                          };
                          try {
                            const userRef = doc(db, 'users', user.uid);
                            await updateDoc(userRef, { layoutPreferences: updated });
                            onUpdate({ ...user, layoutPreferences: updated });
                            toast.success("Recent packing lists panel preference updated!");
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 outline-none shrink-0 border ${
                          (user.layoutPreferences?.showRecentLists !== false) ? 'bg-[#ff4f3a] border-[#ff4f3a]' : 'bg-neutral-200 border-neutral-300'
                        }`}
                      >
                        <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ${
                          (user.layoutPreferences?.showRecentLists !== false) ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>

                    {/* Widget Toggle: Kiosk Self-checkout Terminal */}
                    <div className="flex items-center justify-between p-3.5 bg-white border border-neutral-100 rounded-2xl">
                      <div className="space-y-0.5">
                        <span className="text-xs font-black uppercase tracking-tight text-neutral-800 block">Kiosk self-checkout terminal hub</span>
                        <p className="text-[9px] text-neutral-400 font-bold uppercase block">QR scanning pairing portal for tablet dispatching</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const current = user.layoutPreferences || {};
                          const updated = {
                            ...current,
                            showKioskTerminal: current.showKioskTerminal === false ? true : false
                          };
                          try {
                            const userRef = doc(db, 'users', user.uid);
                            await updateDoc(userRef, { layoutPreferences: updated });
                            onUpdate({ ...user, layoutPreferences: updated });
                            toast.success("Kiosk self-checkout terminal hub preference updated!");
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 outline-none shrink-0 border ${
                          (user.layoutPreferences?.showKioskTerminal !== false) ? 'bg-[#ff4f3a] border-[#ff4f3a]' : 'bg-neutral-200 border-neutral-300'
                        }`}
                      >
                        <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ${
                          (user.layoutPreferences?.showKioskTerminal !== false) ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>

                    {/* Widget Toggle: Construction Safety OSHA Console */}
                    <div className="flex items-center justify-between p-3.5 bg-white border border-neutral-100 rounded-2xl">
                      <div className="space-y-0.5">
                        <span className="text-xs font-black uppercase tracking-tight text-neutral-800 block">OSHA Safety & drops console</span>
                        <p className="text-[9px] text-neutral-400 font-bold uppercase block">Worksites compliance score and insulated tooling checks</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const current = user.layoutPreferences || {};
                          const updated = {
                            ...current,
                            showSafetyConsole: current.showSafetyConsole === false ? true : false
                          };
                          try {
                            const userRef = doc(db, 'users', user.uid);
                            await updateDoc(userRef, { layoutPreferences: updated });
                            onUpdate({ ...user, layoutPreferences: updated });
                            toast.success("Safety compliance checks console preference updated!");
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 outline-none shrink-0 border ${
                          (user.layoutPreferences?.showSafetyConsole !== false) ? 'bg-[#ff4f3a] border-[#ff4f3a]' : 'bg-neutral-200 border-neutral-300'
                        }`}
                      >
                        <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ${
                          (user.layoutPreferences?.showSafetyConsole !== false) ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>

                    {/* Widget Toggle: Fleet Vehicle Dispatch */}
                    <div className="flex items-center justify-between p-3.5 bg-white border border-neutral-100 rounded-2xl">
                      <div className="space-y-0.5">
                        <span className="text-xs font-black uppercase tracking-tight text-neutral-800 block">Fleet vehicles dispatch locker</span>
                        <p className="text-[9px] text-neutral-400 font-bold uppercase block">Fuel tracking and vehicle assignments checkout checklist</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const current = user.layoutPreferences || {};
                          const updated = {
                            ...current,
                            showFleetDispatch: current.showFleetDispatch === false ? true : false
                          };
                          try {
                            const userRef = doc(db, 'users', user.uid);
                            await updateDoc(userRef, { layoutPreferences: updated });
                            onUpdate({ ...user, layoutPreferences: updated });
                            toast.success("Fleet vehicle dispatch checklist preference updated!");
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 outline-none shrink-0 border ${
                          (user.layoutPreferences?.showFleetDispatch !== false) ? 'bg-[#ff4f3a] border-[#ff4f3a]' : 'bg-neutral-200 border-neutral-300'
                        }`}
                      >
                        <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ${
                          (user.layoutPreferences?.showFleetDispatch !== false) ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>

                    {/* Widget Toggle: Rapid Action Hub */}
                    <div className="flex items-center justify-between p-3.5 bg-white border border-neutral-100 rounded-2xl">
                      <div className="space-y-0.5">
                        <span className="text-xs font-black uppercase tracking-tight text-neutral-800 block">Rapid Action Hub</span>
                        <p className="text-[9px] text-neutral-400 font-bold uppercase block">Create panel with checklist triggers and asset creation grid</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const current = user.layoutPreferences || {};
                          const updated = {
                            ...current,
                            showQuickActionGrid: current.showQuickActionGrid === false ? true : false
                          };
                          try {
                            const userRef = doc(db, 'users', user.uid);
                            await updateDoc(userRef, { layoutPreferences: updated });
                            onUpdate({ ...user, layoutPreferences: updated });
                            toast.success("Rapid Action Hub widget preference updated!");
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 outline-none shrink-0 border ${
                          (user.layoutPreferences?.showQuickActionGrid !== false) ? 'bg-[#ff4f3a] border-[#ff4f3a]' : 'bg-neutral-200 border-neutral-300'
                        }`}
                      >
                        <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ${
                          (user.layoutPreferences?.showQuickActionGrid !== false) ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>

                    {/* Widget Toggle: Real-time System Pulse Telemetry */}
                    <div className="flex items-center justify-between p-3.5 bg-white border border-neutral-100 rounded-2xl">
                      <div className="space-y-0.5">
                        <span className="text-xs font-black uppercase tracking-tight text-neutral-800 block">System Pulse Telemetry</span>
                        <p className="text-[9px] text-neutral-400 font-bold uppercase block">Live terminal online ratio & real-time Firestore sync/ping metrics</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const current = user.layoutPreferences || {};
                          const updated = {
                            ...current,
                            enableSystemPulseTelemetry: current.enableSystemPulseTelemetry === false ? true : false
                          };
                          try {
                            const userRef = doc(db, 'users', user.uid);
                            await updateDoc(userRef, { layoutPreferences: updated });
                            onUpdate({ ...user, layoutPreferences: updated });
                            toast.success("System Pulse real-time telemetry preference updated!");
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 outline-none shrink-0 border ${
                          (user.layoutPreferences?.enableSystemPulseTelemetry !== false) ? 'bg-[#ff4f3a] border-[#ff4f3a]' : 'bg-neutral-200 border-neutral-300'
                        }`}
                      >
                        <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform duration-200 ${
                          (user.layoutPreferences?.enableSystemPulseTelemetry !== false) ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>
                  </div>

                  {/* CUSTOM QUICK ACTION BUTTON SELECTOR */}
                  <div className="pt-6 border-t border-neutral-200 mt-4 space-y-4">
                    <div>
                      <span className="text-xs font-black uppercase tracking-wider text-neutral-800 block">Visible Quick Actions Buttons</span>
                      <p className="text-[10px] text-neutral-400 font-bold uppercase leading-relaxed">
                        Customize exactly which quick access creation cards are enabled inside the Rapid Action Hub grid. Unchecked buttons will be filtered out.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                      {[
                        { id: 'packing_list', name: '+ packing list' },
                        { id: 'inventory', name: '+ inventory' },
                        { id: 'rack', name: '+ tech rack' },
                        { id: 'system_build', name: '+ system build' },
                        { id: 'listing', name: '+ list item' },
                      ].map((buttonItem) => {
                        const visibleButtons = user.layoutPreferences?.visibleQuickActions || ['packing_list', 'inventory', 'rack', 'system_build', 'listing'];
                        const isChecked = visibleButtons.includes(buttonItem.id);
                        return (
                          <button
                            key={buttonItem.id}
                            type="button"
                            onClick={async () => {
                              const current = user.layoutPreferences || {};
                              const currentButtons = current.visibleQuickActions || ['packing_list', 'inventory', 'rack', 'system_build', 'listing'];
                              let updated: string[];
                              if (currentButtons.includes(buttonItem.id)) {
                                if (currentButtons.length <= 1) {
                                  toast.error("Please keep at least one action button checked.");
                                  return;
                                }
                                updated = currentButtons.filter(b => b !== buttonItem.id);
                              } else {
                                updated = [...currentButtons, buttonItem.id];
                              }
                              const updatedPrefs = { ...current, visibleQuickActions: updated };
                              try {
                                const userRef = doc(db, 'users', user.uid);
                                await updateDoc(userRef, { layoutPreferences: updatedPrefs });
                                onUpdate({ ...user, layoutPreferences: updatedPrefs });
                                toast.success(`Button "${buttonItem.name}" configuration updated!`);
                              } catch (err) {
                                console.error(err);
                              }
                            }}
                            className={`p-3 rounded-2xl border text-center transition-all ${
                              isChecked 
                                ? `bg-neutral-900 border-neutral-900 text-white shadow-md`
                                : `bg-neutral-50 hover:bg-neutral-100 text-neutral-600 border-neutral-200/60`
                            }`}
                          >
                            <span className="text-[10px] font-black uppercase tracking-wider block">{buttonItem.name}</span>
                            <span className="text-[8px] opacity-70 uppercase tracking-widest font-mono block mt-1">
                              {isChecked ? 'Enabled' : 'Hidden'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Customizable Booking Fee & Security Deposit for Paid Users */}
              <div className="pt-8 border-t border-neutral-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-tight text-neutral-800">Default Hire Fee Structure</h4>
                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1">Setup customizable booking fees and deposits</p>
                  </div>
                  {user.plan === 'free' ? (
                    <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[9px] font-black uppercase tracking-widest rounded-full">
                      Free Plan Limits Active
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-green-500/10 border border-green-500/20 text-green-500 text-[9px] font-black uppercase tracking-widest rounded-full">
                      Customization Enabled
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-black text-neutral-400">Default Booking/Hire Fee (%)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        disabled={user.plan === 'free'}
                        value={user.defaultBookingFee ?? 10}
                        onChange={async (e) => {
                          const val = Math.min(100, Math.max(0, Number(e.target.value)));
                          try {
                            const userRef = doc(db, 'users', user.uid);
                            await updateDoc(userRef, { defaultBookingFee: val });
                            onUpdate({ ...user, defaultBookingFee: val });
                            toast.success("Default booking fee updated");
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className={`w-full px-5 py-3.5 bg-neutral-50 border rounded-2xl outline-none focus:ring-2 focus:ring-primary transition font-bold text-neutral-800 ${
                          user.plan === 'free' ? 'opacity-50 cursor-not-allowed border-neutral-100' : 'border-neutral-200/60'
                        }`}
                        placeholder="10"
                      />
                      <span className="absolute right-4 top-4 font-black text-xs text-neutral-400 font-mono">%</span>
                    </div>
                    {user.plan === 'free' && (
                      <p className="text-[9px] text-[#FF5500] font-bold uppercase tracking-widest">🔒 Upgrade to Pro to customize default Booking Fees (currently locked to 10%)</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-black text-neutral-400">Default Security Deposit (Fixed)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        disabled={user.plan === 'free'}
                        value={user.defaultSecurityDeposit ?? 150}
                        onChange={async (e) => {
                          const val = Math.max(0, Number(e.target.value));
                          try {
                            const userRef = doc(db, 'users', user.uid);
                            await updateDoc(userRef, { defaultSecurityDeposit: val });
                            onUpdate({ ...user, defaultSecurityDeposit: val });
                            toast.success("Default security deposit updated");
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className={`w-full px-5 py-3.5 bg-neutral-50 border rounded-2xl outline-none focus:ring-2 focus:ring-primary transition font-bold text-neutral-800 ${
                          user.plan === 'free' ? 'opacity-50 cursor-not-allowed border-neutral-100' : 'border-neutral-200/60'
                        }`}
                        placeholder="150"
                      />
                      <span className="absolute right-4 top-4 font-black text-xs text-neutral-400 font-mono">USD</span>
                    </div>
                    {user.plan === 'free' && (
                      <p className="text-[9px] text-[#FF5500] font-bold uppercase tracking-widest">🔒 Upgrade to Pro to customize default Security Deposit (currently locked to $150)</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Customizable Workspace Starters Modules Settings */}
              <div className="pt-8 border-t border-neutral-100 space-y-6">
                <div>
                  <h4 className="text-sm font-black uppercase tracking-tight text-neutral-800">Workspace Starters Settings</h4>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mt-1">
                    Choose which modules are aggregated into the "Starters" collapsible sidebar section. Items selected below will be hidden from your main left-panel drawer.
                  </p>
                </div>

                <div className="bg-neutral-50 p-5 rounded-3xl border border-neutral-150 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { to: '/organization', name: 'Organization' },
                      { to: '/projects', name: 'Projects' },
                      { to: '/kiosk', name: 'Gear Kiosk' },
                      { to: '/library', name: getAdjustedLabel('library') },
                      { to: '/systems-builder', name: getAdjustedLabel('systems-builder') },
                      { to: '/marketplace', name: 'Marketplace' },
                      { to: '/listings', name: 'Listings' },
                      { to: '/lists', name: getAdjustedLabel('lists') },
                      { to: '/racks', name: getAdjustedLabel('racks') },
                      { to: '/logistics', name: getAdjustedLabel('logistics') },
                      { to: '/inventory', name: getAdjustedLabel('inventory') },
                      { to: '/contacts', name: 'Contacts' },
                      { to: '/ai-wizard', name: 'AI Wizard' },
                      { to: '/scenario-builder', name: 'Scenario Builder' },
                      { to: '/traveller', name: 'Traveller Module' },
                      { to: '/tooling', name: 'Tooling Lists' },
                      { to: '/organizer', name: 'Organizer' },
                      { to: '/travel-cases', name: 'Travel Cases' }
                    ].map((module) => {
                      const selectedStarters = user.selectedStarters !== undefined ? user.selectedStarters : ['/tooling', '/organizer', '/travel-cases'];
                      const isChecked = selectedStarters.includes(module.to);
                      
                      return (
                        <button
                          key={module.to}
                          type="button"
                          onClick={async () => {
                            let updatedStarters: string[];
                            if (isChecked) {
                              updatedStarters = selectedStarters.filter(path => path !== module.to);
                            } else {
                              updatedStarters = [...selectedStarters, module.to];
                            }
                            try {
                              const userRef = doc(db, 'users', user.uid);
                              await updateDoc(userRef, { selectedStarters: updatedStarters });
                              onUpdate({ ...user, selectedStarters: updatedStarters });
                              toast.success(`Module "${module.name}" toggled successfully!`);
                            } catch (err) {
                              console.error(err);
                              toast.error("Failed to update starters preferences.");
                            }
                          }}
                          className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 ${
                            isChecked 
                              ? 'bg-neutral-900 border-neutral-900 text-white shadow-lg shadow-neutral-900/10' 
                              : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50 shadow-sm'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <span className="font-extrabold block text-xs tracking-tight truncate">{module.name}</span>
                            <span className={`text-[8px] opacity-75 block font-bold uppercase tracking-wider ${isChecked ? 'text-neutral-300' : 'text-neutral-400'}`}>
                              {isChecked ? '🌟 In Starters' : '📄 Main Nav'}
                            </span>
                          </div>
                          <div className={`p-1.5 rounded-full shrink-0 ${isChecked ? 'bg-white text-neutral-900' : 'bg-neutral-100 text-neutral-500'}`}>
                            {isChecked ? <Check size={12} className="stroke-[3]" /> : <Plus size={12} className="stroke-[3]" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'store' && (
          /* Public Shopfront Brand Settings Panel */
          <section className="bg-white p-5 sm:p-10 rounded-2xl sm:rounded-[3rem] border border-primary/5 shadow-sm space-y-6 sm:space-y-8 animate-fade-in animate-duration-300">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="micro-label bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full inline-block font-black uppercase">Brand Storefront</span>
                <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3 text-neutral-900">
                  <Package className="text-primary shrink-0" />
                  <span>Public Shopfront & Brand Settings</span>
                </h3>
                <p className="text-xs text-neutral-500 font-semibold leading-relaxed">
                  Configure how your brand, logo, cover image, and support connections appear on your public shopfront.
                </p>
              </div>

              {/* View Live Shopfront Link */}
              <a 
                href={`#/shop/${user.uid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 bg-[#ff4f3a]/10 hover:bg-[#ff4f3a]/25 text-[#ff4f3a] font-extrabold uppercase text-[10px] tracking-widest rounded-xl transition self-start sm:self-center"
              >
                <span>View Live Store</span>
                <ExternalLink size={12} className="stroke-[2.5]" />
              </a>
            </header>

            <form onSubmit={handleSaveStoreProfile} className="space-y-6">
              {user.plan === 'free' && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                  <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 font-semibold leading-relaxed">
                    <strong>Subscription Required</strong>: Your workspace is on the Free Tier. Only paying users has active listings visible on search index and can receive hire deposits. You can still customize your draft brand credentials below.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Store Name */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-wider text-neutral-400 block">Store Name</label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="w-full px-5 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-primary transition font-bold"
                    placeholder="e.g. Cinema Gear Hire Fiji"
                    required
                  />
                </div>

                {/* Cover Image */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-wider text-neutral-400 block">Cover Image URL</label>
                  <input
                    type="url"
                    value={storeCoverImage}
                    onChange={(e) => setStoreCoverImage(e.target.value)}
                    className="w-full px-5 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-primary transition font-mono text-xs"
                    placeholder="https://images.unsplash.com/photo-..."
                  />
                </div>

                {/* Logo Image URL */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-wider text-neutral-400 block">Logo / Profile Photo URL</label>
                  <input
                    type="url"
                    value={storeLogo}
                    onChange={(e) => setStoreLogo(e.target.value)}
                    className="w-full px-5 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-primary transition font-mono text-xs"
                    placeholder="https://..."
                  />
                </div>

                {/* Custom slugs */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-wider text-neutral-400 block">Store Website Partner URL</label>
                  <input
                    type="url"
                    value={storeWebsite}
                    onChange={(e) => setStoreWebsite(e.target.value)}
                    className="w-full px-5 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-primary transition text-xs font-mono"
                    placeholder="https://..."
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-wider text-neutral-400 block">Store Email</label>
                  <input
                    type="email"
                    value={storeEmail}
                    onChange={(e) => setStoreEmail(e.target.value)}
                    className="w-full px-5 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-primary transition text-sm"
                    placeholder="hire@brand.com"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-wider text-neutral-400 block">Store Phone Number</label>
                  <input
                    type="text"
                    value={storePhone}
                    onChange={(e) => setStorePhone(e.target.value)}
                    className="w-full px-5 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-primary transition text-sm"
                    placeholder="+679 ..."
                  />
                </div>

                {/* Twitter */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-wider text-neutral-400 block">Twitter Handle</label>
                  <input
                    type="text"
                    value={storeTwitter}
                    onChange={(e) => setStoreTwitter(e.target.value)}
                    className="w-full px-5 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-primary transition font-medium"
                    placeholder="@handle"
                  />
                </div>

                {/* Instagram */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-wider text-neutral-400 block">Instagram Handle</label>
                  <input
                    type="text"
                    value={storeInstagram}
                    onChange={(e) => setStoreInstagram(e.target.value)}
                    className="w-full px-5 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-primary transition font-medium"
                    placeholder="@handle"
                  />
                </div>

                {/* LinkedIn */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-wider text-neutral-400 block">LinkedIn URL</label>
                  <input
                    type="text"
                    value={storeLinkedin}
                    onChange={(e) => setStoreLinkedin(e.target.value)}
                    className="w-full px-5 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-primary transition font-medium"
                    placeholder="linkedin.com/company/..."
                  />
                </div>

                {/* Facebook */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-black tracking-wider text-neutral-400 block">Facebook URL</label>
                  <input
                    type="text"
                    value={storeFacebook}
                    onChange={(e) => setStoreFacebook(e.target.value)}
                    className="w-full px-5 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-primary transition font-medium"
                    placeholder="facebook.com/..."
                  />
                </div>
              </div>

              {/* Biography */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black tracking-wider text-neutral-400 block font-sans">Store Overview & Biography</label>
                <textarea
                  rows={4}
                  value={storeBio}
                  onChange={(e) => setStoreBio(e.target.value)}
                  className="w-full px-5 py-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-primary transition font-medium leading-relaxed font-sans resize-none"
                  placeholder="Tell clients about your industry specialization, equipment upkeep procedures, insurance criteria etc."
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={isSavingStore}
                  className="px-8 py-4 bg-neutral-900 hover:bg-neutral-800 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition shadow-lg active:scale-95 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <Save size={14} />
                  <span>{isSavingStore ? "Saving changes..." : "Save Store Settings"}</span>
                </button>
              </div>
            </form>
          </section>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-8 sm:space-y-12 animate-fade-in">
            {/* Active Beta Notifications Desk */}
            <section className="bg-white p-5 sm:p-10 rounded-2xl sm:rounded-[3rem] border border-primary/5 shadow-sm space-y-6 sm:space-y-8">
            <header className="space-y-1">
              <span className="micro-label bg-green-50 text-green-600 border border-green-200 px-2 py-0.5 rounded-full inline-block font-black">Release Build v4.33.0</span>
              <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
                <Mail className="text-primary shrink-0" />
                <span>Notification Testing Desk</span>
              </h3>
              <p className="text-xs text-neutral-500 font-semibold leading-relaxed">
                Manually fire and test transactional welcome emails or contact alerts. Verify copy alignment and HTML layouts in the real-time preview cabinet below.
              </p>
            </header>

            {/* Live Interactive Results Console */}
            {testResult && (
              <div className="bg-neutral-900 text-white rounded-2xl p-6 sm:p-8 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-mono tracking-wider font-extrabold text-neutral-400 uppercase">Interactive Delivery Proof</span>
                  </div>
                  <button 
                    onClick={() => {
                      setTestResult(null);
                      setShowTestHtml(false);
                    }}
                    className="text-white/50 hover:text-white text-xs font-bold"
                  >
                    Clear Slate
                  </button>
                </div>

                <div className="space-y-1 font-mono text-xs text-left">
                  <div><span className="text-neutral-500">Subject:</span> <span className="font-extrabold text-amber-400">{testResult.subject}</span></div>
                  <div><span className="text-neutral-500">Target Recipient:</span> <span>{testResult.recipient}</span></div>
                  <div><span className="text-neutral-500">Method:</span> <span className="text-blue-400">{testResult.simulated ? 'SIMULATED OVER EXPRESS' : 'LIVE API DELIVERED'}</span></div>
                  {testResult.notice && <div className="text-[10px] text-emerald-400 pt-1 font-sans">{testResult.notice}</div>}
                </div>

                {testResult.html && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowTestHtml(!showTestHtml)}
                      className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-black uppercase tracking-wider transition mb-2 cursor-pointer"
                    >
                      {showTestHtml ? "Hide Embedded Layout Reviewer" : "View Embedded Layout Reviewer"}
                    </button>
                    {showTestHtml && (
                      <div className="rounded-xl overflow-hidden bg-white border border-white/10 h-[300px]">
                        <iframe 
                          title="Beta HTML Mail Viewer"
                          srcDoc={testResult.html}
                          className="w-full h-full bg-white text-slate-950 border-none animate-scale-up"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              {/* Box 1: Onboarding Welcome Slip Test */}
              <div className="p-6 bg-neutral-50 rounded-2xl border border-neutral-200/50 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-primary tracking-widest block bg-primary/5 px-2 py-1 rounded inline-block">1. Welcoming Letter</span>
                  <p className="text-xs text-neutral-500 leading-relaxed font-semibold">
                    Sends the Fiji custom onboarding letter, detailing the active sticker dimensions presets and workspace highlights.
                  </p>
                  
                  <div className="space-y-3 pt-2 text-left">
                    <div>
                      <label className="text-[9px] font-black uppercase text-neutral-400 block mb-1">Recipient Email</label>
                      <input 
                        type="email"
                        value={testWelcomeEmail}
                        onChange={(e) => setTestWelcomeEmail(e.target.value)}
                        className="w-full p-2 bg-white border border-neutral-200 rounded-xl text-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase text-neutral-400 block mb-1">Operator Display Name</label>
                      <input 
                        type="text"
                        value={testWelcomeName}
                        onChange={(e) => setTestWelcomeName(e.target.value)}
                        className="w-full p-2 bg-white border border-neutral-200 rounded-xl text-xs outline-none"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={welcomeSending}
                  onClick={async () => {
                    if (!testWelcomeEmail) {
                      toast.error("Please provide email recipient.");
                      return;
                    }
                    setWelcomeSending(true);
                    setTestResult(null);
                    try {
                      const res = await fetch('/api/send-welcome-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          to: testWelcomeEmail,
                          displayName: testWelcomeName,
                          subPlan: user.plan ? user.plan.toUpperCase() : "FREE STARTER"
                        })
                      });
                      const data = await res.json();
                      if (res.ok && data.success) {
                        toast.success("Welcome notification slip generated!");
                        setTestResult({
                          ...data,
                          subject: `Welcome to Packer Tools! [v1.0.0-beta.2 Onboarding]`
                        });
                        setShowTestHtml(true);
                      } else {
                        toast.error(data.error || "Failed sending Welcome test.");
                      }
                    } catch (e: any) {
                      toast.error("Error connecting to welcome endpoint.");
                    } finally {
                      setWelcomeSending(false);
                    }
                  }}
                  className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 text-white font-extrabold uppercase text-[10px] tracking-widest rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  {welcomeSending ? "Dispatched..." : "Generate Welcome Slip"}
                </button>
              </div>

              {/* Box 2: Contact Enquiry Test */}
              <div className="p-6 bg-neutral-50 rounded-2xl border border-neutral-200/50 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-blue-600 tracking-widest block bg-blue-50 px-2 py-1 rounded inline-block font-sans">2. Help desk Contact Alert</span>
                  <p className="text-xs text-neutral-500 leading-relaxed font-semibold">
                    Sends an alert summarizing messages sent through the support form, including name metrics and timestamp logs.
                  </p>

                  <div className="space-y-3 pt-2 text-left">
                    <div>
                      <label className="text-[9px] font-black uppercase text-neutral-400 block mb-1 font-sans">Sample Message Body</label>
                      <textarea
                        rows={3}
                        value={testMessage}
                        onChange={(e) => setTestMessage(e.target.value)}
                        className="w-full p-2 bg-white border border-neutral-200 rounded-xl text-xs outline-none resize-none font-sans"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={contactSending}
                  onClick={async () => {
                    setContactSending(true);
                    setTestResult(null);
                    try {
                      const res = await fetch('/api/send-contact-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          firstName: user.displayName ? user.displayName.split(' ')[0] : 'Beta Tester',
                          lastName: user.displayName ? user.displayName.split(' ').slice(1).join(' ') : 'Operator',
                          email: user.email,
                          message: testMessage,
                          timestamp: new Date().toLocaleString()
                        })
                      });
                      const data = await res.json();
                      if (res.ok && data.success) {
                        toast.success("Contact feed enquiry notification generated!");
                        setTestResult({
                          ...data,
                          subject: `[Packer Tools Contact Feed] Message from ${user.displayName || 'Beta Tester'}`
                        });
                        setShowTestHtml(true);
                      } else {
                        toast.error(data.error || "Failed sending Contact test.");
                      }
                    } catch (e: any) {
                      toast.error("Error connecting to contact endpoint.");
                    } finally {
                      setContactSending(false);
                    }
                  }}
                  className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 text-white font-extrabold uppercase text-[10px] tracking-widest rounded-xl transition cursor-pointer disabled:opacity-50 hover:shadow-md"
                >
                  {contactSending ? "Fired Alert..." : "Trigger Contact Alert"}
                </button>
              </div>

            </div>
          </section>

          <AITokenUsageChart 
            user={user}
            adminSettings={adminSettings}
            onUpgradeClick={() => {
              setRestrictedFeature('Generative AI Tokens Boost');
              setIsUpgradeNowModalOpen(true);
            }}
          />
        </div>
        )}

        {activeTab === 'device' && (
          /* Mobile App PWA Install Card */
          <section className="bg-gradient-to-br from-neutral-900 to-neutral-950 text-white p-5 sm:p-10 rounded-2xl sm:rounded-[3rem] border border-neutral-800 shadow-xl space-y-6 sm:space-y-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/20 blur-3xl rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
            
            <div className="space-y-2 relative">
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 font-black px-2.5 py-1 rounded-xl uppercase tracking-widest animate-pulse">
                  App PWA v4.22
                </span>
                {isInstalled && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 font-black px-2.5 py-1 rounded-xl uppercase tracking-widest">
                    Installed
                  </span>
                )}
              </div>
              <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tighter flex items-center gap-3 text-white">
                <Smartphone className="text-primary shrink-0 animate-bounce" size={24} />
                <span>Packer Mobile</span>
              </h3>
              <p className="text-xs text-neutral-400 leading-relaxed font-semibold">
                Install Packer Tools directly to your mobile homescreen. Enjoy full offline synchronization, instant barcode scanning, and optimized screen density.
              </p>
            </div>

            <div className="pt-2 relative">
              {isInstalled ? (
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl text-center text-xs text-neutral-300 font-semibold leading-relaxed">
                  <CheckCircle2 className="text-emerald-400 mx-auto mb-2" size={24} />
                  <span className="font-bold text-white uppercase tracking-wide block mb-1">Active Standalone Mode</span>
                  This application is running on your device in Native Standalone format. Full offline capabilities are operational.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={triggerInstall}
                  className="w-full py-4 bg-primary hover:bg-primary/95 text-white rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition shadow-lg flex items-center justify-center gap-3 cursor-pointer"
                >
                  <Download size={18} />
                  Install App
                </button>
              )}
            </div>
            
            <div className="text-[9px] text-neutral-400 font-bold uppercase tracking-wide text-center pt-2 border-t border-white/5 relative">
              Compatible with Safari, Chrome, Samsung, & Edge
            </div>
          </section>
        )}

        {activeTab === 'theme' && (
          /* Theme Preferences Card */
          <section className="bg-white p-5 sm:p-10 rounded-2xl sm:rounded-[3rem] border border-primary/5 shadow-sm space-y-6 sm:space-y-8 animate-fade-in">
            <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
              <Sun className="text-primary" size={20} />
              <span>Theme Preferences</span>
            </h3>
            <p className="text-sm text-neutral-500 leading-relaxed font-semibold">
              Select your preferred workspace lighting setup. This theme operates across all project tables, locker rooms, checklists, and scanners.
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setTheme('light')}
                className={`p-4 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-2 font-bold ${
                  theme === 'light' 
                    ? 'bg-neutral-900 text-white border-neutral-900 shadow-lg' 
                    : 'bg-neutral-50 text-neutral-700 border-neutral-200/60 hover:bg-neutral-100'
                }`}
              >
                <Sun size={20} className={theme === 'light' ? 'text-accent' : 'text-neutral-400'} />
                <span className="text-xs uppercase tracking-wider">Light Mode</span>
              </button>
              
              <button
                onClick={() => setTheme('dark')}
                className={`p-4 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-2 font-bold ${
                  theme === 'dark' 
                    ? 'bg-neutral-900 text-white border-neutral-900 shadow-lg' 
                    : 'bg-neutral-50 text-neutral-700 border-neutral-200/60 hover:bg-neutral-100'
                }`}
              >
                <Moon size={20} className={theme === 'dark' ? 'text-yellow-400' : 'text-neutral-400'} />
                <span className="text-xs uppercase tracking-wider">Dark Mode</span>
              </button>
            </div>

            {/* Workspace Layout Mode Toggle Button Grid */}
            <div className="mt-6 border-t border-neutral-100 pt-6 space-y-3">
              <h4 className="text-xs uppercase tracking-widest font-black text-neutral-400">Workspace Layout Theme</h4>
              <p className="text-xs text-neutral-400 leading-relaxed font-semibold">
                Choose between standard sidebars or the new DaVinci Resolve-inspired tabbed workflow layout.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={async () => {
                    try {
                      const userRef = doc(db, 'users', user.uid);
                      await updateDoc(userRef, { layoutTheme: 'standard' });
                      onUpdate({ ...user, layoutTheme: 'standard' });
                      toast.success("Switched workspace layout to Standard Sidebar!");
                    } catch (err) {
                      toast.error("Failed to update layout theme selection");
                    }
                  }}
                  className={`p-4 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-2 font-bold ${
                    user.layoutTheme !== 'workflow' 
                      ? 'bg-neutral-900 text-white border-neutral-900 shadow-lg' 
                      : 'bg-neutral-50 text-neutral-700 border-neutral-200/60 hover:bg-neutral-100'
                  }`}
                >
                  <LayoutDashboard size={20} className={user.layoutTheme !== 'workflow' ? 'text-accent' : 'text-neutral-400'} />
                  <span className="text-xs uppercase tracking-wider">Standard Sidebar</span>
                </button>

                <button
                  onClick={async () => {
                    try {
                      const userRef = doc(db, 'users', user.uid);
                      await updateDoc(userRef, { layoutTheme: 'workflow' });
                      onUpdate({ ...user, layoutTheme: 'workflow' });
                      toast.success("Switched workspace layout to Resolve Professional Workflow!");
                    } catch (err) {
                      toast.error("Failed to update layout theme selection");
                    }
                  }}
                  className={`p-4 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-2 font-bold ${
                    user.layoutTheme === 'workflow' 
                      ? 'bg-neutral-900 text-white border-neutral-900 shadow-lg' 
                      : 'bg-neutral-50 text-neutral-700 border-neutral-200/60 hover:bg-neutral-100'
                  }`}
                >
                  <Layout size={20} className={user.layoutTheme === 'workflow' ? 'text-accent' : 'text-neutral-400'} />
                  <span className="text-xs uppercase tracking-wider">Professional Workflow</span>
                </button>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'billing' && (
          <section className="bg-white p-5 sm:p-10 rounded-2xl sm:rounded-[3rem] border border-primary/5 shadow-sm space-y-6 sm:space-y-8">
            <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
              <BarChart3 className="text-primary shrink-0" />
              <span>Plan & Subscription</span>
            </h3>
            
            <div className="space-y-6">
              <div className="p-5 sm:p-6 bg-neutral-900 text-white rounded-2xl sm:rounded-[2rem] space-y-4 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-accent/20 blur-3xl rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
                <div className="relative space-y-1">
                  <div className="micro-label text-white/40">Current Active Plan</div>
                  <div className="text-3xl font-black uppercase tracking-tighter shrink-0 flex items-center flex-wrap gap-2">
                    <span>{adminSettings?.plans?.find(p => p.id === user.plan || p.name.toLowerCase() === user.plan?.toLowerCase())?.name || user.plan}</span>
                    {user.subscriptionStatus === 'trialing' && (
                      <span className="bg-orange-500 text-white text-[8px] font-black tracking-widest px-2.5 py-0.5 rounded-full uppercase">
                        Trial
                      </span>
                    )}
                  </div>
                  {user.subscriptionStatus === 'trialing' && user.trialEndDate && (
                    <p className="text-[10px] text-white/70 font-semibold uppercase tracking-wider mt-1 block">
                      Trial ends {new Date(user.trialEndDate).toLocaleDateString()} ({Math.max(0, Math.ceil((new Date(user.trialEndDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))} days left)
                    </p>
                  )}
                </div>
                {adminSettings?.billingEnabled ? (
                  <button 
                    onClick={() => setIsPaymentModalOpen(true)}
                    className="relative w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors border border-white/10"
                  >
                    Manage Subscription
                  </button>
                ) : (
                  <div className="px-3 sm:px-4 py-2 bg-white/10 rounded-xl text-[8px] sm:text-[9.5px] text-center font-black uppercase tracking-widest text-white/60">
                    Billing is currently managed by administrator
                  </div>
                )}
              </div>

              {/* Trial Status Section */}
              <div className="p-5 sm:p-6 bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl sm:rounded-[2rem] border border-orange-200/50 space-y-4 shadow-xs relative overflow-hidden group text-left">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-3xl rounded-full pointer-events-none" />
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-orange-100 rounded-xl text-orange-600">
                      <Zap size={16} className="fill-orange-500 text-orange-500" />
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-orange-700/80 tracking-wider font-mono">Premium Access Tracker</span>
                      <h4 className="text-sm font-black uppercase tracking-tight text-orange-950">Free Trial Status</h4>
                    </div>
                  </div>
                  {user.subscriptionStatus === 'trialing' ? (
                    <span className="text-[9px] bg-orange-200 text-orange-800 border border-orange-300/40 font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse font-mono">
                      Active Trial
                    </span>
                  ) : (
                    <span className="text-[9px] bg-neutral-200 text-neutral-700 border border-neutral-300/40 font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">
                      No Active Trial
                    </span>
                  )}
                </div>

                {user.subscriptionStatus === 'trialing' ? (
                  <div className="space-y-4 pt-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white p-3.5 rounded-2xl border border-orange-150 shadow-2xs">
                        <div className="text-[9px] font-black text-orange-600/70 uppercase tracking-widest font-mono">Days Remaining</div>
                        <div className="text-xl sm:text-2xl font-black text-orange-950 font-mono mt-0.5">
                          {Math.max(0, Math.ceil((new Date(user.trialEndDate || '').getTime() - Date.now()) / (24 * 60 * 60 * 1000)))} Days
                        </div>
                      </div>
                      <div className="bg-white p-3.5 rounded-2xl border border-orange-150 shadow-2xs">
                        <div className="text-[9px] font-black text-orange-600/70 uppercase tracking-widest font-mono">Trial Plan</div>
                        <div className="text-xl sm:text-2xl font-black text-orange-950 uppercase tracking-tight mt-0.5">
                          {adminSettings?.plans?.find(p => p.id === user.plan || p.name.toLowerCase() === user.plan?.toLowerCase())?.name || user.plan}
                        </div>
                      </div>
                    </div>

                    {/* Progress track */}
                    {user.trialStartDate && user.trialEndDate && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[9px] font-black uppercase tracking-wider text-orange-850 font-mono">
                          <span>Trial Usage Timeline</span>
                          <span>
                            {(() => {
                              const start = new Date(user.trialStartDate).getTime();
                              const end = new Date(user.trialEndDate).getTime();
                              const total = Math.max(1, end - start);
                              const elapsed = Math.max(0, Date.now() - start);
                              const usagePercent = Math.min(100, Math.round((elapsed / total) * 100));
                              return `${usagePercent}% elapsed`;
                            })()}
                          </span>
                        </div>
                        <div className="w-full h-3.5 bg-orange-100/60 rounded-full overflow-hidden p-0.5 border border-orange-200/20">
                          <div 
                            className="h-full bg-gradient-to-r from-orange-400 to-amber-500 rounded-full transition-all duration-500"
                            style={{ 
                              width: `${(() => {
                                const start = new Date(user.trialStartDate).getTime();
                                const end = new Date(user.trialEndDate).getTime();
                                const total = Math.max(1, end - start);
                                const elapsed = Math.max(0, Date.now() - start);
                                return Math.min(100, Math.round((elapsed / total) * 100));
                              })()}%` 
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="text-[11px] text-orange-900/80 font-medium leading-relaxed bg-white/55 p-3 rounded-2xl border border-orange-100/40">
                      Take full advantage of enterprise features, custom team layouts, PWA triggers, and unrestricted API syncing. You can upgrade to a continuous, non-expiring subscription plan anytime to ensure uninterrupted access.
                    </div>

                    {adminSettings?.billingEnabled && (
                      <button
                        type="button"
                        onClick={() => setIsPaymentModalOpen(true)}
                        className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-orange-500/10 border-none"
                      >
                        <Award size={14} className="fill-white" />
                        <span>Upgrade to Full Subscription</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 pt-1">
                    <p className="text-[11.5px] text-neutral-600 leading-relaxed font-semibold bg-white/50 p-4 rounded-2xl border border-orange-100">
                      You are currently on the Free plan, which has limited seats and active records. Activate a 14-day try-out of all Pro/Enterprise feature bundles seamlessly to experience the full power of real-time mobile tracking and team syncs.
                    </p>
                    {adminSettings?.billingEnabled && (
                      <button
                        type="button"
                        onClick={() => setIsPaymentModalOpen(true)}
                        className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-black uppercase tracking-widest transition flex items-center justify-center gap-2 cursor-pointer border-none"
                      >
                        <Zap size={14} className="fill-white" />
                        <span>Unlock Pro & Start 14-Day Free Trial</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Seats & Team Licenses Indicator */}
              {user.plan !== 'free' && (
                <div className="p-6 bg-neutral-50 rounded-[2rem] border border-neutral-200/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider">Plan Seats & Licenses</span>
                      <h4 className="text-md font-black uppercase tracking-tight text-neutral-800">Team Licenses</h4>
                    </div>
                    <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold px-2.5 py-1 rounded-xl">
                      Active
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white p-3 rounded-2xl border border-neutral-100">
                      <div className="text-lg font-black text-neutral-800">
                        {adminSettings?.plans?.find(p => p.id === user.plan)?.includedSeats ?? 3}
                      </div>
                      <div className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest">Included</div>
                    </div>
                    <div className="bg-white p-3 rounded-2xl border border-neutral-100">
                      <div className="text-lg font-black text-primary">
                        {user.extraSeats || 0}
                      </div>
                      <div className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest">Purchased</div>
                    </div>
                    <div className="bg-white p-3 rounded-2xl border border-neutral-150 bg-neutral-100/30">
                      <div className="text-lg font-black text-neutral-900">
                        {(adminSettings?.plans?.find(p => p.id === user.plan)?.includedSeats ?? 3) + (user.extraSeats || 0)}
                      </div>
                      <div className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest">Total Seats</div>
                    </div>
                  </div>

                  {adminSettings?.billingEnabled && (
                    <button
                      onClick={() => setIsPaymentModalOpen(true)}
                      className="w-full py-2 bg-neutral-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-neutral-800 transition cursor-pointer"
                    >
                      Add Extra Seats / Manage
                    </button>
                  )}
                </div>
              )}

              {/* Quick Plan Switcher / Info */}
              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Select Available Tier</div>
                  <div className="flex bg-neutral-100 p-0.5 rounded-lg border border-neutral-200/30">
                    <button 
                      type="button"
                      onClick={() => setProfileBillingCycle('monthly')}
                      className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition ${profileBillingCycle === 'monthly' ? 'bg-white shadow-xs text-neutral-950' : 'text-neutral-400'}`}
                    >
                      Monthly
                    </button>
                    <button 
                      type="button"
                      onClick={() => setProfileBillingCycle('annual')}
                      className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition ${profileBillingCycle === 'annual' ? 'bg-white shadow-xs text-neutral-950' : 'text-neutral-400'}`}
                    >
                      Annual
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                        if (user.plan === 'free') return;
                        if (window.confirm("Switch to Free plan? Your limits will be reduced.")) {
                            const userRef = doc(db, 'users', user.uid);
                            updateDoc(userRef, { 
                                plan: 'free',
                                subscriptionStatus: 'active',
                                trialActive: false,
                                trialStartDate: null,
                                trialEndDate: null
                            });
                            onUpdate({ 
                                ...user, 
                                plan: 'free',
                                subscriptionStatus: 'active',
                                trialActive: false,
                                trialStartDate: undefined,
                                trialEndDate: undefined
                            });
                            toast.success("Switched to Free plan");
                        }
                    }}
                    className={`p-4 rounded-2xl border-2 transition-all text-left flex items-center justify-between ${
                        user.plan === 'free' ? 'border-primary bg-neutral-50 ring-4 ring-primary/5' : 'border-neutral-100 hover:border-neutral-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-400">
                            <ShieldCheck size={18} />
                        </div>
                        <div>
                            <div className="text-xs font-black uppercase tracking-tighter">Free Tier</div>
                            <div className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest italic">Standard Features</div>
                        </div>
                    </div>
                    {user.plan === 'free' && <Check size={16} className="text-primary" />}
                  </button>

                  {adminSettings?.plans?.filter(p => p.id !== 'free').map(plan => {
                    const isAnnual = profileBillingCycle === 'annual';
                    const displayVal = isAnnual ? (plan.annualPrice || (plan.price * 12)) : plan.price;
                    const displayUnit = isAnnual ? 'yr' : 'mo';
                    
                    const savingPct = (isAnnual && plan.annualPrice && plan.price)
                      ? Math.round((1 - (plan.annualPrice / (plan.price * 12))) * 100)
                      : 0;
                    
                    const trialInfo = plan.trialEnabled && plan.trialDays ? `${plan.trialDays}-day Trial` : null;

                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setIsPaymentModalOpen(true)}
                        className={`p-4 rounded-2xl border-2 transition-all text-left flex items-center justify-between group ${
                          user.plan === plan.id ? 'border-primary bg-neutral-50 ring-4 ring-primary/5' : 'border-neutral-100 hover:border-neutral-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${plan.id === 'pro' ? 'bg-accent text-white shadow-glow-sm' : 'bg-primary text-white'}`}>
                                <Zap size={18} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                  <div className="text-xs font-black uppercase tracking-tighter">{plan.name}</div>
                                  {trialInfo && (
                                    <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">
                                      {trialInfo}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[9px] font-bold text-neutral-700 font-mono">${displayVal}/{displayUnit}</span>
                                  {savingPct > 0 && (
                                    <span className="text-[8px] font-extrabold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded">
                                      Save {savingPct}%
                                    </span>
                                  )}
                                  {isAnnual && (
                                    <span className="text-[8px] font-medium text-neutral-400 italic">
                                      (eq. ${Math.round(displayVal / 12)}/mo)
                                    </span>
                                  )}
                                </div>
                            </div>
                        </div>
                        {user.plan === plan.id ? <Check size={16} className="text-primary" /> : <ChevronRight size={16} className="text-neutral-300 group-hover:translate-x-1 transition-transform" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <PaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                user={user}
                adminSettings={adminSettings}
                onSuccess={(newPlan) => onUpdate({ ...user, plan: newPlan })}
              />

              <UpgradeNowModal
                isOpen={isUpgradeNowModalOpen}
                onClose={() => setIsUpgradeNowModalOpen(false)}
                user={user}
                adminSettings={adminSettings}
                restrictedFeatureName={restrictedFeature}
                onSuccess={(newPlan) => onUpdate({ ...user, plan: newPlan })}
              />

              {usage && (
                <div className="space-y-4">
                  {[
                    { label: 'AI Requests', current: usage.aiTokens.current, limit: usage.aiTokens.limit, icon: <Zap size={14} /> },
                    { label: 'Packing Lists', current: usage.packingLists.current, limit: usage.packingLists.limit, icon: <Package size={14} /> },
                    { label: 'Gear Items', current: usage.gearItems.current, limit: usage.gearItems.limit, icon: <Package size={14} /> },
                    { label: 'Racks', current: usage.racks.current, limit: usage.racks.limit, icon: <Server size={14} /> },
                    { label: 'Moving Projects', current: usage.movingProjects.current, limit: usage.movingProjects.limit, icon: <Home size={14} /> },
                    { label: 'Contacts', current: usage.contacts.current, limit: usage.contacts.limit, icon: <User size={14} /> }
                  ].map((item, i) => {
                    const percentage = Math.min((item.current / item.limit) * 100, 100);
                    return (
                      <div key={i} className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                          <div className="flex items-center gap-1.5 text-neutral-400">
                            {item.icon}
                            {item.label}
                          </div>
                          <div className="text-primary">{item.current} / {item.limit}</div>
                        </div>
                        <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            className={`h-full rounded-full ${percentage > 90 ? 'bg-accent' : 'bg-primary'}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'connect' && (
          <section className="bg-white p-5 sm:p-10 rounded-2xl sm:rounded-[3rem] border border-primary/5 shadow-sm space-y-6 sm:space-y-8">
            <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
              <Globe className="text-primary shrink-0" />
              <span>Connect</span>
            </h3>
            
            <div className="space-y-6">
              {isEditing ? (
                <>
                  <div className="space-y-2">
                    <label className="micro-label">Website</label>
                    <div className="relative">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-300" size={18} />
                      <input
                        type="url"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        placeholder="https://..."
                        className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl focus:ring-2 focus:ring-primary outline-none transition"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="micro-label">Twitter</label>
                    <div className="relative">
                      <Twitter className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-300" size={18} />
                      <input
                        type="text"
                        value={formData.socialLinks?.twitter}
                        onChange={(e) => handleSocialChange('twitter', e.target.value)}
                        placeholder="@handle"
                        className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl focus:ring-2 focus:ring-primary outline-none transition"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="micro-label">Instagram</label>
                    <div className="relative">
                      <Instagram className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-300" size={18} />
                      <input
                        type="text"
                        value={formData.socialLinks?.instagram}
                        onChange={(e) => handleSocialChange('instagram', e.target.value)}
                        placeholder="@handle"
                        className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl focus:ring-2 focus:ring-primary outline-none transition"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  {user.website && (
                    <a href={user.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-neutral-50 rounded-2xl hover:bg-primary/5 transition group">
                      <Globe size={18} className="text-neutral-400 group-hover:text-primary transition" />
                      <span className="font-bold text-sm truncate">{user.website.replace(/^https?:\/\//, '')}</span>
                    </a>
                  )}
                  {user.socialLinks?.twitter && (
                    <a href={`https://twitter.com/${user.socialLinks.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-neutral-50 rounded-2xl hover:bg-primary/5 transition group">
                      <Twitter size={18} className="text-neutral-400 group-hover:text-primary transition" />
                      <span className="font-bold text-sm">{user.socialLinks.twitter}</span>
                    </a>
                  )}
                  {user.socialLinks?.instagram && (
                    <a href={`https://instagram.com/${user.socialLinks.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-neutral-50 rounded-2xl hover:bg-primary/5 transition group">
                      <Instagram size={18} className="text-neutral-400 group-hover:text-primary transition" />
                      <span className="font-bold text-sm">{user.socialLinks.instagram}</span>
                    </a>
                  )}
                  {!user.website && !user.socialLinks?.twitter && !user.socialLinks?.instagram && (
                    <p className="text-sm text-neutral-400 italic">No social links added yet.</p>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === 'api' && (
          /* API & Developer Settings */
          <section className="bg-white p-5 sm:p-10 rounded-2xl sm:rounded-[3rem] border border-primary/5 shadow-sm space-y-6 sm:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
          <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
            <Code className="text-primary shrink-0" />
            <span>API & Embed Settings</span>
          </h3>
          {user.plan === 'free' && (
            <span className="self-start sm:self-auto px-3 py-1 bg-neutral-100 text-neutral-400 rounded-full text-[10px] font-black uppercase tracking-widest">Pro Feature</span>
          )}
          {user.subscriptionStatus === 'trialing' && (
            <button
              type="button"
              onClick={() => {
                setRestrictedFeature('Developer API Integrations & Webhooks');
                setIsUpgradeNowModalOpen(true);
              }}
              className="self-start sm:self-auto px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 border-none rounded-full text-[10px] font-black uppercase tracking-widest font-mono flex items-center gap-1 cursor-pointer"
            >
              <Lock size={10} />
              <span>Convert Trial to Unlock API Access</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="micro-label">Your Personal API Key</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 bg-neutral-50 px-4 py-3 sm:px-6 sm:py-4 rounded-2xl border border-neutral-100 font-mono text-xs sm:text-sm flex items-center justify-between group min-w-0">
                  <span className="truncate pr-2">{user.apiKey ? (isEditing ? user.apiKey : `•••••••••••••${user.apiKey.slice(-4)}`) : 'No key generated'}</span>
                  {user.apiKey && (
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(user.apiKey!);
                        toast.success('API Key copied to clipboard');
                      }}
                      className="p-1.5 text-neutral-400 hover:text-primary transition shrink-0"
                    >
                      <Copy size={16} />
                    </button>
                  )}
                </div>
                <button
                  onClick={async () => {
                    if (user.plan === 'free') {
                      toast.error('API access requires a Pro plan');
                      return;
                    }
                    if (user.subscriptionStatus === 'trialing') {
                      setRestrictedFeature('Developer API Integrations & Webhooks');
                      setIsUpgradeNowModalOpen(true);
                      return;
                    }
                    const newKey = `pk_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
                    try {
                      await updateDoc(doc(db, 'users', user.uid), { apiKey: newKey });
                      onUpdate({ ...user, apiKey: newKey });
                      toast.success('New API key generated!');
                    } catch (e) {
                      toast.error('Failed to generate key');
                    }
                  }}
                  className="p-3 sm:p-4 bg-neutral-900 text-white rounded-2xl hover:bg-neutral-800 transition shadow-lg flex items-center justify-center gap-2 font-bold text-xs shrink-0"
                  title="Generate New Key"
                >
                  <RefreshCw size={18} className="shrink-0" />
                  <span className="sm:hidden">Generate New Key</span>
                </button>
              </div>
              <p className="text-[10px] text-neutral-400 font-medium">Keep your API key secret. Do not share it in public repositories.</p>
            </div>

            <div className="space-y-4">
              <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100">
                <div className="flex items-start gap-4">
                  <Zap size={20} className="text-blue-500 shrink-0 mt-1" />
                  <div className="space-y-2">
                    <h4 className="font-bold text-sm text-blue-900">Developer Documentation</h4>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      Use your API key to programmatically manage lists, gear, and integrations. 
                      Visit our developer portal for full documentation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <label className="micro-label">Embed Packer Tools</label>
              
              <div className="space-y-6">
                {/* Pro Version */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-900">Pro Version (Full Interface)</span>
                    <span className="text-[8px] bg-accent text-white px-1.5 py-0.5 rounded font-black uppercase">Recommended</span>
                  </div>
                  <div className="relative group">
                    <pre className="p-4 bg-neutral-900 text-neutral-300 rounded-xl text-[10px] overflow-hidden whitespace-pre-wrap font-mono leading-relaxed">
                      {`<iframe\n  src="${window.location.origin}/embed/${user.uid}?variant=pro"\n  width="100%"\n  height="600"\n  frameborder="0"\n></iframe>`}
                    </pre>
                    <button 
                      onClick={() => {
                        const code = `<iframe src="${window.location.origin}/embed/${user.uid}?variant=pro" width="100%" height="600" frameborder="0"></iframe>`;
                        navigator.clipboard.writeText(code);
                        toast.success('Embed code copied');
                      }}
                      className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg opacity-0 group-hover:opacity-100 transition"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>

                {/* Lite Version */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-neutral-900">Lite Version (List Only)</span>
                  <div className="relative group">
                    <pre className="p-4 bg-neutral-900 text-neutral-300 rounded-xl text-[10px] overflow-hidden whitespace-pre-wrap font-mono leading-relaxed">
                      {`<iframe\n  src="${window.location.origin}/embed/${user.uid}?variant=lite"\n  width="100%"\n  height="400"\n  frameborder="0"\n></iframe>`}
                    </pre>
                    <button 
                      onClick={() => {
                        const code = `<iframe src="${window.location.origin}/embed/${user.uid}?variant=lite" width="100%" height="400" frameborder="0"></iframe>`;
                        navigator.clipboard.writeText(code);
                        toast.success('Embed code copied');
                      }}
                      className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg opacity-0 group-hover:opacity-100 transition"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

        {activeTab === 'kyc' && (
          <section className="bg-white p-5 sm:p-10 rounded-2xl sm:rounded-[3rem] border border-primary/5 shadow-sm space-y-6 sm:space-y-8 animate-fade-in animate-duration-300">
            <header className="space-y-1">
              <span className="micro-label bg-[#002f6c] text-white border border-[#002f6c] px-3 py-1 rounded-full inline-block font-black uppercase tracking-wider">
                🇫🇯 FRCS compliance desk
              </span>
              <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-3 text-neutral-900 pt-2">
                <ShieldCheck className="text-[#002f6c] shrink-0" />
                <span>Fiji Business Setup & KYC</span>
              </h3>
              <p className="text-xs text-neutral-500 font-semibold leading-relaxed">
                Configure your Business Registry options to comply with the Fiji Revenue and Customs Service (FRCS) and Packer List compliance requirements.
              </p>
            </header>

            <form onSubmit={handleSaveFijiKyc} className="space-y-6">
              {/* Compliance Warning banner */}
              <div className="p-5 bg-gradient-to-r from-[#002f6c]/5 to-primary/5 border border-[#002f6c]/10 rounded-2xl space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-[#002f6c] flex items-center gap-2">
                  <span>ℹ️ Fiji Market Governance Notice</span>
                </h4>
                <p className="text-[11px] text-neutral-600 font-medium leading-relaxed">
                  As we establish the first equipment sharing & asset management community centered in <strong>Fiji</strong>, all store operators must operate within Fiji's business registration framework. Renting out equipment without declaring business setup or registered license details is restricted. Non-licensed entities can securely utilize the Packer List Platform license in representation mode.
                </p>
              </div>

              {/* Selection for Business Registry */}
              <div className="space-y-3">
                <label className="text-[10px] uppercase font-black tracking-widest text-neutral-400 block">FRCS Registry Option</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Option 2: Registered Business */}
                  <label className={`p-5 rounded-2xl border flex flex-col justify-between cursor-pointer transition ${fijiBusinessStatus === 'registered' ? 'bg-[#002f6c]/5 border-[#002f6c] ring-1 ring-[#002f6c]' : 'bg-white border-neutral-200 hover:border-neutral-300'}`}>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5">
                        <input 
                          type="radio" 
                          name="fijiBusinessStatus" 
                          value="registered" 
                          checked={fijiBusinessStatus === 'registered'}
                          onChange={() => {
                            setFijiBusinessStatus('registered');
                            setFijiUsePlatformBusinessLicense(false);
                          }}
                          className="text-[#002f6c] focus:ring-[#002f6c]"
                        />
                        <span className="font-extrabold text-xs text-neutral-900 uppercase tracking-wider">Independent Registered Business</span>
                      </div>
                      <p className="text-[10px] text-neutral-500 leading-relaxed pl-6">
                        I hold a valid Fiji Business License or registration under FRCS. I will list and transact under my business license.
                      </p>
                    </div>
                  </label>

                  {/* Option 1: No Business License - Platform Representation */}
                  <label className={`p-5 rounded-2xl border flex flex-col justify-between cursor-pointer transition ${fijiBusinessStatus === 'platform_representation' ? 'bg-[#ff4f3a]/5 border-[#ff4f3a] ring-1 ring-[#ff4f3a]' : 'bg-white border-neutral-200 hover:border-neutral-300'}`}>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5">
                        <input 
                          type="radio" 
                          name="fijiBusinessStatus" 
                          value="platform_representation" 
                          checked={fijiBusinessStatus === 'platform_representation'}
                          onChange={() => {
                            setFijiBusinessStatus('platform_representation');
                            setFijiUsePlatformBusinessLicense(true);
                          }}
                          className="text-[#ff4f3a] focus:ring-[#ff4f3a]"
                        />
                        <span className="font-extrabold text-xs text-neutral-900 uppercase tracking-wider">Use Platform Representation License</span>
                      </div>
                      <p className="text-[10px] text-neutral-500 leading-relaxed pl-6">
                        I do NOT have a business license. I grant Packer List permission to list on my behalf which incurs a platform service handling fee.
                      </p>
                    </div>
                  </label>

                </div>
              </div>

              {/* Conditional Sub-info */}
              {fijiBusinessStatus === 'registered' && (
                <div className="p-6 bg-neutral-50 rounded-2xl border border-neutral-200/50 space-y-4 animate-fade-in">
                  <span className="text-[10px] font-black uppercase tracking-wide text-[#002f6c]">Registered Business Credentials (FRCS Compliance)</span>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">Registered Business Name</label>
                      <input 
                        type="text"
                        placeholder="e.g. Suva Tech Hire Service"
                        value={fijiBusinessRegisteredName}
                        onChange={(e) => setFijiBusinessRegisteredName(e.target.value)}
                        required={fijiBusinessStatus === 'registered'}
                        className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-[#002f6c] outline-none transition text-xs font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">Fiji Business License No.</label>
                      <input 
                        type="text"
                        placeholder="e.g. BL-2026-9481"
                        value={fijiBusinessLicenseNumber}
                        onChange={(e) => setFijiBusinessLicenseNumber(e.target.value)}
                        required={fijiBusinessStatus === 'registered'}
                        className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-[#002f6c] outline-none transition text-xs font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">FRCS Taxpayer Identification No. (TIN)</label>
                      <input 
                        type="text"
                        placeholder="e.g. 50-12345-0-9"
                        value={fijiFrcsTin}
                        onChange={(e) => setFijiFrcsTin(e.target.value)}
                        required={fijiBusinessStatus === 'registered'}
                        className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-[#002f6c] outline-none transition text-xs font-bold"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block">Entity Type</label>
                      <select 
                        value={fijiBusinessType}
                        onChange={(e: any) => setFijiBusinessType(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-[#002f6c] outline-none transition text-xs font-bold"
                      >
                        <option value="sole_trader">Sole Trader</option>
                        <option value="partnership">Partnership</option>
                        <option value="company">Registered Company</option>
                        <option value="cooperative">Cooperative Group</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {fijiBusinessStatus === 'platform_representation' && (
                <div className="p-6 bg-red-50/50 border border-neutral-250 rounded-2xl space-y-4 animate-fade-in text-left">
                  <span className="text-[10px] font-black uppercase tracking-wide text-[#ff4f3a] flex items-center gap-2">
                    <AlertCircle size={14} />
                    <span>Platform Representation Terms & Service Fees</span>
                  </span>
                  <div className="space-y-2 text-[11px] text-neutral-600 leading-relaxed font-medium">
                    <p>
                      Packer List will register representing logistics with FRCS. To utilize this mechanism:
                    </p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>A 10% representation fee is automatically withheld from payouts.</li>
                      <li>You act as a sub-lister. All payments are compiled under Packer List’s legal framework.</li>
                    </ul>
                    <div className="pt-2 flex items-center gap-2.5">
                      <input 
                        type="checkbox" 
                        id="fijiUsePlatformBusinessLicense"
                        checked={fijiUsePlatformBusinessLicense}
                        onChange={(e) => setFijiUsePlatformBusinessLicense(e.target.checked)}
                        className="rounded text-primary focus:ring-0"
                      />
                      <label htmlFor="fijiUsePlatformBusinessLicense" className="font-bold text-neutral-800 cursor-pointer">
                        I acknowledge and accept the 10% Service Handling Fee for platform license usage.
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Extra Verification Toggle */}
              <div className="p-5 bg-neutral-50 rounded-2xl border border-neutral-100/80 flex items-start gap-4">
                <input 
                  type="checkbox" 
                  id="fijiAllowPackerListToList"
                  disabled={fijiBusinessStatus === 'registered'}
                  checked={fijiAllowPackerListToList || fijiBusinessStatus === 'registered'}
                  onChange={(e) => setFijiAllowPackerListToList(e.target.checked)}
                  className="rounded text-[#002f6c] focus:ring-0 mt-1"
                />
                <div className="space-y-1">
                  <label htmlFor="fijiAllowPackerListToList" className="text-xs font-black uppercase tracking-wider text-neutral-800 block cursor-pointer">
                    No Direct Storefront (Allow Packer List to List & Verify)
                  </label>
                  <p className="text-[10px] text-neutral-500 font-bold uppercase leading-relaxed">
                    If unchecked, users can own their storefront only if they possess an active business registration. Check this option to authorize Packer List Support to list and manage your listings on your behalf after a verification audit.
                  </p>
                </div>
              </div>

              {/* Save Button */}
              <button
                type="submit"
                disabled={isSavingKycFiji}
                className="w-full py-4 bg-[#002f6c] text-white rounded-2xl font-black uppercase tracking-widest hover:bg-[#002f6c]/90 transition shadow-xl flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isSavingKycFiji ? 'Processing FRCS Verification...' : (
                  <>
                    <Save size={18} />
                    <span>Save Compliance Profiles</span>
                  </>
                )}
              </button>
            </form>
          </section>
        )}
      </motion.div>

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        user={user}
        adminSettings={adminSettings}
        onSuccess={(newPlan) => onUpdate({ ...user, plan: newPlan })}
      />

      <UpgradeNowModal
        isOpen={isUpgradeNowModalOpen}
        onClose={() => setIsUpgradeNowModalOpen(false)}
        user={user}
        adminSettings={adminSettings}
        restrictedFeatureName={restrictedFeature}
        onSuccess={(newPlan) => onUpdate({ ...user, plan: newPlan })}
      />
    </div>
  );
}
