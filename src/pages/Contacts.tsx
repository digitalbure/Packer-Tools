import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Contact } from '../types';
import { 
  UserPlus, 
  Mail, 
  Phone, 
  MoreVertical, 
  Trash2, 
  Edit2, 
  Search, 
  ArrowLeft,
  Briefcase,
  User,
  Building2,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, AdminSettings } from '../types';
import { checkLimit } from '../lib/limitUtils';
import { toast } from 'sonner';

interface ContactsProps {
  user: UserProfile;
  adminSettings: AdminSettings | null;
}

export default function Contacts({ user, adminSettings }: ContactsProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<'Personal' | 'Professional' | 'Business'>('Personal');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'contacts'),
      where('ownerId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const contactData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Contact[];
      setContacts(contactData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    if (!editingContact) {
      const { allowed } = await checkLimit(user, adminSettings, 'contacts');
      if (!allowed) {
        toast.error('Contact limit reached for your plan. Please upgrade to add more.');
        return;
      }
    }

    const contactData = {
      ownerId: auth.currentUser.uid,
      name,
      email,
      phone,
      type,
      notes,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingContact) {
        await updateDoc(doc(db, 'contacts', editingContact.id), contactData);
      } else {
        await addDoc(collection(db, 'contacts'), {
          ...contactData,
          createdAt: new Date().toISOString()
        });
      }
      resetForm();
      setShowAddModal(false);
    } catch (error) {
      console.error('Error saving contact:', error);
    }
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setType('Personal');
    setNotes('');
    setEditingContact(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this contact?')) {
      try {
        await deleteDoc(doc(db, 'contacts', id));
      } catch (error) {
        console.error('Error deleting contact:', error);
      }
    }
  };

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone?.includes(searchQuery)
  );

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Personal': return <User size={14} />;
      case 'Professional': return <Briefcase size={14} />;
      case 'Business': return <Building2 size={14} />;
      default: return <User size={14} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F4] text-[#1A1A1A] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="p-2 hover:bg-neutral-100 rounded-full transition">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter">Contacts</h1>
              <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">Manage Recipients & Partners</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
              <input 
                type="text"
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-neutral-100 border-none rounded-full text-sm focus:ring-2 focus:ring-primary w-64 transition-all"
              />
            </div>
            <button 
              onClick={() => { resetForm(); setShowAddModal(true); }}
              className="bg-primary text-white px-6 py-2.5 rounded-full font-bold uppercase text-xs tracking-widest flex items-center gap-2 hover:bg-primary/90 transition shadow-lg shadow-primary/20"
            >
              <UserPlus size={16} />
              Add Contact
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-12">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-[2rem] border border-dashed border-neutral-300">
            <div className="w-20 h-20 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <UserPlus size={32} className="text-neutral-300" />
            </div>
            <h3 className="text-xl font-bold mb-2">No contacts found</h3>
            <p className="text-neutral-500 max-w-xs mx-auto text-sm">Start by adding your first contact to manage your shipments and rentals.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredContacts.map((contact) => (
              <motion.div 
                layout
                key={contact.id}
                className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm hover:shadow-xl transition-all group relative"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 bg-neutral-50 rounded-2xl flex items-center justify-center text-primary font-black text-xl">
                    {contact.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => {
                        setEditingContact(contact);
                        setName(contact.name);
                        setEmail(contact.email || '');
                        setPhone(contact.phone || '');
                        setType(contact.type);
                        setNotes(contact.notes || '');
                        setShowAddModal(true);
                      }}
                      className="p-2 hover:bg-neutral-50 rounded-full text-neutral-400 hover:text-primary transition"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(contact.id)}
                      className="p-2 hover:bg-neutral-50 rounded-full text-neutral-400 hover:text-red-500 transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight leading-none mb-1">{contact.name}</h3>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                      {getTypeIcon(contact.type)}
                      {contact.type}
                    </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-neutral-50">
                    {contact.email && (
                      <div className="flex items-center gap-3 text-sm text-neutral-500">
                        <Mail size={14} className="text-neutral-300" />
                        {contact.email}
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-3 text-sm text-neutral-500">
                        <Phone size={14} className="text-neutral-300" />
                        {contact.phone}
                      </div>
                    )}
                  </div>

                  {contact.notes && (
                    <p className="text-xs text-neutral-400 italic line-clamp-2 pt-2">
                      "{contact.notes}"
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-neutral-100 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter">
                    {editingContact ? 'Edit Contact' : 'New Contact'}
                  </h2>
                  <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">Recipient Information</p>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-neutral-100 rounded-full transition">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-black text-neutral-400">Full Name</label>
                  <input 
                    required
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-5 py-3 bg-neutral-50 border border-neutral-100 rounded-2xl focus:ring-2 focus:ring-primary outline-none transition"
                    placeholder="e.g. John Doe"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-black text-neutral-400">Email</label>
                    <input 
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-5 py-3 bg-neutral-50 border border-neutral-100 rounded-2xl focus:ring-2 focus:ring-primary outline-none transition"
                      placeholder="john@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-black text-neutral-400">Phone</label>
                    <input 
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-5 py-3 bg-neutral-50 border border-neutral-100 rounded-2xl focus:ring-2 focus:ring-primary outline-none transition"
                      placeholder="+1 234 567 890"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-black text-neutral-400">Contact Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Personal', 'Professional', 'Business'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                          type === t 
                            ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' 
                            : 'bg-white text-neutral-400 border-neutral-100 hover:border-neutral-200'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-black text-neutral-400">Notes</label>
                  <textarea 
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-5 py-3 bg-neutral-50 border border-neutral-100 rounded-2xl focus:ring-2 focus:ring-primary outline-none transition resize-none"
                    placeholder="Add any additional details..."
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-4 rounded-2xl font-black uppercase text-xs tracking-widest text-neutral-400 hover:bg-neutral-50 transition"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-2 py-4 px-8 bg-primary text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-primary/90 transition shadow-xl shadow-primary/20"
                  >
                    {editingContact ? 'Update Contact' : 'Save Contact'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
