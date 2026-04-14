"use client";

import React, { useEffect, useState, useMemo, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Download, Search, Loader2, FileSpreadsheet, Filter, ChevronDown, MessageCircle, CheckSquare, Square, Check, RefreshCw, Calendar, Ticket, CreditCard, MessageSquare, User } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { ticketLineTotal, ticketQuantity, ticketUnitPrice } from "@/utils/ticket-counts";
import { shortTicketRef } from "@/utils/ticket-qr";
import { buildTicketWhatsAppMessage, buildWhatsAppSendUrl } from "@/utils/whatsapp-ticket";

interface Ticket {
  id: string;
  created_at: string;
  purchaser_name: string | null;
  purchaser_phone: string | null;
  type: string;
  price: number;
  quantity: number;
  status: string;
  funds_destination: string;
  bank_txn_id: string | null;
  sold_by: string | null;
  whatsapp_status: string | null;
  whatsapp_error: string | null;
  last_whatsapp_at: string | null;
  sequence_number: number | null;
  checked_in_count?: number;
}

interface TotalMetrics {
  totalEntries: number;
  totalTickets: number;
  totalRevenue: number;
  trustRevenue: number;
  organizerRevenue: number;
  bookedTickets: number;
}

/** One display name per seller (lower-case key → canonical string from DB). */
function buildSellerOptions(
  tickets: { sold_by?: string | null }[],
  profiles: { name?: string | null }[]
): string[] {
  const map = new Map<string, string>();
  for (const t of tickets) {
    const s = t.sold_by?.trim();
    if (!s) continue;
    const low = s.toLowerCase();
    if (!map.has(low)) map.set(low, s);
  }
  for (const p of profiles) {
    const s = p.name?.trim();
    if (!s) continue;
    const low = s.toLowerCase();
    if (!map.has(low)) map.set(low, s);
  }
  return [...map.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function SalesReportContent() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const PAGE_SIZE = 50;
  const [totalMetrics, setTotalMetrics] = useState<TotalMetrics>({
    totalEntries: 0, totalTickets: 0, totalRevenue: 0, trustRevenue: 0, organizerRevenue: 0, bookedTickets: 0
  });
  const [fetchError, setFetchError] = useState<string | null>(null);
  const observerTarget = useRef<HTMLDivElement>(null);
  const pageRef = useRef(0);

  // Role Context
  const [userRole, setUserRole] = useState('organiser');
  const [userName, setUserName] = useState('');

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [ticketTypeFilter, setTicketTypeFilter] = useState('All Types');
  const [fundsFilter, setFundsFilter] = useState('All Destinations');
  const [pocFilter, setPocFilter] = useState('All Organisers');
  const [waFilter, setWaFilter] = useState('All WA Status');
  const [dateFilter, setDateFilter] = useState('All Time');
  const [sellerOptions, setSellerOptions] = useState<string[]>([]);

  // Selection & Actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [appOrigin, setAppOrigin] = useState("");
  const [resendQueue, setResendQueue] = useState<Ticket[] | null>(null);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [isBulkResending, setIsBulkResending] = useState(false);
  const [bulkResendProgress, setBulkResendProgress] = useState(0);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [tempPhone, setTempPhone] = useState("");

  useEffect(() => {
    setAppOrigin(typeof window !== "undefined" ? window.location.origin : "");

    // Sync roles and handle initial Seller Options for admins
    const savedRole = localStorage.getItem('rhapsody_role') || 'organiser';
    const savedName = localStorage.getItem('rhapsody_user') || '';
    setUserRole(savedRole);
    setUserName(savedName);

    if (savedRole === 'organiser' && savedName) {
      setPocFilter(savedName);
    }
  }, []);

  // Handle URL parameters
  const searchParams = useSearchParams();
  useEffect(() => {
    const wa = searchParams.get('waFilter');
    if (wa) setWaFilter(wa);

    const poc = searchParams.get('poc');
    if (poc) setPocFilter(poc);
  }, [searchParams]);

  const fetchSales = useCallback(async (isInitial = true) => {
    try {
      setFetchError(null);
      if (isInitial) {
        setLoading(true);
        // Reset page to 0 immediately to avoid stale pagination calls
        setPage(0);
        pageRef.current = 0;
      } else {
        setIsFetchingMore(true);
      }

      const savedName = localStorage.getItem('rhapsody_user') || '';
      const savedRole = localStorage.getItem('rhapsody_role') || 'organiser';

      // Use pageRef for reliable pagination
      const targetPage = isInitial ? 0 : pageRef.current + 1;

      const start = targetPage * PAGE_SIZE;
      const end = start + PAGE_SIZE - 1;

      console.log(`[SalesFetch] Initial: ${isInitial}, TargetPage: ${targetPage}, Range: ${start}-${end}`);

      // Base query with exact count
      let query = supabase.from('tickets').select('*, sequence_number', { count: 'exact' });

      // Metrics query (for totals across all pages)
      let mQuery = supabase.from('tickets').select('type, funds_destination, status, price, quantity');

      const applyFilters = <T,>(q: T): T => {
        let res = q as any;
        if (savedRole === 'organiser' && savedName) {
          res = res.ilike('sold_by', savedName);
        } else if (pocFilter !== 'All Organisers') {
          res = res.ilike('sold_by', pocFilter);
        }

        if (searchQuery) {
          const s = `%${searchQuery}%`;
          
          // Smart Search: Handle the new R-SSSS-BBBBBBBB format
          const formattedMatch = searchQuery.match(/^R-(\d{1,4})-([A-Z0-9]{0,8})/i);
          const sequenceMatch = searchQuery.match(/^\d{1,4}$/); // Just the numbers
          const shortIdMatch = /^[0-9a-fA-F]{1,8}$/.test(searchQuery);

          let orConditions = `purchaser_name.ilike.${s},purchaser_phone.ilike.${s}`;

          if (formattedMatch) {
            const seq = parseInt(formattedMatch[1]);
            const base = formattedMatch[2];
            if (base) {
              orConditions += `,sequence_number.eq.${seq},id_text.ilike.${base}%`;
            } else {
              orConditions += `,sequence_number.eq.${seq}`;
            }
          } else if (sequenceMatch) {
            orConditions += `,sequence_number.eq.${parseInt(searchQuery)}`;
          } else if (shortIdMatch || searchQuery.length > 20) {
            orConditions += `,id_text.ilike.${searchQuery}%`;
          }

          res = res.or(orConditions);
        }

        if (ticketTypeFilter !== 'All Types') {
          res = res.eq('type', ticketTypeFilter);
        }

        if (fundsFilter !== 'All Destinations') {
          const dest = fundsFilter.toLowerCase();
          res = res.eq('funds_destination', dest);
        }

        if (waFilter !== 'All WA Status') {
          if (waFilter === 'not_sent') {
            res = res.or('whatsapp_status.is.null,whatsapp_status.eq.not_sent');
          } else {
            res = res.eq('whatsapp_status', waFilter);
          }
        }

        if (dateFilter !== 'All Time') {
          const now = new Date();
          let startDate = new Date();
          if (dateFilter === 'Today') {
            startDate.setHours(0, 0, 0, 0);
          } else if (dateFilter === 'Last 7 Days') {
            startDate.setDate(now.getDate() - 7);
          } else if (dateFilter === 'This Month') {
            startDate.setMonth(now.getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
          }
          res = res.gte('created_at', startDate.toISOString());
        }

        return res;
      };

      query = applyFilters(query);
      mQuery = applyFilters(mQuery);

      const [dataRes, metricsRes] = await Promise.all([
        query.order('created_at', { ascending: false }).order('id', { ascending: false }).range(start, end),
        isInitial ? mQuery : Promise.resolve({ data: null, error: null }) as Promise<{ data: Ticket[] | null; error: any | null }>
      ]);

      if (dataRes.error) throw dataRes.error;
      if (metricsRes.error) throw metricsRes.error;

      const data = (dataRes.data || []) as Ticket[];
      const mData = metricsRes.data;
      const totalCount = dataRes.count || 0;

      console.log(`[SalesFetch] Fetched ${data.length} records. Total matching: ${totalCount}`);

      if (isInitial) {
        setTickets(data);
        setPage(0);
        setHasMore(totalCount > data.length);

        if (savedRole === 'admin' && sellerOptions.length === 0) {
          const { data: profiles } = await supabase.from('profiles').select('name');
          setSellerOptions(buildSellerOptions(data, profiles || []));
        }
      } else {
        if (data.length > 0) {
          setTickets(prev => {
            const existingIds = new Set(prev.map(t => t.id));
            const uniqueNew = data.filter(t => !existingIds.has(t.id));
            const merged = [...prev, ...uniqueNew];
            setHasMore(merged.length < totalCount);
            return merged;
          });
          setPage(targetPage);
          pageRef.current = targetPage;
        } else {
          setHasMore(false);
          console.log("[SalesFetch] No more data returned for subsequent page.");
        }
      }

      if (isInitial && mData) {
        let rev = 0, tRev = 0, oRev = 0, bPasses = 0, totalPasses = 0;
        mData.forEach(t => {
          const q = ticketQuantity(t);
          const line = ticketLineTotal(t);
          rev += line;
          if (t.funds_destination === 'trust') tRev += line;
          else oRev += line;
          if (t.status === 'booked' || t.status === 'pending' || t.status === 'ticket_issued') bPasses += q;
          totalPasses += q;
        });
        setTotalMetrics({
          totalEntries: totalCount,
          totalTickets: totalPasses,
          totalRevenue: rev,
          trustRevenue: tRev,
          organizerRevenue: oRev,
          bookedTickets: bPasses
        });
      }

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : (typeof err === 'string' ? err : JSON.stringify(err));
      console.error("Sales Fetch Error:", errMsg);
      setFetchError(errMsg);
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
    }
  }, [PAGE_SIZE, pocFilter, searchQuery, ticketTypeFilter, fundsFilter, waFilter, dateFilter, sellerOptions.length]);

  useEffect(() => {
    fetchSales(true);
  }, [fetchSales]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSales(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchSales]);

  // Infinite Scroll Observer
  useEffect(() => {
    if (!hasMore || isFetchingMore || loading) return;

    const currentTarget = observerTarget.current;
    const observer = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]) => {
        if (entries[0].isIntersecting) {
          console.log("Observer triggered: Fetching page", pageRef.current + 1);
          fetchSales(false);
        }
      },
      { threshold: 0, rootMargin: '200px' }
    );

    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
      observer.disconnect();
    };
  }, [hasMore, isFetchingMore, loading, page, fetchSales]);

  const filteredTickets = tickets;

  const metrics = totalMetrics;

  const clearFilters = () => {
    setSearchQuery('');
    setTicketTypeFilter('All Types');
    setFundsFilter('All Destinations');
    setWaFilter('All WA Status');
    setDateFilter('All Time');
    if (userRole === 'admin') setPocFilter('All Organisers');
    else setPocFilter(userName);
    setSelectedIds(new Set());
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTickets.length && filteredTickets.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTickets.map(t => t.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const startResendQueue = () => {
    if (selectedIds.size === 0) return;
    const toResend = tickets.filter(t => selectedIds.has(t.id));
    setResendQueue(toResend);
    setCurrentQueueIndex(0);
  };

  const sendCurrentFromQueue = async (mode: 'auto' | 'manual') => {
    if (!resendQueue) return;
    const t = resendQueue[currentQueueIndex];
    if (!t) return;

    const ticketLink = `${appOrigin}/ticket/${t.id}`;
    const message = buildTicketWhatsAppMessage({
      purchaserName: t.purchaser_name || "Guest",
      passLabel: t.type,
      quantity: ticketQuantity(t),
      totalInr: ticketLineTotal(t),
      ref: shortTicketRef(t.id, t.sequence_number),
      ticketPageUrl: ticketLink,
    });

    if (mode === 'auto') {
      try {
        const res = await fetch('/api/send-ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: t.purchaser_phone || "",
            ticketContent: message
          })
        });
        const data = await res.json();

        if (!data.success) {
          await supabase.from("tickets").update({
            whatsapp_status: 'failed',
            whatsapp_error: data.error
          }).eq('id', t.id);
          const isSandboxError = data.code === 131030;
          const alertMsg = isSandboxError
            ? `WhatsApp Sandbox Error: ${data.error}`
            : `Automated Send Failed: ${data.error}`;
          alert(alertMsg);
        } else {
          await supabase.from("tickets").update({
            whatsapp_status: 'sent',
            whatsapp_error: null,
            last_whatsapp_at: new Date().toISOString()
          }).eq('id', t.id);

          if (resendQueue.length === 1) {
            // Success for single selection
            setResendQueue(null);
            setSelectedIds(new Set());
            // Successfully resent
            fetchSales(true);
            setTimeout(() => setResendQueue(null), 1000);
          }
        }
      } catch (waErr) {
        console.error("WA Resend Prep Fail:", waErr);
      }
    } else {
      const url = buildWhatsAppSendUrl(t.purchaser_phone || "", message);
      window.open(url, '_blank');

      if (currentQueueIndex < resendQueue.length - 1) {
        setCurrentQueueIndex(prev => prev + 1);
      } else {
        setResendQueue(null);
        setSelectedIds(new Set());
      }
    }
  };

  const resendAllAutomated = async () => {
    if (!resendQueue) return;
    setIsBulkResending(true);
    setBulkResendProgress(0);

    for (let i = 0; i < resendQueue.length; i++) {
      const t = resendQueue[i];
      setBulkResendProgress(i + 1);

      const ticketLink = `${appOrigin}/ticket/${t.id}`;
      const message = buildTicketWhatsAppMessage({
        purchaserName: t.purchaser_name || "Guest",
        passLabel: t.type,
        quantity: ticketQuantity(t),
        totalInr: ticketLineTotal(t),
        ref: shortTicketRef(t.id, t.sequence_number),
        ticketPageUrl: ticketLink,
      });

      try {
        const res = await fetch('/api/send-ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: t.purchaser_phone || "", ticketContent: message })
        });
        const data = await res.json();

        await supabase.from("tickets").update({
          whatsapp_status: data.success ? 'sent' : 'failed',
          whatsapp_error: data.success ? null : data.error
        }).eq('id', t.id);
      } catch (e) {
        console.error("Bulk Send Fail for " + t.id, e);
      }

      // Brief pause to avoid rate limiting
      await new Promise(r => setTimeout(r, 800));
    }

    setIsBulkResending(false);
    setResendQueue(null);
    setSelectedIds(new Set());
    fetchSales(true);
  };

  const handleUpdatePhone = async () => {
    if (!resendQueue) return;
    const t = resendQueue[currentQueueIndex];
    if (!t) return;

    try {
      const { error } = await supabase.from("tickets")
        .update({ purchaser_phone: tempPhone })
        .eq('id', t.id);

      if (error) throw error;

      const updatedLocal = [...resendQueue];
      updatedLocal[currentQueueIndex] = { ...t, purchaser_phone: tempPhone };
      setResendQueue(updatedLocal);

      setIsEditingPhone(false);
      fetchSales(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert("Failed to update phone: " + msg);
    }
  };

  const closeResend = () => {
    setResendQueue(null);
    setSelectedIds(new Set());
    setIsBulkResending(false);
    setIsEditingPhone(false);
  };

  const advanceQueue = () => {
    if (!resendQueue) return;
    if (currentQueueIndex < resendQueue.length - 1) {
      setCurrentQueueIndex(prev => prev + 1);
    } else {
      setResendQueue(null);
      setSelectedIds(new Set());
    }
  };

  const handleExport = () => {
    if (filteredTickets.length === 0) return;

    const headers = [
      "Order ID",
      "Purchaser Name",
      "Purchaser Phone",
      "Ticket Type",
      "Qty",
      "Checked In",
      "Unit INR",
      "Line INR",
      "Status",
      "Paid To",
      "Bank Txn ID",
      "Sold By",
      "Date",
    ];
    const rows = filteredTickets.map((t) => [
      shortTicketRef(t.id, t.sequence_number),
      t.purchaser_name || "N/A",
      t.purchaser_phone || "N/A",
      t.type,
      ticketQuantity(t),
      t.checked_in_count || 0,
      ticketUnitPrice(t),
      ticketLineTotal(t),
      t.status,
      t.funds_destination === 'trust' ? 'Trust' : 'Organizer',
      t.bank_txn_id || "N/A",
      t.sold_by || "N/A",
      new Date(t.created_at).toLocaleString('en-IN', { hour12: true }),
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

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center justify-center min-h-[44px] bg-[#10b981] hover:bg-[#059669] text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-md shadow-green-500/20 active:scale-[0.98] text-sm"
          >
            <Download className="w-4 h-4 mr-2 shrink-0" /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters & Search Section */}
      <div className="bg-white/95 dark:bg-violet-950/20 backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-gray-100 dark:border-violet-500/20 shadow-xl shadow-purple-500/5 sticky top-16 z-30 transition-all duration-300">
        <div className="flex flex-col gap-6">
          {/* Top Row: Search & Date */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1 group">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors pointer-events-none" />
              <input
                type="search"
                enterKeyHint="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name, phone, or order ID..."
                className="w-full h-14 bg-gray-50/50 dark:bg-violet-950/40 border border-gray-100 dark:border-violet-500/10 focus:bg-white dark:focus:bg-violet-950/60 focus:border-primary/30 rounded-2xl pl-12 pr-4 py-2 text-sm sm:text-base font-medium transition-all outline-none shadow-sm"
              />
            </div>

            <div className="flex gap-3 min-w-0 lg:w-[420px]">
              <div className="relative flex-1">
                <Calendar className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-primary/60 pointer-events-none z-10" />
                <select
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                  className="w-full h-14 bg-white dark:bg-violet-950/40 border border-gray-100 dark:border-violet-500/10 hover:border-primary/20 rounded-2xl pl-10 pr-10 py-2 text-sm font-bold text-gray-700 dark:text-violet-200 appearance-none outline-none focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer shadow-sm"
                >
                  <option>All Time</option>
                  <option>Today</option>
                  <option>Last 7 Days</option>
                  <option>This Month</option>
                </select>
                <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>

              <button
                type="button"
                onClick={clearFilters}
                className="h-14 px-5 bg-gray-50 dark:bg-violet-900/20 hover:bg-gray-100 dark:hover:bg-violet-900/40 text-gray-500 dark:text-violet-300 font-bold rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 border border-transparent hover:border-gray-200"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Reset</span>
              </button>
            </div>
          </div>

          {/* Bottom Row: Detailed Filters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="relative group">
              <Ticket className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-purple-500/60 pointer-events-none z-10" />
              <select
                value={ticketTypeFilter}
                onChange={e => setTicketTypeFilter(e.target.value)}
                className="w-full h-12 bg-gray-50/50 dark:bg-violet-950/30 border border-gray-100 dark:border-violet-500/10 hover:border-purple-300/30 rounded-xl pl-10 pr-10 py-2 text-xs sm:text-sm font-bold text-gray-700 dark:text-violet-200 appearance-none outline-none focus:bg-white dark:focus:bg-violet-950/60 transition-all cursor-pointer"
              >
                <option>All Types</option>
                <option>Platinum</option>
                <option>Donor</option>
                <option>Student</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative group">
              <CreditCard className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500/60 pointer-events-none z-10" />
              <select
                value={fundsFilter}
                onChange={e => setFundsFilter(e.target.value)}
                className="w-full h-12 bg-gray-50/50 dark:bg-violet-950/30 border border-gray-100 dark:border-violet-500/10 hover:border-emerald-300/30 rounded-xl pl-10 pr-10 py-2 text-xs sm:text-sm font-bold text-gray-700 dark:text-violet-200 appearance-none outline-none focus:bg-white dark:focus:bg-violet-950/60 transition-all cursor-pointer"
              >
                <option>All Destinations</option>
                <option>Trust</option>
                <option>Organizer</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative group">
              <MessageSquare className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-blue-500/60 pointer-events-none z-10" />
              <select
                value={waFilter}
                onChange={e => setWaFilter(e.target.value)}
                className="w-full h-12 bg-gray-50/50 dark:bg-violet-950/30 border border-gray-100 dark:border-violet-500/10 hover:border-blue-300/30 rounded-xl pl-10 pr-10 py-2 text-xs sm:text-sm font-bold text-gray-700 dark:text-violet-200 appearance-none outline-none focus:bg-white dark:focus:bg-violet-950/60 transition-all cursor-pointer"
              >
                <option>All WA Status</option>
                <option value="sent">Sent Successfully</option>
                <option value="failed">Delivery Failed</option>
                <option value="not_sent">Not Sent</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative group">
              <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-orange-500/60 pointer-events-none z-10" />
              <select
                value={pocFilter}
                disabled={userRole !== 'admin'}
                onChange={e => setPocFilter(e.target.value)}
                className="w-full h-12 bg-gray-50/50 dark:bg-violet-950/30 border border-gray-100 dark:border-violet-500/10 hover:border-orange-300/30 rounded-xl pl-10 pr-10 py-2 text-xs sm:text-sm font-bold text-gray-700 dark:text-violet-200 appearance-none outline-none focus:bg-white dark:focus:bg-violet-950/60 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option>All Organisers</option>
                {userRole === 'admin'
                  ? sellerOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))
                  : userName && <option value={userName}>{userName}</option>}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
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
        <div className="bg-green-50 border border-green-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start gap-1">
              <span className="text-[9px] sm:text-[10px] font-bold text-green-600 uppercase tracking-wide block mb-0.5">Revenue</span>
            </div>
            <div className="text-xl sm:text-3xl font-bold text-green-900 tabular-nums leading-tight mb-1">₹{new Intl.NumberFormat('en-IN').format(metrics.totalRevenue)}</div>
          </div>
          <div className="flex items-center gap-2 text-[9px] font-bold">
            <div className="bg-white/60 text-green-700 px-1.5 py-0.5 rounded border border-green-200">
              Trust: ₹{new Intl.NumberFormat('en-IN').format(metrics.trustRevenue)}
            </div>
            <div className="bg-white/60 text-emerald-700 px-1.5 py-0.5 rounded border border-green-200">
              Org: ₹{new Intl.NumberFormat('en-IN').format(metrics.organizerRevenue)}
            </div>
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-violet-950/30 border border-gray-100 dark:border-violet-500/15 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-sm">
          <span className="text-[9px] sm:text-[10px] font-bold text-gray-600 dark:text-violet-300/85 uppercase tracking-wide block mb-0.5">Booked</span>
          <div className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-violet-100 tabular-nums">{metrics.bookedTickets}</div>
        </div>
      </div>

      <div className="relative group">
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/10 dark:bg-black/5 backdrop-blur-[1px] transition-all duration-300 rounded-2xl">
            <div className="p-3 bg-white dark:bg-violet-900 shadow-xl rounded-full border border-gray-100 dark:border-violet-500/30">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          </div>
        )}
        <div className={`transition-all duration-500 ${loading ? 'opacity-40 scale-[0.99] grayscale-[0.5]' : 'opacity-100 scale-100 grayscale-0'}`}>
          <div className="bg-white dark:bg-[var(--card-bg)] rounded-xl sm:rounded-2xl border border-gray-100 dark:border-violet-500/15 shadow-sm overflow-hidden">
            <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-gray-100 flex items-center justify-between gap-2 bg-white/50 dark:bg-violet-900/10">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleSelectAll}
                  className="p-1 -ml-1 text-gray-400 hover:text-primary transition-colors"
                >
                  {selectedIds.size === tickets.length && tickets.length > 0 ? (
                    <CheckSquare className="w-5 h-5 text-primary" />
                  ) : (
                    <Square className="w-5 h-5" />
                  )}
                </button>
                <h2 className="text-sm sm:text-lg font-bold text-gray-900 dark:text-violet-100">Transactions</h2>
              </div>
              <span className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-violet-400/60 shrink-0">
                {selectedIds.size > 0
                  ? `${selectedIds.size} selected`
                  : `Showing ${tickets.length} of ${metrics.totalEntries} total`}
              </span>
            </div>

            {/* Mobile: stacked cards — no horizontal scroll */}
            <ul className="md:hidden divide-y divide-gray-100 list-none m-0 p-0">
              {tickets.length === 0 ? (
                <li className="px-4 py-12 text-center">
                  <FileSpreadsheet className="w-9 h-9 mx-auto text-gray-300 mb-2" />
                  <h3 className="text-sm font-bold text-gray-900 dark:text-violet-100">No transactions</h3>
                  <p className="text-xs text-gray-500 dark:text-violet-300/70 mt-1">Adjust filters</p>
                </li>
              ) : (
                tickets.map(t => {
                  const d = new Date(t.created_at);
                  const formattedDate = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
                  const formattedTime = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                  const isSelected = selectedIds.has(t.id);
                  return (
                    <li key={t.id} className={`px-4 py-3 transition-colors ${isSelected ? 'bg-purple-50/50 dark:bg-primary/5' : 'active:bg-gray-50/80'}`}>
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleSelectOne(t.id)}
                          className="mt-1 shrink-0"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-primary" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-300" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
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
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${t.whatsapp_status === 'sent' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                              t.whatsapp_status === 'failed' ? 'bg-red-100 text-red-700 border-red-200' :
                                'bg-gray-100 text-gray-400 border-gray-200 text-[9px]'
                              }`}>
                              WA: {t.whatsapp_status?.replace('_', ' ') || 'not sent'}
                            </span>
                            <span className={`font-bold px-1.5 py-0.5 rounded border ${t.funds_destination === 'trust'
                              ? 'bg-blue-50 text-blue-700 border-blue-100'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              }`}>
                              {t.funds_destination === 'trust' ? 'TRUST' : 'ORG'}
                            </span>
                            {t.bank_txn_id && (
                              <span className="font-mono text-[9px] text-primary bg-primary/5 px-1 rounded border border-primary/10">
                                Txn: {t.bank_txn_id}
                              </span>
                            )}
                            <span className="text-gray-400 dark:text-violet-400/60 ml-auto">{formattedDate} · {formattedTime}</span>
                          </div>
                        </div>
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
                    <th className="px-6 py-4 w-10">
                      <button
                        onClick={toggleSelectAll}
                        className="text-gray-400 hover:text-primary transition-colors"
                      >
                        {selectedIds.size === filteredTickets.length && filteredTickets.length > 0 ? (
                          <CheckSquare className="w-5 h-5 text-primary" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest">Order ID</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest">Purchaser</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest">Ticket Type</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest text-center">Qty</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest text-right">Amount</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest text-center">Paid To</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest text-center">Txn ID</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest text-center">WA Status</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tickets.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center">
                        <FileSpreadsheet className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                        <h3 className="text-base font-bold text-gray-900 dark:text-violet-100">No transactions found</h3>
                        <p className="text-sm text-gray-500 dark:text-violet-300/70 mt-1">Adjust your filters to see more results.</p>
                      </td>
                    </tr>
                  ) : (
                    tickets.map(t => {
                      const d = new Date(t.created_at);
                      const formattedDate = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
                      const formattedTime = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

                      const isSelected = selectedIds.has(t.id);
                      return (
                        <tr key={t.id} className={`transition-colors group ${isSelected ? 'bg-purple-50/50 dark:bg-primary/5' : 'hover:bg-gray-50/50'}`}>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => toggleSelectOne(t.id)}
                              className={`${isSelected ? 'text-primary' : 'text-gray-300 group-hover:text-gray-400'} transition-colors`}
                            >
                              {isSelected ? (
                                <CheckSquare className="w-5 h-5" />
                              ) : (
                                <Square className="w-5 h-5" />
                              )}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-nowrap">
                            <span className="text-xs font-bold text-gray-400 dark:text-violet-400/60 font-mono">#{shortTicketRef(t.id, t.sequence_number)}</span>
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
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${t.funds_destination === 'trust'
                              ? 'bg-blue-50 text-blue-700 border-blue-100'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              }`}>
                              {t.funds_destination === 'trust' ? 'TRUST' : 'ORGANIZER'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-[10px] font-mono font-bold text-gray-400 dark:text-violet-400/60">
                              {t.bank_txn_id || "—"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${t.whatsapp_status === 'sent' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                t.whatsapp_status === 'failed' ? 'bg-red-50 text-red-700 border-red-200' :
                                  'bg-gray-50 text-gray-400 border-gray-200'
                                }`}>
                                {t.whatsapp_status?.replace('_', ' ').toUpperCase() || 'NOT SENT'}
                              </span>
                              {t.whatsapp_status === 'failed' && t.whatsapp_error && (
                                <span className="text-[9px] text-red-500 font-medium max-w-[100px] truncate" title={t.whatsapp_error}>
                                  {t.whatsapp_error}
                                </span>
                              )}
                            </div>
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

            {/* Sentinel for Infinite Scroll with manual fallback — OUTSIDE hidden md:block so it works on mobile */}
            <div
              ref={observerTarget}
              className="p-8 sm:p-10 flex flex-col items-center justify-center border-t dark:border-violet-500/10 min-h-[120px]"
            >
              {fetchError ? (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-sm font-bold text-red-500">Failed to load more data</p>
                  <button
                    onClick={() => fetchSales(false)}
                    className="px-6 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold transition-all border border-red-100 shadow-sm"
                  >
                    Try Again
                  </button>
                </div>
              ) : hasMore ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-3 text-gray-500 dark:text-violet-400 font-medium">
                    {isFetchingMore ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        <span className="text-sm">Loading more data...</span>
                      </>
                    ) : (
                      <span className="text-sm">Scroll for more results</span>
                    )}
                  </div>
                  <button
                    id="manual-load-link"
                    onClick={() => fetchSales(false)}
                    disabled={isFetchingMore}
                    className="text-xs font-bold text-primary hover:text-purple-700 transition-colors underline uppercase tracking-widest p-2"
                  >
                    {isFetchingMore ? 'Fetching...' : 'Click here to load more manually'}
                  </button>
                </div>
              ) : (tickets.length > 0 && metrics.totalEntries > 0) ? (
                <div className="flex flex-col items-center gap-1 py-4 text-emerald-500/80">
                  <Check className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em]">All {metrics.totalEntries} transactions loaded</span>
                </div>
              ) : tickets.length === 0 && !loading ? (
                <p className="text-sm text-gray-400">No transactions found</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Resend Queue Modal/Overlay */}
      {resendQueue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-violet-950 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 dark:border-violet-500/20 animate-in zoom-in-95 duration-300">
            <div className="p-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                <MessageCircle className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-violet-100 mb-1">Resend Ticket</h3>
              <p className="text-sm text-gray-500 dark:text-violet-300/70">
                Ticket {currentQueueIndex + 1} of {resendQueue.length}
              </p>

              {resendQueue.length > 1 && !isBulkResending ? (
                <div className="mt-6 p-6 bg-purple-50 dark:bg-violet-900/50 rounded-2xl border border-purple-100 dark:border-violet-500/20 text-center animate-in zoom-in-95 duration-200">
                  <div className="flex justify-center -space-x-3 mb-4">
                    {[...Array(Math.min(3, resendQueue.length))].map((_, i) => (
                      <div key={i} className="h-10 w-10 rounded-full bg-white dark:bg-violet-800 border-2 border-purple-200 dark:border-violet-700 flex items-center justify-center text-primary dark:text-violet-300 font-bold shadow-sm">
                        <MessageCircle className="w-5 h-5" />
                      </div>
                    ))}
                  </div>
                  <h4 className="text-base font-bold text-gray-900 dark:text-violet-100 mb-1">Bulk Send Mode</h4>
                  <p className="text-sm text-gray-500 dark:text-violet-300/70">
                    Ready to deliver <strong>{resendQueue.length}</strong> tickets to their respective recipients.
                  </p>
                </div>
              ) : (
                <div className="mt-6 p-4 bg-gray-50 dark:bg-violet-900/40 rounded-xl border border-gray-100 dark:border-violet-500/15 text-left">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Recipient</p>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-violet-100 truncate">
                        {resendQueue[currentQueueIndex]?.purchaser_name || "Unknown"}
                      </p>
                      {isEditingPhone ? (
                        <div className="flex items-center gap-1 mt-1">
                          <input
                            type="tel"
                            value={tempPhone}
                            onChange={e => setTempPhone(e.target.value)}
                            className="text-xs text-gray-900 bg-white border border-primary/30 rounded px-1.5 py-0.5 outline-none font-mono"
                            autoFocus
                          />
                          <button
                            onClick={handleUpdatePhone}
                            className="bg-primary text-white text-[10px] px-1.5 py-0.5 rounded font-bold"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setIsEditingPhone(false)}
                            className="text-gray-400 text-[10px] px-1.5 py-0.5"
                          >
                            X
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group">
                          <p className="text-xs text-gray-500 dark:text-violet-300/70 font-mono mt-0.5">
                            {resendQueue[currentQueueIndex]?.purchaser_phone || "No phone"}
                          </p>
                          <button
                            onClick={() => {
                              setTempPhone(resendQueue[currentQueueIndex]?.purchaser_phone || "");
                              setIsEditingPhone(true);
                            }}
                            className="text-[10px] text-primary hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10">
                      {resendQueue[currentQueueIndex]?.status?.toUpperCase()}
                    </span>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-violet-500/10">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500 dark:text-violet-400 font-medium">
                        {resendQueue[currentQueueIndex]?.type} × {ticketQuantity(resendQueue[currentQueueIndex])}
                      </span>
                      <span className="text-gray-900 dark:text-violet-100 font-bold">
                        ₹{new Intl.NumberFormat('en-IN').format(ticketLineTotal(resendQueue[currentQueueIndex]))}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-8 flex flex-col gap-2">
                {resendQueue.length > 1 && !isBulkResending && (
                  <button
                    onClick={resendAllAutomated}
                    disabled={isBulkResending}
                    className="w-full min-h-[52px] bg-primary hover:bg-purple-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mb-2"
                  >
                    <RefreshCw className={`w-5 h-5 ${isBulkResending ? 'animate-spin' : ''}`} />
                    Resend All ({resendQueue.length}) Automatically
                  </button>
                )}

                {isBulkResending ? (
                  <div className="py-4 text-center">
                    <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
                    <p className="text-sm font-bold text-gray-900 dark:text-violet-100">Sending {bulkResendProgress} of {resendQueue.length}...</p>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => sendCurrentFromQueue('auto')}
                      className="w-full min-h-[48px] bg-primary/90 hover:bg-primary text-white font-bold py-3 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="w-5 h-5" />
                      {resendQueue.length > 1 ? `Send Individual #${currentQueueIndex + 1}` : 'Resend Ticket (Auto)'}
                    </button>

                    <button
                      onClick={() => sendCurrentFromQueue('manual')}
                      className="w-full min-h-[44px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold py-2 rounded-xl transition-all border border-emerald-100 flex items-center justify-center gap-2 text-xs"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Send on WhatsApp (Manual)
                    </button>

                    <div className="flex gap-2 mt-2">
                      {resendQueue.length > 1 && (
                        <button
                          onClick={advanceQueue}
                          className="flex-1 min-h-[44px] bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold py-2 rounded-xl border border-gray-100 text-xs"
                        >
                          Skip / Next
                        </button>
                      )}
                      <button
                        onClick={closeResend}
                        className="flex-1 min-h-[44px] bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 rounded-xl transition-all text-xs"
                      >
                        Close & Clear
                      </button>
                    </div>
                  </>
                )}
              </div>

              <p className="mt-4 text-[10px] text-gray-400 text-center uppercase tracking-tight">
                {resendQueue.length > 1
                  ? 'Use "Resend All" for fast automation. Use Individual for manual control.'
                  : 'Try "Resend Ticket" for background delivery. Use "Send on WhatsApp" for manual fallback.'}
              </p>
            </div>

            <div className="h-1 bg-gray-100 w-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${((currentQueueIndex + 1) / resendQueue.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
      {/* Floating Action Bar */}
      {selectedIds.size > 0 && !resendQueue && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm animate-in slide-in-from-bottom-8 fade-in duration-500">
          <div className="bg-white/95 dark:bg-violet-950/95 backdrop-blur-2xl border border-gray-200 dark:border-violet-400/20 rounded-2xl p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex items-center justify-between gap-1">
            <div className="flex items-center gap-3 pl-2.5">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest leading-none mb-1">Queue</span>
                <span className="text-base font-black text-gray-900 dark:text-white tabular-nums leading-none">{selectedIds.size}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
              <button
                onClick={() => setSelectedIds(new Set())}
                className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                title="Clear selection"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              
              <button
                type="button"
                onClick={startResendQueue}
                className="inline-flex items-center justify-center min-h-[48px] bg-primary hover:bg-primary-dark text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-lg shadow-primary/25 active:scale-[0.96] text-sm group"
              >
                <MessageCircle className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" /> 
                Resend Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SalesReport() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-[#0F172A]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-sm font-bold text-gray-500 animate-pulse italic">Filtering results...</p>
        </div>
      </div>
    }>
      <SalesReportContent />
    </Suspense>
  );
}
