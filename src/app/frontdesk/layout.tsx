"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ScanLine, LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function FrontdeskLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const role = localStorage.getItem("rhapsody_role");
    const user = localStorage.getItem("rhapsody_user");
    if (!role || !user) {
      router.replace("/");
      return;
    }
    if (role !== "front_desk") {
      if (role === "admin") router.replace("/dashboard");
      else router.replace("/organiser-dashboard");
      return;
    }
    setUserName(user);
    setReady(true);
  }, [router]);

  const handleSignOut = () => {
    localStorage.removeItem("rhapsody_user");
    localStorage.removeItem("rhapsody_role");
    localStorage.removeItem("rhapsody_phone");
    router.replace("/");
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)]">
        <p className="text-sm font-medium text-[var(--foreground)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg)] flex flex-col transition-colors duration-200">
      <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--card-bg)] shadow-[var(--shadow-header)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:h-16 sm:px-6">
          <Link href="/frontdesk" className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-secondary/15">
              <ScanLine className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-bold text-[var(--foreground)] sm:text-base">Rhapsody</p>
              <p className="truncate text-[10px] font-bold uppercase tracking-wider text-accent dark:text-amber-400/90">
                Front Desk · Check-in
              </p>
            </div>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <div className="hidden max-w-[120px] truncate text-right text-xs font-semibold text-[var(--foreground)] sm:block">
              {userName}
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3 py-2 text-xs font-bold text-[var(--foreground)] transition-colors hover:bg-[var(--muted-bg)]"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
