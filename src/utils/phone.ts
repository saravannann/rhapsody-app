/** India country code for display and canonical storage */
export const INDIA_CC = "+91";

const MAX_NATIONAL_DIGITS = 15;

/**
 * Digits typed in the national field (after +91). Strips non-digits; if the user
 * pasted a full number including 91, drops the leading country code once.
 */
export function nationalDigitsForIndia(raw: string): string {
  let d = raw.replace(/\D/g, "");
  // If user included 0 prefix (e.g. 09876...), strip it
  if (d.startsWith("0")) {
    d = d.slice(1);
  }
  // Only strip 91 if it's likely a country code prefix (i.e. we have more than 10 digits)
  if (d.startsWith("91") && d.length > 10) {
    d = d.slice(2);
  }
  return d.slice(0, 10); // Indian mobile numbers are 10 digits
}

/** @deprecated use nationalDigitsForIndia — kept for any stray imports */
export function normalizeIndianMobileDigits(raw: string): string {
  return nationalDigitsForIndia(raw);
}

/** Canonical storage: +91 + national digits (any length ≥ 1). */
export function toIndianE164(nationalDigits: string): string {
  const d = nationalDigitsForIndia(nationalDigits);
  if (d.length === 0) {
    throw new Error("Phone number is required");
  }
  return `${INDIA_CC}${d}`;
}

/** True when there is at least one national digit. */
export function hasIndianNationalDigits(raw: string): boolean {
  return nationalDigitsForIndia(raw).length > 0;
}

/** Login / legacy lookup: rows may store +91… or national digits only */
export function indianPhoneLookupVariants(nationalDigits: string): string[] {
  const n = nationalDigitsForIndia(nationalDigits);
  if (!n) return [];
  const full = `${INDIA_CC}${n}`;
  const set = new Set<string>([full, n]);
  return Array.from(set);
}

/** Session localStorage may be +91…, digits only, or legacy — keys for .in('phone', …) */
export function profilePhoneKeysFromSession(stored: string): string[] {
  const s = stored.trim();
  if (!s) return [];
  const n = nationalDigitsForIndia(s);
  if (n.length > 0) {
    const full = `${INDIA_CC}${n}`;
    return Array.from(new Set([s, full, n]));
  }
  return [s];
}
