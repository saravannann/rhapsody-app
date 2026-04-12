"use client";

import { useEffect, useState } from "react";
import { Ticket, TrendingUp, Calendar, Target, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/utils/supabase";
import {
  buildTargetRowsFromProfile,
  soldCountsFromTickets,
  totalPassTarget,
} from "@/utils/pass-targets";
import { ticketLineTotal, ticketQuantity } from "@/utils/ticket-counts";

export default function OrganiserDashboard() {
  const [loading, setLoading] = useState(true);
  const [overall, setOverall] = useState({ sold: 0, target: 0, revenue: 0, trustRevenue: 0, organizerRevenue: 0 });
  const [ticketData, setTicketData] = useState<
    { name: string; sold: number; target: number }[]
  >([
    { name: "Platinum Pass", sold: 0, target: 50 },
    { name: "Donor Pass", sold: 0, target: 15 },
    { name: "Student Pass", sold: 0, target: 40 },
  ]);

  useEffect(() => {
    async function loadData() {
      try {
        const savedName = localStorage.getItem("rhapsody_user") || "";
        const phone = localStorage.getItem("rhapsody_phone") || "";

        let ticketsQuery = supabase.from("tickets").select("*");
        if (savedName) {
          ticketsQuery = ticketsQuery.eq("sold_by", savedName);
        }

        const profilePromise = phone
          ? supabase
            .from("profiles")
            .select("pass_targets")
            .eq("phone", phone)
            .maybeSingle()
          : Promise.resolve({ data: null as { pass_targets: unknown } | null });

        const [{ data: tickets }, { data: profileRow }] = await Promise.all([
          ticketsQuery,
          profilePromise,
        ]);

        const t = tickets || [];

        let personalRev = 0;
        let trustRevenue = 0;
        let organizerRevenue = 0;
        t.forEach((ticket) => {
          const lineTot = ticketLineTotal(ticket);
          personalRev += lineTot;
          if (ticket.funds_destination === 'trust') {
            trustRevenue += lineTot;
          } else {
            organizerRevenue += lineTot;
          }
        });

        const soldByName = soldCountsFromTickets(t);
        const rows = buildTargetRowsFromProfile(
          profileRow?.pass_targets,
          soldByName
        );

        setTicketData(
          rows
            .filter((r) => r.name !== "Bulk Tickets")
            .map((r) => ({
              name: r.name,
              sold: r.sold,
              target: r.target,
            }))
        );

        const passesSold = t.reduce((sum, x) => sum + ticketQuantity(x), 0);
        setOverall((prev) => ({
          ...prev,
          sold: passesSold,
          revenue: personalRev,
          trustRevenue,
          organizerRevenue,
          target: totalPassTarget(profileRow?.pass_targets),
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-x-4 gap-y-2 min-w-0">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-secondary to-primary leading-tight">
              My Dashboard
            </h1>
            <p className="text-gray-500 dark:text-violet-300/70 mt-0.5 text-xs sm:text-sm font-medium">Your ticket sales at a glance</p>
          </div>

          {/* Dynamic Countdown Inline */}
          {(() => {
            const eventDate = new Date('2026-05-09T16:30:00');
            const diffTime = eventDate.getTime() - new Date().getTime();
            const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return (
              <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 bg-white dark:bg-violet-950/25 border border-pink-100 dark:border-violet-500/20 rounded-full shadow-sm animate-pulse-soft cursor-default">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary"></span>
                </span>
                <div className="text-xs sm:text-sm font-bold text-gray-900 dark:text-violet-100 tabular-nums">
                  {days > 0 ? days : 0} <span className="text-secondary uppercase tracking-wide ml-0.5 text-[10px] sm:text-xs">Days to go · Rhapsody</span>
                </div>
              </div>
            );
          })()}
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 w-full lg:w-auto">
          <button
            type="button"
            onClick={() => window.location.href = '/organiser-dashboard/sales'}
            className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-xl bg-white dark:bg-[var(--card-bg)] border border-pink-100 dark:border-violet-500/20 hover:bg-pink-50 dark:hover:bg-violet-950/40 text-gray-800 dark:text-violet-200 font-bold text-xs sm:text-sm shadow-sm transition-all"
          >
            <TrendingUp className="w-4 h-4 mr-2 text-secondary shrink-0" /> Sales
          </button>
          <button
            type="button"
            onClick={() => window.location.href = '/organiser-dashboard/sell'}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 dark:divide-violet-500/15">
              <div className="p-4 sm:p-5 relative">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 sm:w-5 sm:h-5 text-accent shrink-0" />
                  <h3 className="text-sm font-bold text-gray-900 dark:text-violet-100">Sales progress</h3>
                </div>
                <p className="text-[11px] sm:text-xs text-gray-500 dark:text-violet-300/70 font-medium mb-3 line-clamp-2">Tickets Sold vs your target</p>

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
                  <h3 className="text-sm font-bold text-gray-900 dark:text-violet-100">My Revenue</h3>
                </div>
                <p className="text-[11px] sm:text-xs text-gray-500 dark:text-violet-300/70 font-medium mb-3">From your sales</p>

                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-base font-bold text-gray-400 dark:text-violet-400/60">₹</span>
                  <span className="text-2xl sm:text-4xl font-bold text-gray-900 dark:text-violet-100 tabular-nums leading-none">{new Intl.NumberFormat('en-IN').format(overall.revenue)}</span>
                </div>

                <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                  <div className="bg-white/80 dark:bg-violet-950/40 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded border border-green-200 dark:border-green-500/20 text-[9px] font-bold">
                    Trust: ₹{new Intl.NumberFormat('en-IN').format(overall.trustRevenue)}
                  </div>
                  <div className="bg-white/80 dark:bg-violet-950/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/20 text-[9px] font-bold">
                    Org: ₹{new Intl.NumberFormat('en-IN').format(overall.organizerRevenue)}
                  </div>
                </div>

                <div className="inline-flex items-center text-[10px] sm:text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 mt-1">
                  <CheckCircle2 className="w-3 h-3 mr-1 shrink-0" /> Live sync
                </div>
              </div>
            </div>
          </div>

          {/* Category grid — 2×2 on phones */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
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
