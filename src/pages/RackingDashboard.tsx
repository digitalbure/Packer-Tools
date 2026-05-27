import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { Plus, Trash2, ChevronRight, Clock, Box, X, Layout, Server, BarChart3, CheckCircle } from 'lucide-react';
import { db } from '../firebase';
import { UserProfile, Rack, AdminSettings, RackItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { checkLimit } from '../lib/limitUtils';
import { toast } from 'sonner';

export default function RackingDashboard({ user, adminSettings }: { user: UserProfile, adminSettings: AdminSettings | null }) {
  const [racks, setRacks] = useState<Rack[]>([]);
  const [rackItemsMap, setRackItemsMap] = useState<Record<string, RackItem[]>>({});
  const [chartView, setChartView] = useState<'utilization' | 'occupancy'>('utilization');
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newRackName, setNewRackName] = useState('');
  const [newRackUnits, setNewRackUnits] = useState(12);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, 'racks'), where('ownerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRacks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Rack[];
      setRacks(fetchedRacks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user.uid]);

  useEffect(() => {
    if (loading || racks.length === 0) return;

    const unsubscribes = racks.map((rack) => {
      const q = query(collection(db, 'racks', rack.id, 'items'));
      return onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as RackItem[];
        setRackItemsMap(prev => ({
          ...prev,
          [rack.id]: items
        }));
      });
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [racks, loading]);

  const handleCreateRack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRackName.trim()) return;

    const limitCheck = await checkLimit(user, adminSettings, 'racks');
    if (!limitCheck.allowed) {
      toast.error(`Limit reached: You can only have ${limitCheck.limit} racks on the ${user.plan} plan.`);
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'racks'), {
        ownerId: user.uid,
        name: newRackName,
        description: '',
        totalUnits: newRackUnits,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setNewRackName('');
      setNewRackUnits(12);
      setIsCreating(false);
      navigate(`/rack/${docRef.id}`);
    } catch (error) {
      console.error("Error creating rack:", error);
    }
  };

  const handleDeleteRack = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this rack?")) {
      try {
        await deleteDoc(doc(db, 'racks', id));
      } catch (error) {
        console.error("Error deleting rack:", error);
      }
    }
  };

  return (
    <div className="space-y-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tight">Rack Management</h1>
          <p className="text-neutral-500">Design and track your equipment racks for events and installations.</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-1 transition"
        >
          <Plus size={20} />
          <span>New Rack</span>
        </button>
      </header>

      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => setIsCreating(false)}
                className="absolute top-6 right-6 p-2 text-neutral-400 hover:text-neutral-600 transition"
              >
                <X size={20} />
              </button>
              <h2 className="text-2xl font-bold mb-6">Create New Rack</h2>
              <form onSubmit={handleCreateRack} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Rack Name</label>
                  <input
                    type="text"
                    autoFocus
                    value={newRackName}
                    onChange={(e) => setNewRackName(e.target.value)}
                    placeholder="e.g. Main FOH Rack"
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Total Units (U)</label>
                  <select
                    value={newRackUnits}
                    onChange={(e) => setNewRackUnits(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                  >
                    {[2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 42, 48].map(u => (
                      <option key={u} value={u}>{u}U Rack</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="flex-1 py-3 bg-neutral-100 text-neutral-600 rounded-xl font-bold hover:bg-neutral-200 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 transition shadow-lg"
                  >
                    Create
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Analytics & Space Utilization Overview */}
      {!loading && racks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 md:p-8 rounded-[2rem] border border-neutral-100 shadow-sm space-y-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold flex items-center gap-2 text-neutral-900">
                <BarChart3 className="text-primary" size={20} />
                U-Space Utilization Analytics
              </h2>
              <p className="text-sm text-neutral-500">
                Identify under-utilized storage space across all active equipment racks.
              </p>
            </div>
            
            {/* Chart controls toggle */}
            <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl self-start sm:self-center">
              <button
                type="button"
                onClick={() => setChartView('utilization')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  chartView === 'utilization'
                    ? 'bg-white text-neutral-950 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                Utilization (%)
              </button>
              <button
                type="button"
                onClick={() => setChartView('occupancy')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  chartView === 'occupancy'
                    ? 'bg-white text-neutral-950 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                Detailed Occupancy (U)
              </button>
            </div>
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {(() => {
              // Compute global statistics
              let totalRackUnits = 0;
              let totalOccupiedUnits = 0;
              let totalComponentsCount = 0;

              racks.forEach(rack => {
                totalRackUnits += rack.totalUnits;
                const items = rackItemsMap[rack.id] || [];
                totalComponentsCount += items.length;

                // Unique occupied slots
                const occupiedSlots = new Set<number>();
                items.forEach(item => {
                  const start = item.uPosition;
                  const height = item.uHeight || 1;
                  for (let u = start; u < start + height; u++) {
                    if (u >= 1 && u <= rack.totalUnits) {
                      occupiedSlots.add(u);
                    }
                  }
                });
                totalOccupiedUnits += occupiedSlots.size;
              });

              const overallPercent = totalRackUnits > 0 ? Math.round((totalOccupiedUnits / totalRackUnits) * 100) : 0;
              const totalFreeUnits = Math.max(0, totalRackUnits - totalOccupiedUnits);

              // Find the under-utilized rack (minimum non-100% or highest available space)
              let mostUnderUtilizedName = "None";
              let minPercent = 1000;
              racks.forEach(rack => {
                const items = rackItemsMap[rack.id] || [];
                const occupiedSlots = new Set<number>();
                items.forEach(item => {
                  const start = item.uPosition;
                  const height = item.uHeight || 1;
                  for (let u = start; u < start + height; u++) {
                    if (u >= 1 && u <= rack.totalUnits) {
                      occupiedSlots.add(u);
                    }
                  }
                });
                const pct = rack.totalUnits > 0 ? Math.round((occupiedSlots.size / rack.totalUnits) * 100) : 0;
                if (pct < minPercent) {
                  minPercent = pct;
                  mostUnderUtilizedName = rack.name;
                }
              });

              return (
                <>
                  <div className="bg-neutral-50 p-4 rounded-2xl flex flex-col justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Total Asset Space</span>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className="text-2xl font-black text-neutral-900">{totalRackUnits}</span>
                      <span className="text-xs font-bold text-neutral-400">U</span>
                    </div>
                    <span className="text-[10px] text-neutral-500 mt-1">Across {racks.length} active racks</span>
                  </div>

                  <div className="bg-neutral-50 p-4 rounded-2xl flex flex-col justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Average Utilization</span>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className="text-2xl font-black text-neutral-900">{overallPercent}%</span>
                      <span className="text-xs font-bold text-neutral-400">used</span>
                    </div>
                    <span className="text-[10px] text-neutral-500 mt-1">{totalOccupiedUnits}U of {totalRackUnits}U occupied</span>
                  </div>

                  <div className="bg-neutral-50 p-4 rounded-2xl flex flex-col justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Total Mounted Items</span>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className="text-2xl font-black text-neutral-905">{totalComponentsCount}</span>
                      <span className="text-xs font-bold text-neutral-400">components</span>
                    </div>
                    <span className="text-[10px] text-neutral-500 mt-1">AV and IT hardware components</span>
                  </div>

                  <div className="bg-neutral-50 p-4 rounded-2xl flex flex-col justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Most Available</span>
                    <div className="mt-1">
                      <span className="text-xs font-bold text-neutral-800 line-clamp-1">{mostUnderUtilizedName}</span>
                    </div>
                    <span className="text-[10px] text-neutral-500 mt-1">({minPercent === 1000 ? 0 : minPercent}% utilized)</span>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Recharts Bar Chart and Legend */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="col-span-1 lg:col-span-2 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400">Racks Space Allocation</h3>
              <div className="h-64 relative w-full">
                {(() => {
                  // Prepare data for the chart
                  const chartData = racks.map(rack => {
                    const items = rackItemsMap[rack.id] || [];
                    const total = rack.totalUnits;
                    
                    // Unique occupied slots in the rack
                    const occupiedSlots = new Set<number>();
                    items.forEach(item => {
                      const start = item.uPosition;
                      const height = item.uHeight || 1;
                      for (let u = start; u < start + height; u++) {
                        if (u >= 1 && u <= total) {
                          occupiedSlots.add(u);
                        }
                      }
                    });

                    const used = occupiedSlots.size;
                    const available = Math.max(0, total - used);
                    const percent = total > 0 ? Math.round((used / total) * 100) : 0;

                    return {
                      name: rack.name,
                      percent,
                      used,
                      available,
                      total,
                      // Color encoding: orange/red for high utilization, grey for under, green for moderate
                      color: percent > 85 ? '#f97316' : percent < 30 ? '#a3a3a3' : '#10b981'
                    };
                  }).reverse(); // Show order nicely

                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      {chartView === 'utilization' ? (
                        <BarChart 
                          layout="vertical" 
                          data={chartData}
                          margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f5f5f5" />
                          <XAxis 
                            type="number" 
                            domain={[0, 100]} 
                            unit="%" 
                            fontSize={10} 
                            axisLine={false} 
                            tickLine={false} 
                            stroke="#888888"
                          />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            width={110} 
                            fontSize={10} 
                            axisLine={false} 
                            tickLine={false} 
                            stroke="#888888"
                            tickFormatter={(value) => value.length > 15 ? value.substring(0, 12) + '...' : value}
                          />
                          <Tooltip 
                            cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }} 
                            contentStyle={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #f0f0f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '11px' }}
                            formatter={(val) => [`${val}%`, 'Space Occupied']} 
                          />
                          <Bar dataKey="percent" name="Space Occupied (%)" radius={[0, 8, 8, 0]} barSize={16}>
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      ) : (
                        <BarChart 
                          layout="vertical" 
                          data={chartData}
                          margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f5f5f5" />
                          <XAxis 
                            type="number" 
                            fontSize={10} 
                            axisLine={false} 
                            tickLine={false} 
                            stroke="#888888"
                          />
                          <YAxis 
                            dataKey="name" 
                            type="category" 
                            width={110} 
                            fontSize={10} 
                            axisLine={false} 
                            tickLine={false} 
                            stroke="#888888"
                            tickFormatter={(value) => value.length > 15 ? value.substring(0, 12) + '...' : value}
                          />
                          <Tooltip 
                            cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }} 
                            contentStyle={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #f0f0f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: '11px' }}
                          />
                          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                          <Bar dataKey="used" name="Used U-space" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} barSize={16} />
                          <Bar dataKey="available" name="Available U-space" stackId="a" fill="#e5e5e5" radius={[0, 8, 8, 0]} barSize={16} />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  );
                })()}
              </div>
            </div>

            {/* Advisory column on underutilization */}
            <div className="col-span-1 border-t lg:border-t-0 lg:border-l border-neutral-100 pt-8 lg:pt-0 lg:pl-8 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400">Rack Optimization Advisory</h3>
                <div className="space-y-3">
                  {(() => {
                    const underUtilizedRacks = racks.map(rack => {
                      const items = rackItemsMap[rack.id] || [];
                      const occupiedSlots = new Set<number>();
                      items.forEach(item => {
                        const start = item.uPosition;
                        const height = item.uHeight || 1;
                        for (let u = start; u < start + height; u++) {
                          if (u >= 1 && u <= rack.totalUnits) {
                            occupiedSlots.add(u);
                          }
                        }
                      });
                      const pct = rack.totalUnits > 0 ? Math.round((occupiedSlots.size / rack.totalUnits) * 100) : 0;
                      return {
                        id: rack.id,
                        name: rack.name,
                        percent: pct,
                        free: Math.max(0, rack.totalUnits - occupiedSlots.size)
                      };
                    }).filter(r => r.percent < 50);

                    if (underUtilizedRacks.length === 0) {
                      return (
                        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex gap-3 text-emerald-800">
                          <CheckCircle className="shrink-0 mt-0.5 text-emerald-600" size={16} />
                          <div>
                            <p className="text-xs font-bold">Excellent Space Efficiency!</p>
                            <p className="text-[10px] text-emerald-600 mt-0.5">All your racks are utilizing at least 50% of their physical space efficiently.</p>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2">
                        <p className="text-xs text-neutral-500 font-medium">
                          The following racks are under 50% capacity and have open space for more gear:
                        </p>
                        <div className="max-h-36 overflow-y-auto space-y-2 pr-1">
                          {underUtilizedRacks.map(r => (
                            <Link
                              key={r.id}
                              to={`/rack/${r.id}`}
                              className="flex items-center justify-between p-3 bg-neutral-50 hover:bg-neutral-100 border border-neutral-100 rounded-xl transition group text-xs text-neutral-800"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <Server size={14} className="text-neutral-400 group-hover:text-primary transition-colors" />
                                <span className="font-bold truncate text-neutral-700">{r.name}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 font-bold">
                                <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-[10px] font-black">{r.percent}% used</span>
                                <span className="text-neutral-400">({r.free}U free)</span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="pt-4 border-t border-neutral-50 flex flex-wrap items-center gap-4 text-[10px]">
                <div className="flex items-center gap-1.5 font-bold text-neutral-500">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block"></span>
                  <span>Active (30-85%)</span>
                </div>
                <div className="flex items-center gap-1.5 font-bold text-neutral-500">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f97316] block"></span>
                  <span>Critical (&gt;85%)</span>
                </div>
                <div className="flex items-center gap-1.5 font-bold text-neutral-500">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#a3a3a3] block"></span>
                  <span>Minimal (&lt;30%)</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-neutral-100 rounded-3xl animate-pulse"></div>
          ))}
        </div>
      ) : racks.length > 0 ? (
        <motion.div 
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: 0.1
              }
            }
          }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {racks.map((rack) => (
            <motion.div
              key={rack.id}
              variants={{
                hidden: { opacity: 0, y: 20 },
                show: { opacity: 1, y: 0 }
              }}
            >
              <Link
                to={`/rack/${rack.id}`}
                className="group block bg-white p-8 rounded-[2rem] border border-neutral-100 shadow-sm hover:shadow-xl transition-all duration-300 relative overflow-hidden h-full"
              >
                <div className="absolute top-0 right-0 p-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleDeleteRack(e, rack.id)}
                    className="p-2 text-neutral-400 hover:text-red-500 transition"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                
                <div className="space-y-6">
                  <div className="w-12 h-12 bg-neutral-50 rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <Server size={24} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold group-hover:text-primary transition-colors line-clamp-1">{rack.name}</h3>
                    <div className="flex items-center gap-4 text-sm text-neutral-400">
                      <div className="flex items-center gap-1">
                        <Layout size={14} />
                        <span>{rack.totalUnits}U</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        <span>{new Date(rack.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-primary font-bold text-sm">
                    <span>View Rack</span>
                    <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <div className="text-center py-24 bg-white rounded-[3rem] border border-dashed border-neutral-200">
          <div className="w-20 h-20 bg-neutral-50 rounded-full flex items-center justify-center text-neutral-300 mx-auto mb-6">
            <Server size={40} />
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">No racks yet</h2>
          <p className="text-neutral-500 mb-8">Start designing your first equipment rack.</p>
          <button
            onClick={() => setIsCreating(true)}
            className="px-8 py-4 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition shadow-lg"
          >
            Create Your First Rack
          </button>
        </div>
      )}
    </div>
  );
}
