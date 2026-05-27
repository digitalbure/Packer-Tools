import React, { useState } from 'react';
import { Bell, Calendar, Mail, User, X, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Reminder } from '../types';
import { toast } from 'sonner';

interface ReminderModalProps {
  user: UserProfile;
  listId: string;
  listName: string;
  itemId?: string;
  itemName?: string;
  onClose: () => void;
}

export default function ReminderModal({ user, listId, listName, itemId, itemName, onClose }: ReminderModalProps) {
  const [type, setType] = useState<Reminder['type']>(itemId ? 'return' : 'pack');
  const [dueDate, setDueDate] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dueDate) {
      toast.error("Please select a due date");
      return;
    }

    setIsSubmitting(true);
    try {
      const reminderData: Omit<Reminder, 'id'> = {
        ownerId: user.uid,
        listId,
        itemId,
        itemName,
        type,
        dueDate: new Date(dueDate).toISOString(),
        status: 'pending',
        recipientName: recipientName || undefined,
        recipientEmail: recipientEmail || undefined,
        message: message || undefined,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'reminders'), reminderData);
      toast.success("Reminder set successfully!");
      onClose();
    } catch (error) {
      console.error("Error setting reminder:", error);
      toast.error("Failed to set reminder");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-300">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
              <Bell size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Set Reminder</h2>
              <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest">
                {itemName ? `Item: ${itemName}` : `List: ${listName}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full transition">
            <X size={20} className="text-neutral-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            {(['pack', 'return', 'maintenance', 'custom'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider border-2 transition-all ${
                  type === t 
                    ? 'border-primary bg-primary/5 text-primary' 
                    : 'border-neutral-100 text-neutral-400 hover:border-neutral-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
              <Calendar size={14} />
              Due Date & Time
            </label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition"
              required
            />
          </div>

          {type === 'return' && (
            <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
                <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  <strong>Rental Mode:</strong> You can set a reminder for a renter. We'll track this in your dashboard.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                  <User size={14} />
                  Renter Name (Optional)
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                  <Mail size={14} />
                  Renter Email (Optional)
                </label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="renter@example.com"
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Notes / Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add some context for the reminder..."
              rows={3}
              className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-1 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <Clock className="animate-spin" size={20} />
            ) : (
              <Bell size={20} />
            )}
            <span>Set Reminder</span>
          </button>
        </form>
      </div>
    </div>
  );
}
