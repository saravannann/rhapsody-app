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
