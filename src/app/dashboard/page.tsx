"use client";

import { useEffect, useState } from "react";
import { ChevronDown, IndianRupee, Ticket, Users, Clock, TrendingUp, Loader2, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, LabelList } from 'recharts';
import { supabase } from "@/utils/supabase";
import { ticketLineTotal, ticketQuantity } from "@/utils/ticket-counts";
import { resolvePassTargets } from "@/utils/pass-targets";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Sales Overview');
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    trustRevenue: 0,
    organizerRevenue: 0,
    totalTickets: 0,
    scannableTickets: 0,
    checkedIn: 0,
    activeOrganisers: 0,
    hasTickets: false,
    totalTarget: 2050
  });

  const [chartData, setChartData] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [organiserList, setOrganiserList] = useState<any[]>([]);
  const [allTickets, setAllTickets] = useState<any[]>([]);
  const [allOrganisers, setAllOrganisers] = useState<any[]>([]);

  // Filter States
  const [filterDate, setFilterDate] = useState('All Time');
  const [filterType, setFilterType] = useState('All Types');
  const [filterOrganiser, setFilterOrganiser] = useState('All Organisers');
  const [filterPayment, setFilterPayment] = useState('All Modes');

  const [role, setRole] = useState('organiser');

  useEffect(() => {
    setRole(localStorage.getItem('rhapsody_role') || 'organiser');
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const [ticketsRes, profilesRes] = await Promise.all([
          supabase.from("tickets").select("*"),
          supabase.from("profiles").select("*")
        ]);

        const tickets = ticketsRes.data || [];
        const profiles = profilesRes.data || [];
        
        const organisers = profiles.filter(p => {
           if (Array.isArray(p.roles)) return p.roles.includes('organiser');
           if (p.role) return p.role === 'organiser';
           return false;
        });

        setAllTickets(tickets);
        setAllOrganisers(organisers);
      } catch (error) {
        console.error("Error fetching admin data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    if (allTickets.length === 0 && allOrganisers.length === 0) return;

    // Filter tickets based on current states
    const filteredTickets = allTickets.filter(t => {
       const ticketDate = new Date(t.created_at);
       const now = new Date();
       
       let dateMatch = true;
       if (filterDate === 'Today') {
          dateMatch = ticketDate.toDateString() === now.toDateString();
       } else if (filterDate === 'Last 7 Days') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(now.getDate() - 7);
          dateMatch = ticketDate >= sevenDaysAgo;
       } else if (filterDate === 'This Month') {
          dateMatch = ticketDate.getMonth() === now.getMonth() && ticketDate.getFullYear() === now.getFullYear();
       }

       const typeMatch = filterType === 'All Types' || t.type === filterType;
       const orgMatch = filterOrganiser === 'All Organisers' || t.sold_by === filterOrganiser;
       const payMatch = filterPayment === 'All Modes' || t.payment_mode === filterPayment;
       
       return dateMatch && typeMatch && orgMatch && payMatch;
    });

    let totalRev = 0;
    let trustRev = 0;
    let organizerRev = 0;
    let checkInCount = 0;
    let scannableCount = 0;
    
    const typeCount = { 'Platinum': 0, 'Donor': 0, 'Student': 0 };
    const revCount = { 'Platinum': 0, 'Donor': 0, 'Student': 0 };
    const statusCount = { 'pending': 0, 'checked_in': 0, 'cancelled': 0 };

    filteredTickets.forEach(t => {
      const q = ticketQuantity(t);
      const lineTotal = ticketLineTotal(t);
      totalRev += lineTotal;
      if (t.funds_destination === 'trust') {
         trustRev += lineTotal;
      } else {
         organizerRev += lineTotal;
      }
      
      const isDonor = t.type === 'Donor Pass' || t.type === 'Donor';
      if (!isDonor) {
         scannableCount += q;
         if (t.status === 'checked_in') checkInCount += q;
         if (statusCount[t.status as keyof typeof statusCount] !== undefined) {
            statusCount[t.status as keyof typeof statusCount] += q;
         }
      }
      
      if (typeCount[t.type as keyof typeof typeCount] !== undefined) {
         typeCount[t.type as keyof typeof typeCount] += q;
         revCount[t.type as keyof typeof revCount] += lineTotal;
      }
    });

    const passesSold = filteredTickets.reduce((sum, t) => sum + ticketQuantity(t), 0);

    let targetPlatinum = 0;
    let targetDonor = 0;
    let targetStudent = 0;

    const organisersToCount = filterOrganiser === 'All Organisers' 
      ? allOrganisers 
      : allOrganisers.filter(o => o.name === filterOrganiser);

    organisersToCount.forEach(org => {
      const targets = resolvePassTargets(org.pass_targets);
      targetPlatinum += targets['Platinum Pass'] || 0;
      targetDonor += targets['Donor Pass'] || 0;
      targetStudent += targets['Student Pass'] || 0;
    });

    const totalTargetCount = targetPlatinum + targetDonor + targetStudent;

    setMetrics({
      totalRevenue: totalRev,
      trustRevenue: trustRev,
      organizerRevenue: organizerRev,
      totalTickets: passesSold,
      scannableTickets: scannableCount,
      checkedIn: checkInCount,
      activeOrganisers: allOrganisers.length,
      hasTickets: allTickets.length > 0,
      totalTarget: totalTargetCount
    });

    const data = [
      { name: 'Platinum Pass', Sold: typeCount['Platinum'] || 0, Target: targetPlatinum, Revenue: revCount['Platinum'] || 0 },
      { name: 'Donor Pass', Sold: typeCount['Donor'] || 0, Target: targetDonor, Revenue: revCount['Donor'] || 0 },
      { name: 'Student Pass', Sold: typeCount['Student'] || 0, Target: targetStudent, Revenue: revCount['Student'] || 0 },
    ];

    setChartData(data);

    setStatusData([
      { name: 'Pending', value: statusCount['pending'] },
      { name: 'Checked-in', value: statusCount['checked_in'] },
      { name: 'Cancelled', value: statusCount['cancelled'] },
    ]);

    // LeaderBoard ranking aggregated by person
    const orgSales: Record<string, { count: number, categories: Record<string, number> }> = {};
    
    allOrganisers.forEach(org => {
       orgSales[org.name] = { count: 0, categories: {} };
    });

    filteredTickets.forEach(t => {
       const q = ticketQuantity(t);
       if (t.sold_by && orgSales[t.sold_by]) {
          orgSales[t.sold_by].count += q;
          orgSales[t.sold_by].categories[t.type] = (orgSales[t.sold_by].categories[t.type] || 0) + q;
       }
    });

    setOrganiserList(allOrganisers.map((org) => {
       const sales = orgSales[org.name];
       return {
          name: org.name,
          platinum: sales?.categories['Platinum'] || 0,
          donor: sales?.categories['Donor'] || 0,
          student: sales?.categories['Student'] || 0,
          total: sales?.count || 0
       };
    }).sort((a,b) => b.total - a.total));

  }, [allTickets, allOrganisers, filterDate, filterType, filterOrganiser, filterPayment]);

  const checkInRate = metrics.scannableTickets > 0 ? ((metrics.checkedIn / metrics.scannableTickets) * 100).toFixed(1) : "0.0";
  const formattedRevenue = new Intl.NumberFormat('en-IN').format(metrics.totalRevenue);

  return (
    <div className="space-y-4 sm:space-y-5 max-w-7xl mx-auto">
      
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-secondary to-primary leading-tight">Dashboard</h1>
      </div>

      {loading ? (
        <div className="flex min-h-[10rem] items-center justify-center rounded-xl border border-pink-50 dark:border-violet-500/18 bg-white dark:bg-[var(--card-bg)]">
          <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 text-primary animate-spin" />
        </div>
      ) : (
        <>
          {/* Filters Card */}
          <div className="bg-white dark:bg-[var(--card-bg)] rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm border border-pink-50 dark:border-violet-500/18">
            <h3 className="text-xs font-bold text-secondary mb-3 uppercase tracking-wider">Filters</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
              
              <div className="min-w-0">
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-700 dark:text-violet-300 mb-1">Date</label>
                <div className="relative">
                   <select 
                     value={filterDate}
                     onChange={(e) => setFilterDate(e.target.value)}
                     className="w-full min-h-[44px] bg-[#fdfaff] dark:bg-violet-950/35 border border-pink-100 dark:border-violet-500/25 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm text-gray-900 dark:text-violet-100 font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                   >
                     <option>All Time</option>
                     <option>Today</option>
                     <option>Last 7 Days</option>
                     <option>This Month</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-primary absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="min-w-0">
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-700 dark:text-violet-300 mb-1">Type</label>
                <div className="relative">
                   <select 
                     value={filterType} 
                     onChange={(e) => setFilterType(e.target.value)}
                     className="w-full min-h-[44px] bg-[#fdfaff] dark:bg-violet-950/35 border border-pink-100 dark:border-violet-500/25 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm text-gray-900 dark:text-violet-100 font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                   >
                     <option>All Types</option>
                     <option value="Platinum">Platinum Pass</option>
                     <option value="Donor">Donor Pass</option>
                     <option value="Student">Student Pass</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-primary absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="min-w-0">
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-700 dark:text-violet-300 mb-1">Organiser</label>
                <div className="relative">
                   <select 
                     value={filterOrganiser} 
                     onChange={(e) => setFilterOrganiser(e.target.value)}
                     className="w-full min-h-[44px] bg-[#fdfaff] dark:bg-violet-950/35 border border-pink-100 dark:border-violet-500/25 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm text-gray-900 dark:text-violet-100 font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                   >
                     <option>All Organisers</option>
                     {allOrganisers.map(org => (
                        <option key={org.id} value={org.name}>{org.name}</option>
                     ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-primary absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="min-w-0">
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-700 dark:text-violet-300 mb-1">Payment</label>
                <div className="relative">
                   <select 
                     value={filterPayment} 
                     onChange={(e) => setFilterPayment(e.target.value)}
                     className="w-full min-h-[44px] bg-[#fdfaff] dark:bg-violet-950/35 border border-pink-100 dark:border-violet-500/25 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm text-gray-900 dark:text-violet-100 font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                   >
                     <option>All Modes</option>
                     <option value="Online">Online</option>
                     <option value="Cash">Cash</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-primary absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
            <div className="bg-white dark:bg-[var(--card-bg)] rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm border border-gray-100 dark:border-violet-500/15 flex flex-col justify-between hover:border-primary transition-colors cursor-default min-h-[7.5rem] sm:min-h-0">
              <div className="flex justify-between items-start gap-1 mb-2 sm:mb-4">
                <h3 className="text-[11px] sm:text-sm font-bold text-gray-900 dark:text-violet-100 leading-tight">Total Revenue</h3>
                <div className="p-1 sm:p-1.5 rounded-full bg-green-100 text-green-600 shrink-0">
                  <IndianRupee className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <div>
                <div className="text-lg sm:text-3xl font-bold text-gray-900 dark:text-violet-100 mb-0.5 tabular-nums break-all">₹{formattedRevenue}</div>
                <div className="flex items-center gap-1.5 mt-1 sm:mt-1.5 mb-1.5">
                   <div className="flex items-center gap-1 bg-green-50/70 border border-green-100 dark:border-green-500/25 dark:bg-green-950/25 px-1.5 py-0.5 rounded text-[9px] font-bold text-green-700 dark:text-green-400">
                      <span>Trust:</span> <span className="tabular-nums">₹{new Intl.NumberFormat('en-IN').format(metrics.trustRevenue)}</span>
                   </div>
                   <div className="flex items-center gap-1 bg-blue-50/70 border border-blue-100 dark:border-blue-500/25 dark:bg-blue-950/25 px-1.5 py-0.5 rounded text-[9px] font-bold text-blue-700 dark:text-blue-400">
                      <span>Org:</span> <span className="tabular-nums">₹{new Intl.NumberFormat('en-IN').format(metrics.organizerRevenue)}</span>
                   </div>
                </div>
                <div className="flex items-center text-[9px] sm:text-[10px] font-semibold text-green-600">
                  <TrendingUp className="w-3 h-3 mr-1 shrink-0" />
                  Live combined view
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[var(--card-bg)] rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm border border-gray-100 dark:border-violet-500/15 flex flex-col justify-between hover:border-primary transition-colors cursor-default min-h-[7.5rem] sm:min-h-0">
              <div className="flex justify-between items-start gap-1 mb-2 sm:mb-4">
                <h3 className="text-[11px] sm:text-sm font-bold text-gray-900 dark:text-violet-100 leading-tight">Tickets sold</h3>
                <div className="p-1 sm:p-1.5 rounded-full bg-purple-100 text-secondary shrink-0">
                  <Ticket className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <div>
                <div className="text-lg sm:text-3xl font-bold text-gray-900 dark:text-violet-100 mb-0.5 tabular-nums">{metrics.totalTickets}</div>
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-violet-300/70 mb-1">All categories</p>
                <div className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-violet-300/70">Target {new Intl.NumberFormat('en-IN').format(metrics.totalTarget)}</div>
              </div>
            </div>

            <div className="bg-white dark:bg-[var(--card-bg)] rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm border border-gray-100 dark:border-violet-500/15 flex flex-col justify-between hover:border-primary transition-colors cursor-default min-h-[7.5rem] sm:min-h-0">
              <div className="flex justify-between items-start gap-1 mb-2 sm:mb-4">
                <h3 className="text-[11px] sm:text-sm font-bold text-gray-900 dark:text-violet-100 leading-tight">Organisers</h3>
                <div className="p-1 sm:p-1.5 rounded-full bg-blue-100 text-blue-600 shrink-0">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <div>
                <div className="text-lg sm:text-3xl font-bold text-gray-900 dark:text-violet-100 mb-0.5 tabular-nums">{metrics.activeOrganisers}</div>
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-violet-300/70">Active profiles</p>
              </div>
            </div>

            <div className="bg-white dark:bg-[var(--card-bg)] rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm border border-gray-100 dark:border-violet-500/15 flex flex-col justify-between hover:border-primary transition-colors cursor-default min-h-[7.5rem] sm:min-h-0">
              <div className="flex justify-between items-start gap-1 mb-2 sm:mb-4">
                <h3 className="text-[11px] sm:text-sm font-bold text-gray-900 dark:text-violet-100 leading-tight">Check-in</h3>
                <div className="p-1 sm:p-1.5 rounded-full bg-purple-900 text-white shrink-0">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <div>
                <div className="text-lg sm:text-3xl font-bold text-gray-900 dark:text-violet-100 mb-0.5 tabular-nums">{checkInRate}%</div>
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-violet-300/70 line-clamp-2">{metrics.checkedIn}/{metrics.scannableTickets} in</p>
              </div>
            </div>
          </div>

          {/* Nav Tabs */}
          <div className="-mx-1 px-1 sm:mx-0">
            <div className="flex gap-1 sm:gap-2 bg-[#fdfaff] dark:bg-violet-950/25 p-1.5 sm:p-2 rounded-xl border border-pink-50 dark:border-violet-500/18 overflow-x-auto scrollbar-hide snap-x snap-mandatory w-full max-w-full">
            {['Sales Overview', 'LeaderBoard', 'Ticket Status', 'Check-in Stats'].map((tab) => (
               <button 
                 type="button"
                 key={tab}
                 onClick={() => setActiveTab(tab)}
                 className={`shrink-0 snap-start min-h-[44px] px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                   activeTab === tab 
                     ? "bg-white dark:bg-violet-950/50 text-gray-900 dark:text-violet-100 shadow-sm border border-gray-100 dark:border-violet-400/25" 
                     : "text-gray-500 dark:text-violet-300/70 hover:text-gray-700 dark:hover:text-violet-200 bg-transparent border border-transparent dark:hover:bg-violet-900/20"
                 }`}
               >
                 {tab}
               </button>
            ))}
            </div>
          </div>

          <div className="bg-white dark:bg-[var(--card-bg)] rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100 dark:border-violet-500/15 min-h-0 md:min-h-[360px]">
             
             {/* 1. Sales Overview */}
             {activeTab === 'Sales Overview' && (
               <div className="animate-in fade-in duration-500">
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 min-h-0">
                   <div className="lg:col-span-2 h-[220px] sm:h-[280px] lg:h-[340px] w-full min-w-0">
                     <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                       <BarChart data={chartData} margin={{ top: 8, right: 8, left: 10, bottom: 0 }} barGap={0} barSize={32}>
                         <defs>
                           <linearGradient id="shiningGold" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="0%" stopColor="#FDE047" stopOpacity={1}/>
                             <stop offset="50%" stopColor="#FBDF7E" stopOpacity={1}/>
                             <stop offset="100%" stopColor="#A16207" stopOpacity={1}/>
                           </linearGradient>
                         </defs>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                         <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 11, fontWeight: 500}} dy={6} interval={0} />
                         <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 11, fontWeight: 500}} width={45} />
                         <Tooltip 
                           cursor={{fill: '#F3F4F6'}}
                           contentStyle={{ borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                         />
                         <Legend verticalAlign="top" align="right" height={40} iconType="circle" wrapperStyle={{ fontSize: '14px', fontWeight: 600, color: '#4B5563' }} />
                         <Bar dataKey="Sold" fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={40}>
                           <LabelList dataKey="Sold" position="top" style={{ fill: '#8B5CF6', fontSize: 12, fontWeight: 'bold' }} />
                         </Bar>
                         <Bar dataKey="Target" fill="url(#shiningGold)" radius={[4, 4, 0, 0]} barSize={40}>
                           <LabelList dataKey="Target" position="top" style={{ fill: '#A16207', fontSize: 12, fontWeight: 'bold' }} />
                         </Bar>
                       </BarChart>
                     </ResponsiveContainer>
                   </div>

                   <div className="w-full bg-gray-50 dark:bg-violet-950/30 border border-gray-100 dark:border-violet-500/15 rounded-xl sm:rounded-2xl p-3 sm:p-5 h-full flex flex-col min-h-0">
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
                         <h4 className="text-[11px] sm:text-xs font-bold text-gray-800 dark:text-violet-200 uppercase tracking-wide">By category</h4>
                      </div>
                      
                      <div className="flex-1 space-y-3 sm:space-y-4">
                         {chartData.map(item => (
                            <div key={item.name} className="flex justify-between items-start gap-2 group">
                               <div className="min-w-0">
                                  <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-violet-100 block group-hover:text-primary transition-colors leading-tight">{item.name}</span>
                                  <span className="text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-violet-300/70">{item.Sold} / {item.Target}</span>
                               </div>
                               <div className="text-right shrink-0">
                                  <span className="text-sm sm:text-base font-bold text-gray-800 dark:text-violet-200 tabular-nums">₹{new Intl.NumberFormat('en-IN').format(item.Revenue)}</span>
                               </div>
                            </div>
                         ))}
                      </div>

                      <div className="pt-3 border-t border-gray-200 mt-auto">
                         <div className="flex justify-between items-center gap-2">
                            <span className="text-xs font-bold text-gray-600 dark:text-violet-300/85">Total</span>
                            <span className="text-base sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-secondary to-primary tabular-nums">₹{formattedRevenue}</span>
                         </div>
                      </div>
                   </div>
                 </div>
               </div>
             )}

             {/* 2. LeaderBoard */}
             {activeTab === 'LeaderBoard' && (
                <div className="animate-in fade-in duration-500">
                   <div className="mb-3 sm:mb-4">
                      <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-violet-100 border-b border-gray-100 dark:border-violet-500/15 pb-1.5">LeaderBoard</h3>
                      <p className="text-xs sm:text-sm text-gray-400 dark:text-violet-400/60 font-medium">Sales by category</p>
                   </div>

                   {/* Mobile: compact cards */}
                   <ul className="md:hidden space-y-2 list-none p-0 m-0">
                     {organiserList.length === 0 ? (
                       <li className="text-center text-sm text-gray-500 dark:text-violet-300/70 py-8">No performance data yet</li>
                     ) : (
                       organiserList.map((org, idx) => {
                         let rLabel = (idx + 1) + (idx === 0 ? "st" : idx === 1 ? "nd" : idx === 2 ? "rd" : "th");
                         let rBadge = idx === 0 ? "bg-[#EAB308]" : idx === 1 ? "bg-[#94A3B8]" : idx === 2 ? "bg-[#CC5500]" : "bg-[#CBD5E1]";
                         return (
                           <li key={org.name} className="rounded-xl border border-gray-100 dark:border-violet-500/15 bg-gray-50/50 dark:bg-violet-950/25 p-3">
                             <div className="flex items-center justify-between gap-2 mb-2">
                               <div className="flex items-center gap-2 min-w-0">
                                 <span className={`inline-flex items-center justify-center min-w-[2rem] h-6 ${rBadge} text-white text-[10px] font-bold rounded-full`}>{rLabel}</span>
                                 <span className="text-sm font-bold text-gray-900 dark:text-violet-100 truncate">{org.name}</span>
                               </div>
                               <span className="shrink-0 text-xs font-bold bg-white dark:bg-[var(--card-bg)] border border-gray-200 dark:border-violet-500/22 px-2 py-1 rounded-md text-gray-700 dark:text-violet-300">{org.total} total</span>
                             </div>
                             <div className="grid grid-cols-3 gap-x-2 gap-y-1.5 text-[10px] sm:text-xs">
                               <div className="flex flex-col items-center justify-center rounded-lg bg-white/70 px-1 py-1.5 dark:bg-violet-950/35">
                                 <span className="font-medium text-gray-500 dark:text-violet-400/80">Platinum</span>
                                 <span className="font-bold tabular-nums text-gray-900 dark:text-violet-100">{org.platinum}</span>
                               </div>
                               <div className="flex flex-col items-center justify-center rounded-lg bg-white/70 px-1 py-1.5 dark:bg-violet-950/35">
                                 <span className="font-medium text-gray-500 dark:text-violet-400/80">Donor</span>
                                 <span className="font-bold tabular-nums text-gray-900 dark:text-violet-100">{org.donor}</span>
                               </div>
                               <div className="flex flex-col items-center justify-center rounded-lg bg-white/70 px-1 py-1.5 dark:bg-violet-950/35">
                                 <span className="font-medium text-gray-500 dark:text-violet-400/80">Student</span>
                                 <span className="font-bold tabular-nums text-gray-900 dark:text-violet-100">{org.student}</span>
                               </div>
                             </div>
                           </li>
                         );
                       })
                     )}
                   </ul>

                   {/* Desktop Table */}
                   <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-100 dark:border-violet-500/15">
                    <table className="w-full text-left border-collapse min-w-[640px]">
                       <thead>
                          <tr className="border-b border-gray-100 dark:border-violet-500/12">
                             <th className="py-4 px-2 text-[10px] font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest text-center">Rank</th>
                             <th className="py-4 px-2 text-[10px] font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest">Organiser Name</th>
                             <th className="py-4 px-4 text-[10px] font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest text-center">Platinum</th>
                             <th className="py-4 px-4 text-[10px] font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest text-center">Donor</th>
                             <th className="py-4 px-4 text-[10px] font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest text-center">Student</th>
                             <th className="py-4 px-4 text-[10px] font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest text-center">Total</th>
                          </tr>
                       </thead>
                       <tbody>
                          {organiserList.length === 0 ? (
                             <tr><td colSpan={6} className="py-12 text-center text-gray-500 dark:text-violet-300/70 font-medium italic">No performance data recorded yet</td></tr>
                          ) : (
                             organiserList.map((org, idx) => {
                                let rLabel = (idx + 1) + (idx === 0 ? "st" : idx === 1 ? "nd" : idx === 2 ? "rd" : "th");
                                let rBadge = idx === 0 ? "bg-[#EAB308]" : idx === 1 ? "bg-[#94A3B8]" : idx === 2 ? "bg-[#CC5500]" : "bg-[#CBD5E1]";

                                return (
                                   <tr key={org.name} className="border-b border-gray-50 hover:bg-gray-50/50 dark:hover:bg-violet-950/35 transition-colors">
                                      <td className="py-5 px-2 text-center">
                                         <span className={`inline-flex items-center justify-center w-8 h-5 ${rBadge} text-white text-[10px] font-bold rounded-full shadow-sm`}>{rLabel}</span>
                                      </td>
                                      <td className="py-5 px-2 text-sm font-bold text-gray-800 dark:text-violet-200">{org.name}</td>
                                      <td className="py-5 px-4 text-sm font-semibold text-gray-500 dark:text-violet-300/70 text-center">{org.platinum}</td>
                                      <td className="py-5 px-4 text-sm font-semibold text-gray-500 dark:text-violet-300/70 text-center">{org.donor}</td>
                                      <td className="py-5 px-4 text-sm font-semibold text-gray-500 dark:text-violet-300/70 text-center">{org.student}</td>
                                      <td className="py-5 px-4 text-center">
                                         <span className="inline-block bg-[#F8FAFC] text-gray-600 dark:text-violet-300/85 text-xs font-bold px-3 py-1 rounded-md border border-gray-100 dark:border-violet-500/15">
                                            {org.total}
                                         </span>
                                      </td>
                                   </tr>
                                );
                             })
                          )}
                       </tbody>
                    </table>
                   </div>
                </div>
             )}

             {/* 3. Ticket Status */}
             {activeTab === 'Ticket Status' && (
                <div className="animate-in fade-in duration-500 pt-1 sm:pt-4">
                  <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6 sm:mb-10">
                      <div className="bg-white dark:bg-[var(--card-bg)] border border-gray-200 dark:border-violet-500/22 p-3 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm text-center font-bold">
                          <span className="text-2xl sm:text-4xl font-bold text-[#10B981] mb-1 sm:mb-2 block tabular-nums">
                             {(statusData.find(s=>s.name==='Checked-in')?.value || 0) + (statusData.find(s=>s.name==='Pending')?.value || 0)}
                          </span>
                          <h4 className="text-[10px] sm:text-sm text-gray-700 dark:text-violet-300 leading-tight">Booked</h4>
                      </div>
                      <div className="bg-white dark:bg-[var(--card-bg)] border border-gray-200 dark:border-violet-500/22 p-3 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm text-center font-bold">
                          <span className="text-2xl sm:text-4xl font-bold text-[#F59E0B] mb-1 sm:mb-2 block tabular-nums">
                             {statusData.find(s=>s.name==='Pending')?.value || 0}
                          </span>
                          <h4 className="text-[10px] sm:text-sm text-gray-700 dark:text-violet-300 leading-tight">Pending</h4>
                      </div>
                      <div className="bg-white dark:bg-[var(--card-bg)] border border-gray-200 dark:border-violet-500/22 p-3 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm text-center font-bold">
                          <span className="text-2xl sm:text-4xl font-bold text-[#8B5CF6] mb-1 sm:mb-2 block tabular-nums">
                             {statusData.find(s=>s.name==='Checked-in')?.value || 0}
                          </span>
                          <h4 className="text-[10px] sm:text-sm text-gray-700 dark:text-violet-300 leading-tight">Checked-in</h4>
                      </div>
                  </div>

                  <div className="max-w-4xl mx-auto mt-4 sm:mt-8">
                      <p className="text-xs font-bold text-gray-500 dark:text-violet-300/70 mb-3 sm:mb-6 uppercase tracking-wide text-center">Lifecycle</p>
                      <div className="bg-white dark:bg-[var(--card-bg)] border border-gray-200 dark:border-violet-500/22 rounded-xl sm:rounded-2xl p-4 sm:p-8 flex items-center justify-between text-center shadow-sm gap-1 sm:gap-2 overflow-x-auto scrollbar-hide">
                         <div className="relative z-10 w-24">
                            <div className="w-12 h-12 bg-gray-100 border border-gray-200 dark:border-violet-500/22 rounded-full mx-auto mb-3 flex items-center justify-center font-bold text-gray-500 dark:text-violet-300/70 shadow-sm">1</div>
                            <span className="text-xs font-bold text-gray-700 dark:text-violet-300">Pending</span>
                         </div>
                         <div className="flex-1 h-0.5 bg-gray-200 mx-2 relative z-0 min-w-[30px]">
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 border-t-2 border-r-2 border-gray-300 rotate-45 transform translate-x-1/2"></div>
                         </div>
                         <div className="relative z-10 w-24">
                            <div className="w-12 h-12 bg-green-50 border border-green-200 rounded-full mx-auto mb-3 flex items-center justify-center font-bold text-[#10B981] shadow-sm">2</div>
                            <span className="text-xs font-bold text-gray-700 dark:text-violet-300">Booked</span>
                         </div>
                         <div className="flex-1 h-0.5 bg-gray-200 mx-2 relative z-0 min-w-[30px]">
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 border-t-2 border-r-2 border-gray-300 rotate-45 transform translate-x-1/2"></div>
                         </div>
                         <div className="relative z-10 w-24">
                            <div className="w-12 h-12 bg-gray-900 dark:bg-violet-700 border border-gray-800 dark:border-violet-500 rounded-full mx-auto mb-3 flex items-center justify-center font-bold text-white shadow-md shadow-gray-400/30 dark:shadow-violet-900/40">3</div>
                            <span className="text-xs font-bold text-gray-900 dark:text-violet-100">Checked-in</span>
                         </div>
                      </div>
                  </div>
                </div>
             )}

             {/* 4. Check-in Stats */}
             {activeTab === 'Check-in Stats' && (
                <div className="animate-in fade-in duration-500 pt-2 sm:pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10 items-center min-h-0 md:h-[280px]">
                     <div className="h-[200px] sm:h-[240px] md:h-full w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie 
                              data={[
                                 {name: 'Checked In', value: metrics.checkedIn}, 
                                 {name: 'Not Checked In', value: Math.max(0, metrics.scannableTickets - metrics.checkedIn)}
                              ]} 
                              cx="50%" cy="50%" innerRadius={58} outerRadius={92} dataKey="value" stroke="none"
                            >
                              <Cell fill="#10B981" />
                              <Cell fill="#E5E7EB" />
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                          </PieChart>
                        </ResponsiveContainer>
                     </div>

                     <div className="space-y-3 sm:space-y-4 w-full">
                        <div className="flex justify-between items-center border-b border-gray-100 dark:border-violet-500/15 pb-2 sm:pb-3 gap-2">
                           <span className="text-gray-600 dark:text-violet-300/85 font-bold text-xs sm:text-sm">Checked in</span>
                           <span className="text-lg sm:text-xl font-bold text-gray-900 dark:text-violet-100 tabular-nums">{metrics.checkedIn}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-gray-100 dark:border-violet-500/15 pb-2 sm:pb-3 gap-2">
                           <span className="text-gray-600 dark:text-violet-300/85 font-bold text-xs sm:text-sm">Awaiting</span>
                           <span className="text-lg sm:text-xl font-bold text-gray-900 dark:text-violet-100 tabular-nums">{Math.max(0, metrics.scannableTickets - metrics.checkedIn)}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-gray-100 dark:border-violet-500/15 pb-2 sm:pb-3 gap-2">
                           <span className="text-gray-600 dark:text-violet-300/85 font-bold text-xs sm:text-sm">Rate</span>
                           <span className="text-lg sm:text-xl font-bold text-gray-900 dark:text-violet-100 tabular-nums">{checkInRate}%</span>
                        </div>
                     </div>
                  </div>
                </div>
             )}
          </div>
        </>
      )}
    </div>
  );
}
