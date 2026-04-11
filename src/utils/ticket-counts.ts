/** Per-row ticket quantity (defaults to 1 for legacy rows before `quantity` existed). */
export function ticketQuantity(t: { quantity?: unknown }): number {
  const q = t.quantity;
  if (typeof q === "number" && Number.isFinite(q) && q >= 1) return Math.floor(q);
  return 1;
}

/** Unit price stored on the ticket row (per pass). */
export function ticketUnitPrice(t: { price?: unknown }): number {
  const n = Number(t.price);
  return Number.isFinite(n) ? n : 0;
}

/** Line total: unit price × quantity. */
export function ticketLineTotal(t: { price?: unknown; quantity?: unknown }): number {
  return ticketUnitPrice(t) * ticketQuantity(t);
}
