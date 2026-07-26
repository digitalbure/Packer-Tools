import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  FileText,
  Plus,
  Search,
  Trash2,
  Edit2,
  Eye,
  Settings,
  Shield,
  Info,
  Globe,
  Save,
  X,
  CheckCircle2,
  AlertCircle,
  Scale,
  Sparkles,
  Layout,
  ArrowUpRight,
  Star
} from 'lucide-react';
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { CustomPage, UserProfile } from '../types';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

interface PagesManagerProps {
  user: UserProfile | null;
}

const PagesManager: React.FC<PagesManagerProps> = ({ user }) => {
  const [pages, setPages] = useState<CustomPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'landing' | 'legal' | 'policy' | 'info' | 'other'>('all');
  const [isEditing, setIsEditing] = useState(false);
  const [currentPage, setCurrentPage] = useState<Partial<CustomPage>>({
    title: '',
    slug: '',
    content: '',
    category: 'info',
    status: 'draft',
    isVisible: true
  });

  useEffect(() => {
    if (!user?.isSuperAdmin) return;

    const q = query(collection(db, 'pages'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pagesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CustomPage[];
      setPages(pagesList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'pages');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.isSuperAdmin) return;

    try {
      const pageData = {
        ...currentPage,
        updatedAt: serverTimestamp(),
        lastUpdatedBy: user.uid
      };

      if (currentPage.id) {
        await updateDoc(doc(db, 'pages', currentPage.id), pageData as any);
        toast.success('Page updated successfully');
      } else {
        await addDoc(collection(db, 'pages'), {
          ...pageData,
          createdAt: serverTimestamp()
        });
        toast.success('Page created successfully');
      }
      setIsEditing(false);
      setCurrentPage({
        title: '',
        slug: '',
        content: '',
        category: 'info',
        status: 'draft',
        isVisible: true
      });
    } catch (error) {
      console.error('Error saving page:', error);
      toast.error('Failed to save page');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this page?')) return;
    try {
      await deleteDoc(doc(db, 'pages', id));
      toast.success('Page deleted');
    } catch (error) {
      toast.error('Failed to delete page');
    }
  };

  const handleSetActiveLandingPage = async (page: CustomPage) => {
    try {
      await updateDoc(doc(db, 'adminSettings', 'global'), {
        activeLandingPageType: 'custom',
        activeCustomPageSlug: page.slug
      });
      toast.success(`Set "${page.title}" as active system landing page!`);
    } catch (error) {
      console.error('Error setting active landing page:', error);
      toast.error('Failed to activate landing page');
    }
  };

  const handleInsertLandingTemplate = () => {
    setCurrentPage({
      title: 'Enterprise Asset & Gear Operations',
      slug: 'enterprise-gear-operations',
      category: 'landing',
      status: 'published',
      isVisible: true,
      content: `# Enterprise Asset & Gear Operations

## High-Volume Equipment Logistics, Kiosk Audits & Real-Time Tracking

Packer Tools is built for cinema production houses, construction rigging teams, medical emergency units, and high-performance athletic rosters.

### Core Capabilities
- **Visual Checkouts**: Mandatory photo validation and signature captures.
- **Smart Kiosk Terminal**: Dedicated check-in/check-out barcode kiosk with offline SW sync.
- **Multi-Industry Setup**: Adapted terminology across Cinema, Construction, EMS, and Athletics.
- **Maintenance & Telemetry**: Predictive lifecycle monitoring, calibration alarms, and repair logs.

### Plans & Tier Pricing
- **Starter**: Up to 250 items, 5 team members — $29/mo
- **Pro Operations**: Unlimited assets, Kiosk mode, custom exports — $99/mo
- **Enterprise**: Dedicated Cloud SQL / Firestore, SSO, custom SLAs — Contact Sales

[Start Free Trial Today](/#/register) | [Book a Demo](/#/contact)
`
    });
    toast.info('Loaded Landing Page template!');
  };

  const filteredPages = pages.filter(page => {
    const matchesSearch = page.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      page.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || page.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (!user?.isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <AlertCircle size={48} className="text-red-500" />
        <h2 className="text-2xl font-black uppercase tracking-tighter">Access Denied</h2>
        <p className="text-neutral-500">Only administrators can access this module.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-5xl font-black uppercase tracking-tighter">Pages Module</h1>
            <span className="px-3 py-1 bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1.5">
              <Sparkles size={12} />
              Landing Page Enabled
            </span>
          </div>
          <p className="text-neutral-400 font-bold uppercase tracking-widest text-[10px]">Manage legal documents, static pages, and custom landing page variants</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/admin?tab=landing"
            className="flex items-center gap-2 px-6 py-4 bg-neutral-100 text-neutral-800 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-neutral-200 transition"
          >
            <Layout size={18} className="text-primary" />
            <span>Landing Page Manager</span>
            <ArrowUpRight size={14} className="text-neutral-400" />
          </Link>

          <button
            onClick={() => {
              setCurrentPage({
                title: '',
                slug: '',
                content: '',
                category: 'landing',
                status: 'draft',
                isVisible: true
              });
              setIsEditing(true);
            }}
            className="flex items-center gap-2 px-8 py-4 bg-primary text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 transition shadow-xl shadow-primary/20"
          >
            <Plus size={18} />
            <span>Create Page</span>
          </button>
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex-1 w-full relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
          <input
            type="text"
            placeholder="Search pages by title or slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-neutral-50 border border-neutral-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 transition"
          />
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 bg-neutral-100 p-1.5 rounded-2xl overflow-x-auto w-full md:w-auto shrink-0">
          {[
            { id: 'all', label: 'All Pages' },
            { id: 'landing', label: 'Landing Pages', icon: <Sparkles size={12} className="text-amber-500" /> },
            { id: 'legal', label: 'Legal' },
            { id: 'policy', label: 'Policy' },
            { id: 'info', label: 'Info' },
            { id: 'other', label: 'Other' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as any)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition flex items-center gap-1.5 whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              {cat.icon}
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPages.map(page => (
          <motion.div
            key={page.id}
            layout
            className={`group bg-white p-8 rounded-[2.5rem] border transition-all space-y-6 relative overflow-hidden ${
              page.category === 'landing' ? 'border-amber-200 shadow-amber-500/5 hover:border-amber-400 hover:shadow-xl' : 'border-neutral-100 shadow-sm hover:shadow-xl'
            }`}
          >
            {page.category === 'landing' && (
              <div className="absolute top-0 right-0 bg-amber-500 text-white text-[8px] font-black uppercase tracking-widest px-4 py-1 rounded-bl-2xl">
                Landing Variant
              </div>
            )}

            <div className="flex items-start justify-between">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${
                page.category === 'landing' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' :
                page.category === 'legal' ? 'bg-neutral-900 text-white' :
                page.category === 'policy' ? 'bg-neutral-900 text-white' :
                page.category === 'info' ? 'bg-neutral-900 text-white' : 'bg-neutral-900 text-white'
              }`}>
                {page.category === 'landing' ? <Sparkles size={20} /> :
                 page.category === 'legal' ? <Scale size={20} /> :
                 page.category === 'policy' ? <Shield size={20} /> :
                 page.category === 'info' ? <Info size={20} /> : <FileText size={20} />}
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                  page.status === 'published' ? 'bg-emerald-100 text-emerald-600' : 'bg-neutral-100 text-neutral-500'
                }`}>
                  {page.status}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-black uppercase tracking-tighter truncate">{page.title}</h3>
              <p className="text-[10px] font-mono text-neutral-400">/pg/{page.slug}</p>
            </div>

            <div className="pt-2 space-y-2">
              {page.category === 'landing' && page.status === 'published' && (
                <button
                  type="button"
                  onClick={() => handleSetActiveLandingPage(page)}
                  className="w-full py-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-2xl font-black uppercase text-[10px] tracking-widest transition flex items-center justify-center gap-2"
                >
                  <Star size={14} className="text-amber-500 fill-amber-500" />
                  <span>Set as System Landing Page</span>
                </button>
              )}

              <div className="flex items-center gap-2">
                <Link
                  to={`/pg/${page.slug}`}
                  target="_blank"
                  className="flex-1 flex items-center justify-center gap-2 p-4 bg-neutral-50 text-neutral-900 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-neutral-100 transition"
                >
                  <Globe size={14} />
                  View Page
                </Link>
                <button
                  onClick={() => {
                    setCurrentPage(page);
                    setIsEditing(true);
                  }}
                  className="p-4 bg-neutral-50 text-neutral-400 rounded-2xl hover:text-primary transition"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => handleDelete(page.id)}
                  className="p-4 bg-neutral-50 text-neutral-400 rounded-2xl hover:text-red-500 transition"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[3rem] p-8 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl shadow-neutral-900/50"
          >
            <div className="flex justify-between items-center mb-8 shrink-0">
              <div className="space-y-1">
                <h2 className="text-3xl font-black uppercase tracking-tighter">
                  {currentPage.id ? 'Edit Page' : 'Create New Page'}
                </h2>
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Fill in the details for your custom page or landing page</p>
              </div>
              <button
                onClick={() => setIsEditing(false)}
                className="p-3 hover:bg-neutral-50 rounded-2xl transition text-neutral-400"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-8 flex-1 overflow-y-auto px-1">
              {currentPage.category === 'landing' && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Sparkles size={20} className="text-amber-500 shrink-0" />
                    <div>
                      <p className="text-xs font-black uppercase text-amber-900">Creating a Custom Landing Page</p>
                      <p className="text-[10px] text-amber-700">Pre-populate rich landing page sections or use Markdown to render high-converting hero copy.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleInsertLandingTemplate}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition shrink-0"
                  >
                    Insert Template
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Page Title</label>
                  <input
                    required
                    type="text"
                    value={currentPage.title}
                    onChange={(e) => setCurrentPage({ ...currentPage, title: e.target.value })}
                    className="w-full p-4 bg-neutral-50 border border-neutral-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 transition"
                    placeholder="e.g. Enterprise Asset Operations Landing"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Page Slug (URL)</label>
                  <input
                    required
                    type="text"
                    value={currentPage.slug}
                    onChange={(e) => setCurrentPage({ ...currentPage, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                    className="w-full p-4 bg-neutral-50 border border-neutral-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 transition font-mono"
                    placeholder="enterprise-landing"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Category</label>
                  <select
                    value={currentPage.category}
                    onChange={(e) => setCurrentPage({ ...currentPage, category: e.target.value as any })}
                    className="w-full p-4 bg-neutral-50 border border-neutral-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 transition"
                  >
                    <option value="landing">Landing Page</option>
                    <option value="legal">Legal</option>
                    <option value="policy">Policy</option>
                    <option value="info">Info</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Status</label>
                  <select
                    value={currentPage.status}
                    onChange={(e) => setCurrentPage({ ...currentPage, status: e.target.value as any })}
                    className="w-full p-4 bg-neutral-50 border border-neutral-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 transition"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Content (Markdown Supported)</label>
                <textarea
                  required
                  value={currentPage.content}
                  onChange={(e) => setCurrentPage({ ...currentPage, content: e.target.value })}
                  className="w-full p-6 bg-neutral-50 border border-neutral-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 transition h-64 font-mono text-sm leading-relaxed"
                  placeholder="# Welcome to the landing page..."
                />
              </div>

              <div className="flex items-center gap-4 pt-4 shrink-0">
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 py-5 bg-neutral-900 text-white rounded-[2rem] font-black uppercase text-xs tracking-widest hover:bg-black transition shadow-xl shadow-neutral-900/20 active:scale-95"
                >
                  <Save size={18} />
                  {currentPage.id ? 'Save Changes' : 'Create Page'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-10 py-5 bg-neutral-100 text-neutral-500 rounded-[2rem] font-black uppercase text-xs tracking-widest hover:bg-neutral-200 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default PagesManager;
