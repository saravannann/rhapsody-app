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
  Bulk: "Bulk Tickets",
  Student: "Student Pass",
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
  const cooldownRef = useRef(false);

  const runLookup = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
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
        fps: 8,
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
    (statusStr === "pending" || statusStr === "booked");

  return (
    <div className="mx-auto max-w-lg px-4 py-6 sm:py-8">
      <div className="text-center">
        <h1 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">
          Ticket check-in
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-violet-300/75">
          Scan the guest&apos;s QR or paste the code / ticket link.
        </p>
      </div>

      <div className="mt-6 space-y-4">
        <div className="flex rounded-xl border border-[var(--border-subtle)] bg-[var(--card-bg)] p-1">
          <button
            type="button"
            onClick={() => {
              setScannerActive(true);
              setLookup({ kind: "idle" });
            }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition-colors sm:text-sm ${
              scannerActive
                ? "bg-gradient-to-r from-primary to-secondary text-white shadow-sm"
                : "text-gray-600 dark:text-violet-300/80"
            }`}
          >
            <Camera className="h-4 w-4" aria-hidden />
            Camera
          </button>
          <button
            type="button"
            onClick={() => {
              setScannerActive(false);
              if (scannerRef.current) {
                try {
                  scannerRef.current.clear().catch(() => {});
                } catch {
                  /* ignore */
                }
                scannerRef.current = null;
              }
            }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition-colors sm:text-sm ${
              !scannerActive
                ? "bg-gradient-to-r from-primary to-secondary text-white shadow-sm"
                : "text-gray-600 dark:text-violet-300/80"
            }`}
          >
            <Keyboard className="h-4 w-4" aria-hidden />
            Manual
          </button>
        </div>

        {scannerActive ? (
          <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-black/5 dark:bg-violet-950/40">
            <div id={scanContainerId} className="min-h-[280px]" />
            <p className="px-3 py-2 text-center text-[10px] text-gray-500 dark:text-violet-400/65">
              Allow camera access. Hold the QR steady in the frame.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-violet-400/70">
              Paste QR text or ticket URL
            </label>
            <textarea
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              rows={3}
              placeholder="rhapsody|1|… or https://…/ticket/…"
              className="w-full resize-y rounded-xl border border-[var(--border-subtle)] bg-[var(--card-bg)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              onClick={() => void runLookup(manualInput)}
              className="w-full min-h-[48px] rounded-xl bg-gradient-to-r from-primary to-secondary py-3 text-sm font-bold text-white shadow-lg shadow-pink-500/25 transition-opacity hover:opacity-95"
            >
              Look up ticket
            </button>
          </div>
        )}
      </div>

      {lookup.kind === "loading" && (
        <div className="mt-8 flex flex-col items-center gap-2 py-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-gray-600 dark:text-violet-300/80">
            Verifying…
          </p>
        </div>
      )}

      {lookup.kind === "error" && (
        <div
          className="mt-8 flex gap-3 rounded-xl border border-amber-200/80 bg-amber-50/90 p-4 text-left dark:border-amber-500/30 dark:bg-amber-950/35"
          role="alert"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100/90">
            {lookup.message}
          </p>
        </div>
      )}

      {lookup.kind === "result" && (
        <div className="mt-8 space-y-4">
          {lookup.mismatch && (
            <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50/90 p-4 dark:border-red-500/35 dark:bg-red-950/40">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
              <p className="text-sm font-medium text-red-900 dark:text-red-100/90">
                {lookup.mismatch} Do not check in — ask the guest to show the ticket from their link.
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--card-bg)] p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-[10px] font-bold text-gray-400 dark:text-violet-400/70">
                  Ref {shortTicketRef(String(lookup.ticket.id))}
                </p>
                <p className="mt-1 truncate text-lg font-bold text-[var(--foreground)]">
                  {String(lookup.ticket.purchaser_name || "Guest")}
                </p>
                <p className="mt-2 text-sm text-gray-600 dark:text-violet-300/85">
                  {TYPE_LABELS[String(lookup.ticket.type)] || String(lookup.ticket.type)} ×{" "}
                  {ticketQuantity(lookup.ticket as { quantity?: unknown })}
                </p>
              </div>
              <Ticket className="h-8 w-8 shrink-0 text-primary/80" aria-hidden />
            </div>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-4">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
                  statusStr === "checked_in"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200"
                    : statusStr === "cancelled"
                      ? "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200"
                      : "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100"
                }`}
              >
                {statusStr.replace("_", " ") || "unknown"}
              </span>
            </div>

            {statusStr === "checked_in" && (
              <div className="mt-4 flex items-center gap-2 text-emerald-700 dark:text-emerald-300/90">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span className="text-sm font-bold">Already checked in</span>
              </div>
            )}

            {statusStr === "cancelled" && (
              <p className="mt-4 text-sm font-medium text-red-700 dark:text-red-300/90">
                This ticket is cancelled. Entry not allowed.
              </p>
            )}

            {canCheckIn && (
              <button
                type="button"
                disabled={checkingIn}
                onClick={() => void handleCheckIn()}
                className="mt-5 flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-md transition-opacity hover:bg-emerald-700 disabled:opacity-60"
              >
                {checkingIn ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    Confirm check-in
                  </>
                )}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setLookup({ kind: "idle" });
              setManualInput("");
            }}
            className="w-full rounded-xl border border-[var(--border-subtle)] py-3 text-sm font-bold text-gray-700 transition-colors hover:bg-[var(--muted-bg)] dark:text-violet-200"
          >
            Scan next guest
          </button>
        </div>
      )}
    </div>
  );
}
