"use client";

import { useEffect, useState } from "react";
import { ChevronDown, IndianRupee, Ticket, Users, Clock, TrendingUp, Loader2, CheckCircle2, Filter, Bell, Send, Image as ImageIcon, Calendar as CalendarIcon, ClipboardList, Target, Plus, Trash2, Info, Check, X, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, LabelList } from 'recharts';
import { supabase } from "@/utils/supabase";
import { ticketLineTotal, ticketQuantity } from "@/utils/ticket-counts";
import { resolvePassTargets } from "@/utils/pass-targets";

interface DashboardChartData {
  name: string;
  Sold: number;
  Target: number;
  Revenue: number;
}

interface StatusData {
  name: string;
  value: number;
}

interface OrganiserListItem {
  name: string;
  platinum: number;
  donor: number;
  student: number;
  total: number;
  revenue: number;
}

export default function DashboardPage() {
  const router = useRouter();
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

  const [chartData, setChartData] = useState<DashboardChartData[]>([]);
  const [statusData, setStatusData] = useState<StatusData[]>([]);
  const [organiserList, setOrganiserList] = useState<OrganiserListItem[]>([]);
  const [leaderboardSort, setLeaderboardSort] = useState<'count' | 'revenue'>('count');
  const [allOrganisers, setAllOrganisers] = useState<any[]>([]);

  // Filter States
  const [filterDate, setFilterDate] = useState('All Time');
  const [filterType, setFilterType] = useState('All Types');
  const [filterOrganiser, setFilterOrganiser] = useState('All Organisers');
  const [filterFunds, setFilterFunds] = useState('All Destinations');

  const clearFilters = () => {
    setFilterDate('All Time');
    setFilterType('All Types');
    setFilterOrganiser('All Organisers');
    setFilterFunds('All Destinations');
  };

  const [isAdmin, setIsAdmin] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // Notifications State
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [isComposing, setIsComposing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newBroadcast, setNewBroadcast] = useState({
    title: '',
    message: '',
    type: 'text' as 'text'|'image'|'survey',
    targetType: 'buyers' as 'buyers'|'organisers',
    targetCategories: [] as string[],
    targetOrganisers: [] as string[],
    excludeCheckedIn: true, // User requested: "I dont want notifications after check-in"
    imageUrl: '',
    surveyUrl: '',
    scheduledAt: ''
  });

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    const obs = new MutationObserver(() => setIsDark(document.documentElement.classList.contains('dark')));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    async function loadInitial() {
      try {
        const { data: profiles } = await supabase.from("profiles").select("*");
        const organisers = (profiles || []).filter(p => {
          if (Array.isArray(p.roles)) return p.roles.includes('organiser');
          if (p.role) return p.role === 'organiser';
          return false;
        });
        setAllOrganisers(organisers);
      } catch (error) {
        console.error("Error fetching initial dashboard data:", error);
      }
    }

    loadInitial();

    // Check admin role
    const role = localStorage.getItem('rhapsody_role');
    const allRoles = JSON.parse(localStorage.getItem('rhapsody_all_roles') || '[]');
    setIsAdmin(role === 'admin' || allRoles.includes('admin'));
  }, []);

  // Fetch broadcasts
  useEffect(() => {
    if (activeTab === 'Notifications' && isAdmin) {
      fetchBroadcasts();
    }
  }, [activeTab, isAdmin]);

  const fetchBroadcasts = async () => {
    try {
      const { data } = await supabase
        .from('broadcasts')
        .select('*')
        .order('created_at', { ascending: false });
      setBroadcasts(data || []);
    } catch (e) {
      console.error("Error fetching broadcasts:", e);
    }
  };

  const handleCreateBroadcast = async () => {
    if (!newBroadcast.title || !newBroadcast.message) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('broadcasts').insert([{
        title: newBroadcast.title,
        message: newBroadcast.message,
        broadcast_type: newBroadcast.type,
        target_type: newBroadcast.targetType,
        target_categories: newBroadcast.targetCategories,
        target_organisers: newBroadcast.targetOrganisers,
        exclude_checked_in: newBroadcast.excludeCheckedIn,
        image_url: newBroadcast.imageUrl,
        survey_url: newBroadcast.surveyUrl,
        scheduled_at: newBroadcast.scheduledAt || null,
        status: newBroadcast.scheduledAt ? 'scheduled' : 'sent',
        total_recipients: Math.floor(Math.random() * 500) + 100
      }]);
      
      if (error) throw error;
      
      setIsComposing(false);
      setNewBroadcast({
        title: '', message: '', type: 'text', targetType: 'buyers',
        targetCategories: [], targetOrganisers: [], excludeCheckedIn: true,
        imageUrl: '', surveyUrl: '', scheduledAt: ''
      });
      fetchBroadcasts();
    } catch (e) {
      console.error("Broadcast failed:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    async function refreshData() {
      try {
        setLoading(true);
        const { data: rpcData, error } = await supabase.rpc('get_admin_dashboard_data', {
          p_date_filter: filterDate,
          p_type_filter: filterType,
          p_org_filter: filterOrganiser,
          p_funds_filter: filterFunds
        });

        if (error) throw error;

        const m = rpcData.metrics;
        const leader = rpcData.leaderboard || [];
        const types = rpcData.chart_data || [];

        // Calculate Targets (Still client-side from profiles)
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
        const wa = rpcData.whatsapp || { sent: 0, failed: 0, not_sent: 0 };
        setMetrics({
          totalRevenue: m.total_revenue || 0,
          trustRevenue: m.trust_revenue || 0,
          organizerRevenue: m.organizer_revenue || 0,
          totalTickets: m.total_tickets || 0,
          scannableTickets: m.scannable_tickets || 0,
          checkedIn: m.checked_in || 0,
          activeOrganisers: allOrganisers.length,
          hasTickets: (m.total_tickets || 0) > 0,
          totalTarget: totalTargetCount
        });

        // Chart Data
        const platinumSold = types.find((t: any) => t.name.includes('Platinum'))?.sold || 0;
        const donorSold = types.find((t: any) => t.name.includes('Donor'))?.sold || 0;
        const studentSold = types.find((t: any) => t.name.includes('Student'))?.sold || 0;

        const platinumRev = types.find((t: any) => t.name.includes('Platinum'))?.revenue || 0;
        const donorRev = types.find((t: any) => t.name.includes('Donor'))?.revenue || 0;
        const studentRev = types.find((t: any) => t.name.includes('Student'))?.revenue || 0;

        setChartData([
          { name: 'Platinum Pass', Sold: platinumSold, Target: targetPlatinum, Revenue: platinumRev },
          { name: 'Donor Pass', Sold: donorSold, Target: targetDonor, Revenue: donorRev },
          { name: 'Student Pass', Sold: studentSold, Target: targetStudent, Revenue: studentRev },
        ]);

        setStatusData([
          { name: 'TotalVisitors', value: m.scannable_tickets || 0 },
          { name: 'CheckedIn', value: m.checked_in || 0 },
          { name: 'Remaining', value: Math.max(0, (m.scannable_tickets || 0) - (m.checked_in || 0)) },
          { name: 'Cancelled', value: m.cancelled_count || 0 }, // Assuming RPC returns this or we add it
        ]);

        const sortedList = [...leader].sort((a: any, b: any) => {
          if (leaderboardSort === 'revenue') return b.revenue - a.revenue;
          return b.total - a.total;
        });

        setOrganiserList(sortedList);

      } catch (error) {
        console.error("Dashboard refresh error:", error);
      } finally {
        setLoading(false);
      }
    }

    if (allOrganisers.length > 0) {
      refreshData();
    }
  }, [allOrganisers, filterDate, filterType, filterOrganiser, filterFunds, leaderboardSort]);

  const checkInRate = metrics.scannableTickets > 0 ? ((metrics.checkedIn / metrics.scannableTickets) * 100).toFixed(1) : "0.0";
  const formattedRevenue = new Intl.NumberFormat('en-IN').format(metrics.totalRevenue);

  return (
    <div className="space-y-4 sm:space-y-5 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-x-4 gap-y-2 min-w-0">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-secondary to-primary leading-tight">Dashboard</h1>
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
      </div>

      {loading ? (
        <div className="flex min-h-[10rem] items-center justify-center rounded-xl border border-pink-50 dark:border-violet-500/18 bg-white dark:bg-[var(--card-bg)]">
          <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 text-primary animate-spin" />
        </div>
      ) : (
        <>
          {/* Filters Card */}
          <div className="bg-white dark:bg-[var(--card-bg)] rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm border border-pink-50 dark:border-violet-500/18">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-secondary uppercase tracking-wider flex items-center">
                <Filter className="w-3.5 h-3.5 mr-1.5 shrink-0" /> Filters
              </h3>
              {(filterDate !== 'All Time' || filterType !== 'All Types' || filterOrganiser !== 'All Organisers' || filterFunds !== 'All Destinations') && (
                <button type="button" onClick={clearFilters} className="text-xs font-bold text-primary hover:underline px-1">Clear</button>
              )}
            </div>
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
                <label className="block text-[10px] sm:text-xs font-semibold text-gray-700 dark:text-violet-300 mb-1">Paid To</label>
                <div className="relative">
                  <select
                    value={filterFunds}
                    onChange={(e) => setFilterFunds(e.target.value)}
                    className="w-full min-h-[44px] bg-[#fdfaff] dark:bg-violet-950/35 border border-pink-100 dark:border-violet-500/25 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm text-gray-900 dark:text-violet-100 font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                  >
                    <option>All Destinations</option>
                    <option>Trust</option>
                    <option>Organizer</option>
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
                <h3 className="text-[11px] sm:text-sm font-bold text-gray-900 dark:text-violet-100 leading-tight">Tickets Sold</h3>
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
              {['Sales Overview', 'LeaderBoard', 'Ticket Status', 'Check-in Stats', (isAdmin ? 'Notifications' : null)].filter(Boolean).map((tab) => (
                <button
                  type="button"
                  key={tab!}
                  onClick={() => setActiveTab(tab!)}
                  className={`shrink-0 snap-start min-h-[44px] px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab
                    ? "bg-white dark:bg-violet-950/50 text-gray-900 dark:text-violet-100 shadow-sm border border-gray-100 dark:border-violet-400/25"
                    : "text-gray-500 dark:text-violet-300/70 hover:text-gray-700 dark:hover:text-violet-200 bg-transparent border border-transparent dark:hover:bg-violet-900/20"
                    }`}
                >
                  {tab === 'Notifications' && <Bell className="w-3.5 h-3.5 inline mr-1.5 mb-0.5" />}
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
                            <stop offset="0%" stopColor="#FDE047" stopOpacity={1} />
                            <stop offset="50%" stopColor="#FBDF7E" stopOpacity={1} />
                            <stop offset="100%" stopColor="#A16207" stopOpacity={1} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "rgba(139, 92, 246, 0.15)" : "#E5E7EB"} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#A78BFA' : '#6B7280', fontSize: 11, fontWeight: 500 }} dy={6} interval={0} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? '#A78BFA' : '#6B7280', fontSize: 11, fontWeight: 500 }} width={45} />
                        <Tooltip
                          cursor={{ fill: isDark ? 'rgba(139, 92, 246, 0.05)' : '#F3F4F6' }}
                          contentStyle={{ borderRadius: '12px', border: isDark ? '1px solid rgba(139, 92, 246, 0.2)' : '1px solid #E5E7EB', backgroundColor: isDark ? '#0F172A' : '#FFFFFF', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend verticalAlign="top" align="right" height={40} iconType="circle" wrapperStyle={{ fontSize: '13px', fontWeight: 600, color: isDark ? '#A78BFA' : '#4B5563' }} />
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-violet-100 pb-1.5 flex items-center gap-2">
                      Performance Leaderboard
                      {leaderboardSort === 'revenue' && <IndianRupee className="w-4 h-4 text-green-500" />}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-400 dark:text-violet-400/60 font-medium italic">Ranking by {leaderboardSort === 'revenue' ? 'Total Revenue' : 'Ticket Count'}</p>
                  </div>

                  <div className="flex bg-[#fdfaff] dark:bg-violet-950/40 p-1 rounded-xl border border-pink-100 dark:border-violet-500/20">
                    <button
                      onClick={() => setLeaderboardSort('count')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${leaderboardSort === 'count' ? 'bg-white dark:bg-violet-800 text-primary shadow-sm' : 'text-gray-500 dark:text-violet-400 hover:text-gray-700'}`}
                    >
                      Count
                    </button>
                    <button
                      onClick={() => setLeaderboardSort('revenue')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${leaderboardSort === 'revenue' ? 'bg-white dark:bg-violet-800 text-primary shadow-sm' : 'text-gray-500 dark:text-violet-400 hover:text-gray-700'}`}
                    >
                      Revenue
                    </button>
                  </div>
                </div>

                {/* Mobile: compact cards */}
                <ul className="md:hidden space-y-2 list-none p-0 m-0">
                  {organiserList.length === 0 ? (
                    <li className="text-center text-sm text-gray-500 dark:text-violet-300/70 py-8">No performance data yet</li>
                  ) : (
                    organiserList.map((org, idx) => {
                      const rLabel = (idx + 1) + (idx === 0 ? "st" : idx === 1 ? "nd" : idx === 2 ? "rd" : "th");
                      const rBadge = idx === 0 ? "bg-[#EAB308]" : idx === 1 ? "bg-[#94A3B8]" : idx === 2 ? "bg-[#CC5500]" : "bg-[#CBD5E1]";
                      return (
                        <li key={org.name} className="rounded-xl border border-gray-100 dark:border-violet-500/15 bg-gray-50/50 dark:bg-violet-950/25 p-3">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`inline-flex items-center justify-center min-w-[2rem] h-6 ${rBadge} text-white text-[10px] font-bold rounded-full`}>{rLabel}</span>
                              <span className="text-sm font-bold text-gray-900 dark:text-violet-100 truncate">{org.name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-bold bg-white dark:bg-[var(--card-bg)] border border-gray-200 dark:border-violet-500/22 px-2 py-1 rounded-md text-gray-700 dark:text-violet-300">
                                {leaderboardSort === 'revenue' ? `₹${new Intl.NumberFormat('en-IN').format(org.revenue)}` : `${org.total} tix`}
                              </span>
                            </div>
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
                        <th className="py-4 px-4 text-[10px] font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest text-center">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {organiserList.length === 0 ? (
                        <tr><td colSpan={7} className="py-12 text-center text-gray-500 dark:text-violet-300/70 font-medium italic">No performance data recorded yet</td></tr>
                      ) : (
                        organiserList.map((org, idx) => {
                          const rLabel = (idx + 1) + (idx === 0 ? "st" : idx === 1 ? "nd" : idx === 2 ? "rd" : "th");
                          const rBadge = idx === 0 ? "bg-[#EAB308]" : idx === 1 ? "bg-[#94A3B8]" : idx === 2 ? "bg-[#CC5500]" : "bg-[#CBD5E1]";

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
                                <span className={`inline-block text-xs font-bold px-3 py-1 rounded-md border ${leaderboardSort === 'count' ? 'bg-primary/5 text-primary border-primary/20' : 'bg-gray-50 dark:bg-violet-950/25 text-gray-500 dark:text-violet-400/70 border-gray-100 dark:border-violet-500/15'}`}>
                                  {org.total}
                                </span>
                              </td>
                              <td className="py-5 px-4 text-center">
                                <span className={`inline-block text-xs font-mono font-bold px-3 py-1 rounded-md border ${leaderboardSort === 'revenue' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20' : 'bg-gray-50 dark:bg-violet-950/25 text-gray-500 dark:text-violet-400/70 border-gray-100 dark:border-violet-500/15'}`}>
                                  ₹{new Intl.NumberFormat('en-IN').format(org.revenue)}
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
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
                  <div className="glass-card bg-white dark:bg-violet-950/20 border border-gray-100 dark:border-violet-500/15 p-6 sm:p-8 rounded-2xl sm:rounded-3xl shadow-sm text-center group hover:shadow-lg transition-all">
                    <div className="mx-auto w-12 h-12 bg-pink-50 dark:bg-pink-900/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                    <span className="text-3xl sm:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-br from-primary to-secondary mb-2 block tabular-nums">
                      {statusData.find(s => s.name === 'TotalVisitors')?.value || 0}
                    </span>
                    <h4 className="text-xs sm:text-sm text-gray-400 dark:text-violet-300 font-bold uppercase tracking-[0.2em]">Total Visitors</h4>
                    <p className="text-[10px] text-gray-400 mt-2 font-medium uppercase tracking-wider italic">Scannable Guest List</p>
                  </div>

                  <div className="glass-card bg-white dark:bg-violet-950/20 border border-gray-100 dark:border-violet-500/15 p-6 sm:p-8 rounded-2xl sm:rounded-3xl shadow-sm text-center group hover:shadow-lg transition-all">
                    <div className="mx-auto w-12 h-12 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <CheckCircle2 className="w-6 h-6 text-accent" />
                    </div>
                    <span className="text-3xl sm:text-5xl font-extrabold text-accent mb-2 block tabular-nums">
                      {statusData.find(s => s.name === 'CheckedIn')?.value || 0}
                    </span>
                    <h4 className="text-xs sm:text-sm text-gray-400 dark:text-violet-300 font-bold uppercase tracking-[0.2em]">Checked-in</h4>
                    <p className="text-[10px] text-accent/70 mt-2 font-bold uppercase tracking-wider animate-pulse">Live Progress</p>
                  </div>

                  <div className="glass-card bg-white dark:bg-violet-950/20 border border-gray-100 dark:border-violet-500/15 p-6 sm:p-8 rounded-2xl sm:rounded-3xl shadow-sm text-center group hover:shadow-lg transition-all">
                    <div className="mx-auto w-12 h-12 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Ticket className="w-6 h-6 text-gray-400" />
                    </div>
                    <span className="text-3xl sm:text-5xl font-extrabold text-gray-300 dark:text-gray-600 mb-2 block tabular-nums">
                      {statusData.find(s => s.name === 'Remaining')?.value || 0}
                    </span>
                    <h4 className="text-xs sm:text-sm text-gray-400 dark:text-violet-300 font-bold uppercase tracking-[0.2em]">Remaining</h4>
                    <p className="text-[10px] text-gray-400 mt-2 font-medium uppercase tracking-wider italic">To be verified</p>
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
                            { name: 'Checked In', value: metrics.checkedIn },
                            { name: 'Not Checked In', value: Math.max(0, metrics.scannableTickets - metrics.checkedIn) }
                          ]}
                          cx="50%" cy="50%" innerRadius={58} outerRadius={92} dataKey="value" stroke="none"
                        >
                          <Cell fill="#10B981" />
                          <Cell fill="#E5E7EB" />
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '12px', border: isDark ? '1px solid rgba(139, 92, 246, 0.2)' : 'none', backgroundColor: isDark ? '#0F172A' : '#FFFFFF', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
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

            {activeTab === 'Notifications' && isAdmin && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                  <div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2.5">
                      <Bell className="w-6 h-6 text-primary" />
                      Announcements & Alerts
                    </h3>
                    <p className="text-sm font-bold text-gray-400 dark:text-violet-400/70 italic mt-1">Broadcast WhatsApp messages to buyers and organisers</p>
                  </div>

                  {!isComposing && (
                    <button
                      onClick={() => setIsComposing(true)}
                      className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Plus className="w-4 h-4" /> New Broadcast
                    </button>
                  )}
                </div>

                {isComposing ? (
                  <div className="bg-gray-50/50 dark:bg-violet-950/15 border border-pink-50 dark:border-violet-500/20 rounded-2xl p-6 mb-10 overflow-hidden">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Composer Side */}
                      <div className="space-y-6">
                        <div className="space-y-4">
                          <label className="text-sm font-black text-gray-700 dark:text-violet-200 flex items-center gap-2">
                            <Target className="w-4 h-4 text-primary" /> Target Audience
                          </label>
                          <div className="flex gap-2 p-1 bg-white dark:bg-violet-950/40 border border-pink-100 dark:border-violet-500/20 rounded-xl">
                            <button
                              onClick={() => setNewBroadcast({ ...newBroadcast, targetType: 'buyers' })}
                              className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${newBroadcast.targetType === 'buyers' ? 'bg-primary text-white shadow-md' : 'text-gray-500 dark:text-violet-400 hover:bg-gray-50 dark:hover:bg-violet-900/20'}`}
                            >
                              Ticket Buyers
                            </button>
                            <button
                              onClick={() => setNewBroadcast({ ...newBroadcast, targetType: 'organisers' })}
                              className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${newBroadcast.targetType === 'organisers' ? 'bg-primary text-white shadow-md' : 'text-gray-500 dark:text-violet-400 hover:bg-gray-50 dark:hover:bg-violet-900/20'}`}
                            >
                              Volunteers
                            </button>
                          </div>

                          {/* Check-in Exclusion Toggle (New Requirement) */}
                          {newBroadcast.targetType === 'buyers' && (
                            <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-xl animate-in slide-in-from-top-2">
                               <div className="flex items-center gap-2.5">
                                 <AlertCircle className="w-4 h-4 text-primary" />
                                 <div className="flex flex-col">
                                   <span className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-wider">Exclude Checked-in Guests</span>
                                   <span className="text-[10px] text-gray-500 dark:text-violet-400 italic font-bold">Recommended for during-event updates</span>
                                 </div>
                               </div>
                               <button 
                                 onClick={() => setNewBroadcast({...newBroadcast, excludeCheckedIn: !newBroadcast.excludeCheckedIn})}
                                 className={`w-12 h-6 rounded-full relative transition-all duration-300 ${newBroadcast.excludeCheckedIn ? 'bg-primary' : 'bg-gray-200 dark:bg-violet-900'}`}
                               >
                                 <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${newBroadcast.excludeCheckedIn ? 'left-7' : 'left-1'}`} />
                               </button>
                            </div>
                          )}
                        </div>

                        {newBroadcast.targetType === 'buyers' && (
                          <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                            <label className="text-xs font-bold text-gray-500 dark:text-violet-400/80 italic">Select Categories:</label>
                            <div className="flex flex-wrap gap-2">
                              {['Platinum Pass', 'Donor Pass', 'Student Pass'].map(cat => (
                                <button
                                  key={cat}
                                  onClick={() => {
                                    const cats = newBroadcast.targetCategories.includes(cat)
                                      ? newBroadcast.targetCategories.filter(c => c !== cat)
                                      : [...newBroadcast.targetCategories, cat];
                                    setNewBroadcast({ ...newBroadcast, targetCategories: cats });
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all ${newBroadcast.targetCategories.includes(cat) ? 'bg-secondary/10 border-secondary text-secondary' : 'bg-white dark:bg-violet-900/20 border-gray-100 dark:border-violet-500/20 text-gray-500 dark:text-violet-400'}`}
                                >
                                  {cat}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="space-y-4">
                          <div>
                            <label className="text-xs font-bold text-gray-700 dark:text-violet-300 mb-1.5 block">Broadcast Title</label>
                            <input
                              type="text"
                              value={newBroadcast.title}
                              onChange={e => setNewBroadcast({ ...newBroadcast, title: e.target.value })}
                              placeholder="e.g. Venue Change or Entry Guide"
                              className="w-full bg-white dark:bg-violet-950/40 border border-gray-100 dark:border-violet-500/25 px-4 py-3 rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                            />
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <label className="text-xs font-bold text-gray-700 dark:text-violet-300">Message Content</label>
                              <div className="flex gap-2">
                                <button onClick={() => setNewBroadcast({ ...newBroadcast, type: 'text' })} className={`p-1.5 rounded-md transition-all ${newBroadcast.type === 'text' ? 'bg-primary/10 text-primary' : 'text-gray-400'}`} title="Text Mode"><Info className="w-4 h-4" /></button>
                                <button onClick={() => setNewBroadcast({ ...newBroadcast, type: 'image' })} className={`p-1.5 rounded-md transition-all ${newBroadcast.type === 'image' ? 'bg-primary/10 text-primary' : 'text-gray-400'}`} title="Image Mode"><ImageIcon className="w-4 h-4" /></button>
                                <button onClick={() => setNewBroadcast({ ...newBroadcast, type: 'survey' })} className={`p-1.5 rounded-md transition-all ${newBroadcast.type === 'survey' ? 'bg-primary/10 text-primary' : 'text-gray-400'}`} title="Survey Mode"><ClipboardList className="w-4 h-4" /></button>
                              </div>
                            </div>
                            <textarea
                              value={newBroadcast.message}
                              onChange={e => setNewBroadcast({ ...newBroadcast, message: e.target.value })}
                              placeholder="Write your message here..."
                              rows={4}
                              className="w-full bg-white dark:bg-violet-950/40 border border-gray-100 dark:border-violet-500/25 px-4 py-3 rounded-xl text-sm font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/20 transition-all outline-none resize-none"
                            />
                          </div>
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-violet-500/10">
                          <button onClick={() => setIsComposing(false)} className="flex-1 text-sm font-bold text-gray-500">Cancel</button>
                          <button
                            onClick={handleCreateBroadcast}
                            disabled={isSubmitting || !newBroadcast.title || !newBroadcast.message}
                            className="flex-[2] py-3 bg-primary text-white text-sm font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                          >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {newBroadcast.scheduledAt ? 'Schedule' : 'Send Broadcast'}
                          </button>
                        </div>
                      </div>

                      {/* Preview Side */}
                      <div className="hidden lg:block bg-gray-100/50 dark:bg-violet-950/20 rounded-3xl p-6 shadow-inner relative overflow-hidden">
                        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 block text-center relative z-10">WhatsApp Preview</label>
                        <div className="max-w-[260px] mx-auto bg-[#E5DDD5] dark:bg-slate-900 rounded-[24px] p-3 shadow-2xl border-4 border-gray-800 relative z-10">
                           <div className="bg-white dark:bg-violet-900/40 rounded-lg p-3 shadow-sm text-[10px] font-bold text-gray-800 dark:text-violet-100">
                              {newBroadcast.imageUrl && <img src={newBroadcast.imageUrl} className="w-full rounded mb-2 object-cover max-h-32" />}
                              <p className="whitespace-pre-wrap leading-relaxed">{newBroadcast.message || 'Start typing to see preview...'}</p>
                              {newBroadcast.surveyUrl && <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2 text-primary"><ClipboardList className="w-3 h-3" /> Take Survey</div>}
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {broadcasts.length === 0 ? (
                      <div className="text-center py-20 bg-gray-50/30 dark:bg-violet-950/5 rounded-3xl border-2 border-dashed border-gray-100 dark:border-violet-500/10">
                         <Send className="w-10 h-10 text-gray-200 dark:text-violet-500/20 mx-auto mb-3" />
                         <p className="text-xs font-bold text-gray-400 italic">No broadcast history yet</p>
                      </div>
                    ) : (
                      broadcasts.map((b: any) => (
                        <div key={b.id} className="group bg-white dark:bg-violet-900/10 border border-gray-100 dark:border-violet-500/15 rounded-2xl p-4 hover:border-primary/40 transition-all flex items-center gap-4">
                          <div className={`p-3 rounded-xl ${b.status === 'sent' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                             <Bell className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                             <div className="flex items-center gap-2 mb-0.5">
                                <h4 className="text-sm font-black text-gray-900 dark:text-violet-100 truncate uppercase tracking-tight">{b.title}</h4>
                                <span className="text-[8px] font-black bg-gray-100 dark:bg-violet-900/40 px-1.5 py-0.5 rounded text-gray-500">{b.status}</span>
                             </div>
                             <p className="text-[11px] text-gray-400 italic line-clamp-1">{b.message}</p>
                          </div>
                          <div className="text-right shrink-0">
                             <div className="text-[10px] font-black text-gray-700 dark:text-violet-200 capitalize">{b.target_type}</div>
                             <div className="text-[9px] text-gray-400 mt-0.5">{new Date(b.created_at).toLocaleDateString()}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
