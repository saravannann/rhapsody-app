"use client";

import { useState, useEffect } from "react";
import { Lock, ShieldCheck, Loader2, CheckCircle2, AlertTriangle, KeyRound, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { profilePhoneKeysFromSession } from "@/utils/phone";

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
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
      const keys = profilePhoneKeysFromSession(userPhone);
      if (keys.length === 0) {
         setError("Session error: Please log out and log back in to verify your identity.");
         setLoading(false);
         return;
      }

      // 1. Verify current password (match legacy 10-digit or +91 rows)
      const { data: verifyRows, error: fetchError } = await supabase
        .from('profiles')
        .select('password, phone')
        .in('phone', keys)
        .eq('password', passwords.current);

      const user = verifyRows?.[0];

      if (fetchError || !user) {
         setError("Incorrect current password.");
         setLoading(false);
         return;
      }

      // 2. Update using the exact phone value stored in the row
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({ password: passwords.new })
        .eq('phone', user.phone)
        .select();

      if (updateError) {
         setError(
            `Could not save new password: ${updateError.message}${updateError.code ? ` (${updateError.code})` : ""}. ` +
               "If you use Row Level Security on `profiles`, run the SQL in `supabase/migrations/profiles_rls_policies.sql` in the Supabase SQL editor."
         );
         setLoading(false);
         return;
      }

      if (!data || data.length === 0) {
         setError(
            "No profile row was updated. Check that your phone in this session matches your account, or ask an admin to verify your `profiles` row."
         );
         setLoading(false);
         return;
      }

      setSuccess(true);
      setPasswords({ current: "", new: "", confirm: "" });
      if (user.phone && String(user.phone).startsWith("+91")) {
        localStorage.setItem("rhapsody_phone", String(user.phone));
      }
      
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Something went wrong while updating your password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-secondary to-primary">Security Settings</h1>
        <p className="text-gray-500 dark:text-violet-300/75 mt-1 text-sm font-medium">Manage your account credentials and security preferences.</p>
      </div>

      <div className="bg-white dark:bg-[var(--card-bg)] rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_40px_rgba(46,16,80,0.35)] border border-pink-50 dark:border-violet-500/20 overflow-hidden">
         <div className="p-8 border-b border-gray-50 dark:border-violet-500/15 flex items-center gap-4 bg-gray-50/30 dark:bg-violet-950/35">
            <div className="p-3 bg-white dark:bg-violet-950/50 rounded-2xl shadow-sm border border-pink-100 dark:border-violet-500/25 text-primary">
               <Lock className="w-6 h-6" />
            </div>
            <div>
               <h2 className="text-xl font-bold text-gray-900 dark:text-violet-100">Change Password</h2>
               <p className="text-xs font-bold text-gray-400 dark:text-violet-400/65 uppercase tracking-widest mt-1">Updates your login credentials</p>
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
                     <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
                     <input 
                        type={showCurrentPassword ? "text" : "password"} 
                        required 
                        value={passwords.current}
                        onChange={e => setPasswords({...passwords, current: e.target.value})}
                        placeholder="••••••••" 
                        className="w-full bg-[#f8fafc] dark:bg-violet-950/35 border border-gray-100 dark:border-violet-500/20 rounded-2xl pl-12 pr-12 py-3.5 text-sm font-bold text-gray-900 dark:text-violet-100 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" 
                     />
                     <button
                        type="button"
                        onClick={() => setShowCurrentPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100/80 transition-colors"
                        aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                        tabIndex={-1}
                     >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                     </button>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">New Password</label>
                     <div className="relative">
                        <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
                        <input 
                           type={showNewPassword ? "text" : "password"} 
                           required 
                           value={passwords.new}
                           onChange={e => setPasswords({...passwords, new: e.target.value})}
                           placeholder="At least 4 chars" 
                           className="w-full bg-[#fdfaff] dark:bg-violet-950/30 border border-gray-100 dark:border-violet-500/20 rounded-2xl pl-12 pr-12 py-3.5 text-sm font-bold text-gray-900 dark:text-violet-100 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" 
                        />
                        <button
                           type="button"
                           onClick={() => setShowNewPassword((v) => !v)}
                           className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100/80 transition-colors"
                           aria-label={showNewPassword ? "Hide password" : "Show password"}
                           tabIndex={-1}
                        >
                           {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                     </div>
                  </div>
                  <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Confirm New Password</label>
                     <div className="relative">
                        <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none z-10" />
                        <input 
                           type={showConfirmPassword ? "text" : "password"} 
                           required 
                           value={passwords.confirm}
                           onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                           placeholder="Confirm new password" 
                           className="w-full bg-[#fdfaff] dark:bg-violet-950/30 border border-gray-100 dark:border-violet-500/20 rounded-2xl pl-12 pr-12 py-3.5 text-sm font-bold text-gray-900 dark:text-violet-100 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" 
                        />
                        <button
                           type="button"
                           onClick={() => setShowConfirmPassword((v) => !v)}
                           className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100/80 transition-colors"
                           aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                           tabIndex={-1}
                        >
                           {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
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
