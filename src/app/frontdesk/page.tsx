"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import {
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Ticket,
  Keyboard,
  Camera,
  Users,
  Clock,
  Zap,
  ShieldCheck,
  ShieldX,
  History,
  ArrowUpRight,
  Scan,
  AlertOctagon,
  CheckCircle,
  XCircle,
  QrCode
} from "lucide-react";
import { supabase } from "@/utils/supabase";
import {
  parseTicketQrPayload,
  shortTicketRef,
  type ParsedTicketQr,
} from "@/utils/ticket-qr";
import { ticketQuantity } from "@/utils/ticket-counts";

const TYPE_LABELS: Record<string, string> = {
  Platinum: "Platinum Pass",
  Donor: "Donor Pass",
  Student: "Student Pass",
  Bulk: "Bulk Booking",
};

function extractTicketIdFromPaste(raw: string): string | null {
  const trimmed = raw.trim();
  const parsed = parseTicketQrPayload(trimmed);
  if (parsed) return parsed.ticketId;
  const m = trimmed.match(/\/ticket\/([0-9a-f-]{36})/i);
  return m ? m[1] : null;
}

type LookupState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      kind: "result";
      ticket: Record<string, unknown>;
      parsed?: ParsedTicketQr | null;
      mismatch?: string;
    };

