"use client";

import { useEffect, useState } from "react";
import { UserPlus, Search, Edit2, CheckCircle2, Phone, Clock, Loader2, ArrowLeft, X, Target } from "lucide-react";
import { supabase } from "@/utils/supabase";

export default function OrganisersPage() {
  const [view, setView] = useState<'list' | 'add'>('list');
  const [loading, setLoading] = useState(true);
  const [organisers, setOrganisers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Target Editing State
  const [editingOrg, setEditingOrg] = useState<any>(null);

  // Add Form State
  const [formData, setFormData] = useState({ name: "", phone: "", roles: ["organiser"], password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (view === 'list') loadOrganisers();
  }, [view]);

  async function loadOrganisers() {
    setLoading(true);
    try {
      const [profilesRes, ticketsRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("tickets").select("*")
      ]);

      const profiles = profilesRes.data || [];
      const tickets = ticketsRes.data || [];

      if (profiles) {
        const orgs = profiles.filter(p => {
          if (Array.isArray(p.roles)) return p.roles.includes('organiser');
          if (p.role) return p.role === 'organiser';
          return false;
        }).map(org => {
           // Aggregate sales for this SPECIFIC organiser - case insensitive and trimmed
           const orgNameLower = org.name.trim().toLowerCase();
           const orgTickets = tickets.filter(t => t.sold_by?.trim().toLowerCase() === orgNameLower);
           
           const typeSld = { 'Platinum Pass': 0, 'Donor Pass': 0, 'Bulk Tickets': 0, 'Student Pass': 0 };
           
           orgTickets.forEach(t => {
              if (t.type === 'Platinum') typeSld['Platinum Pass']++;
              else if (t.type === 'Donor') typeSld['Donor Pass']++;
              else if (t.type === 'Bulk') typeSld['Bulk Tickets']++;
              else if (t.type === 'Student') typeSld['Student Pass']++;
           });

           return {
              id: org.id,
              name: org.name,
              phone: org.phone,
              status: "active",
              lastLogin: "Just now",
              totalSales: orgTickets.length,
              targets: [
                { name: "Platinum Pass", sold: typeSld['Platinum Pass'], target: 50, color: "bg-[#ec4899]" },
                { name: "Donor Pass", sold: typeSld['Donor Pass'], target: 15, color: "bg-[#3b82f6]" },
                { name: "Bulk Tickets", sold: typeSld['Bulk Tickets'], target: 100, color: "bg-[#10b981]" },
                { name: "Student Pass", sold: typeSld['Student Pass'], target: 40, color: "bg-[#f59e0b]" }
              ]
           };
        });
        setOrganisers(orgs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const toggleRole = (roleValue: string) => {
    setFormData(prev => {
      const current = prev.roles;
      if (current.includes(roleValue)) return { ...prev, roles: current.filter(r => r !== roleValue) };
      return { ...prev, roles: [...current, roleValue] };
    });
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.roles.length === 0) return alert("Please select at least one role!");
    setIsSubmitting(true);
    setSuccess(false);

    try {
      const mockUuid = crypto.randomUUID();
      const { error } = await supabase.from('profiles').insert({
        id: mockUuid, 
        name: formData.name, 
        phone: formData.phone, 
        roles: formData.roles,
        password: formData.password
      });

      if (error) {
        if (error.code === '23505') alert("This phone number is already registered!");
        else alert("Error saving user.");
      } else {
        setSuccess(true);
        setFormData({ name: "", phone: "", roles: ["organiser"], password: "" }); 
        setTimeout(() => { setSuccess(false); setView('list'); }, 1500);
      }
    } catch(err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveTargetEdits = () => {
     if (!editingOrg) return;
     setOrganisers(prev => prev.map(o => o.id === editingOrg.id ? editingOrg : o));
     setEditingOrg(null);
  };

  const filteredOrganisers = organisers.filter(o => 
     o.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     o.phone.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      
      {/* Target Editor Modal */}
      {editingOrg && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
             <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="text-xl font-bold text-gray-900 flex items-center">
                   <Target className="w-5 h-5 mr-2 text-primary" /> Edit Targets
                </h3>
                <button onClick={() => setEditingOrg(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                   <X className="w-4 h-4" />
                </button>
             </div>
             
             <div className="p-6 space-y-3">
                <p className="text-sm font-medium text-gray-500 mb-6">Modify ticket tier quotas for <span className="font-bold text-gray-900">{editingOrg.name}</span>.</p>
                
                {editingOrg.targets.map((tgt: any, i: number) => (
                   <div key={tgt.name} className="flex justify-between items-center p-3 rounded-xl border border-gray-100 bg-[#fdfaff] hover:border-pink-200 transition-colors">
                      <span className="font-bold text-gray-700 text-sm flex items-center gap-2">
                         <div className={`w-2 h-2 rounded-full ${tgt.color}`}></div>
                         {tgt.name}
                      </span>
                      <input 
                        type="number" 
                        min="0"
                        value={tgt.target} 
                        onChange={(e) => {
                           const newTargets = [...editingOrg.targets];
                           newTargets[i].target = Number(e.target.value);
                           setEditingOrg({ ...editingOrg, targets: newTargets });
                        }}
                        className="w-20 text-center bg-white border border-gray-200 rounded-lg py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none font-bold text-gray-900" 
                      />
                   </div>
                ))}
             </div>

             <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
                <button onClick={() => setEditingOrg(null)} className="flex-1 bg-white border border-gray-200 text-gray-800 font-bold py-3 rounded-xl hover:bg-gray-100 transition-colors shadow-sm">Cancel</button>
                <button onClick={saveTargetEdits} className="flex-1 bg-gradient-to-r from-primary to-secondary text-white font-bold py-3 rounded-xl shadow-lg shadow-pink-500/20 hover:opacity-90 transition-all active:scale-[0.98]">Save Quotas</button>
             </div>
          </div>
        </div>
      )}

      {/* Header Layout */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          {view === 'add' ? (
             <button onClick={() => setView('list')} className="flex items-center text-sm font-bold text-gray-500 hover:text-primary mb-2 transition-colors">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to Directory
             </button>
          ) : null}
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-secondary to-primary">
             {view === 'add' ? 'User Management' : 'Organiser Management'}
          </h1>
          <p className="text-gray-500 mt-1 text-sm font-medium">
             {view === 'add' ? 'Add and manage system access automatically provisioned by roles' : 'Manage organisers and set sales targets'}
          </p>
        </div>
        
        {view === 'list' && (
           <button onClick={() => setView('add')} className="flex items-center justify-center bg-gradient-to-r from-primary to-secondary hover:from-primary-dark hover:to-primary text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-pink-500/30 transition-all active:scale-[0.98]">
             <UserPlus className="w-4 h-4 mr-2" /> Add New Organiser
           </button>
        )}
      </div>

      {view === 'add' ? (
        <div className="max-w-2xl bg-white rounded-2xl p-8 shadow-[0_4px_24px_rgba(236,72,153,0.06)] border border-pink-50 mt-8 animate-in fade-in slide-in-from-right-4 duration-300">
          <form onSubmit={handleAddSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-secondary mb-2">Full Name</label>
                <input required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} placeholder="Sara" className="w-full bg-[#fdfaff] border border-pink-100 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-bold text-secondary mb-2">Phone Number</label>
                <input required value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value})} placeholder="+91 99999 00000" className="w-full bg-[#fdfaff] border border-pink-100 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-secondary mb-2">Login Password</label>
              <input required type="password" value={formData.password} onChange={e=>setFormData({...formData, password: e.target.value})} placeholder="Assign a password" className="w-full bg-[#fdfaff] border border-pink-100 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono" />
              <p className="text-[10px] text-gray-400 mt-1 font-medium">The user will use their phone number and this password to login.</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-secondary mb-3">System Roles / Access Types</label>
              <div className="flex flex-col gap-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${formData.roles.includes('admin') ? 'bg-primary border-primary' : 'bg-[#fdfaff] border-pink-200 group-hover:border-primary'}`}>
                     {formData.roles.includes('admin') && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                  <input type="checkbox" className="hidden" checked={formData.roles.includes('admin')} onChange={()=>toggleRole('admin')} />
                  <span className="text-sm font-bold text-gray-700">Administrator <span className="font-normal text-gray-500">(Full Access)</span></span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${formData.roles.includes('organiser') ? 'bg-primary border-primary' : 'bg-[#fdfaff] border-pink-200 group-hover:border-primary'}`}>
                     {formData.roles.includes('organiser') && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                  <input type="checkbox" className="hidden" checked={formData.roles.includes('organiser')} onChange={()=>toggleRole('organiser')} />
                  <span className="text-sm font-bold text-gray-700">Organiser <span className="font-normal text-gray-500">(Dashboard Access)</span></span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${formData.roles.includes('front_desk') ? 'bg-primary border-primary' : 'bg-[#fdfaff] border-pink-200 group-hover:border-primary'}`}>
                     {formData.roles.includes('front_desk') && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                  <input type="checkbox" className="hidden" checked={formData.roles.includes('front_desk')} onChange={()=>toggleRole('front_desk')} />
                  <span className="text-sm font-bold text-gray-700">Front Desk <span className="font-normal text-gray-500">(Scanner Only)</span></span>
                </label>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <div className="flex-1">
                 {success && <span className="flex items-center text-sm font-bold text-accent bg-amber-50 px-3 py-1.5 rounded-lg w-fit border border-amber-100"><CheckCircle2 className="w-4 h-4 mr-2" /> User saved!</span>}
              </div>
              <button type="submit" disabled={isSubmitting || !formData.name || !formData.phone} className="bg-gradient-to-r from-primary to-secondary text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-pink-500/30 transition-all active:scale-[0.98] disabled:opacity-50 min-w-[140px]">
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Save Member"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="animate-in fade-in duration-300">
           
           <div className="relative mb-8">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name or phone number..." 
                className="w-full bg-[#f3f4f6] border border-gray-200 rounded-xl pl-11 pr-4 py-3.5 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
           </div>

           {loading ? (
              <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
           ) : (
              <div className="space-y-6">
                {filteredOrganisers.map(org => {
                   const totalTgt = org.targets.reduce((acc: number, t: any) => acc + t.target, 0);
                   const totalSld = org.targets.reduce((acc: number, t: any) => acc + t.sold, 0);
                   const overallPerc = totalTgt > 0 ? ((totalSld / totalTgt) * 100).toFixed(1) : "0";

                   return (
                   <div key={org.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col hover:border-pink-200 transition-colors group">
                      
                      <div className="p-6 pb-5 flex flex-col md:flex-row justify-between md:items-start border-b border-gray-100 gap-4 md:gap-0">
                         <div>
                            <div className="flex items-center gap-3 mb-3">
                               <h3 className="text-xl font-bold text-gray-900 group-hover:text-primary transition-colors">{org.name}</h3>
                               <span className="bg-gray-900 text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full shadow-sm">
                                  {org.status}
                               </span>
                            </div>
                            <div className="flex items-center gap-5 text-sm font-medium text-gray-500">
                               <div className="flex items-center"><Phone className="w-4 h-4 mr-2 opacity-70" /> {org.phone}</div>
                               <div className="flex items-center"><Clock className="w-4 h-4 mr-2 opacity-70" /> Last Login: {org.lastLogin}</div>
                            </div>
                         </div>
                         <div className="flex items-center gap-8 md:text-right">
                            <div>
                               <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Total Sales</p>
                               <span className="text-3xl font-bold text-primary">{org.totalSales}</span>
                            </div>
                            <button onClick={() => setEditingOrg(org)} className="flex items-center bg-white border border-gray-200 text-gray-700 font-bold px-4 py-2.5 rounded-lg hover:border-primary hover:text-primary transition-all shadow-sm active:scale-[0.98] text-sm group-hover:shadow-md">
                               <Edit2 className="w-4 h-4 mr-2" /> Edit Targets
                            </button>
                         </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-gray-100 bg-gray-50/30">
                         {org.targets.map((tgt: any) => {
                            const perc = tgt.target > 0 ? Math.min(100, Math.floor((tgt.sold / tgt.target) * 100)) : 0;
                            return (
                               <div key={tgt.name} className="p-5">
                                  <div className="flex justify-between items-center mb-4">
                                     <h4 className="text-sm font-bold text-gray-700">{tgt.name}</h4>
                                     <span className="bg-gray-100 border border-gray-200 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-md">{perc}%</span>
                                  </div>
                                  <div className="flex items-end gap-1 mb-2">
                                    <span className="text-xl font-bold text-gray-900">{tgt.sold}</span>
                                    <span className="text-sm font-medium text-gray-400 mb-0.5">/ {tgt.target}</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                     <div className={`${tgt.color} h-full rounded-full transition-all duration-500`} style={{ width: `${perc}%` }}></div>
                                  </div>
                               </div>
                            );
                         })}
                      </div>

                      <div className="p-4 bg-gray-50 border-t border-gray-100 relative">
                         <div className="flex justify-between items-center text-sm mb-3 px-2">
                            <span className="font-bold text-gray-600">Overall Progress</span>
                            <span className="font-bold text-primary">{overallPerc}% Complete</span>
                         </div>
                         <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-primary to-secondary transition-all duration-500" style={{ width: `${overallPerc}%` }}></div>
                      </div>

                   </div>
                   );
                })}
              </div>
           )}
        </div>
      )}
    </div>
  );
}
