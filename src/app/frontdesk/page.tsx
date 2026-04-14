"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Keyboard,
  Scan,
  AlertOctagon,
  CheckCircle,
  XCircle,
  QrCode,
  History
} from "lucide-react";
import { supabase } from "@/utils/supabase";
import {
  parseTicketQrPayload,
  shortTicketRef,
  type ParsedTicketQr,
} from "@/utils/ticket-qr";
import { ticketQuantity } from "@/utils/ticket-counts";

interface TicketMinimal {
  id: string;
  purchaser_name: string | null;
  type: string;
  quantity: number;
  status: string;
  created_at: string;
}

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
      ticket: TicketMinimal;
      parsed?: ParsedTicketQr | null;
      mismatch?: string;
    };

export default function FrontdeskCheckInPage() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanContainerId = `fd-qr-${useId().replace(/:/g, "")}`;
  const [scannerActive, setScannerActive] = useState(true);
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
    recentCheckIns: [] as TicketMinimal[]
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
      ticket: row as TicketMinimal,
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
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => {});
        }
        scannerRef.current = null;
      }
      return;
    }

    const html5QrCode = new Html5Qrcode(scanContainerId);
    scannerRef.current = html5QrCode;

    html5QrCode.start(
      { facingMode: "environment" },
      {
        fps: 15,
        qrbox: { width: minBox(), height: minBox() },
        aspectRatio: 1,
      },
      (decodedText) => {
        onScanSuccess(decodedText);
      },
      () => {}
    ).catch(err => {
      console.error("Scanner start error:", err);
      // Fallback if environment camera fails
      html5QrCode.start(
        { facingMode: "user" },
        { 
          fps: 15, 
          qrbox: { width: minBox(), height: minBox() },
          aspectRatio: 1,
        },
        (decodedText) => onScanSuccess(decodedText),
        () => {}
      ).catch(e => console.error("Final fallback error:", e));
    });

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
      scannerRef.current = null;
    };
  }, [scannerActive, onScanSuccess, scanContainerId]);

  function minBox() {
    if (typeof window === "undefined") return 200;
    return Math.min(200, Math.floor(window.innerWidth - 64));
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
        ticket: (fresh || row) as TicketMinimal,
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
                     <div className="overflow-hidden rounded-3xl border-4 border-gray-900 bg-gray-950 shadow-2xl relative max-w-[320px] mx-auto aspect-square">
                        <div id={scanContainerId} className="w-full h-full" />
                        <div className="absolute inset-0 pointer-events-none border-[1rem] border-black/40 flex items-center justify-center">
                           <div className="w-44 h-44 sm:w-48 sm:h-48 border-2 border-primary/30 relative">
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

               {/* Modal Overlay for Results/Errors */}
               {lookup.kind !== "idle" && lookup.kind !== "loading" && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                     <div className="bg-white dark:bg-violet-950/90 border border-white/20 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-300">
                        
                        {/* Error Modal */}
                        {lookup.kind === "error" && (
                           <div className="p-8 text-center space-y-6">
                              <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-400">
                                 <AlertOctagon className="w-8 h-8" />
                              </div>
                              <div>
                                 <h3 className="text-xl font-bold text-gray-900 dark:text-violet-100">Invalid Ticket</h3>
                                 <p className="text-gray-500 dark:text-violet-300/80 mt-2">{lookup.message}</p>
                              </div>
                              <button 
                                 onClick={() => setLookup({ kind: "idle" })}
                                 className="w-full bg-gray-900 dark:bg-violet-800 text-white font-bold py-4 rounded-2xl hover:bg-gray-800 active:scale-95 transition-all"
                              >
                                 Dismiss
                              </button>
                           </div>
                        )}

                        {/* Result Modal */}
                        {result && (
                           <div className="relative">
                              {/* Header Pattern */}
                              <div className={`h-24 ${statusStr === 'checked_in' ? 'bg-emerald-500' : 'bg-primary'} opacity-10 absolute top-0 inset-x-0`} />
                              
                              <div className="p-8 pt-10 space-y-6">
                                 {result.mismatch && (
                                    <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/40 rounded-xl flex items-center gap-3 text-red-700 dark:text-red-400 font-bold text-sm uppercase tracking-wide">
                                       <AlertTriangle className="w-5 h-5" /> {result.mismatch}
                                    </div>
                                 )}

                                 <div className="flex justify-between items-start">
                                    <div className="space-y-1.5">
                                       <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Entry Pass Detail</span>
                                       <h3 className="text-2xl font-bold text-gray-900 dark:text-violet-100">{String(result.ticket.purchaser_name || "Guest")}</h3>
                                       <div className="text-xl font-bold text-primary">
                                          {TYPE_LABELS[String(result.ticket.type)] || String(result.ticket.type)}
                                       </div>
                                    </div>
                                    <div className="text-right">
                                       <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 px-6 py-3 rounded-2xl">
                                          <span className="text-[10px] font-bold text-primary dark:text-primary-light uppercase tracking-widest block mb-1">Quantity</span>
                                          <p className="text-4xl font-black text-primary tabular-nums">
                                             {ticketQuantity(result.ticket)}
                                          </p>
                                       </div>
                                       <p className="font-mono text-[10px] font-bold text-gray-400 dark:text-violet-400 block mt-3 pr-2">
                                          ID: #{shortTicketRef(String(result.ticket.id)).toUpperCase()}
                                       </p>
                                    </div>
                                 </div>

                                 <div className="py-4 border-y border-gray-100 dark:border-violet-500/15 flex items-center justify-between">
                                    <div className="flex flex-col">
                                       <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Current Status</span>
                                       <span className={`mt-1 font-bold ${
                                          statusStr === "checked_in" ? "text-emerald-600" : "text-amber-600"
                                       }`}>
                                          {statusStr.replace("_", " ").toUpperCase()}
                                       </span>
                                    </div>
                                    
                                    {statusStr === "checked_in" && (
                                       <div className="flex items-center gap-2 text-emerald-600 font-bold italic">
                                          <CheckCircle2 className="w-5 h-5" /> Verified
                                       </div>
                                    )}
                                 </div>

                                 <div className="flex gap-3">
                                    <button 
                                       onClick={() => setLookup({ kind: "idle" })}
                                       className="flex-1 bg-gray-100 dark:bg-violet-950/50 text-gray-600 dark:text-violet-300 font-bold py-4 rounded-2xl hover:bg-gray-200 transition-all"
                                    >
                                       Close
                                    </button>
                                    
                                    {canCheckIn && (
                                       <button 
                                          disabled={checkingIn}
                                          onClick={handleCheckIn}
                                          className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                                       >
                                          {checkingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> Admit Guest</>}
                                       </button>
                                    )}
                                 </div>
                              </div>
                           </div>
                        )}
                     </div>
                  </div>
               )}

               {/* Loading Overlay (Semi-transparent over scanner) */}
               {lookup.kind === "loading" && (
                  <div className="absolute inset-0 z-40 bg-black/20 backdrop-blur-[1px] flex items-center justify-center rounded-3xl">
                     <div className="bg-white/90 dark:bg-violet-950/90 px-6 py-4 rounded-2xl flex items-center gap-4 shadow-xl border border-white/20">
                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                        <span className="text-sm font-bold text-gray-700 dark:text-white uppercase tracking-widest">Validating...</span>
                     </div>
                  </div>
               )}



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
