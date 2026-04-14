"use client";

import { useEffect, useState } from "react";
import { 
  Bell, Send, Image as ImageIcon, ClipboardList, Target, Plus, Info, 
  Loader2, Calendar as CalendarIcon, AlertCircle, Users 
} from "lucide-react";
import { supabase } from "@/utils/supabase";


/** Roles from `profiles.roles` (array) or legacy `profiles.role` (string). */
function normalizeProfileRoles(p: { roles?: unknown; role?: unknown }): string[] {
  if (Array.isArray(p.roles)) {
    return p.roles.filter((r): r is string => typeof r === "string" && r.length > 0);
  }
  if (typeof p.roles === "string") {
    const s = p.roles.trim();
    if (!s) return [];
    return s.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
  }
  if (typeof p.role === "string" && p.role.trim()) return [p.role.trim()];
  return [];
}

export default function NotificationsPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Notifications State
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [isComposing, setIsComposing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newBroadcast, setNewBroadcast] = useState({
    title: '',
    message: '',
    type: 'text' as 'text' | 'image' | 'survey',
    targetType: 'buyers' as 'buyers' | 'organisers',
    targetCategories: [] as string[],
    imageUrl: '',
    surveyUrl: '',
    scheduledAt: ''
  });

  useEffect(() => {
    // Check admin role
    const role = localStorage.getItem('rhapsody_role');
    const allRoles = JSON.parse(localStorage.getItem('rhapsody_all_roles') || '[]');
    const adminStatus = role === 'admin' || allRoles.includes('admin');
    setIsAdmin(adminStatus);
    setLoading(false);

    if (adminStatus) {
      fetchBroadcasts();
    }
  }, []);

  const fetchBroadcasts = async () => {
    try {
      const { data } = await supabase
        .from('broadcasts')
        .select('*')
        .order('created_at', { ascending: false });
      setBroadcasts(data || []);
    } catch (e) {
      console.error("Error fetching broadcasts:", e);
    }
  };

  const [error, setError] = useState<string | null>(null);

  const handleCreateBroadcast = async () => {
    console.log("handleCreateBroadcast triggered", newBroadcast);
    if (!newBroadcast.title || !newBroadcast.message) {
      alert("Please enter both a title and a message.");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    try {
      if (newBroadcast.targetType === 'organisers') {
        console.log("Fetching organisers for broadcast...");
        const { data: profiles, error: profileError } = await supabase.from('profiles').select('*');
        if (profileError) throw profileError;

        const organisers = (profiles || []).filter(p => {
          const roles = normalizeProfileRoles(p);
          return roles.includes('organiser') || roles.includes('admin');
        });

        if (organisers.length === 0) {
          throw new Error("No organisers found to send to.");
        }

        console.log(`Sending broadcast to ${organisers.length} organisers...`);

        // Insert record first
        const { data: bData, error: insertError } = await supabase.from('broadcasts').insert([{
          title: newBroadcast.title,
          message: newBroadcast.message,
          broadcast_type: newBroadcast.type,
          target_type: newBroadcast.targetType,
          target_categories: newBroadcast.targetCategories,
          image_url: newBroadcast.imageUrl,
          survey_url: newBroadcast.surveyUrl,
          scheduled_at: newBroadcast.scheduledAt || null,
          status: 'sending',
          total_recipients: organisers.length
        }]).select().single();

        if (insertError) throw insertError;

        // Sequence sending
        for (let i = 0; i < organisers.length; i++) {
          const org = organisers[i];
          if (!org.phone) continue;

          let fullMessage = newBroadcast.message;
          // Append URLs if not present in message
          if (newBroadcast.type === 'survey' && newBroadcast.surveyUrl && !fullMessage.includes(newBroadcast.surveyUrl)) {
            fullMessage += `\n\nLink: ${newBroadcast.surveyUrl}`;
          } else if (newBroadcast.type === 'image' && newBroadcast.imageUrl && !fullMessage.includes(newBroadcast.imageUrl)) {
            fullMessage += `\n\nPoster: ${newBroadcast.imageUrl}`;
          }

          try {
            const res = await fetch('/api/send-ticket', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                phone: org.phone,
                ticketContent: fullMessage
              })
            });
            const d = await res.json();
            if (!d.success) {
               const isSandboxError = d.code === 131030;
               console.error(isSandboxError ? "WhatsApp Sandbox Error:" : "Broadcast API Fail:", d.error);
               if (isSandboxError) {
                 alert(`Critical: WhatsApp Sandbox Restriction hit. ${d.error}`);
                 break; // Stop loop if sandbox restricted
               }
            }
          } catch (apiErr) {
            console.error(`Failed to send to ${org.phone}:`, apiErr);
          }

          if (i < organisers.length - 1) {
            await new Promise(r => setTimeout(r, 800)); // Respect Rate Limits
          }
        }

        // Finalize status
        await supabase.from('broadcasts').update({ status: 'sent' }).eq('id', bData.id);
        alert(`Broadcast sent to ${organisers.length} organisers!`);

      } else {
        // Buyers - Placeholder logic
        console.log("Buyers broadcast requested (Placeholder Mode)");
        const { error: insertError } = await supabase.from('broadcasts').insert([{
          title: newBroadcast.title,
          message: newBroadcast.message,
          broadcast_type: newBroadcast.type,
          target_type: newBroadcast.targetType,
          target_categories: newBroadcast.targetCategories,
          image_url: newBroadcast.imageUrl,
          survey_url: newBroadcast.surveyUrl,
          scheduled_at: newBroadcast.scheduledAt || null,
          status: newBroadcast.scheduledAt ? 'scheduled' : 'sent',
          total_recipients: Math.floor(Math.random() * 500) + 100
        }]);

        if (insertError) throw insertError;
        alert("Broadcast placeholder created successfully (Logic to be replaced in future)!");
      }

      setIsComposing(false);
      setNewBroadcast({
        title: '', message: '', type: 'text', targetType: 'buyers',
        targetCategories: [], imageUrl: '', surveyUrl: '', scheduledAt: ''
      });
      fetchBroadcasts();
    } catch (e: any) {
      console.error("Broadcast failed:", e);
      setError(e.message || "Failed to send broadcast.");
      alert("Error: " + (e.message || "Failed to send broadcast"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-full">
           <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold dark:text-white">Access Denied</h2>
        <p className="text-gray-500 dark:text-violet-300">This page is only accessible for Admin roles.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white flex items-center gap-3">
            <Bell className="w-8 h-8 text-primary" />
            Notification Center
          </h1>
          <p className="text-sm font-bold text-gray-400 dark:text-violet-300/60 font-medium mt-1">Direct WhatsApp communication with your target audience</p>
        </div>

        {!isComposing && (
          <button
            onClick={() => setIsComposing(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" /> Compose Message
          </button>
        )}
      </div>

      {isComposing ? (
        <div className="bg-white dark:bg-violet-950/15 border border-pink-50 dark:border-violet-500/10 rounded-3xl p-6 sm:p-8 shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            
            {/* Composer Side */}
            <div className="space-y-8">
              {/* 1. Target Audience */}
              <div className="space-y-4">
                <label className="text-xs font-black text-secondary uppercase tracking-[0.2em] flex items-center gap-2">
                  <Target className="w-4 h-4" /> 01. Select Audience
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setNewBroadcast({ ...newBroadcast, targetType: 'buyers' })}
                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 group ${newBroadcast.targetType === 'buyers' ? 'bg-primary/5 border-primary shadow-inner' : 'bg-white dark:bg-violet-950/40 border-gray-100 dark:border-violet-500/10 hover:border-gray-200'}`}
                  >
                    <div className={`p-2 rounded-xl transition-colors ${newBroadcast.targetType === 'buyers' ? 'bg-primary text-white' : 'bg-gray-50 text-gray-400 group-hover:text-primary'}`}>
                      <Users className="w-5 h-5" />
                    </div>
                    <span className={`text-[11px] font-black uppercase tracking-wider ${newBroadcast.targetType === 'buyers' ? 'text-primary' : 'text-gray-400'}`}>Ticket Buyers</span>
                  </button>
                  <button
                    onClick={() => setNewBroadcast({ ...newBroadcast, targetType: 'organisers' })}
                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 group ${newBroadcast.targetType === 'organisers' ? 'bg-primary/5 border-primary shadow-inner' : 'bg-white dark:bg-violet-950/40 border-gray-100 dark:border-violet-500/10 hover:border-gray-200'}`}
                  >
                    <div className={`p-2 rounded-xl transition-colors ${newBroadcast.targetType === 'organisers' ? 'bg-primary text-white' : 'bg-gray-50 text-gray-400 group-hover:text-primary'}`}>
                      <Info className="w-5 h-5" />
                    </div>
                    <span className={`text-[11px] font-black uppercase tracking-wider ${newBroadcast.targetType === 'organisers' ? 'text-primary' : 'text-gray-400'}`}>Organisers List</span>
                  </button>
                </div>

                {newBroadcast.targetType === 'buyers' && (
                  <div className="flex flex-wrap gap-2 animate-in slide-in-from-top-2">
                    {['Platinum Pass', 'Donor Pass', 'Student Pass'].map(cat => (
                      <button
                        key={cat}
                        onClick={() => {
                          const cats = newBroadcast.targetCategories.includes(cat)
                            ? newBroadcast.targetCategories.filter(c => c !== cat)
                            : [...newBroadcast.targetCategories, cat];
                          setNewBroadcast({ ...newBroadcast, targetCategories: cats });
                        }}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all ${newBroadcast.targetCategories.includes(cat) ? 'bg-secondary text-white border-secondary' : 'bg-white dark:bg-violet-900/20 border-gray-100 dark:border-violet-500/20 text-gray-400'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Message Content */}
              <div className="space-y-4">
                <label className="text-xs font-black text-secondary uppercase tracking-[0.2em] flex items-center gap-2">
                  <Send className="w-4 h-4" /> 02. Compose Message
                </label>
                <div className="space-y-4">
                  <input
                    type="text"
                    value={newBroadcast.title}
                    onChange={e => setNewBroadcast({ ...newBroadcast, title: e.target.value })}
                    placeholder="Campaign Title (Internal Only)"
                    className="w-full bg-white dark:bg-violet-950/40 border border-gray-100 dark:border-violet-500/25 px-5 py-3 rounded-2xl text-sm font-bold text-gray-900 dark:text-white focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                  />
                  
                  <textarea
                    value={newBroadcast.message}
                    onChange={e => setNewBroadcast({ ...newBroadcast, message: e.target.value })}
                    placeholder="WhatsApp Message Content..."
                    rows={5}
                    className="w-full bg-white dark:bg-violet-950/40 border border-gray-100 dark:border-violet-500/25 px-5 py-4 rounded-2xl text-sm font-bold text-gray-900 dark:text-white focus:ring-4 focus:ring-primary/10 transition-all outline-none resize-none leading-relaxed"
                  />
                </div>
              </div>

              {/* 3. Media & Scheduling */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <label className="text-xs font-black text-secondary uppercase tracking-[0.2em] flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" /> 03. Message Type
                  </label>
                  <div className="flex gap-2 p-1 bg-white dark:bg-violet-950/40 border border-pink-100 dark:border-violet-500/20 rounded-xl">
                    <button onClick={() => setNewBroadcast({...newBroadcast, type: 'text'})} className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${newBroadcast.type === 'text' ? 'bg-primary text-white' : 'text-gray-400'}`}>Text</button>
                    <button onClick={() => setNewBroadcast({...newBroadcast, type: 'image'})} className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${newBroadcast.type === 'image' ? 'bg-primary text-white' : 'text-gray-400'}`}>Poster</button>
                    <button onClick={() => setNewBroadcast({...newBroadcast, type: 'survey'})} className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${newBroadcast.type === 'survey' ? 'bg-primary text-white' : 'text-gray-400'}`}>Survey</button>
                  </div>
                  
                  {newBroadcast.type === 'image' && (
                    <input
                      type="url"
                      value={newBroadcast.imageUrl}
                      onChange={e => setNewBroadcast({...newBroadcast, imageUrl: e.target.value})}
                      placeholder="Image / Poster URL"
                      className="w-full bg-white dark:bg-violet-950/40 border border-gray-100 dark:border-violet-500/25 px-4 py-2.5 rounded-xl text-[11px] font-bold outline-none"
                    />
                  )}
                  {newBroadcast.type === 'survey' && (
                    <input
                      type="url"
                      value={newBroadcast.surveyUrl}
                      onChange={e => setNewBroadcast({...newBroadcast, surveyUrl: e.target.value})}
                      placeholder="Survey / Form URL"
                      className="w-full bg-white dark:bg-violet-950/40 border border-gray-100 dark:border-violet-500/25 px-4 py-2.5 rounded-xl text-[11px] font-bold outline-none"
                    />
                  )}
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-black text-secondary uppercase tracking-[0.2em] flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4" /> 04. Scheduling
                  </label>
                  <input
                    type="datetime-local"
                    value={newBroadcast.scheduledAt}
                    onChange={e => setNewBroadcast({...newBroadcast, scheduledAt: e.target.value})}
                    className="w-full bg-white dark:bg-violet-950/40 border border-gray-100 dark:border-violet-500/25 px-4 py-2.5 rounded-xl text-[11px] font-bold outline-none text-gray-500 dark:text-violet-300"
                  />
                </div>
              </div>

                {error && (
                  <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-500/20 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400 text-xs font-bold animate-in shake duration-300">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

              <div className="flex gap-4 pt-6 border-t border-gray-100 dark:border-violet-500/10">
                <button onClick={() => setIsComposing(false)} className="flex-1 py-3 text-sm font-black text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest">Cancel</button>
                <button
                  type="button"
                  onClick={handleCreateBroadcast}
                  className="flex-[2] py-4 bg-primary text-white text-sm font-black rounded-2xl shadow-xl shadow-primary/20 hover:bg-primary-dark transition-all flex items-center justify-center gap-3 active:scale-[0.98] cursor-pointer"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {newBroadcast.scheduledAt ? 'Schedule' : 'Send WhatsApp'}
                </button>
              </div>
            </div>

            {/* Preview Side */}
            <div className="hidden lg:flex flex-col">
              <label className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6 block text-center">Live WhatsApp Preview</label>
              <div className="flex-1 bg-gray-100/50 dark:bg-violet-950/20 rounded-[40px] p-8 shadow-inner relative overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
                
                <div className="w-[300px] bg-[#E5DDD5] dark:bg-slate-900 rounded-[32px] p-4 shadow-2xl border-[6px] border-gray-800 relative z-10 animate-in zoom-in-95 duration-500">
                   <div className="space-y-3">
                      {newBroadcast.imageUrl && (
                         <div className="rounded-xl overflow-hidden shadow-sm bg-white dark:bg-violet-900/40 p-1">
                            <img src={newBroadcast.imageUrl} alt="Poster" className="w-full aspect-[4/3] object-cover rounded-lg" onError={(e) => (e.currentTarget.style.display = 'none')} />
                         </div>
                      )}
                      <div className="bg-white dark:bg-violet-900/40 rounded-2xl rounded-tl-none p-4 shadow-sm relative">
                         <p className="text-[11px] font-bold text-gray-800 dark:text-violet-100 whitespace-pre-wrap leading-relaxed">
                            {newBroadcast.message || 'Typing preview...'}
                         </p>
                         {newBroadcast.surveyUrl && (
                            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[10px] text-blue-600 dark:text-blue-400 font-black">
                               <span className="flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5" /> Survey Link</span>
                               <span className="opacity-60">Open</span>
                            </div>
                         )}
                         <div className="absolute -left-2 top-0 w-3 h-3 bg-white dark:bg-violet-900/40" style={{clipPath: 'polygon(100% 0, 0 0, 100% 100%)'}}></div>
                         <span className="text-[9px] text-gray-400 dark:text-violet-400/50 block text-right mt-1.5">2:31 PM ✓✓</span>
                      </div>
                   </div>
                </div>
              </div>
              <div className="mt-6 flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                 <AlertCircle className="w-5 h-5 text-primary shrink-0" />
                 <p className="text-[10px] font-bold text-primary leading-snug">Official Official WhatsApp API gateway will be used for delivery.</p>
              </div>
            </div>

          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-violet-500/15 pb-4">
             <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Broadcast History</h4>
             <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{broadcasts.length} Messages</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {broadcasts.length === 0 ? (
              <div className="md:col-span-2 text-center py-24 bg-gray-50/30 dark:bg-violet-950/5 rounded-[32px] border-2 border-dashed border-gray-100 dark:border-violet-500/10">
                 <Send className="w-12 h-12 text-gray-200 dark:text-violet-500/20 mx-auto mb-4" />
                 <p className="text-sm font-bold text-gray-400 italic">No broadcast activity yet</p>
              </div>
            ) : (
              broadcasts.map((b: any) => (
                <div key={b.id} className="group bg-white dark:bg-violet-900/10 border border-gray-100 dark:border-violet-500/15 rounded-3xl p-5 hover:border-primary/40 transition-all shadow-sm ">
                   <div className="flex items-start gap-4">
                      <div className={`p-4 rounded-2xl shrink-0 ${b.status === 'sent' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/20'}`}>
                         {b.broadcast_type === 'image' ? <ImageIcon className="w-6 h-6" /> : b.broadcast_type === 'survey' ? <ClipboardList className="w-6 h-6" /> : <Bell className="w-6 h-6" />}
                      </div>
                      <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-base font-black text-gray-900 dark:text-white truncate uppercase tracking-tight">{b.title}</h4>
                            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${b.status === 'sent' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>{b.status}</span>
                         </div>
                         <p className="text-xs text-gray-400 italic line-clamp-2 mb-4">{b.message}</p>
                         <div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-violet-500/5">
                            <div className="flex gap-4">
                               <div className="flex flex-col">
                                  <span className="text-[9px] font-bold text-gray-400 uppercase">Target</span>
                                  <span className="text-[10px] font-black text-gray-700 dark:text-violet-200 capitalize">{b.target_type}</span>
                               </div>
                               <div className="flex flex-col">
                                  <span className="text-[9px] font-bold text-gray-400 uppercase">Reach</span>
                                  <span className="text-[10px] font-black text-gray-700 dark:text-violet-200">~{b.total_recipients}</span>
                               </div>
                            </div>
                            <div className="text-right">
                               <span className="text-[11px] font-black text-gray-400">{new Date(b.created_at).toLocaleDateString()}</span>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
