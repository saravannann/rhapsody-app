"use client";

import { useState, useEffect } from "react";
import { Lock, ShieldCheck, Loader2, CheckCircle2, AlertTriangle, KeyRound } from "lucide-react";
import { supabase } from "@/utils/supabase";

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: ""
  });

  const [userPhone, setUserPhone] = useState("");

  useEffect(() => {
    setUserPhone(localStorage.getItem('rhapsody_phone') || "");
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
       setError("New passwords do not match!");
       return;
    }
    if (passwords.new.length < 4) {
       setError("Password must be at least 4 characters.");
       return;
    }

    setLoading(true);
    setError("");
    setSuccess(false);

    if (!userPhone) {
       setError("Session error: Please log out and log back in to verify your identity.");
       setLoading(false);
       return;
    }

    try {
      // 1. Verify current password
      const { data: user, error: fetchError } = await supabase
        .from('profiles')
        .select('password')
        .eq('phone', userPhone)
        .eq('password', passwords.current)
        .single();

      if (fetchError || !user) {
         setError("Incorrect current password.");
         setLoading(false);
         return;
      }

      // 2. Update to new password
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({ password: passwords.new })
        .eq('phone', userPhone)
        .select();

      if (updateError || !data || data.length === 0) {
         throw new Error("Update failed or user not found");
      }

      setSuccess(true);
      setPasswords({ current: "", new: "", confirm: "" });
      
    } catch (err: any) {
      console.error(err);
      setError(`Update failed: ${err.message || "Unknown error"}. Check if RLS is enabled on your 'profiles' table.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-secondary to-primary">Security Settings</h1>
        <p className="text-gray-500 mt-1 text-sm font-medium">Manage your account credentials and security preferences.</p>
      </div>

      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-pink-50 overflow-hidden">
         <div className="p-8 border-b border-gray-50 flex items-center gap-4 bg-gray-50/30">
            <div className="p-3 bg-white rounded-2xl shadow-sm border border-pink-100 text-primary">
               <Lock className="w-6 h-6" />
            </div>
            <div>
               <h2 className="text-xl font-bold text-gray-900">Change Password</h2>
               <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Updates your login credentials</p>
            </div>
         </div>

         <form onSubmit={handleUpdatePassword} className="p-8 space-y-6">
            
            {error && (
               <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-bold flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5" /> {error}
               </div>
            )}

            {success && (
               <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-2xl text-sm font-bold flex items-center gap-3 animate-in zoom-in-95">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" /> Password updated successfully!
               </div>
            )}

            <div className="space-y-4">
               <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Current Password</label>
                  <div className="relative">
                     <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                     <input 
                        type="password" 
                        required 
                        value={passwords.current}
                        onChange={e => setPasswords({...passwords, current: e.target.value})}
                        placeholder="••••••••" 
                        className="w-full bg-[#f8fafc] border border-gray-100 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" 
                     />
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">New Password</label>
                     <div className="relative">
                        <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                           type="password" 
                           required 
                           value={passwords.new}
                           onChange={e => setPasswords({...passwords, new: e.target.value})}
                           placeholder="At least 4 chars" 
                           className="w-full bg-[#fdfaff] border border-gray-100 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" 
                        />
                     </div>
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Confirm New Password</label>
                     <div className="relative">
                        <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                           type="password" 
                           required 
                           value={passwords.confirm}
                           onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                           placeholder="Confirm new password" 
                           className="w-full bg-[#fdfaff] border border-gray-100 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" 
                        />
                     </div>
                  </div>
               </div>
            </div>

            <div className="pt-6">
               <button 
                  type="submit" 
                  disabled={loading || !passwords.current || !passwords.new || !passwords.confirm}
                  className="w-full bg-gradient-to-r from-primary to-secondary text-white font-bold py-4 rounded-2xl shadow-lg shadow-pink-500/20 hover:opacity-95 transition-all active:scale-[0.98] disabled:opacity-50 flex justify-center items-center gap-3"
               >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                     <>
                        <ShieldCheck className="w-5 h-5" />
                        Update Account Security
                     </>
                  )}
               </button>
            </div>

         </form>
      </div>

      <div className="bg-amber-50 rounded-3xl border border-amber-100 p-6 flex gap-4">
         <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0" />
         <div>
            <h4 className="text-sm font-bold text-amber-900">Security Notice</h4>
            <p className="text-xs font-medium text-amber-800/80 mt-1 leading-relaxed">
               Changing your password will not log you out of your current session, but you will need to use your new credentials for all future logins across all devices.
            </p>
         </div>
      </div>

    </div>
  );
}
