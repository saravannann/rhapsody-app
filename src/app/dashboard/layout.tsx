"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { User, LogOut, Settings, ChevronDown, LayoutDashboard, Users, Ticket, BarChart2, Bell, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUserName(localStorage.getItem('rhapsody_user') || 'Admin');
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('rhapsody_user');
    localStorage.removeItem('rhapsody_role');
    localStorage.removeItem('rhapsody_phone');
    router.replace('/');
  };

  const navLinks = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "User Management", href: "/dashboard/organisers", icon: Users },
    { name: "Sell Tickets", href: "/dashboard/sell", icon: Ticket },
    { name: "Sales Report", href: "/dashboard/sales", icon: BarChart2 },
    { name: "Notifications", href: "#", icon: Bell, disabled: true },
  ];

  const renderNavLink = (link: (typeof navLinks)[0], opts?: { onNavigate?: () => void }) => {
    const isActive = pathname === link.href;
    const Icon = link.icon;
    return (
      <Link
        key={link.name}
        href={link.disabled ? "#" : link.href}
        className={`flex items-center gap-3 px-3 py-3 md:py-2 rounded-xl md:rounded-lg text-sm font-semibold transition-all ${
          link.disabled
            ? "text-gray-300 cursor-not-allowed opacity-70"
            : isActive
              ? "bg-pink-50 text-primary dark:bg-primary/20 dark:text-pink-300 dark:shadow-[inset_0_0_0_1px_rgba(236,72,153,0.25)]"
              : "text-gray-700 hover:bg-gray-50 dark:text-violet-200/95 dark:hover:bg-violet-500/10 md:text-gray-500 md:dark:text-purple-300/75 md:hover:text-gray-900 md:dark:hover:text-violet-50"
        }`}
        onClick={(e) => {
          if (link.disabled) e.preventDefault();
          else opts?.onNavigate?.();
        }}
      >
        <Icon className="w-5 h-5 md:w-4 md:h-4 shrink-0" />
        <span>{link.name}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--app-bg)] flex flex-col transition-colors duration-200">
      <header className="bg-[var(--card-bg)] border-b border-[var(--border-subtle)] shadow-[var(--shadow-header)] sticky top-0 z-40 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center h-14 sm:h-16 gap-2 sm:gap-6">

            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl text-gray-700 hover:bg-[var(--muted-bg)] border border-transparent hover:border-[var(--border-subtle)] dark:text-violet-200 transition-colors"
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-admin-nav"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-2 sm:gap-2.5 shrink-0 min-w-0 max-w-[min(100%,22rem)]">
              <div className="w-10 h-10 sm:w-11 sm:h-11 overflow-hidden flex items-center justify-center shrink-0">
                <img src="/logo.png" alt="" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col leading-tight min-w-0">
                <span className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary truncate">Rhapsody</span>
                <span className="text-[9px] sm:text-[10px] text-accent font-bold uppercase tracking-wider sm:tracking-widest whitespace-normal dark:text-amber-400/90">Admin Portal</span>
              </div>
            </Link>

            {/* Divider — desktop only */}
            <div className="hidden md:block h-6 w-px bg-[var(--border-subtle)] shrink-0" />

            {/* Main Nav — desktop */}
            <nav className="hidden md:flex items-center gap-1 flex-1 min-w-0 overflow-x-auto scrollbar-hide">
              {navLinks.map((link) => renderNavLink(link))}
            </nav>

            <div className="flex-1 md:hidden" aria-hidden />

            <div className="flex items-center gap-1.5 shrink-0">
              <ThemeToggle />
            {/* User Dropdown */}
            <div className="relative shrink-0" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(prev => !prev)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border-subtle)] hover:border-pink-300/50 hover:bg-[var(--muted-bg)] transition-all"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-sm">
                  <User className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm font-bold text-[var(--foreground)] hidden md:block">{userName}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 dark:text-purple-400/80 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-[var(--card-bg)] rounded-2xl shadow-xl border border-[var(--border-subtle)] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
                    <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest">Signed in as</p>
                    <p className="text-sm font-bold text-[var(--foreground)] mt-0.5 truncate">{userName}</p>
                  </div>
                  <div className="p-1.5">
                    <Link
                      href="/dashboard/settings"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold text-[var(--foreground)]/80 hover:bg-[var(--muted-bg)] rounded-xl transition-colors"
                    >
                      <Settings className="w-4 h-4" /> Settings
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
            </div>

          </div>
        </div>
      </header>

      {/* Mobile nav drawer */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="mobile-nav-title">
          <button
            type="button"
            className="absolute inset-0 bg-violet-950/45 backdrop-blur-[2px]"
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
          />
          <div
            id="mobile-admin-nav"
            className="absolute top-0 left-0 bottom-0 w-[min(100%,20rem)] bg-[var(--card-bg)] shadow-2xl flex flex-col border-r border-[var(--border-subtle)] animate-in slide-in-from-left duration-200"
          >
            <div className="flex items-center justify-between px-4 h-14 border-b border-[var(--border-subtle)] bg-[var(--muted-bg)]">
              <p id="mobile-nav-title" className="text-sm font-bold text-[var(--foreground)]">
                Menu
              </p>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="flex items-center justify-center w-10 h-10 rounded-xl text-[var(--foreground)] hover:bg-[var(--card-bg)] border border-transparent hover:border-[var(--border-subtle)]"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 flex flex-col gap-0.5" aria-label="Main navigation">
              {navLinks.map((link) => renderNavLink(link, { onNavigate: () => setMobileNavOpen(false) }))}
            </nav>
            <div className="p-4 border-t border-[var(--border-subtle)] text-xs text-[var(--muted)]">
              Signed in as <span className="font-semibold text-[var(--foreground)]">{userName}</span>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {children}
      </main>
    </div>
  );
}
