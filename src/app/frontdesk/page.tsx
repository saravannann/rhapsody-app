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
  History,
  Search,
  Users,
  Clock,
  ExternalLink,
  ChevronRight,
  User
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
  ticket_id?: string;
  purchaser_name: string | null;
  type: string;
  quantity: number;
  checked_in_count: number;
  status: string;
  created_at: string;
  sequence_number?: number | null;
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
  const [partialCount, setPartialCount] = useState(1);
  const [attendeeName, setAttendeeName] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scanner' | 'research'>('scanner');
  
  // Research State
  const [researchQuery, setResearchQuery] = useState("");
  const [researchResults, setResearchResults] = useState<any[]>([]);
  const [researchLoading, setResearchLoading] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<any | null>(null);
  const [auditLog, setAuditLog] = useState<any[]>([]);

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
        .select("status, type, quantity, created_at, checked_in_count");
      
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

          if (status === "checked_in" || (t.checked_in_count || 0) > 0) {
            checkedInTotal += (t.checked_in_count || 0);
            
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

      // Fetch Recent Check-ins from transaction log
      const { data: recent, error: logErr } = await supabase
        .from("ticket_checkins")
        .select("*, tickets(id, purchaser_name, type, sequence_number)")
        .order("created_at", { ascending: false })
        .limit(8);

      if (logErr) console.error("Error fetching recent logs:", logErr);

      // Map to a format usable by the list
      const formattedRecent = (recent || []).map(log => ({
        id: log.id, // Transaction ID (Unique for keys)
        ticket_id: log.ticket_id, // Ticket Reference
        purchaser_name: log.checked_in_name || log.tickets?.purchaser_name || "Guest",
        type: log.tickets?.type || "Unknown",
        quantity: log.count,
        checked_in_count: log.count,
        created_at: log.created_at,
        sequence_number: log.tickets?.sequence_number,
        status: "checked_in"
      }));

      setMetrics({
        totalCheckedIn: checkedInTotal,
        totalScannable: scannableTotal,
        thisHour: hourCount,
        peakTime: peakStr,
        recentCheckIns: (formattedRecent as TicketMinimal[]) || []
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
      .select("*, checked_in_count, sequence_number")
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

    const qty = ticketQuantity(row);
    const checkedIn = row.checked_in_count || 0;

    if (checkedIn >= qty) {
      setLookup({ 
        kind: "error", 
        message: `Already checked-in: This guest (${String(row.purchaser_name || "Guest")}) and all ${qty} members have already been admitted.` 
      });
      return;
    }

    // Set default check-in values for partial support
    setPartialCount(qty - checkedIn);
    setAttendeeName(row.purchaser_name || "");

    // [New] Fetch history immediately for the mini-timeline
    fetchAuditLog(row.id);

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

  const handleResearch = useCallback(async () => {
    if (!researchQuery.trim()) return;
    setResearchLoading(true);
    
    // Reset previous audit selection and logs
    setSelectedAudit(null);
    setAuditLog([]);

    try {
      const s = `%${researchQuery}%`;
      const formattedMatch = researchQuery.match(/^R-(\d{1,4})-([A-Z0-9]{0,8})/i);
      const sequenceMatch = researchQuery.match(/^\d{1,4}$/);
      const shortIdMatch = /^[0-9a-fA-F]{1,8}$/.test(researchQuery);

      let query = supabase.from('tickets').select('*, sequence_number');
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
         orConditions += `,sequence_number.eq.${parseInt(researchQuery)}`;
      } else if (shortIdMatch || researchQuery.length > 20) {
         orConditions += `,id_text.ilike.${researchQuery}%`;
      }

      const { data, error } = await query.or(orConditions).limit(20);
      if (error) throw error;
      setResearchResults(data || []);
    } catch (err) {
      console.error("Research Fetch Error:", err);
    } finally {
      setResearchLoading(false);
    }
  }, [researchQuery]);

  const fetchAuditLog = useCallback(async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from("ticket_checkins")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setAuditLog(data || []);
    } catch (err) {
      console.error("Audit Log Error:", err);
    }
  }, []);

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
      // Check for HTTPS/Secure Context (modern browser requirement)
      if (typeof window !== "undefined" && !window.isSecureContext && window.location.hostname !== "localhost") {
        setCameraError("Insecure Connection (HTTP): Browsers only allow camera access on Secure Connections (HTTPS) or localhost. Please use HTTPS.");
        return;
      }

      const errMsg = String(err).toLowerCase();
      if (errMsg.includes("notallowederror") || errMsg.includes("permission denied")) {
        console.warn("Camera access was denied by user/browser.");
        setCameraError("Camera access denied. Please enable camera permissions in your browser settings and refresh the page.");
        return;
      }

      console.error("Scanner start error (hardware/env):", err);

      // Fallback if environment camera fails (e.g. desktop)
      html5QrCode.start(
        { facingMode: "user" },
        { 
          fps: 15, 
          qrbox: { width: minBox(), height: minBox() },
          aspectRatio: 1,
        },
        (decodedText) => onScanSuccess(decodedText),
        () => {}
      ).catch(e => {
        const finalMsg = String(e).toLowerCase();
        if (finalMsg.includes("notallowederror") || finalMsg.includes("permission denied")) {
          setCameraError("Camera access denied. Please enable camera permissions in your browser settings.");
        } else {
          console.error("Final fallback error:", e);
          setCameraError("Could not start camera. Please ensure no other app is using it.");
        }
      });
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
    const qty = ticketQuantity(row);
    const existingCount = row.checked_in_count || 0;
    
    if (existingCount >= qty) return;

    setCheckingIn(true);
    try {
      const newCount = existingCount + partialCount;
      const finalStatus = newCount >= qty ? "checked_in" : row.status;

      // 1. Update the ticket
      const { error: updateError } = await supabase
        .from("tickets")
        .update({ 
          checked_in_count: newCount,
          status: finalStatus
        })
        .eq("id", row.id as string);

      if (updateError) throw updateError;

      // 2. Log the transaction
      const { error: logError } = await supabase
        .from("ticket_checkins")
        .insert({
          ticket_id: row.id,
          count: partialCount,
          checked_in_name: attendeeName || (newCount === qty ? row.purchaser_name : "Partial Group")
        });

      if (logError) {
        console.error("Could not log check-in transaction:", JSON.stringify(logError, null, 2));
      }

      // 3. Refresh and Close
      await fetchMetrics();
      setJustCheckedIn(true);
      
      const { data: fresh } = await supabase
        .from("tickets")
        .select("*, checked_in_count")
        .eq("id", row.id as string)
        .single();

      setLookup({
        kind: "result",
        ticket: (fresh || row) as TicketMinimal,
        parsed: lookup.parsed,
        mismatch: lookup.mismatch,
      });

      // Show success feedback for 2 seconds then close
      setTimeout(() => {
        setLookup({ kind: "idle" });
        setJustCheckedIn(false);
      }, 2000);

    } catch (err: any) {
      console.error(err);
      alert("Check-in failed: " + err.message);
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
               <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-violet-100 flex items-center gap-2 uppercase tracking-tight italic">
                  <span className="bg-primary px-3 py-1 rounded-sm text-white text-xl non-italic">Rhapsody</span>
                  Front Desk
               </h1>
               <p className="text-gray-500 dark:text-violet-300 font-medium mt-1">
                  {activeTab === 'scanner' ? 'Scan QR codes to validate and check-in attendees' : 'Audit and research ticket entry history'}
               </p>
            </div>
         </div>
         
         <div className="flex bg-white dark:bg-violet-950/40 p-1 rounded-2xl border border-gray-100 dark:border-violet-500/10 shadow-sm self-start">
            <button 
               onClick={() => {
                  setActiveTab('scanner');
                  setLookup({ kind: 'idle' });
               }}
               className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'scanner' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-500 hover:text-primary dark:text-violet-400/60 hover:bg-gray-50 dark:hover:bg-violet-950/40'}`}
            >
               <Scan className="w-4 h-4" />
               Scanner
            </button>
            <button 
               onClick={() => setActiveTab('research')}
               className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'research' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-500 hover:text-primary dark:text-violet-400/60 hover:bg-gray-50 dark:hover:bg-violet-950/40'}`}
            >
               <Search className="w-4 h-4" />
               Research
            </button>
         </div>
      </div>

      {activeTab === 'scanner' ? (
         <>
            {/* Metrics Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
               <div className="bg-white dark:bg-violet-950/40 p-4 sm:p-6 rounded-2xl border border-gray-100 dark:border-violet-500/15 shadow-sm hover:border-primary/30 transition-all group">
                  <span className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest block mb-2 sm:mb-4">Total Checked In</span>
                  <div className="flex items-baseline gap-2">
                     <span className="text-2xl sm:text-4xl font-bold text-emerald-600 tabular-nums">{metrics.totalCheckedIn}</span>
                     <span className="text-xs sm:text-sm font-bold text-gray-400">of {metrics.totalScannable}</span>
                  </div>
               </div>

               <div className="bg-white dark:bg-violet-950/40 p-4 sm:p-6 rounded-2xl border border-gray-100 dark:border-violet-500/15 shadow-sm hover:border-primary/30 transition-all group">
                  <span className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest block mb-2 sm:mb-4">Check-in Rate</span>
                  <div className="text-2xl sm:text-4xl font-bold text-secondary tabular-nums">{checkInRate}%</div>
               </div>

               <div className="bg-white dark:bg-violet-950/40 p-4 sm:p-6 rounded-2xl border border-gray-100 dark:border-violet-500/15 shadow-sm hover:border-primary/30 transition-all group">
                  <span className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest block mb-1 sm:mb-4">This Hour</span>
                  <div className="text-2xl sm:text-4xl font-bold text-primary tabular-nums">{metrics.thisHour}</div>
               </div>

               <div className="bg-white dark:bg-violet-950/40 p-4 sm:p-6 rounded-2xl border border-gray-100 dark:border-violet-500/15 shadow-sm hover:border-primary/30 transition-all group">
                  <span className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest block mb-1 sm:mb-4">Peak Time</span>
                  <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-violet-100 mt-2">{metrics.peakTime}</div>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
               
               {/* Left Side: Scanner */}
               <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white dark:bg-violet-950/40 rounded-3xl border border-gray-100 dark:border-violet-500/15 p-6 sm:p-8 shadow-sm relative overflow-hidden">
                     <div className="flex items-center justify-between mb-6 relative z-10">
                        <div className="flex items-center gap-3">
                           <Scan className="w-5 h-5 text-primary" />
                           <h2 className="text-lg font-bold text-gray-900 dark:text-violet-100">Quick Admission</h2>
                        </div>
                        <div className="flex rounded-xl overflow-hidden border border-gray-100 dark:border-violet-500/20">
                           <button onClick={() => setScannerActive(true)} className={`px-4 py-2 text-xs font-bold transition-all ${scannerActive ? 'bg-primary text-white' : 'bg-gray-50 dark:bg-violet-950/30 text-gray-500 hover:text-primary'}`}>Camera</button>
                           <button onClick={() => setScannerActive(false)} className={`px-4 py-2 text-xs font-bold transition-all ${!scannerActive ? 'bg-primary text-white' : 'bg-gray-50 dark:bg-violet-950/30 text-gray-500 hover:text-primary'}`}>Manual</button>
                        </div>
                     </div>

                     <div className="relative group min-h-[400px] flex items-center justify-center">
                        {scannerActive ? (
                           <div className="w-full relative">
                              <div className="overflow-hidden rounded-3xl border-4 border-gray-900 bg-gray-950 shadow-2xl relative max-w-[320px] mx-auto aspect-square">
                                 <div id={scanContainerId} className="w-full h-full" />
                                 
                                 {cameraError && (
                                    <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center p-6 text-center z-10">
                                       <AlertOctagon className="w-12 h-12 text-red-500 mb-4" />
                                       <h3 className="text-white font-bold mb-2 uppercase tracking-widest text-xs">Scanner Blocked</h3>
                                       <button 
                                          onClick={() => window.location.reload()}
                                          className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-xl text-xs font-bold transition-all shadow-lg"
                                       >
                                          Refresh & Retry
                                       </button>
                                    </div>
                                 )}
                              </div>
                           </div>
                        ) : (
                           <div className="w-full max-w-md space-y-4">
                              <div className="relative">
                                 <textarea
                                    value={manualInput}
                                    onChange={(e) => setManualInput(e.target.value)}
                                    rows={4}
                                    placeholder="Paste ticket QR text or URL..."
                                    className="block w-full px-6 py-6 bg-gray-50 dark:bg-violet-950/20 border-2 border-dashed border-gray-200 dark:border-violet-500/20 rounded-3xl text-sm font-bold text-gray-900 dark:text-violet-100 placeholder:text-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                                 />
                              </div>
                              <button 
                                 onClick={() => runLookup(manualInput)}
                                 className="w-full bg-primary hover:bg-primary-dark text-white font-black py-4 rounded-2xl shadow-lg shadow-primary/20 transition-all uppercase tracking-widest"
                              >
                                 Verify Ticket
                              </button>
                           </div>
                        )}

                        {/* Modal Overlay for Results */}
                        {lookup.kind !== "idle" && lookup.kind !== "loading" && (
                           <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                              <div className="bg-white dark:bg-violet-950/90 border border-white/20 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden scale-in-center">
                                 
                                 {lookup.kind === "error" && (
                                    <div className="p-8 text-center space-y-6">
                                       <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600">
                                          <AlertOctagon className="w-8 h-8" />
                                       </div>
                                       <div>
                                          <h2 className="text-xl font-bold text-gray-900 dark:text-violet-100">Ticket Error</h2>
                                          <p className="text-gray-500 dark:text-violet-300/80 mt-2">{lookup.message}</p>
                                       </div>
                                       <button onClick={() => setLookup({ kind: "idle" })} className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl">Dismiss</button>
                                    </div>
                                 )}

                                 {result && (
                                    <div className="p-8 space-y-6">
                                       <div className="flex justify-between items-start">
                                          <div className="space-y-1">
                                             <h2 className="text-2xl font-bold text-gray-900 dark:text-violet-100">{result.ticket.purchaser_name}</h2>
                                             <div className="text-lg font-bold text-primary">{TYPE_LABELS[result.ticket.type] || result.ticket.type}</div>
                                          </div>
                                          <div className="bg-primary/5 px-6 py-3 rounded-2xl border border-primary/20 text-center">
                                             <span className="text-[10px] font-bold text-primary uppercase block">Quantity</span>
                                             <p className="text-3xl font-black text-primary">{ticketQuantity(result.ticket)}</p>
                                          </div>
                                       </div>

                                       <div className="py-4 border-y border-gray-100 dark:border-violet-500/10 flex items-center justify-between">
                                          <div>
                                             <span className="text-[10px] font-bold text-gray-400 uppercase">Current Admission</span>
                                             <p className="text-lg font-bold text-gray-800 dark:text-violet-200">
                                                {result.ticket.checked_in_count || 0} / {ticketQuantity(result.ticket)} Admitted
                                             </p>
                                          </div>
                                          <p className="font-mono text-xs font-bold text-gray-400 uppercase tracking-widest">
                                             #{shortTicketRef(result.ticket.id, result.ticket.sequence_number).toUpperCase()}
                                          </p>
                                       </div>

                                       {/* Mini Timeline Integration */}
                                       {auditLog.length > 0 && (
                                          <div className="bg-gray-50 dark:bg-violet-900/20 rounded-2xl p-4 space-y-3">
                                             <div className="flex items-center gap-2 mb-2">
                                                <Clock className="w-3.5 h-3.5 text-primary" />
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Previous Entries</span>
                                             </div>
                                             <div className="space-y-3">
                                                {auditLog.slice(0, 3).map((log) => (
                                                   <div key={log.id} className="flex items-center justify-between text-[11px]">
                                                      <div className="flex items-center gap-2">
                                                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                         <div className="flex items-center gap-2 min-w-0">
                                                            <span className="font-bold text-gray-700 dark:text-violet-200 shrink-0">{log.count} Band{log.count > 1 ? 's' : ''}</span>
                                                            <span className="text-gray-300 dark:text-violet-500/30 font-medium">•</span>
                                                            <span className="text-[9px] font-medium text-gray-400 uppercase tracking-tighter truncate">{log.checked_in_name || "Self"}</span>
                                                         </div>
                                                      </div>
                                                      <span className="text-gray-400 font-medium">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                                                   </div>
                                                ))}
                                                {auditLog.length > 3 && (
                                                   <p className="text-[9px] text-primary font-bold text-center pt-1">+ {auditLog.length - 3} more in Research tab</p>
                                                )}
                                             </div>
                                          </div>
                                       )}

                                       {(result.ticket.checked_in_count || 0) < ticketQuantity(result.ticket) && (
                                          <div className="space-y-5">
                                             <div>
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Checking in for:</label>
                                                <div className="relative">
                                                   <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                   <input 
                                                      type="text"
                                                      value={attendeeName}
                                                      onChange={(e) => setAttendeeName(e.target.value)}
                                                      placeholder="Guest Name (Optional)"
                                                      className="w-full pl-11 pr-4 py-3.5 bg-gray-50 dark:bg-violet-900/10 border border-gray-100 dark:border-violet-500/10 rounded-2xl text-sm font-bold text-gray-900 dark:text-violet-100 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                                   />
                                                </div>
                                             </div>

                                             <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-2xl">
                                                <div className="flex flex-col">
                                                   <span className="text-xs font-bold text-emerald-600">Issue Band Count</span>
                                                   <span className="text-[9px] text-emerald-600/60 font-bold uppercase tracking-tight">Quantity to Admit</span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                   <button onClick={() => setPartialCount(Math.max(1, partialCount - 1))} className="w-10 h-10 rounded-full bg-white dark:bg-violet-900 flex items-center justify-center text-xl font-bold shadow-sm">-</button>
                                                   <span className="text-2xl font-black tabular-nums text-emerald-700 dark:text-emerald-400">{partialCount}</span>
                                                   <button onClick={() => setPartialCount(Math.min(ticketQuantity(result.ticket) - (result.ticket.checked_in_count || 0), partialCount + 1))} className="w-10 h-10 rounded-full bg-white dark:bg-violet-900 flex items-center justify-center text-xl font-bold shadow-sm">+</button>
                                                </div>
                                             </div>
                                          </div>
                                       )}

                                       <div className="flex gap-3 pt-2">
                                          <button onClick={() => setLookup({ kind: "idle" })} className="flex-1 bg-gray-100 dark:bg-violet-950/50 text-gray-600 dark:text-violet-300 font-bold py-4 rounded-2xl">Close</button>
                                          {canCheckIn && (
                                             <button 
                                                disabled={checkingIn} 
                                                onClick={handleCheckIn}
                                                className="flex-[2] bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2"
                                             >
                                                {checkingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Admission'}
                                             </button>
                                          )}
                                       </div>
                                    </div>
                                 )}
                              </div>
                           </div>
                        )}

                        {lookup.kind === "loading" && (
                           <div className="absolute inset-0 z-40 bg-black/20 backdrop-blur-[1px] flex items-center justify-center rounded-3xl">
                              <Loader2 className="w-10 h-10 text-primary animate-spin" />
                           </div>
                        )}
                     </div>
                  </div>
               </div>

               {/* Right Side: Activity */}
               <div className="bg-white dark:bg-violet-950/40 rounded-3xl border border-gray-100 dark:border-violet-500/15 p-6 sm:p-8 shadow-sm h-full">
                  <div className="flex items-center gap-3 mb-6">
                     <History className="w-5 h-5 text-primary" />
                     <h2 className="text-lg font-bold text-gray-900 dark:text-violet-100">Live Entries</h2>
                  </div>
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                     {metrics.recentCheckIns.length === 0 ? (
                        <p className="text-gray-400 text-center py-20 italic">No entries logged yet today</p>
                     ) : (
                        metrics.recentCheckIns.map((item) => (
                           <div key={item.id} className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-violet-950/30 border border-transparent hover:border-primary/20 transition-all">
                              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center shrink-0">
                                 <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
                              </div>
                              <div className="min-w-0">
                                 <p className="font-bold text-gray-900 dark:text-violet-100 text-sm truncate">{item.purchaser_name}</p>
                                 <p className="text-[10px] font-bold text-gray-500 dark:text-violet-400 uppercase tracking-tighter">
                                    #{shortTicketRef(item.ticket_id || item.id, item.sequence_number).toUpperCase()} • {TYPE_LABELS[item.type] || item.type} • Qty: {item.quantity}
                                 </p>
                              </div>
                           </div>
                        ))
                     )}
                  </div>
               </div>
            </div>
         </>
      ) : (
         /* Research Portal */
         <div className="space-y-6">
            <div className="bg-white dark:bg-violet-950/40 rounded-3xl border border-gray-100 dark:border-violet-500/15 p-6 sm:p-8 shadow-sm">
               <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                     <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                     <input 
                        type="text" 
                        placeholder="Search by ID, Name, or Mobile..."
                        className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-violet-950/20 border border-gray-100 dark:border-violet-500/20 rounded-2xl text-sm font-bold text-gray-900 dark:text-violet-100 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        value={researchQuery}
                        onChange={(e) => setResearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleResearch()}
                     />
                  </div>
                  <button 
                     onClick={handleResearch}
                     disabled={researchLoading}
                     className="px-8 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 disabled:opacity-50"
                  >
                     {researchLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search Records'}
                  </button>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
               <div className="lg:col-span-8 space-y-4">
                  {researchResults.length === 0 && !researchLoading ? (
                     <div className="bg-white dark:bg-violet-950/20 border-2 border-dashed border-gray-100 dark:border-violet-500/10 rounded-3xl p-20 text-center">
                        <History className="w-12 h-12 text-gray-200 dark:text-violet-800 mx-auto mb-4" />
                        <p className="text-gray-400 dark:text-violet-400/40 font-bold uppercase tracking-widest text-xs">Enter a search query to research records</p>
                     </div>
                  ) : (
                     researchResults.map((t) => (
                        <div 
                           key={t.id}
                           onClick={() => {
                              setSelectedAudit(t);
                              fetchAuditLog(t.id);
                           }}
                           className={`p-5 rounded-3xl border transition-all cursor-pointer flex items-center justify-between ${selectedAudit?.id === t.id ? 'bg-primary/5 border-primary/30 shadow-md ring-1 ring-primary/20' : 'bg-white dark:bg-violet-950/40 border-gray-100 dark:border-violet-500/10 hover:border-primary/20'}`}
                        >
                           <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${t.checked_in_count >= t.quantity ? 'bg-emerald-100 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
                                 {t.checked_in_count >= t.quantity ? <CheckCircle2 className="w-6 h-6" /> : <Users className="w-6 h-6" />}
                              </div>
                              <div>
                                 <div className="flex items-center gap-2">
                                    <p className="font-bold text-gray-900 dark:text-violet-100 text-base">{t.purchaser_name}</p>
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-primary/10 text-primary uppercase">{t.type}</span>
                                 </div>
                                 <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter mt-1">
                                    #{shortTicketRef(t.id, t.sequence_number).toUpperCase()} • {t.purchaser_phone}
                                 </p>
                              </div>
                           </div>
                           <div className="text-right">
                              <p className="text-xl font-bold text-gray-900 dark:text-violet-100 tabular-nums">{t.checked_in_count || 0} / {t.quantity}</p>
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Admitted</p>
                           </div>
                        </div>
                     ))
                  )}
               </div>

               <div className="lg:col-span-4">
                  <div className="bg-white dark:bg-violet-950/40 rounded-3xl border border-gray-100 dark:border-violet-500/15 p-6 sm:p-8 shadow-sm h-full flex flex-col min-h-[500px]">
                     <h2 className="text-lg font-bold text-gray-900 dark:text-violet-100 mb-6 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-primary" />
                        Entry History
                     </h2>

                     {selectedAudit ? (
                        <div className="space-y-6">
                           <div>
                              <p className="text-lg font-bold text-gray-900 dark:text-violet-100 leading-tight">{selectedAudit.purchaser_name}</p>
                              <p className="text-xs font-bold text-primary mt-1 flex items-center gap-2">
                                 #{shortTicketRef(selectedAudit.id, selectedAudit.sequence_number).toUpperCase()}
                                 <a href={`/ticket/${selectedAudit.id}`} target="_blank" className="text-gray-400 hover:text-primary transition-colors"><ExternalLink className="w-3 h-3" /></a>
                              </p>
                           </div>

                           <div className="space-y-6 relative ml-1">
                              {auditLog.length === 0 ? (
                                 <div className="text-center py-10 italic text-gray-400 text-sm">No admission history found.</div>
                              ) : (
                                 auditLog.map((log, i) => (
                                    <div key={log.id} className="relative pl-8">
                                       {i !== auditLog.length - 1 && <div className="absolute left-3 top-5 bottom-0 w-0.5 bg-gray-100 dark:bg-violet-900/40" />}
                                       <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center z-10">
                                          <CheckCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-500" />
                                       </div>
                                       <div>
                                          <p className="text-sm font-bold text-gray-800 dark:text-violet-200">{log.count} Band{log.count > 1 ? 's' : ''} Issued</p>
                                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-0.5">{log.checked_in_name || "Self"}</p>
                                          <p className="text-[9px] text-gray-400 dark:text-violet-400/60 mt-1">
                                             {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })} • {new Date(log.created_at).toLocaleDateString()}
                                          </p>
                                       </div>
                                    </div>
                                 ))
                              )}
                           </div>
                        </div>
                     ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                           <History className="w-12 h-12 text-gray-200 dark:text-violet-900/30 mb-4" />
                           <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-relaxed">Select a ticket from search results<br/>to view history</p>
                        </div>
                     )}
                  </div>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
