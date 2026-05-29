import React, { useState, useEffect } from 'react';
import { Project, UserProfile, BuildItem } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  ShieldCheck, 
  AlertTriangle, 
  X, 
  Search, 
  ArrowRightLeft, 
  CheckCircle2, 
  Cpu, 
  Power, 
  Activity,
  ChevronRight,
  Info,
  Loader2,
  RefreshCw,
  Scale
} from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';

interface CompatibilityReport {
  status: 'COMPATIBLE' | 'WARNING' | 'INCOMPATIBLE';
  summary: string;
  issues: {
    severity: 'High' | 'Medium' | 'Low';
    description: string;
    affectedItems: string[];
  }[];
  recommendations: string[];
}

interface ComparisonResult {
  comparison: string;
  prosA: string[];
  prosB: string[];
  winner: string;
  tableData: {
    feature: string;
    valA: string;
    valB: string;
  }[];
}

interface CompatibilityWidgetProps {
  project: Project;
  user: UserProfile;
  items?: any[];
}

export default function CompatibilityWidget({ project, user, items: passedItems }: CompatibilityWidgetProps) {
  const [items, setItems] = useState<BuildItem[]>([]);
  const [report, setReport] = useState<CompatibilityReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Comparison state
  const [isComparing, setIsComparing] = useState(false);
  const [itemA, setItemA] = useState<BuildItem | null>(null);
  const [itemB, setItemB] = useState<BuildItem | null>(null);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [showComparisonModal, setShowComparisonModal] = useState(false);

  useEffect(() => {
    if (passedItems) {
      setItems(passedItems);
      return;
    }

    const q = query(
      collection(db, 'buildItems'),
      where('projectId', '==', project.id),
      where('ownerId', '==', user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as BuildItem)));
    });
    return unsub;
  }, [project.id, user.uid, passedItems]);

  const checkCompatibility = async () => {
    if (items.length < 2) {
      toast.error("Add at least two items to check compatibility");
      return;
    }
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/check-compatibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });
      const data = await res.json();
      setReport(data);
      toast.success("Compatibility analysis complete");
    } catch (e) {
      toast.error("Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runComparison = async () => {
    if (!itemA || !itemB) return;
    setIsComparing(true);
    try {
      const res = await fetch('/api/compare-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemA, itemB })
      });
      const data = await res.json();
      setComparison(data);
    } catch (e) {
      toast.error("Comparison failed");
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-2xl font-black uppercase tracking-tighter">System Intelligence</h3>
          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">AI-driven compatibility and technical verification</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setShowComparisonModal(true)}
            className="flex items-center gap-2 bg-neutral-100 text-neutral-600 px-6 py-3 rounded-2xl hover:bg-neutral-200 transition font-black uppercase text-[10px] tracking-widest"
          >
            <Scale size={16} />
            <span>Product Comparison</span>
          </button>
          <button 
            onClick={checkCompatibility}
            disabled={isAnalyzing}
            className="flex items-center gap-2 bg-neutral-900 text-white px-6 py-3 rounded-2xl hover:bg-black disabled:opacity-50 transition shadow-lg font-black uppercase text-[10px] tracking-widest"
          >
            {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            <span>{isAnalyzing ? 'Analyzing System...' : 'Verify Whole Build'}</span>
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Main Analysis Results */}
        <div className="lg:col-span-8">
          {report ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className={`p-8 rounded-[3rem] border-2 shadow-xl ${
                report.status === 'COMPATIBLE' ? 'bg-emerald-50 border-emerald-100 text-emerald-900' :
                report.status === 'WARNING' ? 'bg-amber-50 border-amber-100 text-amber-900' :
                'bg-red-50 border-red-100 text-red-900'
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      {report.status === 'COMPATIBLE' ? <CheckCircle2 className="text-emerald-500" /> :
                       report.status === 'WARNING' ? <AlertTriangle className="text-amber-500" /> :
                       <X className="text-red-500" />}
                      <h4 className="text-2xl font-black uppercase tracking-tighter italic">{report.status}</h4>
                    </div>
                    <p className="text-sm font-bold mt-4 leading-relaxed max-w-2xl opacity-80">{report.summary}</p>
                  </div>
                  <button onClick={() => setReport(null)} className="p-2 hover:bg-black/5 rounded-full"><RefreshCw size={20} /></button>
                </div>

                {report.issues.length > 0 && (
                  <div className="mt-8 space-y-4">
                     <p className="text-[10px] font-black uppercase tracking-widest opacity-50">Critical Observations</p>
                     <div className="grid gap-3">
                       {report.issues.map((issue, idx) => (
                         <div key={idx} className="bg-white/40 backdrop-blur-sm p-4 rounded-2xl border border-white/40 flex items-start gap-4">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              issue.severity === 'High' ? 'bg-red-500 text-white' : 
                              issue.severity === 'Medium' ? 'bg-amber-500 text-white' : 
                              'bg-neutral-500 text-white'
                            }`}>
                              <AlertTriangle size={16} />
                            </div>
                            <div>
                               <p className="text-xs font-bold">{issue.description}</p>
                               <div className="flex flex-wrap gap-2 mt-2">
                                 {issue.affectedItems.map(item => (
                                   <span key={item} className="text-[8px] font-black bg-black/10 px-2 py-0.5 rounded-full uppercase truncate max-w-[150px]">{item}</span>
                                 ))}
                               </div>
                            </div>
                         </div>
                       ))}
                     </div>
                  </div>
                )}
              </div>

              <div className="bg-white p-8 rounded-[3rem] border border-neutral-100 shadow-sm space-y-6">
                 <h4 className="text-xs font-black uppercase tracking-widest text-neutral-400 ml-4">Smart Recommendations</h4>
                 <div className="grid gap-4">
                   {report.recommendations.map((rec, idx) => (
                     <div key={idx} className="flex items-start gap-4 p-4 hover:bg-neutral-50 rounded-2xl transition">
                       <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
                          <Zap size={18} />
                       </div>
                       <p className="text-xs font-bold text-neutral-600 leading-relaxed pt-2">{rec}</p>
                     </div>
                   ))}
                 </div>
              </div>
            </motion.div>
          ) : (
            <div className="bg-neutral-50 border-2 border-dashed border-neutral-200 p-20 rounded-[4rem] text-center space-y-6">
               <div className="w-24 h-24 bg-white rounded-[2.5rem] shadow-sm flex items-center justify-center mx-auto text-neutral-200">
                  <Cpu size={48} className={isAnalyzing ? 'animate-pulse' : ''} />
               </div>
               <div className="space-y-2">
                 <h4 className="text-xl font-black uppercase tracking-tight text-neutral-400">Intelligence Engine Idle</h4>
                 <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest max-w-sm mx-auto">Click verify to run a deep technical audit on all equipment in your build sandbox.</p>
               </div>
               <button 
                 onClick={checkCompatibility}
                 className="px-8 py-4 bg-white border border-neutral-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-900 hover:text-white transition shadow-sm"
               >
                 Initialize Audit
               </button>
            </div>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="lg:col-span-4 space-y-6">
           <div className="bg-neutral-900 rounded-[3rem] p-8 text-white space-y-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-[60px] -mr-16 -mt-16" />
              
              <div className="space-y-2 relative">
                 <h4 className="text-lg font-black uppercase tracking-tighter italic">Technical Guardrails</h4>
                 <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Active Safety Checks</p>
              </div>

              <div className="space-y-4">
                 {[
                   { icon: <Power size={18} />, title: "VOLTAGE MISMATCH", desc: "Checks for 110v vs 240v conflicts across regions" },
                   { icon: <Activity size={18} />, title: "IO OPTIMIZATION", desc: "Ensures capture cards match switcher output types" },
                   { icon: <ShieldCheck size={18} />, title: "PROTOCOL SYNC", desc: "Validates NDI/SDI/SRT transport compatibility" }
                 ].map((check, i) => (
                   <div key={i} className="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/10 group hover:bg-white/10 transition-all">
                      <div className="text-primary group-hover:scale-110 transition">{check.icon}</div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">{check.title}</p>
                        <p className="text-[10px] font-bold text-neutral-400 leading-tight">{check.desc}</p>
                      </div>
                   </div>
                 ))}
              </div>

              <div className="pt-4 border-t border-white/5 relative">
                 <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20 flex items-center gap-3">
                    <Info size={16} className="text-primary" />
                    <p className="text-[9px] font-black text-primary/80 uppercase tracking-widest">Real-time data enabled</p>
                 </div>
              </div>
           </div>

           <div className="bg-white p-8 rounded-[2.5rem] border border-neutral-100 space-y-4 shadow-sm">
              <div className="w-12 h-12 bg-neutral-50 rounded-2xl flex items-center justify-center text-primary mb-2">
                 <Loader2 size={24} className="animate-spin text-neutral-200" />
              </div>
              <h4 className="text-xs font-black uppercase tracking-widest">Firmware Checker</h4>
              <p className="text-[10px] font-bold text-neutral-400 leading-relaxed uppercase tracking-widest">
                Analyzes latest software/firmware versions for all devices to identify known bugs or compatibility patches.
              </p>
           </div>
        </div>
      </div>

      {/* Comparison Modal */}
      <AnimatePresence>
        {showComparisonModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               onClick={() => setShowComparisonModal(false)}
               className="absolute inset-0 bg-neutral-900/60 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-5xl bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center">
                       <ArrowRightLeft size={24} />
                    </div>
                    <div>
                       <h3 className="text-2xl font-black uppercase tracking-tighter">Product Comparison</h3>
                       <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Head-to-head technical analysis</p>
                    </div>
                 </div>
                 <button onClick={() => setShowComparisonModal(false)} className="p-3 hover:bg-white rounded-full transition shadow-sm border border-neutral-100">
                   <X size={24} />
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto p-12 scrollbar-hide">
                {!comparison ? (
                  <div className="space-y-12">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                       {/* Selector A */}
                       <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-4">Subject Alpha</label>
                          <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-2">
                             {items.map(item => (
                               <button
                                 key={item.id}
                                 onClick={() => setItemA(item)}
                                 className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${itemA?.id === item.id ? 'bg-primary border-primary text-white shadow-lg' : 'bg-white border-neutral-100 hover:border-neutral-300'}`}
                               >
                                 <span className="font-bold text-sm truncate">{item.name}</span>
                                 {itemA?.id === item.id && <CheckCircle2 size={16} />}
                               </button>
                             ))}
                          </div>
                       </div>
                       
                       {/* Selector B */}
                       <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 ml-4">Subject Beta</label>
                          <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-2">
                             {items.map(item => (
                               <button
                                 key={item.id}
                                 onClick={() => setItemB(item)}
                                 className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${itemB?.id === item.id ? 'bg-primary border-primary text-white shadow-lg' : 'bg-white border-neutral-100 hover:border-neutral-300'}`}
                               >
                                 <span className="font-bold text-sm truncate">{item.name}</span>
                                 {itemB?.id === item.id && <CheckCircle2 size={16} />}
                               </button>
                             ))}
                          </div>
                       </div>
                    </div>

                    <div className="flex justify-center">
                       <button 
                         disabled={!itemA || !itemB || isComparing}
                         onClick={runComparison}
                         className="px-12 py-5 bg-neutral-900 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] shadow-2xl hover:scale-105 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-3"
                       >
                         {isComparing ? <Loader2 className="animate-spin" /> : <Zap />}
                         <span>Evaluate Matchup</span>
                       </button>
                    </div>
                  </div>
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
                    <div className="grid md:grid-cols-2 gap-8">
                       <div className="p-8 bg-neutral-50 rounded-[2.5rem] border border-neutral-100">
                          <h4 className="text-xl font-black uppercase tracking-tighter mb-4 text-primary">{itemA?.name}</h4>
                          <div className="space-y-3">
                             {comparison.prosA.map((pro, i) => (
                               <div key={i} className="flex items-center gap-3 text-xs font-bold text-neutral-600">
                                 <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                 {pro}
                               </div>
                             ))}
                          </div>
                       </div>
                       <div className="p-8 bg-neutral-50 rounded-[2.5rem] border border-neutral-100">
                          <h4 className="text-xl font-black uppercase tracking-tighter mb-4 text-neutral-400">{itemB?.name}</h4>
                          <div className="space-y-3">
                             {comparison.prosB.map((pro, i) => (
                               <div key={i} className="flex items-center gap-3 text-xs font-bold text-neutral-600">
                                 <div className="w-1.5 h-1.5 bg-neutral-300 rounded-full" />
                                 {pro}
                               </div>
                             ))}
                          </div>
                       </div>
                    </div>

                    <div className="bg-white rounded-[2.5rem] border border-neutral-100 overflow-hidden">
                       <table className="w-full text-left">
                          <thead>
                             <tr className="bg-neutral-50">
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-neutral-400">Spec</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-neutral-400">{itemA?.brand} {itemA?.model}</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-neutral-400">{itemB?.brand} {itemB?.model}</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-50 font-bold text-xs uppercase">
                             {comparison.tableData.map((row, i) => (
                               <tr key={i}>
                                  <td className="px-8 py-5 text-neutral-400">{row.feature}</td>
                                  <td className="px-8 py-5">{row.valA}</td>
                                  <td className="px-8 py-5">{row.valB}</td>
                               </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>

                    <div className="flex justify-center flex-col items-center gap-6">
                       <div className="bg-emerald-50 px-8 py-3 rounded-full text-emerald-600 text-[10px] font-black uppercase tracking-widest shadow-sm">
                         Winner: {comparison.winner}
                       </div>
                       <p className="text-sm font-bold text-neutral-500 max-w-2xl text-center leading-relaxed">
                         {comparison.comparison}
                       </p>
                       <button onClick={() => { setComparison(null); setItemA(null); setItemB(null); }} className="text-neutral-400 hover:text-primary transition font-black uppercase text-[10px] tracking-widest">Start New Comparison</button>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
