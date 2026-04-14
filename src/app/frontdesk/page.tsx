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
  User,
  Zap,
  Volume2,
  VolumeX,
  Smartphone,
  ChevronRight
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
  
  // 1. Check for full /ticket/[id] link
  const linkMatch = trimmed.match(/\/ticket\/([0-9a-f-]{36})/i);
  if (linkMatch) return linkMatch[1];
  
  // 2. Check for plain UUID (36 chars with dashes)
  const uuidMatch = trimmed.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  if (uuidMatch) return trimmed;

  return null;
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
  const [torchOn, setTorchOn] = useState(false);
  const [feedbackEnabled, setFeedbackEnabled] = useState(false);

  // Research State
  const [researchQuery, setResearchQuery] = useState("");
  const [researchResults, setResearchResults] = useState<any[]>([]);
  const [researchLoading, setResearchLoading] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<any | null>(null);
  const [auditLog, setAuditLog] = useState<any[]>([]);

  // Audio Context for beeps
  const audioContextRef = useRef<AudioContext | null>(null);

  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    setFeedbackEnabled(true);
  };

  const playSound = (freq: number, duration: number, type: OscillatorType = 'sine') => {
    if (!feedbackEnabled || !audioContextRef.current) return;
    try {
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio failed", e);
    }
  };

  const notifySuccess = () => {
    playSound(880, 0.1); 
    if ('vibrate' in navigator) navigator.vibrate(50);
  };

  const notifyError = () => {
    playSound(220, 0.3, 'sawtooth');
    if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
  };

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
        const isDonor = type.includes("donor");
        
        if (status !== "cancelled" && !isDonor) {
          scannableTotal += q;
          if (status === "checked_in" || (t.checked_in_count || 0) > 0) {
            checkedInTotal += (t.checked_in_count || 0);
            const updateTime = t.created_at ? new Date(t.created_at).getTime() : 0;
            if (updateTime > hourAgo) hourCount += q;
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
          if (val > maxVal) { maxVal = val; peakHr = parseInt(hr); }
        }
        peakStr = `${peakHr % 12 || 12}:00 ${peakHr >= 12 ? 'PM' : 'AM'} - ${(peakHr + 1) % 12 || 12}:00 ${(peakHr + 1) >= 12 ? 'PM' : 'AM'}`;
      }

      const { data: recent, error: logErr } = await supabase
        .from("ticket_checkins")
        .select("*, tickets(id, purchaser_name, type, sequence_number)")
        .order("created_at", { ascending: false })
        .limit(8);

      if (logErr) console.error("Error fetching recent logs:", logErr);

      const formattedRecent = (recent || []).map(log => ({
        id: log.id,
        ticket_id: log.ticket_id,
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

  const handleCheckIn = useCallback(async (overrideTicket?: TicketMinimal, overrideCount?: number) => {
    const currentResult = lookup.kind === "result" ? lookup : null;
    const row = overrideTicket || currentResult?.ticket;
    if (!row) return;

    const qty = ticketQuantity(row);
    const existingCount = row.checked_in_count || 0;
    const countToAdmit = overrideCount !== undefined ? overrideCount : partialCount;
    
    if (existingCount >= qty) return;
    if (countToAdmit <= 0) return;

    setCheckingIn(true);
    try {
      const newCount = existingCount + countToAdmit;
      const finalStatus = newCount >= qty ? "checked_in" : row.status;

      const { error: updateError } = await supabase
        .from("tickets")
        .update({ checked_in_count: newCount, status: finalStatus })
        .eq("id", row.id as string);

      if (updateError) throw updateError;

      const { error: logError } = await supabase
        .from("ticket_checkins")
        .insert({
          ticket_id: row.id,
          count: countToAdmit,
          checked_in_name: attendeeName || (newCount === qty ? row.purchaser_name : "Partial Group")
        });

      if (logError) console.error("Log error:", logError);

      notifySuccess();
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
        parsed: currentResult?.parsed || null,
        mismatch: currentResult?.mismatch,
      });

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
  }, [lookup, partialCount, attendeeName, fetchMetrics]);

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
      notifyError();
      setLookup({ kind: "error", message: "Unrecognised format." });
      return;
    }

    setLookup({ kind: "loading" });
    const { data: row, error } = await supabase
      .from("tickets")
      .select("*, checked_in_count, sequence_number")
      .eq("id", ticketId)
      .maybeSingle();

    if (error || !row) {
      setLookup({ kind: "error", message: "No ticket found." });
      return;
    }

    const qty = ticketQuantity(row);
    const checkedIn = row.checked_in_count || 0;

    if (checkedIn >= qty) {
      notifyError();
      // We still set it as a result so we can show the history/audit trail
    }

    setPartialCount(Math.max(0, qty - checkedIn));
    setAttendeeName(row.purchaser_name || "");
    fetchAuditLog(row.id);

    let mismatch: string | undefined;
    if (parsed && (row.type !== parsed.typeId || ticketQuantity(row) !== parsed.quantity)) {
      mismatch = "QR data mismatch.";
    }

    const rs: LookupState = { kind: "result", ticket: row as TicketMinimal, parsed: parsed || null, mismatch };
    setLookup(rs);

    if (qty === 1 && checkedIn === 0 && !mismatch) {
       setTimeout(() => { handleCheckIn(row as TicketMinimal, 1); }, 300);
    }
  }, [fetchAuditLog, handleCheckIn]);

  // [FIX] Use a ref to prevent scanner restart loops
  const lookupRef = useRef(lookup);
  useEffect(() => { lookupRef.current = lookup; }, [lookup]);

  const onScanSuccess = useCallback((decodedText: string) => {
    if (cooldownRef.current || lookupRef.current.kind !== 'idle') return;
    cooldownRef.current = true;
    setManualInput(decodedText);
    void runLookup(decodedText);
    setTimeout(() => { cooldownRef.current = false; }, 1500);
  }, [runLookup]);

  const handleResearch = useCallback(async () => {
    if (!researchQuery.trim()) return;
    setResearchLoading(true);
    setSelectedAudit(null);
    setAuditLog([]);

    try {
      const s = `%${researchQuery.trim()}%`;
      const qText = researchQuery.trim();
      
      // Smart detection of what the user is searching for
      const formattedMatch = qText.match(/^R-(\d{1,4})-([A-Z0-9]{0,8})/i);
      const sequenceMatch = qText.match(/^\d{1,4}$/);
      const isUuidPrefix = /^[0-9a-fA-F-]{4,36}$/.test(qText);

      let query = supabase.from('tickets').select('*, sequence_number');
      let orConditions = `purchaser_name.ilike.${s},purchaser_phone.ilike.${s}`;

      if (formattedMatch) {
         const seq = parseInt(formattedMatch[1]);
         orConditions += `,sequence_number.eq.${seq}`;
      } else if (sequenceMatch) {
         orConditions += `,sequence_number.eq.${parseInt(qText)}`;
      } 
      
      // Always try to match the ID as a fragment for "BBBBBBBB" searches
      if (isUuidPrefix || qText.length >= 6) {
         // Use id_text (generated text column) for UUID partial matching
         orConditions += `,id_text.ilike.%${qText}%`;
      }

      const { data, error } = await query.or(orConditions).order('created_at', { ascending: false }).limit(20);
      if (error) throw error;
      setResearchResults(data || []);
    } catch (err) {
      console.error("Research Error:", err);
    } finally {
      setResearchLoading(false);
    }
  }, [researchQuery]);

  useEffect(() => {
    if (!scannerActive) {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
      scannerRef.current = null;
      return;
    }

    // [FIX] Delayed initialization to ensure DOM is ready
    let animationFrameId: number;

    const initScanner = () => {
      const element = document.getElementById(scanContainerId);
      if (!element) return; 

      const h = new Html5Qrcode(scanContainerId);
      scannerRef.current = h;
      
      const startCamera = (mode: string) => {
        return h.start(
          { facingMode: mode }, 
          { fps: 15, qrbox: { width: minBox(), height: minBox() }, aspectRatio: 1 }, 
          (d) => onScanSuccess(d), 
          () => {}
        );
      }

      startCamera("environment").catch((err) => {
        // [FIX] Ignore AbortError and Interruption errors
        const errMsg = String(err);
        if (errMsg.includes("AbortError") || errMsg.includes("interrupted")) {
          return; 
        }

        // Fallback to user camera
        startCamera("user").catch(e => {
           const finalMsg = String(e);
           if (!finalMsg.includes("AbortError") && !finalMsg.includes("interrupted")) {
              setCameraError(finalMsg);
           }
        });
      });
    };

    animationFrameId = requestAnimationFrame(initScanner);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
      scannerRef.current = null;
    };
  }, [scannerActive, onScanSuccess, scanContainerId]);

  function minBox() {
    if (typeof window === "undefined") return 200;
    return Math.min(200, Math.floor(window.innerWidth - 64));
  }

  const result = lookup.kind === "result" ? lookup : null;
  const statusStr = result ? String(result.ticket.status || "").toLowerCase() : "";
  const canCheckIn = result && !result.mismatch && (statusStr === "pending" || statusStr === "booked" || statusStr === "ticket issued" || statusStr === "ticket_issued");
  const checkInRate = metrics.totalScannable > 0 ? ((metrics.totalCheckedIn / metrics.totalScannable) * 100).toFixed(1) : "0.0";

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-8 space-y-6 sm:space-y-10 animate-in fade-in duration-700">
      
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
                  {activeTab === 'scanner' ? 'Scan QR codes to validate' : 'Research ticket history'}
               </p>
            </div>
         </div>
         
         <div className="flex bg-white dark:bg-violet-950/40 p-1 rounded-2xl border border-gray-100 dark:border-violet-500/10 shadow-sm self-start">
            <button onClick={() => { setActiveTab('scanner'); setLookup({ kind: 'idle' }); }} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'scanner' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-500 hover:text-primary dark:text-violet-400/60 hover:bg-gray-50 dark:hover:bg-violet-950/40'}`}>
               <Scan className="w-4 h-4" /> Scanner
            </button>
            <button onClick={() => setActiveTab('research')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'research' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-500 hover:text-primary dark:text-violet-400/60 hover:bg-gray-50 dark:hover:bg-violet-950/40'}`}>
               <Search className="w-4 h-4" /> Research
            </button>
         </div>
      </div>

      {activeTab === 'scanner' ? (
         <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
               <div className="bg-white dark:bg-violet-950/40 p-4 sm:p-6 rounded-2xl border border-gray-100 dark:border-violet-500/15 shadow-sm">
                  <span className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-violet-400/60 uppercase block mb-2 sm:mb-4">Total Checked In</span>
                  <div className="flex items-baseline gap-2">
                     <span className="text-2xl sm:text-4xl font-bold text-emerald-600 tabular-nums">{metrics.totalCheckedIn}</span>
                     <span className="text-xs sm:text-sm font-bold text-gray-400">of {metrics.totalScannable}</span>
                  </div>
               </div>
               <div className="bg-white dark:bg-violet-950/40 p-4 sm:p-6 rounded-2xl border border-gray-100 dark:border-violet-500/15 shadow-sm">
                  <span className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-violet-400/60 uppercase block mb-2 sm:mb-4">Check-in Rate</span>
                  <div className="text-2xl sm:text-4xl font-bold text-secondary tabular-nums">{checkInRate}%</div>
               </div>
               <div className="bg-white dark:bg-violet-950/40 p-4 sm:p-6 rounded-2xl border border-gray-100 dark:border-violet-500/15 shadow-sm">
                  <span className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-violet-400/60 uppercase block mb-1 sm:mb-4">This Hour</span>
                  <div className="text-2xl sm:text-4xl font-bold text-primary tabular-nums">{metrics.thisHour}</div>
               </div>
               <div className="bg-white dark:bg-violet-950/40 p-4 sm:p-6 rounded-2xl border border-gray-100 dark:border-violet-500/15 shadow-sm">
                  <span className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-violet-400/60 uppercase block mb-1 sm:mb-4">Peak Time</span>
                  <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-violet-100 mt-2">{metrics.peakTime}</div>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
               <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white dark:bg-violet-950/40 rounded-3xl border border-gray-100 dark:border-violet-500/15 p-6 sm:p-8 shadow-sm relative overflow-hidden">
                     <div className="flex items-center justify-between mb-6 relative z-10">
                        <div className="flex items-center gap-3">
                           <Scan className="w-5 h-5 text-primary" />
                           <h2 className="text-lg font-bold text-gray-900 dark:text-violet-100">Quick Admission</h2>
                        </div>
                        <div className="flex rounded-xl overflow-hidden border border-gray-100 dark:border-violet-500/20">
                           {!feedbackEnabled ? (
                             <button onClick={initAudio} className="px-3 py-2 bg-amber-500/10 text-amber-500 flex items-center gap-1.5"><VolumeX className="w-3.5 h-3.5" /><span className="text-[10px] font-bold uppercase">Sound Off</span></button>
                           ) : (
                             <button onClick={() => setFeedbackEnabled(false)} className="px-3 py-2 bg-emerald-500/10 text-emerald-500 flex items-center gap-1.5"><Volume2 className="w-3.5 h-3.5" /><span className="text-[10px] font-bold uppercase">Sound On</span></button>
                           )}
                           <button onClick={() => setScannerActive(true)} className={`px-4 py-2 text-xs font-bold transition-all ${scannerActive ? 'bg-primary text-white' : 'bg-gray-50 dark:bg-violet-950/30 text-gray-500'}`}>Camera</button>
                           <button onClick={() => setScannerActive(false)} className={`px-4 py-2 text-xs font-bold transition-all ${!scannerActive ? 'bg-primary text-white' : 'bg-gray-50 dark:bg-violet-950/30 text-gray-500'}`}>Manual</button>
                        </div>
                     </div>

                     <div className="relative group min-h-[400px] flex items-center justify-center">
                        {scannerActive && (
                           <button onClick={() => { const next = !torchOn; setTorchOn(next); if (scannerRef.current) (scannerRef.current as any).applyVideoConstraints({ advanced: [{ torch: next }] }).catch(() => {}); }} className={`absolute top-0 right-0 z-30 p-4 rounded-full transition-all ${torchOn ? 'bg-amber-400 text-gray-900' : 'bg-gray-900/40 text-white'}`}><Zap className={`w-6 h-6 ${torchOn ? 'fill-current' : ''}`} /></button>
                        )}
                        {scannerActive ? (
                           <div className="w-full relative"><div className="overflow-hidden rounded-3xl border-4 border-gray-900 bg-gray-950 shadow-2xl relative max-w-[320px] mx-auto aspect-square text-center"><div id={scanContainerId} className="w-full h-full" />{cameraError && <p className="text-white p-4">Camera Error</p>}</div></div>
                        ) : (
                           <div className="w-full max-w-md space-y-4"><textarea value={manualInput} onChange={(e) => setManualInput(e.target.value)} rows={4} placeholder="Paste ticket code..." className="block w-full px-6 py-6 bg-gray-50 dark:bg-violet-950/20 border-2 border-dashed border-gray-200 dark:border-violet-500/20 rounded-3xl text-sm font-bold outline-none" /><button onClick={() => runLookup(manualInput)} className="w-full bg-primary text-white font-black py-4 rounded-2xl shadow-lg uppercase tracking-widest">Verify Ticket</button></div>
                        )}

                        {lookup.kind !== "idle" && lookup.kind !== "loading" && (
                           <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                              <div className="bg-white dark:bg-violet-950/90 border border-white/20 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden p-8 space-y-6">
                                 {lookup.kind === "error" ? (
                                    <div className="text-center space-y-6"><div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600"><AlertOctagon className="w-8 h-8" /></div><h2 className="text-xl font-bold">{lookup.message}</h2><button onClick={() => setLookup({ kind: "idle" })} className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl">Dismiss</button></div>
                                 ) : result && (
                                    <>
                                       <div className="flex justify-between items-start">
                                          <div>
                                             <h2 className="text-2xl font-bold">{result.ticket.purchaser_name}</h2>
                                             <div className="text-lg font-bold text-primary">{TYPE_LABELS[result.ticket.type] || result.ticket.type}</div>
                                             {(result.ticket.checked_in_count || 0) >= ticketQuantity(result.ticket) && (
                                                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                                                   <AlertOctagon className="w-3 h-3" />
                                                   Fully Admitted
                                                </div>
                                             )}
                                          </div>
                                          <div className={`px-6 py-3 rounded-2xl border text-center transition-all ${ (result.ticket.checked_in_count || 0) >= ticketQuantity(result.ticket) ? 'bg-red-50 border-red-100 text-red-600' : 'bg-primary/5 border-primary/20 text-primary'}`}>
                                             <span className="text-[10px] font-bold uppercase block">Quantity</span>
                                             <p className="text-3xl font-black">{ticketQuantity(result.ticket)}</p>
                                          </div>
                                       </div>
                                       <div className="py-4 border-y border-gray-100 flex items-center justify-between"><div><span className="text-[10px] font-bold text-gray-400 uppercase">Current Admission</span><p className="text-lg font-bold">{result.ticket.checked_in_count || 0} / {ticketQuantity(result.ticket)} Admitted</p></div><p className="font-mono text-xs text-gray-400 uppercase tracking-widest">#{shortTicketRef(result.ticket.id, result.ticket.sequence_number).toUpperCase()}</p></div>
                                       
                                       {auditLog.length > 0 && (
                                          <div className="bg-gray-50 dark:bg-violet-900/20 rounded-2xl p-4 space-y-2"><div className="flex items-center gap-2 mb-2"><Clock className="w-3.5 h-3.5 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest">Previous Entries</span></div>{auditLog.slice(0, 3).map((log) => (<div key={log.id} className="flex items-center justify-between text-[11px]"><div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /><span className="font-bold">{log.count} Band{log.count > 1 ? 's' : ''} • {log.checked_in_name || "Self"}</span></div><span>{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>))}</div>
                                       )}

                                       {(result.ticket.checked_in_count || 0) < ticketQuantity(result.ticket) && (
                                          <div className="space-y-5">
                                             <div><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Attendee Name:</label><input type="text" value={attendeeName} onChange={(e) => setAttendeeName(e.target.value)} className="w-full px-4 py-3.5 bg-gray-50 border rounded-2xl text-sm font-bold outline-none" /></div>
                                             <div className="flex items-center justify-between bg-emerald-50 p-4 rounded-2xl">
                                                <div className="flex flex-col"><span className="text-xs font-bold text-emerald-600">Issue Band Count</span><span className="text-[9px] uppercase tracking-tight">Quantity to Admit</span></div>
                                                <div className="flex items-center gap-4">
                                                   <button onClick={() => setPartialCount(Math.max(1, (partialCount || 0) - 1))} className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-bold shadow-sm">-</button>
                                                   <input type="tel" value={partialCount === 0 ? '' : partialCount} onChange={(e) => { const val = e.target.value === '' ? 0 : parseInt(e.target.value); const max = ticketQuantity(result.ticket) - (result.ticket.checked_in_count || 0); if (!isNaN(val)) setPartialCount(Math.min(max, val)); }} className="w-20 h-12 bg-white text-center text-2xl font-black rounded-xl outline-none" />
                                                   <button onClick={() => setPartialCount(Math.min(ticketQuantity(result.ticket) - (result.ticket.checked_in_count || 0), (partialCount || 0) + 1))} className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-bold shadow-sm">+</button>
                                                </div>
                                             </div>
                                             {ticketQuantity(result.ticket) - (result.ticket.checked_in_count || 0) > 1 && (
                                                <div className="grid grid-cols-2 gap-3">
                                                   <button onClick={() => setPartialCount(1)} className={`py-2 rounded-xl text-[10px] font-black uppercase border ${partialCount === 1 ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-600'}`}>Just 1</button>
                                                   <button onClick={() => setPartialCount(ticketQuantity(result.ticket) - (result.ticket.checked_in_count || 0))} className={`py-2 rounded-xl text-[10px] font-black uppercase border ${partialCount === (ticketQuantity(result.ticket) - (result.ticket.checked_in_count || 0)) ? 'bg-emerald-600 text-white' : 'bg-white text-emerald-600'}`}>All Remaining ({ticketQuantity(result.ticket) - (result.ticket.checked_in_count || 0)})</button>
                                                </div>
                                             )}
                                          </div>
                                       )}
                                       <div className="flex gap-3 pt-2">
                                          <button onClick={() => setLookup({ kind: "idle" })} className="flex-1 bg-gray-100 font-bold py-4 rounded-2xl">Close</button>
                                          {canCheckIn && <button disabled={checkingIn} onClick={() => handleCheckIn()} className="flex-[2] bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-xl flex items-center justify-center gap-2">{checkingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Admission'}</button>}
                                       </div>
                                    </>
                                 )}
                              </div>
                           </div>
                        )}
                        {lookup.kind === "loading" && <div className="absolute inset-0 z-40 bg-black/20 backdrop-blur-[1px] flex items-center justify-center rounded-3xl"><Loader2 className="w-10 h-10 text-primary animate-spin" /></div>}
                     </div>
                  </div>
               </div>

               <div className="bg-white dark:bg-violet-950/40 rounded-3xl border border-gray-100 dark:border-violet-500/15 p-6 sm:p-8 shadow-sm h-full">
                  <div className="flex items-center gap-3 mb-6"><History className="w-5 h-5 text-primary" /><h2 className="text-lg font-bold">Live Entries</h2></div>
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                     {metrics.recentCheckIns.length === 0 ? <p className="text-gray-400 text-center py-20 italic">No entries yet</p> : metrics.recentCheckIns.map((item) => (
                        <div key={item.id} className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-violet-950/30 border border-transparent hover:border-primary/20 transition-all"><div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0"><CheckCircle2 className="w-5 h-5 text-emerald-600" /></div><div className="min-w-0"><p className="font-bold text-sm truncate">{item.purchaser_name}</p><p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">#{shortTicketRef(item.ticket_id || item.id, item.sequence_number).toUpperCase()} • Qty: {item.quantity}</p></div></div>
                     ))}
                  </div>
               </div>
            </div>
         </>
      ) : (
         <div className="space-y-6">
            <div className="bg-white dark:bg-violet-950/40 rounded-3xl border border-gray-100 p-6 sm:p-8 shadow-sm">
               <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="text" placeholder="Search..." className="w-full pl-12 pr-4 py-4 bg-gray-50 border rounded-2xl text-sm font-bold outline-none" value={researchQuery} onChange={(e) => setResearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleResearch()} /></div>
                  <button onClick={handleResearch} disabled={researchLoading} className="px-8 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg">{researchLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}</button>
               </div>
               <div className="mt-8 space-y-4">
                  {researchResults.map(t => (
                    <div key={t.id} onClick={() => { setManualInput(t.id); runLookup(t.id); setActiveTab('scanner'); }} className="p-4 bg-gray-50 rounded-2xl flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-all">
                       <div><p className="font-bold">{t.purchaser_name}</p><p className="text-xs text-gray-500">Ref: {shortTicketRef(t.id, t.sequence_number).toUpperCase()}</p></div>
                       <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  ))}
               </div>
            </div>
         </div>
      )}
    </div>
  );
}
