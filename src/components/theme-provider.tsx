"use client";

import { useEffect } from "react";
import { applyThemeClass, readStoredPreference, resolveTheme } from "@/lib/theme";

function syncDomTheme() {
  const pref = readStoredPreference() ?? "auto";
  applyThemeClass(resolveTheme(pref));
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    syncDomTheme();

    const onStorage = (e: StorageEvent) => {
      if (e.key === "rhapsody_theme_pref") syncDomTheme();
    };
    window.addEventListener("storage", onStorage);

    const darkMq = window.matchMedia("(prefers-color-scheme: dark)");
    const lightMq = window.matchMedia("(prefers-color-scheme: light)");
    const onScheme = () => {
      const pref = readStoredPreference() ?? "auto";
      if (pref === "auto") syncDomTheme();
    };
    darkMq.addEventListener("change", onScheme);
    lightMq.addEventListener("change", onScheme);

    // Re-evaluate auto mode on tab focus (clock may have crossed boundary)
    const onFocus = () => {
      const pref = readStoredPreference() ?? "auto";
      if (pref === "auto") syncDomTheme();
    };
    window.addEventListener("focus", onFocus);

    const minuteId = window.setInterval(() => {
      const pref = readStoredPreference() ?? "auto";
      if (pref === "auto") syncDomTheme();
    }, 60_000);

    return () => {
      window.removeEventListener("storage", onStorage);
      darkMq.removeEventListener("change", onScheme);
      lightMq.removeEventListener("change", onScheme);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(minuteId);
    };
  }, []);

  return <>{children}</>;
}
