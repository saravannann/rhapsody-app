/** Keys must match admin "Edit targets" labels and ticket type aggregation labels. */
export const PASS_TARGET_DEFAULTS: Record<string, number> = {
  "Platinum Pass": 50,
  "Donor Pass": 15,
  "Bulk Tickets": 100,
  "Student Pass": 40,
};

const PASS_COLORS: Record<string, string> = {
  "Platinum Pass": "bg-[#ec4899]",
  "Donor Pass": "bg-[#3b82f6]",
  "Bulk Tickets": "bg-[#10b981]",
  "Student Pass": "bg-[#f59e0b]",
};

/** Maps DB `tickets.type` values to pass target row keys. */
export const TICKET_TYPE_TO_PASS_NAME: Record<string, keyof typeof PASS_TARGET_DEFAULTS | string> = {
  Platinum: "Platinum Pass",
  Donor: "Donor Pass",
  Bulk: "Bulk Tickets",
  Student: "Student Pass",
};

export type PassTargetRow = {
  name: string;
  sold: number;
  target: number;
  color: string;
};

/**
 * Merge saved JSON from `profiles.pass_targets` with defaults.
 * Unknown keys are ignored; invalid numbers fall back to defaults.
 */
function toNonNegativeInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
    return Math.floor(v);
  }
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return null;
}

export function resolvePassTargets(saved: unknown): Record<string, number> {
  const out = { ...PASS_TARGET_DEFAULTS };
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return out;
  const obj = saved as Record<string, unknown>;
  for (const key of Object.keys(PASS_TARGET_DEFAULTS)) {
    const n = toNonNegativeInt(obj[key]);
    if (n !== null) out[key] = n;
  }
  return out;
}

/** Count tickets per pass name using `tickets.type`. */
export function soldCountsFromTickets(
  tickets: { type?: string | null }[]
): Record<string, number> {
  const counts: Record<string, number> = {
    "Platinum Pass": 0,
    "Donor Pass": 0,
    "Bulk Tickets": 0,
    "Student Pass": 0,
  };
  for (const t of tickets) {
    const raw = t.type;
    if (!raw) continue;
    const name = TICKET_TYPE_TO_PASS_NAME[raw];
    if (name && counts[name] !== undefined) counts[name]++;
  }
  return counts;
}

export function buildTargetRowsFromProfile(
  pass_targets: unknown,
  soldByName: Record<string, number>
): PassTargetRow[] {
  const resolved = resolvePassTargets(pass_targets);
  return Object.keys(PASS_TARGET_DEFAULTS).map((name) => ({
    name,
    sold: soldByName[name] ?? 0,
    target: resolved[name] ?? PASS_TARGET_DEFAULTS[name],
    color: PASS_COLORS[name] ?? "bg-gray-400",
  }));
}

export function totalPassTarget(pass_targets: unknown): number {
  const r = resolvePassTargets(pass_targets);
  return Object.values(r).reduce((a, b) => a + b, 0);
}
