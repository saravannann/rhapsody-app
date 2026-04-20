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

export function buildTicketTemplateData(params: {
  purchaserName: string;
  passLabel: string;
  quantity: number;
  totalInr: number;
  ref: string;
  ticketId: string;
}) {
  const name = params.purchaserName.trim() || "Guest";
  const isDonor = params.passLabel.toLowerCase().includes("donor");
  const templateName = isDonor ? "donor_ticket_v2" : "regular_ticket_v2";

  return {
    templateName,
    parameters: [
      { type: "text", text: name },
      { type: "text", text: params.passLabel },
      { type: "text", text: params.quantity.toString() },
      { type: "text", text: params.ref.toUpperCase() },
      { type: "text", text: params.totalInr.toLocaleString("en-IN") },
      { type: "text", text: params.ticketId }
    ]
  };
}

export function buildTicketWhatsAppMessage(params: {
  purchaserName: string;
  passLabel: string;
  quantity: number;
  totalInr: number;
  ref: string;
  ticketPageUrl: string;
}): string {
  const name = params.purchaserName.trim() || "Guest";
  const total = params.totalInr.toLocaleString("en-IN");

  const isPlatinumOrStudent =
    params.passLabel.toLowerCase().includes("platinum") ||
    params.passLabel.toLowerCase().includes("student");

  const isDonor = params.passLabel.toLowerCase().includes("donor");

  if (isDonor) {
    return [
      `Hello ${name},`,
      "",
      `✨ Your Rhapsody Donor Pass is confirmed.`,
      "",
      `We extend our heartfelt gratitude for your generous support 🤍`,
      "",
      `🎟️ Donor Pass Details`,
      `Donor Pass × ${params.quantity}`,
      `Reference: ${params.ref.toUpperCase()}`,
      `Contribution: ₹${total}`,
      "",
      `Your Contribution is truly Meaningful — Each Donor Pass will be offered to Two Cancer Survivors, giving them the opportunity to experience an evening of Music, Hope, and Joy.`,
      "",
      `Because of you, this evening reaches beyond the stage and touches lives in a deeply personal way.`,
      "",
      `With Sincere Appreciation, We thank you for being a part of this cause.`,
      "",
      `With Gratitude,`,
      `Team Rhapsody`,
      `Thenmozhi Memorial Trust`
    ].join("\n");
  }

  if (isPlatinumOrStudent) {
    return [
      `Dear ${name},`,
      "",
      `✨ Your booking for Rhapsody is confirmed.`,
      "",
      `We are truly grateful for your generous support — it means a great deal to us`,
      "",
      `🎟️ 🎫 Pass Details`,
      `${params.passLabel} × ${params.quantity}`,
      `Reference: ${params.ref.toUpperCase()}`,
      `Contribution: ₹${total}`,
      "",
      `📍 Event Details`,
      `Date: May 9th 2026`,
      `Time: 4:30 PM Onwards`,
      `Venue: Sir Mutha Venkata Subba Rao Concert Hall, Chennai`,
      "",
      `🎟️ Your Digital Entry Pass ${params.ticketPageUrl}`,
      "",
      `Kindly present your QR code at the entrance for a seamless check-in experience. We look forward to hosting you for an evening of elegance, music, and meaningful moments`,
      "",
      `🤍 With gratitude,`,
      `Team Rhapsody`,
      `Thenmozhi Memorial Trust`
    ].join("\n");
  }

  return [
    `Hello ${name},`,
    "",
    "Your Rhapsody ticket is confirmed.",
    `• ${params.passLabel} × ${params.quantity} (Ref ${params.ref.toUpperCase()})`,
    `• Total: ₹${total}`,
    "",
    "Your check-in QR link:",
    params.ticketPageUrl,
    "",
    "— Rhapsody · Thenmozhi Memorial Trust",
  ].join("\n");
}
