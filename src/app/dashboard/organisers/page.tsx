"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { UserPlus, Search, Edit2, CheckCircle2, Phone, Clock, Loader2, ArrowLeft, Target, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { IndianMobileInput } from "@/components/indian-mobile-input";
import { CenteredModal } from "@/components/centered-modal";
import { hasIndianNationalDigits, toIndianE164 } from "@/utils/phone";
import {
  buildTargetRowsFromProfile,
  soldCountsFromTickets,
} from "@/utils/pass-targets";

export default function OrganisersPage() {
  const pathname = usePathname();
  const [view, setView] = useState<'list' | 'add'>('list');
  const [loading, setLoading] = useState(true);
  const [organisers, setOrganisers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Target Editing State
  const [editingOrg, setEditingOrg] = useState<any>(null);
  const [savingTargets, setSavingTargets] = useState(false);

  // Add Form State
  const [formData, setFormData] = useState({ name: "", phone: "", roles: ["organiser"], password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (view === "list") loadOrganisers();
  }, [view, pathname]);

  async function loadOrganisers() {
    setLoading(true);
    try {
      const [profilesRes, ticketsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, name, phone, roles, role, pass_targets"),
        supabase.from("tickets").select("*"),
      ]);

      if (profilesRes.error) {
        console.error("[Organisers] profiles:", profilesRes.error);
      }
      if (ticketsRes.error) {
        console.error("[Organisers] tickets:", ticketsRes.error);
      }

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
           const soldByName = soldCountsFromTickets(orgTickets);

           return {
              id: org.id,
              name: org.name,
              phone: org.phone,
              status: "active",
              lastLogin: "Just now",
              totalSales: orgTickets.length,
              pass_targets: org.pass_targets,
              targets: buildTargetRowsFromProfile(org.pass_targets, soldByName),
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
    if (!hasIndianNationalDigits(formData.phone)) {
      alert("Enter a phone number.");
      return;
    }
    setIsSubmitting(true);
    setSuccess(false);

    try {
      const mockUuid = crypto.randomUUID();
      let phoneE164: string;
      try {
        phoneE164 = toIndianE164(formData.phone);
      } catch {
        alert("Enter a valid phone number.");
        setIsSubmitting(false);
        return;
      }
      const { error } = await supabase.from('profiles').insert({
        id: mockUuid, 
        name: formData.name, 
        phone: phoneE164, 
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

  const closeTargetEditor = useCallback(() => setEditingOrg(null), []);

  const saveTargetEdits = async () => {
    if (!editingOrg) return;
    const pass_targets: Record<string, number> = {};
    for (const row of editingOrg.targets as { name: string; target: number }[]) {
      pass_targets[row.name] = row.target;
    }
    setSavingTargets(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({ pass_targets })
        .eq("id", editingOrg.id)
        .select("id, pass_targets")
        .maybeSingle();

      if (error) {
        console.error(error);
        alert(
          "Could not save targets. Run the SQL migration `supabase/migrations/add_pass_targets_to_profiles.sql` in Supabase, then try again."
        );
        return;
      }
      if (!data) {
        alert(
          "No profile row was updated. Your session may not match this organiser, or the id is invalid."
        );
        return;
      }

      const mergedPassTargets = data.pass_targets ?? pass_targets;
      setOrganisers((prev) =>
        prev.map((o) =>
          o.id === editingOrg.id
            ? { ...editingOrg, pass_targets: mergedPassTargets }
            : o
        )
      );
      setEditingOrg(null);
    } finally {
      setSavingTargets(false);
    }
  };

  const filteredOrganisers = organisers.filter(o => 
     o.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     o.phone.includes(searchQuery)
  );

  return (
    <div className="space-y-4 sm:space-y-5 max-w-5xl mx-auto">
      
      <CenteredModal
        open={!!editingOrg}
        onClose={closeTargetEditor}
        closeBlocked={savingTargets}
        title="Edit Targets"
        titleId="organiser-targets-modal-title"
        headerIcon={<Target className="h-5 w-5 shrink-0 text-primary" />}
        footer={
          <div className="flex gap-2 sm:gap-3">
            <button
              type="button"
              onClick={closeTargetEditor}
              disabled={savingTargets}
              className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-800 transition-colors hover:bg-gray-100 disabled:opacity-50 sm:text-base"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void saveTargetEdits()}
              disabled={savingTargets}
              className="flex-1 rounded-xl bg-gradient-to-r from-primary to-secondary py-3 text-sm font-bold text-white shadow-lg shadow-pink-500/20 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 sm:text-base"
            >
              {savingTargets ? (
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              ) : (
                "Save"
              )}
            </button>
          </div>
        }
      >
        {editingOrg ? (
          <>
            <p className="mb-3 text-xs text-gray-500 sm:text-sm">
              Quotas for <span className="font-bold text-gray-900">{editingOrg.name}</span>
            </p>
            <div className="space-y-2">
              {editingOrg.targets.map((tgt: any, i: number) => (
                <div
                  key={tgt.name}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-[#fdfaff] p-3"
                >
                  <span className="flex min-w-0 items-center gap-2 text-xs font-bold text-gray-700 sm:text-sm">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${tgt.color}`} />
                    <span className="truncate">{tgt.name}</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={tgt.target}
                    onChange={(e) => {
                      const newTargets = [...editingOrg.targets];
                      newTargets[i].target = Number(e.target.value);
                      setEditingOrg({ ...editingOrg, targets: newTargets });
                    }}
                    className="w-[4.5rem] rounded-lg border border-gray-200 bg-white py-2 text-center text-sm font-bold text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 sm:w-20"
                  />
                </div>
              ))}
            </div>
          </>
        ) : null}
      </CenteredModal>

      {/* Header Layout */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start">
        <div className="min-w-0">
          {view === 'add' ? (
             <button type="button" onClick={() => setView('list')} className="flex items-center text-xs sm:text-sm font-bold text-gray-500 hover:text-primary mb-1 transition-colors">
                <ArrowLeft className="w-4 h-4 mr-1 shrink-0" /> Back to Directory
             </button>
          ) : null}
          <h1 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-secondary to-primary leading-tight">
             {view === 'add' ? 'User Management' : 'Organiser Management'}
          </h1>
          {view === 'add' ? (
             <p className="text-gray-500 mt-0.5 sm:mt-1 text-xs sm:text-sm font-medium leading-snug">
                Provision access by role
             </p>
          ) : null}
        </div>
        
        {view === 'list' && (
           <button type="button" onClick={() => setView('add')} className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-secondary hover:from-primary-dark hover:to-primary text-white font-bold py-3 px-5 rounded-xl text-sm shadow-lg shadow-pink-500/25 transition-all active:scale-[0.98]">
             <UserPlus className="w-4 h-4" /> Add organiser
           </button>
        )}
      </div>

      {view === 'add' ? (
        <div className="w-full max-w-2xl bg-white rounded-xl sm:rounded-2xl p-5 sm:p-6 shadow-sm border border-pink-100/80 animate-in fade-in slide-in-from-right-4 duration-300">
          <form onSubmit={handleAddSubmit} className="space-y-5 sm:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-sm font-bold text-secondary mb-2">Full Name</label>
                <input required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} placeholder="Sara" className="w-full bg-[#fdfaff] border border-pink-100 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-bold text-secondary mb-2">Phone Number</label>
                <IndianMobileInput
                  required
                  value={formData.phone}
                  onChange={(d) => setFormData({ ...formData, phone: d })}
                  className="border border-pink-100 bg-[#fdfaff]"
                  prefixClassName="bg-pink-50/90 border-pink-100 text-secondary dark:bg-violet-950/55 dark:border-violet-500/30 dark:text-violet-200"
                  inputClassName="font-medium text-gray-900 dark:text-violet-100"
                />
                <p className="text-[10px] text-gray-400 mt-1 font-medium">India (+91)</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-secondary mb-2">Login Password</label>
              <div className="relative">
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={e=>setFormData({...formData, password: e.target.value})}
                  placeholder="Assign a password"
                  className="w-full bg-[#fdfaff] border border-pink-100 rounded-xl pl-4 pr-11 py-3 text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-pink-50 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
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

            <div className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-h-[1.75rem]">
                 {success && <span className="inline-flex items-center text-xs sm:text-sm font-bold text-accent bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100"><CheckCircle2 className="w-4 h-4 mr-2 shrink-0" /> User saved!</span>}
              </div>
              <button type="submit" disabled={isSubmitting || !formData.name || !hasIndianNationalDigits(formData.phone)} className="w-full sm:w-auto bg-gradient-to-r from-primary to-secondary text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-pink-500/30 transition-all active:scale-[0.98] disabled:opacity-50 sm:min-w-[140px]">
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Save member"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="animate-in fade-in duration-300">
           
           <div className="relative mb-4 sm:mb-5">
              <Search className="w-4 h-4 sm:w-5 sm:h-5 absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input 
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search name or phone" 
                className="w-full bg-gray-100/90 border border-gray-200/90 rounded-xl pl-10 sm:pl-11 pr-3 py-2.5 sm:py-3 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all"
              />
           </div>

           {loading ? (
              <div className="flex justify-center py-10 sm:py-12"><Loader2 className="w-7 h-7 sm:w-8 sm:h-8 text-primary animate-spin" /></div>
           ) : filteredOrganisers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-white/60 px-4 py-10 text-center">
                 <p className="text-sm font-semibold text-gray-700">
                    {organisers.length === 0 ? "No organisers yet" : "No matches"}
                 </p>
                 <p className="text-xs text-gray-500 mt-1">
                    {organisers.length === 0 ? "Add your first organiser with the button above" : "Try a different name or phone"}
                 </p>
              </div>
           ) : (
              <ul className="space-y-3 sm:space-y-4 list-none p-0 m-0">
                {filteredOrganisers.map(org => {
                   const totalTgt = org.targets.reduce((acc: number, t: any) => acc + t.target, 0);
                   const totalSld = org.targets.reduce((acc: number, t: any) => acc + t.sold, 0);
                   const overallPercNum = totalTgt > 0 ? Math.min(100, (totalSld / totalTgt) * 100) : 0;
                   const overallPerc = totalTgt > 0 ? overallPercNum.toFixed(1) : "0";

                   return (
                   <li key={org.id}>
                   <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-200/90 shadow-sm overflow-hidden flex flex-col hover:border-pink-200/80 transition-colors group">
                      
                      <div className="p-3.5 sm:p-4 border-b border-gray-100">
                         <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                               <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                  <h3 className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-primary transition-colors truncate max-w-full">{org.name}</h3>
                                  <span className="bg-gray-900 text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0">
                                     {org.status}
                                  </span>
                               </div>
                               <div className="flex flex-col sm:flex-row sm:flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm text-gray-500 font-medium">
                                  <span className="inline-flex items-center gap-1.5 min-w-0"><Phone className="w-3.5 h-3.5 shrink-0 opacity-70" /> <span className="truncate">{org.phone}</span></span>
                                  <span className="inline-flex items-center gap-1.5 text-gray-400"><Clock className="w-3.5 h-3.5 shrink-0 opacity-70" /> <span className="hidden sm:inline">Last login:</span> {org.lastLogin}</span>
                               </div>
                            </div>
                            <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0 border-t border-gray-50 sm:border-0 sm:shrink-0">
                               <div className="text-left sm:text-right">
                                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Sales</p>
                                  <span className="text-xl sm:text-2xl font-bold text-primary tabular-nums leading-none">{org.totalSales}</span>
                               </div>
                               <button type="button" onClick={() => setEditingOrg(org)} className="inline-flex items-center justify-center gap-1.5 bg-white border border-gray-200 text-gray-800 font-bold px-3 py-2 rounded-lg hover:border-primary hover:text-primary transition-all text-[11px] sm:text-sm shadow-sm active:scale-[0.98] min-h-[40px] touch-manipulation whitespace-nowrap">
                                  <Edit2 className="w-4 h-4 shrink-0" />
                                  Edit targets
                               </button>
                            </div>
                         </div>
                      </div>

                      <div className="p-2 sm:p-3 bg-[#fafafa]">
                         <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                         {org.targets.map((tgt: any) => {
                            const perc = tgt.target > 0 ? Math.min(100, Math.floor((tgt.sold / tgt.target) * 100)) : 0;
                            return (
                               <div key={tgt.name} className="rounded-lg bg-white border border-gray-100 p-2.5 sm:p-3">
                                  <div className="flex justify-between items-start gap-1 mb-1.5">
                                     <h4 className="text-[11px] sm:text-xs font-bold text-gray-800 leading-tight line-clamp-2">{tgt.name}</h4>
                                     <span className="shrink-0 bg-gray-100 text-gray-600 text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded tabular-nums">{perc}%</span>
                                  </div>
                                  <div className="flex items-baseline gap-1 mb-1.5">
                                    <span className="text-base sm:text-lg font-bold text-gray-900 tabular-nums">{tgt.sold}</span>
                                    <span className="text-[11px] sm:text-xs font-medium text-gray-400">/ {tgt.target}</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden">
                                     <div className={`${tgt.color} h-full rounded-full transition-all duration-500`} style={{ width: `${perc}%` }}></div>
                                  </div>
                               </div>
                            );
                         })}
                         </div>
                      </div>

                      <div className="px-3 py-2.5 sm:px-4 sm:py-3 bg-gray-50/90 border-t border-gray-100">
                         <div className="flex justify-between items-center text-[11px] sm:text-sm mb-1.5">
                            <span className="font-semibold text-gray-600">Overall</span>
                            <span className="font-bold text-primary tabular-nums">{overallPerc}%</span>
                         </div>
                         <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                               className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
                               style={{ width: `${overallPercNum}%` }}
                            />
                         </div>
                      </div>

                   </div>
                   </li>
                   );
                })}
              </ul>
           )}
        </div>
      )}
    </div>
  );
}
