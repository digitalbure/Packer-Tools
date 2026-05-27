import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, PackingList, Contact, AdminSettings } from '../types';
import { 
  Package, 
  Users, 
  Truck, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Search, 
  Filter, 
  ChevronRight, 
  ArrowRight,
  Plus,
  BarChart3,
  ShieldCheck,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';

export default function LogisticsDashboard({ user, adminSettings }: { user: UserProfile, adminSettings: AdminSettings | null }) {
  const [lists, setLists] = useState<PackingList[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    // Fetch all packing lists for the user
    const qLists = query(collection(db, 'packingLists'), where('ownerId', '==', user.uid));
    const unsubscribeLists = onSnapshot(qLists, (snapshot) => {
      const fetchedLists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PackingList[];
      // Only keep lists that are assigned to a recipient (distributions)
      setLists(fetchedLists.filter(l => l.recipientId));
    });

    // Fetch contacts to map recipient names
    const qContacts = query(collection(db, 'contacts'), where('ownerId', '==', user.uid));
    const unsubscribeContacts = onSnapshot(qContacts, (snapshot) => {
      const fetchedContacts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Contact[];
      setContacts(fetchedContacts);
      setLoading(false);
    });

    return () => {
      unsubscribeLists();
      unsubscribeContacts();
    };
  }, [user.uid]);

  const stats = useMemo(() => {
    return {
      total: lists.length,
      active: lists.filter(l => l.status === 'Active').length,
      sent: lists.filter(l => l.status === 'Sent').length,
      received: lists.filter(l => l.status === 'Received').length,
      completed: lists.filter(l => l.status === 'Completed').length,
    };
  }, [lists]);

  const filteredLists = useMemo(() => {
    return lists.filter(list => {
      const recipient = contacts.find(c => c.id === list.recipientId);
      const matchesSearch = 
        list.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        recipient?.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || list.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [lists, contacts, searchQuery, statusFilter]);

  const isPro = user.plan === 'pro' || user.plan === 'enterprise';
  const distributionLimit = 10;
  const currentDistributions = lists.length;
  const limitProgress = Math.min((currentDistributions / distributionLimit) * 100, 100);

  if (!isPro && currentDistributions > 0) {
    // We still show the dashboard but with a paywall if they exceed or are near limit
  }

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-widest text-xs">
            <ShieldCheck size={14} />
            <span>Pro Module</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight">Logistics Dashboard</h1>
          <p className="text-neutral-500 font-medium">Track kit distribution and deployment status across your entire team.</p>
        </div>
        
        {!isPro && (
          <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center gap-4 max-w-sm">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
              <Lock size={24} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-amber-900">Free Tier Limit</p>
              <div className="w-full bg-amber-200 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-amber-600 h-full transition-all duration-500" 
                  style={{ width: `${limitProgress}%` }}
                />
              </div>
              <p className="text-[10px] text-amber-700 font-medium">
                {currentDistributions} / {distributionLimit} Distributions used. Upgrade to Pro for unlimited.
              </p>
            </div>
          </div>
        )}
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Kits', value: stats.total, icon: Package, color: 'bg-neutral-100 text-neutral-600' },
          { label: 'Active', value: stats.active, icon: Clock, color: 'bg-blue-100 text-blue-600' },
          { label: 'In Transit', value: stats.sent, icon: Truck, color: 'bg-amber-100 text-amber-600' },
          { label: 'Received', value: stats.received, icon: CheckCircle2, color: 'bg-green-100 text-green-600' },
          { label: 'Completed', value: stats.completed, icon: BarChart3, color: 'bg-indigo-100 text-indigo-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm space-y-4">
            <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center`}>
              <stat.icon size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{stat.label}</p>
              <p className="text-3xl font-black">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
          <input
            type="text"
            placeholder="Search by kit name or recipient..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-neutral-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-primary outline-none transition"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          {['all', 'Draft', 'Active', 'Sent', 'Received', 'Completed'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-6 py-4 rounded-2xl font-bold whitespace-nowrap transition ${
                statusFilter === status 
                  ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                  : 'bg-white text-neutral-500 border border-neutral-100 hover:bg-neutral-50'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Distributions List */}
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-neutral-100 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : filteredLists.length > 0 ? (
          <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-bottom border-neutral-50">
                    <th className="px-8 py-6 text-xs font-black text-neutral-400 uppercase tracking-widest">Kit / Package</th>
                    <th className="px-8 py-6 text-xs font-black text-neutral-400 uppercase tracking-widest">Recipient</th>
                    <th className="px-8 py-6 text-xs font-black text-neutral-400 uppercase tracking-widest">Status</th>
                    <th className="px-8 py-6 text-xs font-black text-neutral-400 uppercase tracking-widest">Custom Fields</th>
                    <th className="px-8 py-6 text-xs font-black text-neutral-400 uppercase tracking-widest text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {filteredLists.map((list) => {
                    const recipient = contacts.find(c => c.id === list.recipientId);
                    return (
                      <tr key={list.id} className="group hover:bg-neutral-50/50 transition-colors">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                              <Package size={24} />
                            </div>
                            <div>
                              <p className="font-bold text-neutral-900">{list.name}</p>
                              <p className="text-xs text-neutral-400">Created {new Date(list.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-500">
                              <Users size={16} />
                            </div>
                            <span className="font-medium text-neutral-700">{recipient?.name || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            list.status === 'Completed' ? 'bg-green-100 text-green-700' :
                            list.status === 'Sent' ? 'bg-amber-100 text-amber-700' :
                            list.status === 'Active' ? 'bg-blue-100 text-blue-700' :
                            'bg-neutral-100 text-neutral-600'
                          }`}>
                            {list.status || 'Draft'}
                          </span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex flex-wrap gap-2">
                            {list.customFields && Object.entries(list.customFields).length > 0 ? (
                              Object.entries(list.customFields).map(([key, value], idx) => (
                                <div key={idx} className="px-2 py-1 bg-neutral-100 rounded-lg text-[10px] font-medium text-neutral-600">
                                  <span className="text-neutral-400 mr-1">{key}:</span>
                                  {value}
                                </div>
                              ))
                            ) : (
                              <span className="text-xs text-neutral-300 italic">No custom fields</span>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <Link
                            to={`/list/${list.id}`}
                            className="inline-flex items-center gap-2 text-primary font-bold text-sm hover:gap-3 transition-all"
                          >
                            Manage <ArrowRight size={16} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-[3rem] border border-dashed border-neutral-200">
            <div className="w-20 h-20 bg-neutral-50 rounded-full flex items-center justify-center text-neutral-300 mx-auto mb-6">
              <Truck size={40} />
            </div>
            <h2 className="text-2xl font-bold text-neutral-900 mb-2">No distributions found</h2>
            <p className="text-neutral-500 mb-8 max-w-sm mx-auto">
              Assign a packing list to a recipient in the list settings to start tracking deployments.
            </p>
            <Link
              to="/dashboard"
              className="px-8 py-4 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition shadow-lg"
            >
              Go to Dashboard
            </Link>
          </div>
        )}
      </div>

      {/* Pro Upsell for Free Users */}
      {!isPro && currentDistributions >= distributionLimit && (
        <div className="bg-neutral-900 text-white p-12 rounded-[3rem] text-center space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="relative space-y-4">
            <h2 className="text-3xl font-black">Unlock Full Logistics Power</h2>
            <p className="text-neutral-400 max-w-lg mx-auto">
              You've reached the free limit for kit distributions. Upgrade to Pro to manage unlimited team deployments, custom fields, and advanced tracking.
            </p>
            <Link
              to="/profile"
              className="inline-block px-10 py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition shadow-xl"
            >
              Upgrade to Pro
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
