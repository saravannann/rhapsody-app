"use client";

import { useCallback, useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  applyThemeClass,
  persistPreference,
  readStoredPreference,
  resolveTheme,
  type ThemePreference,
} from "@/lib/theme";

const ORDER: ThemePreference[] = ["auto", "light", "dark"];

function nextPreference(current: ThemePreference): ThemePreference {
  const i = ORDER.indexOf(current);
  return ORDER[(i + 1) % ORDER.length];
}

function labelFor(pref: ThemePreference): string {
  if (pref === "light") return "Light theme";
  if (pref === "dark") return "Dark theme";
  return "Auto (system & schedule)";
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [pref, setPref] = useState<ThemePreference>("auto");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPref(readStoredPreference() ?? "auto");
  }, []);

  const cycle = useCallback(() => {
    const current = readStoredPreference() ?? "auto";
    const next = nextPreference(current);
    persistPreference(next);
    setPref(next);
    applyThemeClass(resolveTheme(next));
  }, []);

  const Icon = pref === "light" ? Sun : pref === "dark" ? Moon : Monitor;

  return (
    <button
      type="button"
      onClick={cycle}
      className={`inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl border border-[var(--border-subtle)] bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm transition-colors hover:bg-[var(--muted-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${className}`}
      aria-label={`Theme: ${labelFor(pref)}. Click to change.`}
      title={labelFor(pref)}
    >
      <Icon className="w-5 h-5 shrink-0" aria-hidden />
      <span className="sr-only">{labelFor(pref)}</span>
    </button>
  );
}
