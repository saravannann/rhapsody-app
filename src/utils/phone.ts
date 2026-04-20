/** Supported country codes */
export const SUPPORTED_COUNTRY_CODES = ["+91", "+1"];
export const INDIA_CC = "+91";
export const US_CA_CC = "+1";

/**
 * Strips all non-digit characters from a string.
 */
export function stripToDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Parses a raw phone string (e.g. from Contact Picker) into a supported country code and national digits.
 * If no supported country code is found, it defaults to India (+91).
 */
export function parsePhoneFromContact(raw: string): { countryCode: string; nationalDigits: string } {
  const d = stripToDigits(raw);
  
  // Check for US/CA (+1)
  // US numbers are 10 digits. If it starts with 1 and is 11 digits, it's +1.
  if (d.startsWith("1") && d.length === 11) {
    return { countryCode: US_CA_CC, nationalDigits: d.slice(1) };
  }
  
  // Check for India (+91)
  // Indian numbers are 10 digits. If it starts with 91 and is 12 digits, it's +91.
  if (d.startsWith("91") && d.length === 12) {
    return { countryCode: INDIA_CC, nationalDigits: d.slice(2) };
  }

  // Default behavior for 10 digits with no country code prefix
  // or any other format: strip and default to India prefix
  let national = d;
  if (d.startsWith("0")) {
    national = d.slice(1);
  }
  
  // If it's already 12 digits starting with 91, it was handled above.
  // If it's 10 digits starting with something else, we assume it's Indian national digits.
  return { countryCode: INDIA_CC, nationalDigits: national.slice(0, 10) };
}

/**
 * Digits typed in the national field. Strips non-digits; if the user
 * pasted a full number including the prefix, it tries to strip it.
 */
export function nationalDigitsForIndia(raw: string): string {
  let d = stripToDigits(raw);
  if (d.startsWith("0")) d = d.slice(1);
  if (d.startsWith("91") && d.length > 2) d = d.slice(2);
  return d.slice(0, 10);
}

/**
 * Digits typed in US/CA field.
 */
export function nationalDigitsForUS(raw: string): string {
  let d = stripToDigits(raw);
  if (d.startsWith("1") && d.length > 1) d = d.slice(1);
  return d.slice(0, 10);
}

/** Canonical storage: cc + national digits. */
export function toE164(countryCode: string, nationalDigits: string): string {
  const d = stripToDigits(nationalDigits);
  if (d.length === 0) {
    throw new Error("Phone number is required");
  }
  return `${countryCode}${d}`;
}

/** @deprecated use toE164 — kept for backwards compatibility */
export function toIndianE164(nationalDigits: string): string {
  return toE164(INDIA_CC, nationalDigitsForIndia(nationalDigits));
}

/** True when there is at least one national digit. */
export function hasNationalDigits(raw: string): boolean {
  return stripToDigits(raw).length > 0;
}

/** @deprecated use hasNationalDigits */
export function hasIndianNationalDigits(raw: string): boolean {
  return hasNationalDigits(raw);
}

/** Login / legacy lookup variants */
export function phoneLookupVariants(cc: string, nationalDigits: string): string[] {
  const n = stripToDigits(nationalDigits);
  if (!n) return [];
  const full = `${cc}${n}`;
  return Array.from(new Set([full, n]));
}

/** @deprecated use phoneLookupVariants — kept for backwards compatibility */
export function indianPhoneLookupVariants(nationalDigits: string): string[] {
  return phoneLookupVariants(INDIA_CC, nationalDigits);
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