export default function FrontdeskCheckInPage() {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const scanContainerId = `fd-qr-${useId().replace(/:/g, "")}`;
  const [scannerActive, setScannerActive] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [lookup, setLookup] = useState<LookupState>({ kind: "idle" });
  const [checkingIn, setCheckingIn] = useState(false);
  const [justCheckedIn, setJustCheckedIn] = useState(false);
  const cooldownRef = useRef(false);

  // Metrics State
  const [metrics, setMetrics] = useState({
    totalCheckedIn: 0,
    totalScannable: 0,
    thisHour: 0,
    peakTime: "Calculating...",
    recentCheckIns: [] as any[]
  });

  const fetchMetrics = useCallback(async () => {
    try {
      const { data: tickets, error } = await supabase
        .from("tickets")
        .select("status, type, quantity, created_at");
      
      if (error) {
        console.error("Supabase error fetching tickets:", error);
        return;
      }
      if (!tickets) return;

      let checkedInTotal = 0;
      let scannableTotal = 0;
      let hourCount = 0;
      const now = Date.now();
      const hourAgo = now - 60 * 60 * 1000;

      const hourlyDistribution: Record<number, number> = {};

      tickets.forEach(t => {
        const q = ticketQuantity(t);
        const type = String(t.type || "").toLowerCase();
        const status = String(t.status || "").toLowerCase();

        // Standard scannable logic: exclude Donor passes, exclude cancelled tickets
        const isDonor = type.includes("donor");
        
        if (status !== "cancelled" && !isDonor) {
          scannableTotal += q;

          if (status === "checked_in") {
            checkedInTotal += q;
            
            const updateTime = t.created_at ? new Date(t.created_at).getTime() : 0;
            if (updateTime > hourAgo) {
              hourCount += q;
            }

            if (updateTime > 0) {
              const hr = new Date(updateTime).getHours();
              hourlyDistribution[hr] = (hourlyDistribution[hr] || 0) + q;
            }
          }
        }
      });

      let peakStr = "No data yet";
      if (Object.keys(hourlyDistribution).length > 0) {
        let peakHr = 0;
        let maxVal = 0;
        for (const [hr, val] of Object.entries(hourlyDistribution)) {
          if (val > maxVal) {
            maxVal = val;
            peakHr = parseInt(hr);
          }
        }
        peakStr = `${peakHr % 12 || 12}:00 ${peakHr >= 12 ? 'PM' : 'AM'} - ${(peakHr + 1) % 12 || 12}:00 ${(peakHr + 1) >= 12 ? 'PM' : 'AM'}`;
      }

      // Fetch Recent Check-ins
      const { data: recent } = await supabase
        .from("tickets")
        .select("*")
        .eq("status", "checked_in")
        .order("created_at", { ascending: false })
        .limit(8);

      setMetrics({
        totalCheckedIn: checkedInTotal,
        totalScannable: scannableTotal,
        thisHour: hourCount,
        peakTime: peakStr,
        recentCheckIns: recent || []
      });
    } catch (error) {
       console.error("System error fetching check-in metrics:", error);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const sub = supabase.channel('tickets-checkin').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets' }, () => {
       fetchMetrics();
    }).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [fetchMetrics]);

  const runLookup = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    setJustCheckedIn(false);
    if (!trimmed) {
      setLookup({ kind: "error", message: "Scan a QR or paste code / link." });
      return;
    }

    const parsed = parseTicketQrPayload(trimmed);
    const ticketId = parsed?.ticketId ?? extractTicketIdFromPaste(trimmed);

    if (!ticketId) {
      setLookup({
        kind: "error",
        message: "Unrecognised format. Scan the ticket QR or paste the ticket link.",
      });
      return;
    }

    setLookup({ kind: "loading" });

    const { data: row, error } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", ticketId)
      .maybeSingle();

    if (error) {
      console.error(error);
      setLookup({ kind: "error", message: "Could not load ticket. Try again." });
      return;
    }

    if (!row) {
      setLookup({ kind: "error", message: "No ticket found for this code." });
      return;
    }

    let mismatch: string | undefined;
    if (parsed) {
      if (row.type !== parsed.typeId) {
        mismatch = "QR data does not match our records (type).";
      } else if (ticketQuantity(row) !== parsed.quantity) {
        mismatch = "QR data does not match our records (quantity).";
      }
    }

    setLookup({
      kind: "result",
      ticket: row as Record<string, unknown>,
      parsed: parsed ?? null,
      mismatch,
    });
  }, []);

  const onScanSuccess = useCallback(
    (decodedText: string) => {
      if (cooldownRef.current) return;
      cooldownRef.current = true;
      setManualInput(decodedText);
      void runLookup(decodedText);
      setTimeout(() => {
        cooldownRef.current = false;
      }, 1500);
    },
    [runLookup]
  );

  useEffect(() => {
    if (!scannerActive) {
      if (scannerRef.current) {
        try {
          scannerRef.current.clear().catch(() => {});
        } catch {
          /* ignore */
        }
        scannerRef.current = null;
      }
      return;
    }

    const scanner = new Html5QrcodeScanner(
      scanContainerId,
      {
        fps: 12,
        qrbox: { width: minBox(), height: minBox() },
        aspectRatio: 1,
      },
      false
    );
    scannerRef.current = scanner;

    scanner.render(
      (decodedText) => {
        onScanSuccess(decodedText);
      },
      () => {}
    );

    return () => {
      scanner
        .clear()
        .catch(() => {})
        .finally(() => {
          scannerRef.current = null;
        });
    };
  }, [scannerActive, onScanSuccess]);

  function minBox() {
    if (typeof window === "undefined") return 260;
    return Math.min(280, Math.floor(window.innerWidth - 48));
  }

  const handleCheckIn = async () => {
    if (lookup.kind !== "result" || lookup.mismatch) return;
    const row = lookup.ticket;
    const status = String(row.status || "").toLowerCase();
    if (status === "checked_in") return;
    if (status === "cancelled") return;

    setCheckingIn(true);
    try {
      const { error } = await supabase
        .from("tickets")
        .update({ status: "checked_in" })
        .eq("id", row.id as string);

      if (error) throw error;

      const { data: fresh } = await supabase
        .from("tickets")
        .select("*")
        .eq("id", row.id as string)
        .single();

      setLookup({
        kind: "result",
        ticket: (fresh || row) as Record<string, unknown>,
        parsed: lookup.parsed,
        mismatch: lookup.mismatch,
      });
      setJustCheckedIn(true);
      fetchMetrics(); // Refresh stats
    } catch (e) {
      console.error(e);
      alert("Could not update check-in status.");
    } finally {
      setCheckingIn(false);
    }
  };

  const result = lookup.kind === "result" ? lookup : null;
  const statusStr = result
    ? String(result.ticket.status || "").toLowerCase()
    : "";
  const canCheckIn =
    result &&
    !result.mismatch &&
    (statusStr === "pending" || statusStr === "booked" || statusStr === "ticket issued" || statusStr === "ticket_issued");

  const checkInRate = metrics.totalScannable > 0 ? ((metrics.totalCheckedIn / metrics.totalScannable) * 100).toFixed(1) : "0.0";

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-8 space-y-6 sm:space-y-10 animate-in fade-in duration-700">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
         <div className="flex items-start gap-4">
            <div className="p-3.5 bg-primary/10 rounded-2xl border border-primary/20 shadow-sm">
               <QrCode className="w-8 h-8 text-primary" />
            </div>
            <div>
               <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-violet-100 flex items-center gap-2">
                  Front Desk Check-in
               </h1>
               <p className="text-gray-500 dark:text-violet-300 font-medium mt-1">Scan QR codes to validate and check-in attendees</p>
               <div className="mt-3 inline-flex items-center px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary uppercase tracking-widest">
                  Front Desk Portal
               </div>
            </div>
         </div>
         
         <div className="hidden lg:flex items-center gap-4">
             <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">System Status</span>
                <span className="text-xs font-bold text-emerald-500 flex items-center gap-1.5 mt-1">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                   Fully Operational
                </span>
             </div>
         </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
         <div className="bg-white dark:bg-[var(--card-bg)] p-4 sm:p-6 rounded-2xl border border-gray-100 dark:border-violet-500/15 shadow-sm hover:border-primary/30 transition-all group">
            <span className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest block mb-2 sm:mb-4">Total Checked In</span>
            <div className="flex items-baseline gap-2">
               <span className="text-2xl sm:text-4xl font-bold text-emerald-600 tabular-nums">{metrics.totalCheckedIn}</span>
               <span className="text-xs sm:text-sm font-bold text-gray-400">of {metrics.totalScannable}</span>
            </div>
            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-violet-400/60 mt-1 sm:mt-2 font-medium uppercase tracking-wider">booked & confirmed</p>
         </div>

         <div className="bg-white dark:bg-[var(--card-bg)] p-4 sm:p-6 rounded-2xl border border-gray-100 dark:border-violet-500/15 shadow-sm hover:border-primary/30 transition-all group">
            <span className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest block mb-2 sm:mb-4">Check-in Rate</span>
            <div className="text-2xl sm:text-4xl font-bold text-secondary tabular-nums">{checkInRate}%</div>
            <p className="text-[10px] sm:text-xs text-secondary/70 mt-1 sm:mt-2 font-bold uppercase tracking-wider">progress</p>
         </div>

         <div className="bg-white dark:bg-[var(--card-bg)] p-4 sm:p-6 rounded-2xl border border-gray-100 dark:border-violet-500/15 shadow-sm hover:border-primary/30 transition-all group">
            <span className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest block mb-1 sm:mb-4">This Hour</span>
            <div className="text-2xl sm:text-4xl font-bold text-primary tabular-nums">{metrics.thisHour}</div>
            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-violet-400/60 mt-1 sm:mt-2 font-medium">check-ins</p>
         </div>

         <div className="bg-white dark:bg-[var(--card-bg)] p-4 sm:p-6 rounded-2xl border border-gray-100 dark:border-violet-500/15 shadow-sm hover:border-primary/30 transition-all group">
            <span className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest block mb-1 sm:mb-4">Peak Time</span>
            <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-violet-100 mt-2">{metrics.peakTime}</div>
            <p className="text-[10px] sm:text-xs text-gray-500 dark:text-violet-400/60 mt-1 sm:mt-2 font-medium">highest traffic</p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
         
         {/* Left Side: Scanner */}
         <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-[var(--card-bg)] rounded-3xl border border-gray-100 dark:border-violet-500/15 p-6 sm:p-8 shadow-sm">
               <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                     <Scan className="w-5 h-5 text-primary" />
                     <h3 className="text-lg font-bold text-gray-900 dark:text-violet-100">QR Code Scanner</h3>
                  </div>
                  <div className="flex rounded-xl overflow-hidden border border-gray-100 dark:border-violet-500/20">
                     <button onClick={() => setScannerActive(true)} className={`px-4 py-2 text-xs font-bold transition-all ${scannerActive ? 'bg-primary text-white' : 'bg-gray-50 dark:bg-violet-950/30 text-gray-500 hover:text-primary'}`}>Camera</button>
                     <button onClick={() => setScannerActive(false)} className={`px-4 py-2 text-xs font-bold transition-all ${!scannerActive ? 'bg-primary text-white' : 'bg-gray-50 dark:bg-violet-950/30 text-gray-500 hover:text-primary'}`}>Manual</button>
                  </div>
               </div>

               <p className="text-gray-500 dark:text-violet-300/80 text-sm font-medium mb-6">Position the QR code in front of the camera</p>

               <div className="relative group">
                  <div className={`transition-all duration-300 ${scannerActive ? 'block' : 'hidden'}`}>
                     <div className="overflow-hidden rounded-2xl border-4 border-gray-900 bg-gray-950 shadow-2xl relative">
                        <div id={scanContainerId} className="min-h-[340px] w-full" />
                        <div className="absolute inset-0 pointer-events-none border-[1.5rem] border-black/40 flex items-center justify-center">
                           <div className="w-48 h-48 sm:w-64 sm:h-64 border-2 border-primary/50 relative">
                              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-sm"></div>
                              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-sm"></div>
                              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-sm"></div>
                              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-sm"></div>
                              <div className="absolute inset-0 flex items-center justify-center opacity-40">
                                 <QrCode className="w-24 h-24 text-primary animate-pulse" />
                              </div>
                           </div>
                        </div>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-4 py-1.5 rounded-full text-[10px] font-bold text-white/90 uppercase tracking-widest border border-white/10">
                           Scan QR Code Here
                        </div>
                     </div>
                  </div>

                  <div className={`transition-all duration-300 ${!scannerActive ? 'block' : 'hidden'} space-y-4`}>
                     <div className="bg-gray-50 dark:bg-violet-950/30 rounded-2xl border-2 border-dashed border-gray-200 dark:border-violet-500/20 p-8 flex flex-col items-center text-center">
                        <Keyboard className="w-12 h-12 text-gray-400 mb-4" />
                        <h4 className="font-bold text-gray-700 dark:text-violet-200 mb-2">Manual Ticket Lookup</h4>
                        <p className="text-sm text-gray-500 dark:text-violet-400 mb-6 max-w-xs">Paste the QR text or the complete ticket URL below to manually check-in the guest.</p>
                        <textarea
                           value={manualInput}
                           onChange={(e) => setManualInput(e.target.value)}
                           rows={3}
                           placeholder="rhapsody|1|... OR https://.../ticket/..."
                           className="w-full bg-white dark:bg-violet-950/50 border border-gray-200 dark:border-violet-500/30 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-gray-300"
                        />
                        <button
                           onClick={() => void runLookup(manualInput)}
                           className="mt-4 w-full bg-primary hover:bg-primary-dark text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary/20 transition-all"
                        >
                           Look up ticket
                        </button>
                     </div>
                  </div>
               </div>

               {/* Results / Status Display */}
               <div className="mt-8 space-y-4">
                  {lookup.kind === "loading" && (
                     <div className="flex flex-col items-center py-10 bg-gray-50 dark:bg-violet-950/20 rounded-2xl border border-gray-100 dark:border-violet-500/10">
                        <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
                        <p className="text-sm font-bold text-gray-600 dark:text-violet-300/80 uppercase tracking-widest">Verifying Ticket...</p>
                     </div>
                  )}

                  {lookup.kind === "error" && (
                     <div className="p-5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/30 rounded-2xl flex items-start gap-3">
                        <AlertOctagon className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                        <div>
                           <p className="font-bold text-amber-900 dark:text-amber-100 text-sm">Action Required</p>
                           <p className="text-sm text-amber-800 dark:text-amber-200/80 mt-1">{lookup.message}</p>
                        </div>
                     </div>
                  )}

                  {result && (
                     <div className="p-6 bg-white dark:bg-violet-950/40 border border-gray-100 dark:border-violet-500/30 rounded-2xl shadow-xl space-y-5 animate-in slide-in-from-bottom-2">
                        {result.mismatch && (
                           <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/40 rounded-xl flex items-center gap-3 text-red-700 dark:text-red-400 font-bold text-xs uppercase tracking-wide">
                              <AlertTriangle className="w-4 h-4" /> {result.mismatch}
                           </div>
                        )}
                        
                        <div className="flex items-start justify-between">
                           <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">Pass Details</p>
                              <h4 className="text-xl font-bold text-gray-900 dark:text-violet-100 leading-tight">
                                 {String(result.ticket.purchaser_name || "Guest")}
                              </h4>
                              <p className="mt-1 text-sm font-bold text-primary">
                                 {TYPE_LABELS[String(result.ticket.type)] || String(result.ticket.type)} {" "}
                                 <span className="text-gray-300 mx-1">/</span> {" "}
                                 Qty {ticketQuantity(result.ticket as any)}
                              </p>
                           </div>
                           <div className="text-right">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">Booking Ref</p>
                              <p className="font-mono text-sm font-bold text-gray-700 dark:text-violet-300">
                                 #{shortTicketRef(String(result.ticket.id)).toUpperCase()}
                              </p>
                           </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100 dark:border-violet-500/15 flex items-center justify-between">
                           <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                              statusStr === "checked_in" 
                                 ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/30" 
                                 : statusStr === "cancelled" 
                                    ? "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border border-red-200/50 dark:border-red-500/30"
                                    : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/30"
                           }`}>
                              Status: {statusStr.replace("_", " ")}
                           </span>

                           {canCheckIn && (
                              <button 
                                 disabled={checkingIn}
                                 onClick={handleCheckIn}
                                 className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                              >
                                 {checkingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Confirm Check-in</>}
                              </button>
                           )}

                           {statusStr === "checked_in" && (
                              <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                                 <CheckCircle className="w-5 h-5" />
                                 {justCheckedIn ? "Welcome! Check-in Complete" : "Already Verified"}
                              </div>
                           )}
                           
                           {statusStr === "cancelled" && (
                              <div className="flex items-center gap-2 text-red-600 font-bold text-sm">
                                 <XCircle className="w-5 h-5" /> Denied: Cancelled
                              </div>
                           )}
                        </div>
                     </div>
                  )}
               </div>


            </div>
         </div>

         {/* Right Side: Activity & Rules */}
         <div className="space-y-6 sm:space-y-8">
            
            {/* Recent Check-ins */}
            <div className="bg-white dark:bg-[var(--card-bg)] rounded-3xl border border-gray-100 dark:border-violet-500/15 p-6 sm:p-7 shadow-sm">
               <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                     <History className="w-5 h-5 text-primary" />
                     <h3 className="text-lg font-bold text-gray-900 dark:text-violet-100">Recent Check-ins</h3>
                  </div>
               </div>
               <p className="text-gray-500 dark:text-violet-300/80 text-xs font-medium mb-5">Last scanned tickets and their status</p>
               
               <div className="space-y-3">
                  {metrics.recentCheckIns.length === 0 ? (
                     <p className="text-center py-8 text-sm text-gray-400 italic">No recent check-ins found</p>
                  ) : (
                     metrics.recentCheckIns.map(item => (
                        <div key={item.id} className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-500/10 rounded-xl relative group hover:border-emerald-500/30 transition-all">
                           <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                 <CheckCircle className="w-4 h-4 text-emerald-500" />
                                 <div className="min-w-0">
                                    <p className="font-bold text-gray-900 dark:text-violet-100 text-sm truncate">{item.purchaser_name}</p>
                                    <p className="text-[10px] font-bold text-gray-500 dark:text-violet-400 uppercase tracking-tighter">
                                       #{shortTicketRef(item.id).toUpperCase()} • {TYPE_LABELS[item.type] || item.type} • Qty: {item.quantity}
                                    </p>
                                 </div>
                              </div>
                              <div className="text-right shrink-0">
                                 <span className="inline-block bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-md mb-1">Checked-in</span>
                                 <p className="text-[9px] font-bold text-gray-400">{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'})}</p>
                              </div>
                           </div>
                        </div>
                     ))
                  )}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
