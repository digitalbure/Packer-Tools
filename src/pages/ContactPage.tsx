import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { AdminSettings } from '../types';
import { motion } from 'motion/react';
import { Mail, Phone, MapPin, ArrowLeft, Send } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ContactPage() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'adminSettings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as AdminSettings);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-primary py-24 px-8">
      <div className="max-w-5xl mx-auto space-y-16">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-neutral-400 hover:text-primary transition group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-bold uppercase text-xs tracking-widest">Back to Home</span>
        </Link>

        <div className="grid lg:grid-cols-2 gap-24 items-center">
          <div className="space-y-12">
            <header className="space-y-6">
              <span className="micro-label">Contact Us</span>
              <h1 className="text-6xl md:text-8xl font-black tracking-tighter uppercase leading-[0.85]">
                Get in <br />
                <span className="text-accent">Touch.</span>
              </h1>
              <p className="text-xl text-neutral-500 max-w-md leading-relaxed font-medium">
                Have questions about our precision inventory systems? Our team is here to help.
              </p>
            </header>

            <div className="space-y-8">
              {settings?.contactEmail && (
                <div className="flex items-center gap-6 group">
                  <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                    <Mail size={24} />
                  </div>
                  <div>
                    <div className="micro-label text-[8px]">Email</div>
                    <div className="text-lg font-bold">{settings.contactEmail}</div>
                  </div>
                </div>
              )}
              {settings?.contactPhone && (
                <div className="flex items-center gap-6 group">
                  <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                    <Phone size={24} />
                  </div>
                  <div>
                    <div className="micro-label text-[8px]">Phone</div>
                    <div className="text-lg font-bold">{settings.contactPhone}</div>
                  </div>
                </div>
              )}
              {settings?.contactAddress && (
                <div className="flex items-center gap-6 group">
                  <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
                    <MapPin size={24} />
                  </div>
                  <div>
                    <div className="micro-label text-[8px]">Address</div>
                    <div className="text-lg font-bold">{settings.contactAddress}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white p-12 rounded-[3rem] shadow-2xl space-y-8"
          >
            <h3 className="text-3xl font-black uppercase tracking-tighter">Send a Message</h3>
            <form className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="micro-label">First Name</label>
                  <input type="text" className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl focus:ring-2 focus:ring-primary outline-none transition" />
                </div>
                <div className="space-y-2">
                  <label className="micro-label">Last Name</label>
                  <input type="text" className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl focus:ring-2 focus:ring-primary outline-none transition" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="micro-label">Email Address</label>
                <input type="email" className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl focus:ring-2 focus:ring-primary outline-none transition" />
              </div>
              <div className="space-y-2">
                <label className="micro-label">Message</label>
                <textarea rows={4} className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl focus:ring-2 focus:ring-primary outline-none transition resize-none" />
              </div>
              <button className="w-full py-5 bg-primary text-white rounded-2xl font-black uppercase tracking-widest hover:bg-primary/90 transition shadow-xl flex items-center justify-center gap-3">
                Send Message
                <Send size={18} />
              </button>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
