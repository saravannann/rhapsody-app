"use client";

import { useEffect, useState, useMemo } from "react";
import { Download, Search, Loader2, FileSpreadsheet, Filter, X, ChevronDown } from "lucide-react";
import { supabase } from "@/utils/supabase";

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
    const revenue = filteredTickets.reduce((acc, t) => acc + (Number(t.price) || 0), 0);
    const bookedCount = filteredTickets.filter(t => t.status === 'booked' || t.status === 'pending').length;
    
    return {
      totalEntries: filteredTickets.length,
      totalTickets: filteredTickets.length, // Mapping 1:1 for now
      totalRevenue: revenue,
      bookedTickets: bookedCount
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
    
    const headers = ["Order ID", "Purchaser Name", "Purchaser Phone", "Ticket Type", "Amount", "Status", "Sold By", "Date"];
    const rows = filteredTickets.map(t => [
      t.id,
      t.purchaser_name || "N/A",
      t.purchaser_phone || "N/A",
      t.type,
      t.price,
      t.status,
      t.sold_by || "N/A",
      new Date(t.created_at).toLocaleString()
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
    <div className="w-full pb-12 animate-in fade-in duration-500">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sales Report</h1>
          <p className="text-gray-500 mt-1 text-sm font-medium italic">Filter and export ticket sales data</p>
        </div>
        
        <button 
          onClick={handleExport}
          className="flex items-center justify-center bg-[#10b981] hover:bg-[#059669] text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md shadow-green-500/20 whitespace-nowrap active:scale-95"
        >
          <Download className="w-4 h-4 mr-2" /> Export to Excel
        </button>
      </div>

      {/* Filters Row */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
           <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center">
             <Filter className="w-3.5 h-3.5 mr-2" /> Filters
           </h3>
           <button onClick={clearFilters} className="text-xs font-bold text-primary hover:underline">Clear All</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           {/* Search */}
           <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                 value={searchQuery}
                 onChange={e => setSearchQuery(e.target.value)}
                 placeholder="Name, phone, email, or ticket ID" 
                 className="w-full bg-gray-50 border border-transparent focus:bg-white focus:border-primary/30 rounded-xl pl-9 pr-4 py-3 text-sm font-medium transition-all outline-none"
              />
           </div>

           {/* Ticket Type */}
           <div className="relative">
              <select 
                value={ticketTypeFilter}
                onChange={e => setTicketTypeFilter(e.target.value)}
                className="w-full bg-gray-50 border border-transparent rounded-xl px-4 py-3 text-sm font-bold text-gray-700 appearance-none outline-none focus:bg-white focus:border-primary/30"
              >
                <option>All Types</option>
                <option>Platinum</option>
                <option>Donor</option>
                <option>Bulk</option>
                <option>Student</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
           </div>

           {/* Payment Mode */}
           <div className="relative">
              <select 
                value={paymentModeFilter}
                onChange={e => setPaymentModeFilter(e.target.value)}
                className="w-full bg-gray-50 border border-transparent rounded-xl px-4 py-3 text-sm font-bold text-gray-700 appearance-none outline-none focus:bg-white focus:border-primary/30"
              >
                <option>All Modes</option>
                <option>Cash</option>
                <option>Online</option>
                <option>Complimentary</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
           </div>

           {/* Organiser POC */}
           <div className="relative">
              <select 
                value={pocFilter}
                disabled={userRole !== 'admin'}
                onChange={e => setPocFilter(e.target.value)}
                className="w-full bg-gray-50 border border-transparent rounded-xl px-4 py-3 text-sm font-bold text-gray-700 appearance-none outline-none focus:bg-white focus:border-primary/30 disabled:opacity-60"
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
              <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
           </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
         <div className="bg-purple-50 border border-purple-100 rounded-2xl p-5 shadow-sm">
            <span className="text-[10px] font-bold text-purple-600 uppercase tracking-widest block mb-1">Total Entries</span>
            <div className="text-3xl font-bold text-purple-900">{metrics.totalEntries}</div>
         </div>
         <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 shadow-sm">
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block mb-1">Total Tickets</span>
            <div className="text-3xl font-bold text-blue-900">{metrics.totalTickets}</div>
         </div>
         <div className="bg-green-50 border border-green-100 rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-start">
               <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest block mb-1">Total Revenue</span>
               {userRole !== 'admin' && <span className="text-[8px] font-bold bg-green-200 text-green-700 px-1.5 py-0.5 rounded leading-none">Admin only</span>}
            </div>
            <div className="text-3xl font-bold text-green-900">₹{new Intl.NumberFormat('en-IN').format(userRole === 'admin' ? metrics.totalRevenue : 0)}</div>
         </div>
         <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 shadow-sm">
            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest block mb-1">Booked Tickets</span>
            <div className="text-3xl font-bold text-gray-900">{metrics.bookedTickets}</div>
         </div>
      </div>

      {loading ? (
         <div className="flex h-64 items-center justify-center bg-white rounded-2xl border border-gray-100 shadow-sm">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
         </div>
      ) : (
         <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)] overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
               <h2 className="text-lg font-bold text-gray-900">All Sales Transactions</h2>
               <span className="text-xs font-bold text-gray-400">{filteredTickets.length} results found</span>
            </div>
            <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="bg-gray-50/50 border-b border-gray-100">
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Order ID</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Purchaser</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ticket Type</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Amount</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Status</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Date</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                     {filteredTickets.length === 0 ? (
                        <tr>
                           <td colSpan={6} className="px-6 py-16 text-center">
                              <FileSpreadsheet className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                              <h3 className="text-base font-bold text-gray-900">No transactions found</h3>
                              <p className="text-sm text-gray-500 mt-1">Adjust your filters to see more results.</p>
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
                                    <span className="text-xs font-bold text-gray-400 font-mono">#{t.id.split('-')[0].toUpperCase()}</span>
                                 </td>
                                 <td className="px-6 py-4">
                                    <div className="text-sm font-bold text-gray-800">{t.purchaser_name || "Unknown"}</div>
                                    <div className="text-[11px] font-medium text-gray-500">{t.purchaser_phone || "No phone linked"}</div>
                                 </td>
                                 <td className="px-6 py-4">
                                    <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded uppercase tracking-tighter">{t.type}</span>
                                 </td>
                                 <td className="px-6 py-4 text-right">
                                    <span className="text-sm font-bold text-gray-900">₹{new Intl.NumberFormat('en-IN').format(t.price || 0)}</span>
                                 </td>
                                 <td className="px-6 py-4 text-center">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge}`}>
                                       {t.status.replace('_', ' ').toUpperCase()}
                                    </span>
                                 </td>
                                 <td className="px-6 py-4 text-right">
                                    <div className="text-sm font-bold text-gray-700">{formattedDate}</div>
                                    <div className="text-[11px] text-gray-400 font-medium">{formattedTime}</div>
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
