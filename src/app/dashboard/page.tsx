"use client";

import { useEffect, useState } from "react";
import { ChevronDown, IndianRupee, Ticket, Users, Clock, TrendingUp, Loader2, AlertCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, LabelList } from 'recharts';
import { supabase } from "@/utils/supabase";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Sales Overview');
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    totalTickets: 0,
    checkedIn: 0,
    activeOrganisers: 0,
    hasTickets: false
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
    let checkInCount = 0;
    
    const typeCount = { 'Platinum': 0, 'Donor': 0, 'Bulk': 0, 'Student': 0 };
    const revCount = { 'Platinum': 0, 'Donor': 0, 'Bulk': 0, 'Student': 0 };
    const statusCount = { 'pending': 0, 'checked_in': 0, 'cancelled': 0 };

    filteredTickets.forEach(t => {
      totalRev += Number(t.price || 0);
      if (t.status === 'checked_in') checkInCount++;
      if (statusCount[t.status as keyof typeof statusCount] !== undefined) {
         statusCount[t.status as keyof typeof statusCount]++;
      }
      if (typeCount[t.type as keyof typeof typeCount] !== undefined) {
         typeCount[t.type as keyof typeof typeCount]++;
         revCount[t.type as keyof typeof revCount] += Number(t.price || 0);
      }
    });

    setMetrics({
      totalRevenue: totalRev,
      totalTickets: filteredTickets.length,
      checkedIn: checkInCount,
      activeOrganisers: allOrganisers.length,
      hasTickets: allTickets.length > 0
    });

    setChartData([
      { name: 'Platinum Pass', Sold: typeCount['Platinum'], Target: 250, Revenue: revCount['Platinum'] },
      { name: 'Donor Pass', Sold: typeCount['Donor'], Target: 150, Revenue: revCount['Donor'] },
      { name: 'Bulk Pass', Sold: typeCount['Bulk'], Target: 800, Revenue: revCount['Bulk'] },
      { name: 'Student Pass', Sold: typeCount['Student'], Target: 400, Revenue: revCount['Student'] },
    ]);

    setStatusData([
      { name: 'Pending', value: statusCount['pending'] },
      { name: 'Checked-in', value: statusCount['checked_in'] },
      { name: 'Cancelled', value: statusCount['cancelled'] },
    ]);

    // Top Organisers ranking (always based on ALL tickets filtered by type/payment, but aggregated by person)
    const orgSales: Record<string, { count: number, categories: Record<string, number> }> = {};
    
    allOrganisers.forEach(org => {
       orgSales[org.name] = { count: 0, categories: {} };
    });

    filteredTickets.forEach(t => {
       if (t.sold_by && orgSales[t.sold_by]) {
          orgSales[t.sold_by].count++;
          orgSales[t.sold_by].categories[t.type] = (orgSales[t.sold_by].categories[t.type] || 0) + 1;
       }
    });

    setOrganiserList(allOrganisers.map((org) => {
       const sales = orgSales[org.name];
       return {
          name: org.name,
          platinum: sales?.categories['Platinum'] || 0,
          donor: sales?.categories['Donor'] || 0,
          bulk: sales?.categories['Bulk'] || 0,
          student: sales?.categories['Student'] || 0,
          total: sales?.count || 0
       };
    }).sort((a,b) => b.total - a.total));

  }, [allTickets, allOrganisers, filterType, filterOrganiser, filterPayment]);

  const checkInRate = metrics.totalTickets > 0 ? ((metrics.checkedIn / metrics.totalTickets) * 100).toFixed(1) : "0.0";
  const formattedRevenue = new Intl.NumberFormat('en-IN').format(metrics.totalRevenue);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-secondary to-primary">Dashboard</h1>
        <p className="text-gray-500 mt-1 text-sm font-medium">
          Real-time overview of Rhapsody event metrics
        </p>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : (
        <>
          {/* Filters Card */}
          <div className="bg-white rounded-2xl p-6 shadow-[0_4px_24px_rgba(236,72,153,0.06)] border border-pink-50">
            <h3 className="text-sm font-bold text-secondary mb-4 uppercase tracking-wider">Dashboard Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Date Range</label>
                <div className="relative">
                   <select 
                     value={filterDate}
                     onChange={(e) => setFilterDate(e.target.value)}
                     className="w-full bg-[#fdfaff] border border-pink-100 px-4 py-3 rounded-lg text-sm text-gray-900 font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                   >
                     <option>All Time</option>
                     <option>Today</option>
                     <option>Last 7 Days</option>
                     <option>This Month</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-primary absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Ticket Type</label>
                <div className="relative">
                   <select 
                     value={filterType} 
                     onChange={(e) => setFilterType(e.target.value)}
                     className="w-full bg-[#fdfaff] border border-pink-100 px-4 py-3 rounded-lg text-sm text-gray-900 font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                   >
                     <option>All Types</option>
                     <option value="Platinum">Platinum Pass</option>
                     <option value="Donor">Donor Pass</option>
                     <option value="Bulk">Bulk Pass</option>
                     <option value="Student">Student Pass</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-primary absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Organiser</label>
                <div className="relative">
                   <select 
                     value={filterOrganiser} 
                     onChange={(e) => setFilterOrganiser(e.target.value)}
                     className="w-full bg-[#fdfaff] border border-pink-100 px-4 py-3 rounded-lg text-sm text-gray-900 font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                   >
                     <option>All Organisers</option>
                     {allOrganisers.map(org => (
                        <option key={org.id} value={org.name}>{org.name}</option>
                     ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-primary absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Payment Mode</label>
                <div className="relative">
                   <select 
                     value={filterPayment} 
                     onChange={(e) => setFilterPayment(e.target.value)}
                     className="w-full bg-[#fdfaff] border border-pink-100 px-4 py-3 rounded-lg text-sm text-gray-900 font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                   >
                     <option>All Modes</option>
                     <option value="Online">Online</option>
                     <option value="Cash">Cash</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-primary absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

            </div>
          </div>

          {/* Metric Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between hover:border-primary transition-colors cursor-default">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-bold text-gray-900">Total Revenue</h3>
                <div className="p-1.5 rounded-full bg-green-100 text-green-600">
                  <IndianRupee className="w-5 h-5" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900 mb-1">₹{formattedRevenue}</div>
                <p className="text-xs text-gray-500 mb-3">Admin only visibility</p>
                <div className="flex items-center text-xs font-semibold text-green-600">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Live Sync
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between hover:border-primary transition-colors cursor-default">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-bold text-gray-900">Total Tickets Sold</h3>
                <div className="p-1.5 rounded-full bg-purple-100 text-secondary">
                  <Ticket className="w-5 h-5" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900 mb-1">{metrics.totalTickets}</div>
                <p className="text-xs text-gray-500 mb-3">Across all categories</p>
                <div className="flex items-center justify-between gap-2 text-xs font-medium">
                  <span className="text-gray-500">Target: 2,050</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between hover:border-primary transition-colors cursor-default">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-bold text-gray-900">Active Organisers</h3>
                <div className="p-1.5 rounded-full bg-blue-100 text-blue-600">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900 mb-1">{metrics.activeOrganisers}</div>
                <p className="text-xs text-gray-500 mb-3">Currently logged internally</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between hover:border-primary transition-colors cursor-default">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-bold text-gray-900">Check-in Rate</h3>
                <div className="p-1.5 rounded-full bg-purple-900 text-white">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold text-gray-900 mb-1">{checkInRate}%</div>
                <p className="text-xs text-gray-500 mb-3">{metrics.checkedIn} / {metrics.totalTickets} checked in</p>
              </div>
            </div>
          </div>

          {/* Chart Nav Tabs */}
          <div className="flex gap-2 bg-[#fdfaff] p-2 rounded-xl border border-pink-50 w-fit mt-6 mb-2">
            {['Sales Overview', 'Top Organisers', 'Ticket Status', 'Check-in Stats'].map((tab) => (
               <button 
                 key={tab}
                 onClick={() => setActiveTab(tab)}
                 className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                   activeTab === tab 
                     ? "bg-white text-gray-900 shadow-sm border border-gray-100" 
                     : "text-gray-500 hover:text-gray-700 bg-transparent border border-transparent"
                 }`}
               >
                 {tab}
               </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 min-h-[400px]">
             
             {/* 1. Sales Overview */}
             {activeTab === 'Sales Overview' && (
               <div className="animate-in fade-in duration-500">
                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 min-h-[350px]">
                   <div className="lg:col-span-2 h-[350px] w-full">
                     <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                       <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }} barGap={0} barSize={60}>
                         <defs>
                           <linearGradient id="shiningGold" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="0%" stopColor="#FDE047" stopOpacity={1}/>
                             <stop offset="50%" stopColor="#FBDF7E" stopOpacity={1}/>
                             <stop offset="100%" stopColor="#A16207" stopOpacity={1}/>
                           </linearGradient>
                         </defs>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                         <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 13, fontWeight: 500}} dy={10} />
                         <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 13, fontWeight: 500}} />
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

                   <div className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-6 h-full flex flex-col">
                      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
                         <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Ticket Category Summary</h4>
                      </div>
                      
                      <div className="flex-1 space-y-5">
                         {chartData.map(item => (
                            <div key={item.name} className="flex justify-between items-center group">
                               <div>
                                  <span className="text-sm font-bold text-gray-900 block group-hover:text-primary transition-colors">{item.name}</span>
                                  <span className="text-xs font-semibold text-gray-500">{item.Sold} passes / {item.Target} target</span>
                               </div>
                               <div className="text-right">
                                  <span className="text-base font-bold text-gray-800 tracking-tight">₹{new Intl.NumberFormat('en-IN').format(item.Revenue)}</span>
                               </div>
                            </div>
                         ))}
                      </div>

                      <div className="pt-5 border-t border-gray-200 mt-auto">
                         <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-gray-600">Total Yield</span>
                            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-secondary to-primary">₹{formattedRevenue}</span>
                         </div>
                      </div>
                   </div>
                 </div>
               </div>
             )}

             {/* 2. Top Organisers - Ranked Table */}
             {activeTab === 'Top Organisers' && (
                <div className="animate-in fade-in duration-500 overflow-x-auto">
                   <div className="mb-6">
                      <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-2">Top Organisers Performance</h3>
                      <p className="text-sm text-gray-400 font-medium italic">Top 3 organisers per category</p>
                   </div>

                   <table className="w-full text-left border-collapse min-w-[700px]">
                      <thead>
                         <tr className="border-b border-gray-100">
                            <th className="py-4 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Organiser Name</th>
                            <th className="py-4 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Platinum</th>
                            <th className="py-4 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Donor</th>
                            <th className="py-4 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Bulk</th>
                            <th className="py-4 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Student</th>
                            <th className="py-4 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Total</th>
                            <th className="py-4 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Action</th>
                         </tr>
                      </thead>
                      <tbody>
                         {organiserList.length === 0 ? (
                            <tr><td colSpan={7} className="py-12 text-center text-gray-500 font-medium italic">No performance data recorded yet</td></tr>
                         ) : (
                            organiserList.map((org, idx) => {
                               let rLabel = (idx + 1) + (idx === 0 ? "st" : idx === 1 ? "nd" : idx === 2 ? "rd" : "th");
                               let rBadge = idx === 0 ? "bg-[#EAB308]" : idx === 1 ? "bg-[#94A3B8]" : idx === 2 ? "bg-[#CC5500]" : "bg-[#CBD5E1]";

                               return (
                                  <tr key={org.name} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                     <td className="py-5 px-2">
                                        <div className="flex items-center">
                                           <span className={`inline-flex items-center justify-center w-8 h-5 ${rBadge} text-white text-[10px] font-bold rounded-full mr-3 shadow-sm`}>{rLabel}</span>
                                           <span className="text-sm font-bold text-gray-800">{org.name}</span>
                                        </div>
                                     </td>
                                     <td className="py-5 px-4 text-sm font-semibold text-gray-500 text-center">{org.platinum}</td>
                                     <td className="py-5 px-4 text-sm font-semibold text-gray-500 text-center">{org.donor}</td>
                                     <td className="py-5 px-4 text-sm font-semibold text-gray-500 text-center">{org.bulk}</td>
                                     <td className="py-5 px-4 text-sm font-semibold text-gray-500 text-center">{org.student}</td>
                                     <td className="py-5 px-4 text-center">
                                        <span className="inline-block bg-[#F8FAFC] text-gray-600 text-xs font-bold px-3 py-1 rounded-md border border-gray-100">
                                           {org.total}
                                        </span>
                                     </td>
                                     <td className="py-5 px-2 text-right">
                                        <button className="text-xs font-bold text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-all">View Details</button>
                                     </td>
                                  </tr>
                               );
                            })
                         )}
                      </tbody>
                   </table>
                </div>
              )}

             {/* 3. Ticket Status */}
             {activeTab === 'Ticket Status' && (
                <div className="animate-in fade-in duration-500 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                      <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm text-center font-bold">
                          <span className="text-4xl font-bold text-[#10B981] mb-2 block">
                             {(statusData.find(s=>s.name==='Checked-in')?.value || 0) + (statusData.find(s=>s.name==='Pending')?.value || 0)}
                          </span>
                          <h4 className="text-sm text-gray-700">Booked</h4>
                      </div>
                      <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm text-center font-bold">
                          <span className="text-4xl font-bold text-[#F59E0B] mb-2 block">
                             {statusData.find(s=>s.name==='Pending')?.value || 0}
                          </span>
                          <h4 className="text-sm text-gray-700">Pending</h4>
                      </div>
                      <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm text-center font-bold">
                          <span className="text-4xl font-bold text-[#8B5CF6] mb-2 block">
                             {statusData.find(s=>s.name==='Checked-in')?.value || 0}
                          </span>
                          <h4 className="text-sm text-gray-700">Checked-in</h4>
                      </div>
                  </div>

                  <div className="max-w-4xl mx-auto mt-8">
                      <p className="text-sm font-bold text-gray-500 mb-6 uppercase tracking-wider text-center">Ticket Lifecycle Flow</p>
                      <div className="bg-white border border-gray-200 rounded-2xl p-8 flex items-center justify-between text-center shadow-sm relative overflow-x-auto">
                         <div className="relative z-10 w-24">
                            <div className="w-12 h-12 bg-gray-100 border border-gray-200 rounded-full mx-auto mb-3 flex items-center justify-center font-bold text-gray-500 shadow-sm">1</div>
                            <span className="text-xs font-bold text-gray-700">Pending</span>
                         </div>
                         <div className="flex-1 h-0.5 bg-gray-200 mx-2 relative z-0 min-w-[30px]">
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 border-t-2 border-r-2 border-gray-300 rotate-45 transform translate-x-1/2"></div>
                         </div>
                         <div className="relative z-10 w-24">
                            <div className="w-12 h-12 bg-green-50 border border-green-200 rounded-full mx-auto mb-3 flex items-center justify-center font-bold text-[#10B981] shadow-sm">2</div>
                            <span className="text-xs font-bold text-gray-700">Booked</span>
                         </div>
                         <div className="flex-1 h-0.5 bg-gray-200 mx-2 relative z-0 min-w-[30px]">
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 border-t-2 border-r-2 border-gray-300 rotate-45 transform translate-x-1/2"></div>
                         </div>
                         <div className="relative z-10 w-24">
                            <div className="w-12 h-12 bg-gray-900 border border-gray-800 rounded-full mx-auto mb-3 flex items-center justify-center font-bold text-white shadow-md shadow-gray-400/30">3</div>
                            <span className="text-xs font-bold text-gray-900">Checked-in</span>
                         </div>
                      </div>
                  </div>
                </div>
             )}

             {/* 4. Check-in Stats */}
             {activeTab === 'Check-in Stats' && (
                <div className="animate-in fade-in duration-500 pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center h-[300px]">
                     <div className="h-full w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie 
                              data={[
                                 {name: 'Checked In', value: metrics.checkedIn}, 
                                 {name: 'Not Checked In', value: Math.max(0, metrics.totalTickets - metrics.checkedIn)}
                              ]} 
                              cx="50%" cy="50%" innerRadius={80} outerRadius={120} dataKey="value" stroke="none"
                            >
                              <Cell fill="#10B981" />
                              <Cell fill="#E5E7EB" />
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                          </PieChart>
                        </ResponsiveContainer>
                     </div>

                     <div className="space-y-6 w-full pr-8">
                        <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                           <span className="text-gray-600 font-bold">Total Checked In</span>
                           <span className="text-xl font-bold text-gray-900">{metrics.checkedIn}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                           <span className="text-gray-600 font-bold">Awaiting Check-in</span>
                           <span className="text-xl font-bold text-gray-900">{Math.max(0, metrics.totalTickets - metrics.checkedIn)}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                           <span className="text-gray-600 font-bold">Check-in Rate</span>
                           <span className="text-xl font-bold text-gray-900">{checkInRate}%</span>
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
