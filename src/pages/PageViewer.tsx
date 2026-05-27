import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { CustomPage } from '../types';
import Markdown from 'react-markdown';
import { 
  ArrowLeft, 
  Clock, 
  Shield, 
  Scale, 
  Info, 
  FileText,
  AlertCircle
} from 'lucide-react';

const PageViewer: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<CustomPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPage = async () => {
      if (!slug) return;
      
      try {
        const q = query(
          collection(db, 'pages'),
          where('slug', '==', slug),
          where('status', '==', 'published'),
          limit(1)
        );
        
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
          setError('Page not found');
        } else {
          const pageData = snapshot.docs[0].data() as CustomPage;
          setPage({ ...pageData, id: snapshot.docs[0].id });
        }
      } catch (err) {
        console.error('Error fetching page:', err);
        setError('Failed to load page');
      } finally {
        setLoading(false);
      }
    };

    fetchPage();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-16 h-16 border-4 border-neutral-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 space-y-6 text-center">
        <AlertCircle size={64} className="text-neutral-200" />
        <div className="space-y-2">
          <h1 className="text-4xl font-black uppercase tracking-tighter">{error}</h1>
          <p className="text-neutral-500 max-w-sm">This page might have been removed or the URL is incorrect.</p>
        </div>
        <Link 
          to="/"
          className="px-8 py-4 bg-neutral-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 transition"
        >
          Return Home
        </Link>
      </div>
    );
  }

  const getCategoryIcon = () => {
    switch (page.category) {
      case 'legal': return <Scale size={24} />;
      case 'policy': return <Shield size={24} />;
      case 'info': return <Info size={24} />;
      default: return <FileText size={24} />;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-neutral-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 bg-neutral-900 text-white rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
              <ArrowLeft size={20} />
            </div>
            <span className="font-black uppercase tracking-tighter text-xl">Back Home</span>
          </Link>
          
          <div className="flex items-center gap-3 px-4 py-2 bg-neutral-50 rounded-full border border-neutral-100">
            <div className="text-neutral-400">{getCategoryIcon()}</div>
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{page.category}</span>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-12"
        >
          <div className="space-y-6">
            <h1 className="text-6xl md:text-7xl font-black uppercase tracking-tighter leading-[0.9]">
              {page.title}
            </h1>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-neutral-400">
                <Clock size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Last Updated: {page.updatedAt?.toDate ? page.updatedAt.toDate().toLocaleDateString() : 'Recently'}
                </span>
              </div>
            </div>
          </div>

          <div className="w-full h-px bg-neutral-100" />

          <div className="prose prose-neutral prose-xl max-w-none">
            <Markdown 
              components={{
                h1: ({children}) => <h1 className="text-4xl font-black uppercase tracking-tighter mt-12 mb-6">{children}</h1>,
                h2: ({children}) => <h2 className="text-3xl font-black uppercase tracking-tighter mt-10 mb-5">{children}</h2>,
                h3: ({children}) => <h3 className="text-2xl font-black uppercase tracking-tighter mt-8 mb-4">{children}</h3>,
                p: ({children}) => <p className="text-lg text-neutral-600 leading-relaxed font-medium mb-6">{children}</p>,
                ul: ({children}) => <ul className="space-y-4 mb-6 list-none p-0">{children}</ul>,
                li: ({children}) => (
                  <li className="flex items-start gap-4">
                    <div className="w-2 h-2 rounded-full bg-neutral-900 mt-2.5 shrink-0" />
                    <span className="text-lg text-neutral-600 font-medium leading-relaxed">{children}</span>
                  </li>
                ),
                blockquote: ({children}) => (
                  <div className="border-l-4 border-neutral-900 pl-8 my-12 py-4">
                    <p className="text-2xl font-black uppercase tracking-tighter text-neutral-400">{children}</p>
                  </div>
                )
              }}
            >
              {page.content}
            </Markdown>
          </div>

          <div className="pt-20 border-t border-neutral-100">
            <div className="p-12 bg-neutral-50 rounded-[3rem] border border-neutral-100 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="space-y-2 text-center md:text-left">
                <h3 className="text-3xl font-black uppercase tracking-tighter">Have Questions?</h3>
                <p className="text-neutral-500 font-medium">If you need clarification about these terms, reach out.</p>
              </div>
              <a 
                href="mailto:support@packertools.ai"
                className="px-10 py-5 bg-neutral-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black transition shadow-xl shadow-neutral-900/20 active:scale-95"
              >
                Contact Support
              </a>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default PageViewer;
