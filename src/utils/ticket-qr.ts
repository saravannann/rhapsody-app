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

export function shortTicketRef(ticketId: string): string {
  return String(ticketId).replace(/-/g, "").slice(0, 8).toUpperCase();
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
