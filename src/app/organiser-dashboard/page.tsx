"use client";

import { useEffect, useState } from "react";
import { Ticket, TrendingUp, Calendar, Target, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/utils/supabase";

export default function OrganiserDashboard() {
  const [loading, setLoading] = useState(true);
  const [overall, setOverall] = useState({ sold: 0, target: 205, revenue: 0 });
  const [ticketData, setTicketData] = useState([
    { name: "Platinum Pass", id: "Platinum", sold: 0, target: 50 },
    { name: "Donor Pass", id: "Donor", sold: 0, target: 15 },
    { name: "Bulk Pass", id: "Bulk", sold: 0, target: 100 },
    { name: "Student Pass", id: "Student", sold: 0, target: 40 }
  ]);

  useEffect(() => {
    async function loadData() {
      try {
        const savedName = localStorage.getItem('rhapsody_user') || '';
        let query = supabase.from("tickets").select("*");
        
        if (savedName) {
           query = query.eq('sold_by', savedName);
        }

        const { data: tickets } = await query;
        const t = tickets || [];
        
        let personalRev = 0;
        const typeCounts: Record<string, number> = { 'Platinum': 0, 'Donor': 0, 'Bulk': 0, 'Student': 0 };
        
        t.forEach(ticket => {
          personalRev += Number(ticket.price || 0);
          const tType = ticket.type;
          if (typeCounts[tType] !== undefined) {
             typeCounts[tType]++;
          }
        });

        setTicketData(prev => prev.map(item => ({
             ...item,
             sold: typeCounts[item.id] || 0
        })));

        setOverall(prev => ({ 
           ...prev, 
           sold: t.length,
           revenue: personalRev
        }));

      } catch (error) {
        console.error("Error fetching organiser data:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const totalProgressPercentage = overall.target > 0 ? Math.min(100, (overall.sold / overall.target) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-4 sm:space-y-6 max-w-6xl mx-auto">
      
      {/* Header — compact; actions full-width on small screens */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-secondary to-primary leading-tight">
            My Dashboard
          </h1>
          <p className="text-gray-500 dark:text-violet-300/70 mt-0.5 text-xs sm:text-sm font-medium">Your ticket sales at a glance</p>
        </div>
        
        <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 w-full sm:w-auto">
           <button
             type="button"
             onClick={() => window.location.href='/organiser-dashboard/sales'}
             className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-xl bg-white dark:bg-[var(--card-bg)] border border-pink-100 dark:border-violet-500/20 hover:bg-pink-50 dark:hover:bg-violet-950/40 text-gray-800 dark:text-violet-200 font-bold text-xs sm:text-sm shadow-sm transition-all"
           >
             <TrendingUp className="w-4 h-4 mr-2 text-secondary shrink-0" /> Sales
           </button>
           <button
             type="button"
             onClick={() => window.location.href='/organiser-dashboard/sell'}
             className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary hover:from-primary-dark hover:to-primary text-white font-bold text-xs sm:text-sm shadow-md transition-all"
           >
             <Ticket className="w-4 h-4 mr-2 shrink-0" /> Sell ticket
           </button>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[12rem] items-center justify-center rounded-xl border border-pink-50 dark:border-violet-500/18 bg-white dark:bg-[var(--card-bg)]">
             <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 text-primary animate-spin" />
        </div>
      ) : (
        <>
          {/* Performance — dense on mobile: 2-col metrics + slim countdown */}
          <div className="bg-white dark:bg-[var(--card-bg)] rounded-xl sm:rounded-2xl shadow-sm border border-pink-100/80 dark:border-violet-500/18 overflow-hidden relative">
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 dark:divide-violet-500/15">
                <div className="p-4 sm:p-5 relative">
                   <div className="flex items-center gap-2 mb-1">
                      <Target className="w-4 h-4 sm:w-5 sm:h-5 text-accent shrink-0" />
                      <h3 className="text-sm font-bold text-gray-900 dark:text-violet-100">Sales progress</h3>
                   </div>
                   <p className="text-[11px] sm:text-xs text-gray-500 dark:text-violet-300/70 font-medium mb-3 line-clamp-2">Tickets sold vs your target</p>
                   
                   <div className="flex items-end gap-2 mb-2">
                      <span className="text-2xl sm:text-4xl font-bold text-primary tabular-nums">{overall.sold}</span>
                      <span className="text-lg sm:text-2xl font-bold text-gray-400 dark:text-violet-400/60 mb-0.5 tabular-nums">/ {overall.target}</span>
                   </div>
                   
                   <div className="w-full bg-[#fdfaff] border border-pink-100 rounded-full h-3 sm:h-4 mb-1.5 overflow-hidden">
                      <div className="bg-gradient-to-r from-primary to-secondary h-full rounded-full transition-all duration-500" style={{ width: `${totalProgressPercentage}%` }} />
                   </div>
                   <p className="text-[11px] sm:text-sm font-bold text-accent">{totalProgressPercentage}% of target</p>
                </div>

                <div className="p-4 sm:p-5 bg-gray-50/50 dark:bg-violet-950/25 relative">
                   <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500 shrink-0" />
                      <h3 className="text-sm font-bold text-gray-900 dark:text-violet-100">My revenue</h3>
                   </div>
                   <p className="text-[11px] sm:text-xs text-gray-500 dark:text-violet-300/70 font-medium mb-3">From your sales</p>
                   
                   <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-base font-bold text-gray-400 dark:text-violet-400/60">₹</span>
                      <span className="text-2xl sm:text-4xl font-bold text-gray-900 dark:text-violet-100 tabular-nums leading-none">{new Intl.NumberFormat('en-IN').format(overall.revenue)}</span>
                   </div>
                   
                   <div className="inline-flex items-center text-[10px] sm:text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                      <CheckCircle2 className="w-3 h-3 mr-1 shrink-0" /> Live sync
                   </div>
                </div>

                <div className="p-4 sm:p-5 flex flex-row sm:flex-col items-center justify-between sm:justify-center gap-3 sm:text-center lg:min-w-[140px] bg-white dark:bg-violet-950/20">
                   <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-secondary shrink-0 sm:mx-auto" />
                   <div>
                      <div className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-violet-100 tabular-nums">15</div>
                      <p className="text-[10px] font-bold text-gray-500 dark:text-violet-300/70 uppercase tracking-wide">Days to event</p>
                   </div>
                </div>
             </div>
          </div>

          {/* Category grid — 2×2 on phones */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            {ticketData.map(item => {
              const perc = item.target > 0 ? Math.min(100, Math.floor((item.sold / item.target) * 100)) : 0;
              const remain = Math.max(0, item.target - item.sold);
              
              return (
                 <div key={item.name} className="bg-white dark:bg-[var(--card-bg)] rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm border border-pink-50/80 hover:border-primary/30 transition-colors">
                    <div className="flex justify-between items-start gap-1 mb-2">
                       <h3 className="text-[11px] sm:text-sm font-bold text-gray-900 dark:text-violet-100 leading-tight line-clamp-2">{item.name}</h3>
                       <span className="shrink-0 bg-pink-50 text-secondary text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded">{perc}%</span>
                    </div>
                    
                    <div className="flex items-end gap-1 mb-2">
                      <span className="text-lg sm:text-2xl font-bold text-primary tabular-nums">{item.sold}</span>
                      <span className="text-xs sm:text-lg font-bold text-gray-300 tabular-nums">/ {item.target}</span>
                    </div>
                    
                    <div className="w-full bg-[#fdfaff] border border-pink-100 rounded-full h-1.5 sm:h-2 mb-1.5 overflow-hidden">
                      <div className="bg-gradient-to-r from-primary to-secondary h-full rounded-full transition-all duration-500" style={{ width: `${perc}%` }} />
                    </div>
                    
                    <p className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-violet-300/70 line-clamp-2">{remain > 0 ? `${remain} to target` : 'Target met'}</p>
                 </div>
              );
            })}
          </div>

        </>
      )}
      
    </div>
  );
}
