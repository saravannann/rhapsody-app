/**
 * Payload encoded in the check-in QR (single line, easy to parse at the door).
 * Format: rhapsody|version|ticket_uuid|quantity|type_id
 */
export function buildTicketQrPayload(params: {
  ticketId: string;
  quantity: number;
  typeId: string;
}): string {
  const q = Math.max(1, Math.floor(params.quantity));
  return `rhapsody|1|${params.ticketId}|${q}|${params.typeId}`;
}

/**
 * Formats the ticket ID into a human-friendly Booking ID.
 * Format: R-SSSS-BBBBBBBB
 * R = Constant
 * SSSS = Running sequence (padded to 4 digits)
 * BBBBBBBB = First 8 chars of UUID
 */
export function shortTicketRef(ticketId: string, sequence?: number | string | null): string {
  const base = String(ticketId).replace(/-/g, "").slice(0, 8).toUpperCase();
  if (sequence === undefined || sequence === null) {
    return `R-XXXX-${base}`;
  }
  const s = String(sequence).padStart(4, "0");
  return `R-${s}-${base}`;
}

export type ParsedTicketQr = {
  version: string;
  ticketId: string;
  quantity: number;
  typeId: string;
};

/** Parses payload from `buildTicketQrPayload` (and QR scans). */
export function parseTicketQrPayload(raw: string): ParsedTicketQr | null {
  const s = raw.trim();
  const parts = s.split("|");
  if (parts[0] !== "rhapsody" || parts.length < 5) return null;
  const version = parts[1];
  const ticketId = parts[2];
  const quantity = parseInt(parts[3], 10);
  const typeId = parts[4];
  if (!ticketId || !Number.isFinite(quantity) || quantity < 1 || !typeId) return null;
  return { version, ticketId, quantity, typeId };
}
