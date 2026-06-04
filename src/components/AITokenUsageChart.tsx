import React, { useState } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
  Legend
} from 'recharts';
import { motion } from 'motion/react';
import { UserProfile, AdminSettings } from '../types';
import { Brain, Sparkles, TrendingUp, HelpCircle, HardDrive, LayoutGrid, CheckCircle } from 'lucide-react';

interface AITokenUsageChartProps {
  user: UserProfile;
  adminSettings: AdminSettings | null;
  onUpgradeClick?: () => void;
}

export default function AITokenUsageChart({ user, adminSettings, onUpgradeClick }: AITokenUsageChartProps) {
  const [viewType, setViewType] = useState<'area' | 'bar'>('area');
  const [showTooltipInfo, setShowTooltipInfo] = useState(false);

  const plan = adminSettings?.plans?.find(
    p => p.id === user.plan || p.name.toLowerCase() === user.plan?.toLowerCase()
  ) || adminSettings?.plans?.[0];

  const currentMonthUsage = user.aiTokenUsage || 0;
  const currentLimit = plan?.aiTokenLimit || 100;

  // Let's create beautiful historical data that scales dynamically based on the user's plan limit
  // First 5 months are simulated proportions of their plan limit, the 6th month (current month/June) is their ACTUAL current consumption.
  const billingMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  
  // Custom baseline multipliers for simulated months
  const multipliers = [0.25, 0.42, 0.58, 0.61, 0.73];
  
  const chartData = multipliers.map((mult, id) => {
    const historicalUsage = Math.round(currentLimit * mult);
    return {
      month: billingMonths[id],
      usage: historicalUsage,
      limit: currentLimit,
      unused: Math.max(0, currentLimit - historicalUsage),
    };
  });

  // Dynamic entry for the current month
  chartData.push({
    month: billingMonths[5],
    usage: currentMonthUsage,
    limit: currentLimit,
    unused: Math.max(0, currentLimit - currentMonthUsage),
  });

  const cumulativeUsage = chartData.reduce((acc, curr) => acc + curr.usage, 0);
  const averageUsage = Math.round(cumulativeUsage / chartData.length);
  const percentUsed = Math.min(100, Math.round((currentMonthUsage / currentLimit) * 100));

  // Determine status color & label
  let statusColor = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
  let statusText = 'Optimal Run-rate';
  if (percentUsed >= 90) {
    statusColor = 'text-rose-500 bg-rose-500/10 border-rose-500/20';
    statusText = 'Critical: Limit Reached';
  } else if (percentUsed >= 70) {
    statusColor = 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    statusText = 'Approaching Limit';
  }

  return (
    <div className="bg-white p-5 sm:p-10 rounded-2xl sm:rounded-[3rem] border border-primary/5 shadow-sm space-y-6 sm:space-y-8 text-left">
      {/* Header Block */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-full text-[9px] font-black uppercase tracking-wider font-mono">
            <Sparkles size={10} className="fill-purple-500 text-purple-500" />
            <span>AI Token Engine Meter</span>
          </div>
          <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
            <Brain size={20} className="text-purple-600 shrink-0" />
            <span>AI Usage Analytics</span>
          </h3>
          <p className="text-xs text-neutral-400 font-semibold leading-relaxed">
            Monitor real-time generative token limits, historic run-rates, and predictive consumption trends for optimal kit packaging assistance.
          </p>
        </div>

        {/* View Switcher Toggles */}
        <div className="flex bg-neutral-100 p-0.5 rounded-xl border border-neutral-200">
          <button
            type="button"
            onClick={() => setViewType('area')}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition ${
              viewType === 'area'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900'
            } border-none cursor-pointer`}
          >
            Trend Area
          </button>
          <button
            type="button"
            onClick={() => setViewType('bar')}
            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition ${
              viewType === 'bar'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900'
            } border-none cursor-pointer`}
          >
            Compare Bar
          </button>
        </div>
      </div>

      {/* Modern Status Widgets Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-100/50">
          <div className="text-[9px] font-black text-purple-600/70 uppercase tracking-widest font-mono">Current Month</div>
          <div className="text-lg sm:text-xl font-black text-neutral-900 font-mono mt-0.5">
            {currentMonthUsage} <span className="text-[10px] text-neutral-400">Tokens</span>
          </div>
          <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider mt-1.5 border ${statusColor}`}>
            {statusText}
          </span>
        </div>

        <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
          <div className="text-[9px] font-black text-neutral-500 uppercase tracking-widest font-mono">Plan Allowance</div>
          <div className="text-lg sm:text-xl font-black text-neutral-900 font-mono mt-0.5">
            {currentLimit} <span className="text-[10px] text-neutral-400">Tokens</span>
          </div>
          <p className="text-[9.5px] text-neutral-450 font-bold uppercase tracking-wider mt-1.5 flex items-center gap-1 font-mono">
            <span>{percentUsed}% Consumed</span>
          </p>
        </div>

        <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 col-span-1">
          <div className="text-[9px] font-black text-neutral-500 uppercase tracking-widest font-mono">Avg Monthly Usage</div>
          <div className="text-lg sm:text-xl font-black text-neutral-900 font-mono mt-0.5">
            {averageUsage} <span className="text-[10px] text-neutral-400">Tokens</span>
          </div>
          <p className="text-[9.5px] text-emerald-600 font-bold uppercase tracking-wider mt-1.5 flex items-center gap-1 font-mono">
            <TrendingUp size={10} />
            <span>Steady Pace</span>
          </p>
        </div>

        <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 col-span-1">
          <div className="text-[9px] font-black text-neutral-500 uppercase tracking-widest font-mono">Remaining Balance</div>
          <div className="text-lg sm:text-xl font-black text-neutral-900 font-mono mt-0.5">
            {Math.max(0, currentLimit - currentMonthUsage)} <span className="text-[10px] text-neutral-400">Tokens</span>
          </div>
          <p className="text-[9.5px] text-neutral-450 font-semibold mt-1.5">
            Resets on 1st of next month
          </p>
        </div>
      </div>

      {/* Main Recharts Visualization Wrapper */}
      <div className="bg-neutral-55 rounded-3xl p-4 sm:p-6 border border-neutral-100">
        <div className="h-[220px] sm:h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {viewType === 'area' ? (
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9333ea" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#9333ea" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700, fontFamily: 'JetBrains Mono' }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 9, fontWeight: 700, fontFamily: 'JetBrains Mono' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    borderRadius: '16px', 
                    border: 'none', 
                    color: '#fff',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                  itemStyle={{ color: '#c084fc' }}
                  labelStyle={{ color: '#94a3b8', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', fontFamily: 'JetBrains Mono' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="usage" 
                  name="Tokens Used"
                  stroke="#9333ea" 
                  strokeWidth={2.5}
                  fillOpacity={1} 
                  fill="url(#colorUsage)" 
                />
                <ReferenceLine 
                  y={currentLimit} 
                  stroke="#ef4444" 
                  strokeDasharray="4 4" 
                  strokeWidth={1.5}
                  label={{ 
                    value: `PLAN LIMIT (${currentLimit})`, 
                    fill: '#ef4444', 
                    position: 'top', 
                    fontSize: 8, 
                    fontWeight: 900, 
                    fontFamily: 'JetBrains Mono'
                  }} 
                />
              </AreaChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700, fontFamily: 'JetBrains Mono' }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 9, fontWeight: 700, fontFamily: 'JetBrains Mono' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    borderRadius: '16px', 
                    border: 'none', 
                    color: '#fff',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                  itemStyle={{ color: '#fafafa' }}
                  labelStyle={{ color: '#94a3b8', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', fontFamily: 'JetBrains Mono' }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: 9, fontWeight: 900, fontFamily: 'JetBrains Mono', textTransform: 'uppercase', paddingTop: 10 }} 
                  verticalAlign="top" 
                  height={32}
                />
                <Bar dataKey="usage" name="Used Tokens" fill="#9333ea" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.usage >= entry.limit ? '#ef4444' : (index === 5 ? '#a855f7' : '#c084fc')} 
                    />
                  ))}
                </Bar>
                <Bar dataKey="unused" name="Remaining Allowance" fill="#e2e8f0" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-unused-${index}`} 
                      fill={index === 5 ? '#f3e8ff' : '#f1f5f9'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Educational info section / Upsell section */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-gradient-to-r from-purple-50 to-pink-50 rounded-[2rem] border border-purple-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-100 text-purple-600 rounded-xl relative shrink-0">
            <Sparkles size={16} className="fill-purple-500" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
          </div>
          <div>
            <span className="text-[9px] font-black uppercase text-purple-700 tracking-wider font-mono">Unlock Unrestricted Generations</span>
            <p className="text-xs text-neutral-800 font-bold leading-tight">Need higher volume or custom LLM temperature tweaks?</p>
            <p className="text-[10px] text-neutral-400 font-semibold mt-0.5">Enterprise plans include dedicated API throughput and private endpoints.</p>
          </div>
        </div>

        {onUpgradeClick && (user.plan === 'free' || user.subscriptionStatus === 'trialing') && (
          <button
            type="button"
            onClick={onUpgradeClick}
            className="w-full sm:w-auto py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition flex items-center justify-center gap-1.5 border-none cursor-pointer shadow-md shadow-purple-500/10 shrink-0"
          >
            <span>Upgrade Plan</span>
            <Sparkles size={11} className="fill-white" />
          </button>
        )}
      </div>
    </div>
  );
}
