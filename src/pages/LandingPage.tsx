import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, ArrowRight, Package, Shield, Globe, Zap, Camera, QrCode, ShoppingBag, Truck } from 'lucide-react';
import { UserProfile, AdminSettings, LandingPageFeature } from '../types';
import { signInWithGoogle } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';

const iconMap: { [key: string]: React.ReactNode } = {
  Camera: <Camera size={24} />,
  QrCode: <QrCode size={24} />,
  ShoppingBag: <ShoppingBag size={24} />,
  Truck: <Truck size={24} />,
  Zap: <Zap size={24} />,
  Shield: <Shield size={24} />,
  Globe: <Globe size={24} />,
  Package: <Package size={24} />
};

const IndustrialTicker = ({ pairs }: { pairs: { by: string, for: string }[] }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % pairs.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [pairs.length]);

  return (
    <div className="space-y-8 md:space-y-12 max-w-full overflow-visible">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-3 bg-primary" />
          <span className="micro-label text-neutral-400">Used By</span>
        </div>
        <div className="relative min-h-[4rem] md:min-h-[6rem] flex items-start overflow-visible">
          <AnimatePresence mode="wait">
            <motion.div
              key={`by-${index}`}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
              className="w-full"
            >
              <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase text-primary font-mono leading-[0.9] break-words">
                {pairs[index].by}
              </h2>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-3 bg-accent" />
          <span className="micro-label text-neutral-400">Used For</span>
        </div>
        <div className="relative min-h-[4rem] md:min-h-[6rem] flex items-start overflow-visible">
          <AnimatePresence mode="wait">
            <motion.div
              key={`for-${index}`}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
              className="w-full"
            >
              <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase text-accent font-mono leading-[0.9] break-words">
                {pairs[index].for}
              </h2>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

const AIRecognitionDisplay = ({ config }: { config?: AdminSettings['aiRecognitionConfig'] }) => {
  const defaultItems = [
    {
      id: '1',
      name: "Sony A7IV",
      details: "Identified with 24-70mm f/2.8 GM II",
      image: "https://images.unsplash.com/photo-1542332213-9b5a5a3fad35?auto=format&fit=crop&q=80&w=2000",
      icon: 'Camera'
    },
    {
      id: '2',
      name: "DJI Mavic 3 Pro",
      details: "Triple-camera system detected",
      image: "https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&q=80&w=2000",
      icon: 'Package'
    },
    {
      id: '3',
      name: "Arc'teryx Alpha SV",
      details: "GORE-TEX PRO shell identified",
      image: "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&q=80&w=2000",
      icon: 'Shield'
    },
    {
      id: '4',
      name: "Peak Design Travel",
      details: "45L Backpack - Sage Edition",
      image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=2000",
      icon: 'Package'
    },
    {
      id: '5',
      name: "Blackmagic Pocket 6K",
      details: "EF Mount with Rigging detected",
      image: "https://images.unsplash.com/photo-1533310266094-8898a03807dd?auto=format&fit=crop&q=80&w=2000",
      icon: 'Camera'
    }
  ];

  const items = config?.items || defaultItems;
  const interval = config?.interval || 6000;
  const isEnabled = config?.enabled !== false;

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!isEnabled || items.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length);
    }, interval);
    return () => clearInterval(timer);
  }, [items.length, interval, isEnabled]);

  if (!isEnabled) return null;

  return (
    <div className="flex-1 relative bg-neutral-200 overflow-hidden min-h-[400px] lg:min-h-full">
      <AnimatePresence mode="wait">
        <motion.img
          key={`img-${index}`}
          initial={{ scale: 1.1, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          src={items[index].image}
          alt={items[index].name}
          className="absolute inset-0 w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-1000"
          referrerPolicy="no-referrer"
        />
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-t from-paper/40 to-transparent" />
      
      <div className="absolute bottom-8 left-8 right-8 glass p-6 rounded-2xl flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={`icon-${index}`}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white"
            >
              {iconMap[items[index].icon] || <Package size={24} />}
            </motion.div>
          </AnimatePresence>
          <div>
            <div className="font-bold flex items-center gap-2">
              <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
              AI Recognition Active
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={`text-${index}`}
                initial={{ y: 5, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -5, opacity: 0 }}
                className="text-xs text-neutral-500"
              >
                <span className="font-bold text-primary">{items[index].name}</span> {items[index].details}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        <div className="w-10 h-10 border border-primary/10 rounded-full flex items-center justify-center">
          <div className="w-2 h-2 bg-accent rounded-full animate-ping" />
        </div>
      </div>
    </div>
  );
};

export default function LandingPage({ user, adminSettings }: { user: UserProfile | null, adminSettings: AdminSettings | null }) {
  const plans = adminSettings?.plans || [];
  const activeLander = adminSettings?.landers?.find(l => l.id === adminSettings.activeLanderId);
  
  // Use new structure if available, otherwise fallback to old one
  const lp = activeLander?.content || adminSettings?.landingPage;

  return (
    <div className="min-h-screen bg-paper text-primary selection:bg-accent selection:text-white bg-grid overflow-x-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-primary/5 bg-paper/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
              <Package size={18} />
            </div>
            <span className="font-black uppercase tracking-tighter">{lp?.header?.logoText || 'Packer Tools'}</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-8">
            {lp?.header?.links.map((link, i) => (
              <a key={i} href={link.href} className="text-xs font-bold uppercase tracking-widest hover:text-accent transition-colors">
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            {user ? (
              <Link to="/dashboard" className="px-6 py-2 bg-primary text-white rounded-full font-bold text-sm">Dashboard</Link>
            ) : (
              <button onClick={signInWithGoogle} className="px-6 py-2 bg-primary text-white rounded-full font-bold text-sm">Sign In</button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section - Split Layout */}
      {(lp?.hero?.isEnabled !== false) && (
        <section className="relative min-h-screen flex flex-col lg:flex-row border-b border-primary/10 overflow-hidden pt-20">
          {/* Animated Industrial Gradient */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 5, 0],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-accent/5 blur-[120px] rounded-full pointer-events-none"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            rotate: [0, -5, 0],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] bg-safety-yellow/5 blur-[120px] rounded-full pointer-events-none"
        />

        <div className="flex-1 flex flex-col justify-center p-8 lg:p-24 space-y-16 relative z-10">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            <div className="flex items-center gap-3">
              <div className="px-2 py-1 bg-safety-yellow text-primary text-[10px] font-black uppercase tracking-widest rounded">System v2.4</div>
              <span className="micro-label">{lp?.hero?.subtitle || 'Industrial Grade Gear Tracking'}</span>
            </div>
            
            <h1 className="text-6xl md:text-[120px] font-black tracking-tighter leading-[0.82] uppercase whitespace-pre-line">
              {lp?.hero?.title ? lp.hero.title.split('. ').map((part, i) => (
                <span key={i} className={i % 2 !== 0 ? 'text-accent' : 'text-primary'}>
                  {part}{i < lp.hero.title.split('. ').length - 1 ? '.' : ''} <br />
                </span>
              )) : (
                <>
                  Visual <br />
                  <span className="text-accent">Inventory.</span> <br />
                  Instant <br />
                  <span className="text-primary">Market.</span>
                </>
              )}
            </h1>
            
            {(lp?.ticker?.isEnabled !== false) && (
              <div className="max-w-md">
                <IndustrialTicker 
                  pairs={lp?.ticker?.pairs || [
                    { by: "Production Crews", for: "Camera Kit Labeling" },
                    { by: "Logistics Teams", for: "Team Kit Distribution" },
                    { by: "Mountaineers", for: "Expedition Readiness" },
                    { by: "Global Logistics", for: "Asset Accountability" },
                    { by: "Rental Houses", for: "Lifecycle Management" },
                    { by: "Hikers & Backpackers", for: "Trail Weight Optimization" },
                    { by: "Touring Artists", for: "Backstage Inventory" },
                    { by: "Field Engineers", for: "Tooling Deployment" }
                  ]} 
                />
              </div>
            )}

            <p className="text-xl text-neutral-500 max-w-md leading-relaxed font-medium">
              {lp?.hero?.description || 'Professional-grade lifecycle management for high-stakes equipment. Visual verification, asset tracking, and one-click marketplace deployment.'}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap gap-4"
          >
            {user ? (
              <Link
                to="/dashboard"
                className="group flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-full font-bold transition-all hover:gap-5"
              >
                Go to Dashboard
                <ArrowRight size={20} />
              </Link>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="group flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-full font-bold transition-all hover:gap-5"
              >
                {lp?.hero?.primaryButtonText || 'Get Started'}
                <ArrowRight size={20} />
              </button>
            )}
            <a
              href="#scenarios"
              className="px-8 py-4 border border-primary/10 rounded-full font-bold hover:bg-white transition-colors"
            >
              {lp?.hero?.secondaryButtonText || 'Explore Use Cases'}
            </a>
          </motion.div>

          {(lp?.stats?.isEnabled !== false) && (
            <div className="pt-12 grid grid-cols-3 gap-8 border-t border-primary/5">
              {(lp?.stats?.items || [
                { label: "Recognition", value: "99.2%" },
                { label: "Active Users", value: "12k+" },
                { label: "Kits Managed", value: "450k" }
              ]).map((stat, i) => (
                <div key={i} className="space-y-1">
                  <div className="text-2xl font-black tracking-tighter">{stat.value}</div>
                  <div className="micro-label text-[8px]">{stat.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <AIRecognitionDisplay config={adminSettings?.aiRecognitionConfig} />
      </section>
      )}

      {/* Value Proposition - Grid Layout */}
      {(lp?.features?.isEnabled !== false) && (
        <section className="py-24 px-8 max-w-7xl mx-auto relative">
          {/* Industrial Gradient Accents */}
          <div className="absolute top-0 left-0 w-64 h-64 bg-accent/5 blur-[100px] rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-safety-yellow/5 blur-[120px] rounded-full translate-x-1/2 translate-y-1/2" />

          <div className="grid md:grid-cols-2 gap-24 items-end mb-24 relative z-10">
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase leading-[0.85]">
              {lp?.features?.title ? lp.features.title.split(' ').map((word, i) => (
                <React.Fragment key={i}>
                  {i === lp.features.title.split(' ').length - 1 ? <span className="text-neutral-400">{word}</span> : word}
                  {i < lp.features.title.split(' ').length - 1 && <br />}
                </React.Fragment>
              )) : (
                <>
                  Built for <br />
                  <span className="text-neutral-400">The Field.</span>
                </>
              )}
            </h2>
            <p className="text-xl text-neutral-500 leading-relaxed font-medium pb-2">
              {lp?.features?.description || "We've engineered a system that thrives in high-pressure environments. From remote expeditions to back-to-back production schedules."}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-1px bg-primary/10 border border-primary/10 rounded-3xl overflow-hidden relative z-10">
            {( (lp?.features as any)?.items || [
              { 
                icon: 'Camera', 
                title: "Visual Audit", 
                description: "Every item requires a photographic record. No more 'I thought I packed it'—absolute accountability for every piece of gear." 
              },
              { 
                icon: 'QrCode', 
                title: "Asset Integration", 
                description: "Seamlessly bridge digital lists with physical hardware using our integrated QR and Asset Tag scanning system." 
              },
              { 
                icon: 'ShoppingBag', 
                title: "Marketplace Sync", 
                description: "Instantly deploy gear lists to global marketplaces. One-click sharing with professional formatting and visual verification." 
              }
            ] as any[] ).map((feature: any, i: number) => (
              <div key={i} className="bg-paper p-12 space-y-8 hover:bg-white transition-all duration-500 group border-b md:border-b-0 md:border-r border-primary/5 last:border-0">
                <div className="w-12 h-12 flex items-center justify-center text-primary group-hover:text-accent transition-colors">
                  {iconMap[feature.icon] || <Package />}
                </div>
                <div className="space-y-4">
                  <h3 className="text-2xl font-black tracking-tight uppercase">{feature.title}</h3>
                  <p className="text-neutral-500 leading-relaxed text-sm">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Safety Stripe Divider */}
      <div className="h-4 safety-stripes w-full" />

      {/* Scenarios - Industrial Style */}
      {(lp?.scenarios?.isEnabled !== false) && (
        <section id="scenarios" className="py-24 border-t border-primary/10 bg-paper/50 relative overflow-hidden">
          <div className="px-8 max-w-7xl mx-auto space-y-16 relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-end gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-safety-yellow rounded-full animate-pulse" />
                  <span className="micro-label">Field Operations</span>
                </div>
                <h2 className="text-5xl font-black tracking-tighter uppercase">{lp?.scenarios?.title || 'The Standard Across Industries'}</h2>
              </div>
              <p className="text-neutral-500 max-w-sm text-sm font-medium">
                {lp?.scenarios?.subtitle || 'From independent creators to global logistics teams, Packer Tools provides the infrastructure for visual gear management and versioned workflows.'}
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {( (lp?.scenarios as any)?.items || [
                { title: "Film Production", image: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&q=80&w=800" },
                { title: "Alpine Expeditions", image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=800" },
                { title: "Tactical Logistics", image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=800" },
                { title: "Extreme Sports", image: "https://images.unsplash.com/photo-1533560904424-a0c61dc306fc?auto=format&fit=crop&q=80&w=800" }
              ] as any[] ).map((s: any, i: number) => (
                <motion.div 
                  key={i}
                  whileHover={{ y: -5 }}
                  className="relative aspect-[3/4] rounded-2xl overflow-hidden group cursor-pointer border border-primary/5"
                >
                  <img src={s.image} alt={s.title} className="absolute inset-0 w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/20 to-transparent opacity-80 group-hover:opacity-95 transition-opacity" />
                  <div className="absolute bottom-6 left-6 right-6 text-white">
                    <div className="font-mono text-[10px] text-safety-yellow mb-1 tracking-widest">0{i + 1} // SECTOR</div>
                    <div className="text-xl font-black uppercase tracking-tight">{s.title}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Safety Stripe Divider */}
      <div className="h-4 safety-stripes w-full" />

      {/* Testimonials */}
      {(lp?.testimonials?.isEnabled) && (
        <section className="py-24 px-8 max-w-7xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-5xl font-black tracking-tighter uppercase">{lp.testimonials.title}</h2>
            <p className="text-neutral-500 font-medium">{lp.testimonials.subtitle}</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {lp.testimonials.items.map((t, i) => (
              <div key={i} className="bg-white p-8 rounded-3xl border border-neutral-100 shadow-sm space-y-6">
                <p className="text-lg font-medium leading-relaxed italic text-neutral-600">"{t.content}"</p>
                <div className="flex items-center gap-4">
                  {t.avatar && <img src={t.avatar} alt={t.name} className="w-12 h-12 rounded-full object-cover" referrerPolicy="no-referrer" />}
                  <div>
                    <div className="font-black uppercase tracking-tighter">{t.name}</div>
                    <div className="text-xs text-neutral-400 font-bold uppercase tracking-widest">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FAQ Section */}
      {(lp?.faq?.isEnabled) && (
        <section className="py-24 px-8 max-w-4xl mx-auto">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-5xl font-black tracking-tighter uppercase">{lp.faq.title}</h2>
            <p className="text-neutral-500 font-medium">{lp.faq.subtitle}</p>
          </div>
          <div className="space-y-4">
            {lp.faq.items.map((item, i) => (
              <div key={i} className="bg-white p-8 rounded-3xl border border-neutral-100 shadow-sm space-y-4">
                <h3 className="text-xl font-black uppercase tracking-tight text-primary">{item.question}</h3>
                <p className="text-neutral-500 leading-relaxed font-medium">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pricing - Minimalist */}
      <section className="py-24 px-8" id="pricing">
        <div className="max-w-7xl mx-auto bg-primary text-white rounded-[3rem] p-12 md:p-24 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-accent/10 blur-[120px] rounded-full" />
          
          <div className="relative z-10 grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <h2 className="text-5xl md:text-7xl font-black tracking-tighter uppercase leading-[0.85]">
                {lp?.cta?.title ? lp.cta.title.split(' ').map((word, i) => (
                  <React.Fragment key={i}>
                    {i === lp.cta.title.split(' ').length - 1 ? <span className="text-white/40">{word}</span> : word}
                    {i < lp.cta.title.split(' ').length - 1 && <br />}
                  </React.Fragment>
                )) : (
                  <>
                    Simple <br />
                    <span className="text-white/40">Access.</span>
                  </>
                )}
              </h2>
              <p className="text-xl text-white/60 leading-relaxed max-w-md">
                {lp?.cta?.description || "Professional tools shouldn't have complex pricing. Choose the tier that matches your scale."}
              </p>
            </div>

            <div className="grid gap-6">
              {plans.length > 0 ? (
                plans.map((plan) => (
                  <div 
                    key={plan.id} 
                    className={`p-8 rounded-3xl flex items-center justify-between transition-all ${
                      plan.price > 0 ? 'bg-white text-primary shadow-2xl scale-105' : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                    }`}
                  >
                    <div>
                      <h3 className="text-xl font-bold uppercase tracking-tight">{plan.name}</h3>
                      <p className={`${plan.price > 0 ? 'text-primary/40' : 'text-white/40'} text-xs font-medium`}>
                        {plan.features.slice(0, 3).map(f => f.replace(/([A-Z])/g, ' $1')).join(', ')}...
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black tracking-tighter">${plan.price}</div>
                      <div className={`micro-label ${plan.price > 0 ? 'text-primary/40' : 'text-white/40'}`}>
                        {plan.price === 0 ? 'Forever' : 'Per Month'}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 bg-white/5 border border-white/10 rounded-3xl text-center">
                  <p className="text-white/40">Loading plans...</p>
                </div>
              )}

              <button 
                onClick={signInWithGoogle}
                className="w-full py-5 bg-accent text-white rounded-2xl font-black uppercase tracking-widest hover:bg-accent/90 transition shadow-xl mt-4"
              >
                {lp?.cta?.buttonText || 'Get Started Now'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-8 border-t border-primary/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
              <Package size={18} />
            </div>
            <span className="font-black uppercase tracking-tighter">{lp?.header?.logoText || 'Packer Tools'}</span>
          </div>
          <div className="flex gap-8 text-sm font-medium text-neutral-400">
            {(lp?.footer?.links && lp.footer.links.length > 0) ? lp.footer.links.map((link, i) => (
              <a key={i} href={link.href} className="hover:text-primary transition">{link.label}</a>
            )) : (
              <>
                <Link to="/privacy" className="hover:text-primary transition">Privacy</Link>
                <Link to="/terms" className="hover:text-primary transition">Terms</Link>
                <Link to="/contact" className="hover:text-primary transition">Contact</Link>
                <Link to="/help" className="hover:text-primary transition">Help</Link>
              </>
            )}
          </div>
          <div className="text-xs text-neutral-400">
            {lp?.footer?.copyright || `© ${new Date().getFullYear()} Packer Tools. All rights reserved.`}
          </div>
        </div>
      </footer>
    </div>
  );
}
