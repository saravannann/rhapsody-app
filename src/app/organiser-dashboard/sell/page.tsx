"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, User, Phone, Mail, Users, Ticket, CheckCircle2, Loader2, Star, Gift, Check, IndianRupee, UploadCloud, ChevronRight } from "lucide-react";
import { supabase } from "@/utils/supabase";

const CATEGORIES = [
  { id: 'Platinum', name: 'Platinum Pass', price: 500, icon: Star, color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-200', btn: 'bg-pink-600 hover:bg-pink-700' },
  { id: 'Donor', name: 'Donor Pass', price: 1000, icon: Gift, color: 'text-primary', bg: 'bg-purple-50', border: 'border-purple-200', btn: 'bg-primary hover:bg-purple-700' },
  { id: 'Bulk', name: 'Bulk Tickets', price: 500, icon: Users, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', btn: 'bg-green-600 hover:bg-green-700' },
  { id: 'Student', name: 'Student Pass', price: 200, icon: Ticket, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', btn: 'bg-amber-600 hover:bg-amber-700' },
];

export default function SellTicketsPage() {
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [registrationMode, setRegistrationMode] = useState(false);
  
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', poc: '', qty: 1 });
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
     setIsSubmitting(true);
     setSuccess(false);

     try {
       const mappedPayload = Array.from({ length: formData.qty }).map(() => ({
             type: selectedCategory.id,
             price: registrationMode ? 0 : selectedCategory.price,
             status: 'pending',
             purchaser_name: formData.name,
             purchaser_phone: formData.phone,
             sold_by: formData.poc
       }));
       
       const { error } = await supabase.from('tickets').insert(mappedPayload);
       if (error) throw error;
       
       setSuccess(true);
       setFormData({ name: '', phone: '', email: '', poc: formData.poc, qty: 1 });
       setTimeout(() => {
          setSuccess(false);
          setSelectedCategory(null);
          setRegistrationMode(false);
       }, 2000);
       
     } catch (err) {
       console.error("Error selling ticket:", err);
       alert("Failed to confirm ticket sale.");
     } finally {
       setIsSubmitting(false);
     }
  };

  const totalAmount = (registrationMode ? 0 : selectedCategory?.price) * formData.qty;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {!selectedCategory ? (
        <div className="animate-in fade-in slide-in-from-top-4 duration-500">
           <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
              <div>
                 <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-secondary to-primary">Quick Sell</h1>
                 <p className="text-gray-500 text-sm font-medium mt-1">Select a category to issue a new pass instantly.</p>
              </div>
              <div className="flex bg-white rounded-xl p-1 shadow-sm border border-gray-100">
                 <button className="px-4 py-2 text-xs font-bold text-primary bg-purple-50 rounded-lg">Single Purchase</button>
                 <button className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-gray-600">Bulk Issue</button>
              </div>
           </div>

           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {CATEGORIES.map(cat => (
                 <div key={cat.id} onClick={() => { setSelectedCategory(cat); setRegistrationMode(false); }} className={`group relative bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:border-primary/40 hover:shadow-md transition-all cursor-pointer overflow-hidden`}>
                    <div className={`absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity`}>
                       <cat.icon className="w-16 h-16" />
                    </div>
                    
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${cat.bg} ${cat.border} ${cat.color} shadow-sm group-hover:scale-110 transition-transform`}>
                       <cat.icon className="w-5 h-5" />
                    </div>
                    
                    <h3 className="text-md font-bold text-gray-900 mb-1">{cat.name}</h3>
                    <div className="flex items-baseline gap-1">
                       <span className="text-xl font-bold text-gray-900">₹{cat.price}</span>
                       <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Per Pass</span>
                    </div>

                    {cat.id === 'Donor' && (
                       <button onClick={(e) => { e.stopPropagation(); setSelectedCategory(cat); setRegistrationMode(true); }} className="mt-4 w-full py-2 text-[10px] font-bold text-primary border border-primary/20 bg-purple-50/50 rounded-lg hover:bg-primary hover:text-white transition-all">
                          Donor Registration
                       </button>
                    )}
                 </div>
              ))}
           </div>

           <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 mt-8 shadow-xl flex items-center justify-between text-white overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform">
                 <UploadCloud className="w-40 h-40" />
              </div>
              <div className="relative z-10 space-y-1">
                 <h4 className="text-lg font-bold flex items-center">
                    <Users className="w-5 h-5 mr-3 text-secondary" /> Mass Issuance Module
                 </h4>
                 <p className="text-xs text-gray-400 font-medium">Coming Soon: Upload Excel files to process 100+ tickets in seconds.</p>
              </div>
              <button disabled className="relative z-10 bg-white/10 border border-white/20 whitespace-nowrap text-white font-bold py-2 px-6 rounded-xl text-xs opacity-50 cursor-not-allowed">
                 Contact Admin
              </button>
           </div>
        </div>
      ) : (
        <div className="animate-in slide-in-from-right-8 duration-500 max-w-4xl mx-auto">
           <button onClick={() => setSelectedCategory(null)} className="flex items-center text-xs font-bold text-gray-400 hover:text-primary mb-4 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Quick Sell
           </button>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: Form */}
              <div className="lg:col-span-2 space-y-4">
                 <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-[#fdfaff]">
                       <div>
                          <h2 className={`text-xl font-bold ${selectedCategory.color}`}>{selectedCategory.name}</h2>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Transaction Details</p>
                       </div>
                       {registrationMode && (
                          <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-3 py-1.5 rounded-full border border-blue-200 shadow-sm">Registration Only</span>
                       )}
                    </div>

                    <form onSubmit={handleCheckout} className="p-6 space-y-5">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div>
                             <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Purchaser Name</label>
                             <div className="relative">
                                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} placeholder="ex: Ramesh" className="w-full bg-[#f8fafc] border border-gray-100 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                             </div>
                          </div>
                          <div>
                             <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Phone Number</label>
                             <div className="relative">
                                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input required value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value})} placeholder="+91 00000 00000" className="w-full bg-[#f8fafc] border border-gray-100 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                             </div>
                          </div>
                       </div>

                       <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Attributed Organiser (POC)</label>
                          <div className="relative">
                             <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                             {currentUser.role === 'admin' ? (
                                <select required value={formData.poc} onChange={e=>setFormData({...formData, poc: e.target.value})} className="w-full bg-[#f8fafc] border border-gray-100 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none">
                                   <option value="">Choose Organiser...</option>
                                   {organisers.map(org => <option key={org.id} value={org.name}>{org.name}</option>)}
                                </select>
                             ) : (
                                <input disabled value={currentUser.name} className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-10 pr-4 py-2.5 text-sm font-bold text-gray-400" />
                             )}
                             {currentUser.role === 'admin' && <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 rotate-90" />}
                          </div>
                       </div>

                       <div className="grid grid-cols-2 gap-5">
                          <div>
                             <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Ticket Quantity</label>
                             <input type="number" required min="1" max="50" value={formData.qty} onChange={e=>setFormData({...formData, qty: Number(e.target.value)})} className="w-full bg-[#f8fafc] border border-gray-100 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                          </div>
                          <div className="flex flex-col justify-end">
                             <button type="submit" disabled={isSubmitting || !formData.name || !formData.phone || !formData.poc} className={`w-full text-white font-bold py-2.5 rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50 flex justify-center items-center text-sm ${selectedCategory.btn}`}>
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm & Send"}
                             </button>
                          </div>
                       </div>
                    </form>
                 </div>
                 {success && (
                    <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl p-4 flex items-center justify-center gap-3 text-sm font-bold animate-in zoom-in-95">
                       <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Ticket data synced to Supabase!
                    </div>
                 )}
              </div>

              {/* Right Column: Checkout Summary */}
              <div className="space-y-4">
                 <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden relative">
                    <div className={`absolute top-0 right-0 p-4 opacity-5`}>
                       <IndianRupee className="w-20 h-20" />
                    </div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 border-b border-gray-50 pb-4">Order Summary</h3>
                    
                    <div className="space-y-4 relative z-10">
                       <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-gray-500">{selectedCategory.name} x {formData.qty}</span>
                          <span className="font-bold text-gray-900">₹{selectedCategory.price * formData.qty}</span>
                       </div>
                       <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-gray-500">Service Fee</span>
                          <span className="font-bold text-emerald-500">₹0.00</span>
                       </div>
                       <div className="pt-4 border-t border-gray-100 flex justify-between items-end">
                          <div className="flex flex-col">
                             <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Net Total</span>
                             <span className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-secondary to-primary leading-tight mt-1">₹{totalAmount}</span>
                          </div>
                          <div className="bg-purple-50 text-primary text-[10px] font-bold px-2 py-1 rounded">
                             INC ALL TAXES
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="bg-amber-50 rounded-2xl border border-amber-100 p-5">
                    <h4 className="flex items-center text-xs font-bold text-amber-800 mb-2">
                       <Ticket className="w-4 h-4 mr-2" /> Digital Pass Distribution
                    </h4>
                    <p className="text-[10px] font-medium text-amber-700/80 leading-relaxed">Tickets will be marked as "Pending" in the main Sales Report until payment is manually verified by an administrator.</p>
                 </div>
              </div>

           </div>
        </div>
      )}
    </div>
  );
}
