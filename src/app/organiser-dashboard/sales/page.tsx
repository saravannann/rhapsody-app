"use client";

import { useEffect, useState, useMemo } from "react";
import { Download, Search, Loader2, FileSpreadsheet, Filter, X, ChevronDown } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { ticketLineTotal, ticketQuantity, ticketUnitPrice } from "@/utils/ticket-counts";

export default function SalesReport() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Role Context
  const [userRole, setUserRole] = useState('organiser');
  const [userName, setUserName] = useState('');

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [ticketTypeFilter, setTicketTypeFilter] = useState('All Types');
  const [paymentModeFilter, setPaymentModeFilter] = useState('All Modes');
  const [pocFilter, setPocFilter] = useState('All Organisers');

  useEffect(() => {
     async function fetchSales() {
        try {
           const savedName = localStorage.getItem('rhapsody_user') || '';
           const savedRole = localStorage.getItem('rhapsody_role') || 'organiser';
           setUserRole(savedRole);
           setUserName(savedName);

           let query = supabase.from('tickets').select('*');

           // If Organiser, strictly filter by their own name
           if (savedRole === 'organiser' && savedName) {
              query = query.eq('sold_by', savedName);
              setPocFilter(savedName); // Lock filter for organiser
           }

           const { data } = await query.order('created_at', { ascending: false });
           if (data) setTickets(data);
        } catch (err) {
           console.error(err);
        } finally {
           setLoading(false);
        }
     }
     fetchSales();
  }, []);

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const matchSearch = !searchQuery || 
        (t.purchaser_name && t.purchaser_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.purchaser_phone && t.purchaser_phone.includes(searchQuery)) ||
        t.id.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchType = ticketTypeFilter === 'All Types' || t.type === ticketTypeFilter;
      // Note: Payment mode not yet in schema, defaulting to match all
      const matchPayment = paymentModeFilter === 'All Modes' || true; 
      const matchPoc = pocFilter === 'All Organisers' || t.sold_by === pocFilter;

      return matchSearch && matchType && matchPayment && matchPoc;
    });
  }, [tickets, searchQuery, ticketTypeFilter, paymentModeFilter, pocFilter]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const revenue = filteredTickets.reduce((acc, t) => acc + ticketLineTotal(t), 0);
    const bookedCount = filteredTickets.reduce((acc, t) => {
      if (t.status === "booked" || t.status === "pending") {
        return acc + ticketQuantity(t);
      }
      return acc;
    }, 0);
    const passCount = filteredTickets.reduce((acc, t) => acc + ticketQuantity(t), 0);

    return {
      totalEntries: filteredTickets.length,
      totalTickets: passCount,
      totalRevenue: revenue,
      bookedTickets: bookedCount,
    };
  }, [filteredTickets]);

  const clearFilters = () => {
    setSearchQuery('');
    setTicketTypeFilter('All Types');
    setPaymentModeFilter('All Modes');
    if (userRole === 'admin') setPocFilter('All Organisers');
  };

  const handleExport = () => {
    if (filteredTickets.length === 0) return;
    
    const headers = [
      "Order ID",
      "Purchaser Name",
      "Purchaser Phone",
      "Ticket Type",
      "Qty",
      "Unit INR",
      "Line INR",
      "Status",
      "Sold By",
      "Date",
    ];
    const rows = filteredTickets.map((t) => [
      t.id,
      t.purchaser_name || "N/A",
      t.purchaser_phone || "N/A",
      t.type,
      ticketQuantity(t),
      ticketUnitPrice(t),
      ticketLineTotal(t),
      t.status,
      t.sold_by || "N/A",
      new Date(t.created_at).toLocaleString(),
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `rhapsody_sales_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-6xl mx-auto pb-8 sm:pb-12 animate-in fade-in duration-500 space-y-4 sm:space-y-5">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-violet-100 leading-tight">Sales Report</h1>
          <p className="text-gray-500 dark:text-violet-300/70 mt-0.5 text-xs sm:text-sm font-medium">Search, filter, export</p>
        </div>
        
        <button 
          type="button"
          onClick={handleExport}
          className="inline-flex items-center justify-center min-h-[44px] w-full sm:w-auto bg-[#10b981] hover:bg-[#059669] text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-md shadow-green-500/20 active:scale-[0.98] text-sm"
        >
          <Download className="w-4 h-4 mr-2 shrink-0" /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[var(--card-bg)] rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-gray-100 dark:border-violet-500/15 shadow-sm">
        <div className="flex items-center justify-between mb-3">
           <h3 className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest flex items-center">
             <Filter className="w-3.5 h-3.5 mr-1.5 shrink-0" /> Filters
           </h3>
           <button type="button" onClick={clearFilters} className="text-xs font-bold text-primary hover:underline min-h-[44px] px-1 sm:min-h-0">Clear</button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
           <div className="relative col-span-2 lg:col-span-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-violet-400/60 pointer-events-none" />
              <input 
                 type="search"
                 enterKeyHint="search"
                 value={searchQuery}
                 onChange={e => setSearchQuery(e.target.value)}
                 placeholder="Search name, phone, ID" 
                 className="w-full min-h-[44px] bg-gray-50 dark:bg-violet-950/30 border border-transparent focus:bg-white dark:focus:bg-violet-950/45 focus:border-primary/30 rounded-xl pl-9 pr-3 py-2 text-sm font-medium transition-all outline-none"
              />
           </div>

           <div className="relative min-w-0">
              <select 
                value={ticketTypeFilter}
                onChange={e => setTicketTypeFilter(e.target.value)}
                className="w-full min-h-[44px] bg-gray-50 dark:bg-violet-950/30 border border-transparent rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-gray-700 dark:text-violet-300 appearance-none outline-none focus:bg-white dark:focus:bg-violet-950/45 focus:border-primary/30"
              >
                <option>All Types</option>
                <option>Platinum</option>
                <option>Donor</option>
                <option>Bulk</option>
                <option>Student</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-violet-400/60 pointer-events-none" />
           </div>

           <div className="relative min-w-0">
              <select 
                value={paymentModeFilter}
                onChange={e => setPaymentModeFilter(e.target.value)}
                className="w-full min-h-[44px] bg-gray-50 dark:bg-violet-950/30 border border-transparent rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-gray-700 dark:text-violet-300 appearance-none outline-none focus:bg-white dark:focus:bg-violet-950/45 focus:border-primary/30"
              >
                <option>All Modes</option>
                <option>Cash</option>
                <option>Online</option>
                <option>Complimentary</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-violet-400/60 pointer-events-none" />
           </div>

           <div className="relative col-span-2 lg:col-span-1 min-w-0">
              <select 
                value={pocFilter}
                disabled={userRole !== 'admin'}
                onChange={e => setPocFilter(e.target.value)}
                className="w-full min-h-[44px] bg-gray-50 dark:bg-violet-950/30 border border-transparent rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-gray-700 dark:text-violet-300 appearance-none outline-none focus:bg-white dark:focus:bg-violet-950/45 focus:border-primary/30 disabled:opacity-60"
              >
                <option>All Organisers</option>
                {/* Dynamically this would be populated from profiles */}
                {userRole === 'admin' ? (
                   <>
                     <option>Master Admin</option>
                     <option>Sara</option>
                   </>
                ) : (
                   <option>{userName}</option>
                )}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-violet-400/60 pointer-events-none" />
           </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
         <div className="bg-purple-50 border border-purple-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-sm">
            <span className="text-[9px] sm:text-[10px] font-bold text-purple-600 uppercase tracking-wide block mb-0.5">Entries</span>
            <div className="text-xl sm:text-3xl font-bold text-purple-900 tabular-nums">{metrics.totalEntries}</div>
         </div>
         <div className="bg-blue-50 border border-blue-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-sm">
            <span className="text-[9px] sm:text-[10px] font-bold text-blue-600 uppercase tracking-wide block mb-0.5">Tickets</span>
            <div className="text-xl sm:text-3xl font-bold text-blue-900 tabular-nums">{metrics.totalTickets}</div>
         </div>
         <div className="bg-green-50 border border-green-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-sm">
            <div className="flex justify-between items-start gap-1">
               <span className="text-[9px] sm:text-[10px] font-bold text-green-600 uppercase tracking-wide block mb-0.5">Revenue</span>
               {userRole !== 'admin' && <span className="text-[8px] font-bold bg-green-200 text-green-700 px-1 py-0.5 rounded">Admin</span>}
            </div>
            <div className="text-xl sm:text-3xl font-bold text-green-900 tabular-nums leading-tight">₹{new Intl.NumberFormat('en-IN').format(userRole === 'admin' ? metrics.totalRevenue : 0)}</div>
         </div>
         <div className="bg-gray-50 dark:bg-violet-950/30 border border-gray-100 dark:border-violet-500/15 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-sm">
            <span className="text-[9px] sm:text-[10px] font-bold text-gray-600 dark:text-violet-300/85 uppercase tracking-wide block mb-0.5">Booked</span>
            <div className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-violet-100 tabular-nums">{metrics.bookedTickets}</div>
         </div>
      </div>

      {loading ? (
         <div className="flex min-h-[12rem] items-center justify-center bg-white dark:bg-[var(--card-bg)] rounded-xl border border-gray-100 dark:border-violet-500/15 shadow-sm">
            <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 text-primary animate-spin" />
         </div>
      ) : (
         <div className="bg-white dark:bg-[var(--card-bg)] rounded-xl sm:rounded-2xl border border-gray-100 dark:border-violet-500/15 shadow-sm overflow-hidden">
            <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-gray-100 flex items-center justify-between gap-2">
               <h2 className="text-sm sm:text-lg font-bold text-gray-900 dark:text-violet-100">Transactions</h2>
               <span className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-violet-400/60 shrink-0">{filteredTickets.length} rows</span>
            </div>

            {/* Mobile: stacked cards — no horizontal scroll */}
            <ul className="md:hidden divide-y divide-gray-100 list-none m-0 p-0">
               {filteredTickets.length === 0 ? (
                  <li className="px-4 py-12 text-center">
                     <FileSpreadsheet className="w-9 h-9 mx-auto text-gray-300 mb-2" />
                     <h3 className="text-sm font-bold text-gray-900 dark:text-violet-100">No transactions</h3>
                     <p className="text-xs text-gray-500 dark:text-violet-300/70 mt-1">Adjust filters</p>
                  </li>
               ) : (
                  filteredTickets.map(t => {
                     const d = new Date(t.created_at);
                     const formattedDate = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
                     const formattedTime = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                     let statusBadge = "bg-yellow-50 text-yellow-700 border-yellow-200";
                     if (t.status === 'checked_in') statusBadge = "bg-green-50 text-green-700 border-green-200";
                     else if (t.status === 'cancelled') statusBadge = "bg-red-50 text-red-700 border-red-200";
                     return (
                        <li key={t.id} className="px-4 py-3 active:bg-gray-50/80">
                           <div className="flex justify-between items-start gap-2 mb-1">
                              <div className="min-w-0">
                                 <p className="text-sm font-bold text-gray-900 dark:text-violet-100 truncate">{t.purchaser_name || "Unknown"}</p>
                                 <p className="text-[11px] text-gray-500 dark:text-violet-300/70 font-mono">#{String(t.id).split('-')[0].toUpperCase()}</p>
                              </div>
                              <span className="text-sm font-bold text-gray-900 dark:text-violet-100 shrink-0 tabular-nums">
                                 ₹{new Intl.NumberFormat("en-IN").format(ticketLineTotal(t))}
                              </span>
                           </div>
                           <div className="flex flex-wrap items-center gap-2 text-[11px]">
                              <span className="font-bold text-gray-600 dark:text-violet-300/85 bg-gray-100 px-1.5 py-0.5 rounded tabular-nums">
                                 Qty {ticketQuantity(t)}
                              </span>
                              <span className="font-bold text-gray-600 dark:text-violet-300/85 bg-gray-100 px-1.5 py-0.5 rounded uppercase">{t.type}</span>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge}`}>
                                 {t.status.replace('_', ' ')}
                              </span>
                              <span className="text-gray-400 dark:text-violet-400/60 ml-auto">{formattedDate} · {formattedTime}</span>
                           </div>
                        </li>
                     );
                  })
               )}
            </ul>

            <div className="hidden md:block overflow-x-auto">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="bg-gray-50/50 border-b border-gray-100">
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest">Order ID</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest">Purchaser</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest">Ticket Type</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest text-center">Qty</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest text-right">Amount</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest text-center">Status</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest text-right">Date</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                     {filteredTickets.length === 0 ? (
                        <tr>
                           <td colSpan={7} className="px-6 py-12 text-center">
                              <FileSpreadsheet className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                              <h3 className="text-base font-bold text-gray-900 dark:text-violet-100">No transactions found</h3>
                              <p className="text-sm text-gray-500 dark:text-violet-300/70 mt-1">Adjust your filters to see more results.</p>
                           </td>
                        </tr>
                     ) : (
                        filteredTickets.map(t => {
                           const d = new Date(t.created_at);
                           const formattedDate = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
                           const formattedTime = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                           
                           let statusBadge = "bg-yellow-50 text-yellow-700 border-yellow-200";
                           if (t.status === 'checked_in') statusBadge = "bg-green-50 text-green-700 border-green-200";
                           else if (t.status === 'cancelled') statusBadge = "bg-red-50 text-red-700 border-red-200";

                           return (
                              <tr key={t.id} className="hover:bg-gray-50/50 transition-colors group">
                                 <td className="px-6 py-4">
                                    <span className="text-xs font-bold text-gray-400 dark:text-violet-400/60 font-mono">#{t.id.split('-')[0].toUpperCase()}</span>
                                 </td>
                                 <td className="px-6 py-4">
                                    <div className="text-sm font-bold text-gray-800 dark:text-violet-200">{t.purchaser_name || "Unknown"}</div>
                                    <div className="text-[11px] font-medium text-gray-500 dark:text-violet-300/70">{t.purchaser_phone || "No phone linked"}</div>
                                 </td>
                                 <td className="px-6 py-4">
                                    <span className="text-xs font-bold text-gray-600 dark:text-violet-300/85 bg-gray-100 px-2 py-0.5 rounded uppercase tracking-tighter">{t.type}</span>
                                 </td>
                                 <td className="px-6 py-4 text-center">
                                    <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-violet-100">{ticketQuantity(t)}</span>
                                 </td>
                                 <td className="px-6 py-4 text-right">
                                    <span className="text-sm font-bold text-gray-900 dark:text-violet-100">₹{new Intl.NumberFormat('en-IN').format(ticketLineTotal(t))}</span>
                                 </td>
                                 <td className="px-6 py-4 text-center">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge}`}>
                                       {t.status.replace('_', ' ').toUpperCase()}
                                    </span>
                                 </td>
                                 <td className="px-6 py-4 text-right">
                                    <div className="text-sm font-bold text-gray-700 dark:text-violet-300">{formattedDate}</div>
                                    <div className="text-[11px] text-gray-400 dark:text-violet-400/60 font-medium">{formattedTime}</div>
                                 </td>
                              </tr>
                           )
                        })
                     )}
                  </tbody>
               </table>
            </div>
         </div>
      )}
    </div>
  );
}
