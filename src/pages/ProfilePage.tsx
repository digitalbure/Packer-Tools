import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { db } from '../firebase';
import { UserProfile, AdminSettings } from '../types';
import { motion } from 'motion/react';
import { User, Mail, Globe, MapPin, Building, Twitter, Instagram, Linkedin, Save, Camera, ShieldCheck, Zap, Package, Server, Home, BarChart3, Key, Copy, Code, RefreshCw, Check, ChevronRight, Plus } from 'lucide-react';
import { getUsage } from '../lib/limitUtils';
import PaymentModal from '../components/PaymentModal';

interface ProfilePageProps {
  user: UserProfile;
  onUpdate: (updatedUser: UserProfile) => void;
  adminSettings: AdminSettings | null;
}

export default function ProfilePage({ user, onUpdate, adminSettings }: ProfilePageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<any>(null);
  const [formData, setFormData] = useState<Partial<UserProfile>>({
    displayName: user.displayName,
    bio: user.bio || '',
    website: user.website || '',
    location: user.location || '',
    company: user.company || '',
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
              {user.plan === 'pro' && (
                <span className="px-3 py-1 bg-accent text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-glow">Pro</span>
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
        <button
          onClick={() => setIsEditing(!isEditing)}
          className={`w-full sm:w-auto px-8 py-3 rounded-full font-bold uppercase text-xs tracking-widest transition-all ${
            isEditing ? 'bg-neutral-100 text-neutral-600' : 'bg-primary text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5'
          }`}
        >
          {isEditing ? 'Cancel' : 'Edit Profile'}
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
        <div className="md:col-span-2 space-y-6 sm:space-y-8">
          <section className="bg-white p-5 sm:p-10 rounded-2xl sm:rounded-[3rem] border border-primary/5 shadow-sm space-y-6 sm:space-y-8">
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
              </div>
            )}
          </section>

          {/* Marketplace Equipment Rental Settings */}
          <section className="bg-white p-5 sm:p-10 rounded-2xl sm:rounded-[3rem] border border-primary/5 shadow-sm space-y-6 sm:space-y-8">
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
            </div>
          </section>

          {/* Active Beta Notifications Desk */}
          <section className="bg-white p-5 sm:p-10 rounded-2xl sm:rounded-[3rem] border border-primary/5 shadow-sm space-y-6 sm:space-y-8 animate-fade-in">
            <header className="space-y-1">
              <span className="micro-label bg-amber-50 text-amber-500 border border-amber-200 px-2 py-0.5 rounded-full inline-block font-black">Beta Sandbox v1.0.0-beta.1</span>
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
                          subject: `Welcome to Packer Tools! [v1.0.0-beta.1 Onboarding]`
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
        </div>

        <div className="space-y-6 sm:space-y-8 col-span-1">
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
                  <div className="text-3xl font-black uppercase tracking-tighter shrink-0">{user.plan}</div>
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
                <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Select Available Tier</div>
                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={() => {
                        if (user.plan === 'free') return;
                        if (window.confirm("Switch to Free plan? Your limits will be reduced.")) {
                            const userRef = doc(db, 'users', user.uid);
                            updateDoc(userRef, { plan: 'free' });
                            onUpdate({ ...user, plan: 'free' });
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

                  {adminSettings?.plans?.filter(p => p.id !== 'free').map(plan => (
                    <button
                      key={plan.id}
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
                                <div className="text-xs font-black uppercase tracking-tighter">{plan.name}</div>
                                <div className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest italic">${plan.price}/mo</div>
                            </div>
                        </div>
                        {user.plan === plan.id ? <Check size={16} className="text-primary" /> : <ChevronRight size={16} className="text-neutral-300 group-hover:translate-x-1 transition-transform" />}
                    </button>
                  ))}
                </div>
              </div>

              <PaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                user={user}
                adminSettings={adminSettings}
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
        </div>
      </div>

      {/* API & Developer Settings */}
      <section className="bg-white p-5 sm:p-10 rounded-2xl sm:rounded-[3rem] border border-primary/5 shadow-sm space-y-6 sm:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
          <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
            <Code className="text-primary shrink-0" />
            <span>API & Embed Settings</span>
          </h3>
          {user.plan === 'free' && (
            <span className="self-start sm:self-auto px-3 py-1 bg-neutral-100 text-neutral-400 rounded-full text-[10px] font-black uppercase tracking-widest">Pro Feature</span>
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
    </div>
  );
}
