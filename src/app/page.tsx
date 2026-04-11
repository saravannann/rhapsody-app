"use client";

import Link from "next/link";
import { Music, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  // Auto-redirect if already logged in
  useEffect(() => {
    const user = localStorage.getItem('rhapsody_user');
    const role = localStorage.getItem('rhapsody_role');
    if (user && role) {
      if (role === 'admin') {
        router.replace('/dashboard');
      } else {
        router.replace('/organiser-dashboard');
      }
    }
  }, [router]);

  const handleLogin = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Fetch the roles dynamically from your Supabase profiles table
      // Validate both phone AND password from the database
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('name, roles, password')
        .eq('phone', phone)
        .eq('password', password)
        .single();

      if (profile && profile.roles) {
        localStorage.setItem('rhapsody_user', profile.name || 'User');
        localStorage.setItem('rhapsody_phone', phone); // Added phone storage
        localStorage.setItem('rhapsody_role', profile.roles.includes('admin') ? 'admin' : 'organiser');
        
        if (profile.roles.includes('admin')) {
           router.push('/dashboard'); 
        } else if (profile.roles.includes('organiser')) {
           router.push('/organiser-dashboard');
        } else {
           // We can mock a screen here or route to a dedicated front desk page
           alert('Logging into Front Desk Portal...');
           router.push('/organiser-dashboard'); // Placeholder for front desk
        }
      } else {
         alert('Invalid phone number or password. Please check your credentials and try again.');
         setIsLoading(false);
      }
    } catch {
       setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center relative p-4 bg-[var(--app-bg)] transition-colors">
      <div className="fixed top-3 right-3 z-20 sm:top-4 sm:right-4">
        <ThemeToggle />
      </div>
      {/* Background Soft Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-pink-100/40 blur-[100px] dark:bg-pink-900/25" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-200/40 blur-[100px] dark:bg-purple-900/20" />
      </div>

      <div className="z-10 flex flex-col items-center w-full max-w-[440px]">
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-6">
          <div className="mb-4">
            <img src="/logo.png" alt="Rhapsody Logo" className="h-24 w-auto object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--foreground)] mb-1">Rhapsody</h1>
          <p className="text-secondary font-semibold">Ticketing & Event Management</p>
          <p className="text-gray-400 text-sm mt-1">Thenmozhi Memorial Trust</p>
        </div>

        {/* Login Card */}
        <div className="w-full bg-[var(--card-bg)] border border-[var(--border-subtle)] rounded-2xl p-6 sm:p-8 shadow-[0_4px_30px_rgba(236,72,153,0.06)] dark:shadow-[0_4px_30px_rgba(0,0,0,0.3)] transition-colors">
          <h2 className="text-xl font-bold text-[var(--foreground)]">Welcome Back</h2>
          <p className="text-[var(--muted)] text-sm mt-1 mb-6">
            Enter your credentials to access your account
          </p>

          <form className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[var(--foreground)] mb-1.5">
                Phone Number
              </label>
              <input
                type="text"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full min-h-[44px] bg-[var(--muted-bg)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-sm font-medium text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[var(--foreground)] mb-1.5">
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full min-h-[44px] bg-[var(--muted-bg)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-sm font-medium text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono"
              />
            </div>

            <div className="flex mt-2 mb-6">
              <Link
                href="#"
                className="text-sm font-semibold text-secondary hover:text-primary transition-colors"
              >
                Forgot Password?
              </Link>
            </div>
            
            <button
              onClick={handleLogin}
              disabled={isLoading || (!phone && !password)}
              className="w-full flex items-center justify-center bg-gradient-to-r from-primary to-secondary hover:from-primary-dark hover:to-primary text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-pink-500/30 transition-all active:scale-[0.98] disabled:opacity-80 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Login"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
