/** Digits only, country code included (e.g. 919876543210 for India). */
export function phoneToWhatsAppDigits(e164OrDigits: string): string {
  return e164OrDigits.replace(/\D/g, "");
}

/**
 * Opens a chat *with* this phone number (recipient = purchaser).
 * The device user sends the pre-filled message (typically the organiser taps Send).
 */
export function buildWhatsAppSendUrl(phoneDigits: string, message: string): string {
  const d = phoneToWhatsAppDigits(phoneDigits);
  if (!d) return "#";
  return `https://wa.me/${d}?text=${encodeURIComponent(message)}`;
}

export function buildTicketWhatsAppMessage(params: {
  purchaserName: string;
  passLabel: string;
  quantity: number;
  totalInr: number;
  ref: string;
  ticketPageUrl: string;
}): string {
  const name = params.purchaserName.trim() || "there";
  const total = params.totalInr.toLocaleString("en-IN");
  return [
    `Hello ${name},`,
    "",
    "Your Rhapsody ticket is confirmed.",
    `• ${params.passLabel} × ${params.quantity} (Ref ${params.ref})`,
    `• Total: ₹${total}`,
    "",
    "Your QR and full details for check-in:",
    params.ticketPageUrl,
    "",
    "Please save this link and show the QR at the venue entrance.",
    "",
    "— Rhapsody · Thenmozhi Memorial Trust",
  ].join("\n");
}
