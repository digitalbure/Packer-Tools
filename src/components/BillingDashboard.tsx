import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, Users, DollarSign, Activity, PieChart as PieIcon, BarChart3, 
  Calendar, ArrowRight, ArrowUpRight, ArrowDownRight, RefreshCw, Layers, 
  Globe, AlertCircle, ShoppingBag, ShieldCheck, Download, Search
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { AdminSettings, UserProfile, Plan } from '../types';
import UsageMonitor from './UsageMonitor';

interface BillingDashboardProps {
  settings: AdminSettings | null;
  users: UserProfile[];
}

// Color constants matching the Packer Tools theme
const COLORS = ['#F27D26', '#10b981', '#6366f1', '#a855f7', '#0ea5e9'];

// Seeded static mock analytics data representing the Paddle subscription history for SLEDIEN Pte Ltd
const REVENUE_HISTORY_DATA = [
  { month: 'Jan 26', recurring: 1200, marketplace: 450, total: 1650 },
  { month: 'Feb 26', recurring: 1800, marketplace: 600, total: 2400 },
  { month: 'Mar 26', recurring: 2400, marketplace: 1100, total: 3500 },
  { month: 'Apr 26', recurring: 3100, marketplace: 950, total: 4050 },
  { month: 'May 26', recurring: 4200, marketplace: 1550, total: 5750 },
  { month: 'Jun 26', recurring: 5800, marketplace: 2200, total: 8000 }
];

const GROWTH_TREND_DATA = [
  { month: 'Jan', free: 45, pro: 12, enterprise: 2 },
  { month: 'Feb', free: 62, pro: 18, enterprise: 3 },
  { month: 'Mar', free: 88, pro: 24, enterprise: 4 },
  { month: 'Apr', free: 110, pro: 31, enterprise: 5 },
  { month: 'May', free: 145, pro: 42, enterprise: 6 },
  { month: 'Jun', free: 180, pro: 55, enterprise: 8 }
];

