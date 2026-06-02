import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Search, 
  User, 
  UserCheck, 
  Layers, 
  Package, 
  Calendar, 
  Check, 
  Loader2, 
  ArrowRightLeft,
  ChevronRight,
  Plus
} from 'lucide-react';
import { db } from '../firebase';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { toast } from 'sonner';

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  type?: string;
}

interface ManualCheckoutModalProps {
  type: 'gear' | 'kit' | 'list';
  data: any; // GearItem or PackingList
  user: any; // auth user
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ManualCheckoutModal({ type, data, user, onClose, onSuccess }: ManualCheckoutModalProps) {
  if (!data) return null;

  const isGear = type === 'gear' || type === 'kit';
  const name = data.name || 'Untitled';
  
  // States
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState<{ id: string; name: string; email?: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Initialize selectedAssignee if already checked out
  useEffect(() => {
    if (isGear && data.status === 'in_use') {
      setSelectedAssignee({
        id: data.assignedTo || '',
        name: data.currentHolder || 'Checked Out'
      });
    } else if (!isGear && data.status === 'Active' && data.recipientName) {
      setSelectedAssignee({
        id: data.recipientId || '',
        name: data.recipientName || 'Checked Out',
        email: data.recipientEmail
      });
    }
  }, [data, isGear]);

  // Fetch contacts
  useEffect(() => {
    if (!user) return;
    const fetchContacts = async () => {
      setLoadingContacts(true);
      try {
        const qContacts = query(collection(db, 'contacts'), where('ownerId', '==', user.uid));
        const snap = await getDocs(qContacts);
        const contactList: Contact[] = [];
        snap.forEach((docSnap) => {
          contactList.push({ id: docSnap.id, ...docSnap.data() } as Contact);
        });
        setContacts(contactList);
      } catch (err) {
        console.error('Error fetching contacts for checkout suggestions:', err);
      } finally {
        setLoadingContacts(false);
      }
    };
    fetchContacts();
  }, [user]);

  // Filter contacts by search query
  const filteredContacts = contacts.filter(contact => {
    const term = searchQuery.toLowerCase();
    return (
      contact.name.toLowerCase().includes(term) ||
      (contact.email && contact.email.toLowerCase().includes(term))
    );
  });

  // Check out handler
  const handleCheckOut = async () => {
    if (!user) {
      toast.error('You must be logged in to perform check out.');
      return;
    }

    let assigneeName = '';
    let assigneeId = '';
    let assigneeEmail = '';

    if (selectedAssignee) {
      assigneeName = selectedAssignee.name;
      assigneeId = selectedAssignee.id;
      assigneeEmail = selectedAssignee.email || '';
    } else {
      // Default to self if no recipient selected and searching is empty or they explicitly choose
      assigneeName = user.displayName || user.email || 'Platform User';
      assigneeId = user.uid;
      assigneeEmail = user.email || '';
    }

    setIsSubmitting(true);
    try {
      if (isGear) {
        // Update Gear/Kit in users/{uid}/gearLibrary/{id}
        const gearRef = doc(db, 'users', user.uid, 'gearLibrary', data.id);
        await updateDoc(gearRef, {
          status: 'in_use',
          assignedTo: assigneeId,
          currentHolder: assigneeName,
          updatedAt: new Date().toISOString()
        });
        toast.success(`"${name}" checked out successfully to ${assigneeName}`);
      } else {
        // Update Packing List of packingLists/{id}
        const listRef = doc(db, 'packingLists', data.id);
        await updateDoc(listRef, {
          status: 'Active',
          recipientId: assigneeId,
          recipientName: assigneeName,
          recipientEmail: assigneeEmail,
          bookingClientName: assigneeName,
          rentalStatus: 'released',
          updatedAt: new Date().toISOString()
        });
        toast.success(`Packing List "${name}" checked out successfully to ${assigneeName}`);
      }
      
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error performing manual checkout:', err);
      toast.error(err.message || 'Failed to check out item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check in / Return handler
  const handleCheckIn = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      if (isGear) {
        const gearRef = doc(db, 'users', user.uid, 'gearLibrary', data.id);
        await updateDoc(gearRef, {
          status: 'available',
          assignedTo: null,
          currentHolder: null,
          updatedAt: new Date().toISOString()
        });
        toast.success(`"${name}" has been checked in and is now Available.`);
      } else {
        const listRef = doc(db, 'packingLists', data.id);
        await updateDoc(listRef, {
          status: 'Completed',
          rentalStatus: 'returned',
          updatedAt: new Date().toISOString()
        });
        toast.success(`Packing List "${name}" has been marked as returned / Completed.`);
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error performing check in:', err);
      toast.error(err.message || 'Failed to check in item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCurrentlyCheckedOut = isGear 
    ? data.status === 'in_use' 
    : data.status === 'Active';

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-neutral-950/80 backdrop-blur-md"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 25 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 25 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="w-full max-w-lg bg-white rounded-[2.5rem] border border-neutral-100 shadow-2xl p-6 sm:p-8 relative z-10 space-y-6 text-left max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
              <ArrowRightLeft size={11} className="text-primary animate-pulse" />
              <span>Manual Custody Workflow</span>
            </span>
            <h3 className="text-xl font-black text-neutral-900 tracking-tight uppercase leading-none">
              {isCurrentlyCheckedOut ? 'Check Asset In' : 'Manual Check Out'}
            </h3>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-2 hover:bg-neutral-100 rounded-full transition text-neutral-400 hover:text-neutral-900"
          >
            <X size={20} />
          </button>
        </div>

        {/* Selected Asset Information Display */}
        <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-150 flex gap-4 items-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            {type === 'kit' && <Layers size={24} />}
            {type === 'gear' && <Package size={24} />}
            {type === 'list' && <Calendar size={24} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400">{type}</p>
            <p className="font-bold text-neutral-800 truncate leading-snug">{name}</p>
            {isCurrentlyCheckedOut ? (
              <p className="text-[9px] text-red-600 font-extrabold mt-0.5 uppercase tracking-wider">
                Currently Checked Out to: <span className="underline">{data.currentHolder || data.recipientName || 'Checked Out'}</span>
              </p>
            ) : (
              <p className="text-[9px] text-green-600 font-extrabold mt-0.5 uppercase tracking-wider">
                ● STATUS: AVAILABLE FOR HANDOVER
              </p>
            )}
          </div>
        </div>

        {isCurrentlyCheckedOut ? (
          /* Check In Mode */
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200/60 p-5 rounded-2xl space-y-2">
              <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider">Confirm Check-In / Handover Return</h4>
              <p className="text-xs text-neutral-600 leading-relaxed font-semibold">
                Returning this asset will update its custody status back to <strong className="text-emerald-600 font-black">AVAILABLE</strong> in the live inventory catalog. Any signed handover releases or checklists will be marked as complete.
              </p>
            </div>

            <button
              onClick={handleCheckIn}
              disabled={isSubmitting}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-xs rounded-2xl transition shadow-xl shadow-emerald-600/10 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <UserCheck size={16} />
              )}
              <span>Confirm Check-In (Make Available)</span>
            </button>
          </div>
        ) : (
          /* Check Out Mode */
          <div className="space-y-6">
            {/* Quick assignment options */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Quick Assignment Shortcut</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAssignee({ id: user?.uid || 'self', name: user?.displayName || user?.email || 'Platform User', email: user?.email })}
                  className={`p-3.5 rounded-2xl border text-left flex items-center gap-2.5 transition ${
                    selectedAssignee?.id === (user?.uid || 'self')
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-neutral-150 hover:bg-neutral-50 text-neutral-600'
                  }`}
                >
                  <User size={16} className="shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-wider">Check Out To Myself</p>
                    <p className="font-bold text-xs truncate">{user?.displayName || user?.email || 'Me'}</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedAssignee(null);
                    setSearchQuery('');
                  }}
                  className={`p-3.5 rounded-2xl border text-left flex items-center gap-2.5 transition ${
                    !selectedAssignee
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-neutral-150 hover:bg-neutral-50 text-neutral-600'
                  }`}
                >
                  <UserCheck size={16} className="shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-wider">Assign on Behalf of Someone</p>
                    <p className="font-bold text-xs truncate">Search contacts & platform users</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Selection Status */}
            {selectedAssignee && (
              <div className="p-3 bg-neutral-100 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 bg-primary text-white font-black text-xs rounded-full flex items-center justify-center shrink-0 uppercase">
                    {selectedAssignee.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-tight text-neutral-400">Assignee selected</p>
                    <p className="font-bold text-xs text-neutral-800 leading-none truncate">{selectedAssignee.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAssignee(null)}
                  className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-white rounded transition"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Custom search bar with Auto-Predict suggest */}
            <div className="space-y-2 relative">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Search Assignees / Contacts</label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                <input
                  type="text"
                  placeholder="Predictive search by name or email..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  className="w-full pl-10 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-xs font-semibold"
                />
              </div>

              {/* Suggestions dropdown */}
              <AnimatePresence>
                {showSuggestions && searchQuery.trim().length > 0 && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowSuggestions(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-neutral-150 rounded-2xl shadow-xl z-50 overflow-hidden max-h-56 overflow-y-auto divide-y divide-neutral-100"
                    >
                      {/* Matching Results list */}
                      {filteredContacts.length > 0 ? (
                        filteredContacts.map(contact => (
                          <button
                            key={contact.id}
                            type="button"
                            onClick={() => {
                              setSelectedAssignee({ id: contact.id, name: contact.name, email: contact.email });
                              setShowSuggestions(false);
                              setSearchQuery('');
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-neutral-50 flex items-center justify-between text-xs transition"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-6 h-6 bg-neutral-100 text-neutral-500 font-bold rounded-lg flex items-center justify-center shrink-0 uppercase text-[10px]">
                                {contact.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-neutral-800 truncate leading-tight">{contact.name}</p>
                                {contact.email && <p className="text-[10px] text-neutral-400 truncate leading-none mt-0.5">{contact.email}</p>}
                              </div>
                            </div>
                            <ChevronRight size={14} className="text-neutral-400 shrink-0" />
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center space-y-2">
                          <p className="text-[11px] font-medium text-neutral-400">No matching contacts found.</p>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAssignee({ id: `custom-${Date.now()}`, name: searchQuery.trim() });
                              setShowSuggestions(false);
                              setSearchQuery('');
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-black uppercase tracking-wider rounded-lg transition"
                          >
                            <Plus size={10} />
                            <span>Assign to custom name: "{searchQuery.slice(0, 15)}"</span>
                          </button>
                        </div>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Action buttons */}
            <button
              onClick={handleCheckOut}
              disabled={isSubmitting}
              className="w-full py-4 bg-primary text-white font-black uppercase tracking-widest text-xs rounded-2xl transition shadow-xl shadow-primary/20 hover:bg-primary/95 flex items-center justify-center gap-2 mt-4"
            >
              {isSubmitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <UserCheck size={16} />
              )}
              <span>Confirm Check Out Handover</span>
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
