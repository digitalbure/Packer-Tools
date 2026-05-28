import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { AdminSettings } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Phone, MapPin, ArrowLeft, Send, CheckCircle2, Eye, Code } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export default function ContactPage() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Simulation results preview state
  const [simulationResult, setSimulationResult] = useState<{
    success: boolean;
    simulated: boolean;
    html?: string;
    notice?: string;
    recipient?: string;
  } | null>(null);
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'adminSettings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as AdminSettings);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !message) {
      toast.error("Email and Message are required!");
      return;
    }

    setIsSubmitting(true);
    setSimulationResult(null);

    try {
      const response = await fetch('/api/send-contact-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          message,
          timestamp: new Date().toLocaleString()
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        toast.success("Message dispatched successfully!");
        setSimulationResult(data);
        // Clear fields on success
        setFirstName('');
        setLastName('');
        setEmail('');
        setMessage('');
      } else {
        toast.error(data.error || "Failed sending enquiry email.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Could not reach message delivery handler.");
    } finally {
      setIsSubmitting(false);
    }
  };

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

        {/* Success simulation drawer */}
        <AnimatePresence>
          {simulationResult && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-emerald-50 border border-emerald-200 p-8 rounded-[2.5rem] space-y-6"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-emerald-200 shadow-lg">
                  <CheckCircle2 size={24} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-emerald-950 uppercase tracking-tight">Enquiry Handshake Complete!</h3>
                  <p className="text-sm text-emerald-800 font-medium">
                    {simulationResult.simulated 
                      ? "A sandbox copy was simulated gracefully because the main credentials key isn't loaded."
                      : `Live message has been dispatched successfully to ${simulationResult.recipient}.`
                    }
                  </p>
                  <p className="text-xs text-emerald-600/80 font-semibold">{simulationResult.notice}</p>
                </div>
              </div>

              {simulationResult.html && (
                <div className="pt-4 border-t border-emerald-200/50 space-y-4">
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setShowHtmlPreview(!showHtmlPreview)}
                      className="px-4 py-2 bg-emerald-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-pointer hover:bg-emerald-800 transition"
                    >
                      <Eye size={14} />
                      <span>{showHtmlPreview ? "Hide Rendered HTML Proof" : "Show Rendered HTML Proof"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSimulationResult(null)}
                      className="px-4 py-2 bg-neutral-200 text-neutral-700 hover:bg-neutral-300 rounded-xl text-xs font-bold uppercase tracking-wider transition"
                    >
                      Close Report
                    </button>
                  </div>

                  {showHtmlPreview && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="border border-neutral-200 rounded-2xl bg-white overflow-hidden shadow-inner"
                    >
                      <div className="p-4 bg-neutral-100 border-b border-neutral-200 text-xs font-mono font-bold text-neutral-600 flex items-center gap-2">
                        <Code size={14} />
                        <span>Interactive HTML Proof for: {simulationResult.recipient}</span>
                      </div>
                      <iframe 
                        title="HTML email verification sandbox"
                        srcDoc={simulationResult.html} 
                        className="w-full h-[350px] bg-white border-none"
                      />
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid lg:grid-cols-2 gap-24 items-start">
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
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="micro-label">First Name</label>
                  <input 
                    type="text" 
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Enter first name"
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl focus:ring-2 focus:ring-primary outline-none transition" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="micro-label">Last Name</label>
                  <input 
                    type="text" 
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Enter last name"
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl focus:ring-2 focus:ring-primary outline-none transition" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="micro-label">Email Address</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl focus:ring-2 focus:ring-primary outline-none transition" 
                />
              </div>
              <div className="space-y-2">
                <label className="micro-label">Message</label>
                <textarea 
                  rows={4} 
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message details..."
                  required
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl focus:ring-2 focus:ring-primary outline-none transition resize-none" 
                />
              </div>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full py-5 bg-primary text-white rounded-2xl font-black uppercase tracking-widest hover:bg-primary/90 transition shadow-xl flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? "Sending message..." : "Send Message"}
                <Send size={18} />
              </button>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
