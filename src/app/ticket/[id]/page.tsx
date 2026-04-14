"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "react-qr-code";
import { Loader2, Ticket as TicketIcon } from "lucide-react";
import Image from "next/image";
import { supabase } from "@/utils/supabase";
import { buildTicketQrPayload, shortTicketRef } from "@/utils/ticket-qr";
import { ticketLineTotal, ticketQuantity } from "@/utils/ticket-counts";

interface TicketData {
  id: string;
  type: string;
  price: number;
  quantity: number;
  status: string;
  purchaser_name: string | null;
  purchaser_phone: string | null;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  Platinum: "Platinum Pass",
  Donor: "Donor Pass",
  Student: "Student Pass",
};

export default function PublicTicketPage() {
  console.log("Rhapsody Ticket Page Active - New Design V2");
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<TicketData | null>(null);
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
          .select("*, sequence_number")
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
        <TicketIcon className="mb-3 h-12 w-12 text-gray-300" aria-hidden />
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
  const ref = shortTicketRef(row.id, row.sequence_number);
  const lineTotal = ticketLineTotal(row);

  return (
    <div className="min-h-screen bg-gray-200 flex items-center justify-center p-0 sm:p-4 font-sans">
      <div className="w-full max-w-[420px] aspect-[9/16] bg-white shadow-2xl relative overflow-hidden">
        {/* Master Template Background */}
        <Image 
          src="/ticket-template.jpg" 
          alt="Ticket Template" 
          fill 
          className="object-cover pointer-events-none"
          priority
        />
        
        {/* Dynamic Content Overlay (White Area) */}
        <div className="absolute top-[48.5%] bottom-[8%] left-0 right-0 flex flex-col items-center justify-center px-8">
          
          {/* Vertical Cost Stub (Right Side) */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 origin-right -rotate-90 whitespace-nowrap">
            <p className="text-[13px] font-black text-gray-300 tracking-widest uppercase">
               Total Cost: Rs.{lineTotal}
            </p>
          </div>

          {passLabel !== "Donor Pass" && passLabel !== "Donor" ? (
             <div className="w-full flex flex-col items-center">
               {/* QR Code */}
               <div className="p-1.5 border-[3.5px] border-black rounded-sm mb-3 bg-white shadow-sm">
                  <QRCode value={qrPayload} size={140} level="M" />
               </div>
               
               <p className="text-[12px] font-medium text-gray-400 mb-4 tracking-tight">
                  Show this QR at the entrance
               </p>

               {/* Large Bold Quantity */}
               <p className="text-[28px] font-black text-gray-900 mb-4 tracking-tighter uppercase leading-none">
                  {qty} Ticket(s)
               </p>
               
               {/* Details List */}
               <div className="w-full flex flex-col items-center space-y-1.5 text-[16px] font-medium text-gray-800">
                  <p>Ticket Type : <span className="font-bold">{passLabel.replace(' Pass', '')}</span></p>
                  <p>Booking ID : <span className="font-bold">{ref.toUpperCase()}</span></p>
               </div>
             </div>
          ) : (
             <div className="w-full flex flex-col items-center">
                <p className="text-[28px] font-black text-gray-900 mb-5 tracking-tight uppercase">
                   {qty} Ticket(s)
                </p>
                <div className="space-y-2 text-center text-gray-800 text-[16px] mb-8 font-medium">
                  <p>Ticket Type : <span className="font-bold text-gray-900">{passLabel}</span></p>
                  <p>Booking ID : <span className="font-bold text-gray-900">{ref.toUpperCase()}</span></p>
                </div>
                <div className="px-5 py-3 bg-pink-50 border border-pink-100 rounded-lg text-center shadow-sm">
                   <p className="text-[12px] text-pink-600 font-bold italic">
                      Donation Recorded — No QR required.
                   </p>
                </div>
             </div>
          )}
        </div>

      </div>
    </div>
  );
}
