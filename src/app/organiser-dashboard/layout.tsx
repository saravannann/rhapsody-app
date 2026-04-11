"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Music, User } from "lucide-react";

export default function OrganiserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [userName, setUserName] = useState('');

  useEffect(() => {
    setUserName(localStorage.getItem('rhapsody_user') || 'Organiser');
  }, []);

  const navLinks = [
    { name: "Dashboard", href: "/organiser-dashboard" },
    { name: "Sell Tickets", href: "/organiser-dashboard/sell" },
    { name: "Sales Report", href: "/organiser-dashboard/sales" },
    { name: "Settings", href: "/organiser-dashboard/settings" },
  ];

  return (
    <div className="min-h-screen bg-[#faf5f9] flex flex-col">
      <header className="bg-white border-b border-pink-100 shadow-[0_1px_15px_rgba(236,72,153,0.03)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Logo area */}
            <div className="flex items-center gap-3 pr-8 border-r border-gray-100">
              <div className="w-10 h-10 overflow-hidden flex items-center justify-center">
                 <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary leading-tight">Rhapsody</span>
                <span className="text-[10px] text-accent font-bold uppercase tracking-wider leading-tight">Organiser Portal</span>
              </div>
            </div>

            {/* Main Nav */}
            <nav className="flex ml-4 md:ml-8 space-x-4 md:space-x-8 flex-1 overflow-x-auto scrollbar-hide">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-semibold transition-colors ${
                      isActive
                        ? "border-accent text-secondary"
                        : "border-transparent text-gray-500 hover:text-secondary hover:border-pink-200"
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </nav>

            {/* Profile Icon */}
            <div className="flex items-center gap-3">
              {userName && <span className="hidden md:block text-sm font-bold text-gray-700">Welcome, {userName}</span>}
              <button className="p-2 border border-pink-100 bg-pink-50 rounded-full text-primary hover:bg-pink-100 transition-colors shadow-sm">
                <User className="h-5 w-5" />
              </button>
            </div>
            
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
