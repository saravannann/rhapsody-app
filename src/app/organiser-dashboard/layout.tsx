"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { User, LogOut, Settings, ChevronDown, LayoutDashboard, Ticket, BarChart2, Menu, X } from "lucide-react";

export default function OrganiserLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUserName(localStorage.getItem('rhapsody_user') || 'Organiser');
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
    { name: "Dashboard", href: "/organiser-dashboard", icon: LayoutDashboard },
    { name: "Sell Tickets", href: "/organiser-dashboard/sell", icon: Ticket },
    { name: "Sales Report", href: "/organiser-dashboard/sales", icon: BarChart2 },
  ];

  const renderNavLink = (link: (typeof navLinks)[0], opts?: { onNavigate?: () => void }) => {
    const isActive = pathname === link.href;
    const Icon = link.icon;
    return (
      <Link
        key={link.name}
        href={link.href}
        className={`flex items-center gap-3 px-3 py-3 md:py-2 rounded-xl md:rounded-lg text-sm font-semibold transition-all ${
          isActive
            ? "bg-pink-50 text-primary"
            : "text-gray-700 md:text-gray-500 hover:bg-gray-50 md:hover:text-gray-900"
        }`}
        onClick={() => opts?.onNavigate?.()}
      >
        <Icon className="w-5 h-5 md:w-4 md:h-4 shrink-0" />
        <span>{link.name}</span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-[#faf5f9] flex flex-col">
      <header className="bg-white border-b border-pink-100 shadow-[0_1px_15px_rgba(236,72,153,0.03)] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center h-14 sm:h-16 gap-2 sm:gap-6">

            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl text-gray-700 hover:bg-pink-50 border border-transparent hover:border-pink-100 transition-colors"
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-organiser-nav"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Logo */}
            <Link href="/organiser-dashboard" className="flex items-center gap-2 sm:gap-2.5 shrink-0 min-w-0 flex-1 md:flex-initial">
              <div className="w-8 h-8 sm:w-9 sm:h-9 overflow-hidden flex items-center justify-center shrink-0">
                <img src="/logo.png" alt="" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col leading-none min-w-0">
                <span className="text-sm sm:text-base font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary truncate">Rhapsody</span>
                <span className="text-[8px] sm:text-[9px] text-accent font-bold uppercase tracking-widest truncate">Organiser Portal</span>
              </div>
            </Link>

            <div className="hidden md:block h-6 w-px bg-gray-100 shrink-0" />

            <nav className="hidden md:flex items-center gap-1 flex-1 min-w-0 overflow-x-auto scrollbar-hide">
              {navLinks.map((link) => renderNavLink(link))}
            </nav>

            <div className="flex-1 md:hidden" aria-hidden />

            {/* User Dropdown */}
            <div className="relative shrink-0" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(prev => !prev)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-100 hover:border-pink-200 hover:bg-pink-50/50 transition-all"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-sm">
                  <User className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm font-bold text-gray-700 hidden md:block">{userName}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-3 border-b border-gray-50">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Signed in as</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5 truncate">{userName}</p>
                  </div>
                  <div className="p-1.5">
                    <Link
                      href="/organiser-dashboard/settings"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-colors"
                    >
                      <Settings className="w-4 h-4" /> Settings
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="organiser-mobile-nav-title">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
          />
          <div
            id="mobile-organiser-nav"
            className="absolute top-0 left-0 bottom-0 w-[min(100%,20rem)] bg-white shadow-2xl flex flex-col border-r border-pink-100 animate-in slide-in-from-left duration-200"
          >
            <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100 bg-[#fdf8fc]">
              <p id="organiser-mobile-nav-title" className="text-sm font-bold text-gray-900">
                Menu
              </p>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="flex items-center justify-center w-10 h-10 rounded-xl text-gray-600 hover:bg-white border border-transparent hover:border-gray-200"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 flex flex-col gap-0.5" aria-label="Main navigation">
              {navLinks.map((link) => renderNavLink(link, { onNavigate: () => setMobileNavOpen(false) }))}
            </nav>
            <div className="p-4 border-t border-gray-100 text-xs text-gray-500">
              Signed in as <span className="font-semibold text-gray-700">{userName}</span>
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
