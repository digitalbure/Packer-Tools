import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { AdminSettings } from '../types';
import ReactMarkdown from 'react-markdown';
import { motion } from 'motion/react';
import { Shield, FileText, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface LegalPageProps {
  type: 'privacy' | 'terms';
}

export default function LegalPage({ type }: LegalPageProps) {
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

  const content = type === 'privacy' ? settings?.privacyContent : settings?.termsContent;
  const title = type === 'privacy' ? 'Privacy Policy' : 'Terms of Service';
  const Icon = type === 'privacy' ? Shield : FileText;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-primary py-24 px-8">
      <div className="max-w-3xl mx-auto space-y-12">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-neutral-400 hover:text-primary transition group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="font-bold uppercase text-xs tracking-widest">Back to Home</span>
        </Link>

        <header className="space-y-6">
          <div className="w-16 h-16 bg-primary/5 rounded-2xl flex items-center justify-center text-primary">
            <Icon size={32} />
          </div>
          <h1 className="text-5xl font-black tracking-tighter uppercase">{title}</h1>
          <p className="text-neutral-500 font-medium">
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </header>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="prose prose-neutral max-w-none prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tighter prose-p:text-neutral-600 prose-p:leading-relaxed"
        >
          {content ? (
            <ReactMarkdown>{content}</ReactMarkdown>
          ) : (
            <p className="italic text-neutral-400">Content is being updated. Please check back soon.</p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
