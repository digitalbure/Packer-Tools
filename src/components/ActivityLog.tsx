import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  limit 
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Plus, 
  Trash2, 
  ArrowRightLeft, 
  Package, 
  Clock, 
  Search, 
  Filter,
  CheckCircle2,
  ListRestart,
  Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ActivityItem {
  id: string;
  userId: string;
  userName: string;
  actionType: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface ActivityLogProps {
  user: {
    uid: string;
    displayName?: string;
    email?: string;
  };
}

export default function ActivityLog({ user }: ActivityLogProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    if (!user?.uid) return;

    const colRef = collection(db, 'activityLogs');
    const q = query(
      colRef,
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: ActivityItem[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as ActivityItem);
      });
      setActivities(items);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to activity logs:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Map actionType to icon & theme colour
  const getActionTypeStyling = (actionType: string) => {
    switch (actionType) {
      case 'gear_add':
        return {
          icon: <Plus size={14} className="stroke-[3]" />,
          color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200/50',
          badge: 'Gear Added'
        };
      case 'gear_delete':
        return {
          icon: <Trash2 size={14} />,
          color: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200/50',
          badge: 'Gear Removed'
        };
      case 'gear_status_change':
        return {
          icon: <ArrowRightLeft size={14} />,
          color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200/50',
          badge: 'Gear Status'
        };
      case 'list_add':
        return {
          icon: <Plus size={14} className="stroke-[3]" />,
          color: 'bg-indigo-150 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200/50',
          badge: 'List Created'
        };
      case 'list_delete':
        return {
          icon: <Trash2 size={14} />,
          color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border border-red-200/50',
          badge: 'List Deleted'
        };
      case 'list_status_change':
        return {
          icon: <CheckCircle2 size={14} />,
          color: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200/50',
          badge: 'List Status'
        };
      default:
        return {
          icon: <Package size={14} />,
          color: 'bg-neutral-100 text-neutral-700 border border-neutral-200/50',
          badge: 'System Action'
        };
    }
  };

  const getRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHrs = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHrs / 24);

      if (diffMs < 0) return 'Just now';
      if (diffSec < 60) return `${diffSec}s ago`;
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHrs < 24) return `${diffHrs}h ago`;
      if (diffDays === 1) return 'Yesterday';
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const filteredActivities = activities.filter((activity) => {
    // Search query match
    const matchesSearch = searchQuery.trim() === '' || 
      activity.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (activity.userName && activity.userName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      activity.actionType.toLowerCase().includes(searchQuery.toLowerCase());

    // Filter type match
    if (filterType === 'all') return matchesSearch;
    if (filterType === 'gear') return matchesSearch && activity.actionType.startsWith('gear');
    if (filterType === 'list') return matchesSearch && activity.actionType.startsWith('list');
    return matchesSearch;
  });

  return (
    <div className="bg-white rounded-[2.5rem] border border-neutral-100/80 p-6 md:p-8 shadow-sm space-y-6 text-left">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-50">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-primary/10 text-primary border border-primary/10 px-2 text-[8px] font-black uppercase tracking-widest rounded-full py-0.5">
              Live Audits
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <h3 className="text-xl font-black text-neutral-900 tracking-tight">
            Activity Feed & Audit Trail
          </h3>
          <p className="text-xs text-neutral-450 font-semibold">
            Real-time telemetry logging of gear updates, list additions, and check-in/out procedures.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick toggle chips */}
          {['all', 'gear', 'list'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${
                filterType === type 
                  ? 'bg-neutral-950 text-white shadow-sm'
                  : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-600'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-neutral-400">
          <Search size={14} />
        </span>
        <input
          type="text"
          placeholder="Search activity history..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-neutral-50/60 border border-neutral-150 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary/20 placeholder-neutral-400"
        />
      </div>

      {/* Activities Feed */}
      <div className="relative max-h-[380px] overflow-y-auto pr-1 space-y-3.5 scrollbar-thin scrollbar-thumb-neutral-200">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-neutral-450 gap-2">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] font-mono font-bold tracking-widest uppercase animate-pulse">Initializing Streams...</span>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="py-16 text-center bg-neutral-50/40 rounded-3xl border border-dashed border-neutral-150">
            <p className="text-neutral-450 text-xs font-semibold">
              No recent logs match the active parameters.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {filteredActivities.map((activity, index) => {
                const styling = getActionTypeStyling(activity.actionType);
                return (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.3) }}
                    className="p-4 rounded-2.5xl bg-neutral-50/30 hover:bg-neutral-50/80 border border-neutral-100 transition-colors flex items-start gap-3 w-full"
                  >
                    <div className={`p-2 rounded-xl shrink-0 ${styling.color}`}>
                      {styling.icon}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-neutral-400 capitalize truncate">
                          {activity.userName}
                        </span>

                        <span className="text-[9px] font-mono text-neutral-400 font-bold shrink-0 flex items-center gap-1">
                          <Clock size={10} />
                          {getRelativeTime(activity.timestamp)}
                        </span>
                      </div>

                      <p className="text-xs font-extrabold text-neutral-900 leading-snug w-full break-words">
                        {activity.description}
                      </p>

                      {/* Metadata tag / asset details preview */}
                      {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {activity.metadata.assignee && (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-100 text-[8px] font-mono font-black uppercase px-2 py-0.5 rounded">
                              Assignee: {activity.metadata.assignee}
                            </span>
                          )}
                          {activity.metadata.status && (
                            <span className="inline-flex items-center gap-1 bg-neutral-150 text-neutral-700 text-[8px] font-mono font-black uppercase px-2 py-0.5 rounded">
                              Status: {activity.metadata.status}
                            </span>
                          )}
                          {activity.metadata.gearName && (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-100 text-[8px] font-mono font-black uppercase px-2 py-0.5 rounded truncate max-w-[200px]">
                              Gear: {activity.metadata.gearName}
                            </span>
                          )}
                          {activity.metadata.listName && (
                            <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-100 text-[8px] font-mono font-black uppercase px-2 py-0.5 rounded truncate max-w-[200px]">
                              List: {activity.metadata.listName}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
