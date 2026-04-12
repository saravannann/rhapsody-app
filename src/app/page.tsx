"use client";

import Link from "next/link";
import Image from "next/image";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { IndianMobileInput } from "@/components/indian-mobile-input";
import {
  hasIndianNationalDigits,
  indianPhoneLookupVariants,
  nationalDigitsForIndia,
  toIndianE164,
} from "@/utils/phone";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  /** National digits after +91 */
  const [phoneDigits, setPhoneDigits] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Auto-redirect if already logged in
  useEffect(() => {
    const user = localStorage.getItem('rhapsody_user');
    const role = localStorage.getItem('rhapsody_role');
    if (user && role) {
      if (role === "admin") {
        router.replace("/dashboard");
      } else if (role === "front_desk") {
        router.replace("/frontdesk");
      } else {
        router.replace("/organiser-dashboard");
      }
    }
  }, [router]);

  const handleLogin = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!hasIndianNationalDigits(phoneDigits)) {
        alert("Enter your phone number.");
        setIsLoading(false);
        return;
      }

      const keys = indianPhoneLookupVariants(phoneDigits);
      const { data: rows } = await supabase
        .from('profiles')
        .select('name, roles, password, phone')
        .in('phone', keys)
        .eq('password', password);

      const profile = rows?.[0];

      if (profile && profile.roles) {
        const storedPhone =
          profile.phone && String(profile.phone).startsWith("+91")
            ? String(profile.phone)
            : toIndianE164(nationalDigitsForIndia(phoneDigits));
        localStorage.setItem('rhapsody_user', profile.name || 'User');
        localStorage.setItem('rhapsody_phone', storedPhone);
        const pr = profile as { roles?: unknown; role?: unknown };
        const roles: string[] = Array.isArray(pr.roles)
          ? (pr.roles as string[])
          : typeof pr.role === "string"
            ? [pr.role]
            : [];
        const resolvedRole = roles.includes('admin')
          ? 'admin'
          : roles.includes('organiser')
            ? 'organiser'
            : roles.includes('front_desk')
              ? 'front_desk'
              : 'organiser';
        localStorage.setItem('rhapsody_role', resolvedRole);
        localStorage.setItem('rhapsody_all_roles', JSON.stringify(roles));

        if (roles.includes('admin')) {
          router.push('/dashboard');
        } else if (roles.includes('organiser')) {
          router.push('/organiser-dashboard');
        } else if (roles.includes('front_desk')) {
          router.push('/frontdesk');
        } else {
          router.push('/organiser-dashboard');
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
    <div className="flex min-h-screen flex-col items-center justify-center relative p-4 bg-white text-slate-900">
      <div className="fixed top-3 right-3 z-20 sm:top-4 sm:right-4">
        <ThemeToggle />
      </div>

      <div className="z-10 flex w-full max-w-xl flex-col items-center px-3 sm:px-4">
        {/* Logo — two copy lines only: tagline + initiative (wider column avoids awkward wrap) */}
        <div className="mb-6 flex w-full flex-col items-center">
          <Image src="/logo.png" alt="Rhapsody Logo" width={144} height={144} className="h-32 sm:h-36 w-auto object-contain block" priority />
          <p className="mt-3 text-center text-sm font-semibold leading-snug text-slate-700 text-balance sm:text-base">
            Chennai&apos;s First Cultural Extravaganza to Raise Funds for Cancer
          </p>
          <p className="mt-2 text-center text-xs font-medium leading-snug text-slate-500 sm:text-sm">
            An Initiative by Thenmozhi Memorial Trust
          </p>
        </div>

        {/* Login Card */}
        <div className="w-full max-w-[440px] bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-[0_4px_24px_rgba(15,23,42,0.06)]">
          <h2 className="text-xl font-bold text-slate-900 mb-6 text-center">Join to make a difference</h2>

          <form className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                Phone Number
              </label>
              <IndianMobileInput
                value={phoneDigits}
                onChange={setPhoneDigits}
                className="border-gray-200 bg-gray-50"
                prefixClassName="bg-gray-100 border-gray-200 text-slate-600"
                inputClassName="!text-slate-900 !placeholder:text-slate-400 dark:!text-slate-900 dark:!placeholder:text-slate-400"
              />
              <p className="text-slate-400 text-xs mt-1.5">India (+91)</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full min-h-[44px] bg-gray-50 border border-gray-200 rounded-xl pl-4 pr-11 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100/80 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
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
              disabled={isLoading || !hasIndianNationalDigits(phoneDigits) || !password}
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
