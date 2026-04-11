"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, User, Phone, Users, Ticket, CheckCircle2, Loader2, Star, Gift, IndianRupee, UploadCloud, ChevronRight, Minus, Plus } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { IndianMobileInput } from "@/components/indian-mobile-input";
import { hasIndianNationalDigits, toIndianE164 } from "@/utils/phone";

const CATEGORIES = [
  { id: 'Platinum', name: 'Platinum Pass', price: 500, icon: Star, color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-200', btn: 'bg-pink-600 hover:bg-pink-700' },
  { id: 'Donor', name: 'Donor Pass', price: 1000, icon: Gift, color: 'text-primary', bg: 'bg-purple-50', border: 'border-purple-200', btn: 'bg-primary hover:bg-purple-700' },
  { id: 'Bulk', name: 'Bulk Tickets', price: 500, icon: Users, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', btn: 'bg-green-600 hover:bg-green-700' },
  { id: 'Student', name: 'Student Pass', price: 200, icon: Ticket, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', btn: 'bg-amber-600 hover:bg-amber-700' },
];

export default function SellTicketsPage() {
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    poc: '',
    qty: 1,
    /** Where purchaser funds are directed for this sale */
    fundsDestination: 'organizer' as 'trust' | 'organizer',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [organisers, setOrganisers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState({ name: '', role: '' });

  useEffect(() => {
     const savedName = localStorage.getItem('rhapsody_user') || 'User';
     const savedRole = localStorage.getItem('rhapsody_role') || 'organiser';
     setCurrentUser({ name: savedName, role: savedRole });

     if (savedRole !== 'admin') {
         setFormData(prev => ({ ...prev, poc: savedName }));
     }

     supabase.from('profiles').select('*').then(({data}) => {
         if (data) setOrganisers(data.filter(p => Array.isArray(p.roles) ? p.roles.includes('organiser') : p.role === 'organiser'));
     });
  }, []);

  const handleCheckout = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!hasIndianNationalDigits(formData.phone)) {
        alert("Enter the purchaser phone number.");
        return;
     }
     setIsSubmitting(true);
     setSuccess(false);

     try {
       let purchaserPhone: string;
       try {
          purchaserPhone = toIndianE164(formData.phone);
       } catch {
          alert("Enter a valid phone number.");
          setIsSubmitting(false);
          return;
       }
       const mappedPayload = Array.from({ length: formData.qty }).map(() => ({
             type: selectedCategory.id,
             price: selectedCategory.price,
             status: 'pending',
             purchaser_name: formData.name,
             purchaser_phone: purchaserPhone,
             sold_by: formData.poc,
             funds_destination: formData.fundsDestination,
       }));
       
       const { error } = await supabase.from('tickets').insert(mappedPayload);
       if (error) throw error;
       
       setSuccess(true);
       setFormData({ name: '', phone: '', email: '', poc: formData.poc, qty: 1, fundsDestination: 'organizer' });
       setTimeout(() => {
          setSuccess(false);
          setSelectedCategory(null);
       }, 2000);
       
     } catch (err: unknown) {
       console.error("Error selling ticket:", err);
       const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message?: string }).message) : '';
       if (msg.includes('funds_destination') || msg.includes('column')) {
          alert("Database needs column funds_destination on tickets. Run the SQL in supabase/migrations/add_funds_destination_to_tickets.sql");
       } else {
          alert("Failed to confirm ticket sale.");
       }
     } finally {
       setIsSubmitting(false);
     }
  };

  const totalAmount = selectedCategory?.price * formData.qty;

  const clampQty = (n: number) => Math.min(50, Math.max(1, Math.floor(Number.isFinite(n) ? n : 1)));

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-5 pb-4">
      
      {!selectedCategory ? (
        <div className="animate-in fade-in slide-in-from-top-4 duration-500">
           <div className="mb-4 sm:mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-secondary to-primary leading-tight">Quick Sell</h1>
           </div>

           <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
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

           <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 mt-4 sm:mt-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-6 sm:p-8 opacity-10 group-hover:rotate-12 transition-transform pointer-events-none">
                 <UploadCloud className="w-24 h-24 sm:w-40 sm:h-40" />
              </div>
              <div className="relative z-10 space-y-0.5 min-w-0">
                 <h4 className="text-sm sm:text-lg font-bold flex items-center">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-secondary shrink-0" /> Mass issuance
                 </h4>
                 <p className="text-[10px] sm:text-xs text-gray-400 font-medium">Excel upload — coming soon</p>
              </div>
              <button type="button" disabled className="relative z-10 bg-white/10 border border-white/20 text-white font-bold py-2.5 min-h-[44px] px-4 sm:px-6 rounded-xl text-xs opacity-50 cursor-not-allowed shrink-0 w-full sm:w-auto">
                 Contact Admin
              </button>
           </div>
        </div>
      ) : (
        <div className="animate-in slide-in-from-right-8 duration-500 max-w-4xl mx-auto">
           <button type="button" onClick={() => setSelectedCategory(null)} className="flex items-center min-h-[44px] text-xs font-bold text-gray-400 hover:text-primary mb-2 sm:mb-4 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
           </button>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
              
              {/* Form + summary: on mobile, summary stacks after form with less padding */}
              <div className="lg:col-span-2 space-y-3 sm:space-y-4">
                 <div className="bg-white dark:bg-[var(--card-bg)] rounded-xl sm:rounded-2xl border border-gray-100 dark:border-violet-500/15 shadow-sm overflow-hidden">
                    <div className="p-4 sm:p-5 border-b border-gray-50 dark:border-violet-500/12 flex justify-between items-center bg-[#fdfaff] dark:bg-violet-950/30">
                       <div>
                          <h2 className={`text-lg sm:text-xl font-bold ${selectedCategory.color}`}>{selectedCategory.name}</h2>
                          <p className="text-[10px] font-bold text-gray-400 dark:text-violet-400/60 uppercase tracking-widest mt-0.5">Details</p>
                       </div>
                    </div>

                    <form id="sell-ticket-form" onSubmit={handleCheckout} className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          <div>
                             <label className="block text-[10px] font-bold text-gray-500 dark:text-violet-300/70 uppercase tracking-widest mb-1 ml-1">Purchaser name</label>
                             <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-violet-400/60 pointer-events-none" />
                                <input required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} placeholder="ex: Sara" autoComplete="name" enterKeyHint="next" className="w-full min-h-[44px] bg-[#f8fafc] dark:bg-violet-950/35 border border-gray-100 dark:border-violet-500/20 rounded-xl pl-10 pr-3 py-2.5 text-sm font-bold text-gray-900 dark:text-violet-100 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                             </div>
                          </div>
                          <div>
                             <label className="block text-[10px] font-bold text-gray-500 dark:text-violet-300/70 uppercase tracking-widest mb-1 ml-1">Phone</label>
                             <IndianMobileInput
                                LeftIcon={Phone}
                                required
                                value={formData.phone}
                                onChange={(digits) => setFormData({ ...formData, phone: digits })}
                                className="border-gray-100 dark:border-violet-500/20 bg-[#f8fafc] dark:bg-violet-950/25 shadow-sm"
                                prefixClassName="bg-[#f0f4f8] border-gray-100 text-gray-700 dark:bg-violet-950/50 dark:border-violet-500/25 dark:text-violet-200"
                                inputClassName="font-bold text-gray-900 dark:text-violet-100"
                             />
                             <p className="text-[10px] text-gray-400 dark:text-violet-400/55 mt-1 ml-1">India (+91)</p>
                          </div>
                       </div>

                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          <div className="min-w-0">
                             <label className="block text-[10px] font-bold text-gray-500 dark:text-violet-300/70 uppercase tracking-widest mb-1 ml-1">Organiser (POC)</label>
                             <div className="relative">
                                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                {currentUser.role === 'admin' ? (
                                   <select required value={formData.poc} onChange={e=>setFormData({...formData, poc: e.target.value})} className="w-full min-h-[44px] bg-[#f8fafc] dark:bg-violet-950/35 border border-gray-100 dark:border-violet-500/20 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-gray-900 dark:text-violet-100 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none">
                                      <option value="">Choose organiser…</option>
                                      {organisers.map(org => <option key={org.id} value={org.name}>{org.name}</option>)}
                                   </select>
                                ) : (
                                   <input disabled value={currentUser.name} className="w-full min-h-[44px] bg-gray-50 dark:bg-violet-950/25 border border-gray-100 dark:border-violet-500/15 rounded-xl pl-10 pr-3 py-2.5 text-sm font-bold text-gray-400 dark:text-violet-400/70" />
                                )}
                                {currentUser.role === 'admin' && <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 rotate-90 pointer-events-none" />}
                             </div>
                          </div>
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
                                   required
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
                                      className={`relative flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 text-center text-sm font-bold transition-colors focus-within:ring-2 focus-within:ring-primary/25 ${
                                         selected
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

                       <div className="pt-5 sm:pt-6">
                          <button type="submit" disabled={isSubmitting || !formData.name || !hasIndianNationalDigits(formData.phone) || !formData.poc} className={`w-full min-h-[48px] text-white font-bold py-3 rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50 flex justify-center items-center text-sm ${selectedCategory.btn}`}>
                             {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm sale"}
                          </button>
                       </div>
                    </form>
                 </div>
                 {success && (
                    <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl p-4 flex items-center justify-center gap-3 text-sm font-bold animate-in zoom-in-95">
                       <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Sale confirmed — tickets recorded.
                    </div>
                 )}
              </div>

              {/* Summary — sticky on large screens */}
              <div className="space-y-3 lg:sticky lg:top-20 lg:self-start">
                 <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 overflow-hidden relative">
                    <div className={`absolute top-0 right-0 p-3 opacity-5`}>
                       <IndianRupee className="w-16 h-16 sm:w-20 sm:h-20" />
                    </div>
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-50 pb-2">Order summary</h3>
                    
                    <div className="space-y-2 relative z-10">
                       <div className="flex justify-between items-center text-xs gap-2">
                          <span className="font-bold text-gray-500 truncate">{selectedCategory.name} × {formData.qty}</span>
                          <span className="font-bold text-gray-900 shrink-0 tabular-nums">₹{selectedCategory.price * formData.qty}</span>
                       </div>
                       <div className="flex justify-between items-center text-[11px] gap-2">
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
                             <span className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-secondary to-primary leading-tight tabular-nums">₹{totalAmount}</span>
                          </div>
                          <div className="bg-purple-50 text-primary text-[9px] font-bold px-2 py-1 rounded shrink-0">
                             Inc. taxes
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="bg-amber-50 rounded-xl border border-amber-100 p-3 sm:p-4">
                    <h4 className="flex items-center text-[11px] font-bold text-amber-900 mb-1">
                       <Ticket className="w-4 h-4 mr-1.5 shrink-0" /> Pending until verified
                    </h4>
                    <p className="text-[10px] font-medium text-amber-800/90 leading-snug">Shows as pending in Sales until an admin confirms payment.</p>
                 </div>
              </div>

           </div>
        </div>
      )}
    </div>
  );
}
