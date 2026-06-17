import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { Compass, Send, CheckCircle2, LogOut, Loader2, ClipboardList, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';

interface BetaProspectGateProps {
  user: UserProfile;
  onLogout: () => void;
}

export default function BetaProspectGate({ user, onLogout }: BetaProspectGateProps) {
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Form States
  const [industry, setIndustry] = useState('');
  const [customIndustry, setCustomIndustry] = useState('');
  const [role, setRole] = useState('');
  const [howHelp, setHowHelp] = useState('');
  const [painPointsBg, setPainPointsBg] = useState('');

  useEffect(() => {
    // Check if user already has a pending waiting list survey submitted
    const checkExistingSubmission = async () => {
      try {
        const q = query(collection(db, 'betaWaitingList'), where('email', '==', user.email));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setHasSubmitted(true);
        }
      } catch (err) {
        console.warn("Error checking existing beta waiting list:", err);
      } finally {
        setChecking(false);
      }
    };
    checkExistingSubmission();
  }, [user.email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosenIndustry = industry === 'Other' ? customIndustry.trim() : industry;
    if (!chosenIndustry || !role.trim() || !howHelp.trim() || !painPointsBg.trim()) {
      toast.error("Please fill in all the required questionnaire fields.");
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'betaWaitingList'), {
        email: user.email.trim().toLowerCase(),
        industry: chosenIndustry,
        role: role.trim(),
        howHelp: howHelp.trim(),
        painPointsBg: painPointsBg.trim(),
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      toast.success("Survey submitted successfully! You are now on the waiting list.");
      setHasSubmitted(true);
    } catch (err) {
      console.error("Failed to submit waitlist survey:", err);
      toast.error("An error occurred. Please try submitting again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-white space-y-4">
        <Loader2 className="animate-spin text-primary" size={40} />
        <p className="text-sm font-semibold tracking-wide text-neutral-400 uppercase">Verifying Beta Authentication State...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center p-4 sm:p-6 md:p-8 font-sans">
      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden space-y-8">
        
        {/* Background accent ambient light */}
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-primary/10 blur-[100px] pointer-events-none" />

        {/* Header Block */}
        <div className="flex flex-col items-center text-center space-y-3 relative z-10">
          <div className="w-14 h-14 bg-primary/10 border border-primary/20 text-primary flex items-center justify-center rounded-2xl shadow-inner mb-2 animate-pulse">
            <Compass size={28} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter text-white">
            Private Beta Program
          </h1>
          <p className="text-xs sm:text-sm font-medium text-neutral-400 select-none max-w-lg leading-relaxed">
            Packer Tools is currently in a restricted Beta Testing phase. Registration is only open to pre-approved organizations and invited teammates.
          </p>
        </div>

        {hasSubmitted ? (
          /* Submission Completed view */
          <div className="bg-neutral-800/40 p-6 sm:p-8 rounded-2xl border border-neutral-850 space-y-6 text-center animate-in fade-in slide-in-from-bottom-2 duration-500 relative z-10">
            <div className="flex justify-center text-emerald-500">
              <CheckCircle2 size={48} className="animate-bounce" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Application Successfully Queued!</h3>
              <p className="text-xs text-neutral-400 max-w-md mx-auto leading-relaxed">
                Thank you for completing the sign-up survey. Your details have been recorded in our queue. We review pending applications in cohorts to ensure stellar platform stability.
              </p>
            </div>
            <div className="bg-neutral-900/60 p-4 rounded-xl border border-neutral-800 text-left space-y-1.5 max-w-md mx-auto">
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest block">Waitlist Profile</span>
              <span className="text-xs text-neutral-300 font-semibold block truncate">Email Address: <span className="text-white font-bold">{user.email}</span></span>
              <span className="text-xs text-neutral-300 font-semibold block">Application Status: <span className="text-orange-400 font-black uppercase tracking-wider">Pending Cohort Opening</span></span>
            </div>
            <button
              onClick={onLogout}
              className="px-6 py-2.5 bg-neutral-850 hover:bg-neutral-800 border border-neutral-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 mx-auto cursor-pointer"
            >
              <LogOut size={14} />
              <span>Sign Out / Use Another Account</span>
            </button>
          </div>
        ) : (
          /* Questionnaire Form */
          <form onSubmit={handleSubmit} className="space-y-6 relative z-10 animate-in fade-in slide-in-from-bottom-3 duration-500">
            
            <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 flex gap-3">
              <ClipboardList className="text-primary shrink-0" size={20} />
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Beta Survey Questionnaire</h4>
                <p className="text-[10px] text-neutral-400">Complete this short survey to request beta invitation access. Pre-vetted users are invited regularly.</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Industry Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">Which industry do you work in? *</label>
                <select
                  required
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 hover:border-neutral-700 focus:border-primary text-white rounded-xl text-xs font-semibold outline-none transition"
                >
                  <option value="" disabled>--- Select an Industry ---</option>
                  <option value="Event Production">Video & Event Production</option>
                  <option value="Contracting & Construction">Contracting & Job Site Construction</option>
                  <option value="Outdoors & Sports">Outdoors Expeditions, Diving or Hiking</option>
                  <option value="IT & Datacenters">IT Infrastructure / Server Hardware Racking</option>
                  <option value="Medical Equipment Management">Medical & Patient Care Vitals Supply</option>
                  <option value="Wardrobe Host Rentals">Wardrobe, Bridal & Custom Apparel</option>
                  <option value="Logistics & Fleet Transport">Heavy Logistics & Car Rental Fleet</option>
                  <option value="Other">Other (Please specify...)</option>
                </select>
              </div>

              {/* Custom Industry Input (if "Other" selected) */}
              {industry === 'Other' && (
                <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                  <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block font-mono">Specify Industry: *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Avionics Maintenance, Sound Staging"
                    value={customIndustry}
                    onChange={(e) => setCustomIndustry(e.target.value)}
                    className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 text-white rounded-xl text-xs font-semibold outline-none focus:border-primary transition"
                  />
                </div>
              )}

              {/* Role Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">What is your current role/title? *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lead AV Technician, Warehouse Logistics Manager"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 text-white rounded-xl text-xs font-semibold outline-none focus:border-primary transition"
                />
              </div>

              {/* howHelp Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">How would Packer Tools help you or your team? *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g., 'It would streamline real-time checkouts for camera gear when heading out to remote locations ...'"
                  value={howHelp}
                  onChange={(e) => setHowHelp(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 text-white rounded-xl text-xs font-medium outline-none focus:border-primary transition resize-none leading-relaxed"
                />
              </div>

              {/* painPointsBg Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
                  What are your main pain points when cataloguing, organizing, managing, or deploying gear? *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g., 'We struggle with tracking missing barcode labels, double-booking lenses, or knowing who owns which kit in real-time...'"
                  value={painPointsBg}
                  onChange={(e) => setPainPointsBg(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 text-white rounded-xl text-xs font-medium outline-none focus:border-primary transition resize-none leading-relaxed"
                />
              </div>
            </div>

            {/* Actions block */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-neutral-850">
              <button
                type="button"
                onClick={onLogout}
                className="w-full sm:w-auto px-6 py-3.5 text-xs text-neutral-400 font-bold hover:text-white flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <LogOut size={14} />
                <span>Sign Out Account</span>
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto px-8 py-3.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-opacity-90 transition shadow-lg shrink-0 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    <span>Submitting Application...</span>
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    <span>Join waiting list</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
