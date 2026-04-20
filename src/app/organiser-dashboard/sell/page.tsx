"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import QRCode from "react-qr-code";
import { ArrowLeft, User, Phone, Users, Ticket, CheckCircle2, Loader2, Star, Gift, IndianRupee, UploadCloud, ChevronRight, Minus, Plus, MessageCircle, Link2, LucideIcon } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { IndianMobileInput } from "@/components/indian-mobile-input";
import { hasIndianNationalDigits, toIndianE164 } from "@/utils/phone";
import { buildTicketQrPayload, shortTicketRef } from "@/utils/ticket-qr";
import { buildTicketWhatsAppMessage, buildWhatsAppSendUrl, buildTicketTemplateData } from "@/utils/whatsapp-ticket";
import * as XLSX from "xlsx";

interface Category {
   id: string;
   name: string;
   price: number;
   icon: LucideIcon;
   color: string;
   bg: string;
   border: string;
   btn: string;
}

type SaleReceipt = {
   ticketId: string;
   passLabel: string;
   quantity: number;
   totalInr: number;
   qrPayload: string;
   purchaserName: string;
   purchaserPhoneE164: string;
   sequence_number?: number | null;
};

const CATEGORIES: Category[] = [
   { id: 'Platinum', name: 'Platinum Pass', price: 500, icon: Star, color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-200', btn: 'bg-pink-600 hover:bg-pink-700' },
   { id: 'Donor', name: 'Donor Pass', price: 1000, icon: Gift, color: 'text-primary', bg: 'bg-purple-50', border: 'border-purple-200', btn: 'bg-primary hover:bg-purple-700' },
   { id: 'Student', name: 'Student Pass', price: 200, icon: Ticket, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', btn: 'bg-amber-600 hover:bg-amber-700' },
];

export default function SellTicketsPage() {
   const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

   const [formData, setFormData] = useState({
      name: '',
      phone: '',
      email: '',
      poc: '',
      qty: 1,
      /** Where purchaser funds are directed for this sale */
      fundsDestination: 'organizer' as 'trust' | 'organizer',
      txnId: '',
      whatsappOptIn: true,
   });
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [showErrors, setShowErrors] = useState(false);
   const [saleReceipt, setSaleReceipt] = useState<SaleReceipt | null>(null);
   const [organisers, setOrganisers] = useState<{ id: string; name: string }[]>([]);
   const [currentUser, setCurrentUser] = useState({ name: '', role: '' });
   const [appOrigin, setAppOrigin] = useState("");
   const [sellMode, setSellMode] = useState<'individual' | 'mass'>('individual');
   const [massFile, setMassFile] = useState<File | null>(null);
   const [massData, setMassData] = useState<{ name: string, phone: string, qty: number, type: string, price: number }[]>([]);
   const [massStatus, setMassStatus] = useState<{ total: number, sent: number, totalQty: number, errors: string[] } | null>(null);

   const massSplit = useMemo(() => {
      const split: Record<string, number> = {};
      massData.forEach(p => {
         if (p.type !== 'INVALID') {
            split[p.type] = (split[p.type] || 0) + (p.qty || 0);
         }
      });
      return split;
   }, [massData]);

   useEffect(() => {
      setAppOrigin(typeof window !== "undefined" ? window.location.origin : "");
   }, []);

   useEffect(() => {
      const savedName = localStorage.getItem('rhapsody_user') || 'User';
      const savedRole = localStorage.getItem('rhapsody_role') || 'organiser';
      setCurrentUser({ name: savedName, role: savedRole });

      if (savedRole !== 'admin') {
         setFormData(prev => ({ ...prev, poc: savedName }));
      }

      supabase.from('profiles').select('*').then(({ data }) => {
         if (data) setOrganisers(data.filter(p => Array.isArray(p.roles) ? p.roles.includes('organiser') : p.role === 'organiser'));
      });
   }, []);

   const handleCheckout = async (e: React.FormEvent) => {
      e.preventDefault();

      const isPhoneValid = hasIndianNationalDigits(formData.phone);
      const isNameValid = !!formData.name.trim();
      const isPocValid = !!formData.poc;
      const isTxnValid = formData.fundsDestination !== 'trust' || !!formData.txnId.trim();

      if (!isPhoneValid || !isNameValid || !isPocValid || !isTxnValid) {
         setShowErrors(true);
         return;
      }

      setIsSubmitting(true);
      setShowErrors(false);
      setSaleReceipt(null);

      try {
         let purchaserPhone: string;
         try {
            purchaserPhone = toIndianE164(formData.phone);
         } catch {
            alert("Enter a valid phone number.");
            setIsSubmitting(false);
            return;
         }
         const qty = formData.qty;
         const passLabel = selectedCategory?.name as string;
         const typeId = selectedCategory?.id as string;
         const price = selectedCategory?.price || 0;
         const lineTotal = price * qty;

         const { data: row, error } = await supabase
            .from("tickets")
            .insert({
               type: typeId,
               price: price,
               quantity: qty,
               status: "booked",
               purchaser_name: formData.name,
               purchaser_phone: purchaserPhone,
               sold_by: formData.poc,
               funds_destination: formData.fundsDestination,
               bank_txn_id: formData.fundsDestination === 'trust' ? formData.txnId : null,
               whatsapp_opt_in: formData.whatsappOptIn,
            })
            .select("id, sequence_number")
            .single();

         if (error) throw error;
         if (!row?.id) throw new Error("No ticket id returned");

         const qrPayload = buildTicketQrPayload({
            ticketId: row.id,
            quantity: qty,
            typeId,
         });

         const receipt = {
            ticketId: row.id,
            passLabel,
            quantity: qty,
            totalInr: lineTotal,
            qrPayload,
            purchaserName: formData.name.trim(),
            purchaserPhoneE164: purchaserPhone,
            sequence_number: row.sequence_number,
         };

         setSaleReceipt(receipt);

         // Automated WhatsApp background trigger
         if (formData.whatsappOptIn) {
            try {
               const ticketUrl = `${window.location.origin}/ticket/${row.id}`;
               const msg = buildTicketWhatsAppMessage({
                  purchaserName: formData.name.trim(),
                  passLabel,
                  quantity: qty,
                  totalInr: lineTotal,
                  ref: shortTicketRef(row.id, row.sequence_number),
                  ticketPageUrl: ticketUrl,
               });
               const templateData = buildTicketTemplateData({
                  purchaserName: formData.name.trim(),
                  passLabel,
                  quantity: qty,
                  totalInr: lineTotal,
                  ref: shortTicketRef(row.id, row.sequence_number),
                  ticketId: row.id,
               });
               void fetch('/api/send-ticket', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ phone: purchaserPhone, ticketContent: msg, templateData })
               })
                  .then(res => res.json())
                  .then(async data => {
                     if (!data.success) {
                        console.error("WhatsApp Error:", data.error);
                        await supabase.from("tickets").update({
                           whatsapp_status: 'failed',
                           whatsapp_error: data.error
                        }).eq('id', row.id);
                        const isSandboxError = data.code === 131030;
                        const alertMsg = isSandboxError
                           ? `WhatsApp Sandbox Error: ${data.error}`
                           : `WhatsApp Fail: ${data.error}\n\nCheck your terminal for full details.`;
                        alert(alertMsg);
                     } else {
                        console.log("WhatsApp sent!", data.message_id);
                        await supabase.from("tickets").update({
                           whatsapp_status: 'sent',
                           whatsapp_error: null,
                           last_whatsapp_at: new Date().toISOString()
                        }).eq('id', row.id);
                     }
                  })
            } catch (waErr) {
               console.error("WA Prep Fail:", waErr);
            }
         } else {
            await supabase.from("tickets").update({
               whatsapp_status: 'not_sent',
               whatsapp_error: 'Opt-out selected'
            }).eq('id', row.id);
         }

         setFormData({ name: "", phone: "", email: "", poc: formData.poc, qty: 1, fundsDestination: "organizer", txnId: "", whatsappOptIn: true });

      } catch (err: unknown) {
         console.error("Error selling ticket:", err);
         const msg = err instanceof Error ? err.message : String(err);
         if (msg.toLowerCase().includes("quantity")) {
            alert("Database error: Missing quantity column.");
         } else {
            alert("Failed to confirm ticket sale.");
         }
      } finally {
         setIsSubmitting(false);
      }
   };

   const downloadMassTemplate = () => {
      const templateData = [
         ["Purchaser Name", "Phone Number", "Quantity", "Category"],
         ["John Doe", "9876543210", 30, "Platinum"],
         ["Jane Smith", "9123456789", 5, "Student"]
      ];

      const ws = XLSX.utils.aoa_to_sheet(templateData);

      // Add a simple instruction note in cell E1
      ws['E1'] = { t: 's', v: 'IMPORTANT: Category must be exactly "Platinum", "Donor", or "Student".' };

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Mass_Issuance_Template");
      XLSX.writeFile(wb, "Rhapsody_Mass_Issuance_Template.xlsx");
   };

   const handleMassUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Clear previous states to ensure a fresh UI
      setMassData([]);
      setMassStatus(null);
      setShowErrors(false);
      setMassFile(file);

      // Reset input value so the same file can be uploaded again if needed
      e.target.value = '';

      const reader = new FileReader();
      reader.onload = (evt: ProgressEvent<FileReader>) => {
         const bstr = evt.target?.result;
         if (typeof bstr !== 'string') return;
         const wb = XLSX.read(bstr, { type: 'binary' });
         const wsname = wb.SheetNames[0];
         const ws = wb.Sheets[wsname];
         const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];

         const parsed = data.slice(1).filter(row => row[0] && row[1]).map(row => {
            const catName = String(row[3] || '').trim();
            const category = CATEGORIES.find(c =>
               c.name.toLowerCase() === catName.toLowerCase() ||
               c.id.toLowerCase() === catName.toLowerCase() ||
               c.name.toLowerCase().replace(' pass', '') === catName.toLowerCase()
            );

            if (!category && catName) {
               // If category is provided but invalid, we'll flag it for skip
               return {
                  name: String(row[0]).trim(),
                  phone: String(row[1]).trim(),
                  qty: 0,
                  type: 'INVALID',
                  price: 0,
                  originalCat: catName
               };
            }

            const finalCat = category || CATEGORIES[0]; // Default to Platinum if empty

            return {
               name: String(row[0]).trim(),
               phone: String(row[1]).trim(),
               qty: parseInt(String(row[2]), 10) || 1,
               type: finalCat.id,
               price: finalCat.price
            };
         });

         setMassData(parsed);
      };
      reader.readAsBinaryString(file);
   };

   const handleMassIssuance = async (e: React.FormEvent) => {
      e.preventDefault();

      const isFileValid = massData.length > 0;
      const isPocValid = !!formData.poc;
      const totalQty = massData.reduce((sum, item) => sum + item.qty, 0);
      const isVolumeValid = totalQty >= 30;

      const isTxnValid = formData.fundsDestination !== 'trust' || !!formData.txnId.trim();

      if (!isFileValid || !isPocValid || !isVolumeValid || !isTxnValid) {
         setShowErrors(true);
         return;
      }

      setIsSubmitting(true);
      setShowErrors(false);
      setMassStatus({ total: massData.length, sent: 0, totalQty, errors: [] });

      for (const person of massData) {
         if (person.type === 'INVALID') {
            const originalCat = (person as { originalCat?: string }).originalCat || "Unknown";
            setMassStatus(prev => prev ? { ...prev, errors: [...prev.errors, `${person.name}: Invalid category ("${originalCat}")`] } : null);
            continue;
         }
         try {
            let phone: string;
            try {
               phone = toIndianE164(person.phone);
            } catch {
               setMassStatus(prev => prev ? { ...prev, errors: [...prev.errors, `${person.name}: Invalid phone`] } : null);
               continue;
            }

            const { data: massRow, error } = await supabase.from("tickets").insert({
               type: person.type,
               price: person.price,
               quantity: person.qty,
               status: "booked",
               purchaser_name: person.name,
               purchaser_phone: phone,
               sold_by: formData.poc,
               funds_destination: formData.fundsDestination,
               bank_txn_id: formData.fundsDestination === 'trust' ? formData.txnId : null,
               whatsapp_opt_in: formData.whatsappOptIn,
            }).select("id, sequence_number").single();

            if (error) throw error;

            // Trigger WhatsApp for mass issuance
            if (formData.whatsappOptIn) {
               try {
                  const ticketUrl = `${window.location.origin}/ticket/${massRow?.id}`;
                  const message = buildTicketWhatsAppMessage({
                     purchaserName: person.name,
                     passLabel: CATEGORIES.find(c => c.id === person.type)?.name || person.type,
                     quantity: person.qty,
                     totalInr: person.price * person.qty,
                     ref: shortTicketRef(massRow?.id || "", massRow?.sequence_number),
                     ticketPageUrl: ticketUrl
                  });
                  const templateData = buildTicketTemplateData({
                     purchaserName: person.name,
                     passLabel: CATEGORIES.find(c => c.id === person.type)?.name || person.type,
                     quantity: person.qty,
                     totalInr: person.price * person.qty,
                     ref: shortTicketRef(massRow?.id || "", massRow?.sequence_number),
                     ticketId: massRow?.id || "",
                  });
                  void fetch('/api/send-ticket', {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ phone, ticketContent: message, templateData })
                  })
                     .then(res => res.json())
                     .then(async d => {
                        if (!d.success) {
                           const isSandboxError = d.code === 131030;
                           console.error(isSandboxError ? "WhatsApp Sandbox Error:" : "Mass WhatsApp Fail:", d.error);
                           await supabase.from("tickets").update({
                              whatsapp_status: 'failed',
                              whatsapp_error: d.error
                           }).eq('id', massRow?.id);
                        } else {
                           console.log("Mass WhatsApp Sent:", d.message_id);
                           await supabase.from("tickets").update({
                              whatsapp_status: 'sent',
                              whatsapp_error: null,
                              last_whatsapp_at: new Date().toISOString()
                           }).eq('id', massRow?.id);
                        }
                     })
                     .catch(e => console.error("WhatsApp Mass Network Fail:", e));
               } catch (waErr) {
                  console.error("WA Mass Prep Fail:", waErr);
               }
            } else {
               await supabase.from("tickets").update({
                  whatsapp_status: 'not_sent',
                  whatsapp_error: 'Opt-out selected'
               }).eq('id', massRow?.id);
            }

            setMassStatus(prev => prev ? { ...prev, sent: prev.sent + 1 } : null);
         } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : "Failed to insert";
            setMassStatus(prev => prev ? { ...prev, errors: [...prev.errors, `${person.name}: ${errMsg}`] } : null);
         }
      }

      setIsSubmitting(false);
      if (!massStatus?.errors.length) {
         alert(`Successfully issued ${totalQty} tickets for ${massData.length} people!`);
         setSelectedCategory(null);
         setMassFile(null);
         setMassData([]);
         setMassStatus(null);
         setSellMode('individual');
         setFormData(prev => ({ ...prev, txnId: '', whatsappOptIn: true }));
      }
   };


   const ticketPageUrl = useMemo(() => {
      if (!saleReceipt || !appOrigin) return "";
      return `${appOrigin}/ticket/${saleReceipt.ticketId}`;
   }, [saleReceipt, appOrigin]);

   const whatsappSendUrl = useMemo(() => {
      if (!saleReceipt || !appOrigin) return null;
      return buildWhatsAppSendUrl(
         saleReceipt.purchaserPhoneE164,
         buildTicketWhatsAppMessage({
            purchaserName: saleReceipt.purchaserName,
            passLabel: saleReceipt.passLabel,
            quantity: saleReceipt.quantity,
            totalInr: saleReceipt.totalInr,
            ref: shortTicketRef(saleReceipt.ticketId, saleReceipt.sequence_number),
            ticketPageUrl: `${appOrigin}/ticket/${saleReceipt.ticketId}`,
         })
      );
   }, [saleReceipt, appOrigin]);

   const [linkCopied, setLinkCopied] = useState(false);

   const clampQty = (n: number) => Math.min(50, Math.max(1, Math.floor(Number.isFinite(n) ? n : 1)));

   return (
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-5 pb-4">

         {!selectedCategory ? (
            <div className="animate-in fade-in slide-in-from-top-4 duration-500">
               <div className="mb-4 sm:mb-6">
                  <h1 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-secondary to-primary leading-tight">Quick Sell</h1>
               </div>

               <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                  {CATEGORIES.map(cat => (
                     <div key={cat.id} onClick={() => setSelectedCategory(cat)} className={`group relative bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 border border-gray-100 shadow-sm hover:border-primary/40 hover:shadow-md transition-all cursor-pointer overflow-hidden active:scale-[0.99]`}>
                        <div className={`absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity`}>
                           <cat.icon className="w-16 h-16" />
                        </div>

                        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center mb-2 sm:mb-4 ${cat.bg} ${cat.border} ${cat.color} shadow-sm group-hover:scale-110 transition-transform`}>
                           <cat.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>

                        <h3 className="text-xs sm:text-base font-bold text-gray-900 mb-0.5 sm:mb-1 leading-tight line-clamp-2">{cat.name}</h3>
                        <div className="flex items-baseline gap-1 flex-wrap">
                           <span className="text-lg sm:text-xl font-bold text-gray-900">₹{cat.price}</span>
                           <span className="text-[9px] sm:text-[10px] text-gray-400 font-bold uppercase tracking-wider">/ pass</span>
                        </div>
                     </div>
                  ))}
               </div>

               <div
                  onClick={() => {
                     setSelectedCategory({ id: 'Mass', name: 'General Issuance', price: 0, icon: UploadCloud, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', btn: 'bg-violet-600 hover:bg-violet-700' });
                     setSellMode('mass');
                  }}
                  className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 mt-4 sm:mt-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white overflow-hidden relative group cursor-pointer hover:shadow-2xl transition-all"
               >
                  <div className="absolute top-0 right-0 p-6 sm:p-8 opacity-10 group-hover:rotate-12 transition-transform pointer-events-none">
                     <UploadCloud className="w-24 h-24 sm:w-40 sm:h-40" />
                  </div>
                  <div className="relative z-10 space-y-0.5 min-w-0">
                     <h4 className="text-sm sm:text-lg font-bold flex items-center">
                        <Users className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-secondary shrink-0" /> Mass issuance
                     </h4>
                     <p className="text-[10px] sm:text-xs text-gray-400 font-medium tracking-wide font-sans mt-1">Upload Excel to issue tickets in bulk (30+ qty)</p>
                  </div>
                  <div className="relative z-10 bg-white/10 border border-white/20 text-white font-bold py-2.5 min-h-[44px] px-4 sm:px-6 rounded-xl text-xs flex items-center group-hover:bg-white group-hover:text-gray-900 transition-colors">
                     Get Started <ChevronRight className="w-4 h-4 ml-1" />
                  </div>
               </div>
            </div>
         ) : (
            <div className="animate-in slide-in-from-right-8 duration-500 max-w-4xl mx-auto">
               <button
                  type="button"
                  onClick={() => {
                     setSaleReceipt(null);
                     setSelectedCategory(null);
                     setSellMode('individual');
                     setMassFile(null);
                     setMassData([]);
                     setMassStatus(null);
                     setShowErrors(false);
                  }}
                  className="flex items-center min-h-[44px] text-xs font-bold text-gray-400 hover:text-primary mb-2 sm:mb-4 transition-colors"
               >
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
               </button>

               {saleReceipt ? (
                  <div className="flex flex-col items-center">
                     <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
                        <CheckCircle2 className="h-7 w-7" aria-hidden />
                     </div>
                     <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-violet-100 mb-6">Sale recorded successfully!</h2>                     {/* Render exact Ticket UI inline */}
                     <div className="w-full max-w-[340px] aspect-[9/16] bg-white shadow-2xl relative overflow-hidden mx-auto rounded-lg">
                        {/* Master Template Background */}
                        <Image
                           src="/ticket-template.jpg"
                           alt="Ticket Template"
                           fill
                           className="object-cover pointer-events-none"
                           priority
                        />

                        {/* Dynamic Content Overlay (White Area) */}
                        <div className="absolute top-[48.5%] bottom-[8%] left-0 right-0 flex flex-col items-center justify-center px-6">



                           {saleReceipt.passLabel !== 'Donor Pass' && saleReceipt.passLabel !== 'Donor' ? (
                              <div className="w-full flex flex-col items-center">
                                 {/* QR Code */}
                                 <div className="p-1.5 border-[3px] border-black rounded-sm mb-3 bg-white shadow-sm">
                                    <QRCode value={saleReceipt.qrPayload} size={110} level="M" />
                                 </div>

                                 <p className="text-[10px] font-medium text-gray-500 mb-3 tracking-tight">
                                    Show this QR at the entrance
                                 </p>

                                 {/* Large Bold Quantity */}
                                 <p className="text-[24px] font-black text-gray-900 mb-3 tracking-tighter uppercase leading-none">
                                    {saleReceipt.quantity} Ticket(s)
                                 </p>

                                 {/* Details List */}
                                 <div className="w-full flex flex-col items-center space-y-1 text-[14px] font-medium text-gray-800">
                                    <p>Ticket Type : <span className="font-bold">{saleReceipt.passLabel.replace(' Pass', '')}</span></p>
                                    <p>Booking ID : <span className="font-bold">{shortTicketRef(saleReceipt.ticketId, saleReceipt.sequence_number).toUpperCase()}</span></p>
                                    <p>Total Cost : <span className="font-bold">Rs.{saleReceipt.totalInr}</span></p>
                                 </div>
                              </div>
                           ) : (
                              <div className="w-full flex flex-col items-center">
                                 <p className="text-[24px] font-black text-gray-900 mb-5 tracking-tight uppercase leading-none">
                                    {saleReceipt.quantity} Ticket(s)
                                 </p>
                                 <div className="space-y-1.5 text-center text-gray-800 text-[14px] mb-8 font-medium">
                                    <p>Ticket Type : <span className="font-bold text-gray-900">{saleReceipt.passLabel}</span></p>
                                    <p>Ref : <span className="font-bold text-gray-900">{shortTicketRef(saleReceipt.ticketId, saleReceipt.sequence_number).toUpperCase()}</span></p>
                                    <p>Total Cost : <span className="font-bold text-gray-900">Rs.{saleReceipt.totalInr}</span></p>
                                 </div>
                                 <div className="px-5 py-3 bg-pink-50 border border-pink-100 rounded-lg text-center shadow-sm">
                                    <p className="text-[10px] text-pink-600 font-bold italic">
                                       Donation Recorded — No QR required.
                                    </p>
                                 </div>
                              </div>
                           )}
                        </div>
                     </div>

                     <div className="mx-auto mt-6 flex w-full max-w-md flex-col gap-2 sm:flex-row sm:justify-center">
                        {whatsappSendUrl ? (
                           <a
                              href={whatsappSendUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-95"
                           >
                              <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
                              WhatsApp Ticket
                           </a>
                        ) : null}
                        {ticketPageUrl && saleReceipt.passLabel !== 'Donor Pass' && saleReceipt.passLabel !== 'Donor' ? (
                           <button
                              type="button"
                              onClick={async () => {
                                 try {
                                    await navigator.clipboard.writeText(ticketPageUrl);
                                    setLinkCopied(true);
                                    setTimeout(() => setLinkCopied(false), 2000);
                                 } catch {
                                    alert("Could not copy. Copy manually: " + ticketPageUrl);
                                 }
                              }}
                              className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-800 shadow-sm transition-colors hover:bg-gray-50 dark:border-violet-500/25 dark:bg-violet-950/50 dark:text-violet-100 dark:hover:bg-violet-900/40"
                           >
                              <Link2 className="h-4 w-4 shrink-0" aria-hidden />
                              {linkCopied ? "Link copied" : "Copy ticket link"}
                           </button>
                        ) : null}
                     </div>
                     <p className="mx-auto mt-2 max-w-md text-[10px] text-gray-500 dark:text-violet-400/60 text-center">
                        WhatsApp opens a chat with the purchaser&apos;s number and a ready message — tap <strong>Send</strong> on your phone. Works best on the device where WhatsApp is logged in.
                     </p>

                     <button
                        type="button"
                        onClick={() => {
                           setSaleReceipt(null);
                           setSelectedCategory(null);
                        }}
                        className="mt-6 w-full max-w-xs rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-800 shadow-sm transition-colors hover:bg-gray-50 dark:border-violet-500/25 dark:bg-violet-950/50 dark:text-violet-100 dark:hover:bg-violet-900/40"
                     >
                        Done — new sale
                     </button>
                  </div>
               ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">

                     {/* Form + summary */}
                     <div className="lg:col-span-2 space-y-3 sm:space-y-4">
                        <div className="bg-white dark:bg-[var(--card-bg)] rounded-xl sm:rounded-2xl border border-gray-100 dark:border-violet-500/15 shadow-sm overflow-hidden">
                           <div className="p-4 sm:p-5 border-b border-gray-50 dark:border-violet-500/12 flex justify-between items-center bg-[#fdfaff] dark:bg-violet-950/30">
                              <div>
                                 <h2 className={`text-lg sm:text-xl font-bold ${selectedCategory.color}`}>{sellMode === 'mass' ? 'Mass Ticket Issuance' : selectedCategory.name}</h2>
                                 <p className="text-[10px] font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest mt-0.5">{sellMode === 'mass' ? 'Bulk Export' : 'Details'}</p>
                              </div>
                              {sellMode === 'mass' && (
                                 <div className="bg-violet-100 text-violet-700 px-2 py-1 rounded text-[10px] font-bold">EXCEL MODE</div>
                              )}
                           </div>

                           <form id="sell-ticket-form" onSubmit={sellMode === 'mass' ? handleMassIssuance : handleCheckout} className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                              {sellMode === 'mass' ? (
                                 /* Mass Mode Fields */
                                 <>
                                    <div className="space-y-4">
                                       <div>
                                          <div className="flex justify-between items-center mb-2 ml-1">
                                             <label className="block text-[10px] font-bold text-gray-500 dark:text-violet-300/70 uppercase tracking-widest">Upload Data (Excel)</label>
                                             <button
                                                type="button"
                                                onClick={downloadMassTemplate}
                                                className="text-[10px] font-bold text-violet-600 hover:text-violet-700 underline uppercase tracking-tight"
                                             >
                                                Download Template
                                             </button>
                                          </div>
                                          <label className={`flex flex-col items-center justify-center w-full min-h-[120px] rounded-xl border-2 border-dashed transition-all cursor-pointer ${showErrors && !massFile ? 'border-red-500 bg-red-50/20' :
                                             massFile ? 'border-emerald-500 bg-emerald-50/30' :
                                                'border-gray-200 hover:border-violet-400 bg-gray-50'
                                             }`}>
                                             <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                <UploadCloud className={`w-8 h-8 mb-2 ${showErrors && !massFile ? 'text-red-500' : massFile ? 'text-emerald-500' : 'text-gray-400'}`} />
                                                {massFile ? (
                                                   <p className="text-sm font-bold text-emerald-600 truncate px-4">{massFile.name}</p>
                                                ) : (
                                                   <p className={`text-xs font-medium uppercase tracking-wider ${showErrors && !massFile ? 'text-red-500' : 'text-gray-500'}`}>
                                                      {showErrors && !massFile ? 'Excel Required' : 'Tap to upload .xlsx / .xls'}
                                                   </p>
                                                )}
                                                <p className="text-[9px] text-gray-400 mt-1 uppercase">Col 1: Name, Col 2: Phone, Col 3: Qty, Col 4: Category (Platinum, Donor, Student)</p>
                                             </div>
                                             <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleMassUpload} />
                                          </label>
                                          {showErrors && !massFile && <p className="text-[10px] text-red-500 font-bold mt-2 ml-1 animate-in fade-in slide-in-from-top-1">Please upload an Excel file to proceed</p>}
                                          {massData.length > 0 && (
                                             <div className="flex flex-wrap items-center gap-2 mt-3 ml-1">
                                                <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-500/20 px-2.5 py-1 rounded-lg">
                                                   <Users className="w-3 h-3 text-emerald-600" />
                                                   <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-tight">{massData.length} Recipients</p>
                                                </div>

                                                <div className="flex items-center gap-1.5 bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-500/20 px-2.5 py-1 rounded-lg">
                                                   <Ticket className="w-3 h-3 text-violet-600" />
                                                   <p className="text-[10px] text-violet-600 font-bold uppercase tracking-tight">Total: {massData.reduce((s, i) => s + i.qty, 0)}</p>
                                                </div>

                                                {Object.keys(massSplit).length > 0 && (
                                                   <div className="flex flex-wrap gap-1.5">
                                                      {CATEGORIES.map(cat => (
                                                         massSplit[cat.id] ? (
                                                            <div key={cat.id} className={`flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 dark:bg-violet-950/40 border border-gray-100 dark:border-violet-500/10`}>
                                                               <span className={`w-1.5 h-1.5 rounded-full ${cat.id === 'Platinum' ? 'bg-pink-500' : cat.id === 'Donor' ? 'bg-primary' : 'bg-amber-500'}`} />
                                                               <span className={`text-[9px] font-bold uppercase tracking-tight text-gray-500 dark:text-violet-300`}>
                                                                  {cat.name.split(' ')[0]}: {massSplit[cat.id]}
                                                               </span>
                                                            </div>
                                                         ) : null
                                                      ))}
                                                   </div>
                                                )}
                                                {massData.some(p => p.type === 'INVALID') && (
                                                   <>
                                                      <span className="text-gray-300">|</span>
                                                      <p className="text-[10px] text-red-600 font-bold uppercase tracking-tight animate-pulse underline select-none">
                                                         {massData.filter(p => p.type === 'INVALID').length} Errors Found
                                                      </p>
                                                   </>
                                                )}
                                             </div>
                                          )}
                                       </div>
                                    </div>
                                 </>
                              ) : (
                                 /* Individual Mode Fields */
                                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                    <div>
                                       <label className="block text-[10px] font-bold text-gray-500 dark:text-violet-300/70 uppercase tracking-widest mb-1 ml-1">Purchaser name</label>
                                       <div className="relative">
                                          <User className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors pointer-events-none ${showErrors && !formData.name ? 'text-red-500' : 'text-gray-400 dark:text-violet-400/60'}`} />
                                          <input
                                             value={formData.name}
                                             onChange={e => setFormData({ ...formData, name: e.target.value })}
                                             placeholder="ex: Sara"
                                             autoComplete="name"
                                             enterKeyHint="next"
                                             className={`w-full min-h-[44px] bg-[#f8fafc] dark:bg-violet-950/35 border rounded-xl pl-10 pr-3 py-2.5 text-sm font-bold text-gray-900 dark:text-violet-100 focus:outline-none focus:ring-2 transition-all ${showErrors && !formData.name
                                                ? 'border-red-500 ring-red-500/20 focus:ring-red-500/20 shadow-[0_0_0_1px_rgba(239,68,68,0.2)]'
                                                : 'border-gray-100 dark:border-violet-500/20 focus:ring-primary/20'
                                                }`}
                                          />
                                       </div>
                                       {showErrors && !formData.name && <p className="text-[10px] text-red-500 font-bold mt-1 ml-1 animate-in fade-in slide-in-from-top-1">Enter purchaser name</p>}
                                    </div>
                                    <div>
                                       <label className="block text-[10px] font-bold text-gray-500 dark:text-violet-300/70 uppercase tracking-widest mb-1 ml-1">Phone</label>
                                       <IndianMobileInput
                                          LeftIcon={Phone}
                                          value={formData.phone}
                                          onChange={(digits) => setFormData({ ...formData, phone: digits })}
                                          className={`${showErrors && !hasIndianNationalDigits(formData.phone) ? 'border-red-500 ring-red-500/10' : 'border-gray-100 dark:border-violet-500/20'} bg-[#f8fafc] dark:bg-violet-950/25 shadow-sm transition-all`}
                                          prefixClassName={`transition-colors ${showErrors && !hasIndianNationalDigits(formData.phone) ? 'bg-red-50 border-red-200 text-red-600 dark:bg-red-950/30' : 'bg-[#f0f4f8] border-gray-100 text-gray-700 dark:bg-violet-950/50 dark:border-violet-500/25 dark:text-violet-200'}`}
                                          inputClassName="font-bold text-gray-900 dark:text-violet-100"
                                       />
                                       {showErrors && !hasIndianNationalDigits(formData.phone) ? (
                                          <p className="text-[10px] text-red-500 font-bold mt-1 ml-1 animate-in fade-in slide-in-from-top-1">Enter valid mobile number</p>
                                       ) : (
                                          <p className="text-[10px] text-gray-400 dark:text-violet-400/55 mt-1 ml-1">India (+91)</p>
                                       )}
                                    </div>
                                 </div>
                              )}

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                 <div className="min-w-0">
                                    <label className="block text-[10px] font-bold text-gray-500 dark:text-violet-300/70 uppercase tracking-widest mb-1 ml-1">Organiser (POC)</label>
                                    <div className="relative">
                                       <Users className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors pointer-events-none ${showErrors && !formData.poc ? 'text-red-500' : 'text-gray-400'}`} />
                                       {currentUser.role === 'admin' ? (
                                          <select
                                             value={formData.poc}
                                             onChange={e => setFormData({ ...formData, poc: e.target.value })}
                                             className={`w-full min-h-[44px] bg-[#f8fafc] dark:bg-violet-950/35 border rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-gray-900 dark:text-violet-100 focus:outline-none focus:ring-2 transition-all appearance-none ${showErrors && !formData.poc
                                                ? 'border-red-500 ring-red-500/20 shadow-[0_0_0_1px_rgba(239,68,68,0.2)]'
                                                : 'border-gray-100 dark:border-violet-500/20 focus:ring-primary/20'
                                                }`}
                                          >
                                             <option value="">Choose organiser…</option>
                                             {organisers.map(org => <option key={org.id} value={org.name}>{org.name}</option>)}
                                          </select>
                                       ) : (
                                          <input disabled value={currentUser.name} className="w-full min-h-[44px] bg-gray-50 dark:bg-violet-950/25 border border-gray-100 dark:border-violet-500/15 rounded-xl pl-10 pr-3 py-2.5 text-sm font-bold text-gray-400 dark:text-violet-400/70" />
                                       )}
                                       {currentUser.role === 'admin' && <ChevronRight className={`absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors rotate-90 pointer-events-none ${showErrors && !formData.poc ? 'text-red-500' : 'text-gray-400'}`} />}
                                    </div>
                                    {showErrors && !formData.poc && currentUser.role === 'admin' && <p className="text-[10px] text-red-500 font-bold mt-1 ml-1 animate-in fade-in slide-in-from-top-1">Select an organiser</p>}
                                 </div>

                                 {/* Only show Quantity input for INDIVIDUAL mode */}
                                 {sellMode === 'individual' && (
                                    <div className="min-w-0">
                                       <label className="block text-[10px] font-bold text-gray-500 dark:text-violet-300/70 uppercase tracking-widest mb-1 ml-1">Quantity</label>
                                       <div className="flex items-stretch gap-1.5 sm:gap-2 touch-manipulation">
                                          <button
                                             type="button"
                                             aria-label="Decrease quantity"
                                             onClick={() => setFormData(prev => ({ ...prev, qty: clampQty(prev.qty - 1) }))}
                                             disabled={formData.qty <= 1}
                                             className="shrink-0 flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl border border-gray-100 bg-[#f8fafc] text-gray-800 hover:bg-pink-50/80 hover:border-primary/20 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none dark:border-violet-500/25 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-900/45"
                                          >
                                             <Minus className="w-5 h-5 stroke-[2.25]" aria-hidden />
                                          </button>
                                          <input
                                             type="number"
                                             inputMode="numeric"
                                             min={1}
                                             max={50}
                                             value={formData.qty}
                                             onChange={e => {
                                                const raw = parseInt(e.target.value, 10);
                                                setFormData({ ...formData, qty: clampQty(Number.isNaN(raw) ? 1 : raw) });
                                             }}
                                             className="min-h-[44px] min-w-0 flex-1 bg-[#f8fafc] border border-gray-100 rounded-xl px-2 py-2.5 text-center text-sm font-bold text-gray-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none dark:bg-violet-950/35 dark:border-violet-500/25 dark:text-violet-100"
                                          />
                                          <button
                                             type="button"
                                             aria-label="Increase quantity"
                                             onClick={() => setFormData(prev => ({ ...prev, qty: clampQty(prev.qty + 1) }))}
                                             disabled={formData.qty >= 50}
                                             className="shrink-0 flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl border border-gray-100 bg-[#f8fafc] text-gray-800 hover:bg-pink-50/80 hover:border-primary/20 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none dark:border-violet-500/25 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-900/45"
                                          >
                                             <Plus className="w-5 h-5 stroke-[2.25]" aria-hidden />
                                          </button>
                                       </div>
                                    </div>
                                 )}

                                 {/* Show Volume summary for MASS mode */}
                                 {sellMode === 'mass' && (
                                    <div className={`rounded-xl border p-3 flex flex-col justify-center transition-all ${showErrors && massData.reduce((s, i) => s + i.qty, 0) < 30 ? 'bg-red-50 border-red-200' : 'bg-violet-50 dark:bg-violet-950/40 border-violet-100 dark:border-violet-500/20'
                                       }`}>
                                       <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${showErrors && massData.reduce((s, i) => s + i.qty, 0) < 30 ? 'text-red-500' : 'text-violet-500'}`}>Total Volume</p>
                                       <div className="flex items-baseline gap-1.5">
                                          <span className={`text-2xl font-bold tabular-nums ${showErrors && massData.reduce((s, i) => s + i.qty, 0) < 30 ? 'text-red-600' :
                                             massData.reduce((s, i) => s + i.qty, 0) >= 30 ? 'text-violet-700 dark:text-violet-200' : 'text-amber-600'
                                             }`}>
                                             {massData.reduce((s, i) => s + i.qty, 0)}
                                          </span>
                                          <span className={`text-[10px] font-bold uppercase tracking-tight ${showErrors && massData.reduce((s, i) => s + i.qty, 0) < 30 ? 'text-red-400' : 'text-violet-400'}`}>Passes</span>
                                       </div>
                                       {massData.reduce((s, i) => s + i.qty, 0) < 30 && (
                                          <p className={`text-[9px] font-bold uppercase mt-1 ${showErrors ? 'text-red-600 underline' : 'text-amber-600'}`}>
                                             Min. 30 required for mass issuance
                                          </p>
                                       )}
                                    </div>
                                 )}
                              </div>

                              <fieldset className="border-0 p-0 m-0 min-w-0">
                                 <legend className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 ml-1">Payment settlement</legend>
                                 <div className="grid grid-cols-2 gap-2 sm:gap-3" role="radiogroup" aria-label="Payment settlement">
                                    {(
                                       [
                                          { value: 'organizer' as const, label: 'Organizer' },
                                          { value: 'trust' as const, label: 'Trust' },
                                       ] as const
                                    ).map(({ value, label }) => {
                                       const selected = formData.fundsDestination === value;
                                       return (
                                          <label
                                             key={value}
                                             className={`relative flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-center text-sm font-bold transition-colors focus-within:ring-2 focus-within:ring-primary/25 ${selected
                                                ? 'border-primary/35 bg-pink-50/80 text-primary shadow-sm dark:bg-primary/20 dark:border-primary/45 dark:text-pink-200 dark:shadow-[inset_0_0_0_1px_rgba(236,72,153,0.2)]'
                                                : 'border-gray-100 bg-[#f8fafc] text-gray-800 hover:border-gray-200 dark:border-violet-500/20 dark:bg-violet-950/30 dark:text-violet-100 dark:hover:border-violet-400/35'
                                                }`}
                                          >
                                             <input
                                                type="radio"
                                                name="fundsDestination"
                                                value={value}
                                                checked={selected}
                                                onChange={() => setFormData({ ...formData, fundsDestination: value })}
                                                className="sr-only"
                                             />
                                             {label}
                                          </label>
                                       );
                                    })}
                                 </div>
                              </fieldset>

                              {formData.fundsDestination === 'trust' && (
                                 <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                    <label className="block text-[10px] font-bold text-gray-500 dark:text-violet-300/70 uppercase tracking-widest mb-1 ml-1">Bank Transaction ID</label>
                                    <div className="relative">
                                       <div className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors pointer-events-none ${showErrors && !formData.txnId ? 'text-red-500' : 'text-gray-400'}`}>
                                          <CheckCircle2 className="w-4 h-4" />
                                       </div>
                                       <input
                                          value={formData.txnId}
                                          onChange={e => setFormData({ ...formData, txnId: e.target.value })}
                                          placeholder="UTR / Ref Number"
                                          className={`w-full min-h-[44px] bg-[#f8fafc] dark:bg-violet-950/35 border rounded-xl pl-10 pr-3 py-2.5 text-sm font-bold text-gray-900 dark:text-violet-100 focus:outline-none focus:ring-2 transition-all ${showErrors && !formData.txnId
                                             ? 'border-red-500 ring-red-500/20 shadow-[0_0_0_1px_rgba(239,68,68,0.2)]'
                                             : 'border-gray-100 dark:border-violet-500/20 focus:ring-primary/20'
                                             }`}
                                       />
                                    </div>
                                    {showErrors && !formData.txnId && <p className="text-[10px] text-red-500 font-bold mt-1 ml-1 animate-in fade-in slide-in-from-top-1">Transaction ID required for Trust settlement</p>}
                                 </div>
                              )}

                              <label className="flex items-start gap-2.5 mt-2 cursor-pointer">
                                 <div className="flex items-center h-5">
                                    <input
                                       type="checkbox"
                                       checked={formData.whatsappOptIn}
                                       onChange={e => setFormData({ ...formData, whatsappOptIn: e.target.checked })}
                                       className="w-4 h-4 rounded border-gray-300 text-primary shadow-sm focus:border-primary/50 focus:ring focus:ring-primary/20 focus:ring-opacity-50"
                                    />
                                 </div>
                                 <div className="flex flex-col">
                                    <span className="text-sm font-bold text-gray-700 dark:text-violet-200">
                                       I agree to receive the ticket via Whatsapp
                                    </span>
                                    <span className="text-[10px] text-gray-400 dark:text-violet-400/60">
                                       Uncheck to skip this.
                                    </span>
                                 </div>
                              </label>

                              <div className="pt-5 sm:pt-6">
                                 <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={`w-full min-h-[48px] text-white font-bold py-3 rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50 flex justify-center items-center text-sm ${sellMode === 'mass' ? (
                                       showErrors && (massData.length === 0 || massData.reduce((s, i) => s + i.qty, 0) < 30 || !formData.poc)
                                          ? 'bg-red-500 hover:bg-red-600'
                                          : 'bg-violet-600 hover:bg-violet-700'
                                    ) :
                                       showErrors && (!formData.name || !hasIndianNationalDigits(formData.phone) || !formData.poc || (formData.fundsDestination === 'trust' && !formData.txnId.trim()))
                                          ? 'bg-red-500 hover:bg-red-600'
                                          : selectedCategory.btn
                                       }`}
                                 >
                                    {isSubmitting ? (
                                       <>
                                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                          {massStatus ? `Issuing ${massStatus.sent}/${massStatus.total}...` : "Processing..."}
                                       </>
                                    ) : sellMode === 'mass' ? "Issue All Tickets" : "Confirm sale"}
                                 </button>
                                 {massStatus && massStatus.errors.length > 0 && (
                                    <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-100">
                                       <p className="text-[10px] font-bold text-red-600 uppercase mb-2">Errors occurred:</p>
                                       <ul className="text-[9px] text-red-500 space-y-1">
                                          {massStatus.errors.slice(0, 3).map((err, i) => <li key={i}>• {err}</li>)}
                                          {massStatus.errors.length > 3 && <li>...and {massStatus.errors.length - 3} more</li>}
                                       </ul>
                                    </div>
                                 )}
                              </div>
                           </form>
                        </div>
                     </div>

                     {/* Summary — sticky on large screens */}
                     <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
                        <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 overflow-hidden relative">
                           <div className={`absolute top-0 right-0 p-3 opacity-5`}>
                              <IndianRupee className="w-16 h-16 sm:w-20 sm:h-20" />
                           </div>
                           <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-50 pb-2">Order summary</h3>

                           <div className="space-y-2 relative z-10">
                              <div className="flex flex-col gap-1 sm:gap-1.5 text-xs">
                                 <div className="flex justify-between items-center gap-2">
                                    <span className="font-bold text-gray-500 truncate">
                                       {sellMode === 'mass' ? `${massData.length} recipients` : selectedCategory.name}
                                    </span>
                                    <span className="font-bold text-gray-900 shrink-0 tabular-nums">
                                       ₹{(sellMode === 'mass'
                                          ? massData.reduce((s, i) => s + (i.price * i.qty), 0)
                                          : (selectedCategory.price * formData.qty)).toLocaleString('en-IN')}
                                    </span>
                                 </div>

                                 {sellMode === 'mass' && Object.keys(massSplit).length > 0 && (
                                    <div className="flex flex-wrap gap-x-2 gap-y-1">
                                       {CATEGORIES.map(cat => (
                                          massSplit[cat.id] ? (
                                             <span key={cat.id} className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">
                                                {cat.name.split(' ')[0]}: <span className="text-gray-600">{massSplit[cat.id]}</span>
                                             </span>
                                          ) : null
                                       ))}
                                    </div>
                                 )}
                              </div>

                              <div className="flex justify-between items-center text-[11px] gap-2 pt-1 border-t border-gray-50/50 mt-1">
                                 <span className="font-bold text-gray-500">Settlement</span>
                                 <span className="font-bold text-gray-800 text-right">
                                    {formData.fundsDestination === 'trust' ? 'Trust' : 'Organizer'}
                                 </span>
                              </div>
                              <div className="flex justify-between items-center text-[11px]">
                                 <span className="font-bold text-gray-500">Fee</span>
                                 <span className="font-bold text-emerald-600">₹0</span>
                              </div>
                              <div className="pt-2 border-t border-gray-100 flex justify-between items-end gap-2">
                                 <div className="flex flex-col min-w-0">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total</span>
                                    <span className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-secondary to-primary leading-tight tabular-nums">
                                       ₹{(sellMode === 'mass'
                                          ? massData.reduce((s, i) => s + (i.price * i.qty), 0)
                                          : (selectedCategory.price * formData.qty)).toLocaleString('en-IN')}
                                    </span>
                                 </div>
                                 <div className="bg-purple-50 text-primary text-[9px] font-bold px-2 py-1 rounded shrink-0">
                                    Inc. taxes
                                 </div>
                              </div>
                           </div>
                        </div>
                     </div>

                  </div>
               )}
            </div>
         )}
      </div>
   );
}
