import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, Box, ShieldAlert, Sparkles, RefreshCw, 
  Trash2, Plus, Info, AlertOctagon, CheckCircle2, User, UserCheck
} from 'lucide-react';
import { 
  collection, doc, updateDoc, increment, getDoc, 
  addDoc, deleteDoc, getDocs, limit, query 
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, AdminSettings, Plan } from '../types';
import { getUsage, trackAIUsage } from '../lib/limitUtils';

interface UsageMonitorProps {
  settings: AdminSettings | null;
  users: UserProfile[];
}

interface UserUsageData {
  currentTokens: number;
  limitTokens: number;
  currentGear: number;
  limitGear: number;
}

export default function UsageMonitor({ settings, users }: UsageMonitorProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<UserUsageData | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // Default to first user if available
  useEffect(() => {
    if (users && users.length > 0 && !selectedUserId) {
      setSelectedUserId(users[0].uid);
    }
  }, [users, selectedUserId]);

  const selectedUser = users.find(u => u.uid === selectedUserId);

  // Fetch usage counts for selected user
  const fetchUserUsage = async () => {
    if (!selectedUserId || !selectedUser) return;
    setLoading(true);
    setError(null);
    try {
      const stats = await getUsage(selectedUser, settings);
      setUsage({
        currentTokens: stats.aiTokens.current,
        limitTokens: stats.aiTokens.limit,
        currentGear: stats.gearItems.current,
        limitGear: stats.gearItems.limit
      });
    } catch (err: any) {
      console.error('[UsageMonitor] Failed loading user stats:', err);
      setError('Could not establish a telemetry connection to Firestore.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserUsage();
  }, [selectedUserId, settings]);

  // Show auto-dismiss notifications
  const triggerNotification = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Simulate an AI request (registers +1 Token usage)
  const handleSimulateAIRequest = async () => {
    if (!selectedUser || !usage) return;
    try {
      // Direct update of the local state and Firestore
      const userRef = doc(db, 'users', selectedUser.uid);
      await updateDoc(userRef, {
        aiTokenUsage: increment(1)
      });
      
      setUsage(prev => {
        if (!prev) return null;
        return { ...prev, currentTokens: prev.currentTokens + 1 };
      });
      triggerNotification(`Fiji-AI Core token allocated successfully (+1 Token)`, 'success');
    } catch (err: any) {
      triggerNotification(`Simulation failed: ${err.message}`, 'error');
    }
  };

  // Grant AI tokens quota allowance (boosts or resets)
  const handleResetAIQuota = async () => {
    if (!selectedUser) return;
    try {
      const userRef = doc(db, 'users', selectedUser.uid);
      await updateDoc(userRef, {
        aiTokenUsage: 0
      });
      setUsage(prev => {
        if (!prev) return null;
        return { ...prev, currentTokens: 0 };
      });
      triggerNotification(`Quota telemetry reset safely to 0`, 'info');
    } catch (err: any) {
      triggerNotification(`Telemetry error: ${err.message}`, 'error');
    }
  };

  // Append a demo item in their gear library to change Gear Counts dynamically
  const handleSimulateAddGear = async () => {
    if (!selectedUser) return;
    try {
      const gearLibraryCol = collection(db, 'users', selectedUser.uid, 'gearLibrary');
      await addDoc(gearLibraryCol, {
        name: 'Simulated Rigging Equipment',
        assetTag: `SIM-${Math.floor(1000 + Math.random() * 9000)}`,
        category: 'Rigging',
        condition: 'good',
        status: 'available',
        quantity: 1,
        createdAt: new Date().toISOString()
      });
      
      triggerNotification(`Simulated Gear Asset added to database`, 'success');
      // Fetch updated numbers
      await fetchUserUsage();
    } catch (err: any) {
      triggerNotification(`Gear allocation failed: ${err.message}`, 'error');
    }
  };

  // Remove one simulated/old gear items to test decrementing progress bar
  const handleRemoveSimulatedGear = async () => {
    if (!selectedUser) return;
    try {
      const gearLibraryCol = collection(db, 'users', selectedUser.uid, 'gearLibrary');
      const snap = await getDocs(query(gearLibraryCol, limit(1)));
      if (snap.empty) {
        triggerNotification('No gear items exist inside user\'s library to delete.', 'info');
        return;
      }
      
      const docToDelete = snap.docs[0];
      await deleteDoc(doc(db, 'users', selectedUser.uid, 'gearLibrary', docToDelete.id));
      triggerNotification(`One gear item purged safely from user profile`, 'info');
      await fetchUserUsage();
    } catch (err: any) {
      triggerNotification(`Gear removal aborted: ${err.message}`, 'error');
    }
  };

  // Helper metrics converters
  const getPercentage = (current: number, max: number) => {
    if (max <= 0) return 0;
    return Math.min(Math.round((current / max) * 100), 100);
  };

  const getProgressColor = (pct: number) => {
    if (pct < 70) return 'bg-emerald-500';
    if (pct < 90) return 'bg-[#F27D26]'; // Packer tools custom orange
    return 'bg-rose-500 animate-pulse';
  };

  const currentPlan = settings?.plans?.find(
    p => p.id === selectedUser?.plan || p.name.toLowerCase() === selectedUser?.plan?.toLowerCase()
  ) || settings?.plans?.[0];

  return (
    <div id="usage_monitor_container" className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-neutral-150 shadow-sm text-left relative overflow-hidden">
      
      {/* Background ambient accents */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-[#F27D26]/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-neutral-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-[#F27D26]/10 border border-[#F27D26]/20 text-[#F27D26] rounded-full text-[9px] font-black uppercase tracking-widest font-mono flex items-center gap-1">
              <Sparkles size={10} className="animate-spin-slow" />
              Dynamic Sandbox Monitor
            </span>
            <span className="text-[10px] text-neutral-400 font-mono font-medium">v1.1 Live Telemetry</span>
          </div>
          <h3 className="text-xl font-black text-neutral-900 tracking-tight">
            Subscription Usage & Guardrail Monitors
          </h3>
          <p className="text-xs text-neutral-500 font-medium">
            Inspect real-time AI token counts and gear libraries synced relative to user subscription tier boundaries.
          </p>
        </div>

        {/* User directory fast switcher */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 p-1 bg-neutral-50 border border-neutral-200 rounded-2xl w-full md:w-64">
            <span className="p-1 px-2 text-[10px] font-black uppercase tracking-tight text-neutral-400 font-mono flex items-center gap-1">
              <User size={12} />
              Inspect:
            </span>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="flex-1 bg-transparent py-1.5 pr-2 pl-1 rounded-xl text-xs font-bold text-neutral-800 focus:outline-none focus:ring-0 cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap"
            >
              {users.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.displayName || u.email} ({u.plan?.toUpperCase() || 'FREE'})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchUserUsage}
            disabled={loading}
            className="p-2.5 hover:bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-500 hover:text-neutral-800 transition disabled:opacity-50"
            title="Refresh limits telemetry"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {notification && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={`mt-4 p-3 rounded-2xl border flex items-center gap-2.5 text-xs font-medium font-mono ${
            notification.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' :
            notification.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-100' :
            'bg-blue-50 text-blue-800 border-blue-100'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0"></span>
          <span>{notification.text}</span>
        </motion.div>
      )}

      {loading && !usage ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3">
          <RefreshCw size={24} className="text-[#F27D26] animate-spin" />
          <p className="text-xs text-neutral-400 font-mono font-bold">Querying usage allocations across Firestore documents...</p>
        </div>
      ) : error ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-rose-500">
          <AlertOctagon size={28} />
          <p className="text-xs font-mono font-bold uppercase">{error}</p>
        </div>
      ) : selectedUser && usage ? (
        <div className="grid md:grid-cols-5 gap-6 mt-6">
          
          {/* User profile capsule */}
          <div className="md:col-span-2 bg-neutral-50/75 border border-neutral-100 rounded-3xl p-5 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#F27D26]/10 border border-[#F27D26]/20 flex items-center justify-center text-[#F27D26] font-bold text-sm">
                  {selectedUser.displayName ? selectedUser.displayName.charAt(0).toUpperCase() : <UserCheck size={16} />}
                </div>
                <div className="space-y-0.5 text-left">
                  <h4 className="text-sm font-black text-neutral-900 leading-tight">
                    {selectedUser.displayName || 'Unnamed User'}
                  </h4>
                  <p className="text-[10px] text-neutral-400 font-mono font-medium truncate max-w-[180px]">
                    {selectedUser.email}
                  </p>
                </div>
              </div>

              <div className="space-y-2 border-t border-neutral-150 pt-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-400 font-mono text-[10px] font-black uppercase">Quota Tier</span>
                  <span className="px-2 py-0.5 bg-neutral-900 text-white rounded text-[9px] font-black uppercase tracking-wider font-mono">
                    {selectedUser.plan || 'Free Plan'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400 font-mono text-[10px] font-black uppercase">UID Mappings</span>
                  <span className="font-mono text-[9px] text-neutral-400">{selectedUser.uid.substring(0, 8)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400 font-mono text-[10px] font-black uppercase">Admin Profile</span>
                  <span className="font-mono text-[10px] font-bold text-neutral-600">
                    {selectedUser.isSuperAdmin ? 'Platform Admin' : 'Customer Account'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick playground controls */}
            <div className="space-y-2 pt-1">
              <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block font-mono">
                Audit Controls
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleSimulateAIRequest}
                  className="flex items-center justify-center gap-1.5 p-2 bg-[#F27D26]/10 border border-[#F27D26]/20 hover:bg-[#F27D26]/20 text-[#F27D26] rounded-xl text-[10px] font-black uppercase tracking-wider transition font-mono"
                >
                  <Zap size={11} />
                  AI Request +1
                </button>
                <button
                  onClick={handleResetAIQuota}
                  className="flex items-center justify-center gap-1.5 p-2 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition font-mono"
                >
                  <RefreshCw size={11} />
                  Reset AI
                </button>
                <button
                  onClick={handleSimulateAddGear}
                  className="flex items-center justify-center gap-1.5 p-2 bg-[#10b981]/10 border border-[#10b981]/20 hover:bg-[#10b981]/20 text-[#10b981] rounded-xl text-[10px] font-black uppercase tracking-wider transition font-mono"
                >
                  <Plus size={11} />
                  Add Gear +1
                </button>
                <button
                  onClick={handleRemoveSimulatedGear}
                  className="flex items-center justify-center gap-1.5 p-2 bg-rose-50 hover:bg-rose-100 border border-rose-150 text-rose-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition font-mono"
                >
                  <Trash2 size={11} />
                  Del Gear -1
                </button>
              </div>
            </div>

          </div>

          {/* Progress bars monitors */}
          <div className="md:col-span-3 space-y-6 flex flex-col justify-center">
            
            {/* AI Tokens Metric */}
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <div className="flex items-center gap-1.5">
                  <div className="p-1 px-1.5 bg-[#F27D26]/10 text-[#F27D26] rounded text-xs font-black uppercase flex items-center gap-1 font-mono">
                    <Zap size={11} />
                    Fiji-AI Tokens
                  </div>
                  <span className="text-[10px] text-neutral-400 font-mono font-medium">Monthly limit</span>
                </div>
                <div className="text-right font-mono text-neutral-500 text-xs">
                  <strong className="text-neutral-900 font-black">{usage.currentTokens}</strong>
                  <span className="mx-1">/</span>
                  <span className="font-bold">{usage.limitTokens === Infinity ? 'Unlimited' : usage.limitTokens}</span>
                </div>
              </div>
              
              {/* Progress Bar Container */}
              <div className="relative w-full h-3 bg-neutral-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${getPercentage(usage.currentTokens, usage.limitTokens)}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className={`h-full ${getProgressColor(getPercentage(usage.currentTokens, usage.limitTokens))}`}
                />
              </div>

              {/* Status footer with alert constraints */}
              <div className="flex justify-between items-center text-[10px] font-mono font-bold leading-none">
                <span className="text-neutral-400">
                  {getPercentage(usage.currentTokens, usage.limitTokens)}% Quota Consumed
                </span>
                
                {usage.currentTokens >= usage.limitTokens ? (
                  <span className="text-rose-600 flex items-center gap-1 uppercase">
                    <ShieldAlert size={12} />
                    Threshold Exhausted
                  </span>
                ) : getPercentage(usage.currentTokens, usage.limitTokens) > 80 ? (
                  <span className="text-[#F27D26] flex items-center gap-1 uppercase animate-pulse">
                    <ShieldAlert size={12} />
                    Approaching Limit
                  </span>
                ) : (
                  <span className="text-emerald-600 flex items-center gap-0.5">
                    <CheckCircle2 size={12} />
                    Safe Zone
                  </span>
                )}
              </div>
            </div>

            {/* Gear Items Metric */}
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <div className="flex items-center gap-1.5">
                  <div className="p-1 px-1.5 bg-[#10b981]/10 text-[#10b981] rounded text-xs font-black uppercase flex items-center gap-1 font-mono">
                    <Box size={11} />
                    Gear Assets
                  </div>
                  <span className="text-[10px] text-neutral-400 font-mono font-medium">Library capacity</span>
                </div>
                <div className="text-right font-mono text-neutral-500 text-xs font-medium">
                  <strong className="text-neutral-900 font-black">{usage.currentGear}</strong>
                  <span className="mx-1">/</span>
                  <span className="font-bold">{usage.limitGear === Infinity ? 'Unlimited' : usage.limitGear}</span>
                </div>
              </div>
              
              {/* Progress Bar Container */}
              <div className="relative w-full h-3 bg-neutral-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${getPercentage(usage.currentGear, usage.limitGear)}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className={`h-full ${getProgressColor(getPercentage(usage.currentGear, usage.limitGear))}`}
                />
              </div>

              {/* Status footer for gear items */}
              <div className="flex justify-between items-center text-[10px] font-mono font-bold leading-none">
                <span className="text-neutral-400">
                  {getPercentage(usage.currentGear, usage.limitGear)}% Capacity Filled
                </span>
                
                {usage.currentGear >= usage.limitGear ? (
                  <span className="text-rose-600 flex items-center gap-1 uppercase">
                    <ShieldAlert size={12} />
                    Storage Exhausted
                  </span>
                ) : getPercentage(usage.currentGear, usage.limitGear) > 80 ? (
                  <span className="text-[#F27D26] flex items-center gap-1 uppercase animate-pulse">
                    <ShieldAlert size={12} />
                    Approaching Capacity
                  </span>
                ) : (
                  <span className="text-[#10b981] flex items-center gap-0.5">
                    <CheckCircle2 size={12} />
                    Available Space
                  </span>
                )}
              </div>
            </div>

          </div>

        </div>
      ) : (
        <div className="py-12 text-center text-neutral-400 italic">
          No user profiles discovered inside organization space.
        </div>
      )}

    </div>
  );
}
