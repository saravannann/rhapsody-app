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
    <div className="min-h-screen bg-[#f3f4f6] px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-md bg-white shadow-xl relative overflow-hidden">
        
        {/* Header Section */}
        <div className="p-6 sm:p-8 flex flex-col items-center text-center">
          <img src="/logo.png" alt="Rhapsody Logo" className="h-20 sm:h-24 w-auto object-contain mb-4" />
          
          <p className="italic text-gray-900 font-medium text-sm sm:text-[15px] leading-snug mb-6 max-w-[280px]">
            Chennai&apos;s First Cultural Extravaganza to Raise Funds for Cancer
          </p>

          <h2 className="text-2xl sm:text-3xl text-gray-900 mb-4 font-normal tracking-wide">
            May 9th | 4:30 PM Onwards
          </h2>

          <p className="text-gray-800 text-[15px] sm:text-lg font-normal tracking-wide mb-2 sm:mb-4 leading-relaxed">
            Sri Mutha Venkata Subba Rao Concert Hall<br />
            Chennai
          </p>
        </div>

        {/* Separator */}
        <div className="w-full px-6 sm:px-8">
           <hr className="border-t-2 border-black mb-8" />
        </div>

        {/* Main Ticket Info Section */}
        {passLabel !== "Donor Pass" && passLabel !== "Donor" ? (
          <div className="px-6 sm:px-8 pb-8 flex flex-row items-center justify-center gap-4 sm:gap-6">
            
            <div className="flex flex-col items-center shrink-0 w-[120px]">
              <div className="bg-white p-1 border border-gray-200 rounded">
                <QRCode value={qrPayload} size={110} level="M" className="h-auto max-w-full" />
              </div>
              <p className="mt-2 text-center text-[9px] sm:text-[10px] text-gray-700 leading-snug">
                Show this QR at entrance
              </p>
            </div>

            <div className="flex flex-col items-start justify-center flex-1 min-w-0">
              <p className="text-gray-900 font-medium text-[15px] sm:text-[16px] mb-2 tracking-wide whitespace-nowrap">{qty} Ticket(s)</p>
              <p className="text-gray-900 font-normal text-[13px] sm:text-[14px] mb-2 tracking-wide whitespace-nowrap">Ticket Type : {passLabel.replace(' Pass', '')}</p>
              <p className="text-gray-900 font-normal text-[13px] sm:text-[14px] mb-2 tracking-wide whitespace-nowrap">Booking ID : {ref.toUpperCase()}</p>
              <p className="text-gray-900 font-normal text-[13px] sm:text-[14px] tracking-wide whitespace-nowrap">Total Cost : Rs.{lineTotal}</p>
            </div>

          </div>
        ) : (
          <div className="px-6 sm:px-8 pb-8 flex flex-col items-center text-center">
             <div className="mb-4">
                <p className="text-gray-900 font-normal text-lg sm:text-xl mb-3 tracking-wide">{qty} Ticket(s)</p>
                <p className="text-gray-900 font-normal text-base sm:text-lg mb-3 tracking-wide">Ticket Type : {passLabel}</p>
                <p className="text-gray-900 font-normal text-base sm:text-lg mb-3 tracking-wide">Booking ID : {ref.toUpperCase()}</p>
                <p className="text-gray-900 font-normal text-base sm:text-lg tracking-wide">Total Cost : Rs.{lineTotal}</p>
             </div>
             <p className="text-xs text-pink-600 font-medium mt-2">Thank you for your donation. No validation QR is required.</p>
          </div>
        )}

        {/* Footer Area */}
        <div className="bg-[#e5e7eb]/80 py-2.5 text-center relative">
           <div className="absolute top-0 left-0 w-full h-1 flex overflow-hidden opacity-50">
               {/* Just a slight styling border effect to match the image */}
               <div className="w-full border-t-4 border-gray-300 border-dotted" />
           </div>
           <p className="text-gray-800 text-xs sm:text-[13px] font-medium tracking-wide mt-1">Cancelation is not allowed for this event</p>
        </div>

      </div>
    </div>
  );
}