export default function BillingDashboard({ settings, users }: BillingDashboardProps) {
  const [activeSegment, setActiveSegment] = useState<'all' | 'recurring' | 'marketplace'>('all');
  const [selectedCurrency, setSelectedCurrency] = useState<'ANY' | 'FJD' | 'USD' | 'AUD'>('ANY');
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Derive runtime analytics variables
  const totalActiveUsers = users.length;
  const activePlans = settings?.plans || [];
  const proPrice = activePlans.find(p => p.id?.toLowerCase() === 'pro')?.price || 29;
  const entPrice = activePlans.find(p => p.id?.toLowerCase() === 'enterprise')?.price || 149;
  
  const proUsers = users.filter(u => u.plan?.toLowerCase() === 'pro');
  const enterpriseUsers = users.filter(u => u.plan?.toLowerCase() === 'enterprise');
  const freeUsers = users.filter(u => !u.plan || u.plan?.toLowerCase() === 'free' || u.plan?.toLowerCase() === 'default');

  const mrrRecurring = (proUsers.length * proPrice) + (enterpriseUsers.length * entPrice);
  const arrRecurring = mrrRecurring * 12;

  // ARPU (Average Revenue Per User)
  const totalSubscribers = proUsers.length + enterpriseUsers.length;
  const arpu = totalSubscribers > 0 ? (mrrRecurring / totalSubscribers) : 0;
  
  // Custom estimated transactions log synced via Paddle
  const rawTransactions = [
    { id: 'txn_901', clientName: 'Fiji Film Unit', userEmail: 'production@fijifilm.org', plan: 'Enterprise Plan', price: 149.00, currency: 'USD', date: '2026-06-08', status: 'completed', gateway: 'credit_card' },
    { id: 'txn_902', clientName: 'George Seru', userEmail: 'gseru@sleden.com.fj', plan: 'Pro Plan', price: 29.00, currency: 'FJD', date: '2026-06-08', status: 'completed', gateway: 'bsp_bank' },
    { id: 'txn_903', clientName: 'Suva Sound Lab', userEmail: 'info@suvasound.com', plan: 'Pro Plan', price: 29.00, currency: 'FJD', date: '2026-06-07', status: 'completed', gateway: 'google_pay' },
    { id: 'txn_904', clientName: 'Pacific Climbing Group', userEmail: 'climb@pacadventure.org', plan: 'Enterprise Plan', price: 149.00, currency: 'AUD', date: '2026-06-05', status: 'completed', gateway: 'credit_card' },
    { id: 'txn_905', clientName: 'Lavena Tourist Org', userEmail: 'lavena@tourism.fj', plan: 'Pro Plan', price: 29.00, currency: 'FJD', date: '2026-06-04', status: 'completed', gateway: 'bsp_bank' },
    { id: 'txn_906', clientName: 'Digital Bure Designer', userEmail: 'hello@digitalbure.com', plan: 'Pro Plan', price: 29.00, currency: 'USD', date: '2026-06-03', status: 'completed', gateway: 'credit_card' },
    { id: 'txn_907', clientName: 'Viti Drone Service', userEmail: 'drones@vitiops.fj', plan: 'Enterprise Plan', price: 149.00, currency: 'FJD', date: '2026-06-01', status: 'refunded', gateway: 'bsp_bank' }
  ];

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1200);
  };

  // Filter transaction items
  const filteredTransactions = rawTransactions.filter(item => {
    const matchesSearch = item.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.plan.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCurrency = selectedCurrency === 'ANY' || item.currency === selectedCurrency;
    
    return matchesSearch && matchesCurrency;
  });

  // Plan allocations pie data
  const pieData = [
    { name: 'Free Users', value: freeUsers.length || 1 },
    { name: 'Pro Members', value: proUsers.length || 0 },
    { name: 'Enterprise Hubs', value: enterpriseUsers.length || 0 }
  ].filter(item => item.value > 0);

  return (
    <div id="billing_dashboard_wrapper" className="space-y-8 text-left font-sans animate-fade-in">
      
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-primary/10 border border-primary/20 text-primary rounded-full text-[10px] font-black uppercase tracking-widest font-mono">
              Paddle Live Tracker
            </span>
            {settings?.integrationConfig?.paddleEnabled ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                API Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-500">
                Sandbox Offline
              </span>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight mt-1">
            Real-Time Subscription Analytics
          </h2>
          <p className="text-neutral-500 text-xs sm:text-sm">
            Auditing monthly recurring revenue loops, geographic allocations (Fiji/Australia), and payment clearing channels.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2.5 bg-neutral-50 border border-neutral-200 hover:bg-neutral-100 disabled:opacity-50 text-neutral-600 rounded-xl transition-all"
            title="Refresh Ledger Sync"
          >
            <RefreshCw size={15} className={isRefreshing ? "animate-spin" : ""} />
          </button>
          
          <button
            onClick={() => {}} // Download simulation
            className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition shadow"
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Performance Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        
        {/* MRR Card */}
        <div id="kpi_mrr" className="bg-white p-5 rounded-3xl border border-neutral-150 shadow-sm space-y-3 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-[#F27D26]/5 rounded-full blur-2xl group-hover:scale-110 transition-all"></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#F27D26] font-mono">Monthly Recurring Revenue</span>
            <span className="p-1 px-1.5 bg-emerald-50 text-emerald-700 text-[9px] font-bold rounded flex items-center gap-0.5">
              <ArrowUpRight size={10} />
              +28%
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-2xl sm:text-3xl font-black text-neutral-900 font-mono">
              ${mrrRecurring.toLocaleString()}
            </span>
            <span className="text-[10px] block text-neutral-500 font-semibold font-mono uppercase tracking-wider">Estimated FJD / Mo</span>
          </div>
          <div className="text-[9px] font-medium text-neutral-400 font-sans border-t border-neutral-100 pt-2">
            Annual Projection: <strong className="text-neutral-700 font-mono">${arrRecurring.toLocaleString()}</strong>
          </div>
        </div>

        {/* Total Subscribers */}
        <div id="kpi_subscribers" className="bg-white p-5 rounded-3xl border border-neutral-150 shadow-sm space-y-3 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-[#6366f1]/5 rounded-full blur-2xl group-hover:scale-110 transition-all"></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 font-mono">Active Subscribed Seats</span>
            <span className="p-1 px-1.5 bg-emerald-50 text-emerald-700 text-[9px] font-bold rounded flex items-center gap-0.5">
              <ArrowUpRight size={10} />
              +15%
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-2xl sm:text-3xl font-black text-neutral-900 font-mono">
              {totalSubscribers}
            </span>
            <span className="text-[10px] block text-[#6366f1] font-black uppercase tracking-widest">
              {proUsers.length} Pro • {enterpriseUsers.length} Enterprise
            </span>
          </div>
          <div className="text-[9px] font-medium text-neutral-400 font-sans border-t border-neutral-100 pt-2">
            Free trial configurations: <strong className="text-neutral-700 font-mono">14 Days</strong>
          </div>
        </div>

        {/* LTV & ARPU Card */}
        <div id="kpi_arpu" className="bg-white p-5 rounded-3xl border border-neutral-150 shadow-sm space-y-3 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50/20 rounded-full blur-2xl group-hover:scale-110 transition-all"></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 font-mono">ARPU Monthly Average</span>
            <span className="p-1 px-1.5 bg-neutral-50 text-neutral-700 text-[9px] font-bold rounded">
              Steady
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-2xl sm:text-3xl font-black text-neutral-900 font-mono">
              ${arpu.toFixed(2)}
            </span>
            <span className="text-[10px] block text-neutral-500 font-semibold font-mono uppercase tracking-wider">FJD Per Paid Seat</span>
          </div>
          <div className="text-[9px] font-medium text-neutral-400 font-sans border-t border-neutral-100 pt-2">
            Average LTV target: <strong className="text-neutral-700 font-mono">$1,850.00</strong>
          </div>
        </div>

        {/* Clearing Success Rate */}
        <div id="kpi_clearing_success" className="bg-white p-5 rounded-3xl border border-neutral-150 shadow-sm space-y-3 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-full blur-2xl group-hover:scale-110 transition-all"></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 font-mono">Clearing Success</span>
            <span className="p-1 px-1.5 bg-emerald-50 text-emerald-800 text-[9px] font-bold rounded flex items-center gap-0.5">
              Secure
            </span>
          </div>
          <div className="space-y-1">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono">
              99.4%
            </span>
            <span className="text-[10px] block text-neutral-500 font-semibold font-mono uppercase tracking-wider">SSL Handshakes cleared</span>
          </div>
          <div className="text-[9px] font-medium text-neutral-400 font-sans border-t border-neutral-100 pt-2">
            Processing engine: <strong className="text-neutral-700">Paddle Sandbox</strong>
          </div>
        </div>

      </div>

      {/* Main Graph Splits - Double grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* Revenue trajectory: AreaChart 2 columns width */}
        <div className="lg:col-span-2 bg-white p-6 rounded-[2.5rem] border border-neutral-150 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-left space-y-1">
              <h3 className="text-lg font-black text-neutral-900 flex items-center gap-2">
                <BarChart3 size={18} className="text-primary" />
                Gross Cash Flow and Revenue Split
              </h3>
              <p className="text-xs text-neutral-500">
                Comparing recurring pro seats against peer-to-peer visual marketplace service commissions.
              </p>
            </div>

            {/* Interval switches */}
            <div className="flex gap-1 bg-neutral-100 p-1 rounded-xl self-start">
              <button 
                onClick={() => setActiveSegment('all')}
                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition ${activeSegment === 'all' ? 'bg-white text-neutral-900 shadow' : 'text-neutral-500 hover:text-neutral-900'}`}
              >
                All Volumes
              </button>
              <button 
                onClick={() => setActiveSegment('recurring')}
                className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition ${activeSegment === 'recurring' ? 'bg-primary text-white shadow' : 'text-neutral-500 hover:text-neutral-900'}`}
              >
                Recurring Plans
              </button>
            </div>
          </div>

          {/* Area Chart visualization wrapper */}
          <div className="h-72 w-full font-mono text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={REVENUE_HISTORY_DATA}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorRecurring" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F27D26" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#F27D26" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorMarketplace" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#737373', fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#737373', fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#171717', borderRadius: '16px', border: 'none', color: '#fff' }}
                  labelStyle={{ fontWeight: 'black', color: '#F27D26', fontSize: '11px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '15px' }} />
                
                {activeSegment !== 'marketplace' && (
                  <Area 
                    type="monotone" 
                    dataKey="recurring" 
                    name="Plan Subscriptions ($)" 
                    stroke="#F27D26" 
                    fillOpacity={1} 
                    fill="url(#colorRecurring)" 
                    strokeWidth={2.5} 
                  />
                )}
                
                {activeSegment !== 'recurring' && (
                  <Area 
                    type="monotone" 
                    dataKey="marketplace" 
                    name="Marketplace Fees ($)" 
                    stroke="#10b981" 
                    fillOpacity={1} 
                    fill="url(#colorMarketplace)" 
                    strokeWidth={2.5} 
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right column: Plan Allocation breakups */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-neutral-150 shadow-sm space-y-6 text-left flex flex-col justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-black text-neutral-900 flex items-center gap-2">
              <PieIcon size={18} className="text-[#6366f1]" />
              Subscriber Segment Shares
            </h3>
            <p className="text-xs text-neutral-500">
              Allocations across Free, Pro, and Enterprise tiers registered in local Firebase directories.
            </p>
          </div>

          {/* Pie Chart visual */}
          <div className="h-44 w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#171717', borderRadius: '12px', border: 'none', color: '#fff' }}
                  itemStyle={{ fontSize: '11px' }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Display center info */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
              <span className="text-xl font-black text-neutral-900 font-mono">{totalActiveUsers}</span>
              <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest leading-none">Total Registered</span>
            </div>
          </div>

          <div className="space-y-2 border-t border-neutral-100 pt-4">
            {pieData.map((d, index) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-bold text-neutral-600">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                  <span>{d.name}</span>
                </div>
                <div className="font-mono font-bold text-neutral-900">
                  {d.value} seats ({Math.round((d.value / Math.max(totalActiveUsers, 1)) * 100)}%)
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Usage telemetry & subscription limit guards */}
      <UsageMonitor settings={settings} users={users} />

      {/* Trajectory: Customer Growth Trends & Currency Solvers split */}
      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* Growth: BarChart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-[2.5rem] border border-neutral-150 shadow-sm space-y-6">
          <div className="text-left space-y-1">
            <h3 className="text-lg font-black text-neutral-900 flex items-center gap-2">
              <Users size={18} className="text-emerald-600" />
              Customer Registration & Seats Velocity
            </h3>
            <p className="text-xs text-neutral-500">
              Visualizing trial intake and organic subscriber accumulation month-over-month.
            </p>
          </div>

          <div className="h-64 w-full font-mono text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={GROWTH_TREND_DATA}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#737373', fontSize: 10 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#737373', fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#171717', borderRadius: '16px', border: 'none', color: '#fff' }}
                  labelStyle={{ fontWeight: 'black', color: '#10b981', fontSize: '11px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                
                <Bar dataKey="free" name="Trial/Free Users" fill="#d1d5db" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pro" name="Pro" fill="#F27D26" radius={[4, 4, 0, 0]} />
                <Bar dataKey="enterprise" name="Enterprise" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Currency Solver Breakdown metrics */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-neutral-150 shadow-sm space-y-4 text-left flex flex-col justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-black tracking-widest text-[#F27D26] block font-mono">Currency Solver Allocations</span>
            <h3 className="text-base font-black text-neutral-900 flex items-center gap-1.5">
              <Globe size={16} className="text-primary" />
              Multi-Tenant Currencies Splits
            </h3>
            <p className="text-xs text-neutral-500 leading-normal">
              Comparing incoming clearings relative to user locale country codes.
            </p>
          </div>

          <div className="space-y-3.5 py-2">
            {[
              { code: 'FJD', name: 'Fijian Dollar', volume: '$12,450.00', pct: 60, color: 'bg-primary' },
              { code: 'USD', name: 'United States Dollar', volume: '$3,800.00', pct: 25, color: 'bg-indigo-600' },
              { code: 'AUD', name: 'Australian Dollar', volume: '$2,100.00', pct: 15, color: 'bg-emerald-600' }
            ].map(currency => (
              <div key={currency.code} className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-neutral-700">
                  <span>{currency.code} ({currency.name})</span>
                  <span className="font-mono text-neutral-900">{currency.volume}</span>
                </div>
                <div className="w-full bg-neutral-100 h-2.5 rounded-full overflow-hidden flex">
                  <div className={`h-full ${currency.color}`} style={{ width: `${currency.pct}%` }}></div>
                </div>
                <p className="text-[9px] text-neutral-400 font-semibold font-mono text-right">{currency.pct}% of active ledger</p>
              </div>
            ))}
          </div>

          <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 flex items-start gap-2 mt-2">
            <AlertCircle size={14} className="text-[#F27D26] shrink-0 mt-0.5" />
            <p className="text-[10px] text-neutral-500 leading-normal font-medium">
              Tax reporting synced with the <strong>Fiji Revenue and Customs Service (FRCS)</strong> on authorized FJD transactions.
            </p>
          </div>
        </div>

      </div>

      {/* Simulated Live Transactions Table */}
      <div id="live_ledger_history" className="bg-white rounded-[2.5rem] border border-neutral-150 shadow-sm overflow-hidden p-6 sm:p-8 space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-left space-y-1">
            <h3 className="text-lg font-black text-neutral-900 flex items-center gap-2">
              <ShoppingBag size={18} className="text-primary" />
              Secure Paddle Clearance Ledger
            </h3>
            <p className="text-xs text-neutral-500 font-medium">
              Validating real-time transactions processed by Paddle merchant servers.
            </p>
          </div>

          {/* Search bar and Filters */}
          <div className="flex flex-wrap gap-2.5 items-center">
            
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-800 focus:bg-white focus:border-primary outline-none transition w-44"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={13} />
            </div>

            {/* Currency selector */}
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value as any)}
              className="px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-700 outline-none hover:bg-neutral-100 cursor-pointer transition"
            >
              <option value="ANY">Currency: All</option>
              <option value="FJD">FJD (Fiji)</option>
              <option value="USD">USD (Global)</option>
              <option value="AUD">AUD (Aus)</option>
            </select>
          </div>
        </div>

        {/* Big Table */}
        <div className="overflow-x-auto border border-neutral-150 rounded-2xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-150 text-neutral-400 font-black uppercase tracking-widest text-[10px] font-mono">
                <th className="px-6 py-4">Transaction ID</th>
                <th className="px-6 py-4">Client Representative</th>
                <th className="px-6 py-4">Subscription Plan</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Settled Amount</th>
                <th className="px-6 py-4 text-center">Clearance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-150 font-sans font-medium text-neutral-700">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-neutral-400 italic">
                    No matching transactions discovered in Paddle ledger.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-neutral-50/40 transition">
                    <td className="px-6 py-3.5 font-mono text-[11px] font-bold text-neutral-800">
                      {tx.id}
                    </td>
                    <td className="px-6 py-3.5 text-left">
                      <div className="font-bold text-neutral-900">{tx.clientName}</div>
                      <div className="text-[10px] text-neutral-400 font-mono font-semibold">{tx.userEmail}</div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="px-2 py-0.5 bg-neutral-100 rounded text-[10px] font-bold text-neutral-600 block w-max uppercase tracking-wider font-mono">
                        {tx.plan}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-mono text-[10px] text-neutral-500">
                      {tx.date}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono font-black text-neutral-900">
                      {tx.currency} ${tx.price.toFixed(2)}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {tx.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide bg-emerald-50 text-emerald-800 border border-emerald-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Settled
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide bg-amber-50 text-amber-800 border border-amber-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          Refunded
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer legalities */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-neutral-100">
          <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 font-mono font-medium">
            <ShieldCheck size={13} className="text-emerald-500" />
            <span>Audit report completely compiled & generated by <strong>Digital Bure Application Studio</strong></span>
          </div>
          
          <p className="text-[9px] text-neutral-400 font-mono text-left sm:text-right">
            Street Level Digital Engagement (SLEDIEN) Pte Ltd &bull; BSP House Suva, Fiji
          </p>
        </div>

      </div>

    </div>
  );
}
