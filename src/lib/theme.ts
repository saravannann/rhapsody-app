/**
 * Theme resolution for Rhapsody.
 *
 * Priority when preference is "auto":
 * 1. prefers-color-scheme: dark → dark
 * 2. prefers-color-scheme: light → light
 * 3. Time-based: dark 19:00–06:00, light 06:00–19:00
 *
 * Stored preference (localStorage) overrides everything when "light" or "dark".
 */

export const THEME_STORAGE_KEY = "rhapsody_theme_pref";

export type ThemePreference = "light" | "dark" | "auto";

export type ResolvedTheme = "light" | "dark";

/** Dark: 7 PM (19:00) inclusive … 6 AM exclusive → night window [19, 24) ∪ [0, 6) */
export function getTimeBasedTheme(date = new Date()): ResolvedTheme {
  const hour = date.getHours();
  if (hour >= 19 || hour < 6) return "dark";
  return "light";
}

export function readStoredPreference(): ThemePreference | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "auto") return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export function resolveTheme(pref: ThemePreference | null): ResolvedTheme {
  if (pref === "light") return "light";
  if (pref === "dark") return "dark";
  // auto or unset
  if (typeof window === "undefined") return "light";
  const darkMq = window.matchMedia("(prefers-color-scheme: dark)");
  const lightMq = window.matchMedia("(prefers-color-scheme: light)");
  if (darkMq.matches) return "dark";
  if (lightMq.matches) return "light";
  return getTimeBasedTheme();
}

export function applyThemeClass(theme: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme === "dark" ? "dark" : "light";
}

export function persistPreference(pref: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    /* ignore */
  }
}
