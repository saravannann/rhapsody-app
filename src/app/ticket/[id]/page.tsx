"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "react-qr-code";
import { Loader2, Ticket } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { buildTicketQrPayload, shortTicketRef } from "@/utils/ticket-qr";
import { ticketLineTotal, ticketQuantity } from "@/utils/ticket-counts";

const TYPE_LABELS: Record<string, string> = {
  Platinum: "Platinum Pass",
  Donor: "Donor Pass",
  Bulk: "Bulk Tickets",
  Student: "Student Pass",
};

export default function PublicTicketPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("Invalid link.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data, error: qErr } = await supabase
          .from("tickets")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (cancelled) return;
        if (qErr) {
          console.error(qErr);
          setError("Could not load this ticket.");
          return;
        }
        if (!data) {
          setError("Ticket not found. Check the link or contact the organiser.");
          return;
        }
        setRow(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf8fc] p-6">
        <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  if (error || !row) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#faf8fc] p-6 text-center">
        <Ticket className="mb-3 h-12 w-12 text-gray-300" aria-hidden />
        <p className="max-w-md text-sm font-medium text-gray-700">{error || "Unavailable."}</p>
      </div>
    );
  }

  const typeId = String(row.type || "");
  const passLabel = TYPE_LABELS[typeId] || typeId;
  const qty = ticketQuantity(row);
  const qrPayload = buildTicketQrPayload({
    ticketId: row.id,
    quantity: qty,
    typeId,
  });
  const ref = shortTicketRef(row.id);
  const lineTotal = ticketLineTotal(row);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fdf2f8] to-[#faf8fc] px-4 py-10">
      <div className="mx-auto max-w-md">
        <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
          Thenmozhi Memorial Trust
        </p>
        <h1 className="mt-1 text-center text-2xl font-bold text-gray-900">Rhapsody</h1>
        <p className="mt-0.5 text-center text-sm text-gray-600">Event ticket · Check-in</p>

        <div className="mt-8 rounded-2xl border border-pink-100 bg-white p-6 shadow-sm">
          <div className="text-center">
            <p className="font-mono text-xs font-bold text-gray-400">Ref {ref}</p>
            <p className="mt-2 text-lg font-bold text-gray-900">{row.purchaser_name || "Guest"}</p>
            <p className="mt-3 text-sm text-gray-700">
              <span className="font-semibold">{passLabel}</span>
              <span className="text-gray-500"> × {qty}</span>
            </p>
            <p className="mt-1 text-sm tabular-nums text-gray-800">
              ₹{lineTotal.toLocaleString("en-IN")}{" "}
              <span className="text-xs font-normal text-gray-500">(incl. as sold)</span>
            </p>
            <p className="mt-2 text-xs font-medium uppercase tracking-wide text-amber-700">
              Status: {String(row.status || "pending").replace("_", " ")}
            </p>
          </div>

          <div className="mx-auto mt-6 inline-block rounded-2xl bg-white p-4 ring-1 ring-gray-100">
            <QRCode value={qrPayload} size={216} level="M" className="h-auto max-w-full" />
          </div>
          <p className="mt-4 text-center text-[11px] leading-relaxed text-gray-500">
            Show this screen at the entrance. Brightness up helps scanners read the code.
          </p>
        </div>

        <p className="mt-6 text-center text-[10px] text-gray-400">
          Keep this page bookmarked until the event. Questions? Contact your organiser.
        </p>
      </div>
    </div>
  );
}
