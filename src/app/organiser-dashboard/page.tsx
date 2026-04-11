"use client";

import { useEffect, useState } from "react";
import { Ticket, TrendingUp, Calendar, Target, Loader2, CheckCircle2, IndianRupee } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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
        
        // Strictly filter by their own name for privacy
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

  // Pre-calculate data for chart consumption mapping progress %
  const chartData = ticketData.map(t => ({
      name: t.id,
      Progress: t.target > 0 ? Math.min(100, Math.floor((t.sold / t.target) * 100)) : 0
  }));

  return (
    <div className="space-y-8">
      
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-secondary to-primary">My Dashboard</h1>
          <p className="text-gray-500 mt-1 text-sm font-medium">Track your ticket sales performance</p>
        </div>
        
        <div className="flex items-center gap-3">
           <button onClick={() => window.location.href='/organiser-dashboard/sales'} className="flex items-center justify-center bg-white border border-pink-100 hover:bg-pink-50 text-gray-800 font-bold py-2.5 px-6 rounded-xl transition-all shadow-sm">
             <TrendingUp className="w-4 h-4 mr-2 text-secondary" /> View Sales Report
           </button>
           <button onClick={() => window.location.href='/organiser-dashboard/sell'} className="flex items-center justify-center bg-gradient-to-r from-primary to-secondary hover:from-primary-dark hover:to-primary text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-pink-500/30 transition-all">
             <Ticket className="w-4 h-4 mr-2" /> Sell New Ticket
           </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
             <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : (
        <>
          {/* Your Performance Banner */}
          <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(236,72,153,0.06)] border border-pink-50 relative overflow-hidden flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-gray-100 hover:border-pink-200 transition-colors">
             <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                <Target className="w-32 h-32" />
             </div>

             {/* Personal Sales Metric */}
             <div className="flex-1 p-8 z-10 w-full relative">
                <div className="flex items-center gap-2 mb-2">
                   <Target className="w-5 h-5 text-accent" />
                   <h3 className="text-lg font-bold text-gray-900">Your Sales Progress</h3>
                </div>
                <p className="text-sm text-gray-500 font-medium mb-6">Total tickets sold vs your individual target</p>
                
                <div className="flex items-end gap-3 mb-3">
                   <span className="text-4xl font-bold text-primary">{overall.sold}</span>
                   <span className="text-2xl font-bold text-gray-400 mb-1">/ {overall.target}</span>
                </div>
                
                <div className="w-full bg-[#fdfaff] border border-pink-100 rounded-full h-4 mb-2 overflow-hidden shadow-inner max-w-md">
                   <div className="bg-gradient-to-r from-primary to-secondary h-4 rounded-full transition-all duration-500" style={{ width: `${totalProgressPercentage}%` }}></div>
                </div>
                <p className="text-sm font-bold text-accent">{totalProgressPercentage}% of target achieved</p>
             </div>

             {/* Personal Revenue Metric - REPLACING "Admin Only" placeholder logic */}
             <div className="flex-1 p-8 z-10 w-full relative bg-gray-50/50">
                <div className="flex items-center gap-2 mb-2">
                   <TrendingUp className="w-5 h-5 text-emerald-500" />
                   <h3 className="text-lg font-bold text-gray-900">My Revenue</h3>
                </div>
                <p className="text-sm text-gray-500 font-medium mb-6">Total earnings from your personal sales</p>
                
                <div className="flex items-baseline gap-1 mb-8">
                   <span className="text-lg font-bold text-gray-400 mr-1">₹</span>
                   <span className="text-4xl font-bold text-gray-900">{new Intl.NumberFormat('en-IN').format(overall.revenue)}</span>
                </div>
                
                <div className="flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg w-fit border border-emerald-100">
                   <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> 
                   Live Earnings Linked
                </div>
             </div>

             {/* Event Countdown Card inset */}
             <div className="p-8 text-center z-10 min-w-[200px] flex flex-col justify-center items-center bg-white">
                <Calendar className="w-6 h-6 text-secondary mx-auto mb-2" />
                <div className="text-3xl font-bold text-gray-900 my-1">15</div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Days Until Event</p>
             </div>
          </div>

          {/* Ticket Category Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {ticketData.map(item => {
              const perc = item.target > 0 ? Math.min(100, Math.floor((item.sold / item.target) * 100)) : 0;
              const remain = Math.max(0, item.target - item.sold);
              
              return (
                 <div key={item.name} className="bg-white rounded-2xl p-6 shadow-[0_4px_24px_rgba(236,72,153,0.06)] border border-pink-50 hover:border-primary transition-colors cursor-default">
                    <div className="flex justify-between items-start mb-4">
                       <h3 className="text-sm font-bold text-gray-900">{item.name}</h3>
                       <span className="bg-pink-50 text-secondary text-xs font-bold px-2 py-1 rounded-md">{perc}%</span>
                    </div>
                    
                    <div className="flex items-end gap-2 mb-4">
                      <span className="text-2xl font-bold text-primary">{item.sold}</span>
                      <span className="text-lg font-bold text-gray-300">/ {item.target}</span>
                    </div>
                    
                    <div className="w-full bg-[#fdfaff] border border-pink-100 rounded-full h-2 mb-3 overflow-hidden">
                      <div className="bg-gradient-to-r from-primary to-secondary h-2 rounded-full transition-all duration-500" style={{ width: `${perc}%` }}></div>
                    </div>
                    
                    <p className="text-xs font-medium text-gray-500">{remain > 0 ? `${remain} more to reach target` : 'Target Exceeded!'}</p>
                 </div>
              );
            })}
          </div>

        </>
      )}
      
    </div>
  );
}
