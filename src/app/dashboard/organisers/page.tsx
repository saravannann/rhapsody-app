"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  UserPlus,
  Search,
  Edit2,
  CheckCircle2,
  Phone,
  Clock,
  Loader2,
  ArrowLeft,
  Target,
  Eye,
  EyeOff,
  Shield,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/utils/supabase";
import { IndianMobileInput } from "@/components/indian-mobile-input";
import { CenteredModal } from "@/components/centered-modal";
import { hasNationalDigits, toE164, INDIA_CC } from "@/utils/phone";
import {
  buildTargetRowsFromProfile,
  soldCountsFromTickets,
} from "@/utils/pass-targets";
import { ticketQuantity } from "@/utils/ticket-counts";

/** Roles from `profiles.roles` (array) or legacy `profiles.role` (string). */
function normalizeProfileRoles(p: { roles?: unknown; role?: unknown }): string[] {
  if (Array.isArray(p.roles)) {
    return p.roles.filter((r): r is string => typeof r === "string" && r.length > 0);
  }
  if (typeof p.roles === "string") {
    const s = p.roles.trim();
    if (!s) return [];
    return s.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean);
  }
  if (typeof p.role === "string" && p.role.trim()) return [p.role.trim()];
  return [];
}

interface Target {
  name: string;
  target: number;
  sold: number;
  color: string;
}

interface OrgUser {
  id: string;
  name: string;
  phone: string;
  roles: string[];
  status: string;
  lastLogin: string;
  totalSales: number;
  pass_targets: Record<string, number> | null;
  targets: Target[];
}

const ROLE_DISPLAY_ORDER = ["admin", "organiser", "front_desk"] as const;
const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  organiser: "Organiser",
  front_desk: "Front Desk",
};

/** Stable keys for role chips (raw role id when available). */
function sortedRoleEntries(roles: string[]): { key: string; label: string }[] {
  const uniq = [...new Set(roles.map((r) => r.toLowerCase()))];
  const rest = uniq.filter((r) => !ROLE_DISPLAY_ORDER.includes(r as (typeof ROLE_DISPLAY_ORDER)[number]));
  const ordered = ROLE_DISPLAY_ORDER.filter((r) => uniq.includes(r));
  return [...ordered, ...rest.sort()].map((r) => ({
    key: r,
    label: ROLE_LABELS[r] ?? r,
  }));
}

/** Normalise role strings for editing (stable slugs for known roles). */
function canonicalRoleSlugs(roles: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of roles) {
    const low = r.trim().toLowerCase();
    let key = r.trim();
    if (low === "admin") key = "admin";
    else if (low === "organiser" || low === "organizer") key = "organiser";
    else if (low === "front_desk" || low === "front desk") key = "front_desk";
    const dedup = key.toLowerCase();
    if (seen.has(dedup)) continue;
    seen.add(dedup);
    out.push(key);
  }
  return out;
}

/** Shared role toggles (admin / organiser / front_desk). */
function RoleChecklist({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (role: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex cursor-pointer items-center gap-3 group">
        <div
          className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all ${selected.includes("admin") ? "border-primary bg-primary" : "border-pink-200 bg-[#fdfaff] dark:bg-violet-900/10 dark:border-violet-500/30 group-hover:border-primary"}`}
        >
          {selected.includes("admin") && <CheckCircle2 className="h-3 w-3 text-white" />}
        </div>
        <input
          type="checkbox"
          className="hidden"
          checked={selected.includes("admin")}
          onChange={() => onToggle("admin")}
        />
        <span className="text-sm font-bold text-gray-700 dark:text-violet-200">
          Administrator <span className="font-normal text-gray-500 dark:text-violet-400/70">(Full Access)</span>
        </span>
      </label>
      <label className="flex cursor-pointer items-center gap-3 group">
        <div
          className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all ${selected.includes("organiser") ? "border-primary bg-primary" : "border-pink-200 bg-[#fdfaff] group-hover:border-primary"}`}
        >
          {selected.includes("organiser") && <CheckCircle2 className="h-3 w-3 text-white" />}
        </div>
        <input
          type="checkbox"
          className="hidden"
          checked={selected.includes("organiser")}
          onChange={() => onToggle("organiser")}
        />
        <span className="text-sm font-bold text-gray-700 dark:text-violet-200">
          Organiser <span className="font-normal text-gray-500 dark:text-violet-400/70">(Dashboard Access)</span>
        </span>
      </label>
      <label className="flex cursor-pointer items-center gap-3 group">
        <div
          className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all ${selected.includes("front_desk") ? "border-primary bg-primary" : "border-pink-200 bg-[#fdfaff] group-hover:border-primary"}`}
        >
          {selected.includes("front_desk") && <CheckCircle2 className="h-3 w-3 text-white" />}
        </div>
        <input
          type="checkbox"
          className="hidden"
          checked={selected.includes("front_desk")}
          onChange={() => onToggle("front_desk")}
        />
        <span className="text-sm font-bold text-gray-700 dark:text-violet-200">
          Front Desk <span className="font-normal text-gray-500 dark:text-violet-400/70">(Scanner Only)</span>
        </span>
      </label>
    </div>
  );
}

function TargetQuotaCells({ targets }: { targets: Target[] }) {
  return (
    <div className="-mx-0.5 flex snap-x snap-mandatory gap-1.5 overflow-x-auto pb-0.5 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-2 sm:overflow-visible lg:grid-cols-4">
      {targets.map((tgt) => {
        const perc =
          tgt.target > 0 ? Math.min(100, Math.floor((tgt.sold / tgt.target) * 100)) : 0;
        return (
          <div
            key={tgt.name}
            className="w-[calc((100%-0.375rem)/2)] min-w-[7rem] shrink-0 snap-start rounded-md border border-gray-100 dark:border-violet-500/20 bg-white dark:bg-violet-950/30 p-1.5 sm:w-auto sm:min-w-0 sm:rounded-lg sm:p-3"
          >
            <div className="mb-0.5 flex items-start justify-between gap-1">
              <h4 className="line-clamp-2 text-[9px] font-bold leading-tight text-gray-800 dark:text-violet-200 sm:text-[11px] md:text-xs">
                {tgt.name}
              </h4>
              <span className="shrink-0 rounded bg-gray-100 dark:bg-violet-900/30 px-1 py-px text-[9px] font-bold tabular-nums text-gray-600 dark:text-violet-400 sm:px-1.5 sm:py-0.5 sm:text-[10px] md:text-xs">
                {perc}%
              </span>
            </div>
            <div className="mb-0.5 flex items-baseline gap-0.5">
              <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-violet-100 sm:text-base md:text-lg">{tgt.sold}</span>
              <span className="text-[10px] font-medium text-gray-400 dark:text-violet-400/60 sm:text-[11px] md:text-xs">/{tgt.target}</span>
            </div>
            <div className="h-0.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-violet-900/20 sm:h-1">
              <div
                className={`${tgt.color} h-full rounded-full transition-all duration-500`}
                style={{ width: `${perc}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OverallProgressFooter({
  overallPerc,
  overallPercNum,
}: {
  overallPerc: string;
  overallPercNum: number;
}) {
  return (
    <div className="border-t border-gray-100 dark:border-violet-500/15 bg-gray-50/90 dark:bg-violet-950/40 px-2.5 py-1.5 sm:px-4 sm:py-3">
      <div className="mb-1 flex items-center justify-between text-[10px] sm:mb-1.5 sm:text-sm">
        <span className="font-semibold text-gray-600 dark:text-violet-400/80">Overall</span>
        <span className="font-bold tabular-nums text-primary">{overallPerc}%</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-violet-900/30 sm:h-1.5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
          style={{ width: `${overallPercNum}%` }}
        />
      </div>
    </div>
  );
}

export default function OrganisersPage() {
  const pathname = usePathname();
  const router = useRouter();
  const [view, setView] = useState<'list' | 'add'>('list');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Target Editing State
  const [editingOrg, setEditingOrg] = useState<OrgUser | null>(null);
  const [savingTargets, setSavingTargets] = useState(false);

  const [editingRoles, setEditingRoles] = useState<{
    id: string;
    name: string;
    phone: string;
    rolesDraft: string[];
  } | null>(null);
  const [savingRoles, setSavingRoles] = useState(false);

  // Add Form State
  const [formData, setFormData] = useState({ name: "", phone: "", roles: ["organiser"], password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (view === "list") void loadUsers();
  }, [view, pathname]);

  async function loadUsers() {
    setLoading(true);
    setLoadError(null);
    try {
      // Use select("*") so missing optional columns (e.g. pass_targets before migration) never break the query.
      const [profilesRes, ticketsRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("tickets").select("sold_by, quantity, type"),
      ]);

      if (profilesRes.error) {
        console.error("[UserManagement] profiles:", profilesRes.error);
        setLoadError(
          profilesRes.error.message ||
            "Could not load profiles. Check Supabase connection and RLS policies."
        );
        setUsers([]);
        return;
      }
      if (ticketsRes.error) {
        console.warn("[UserManagement] tickets:", ticketsRes.error);
      }

      const profiles = profilesRes.data || [];
      const tickets = ticketsRes.data || [];

      const rows = profiles.map((org) => {
        const displayName = String(org.name ?? "").trim();
        const orgNameLower = displayName.toLowerCase();
        const orgTickets = tickets.filter(
          (t) => t.sold_by?.trim().toLowerCase() === orgNameLower
        );
        const soldByName = soldCountsFromTickets(orgTickets);

        return {
          id: org.id,
          name: displayName || "Unnamed user",
          phone: org.phone,
          roles: normalizeProfileRoles(org),
          status: "active",
          lastLogin: "Just now",
          totalSales: orgTickets.reduce((sum, t) => sum + ticketQuantity(t), 0),
          pass_targets: org.pass_targets,
          targets: buildTargetRowsFromProfile(org.pass_targets, soldByName),
        };
      });

      rows.sort((a, b) =>
        String(a.name).toLowerCase().localeCompare(String(b.name).toLowerCase(), undefined, {
          sensitivity: "base",
        })
      );
      setUsers(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const toggleRole = (roleValue: string) => {
    setFormData(prev => {
      const current = prev.roles;
      if (current.includes(roleValue)) return { ...prev, roles: current.filter(r => r !== roleValue) };
      return { ...prev, roles: [...current, roleValue] };
    });
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.roles.length === 0) return alert("Please select at least one role!");
    if (!hasNationalDigits(formData.phone)) {
      alert("Enter a phone number.");
      return;
    }
    setIsSubmitting(true);
    setSuccess(false);

    try {
      const mockUuid = crypto.randomUUID();
      let phoneE164: string;
      try {
        phoneE164 = toE164(INDIA_CC, formData.phone);
      } catch {
        alert("Enter a valid phone number.");
        setIsSubmitting(false);
        return;
      }
      const { error } = await supabase.from('profiles').insert({
        id: mockUuid, 
        name: formData.name, 
        phone: phoneE164, 
        roles: formData.roles,
        password: formData.password
      });

      if (error) {
        if (error.code === '23505') alert("This phone number is already registered!");
        else alert("Error saving user.");
      } else {
        setSuccess(true);
        setFormData({ name: "", phone: "", roles: ["organiser"], password: "" }); 
        setTimeout(() => { setSuccess(false); setView('list'); }, 1500);
      }
    } catch(err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeTargetEditor = useCallback(() => setEditingOrg(null), []);

  const closeRolesEditor = useCallback(() => setEditingRoles(null), []);

  const deleteUser = async (org: {
    id: string;
    name: string;
    phone: string;
    roles?: string[];
  }) => {
    const selfPhone =
      typeof window !== "undefined" ? localStorage.getItem("rhapsody_phone") : null;
    const isSelf = Boolean(selfPhone && org.phone === selfPhone);

    const adminRows = users.filter((o) =>
      (o.roles || []).some((r: string) => String(r).toLowerCase() === "admin")
    );
    const targetIsAdmin = (org.roles || []).some(
      (r: string) => String(r).toLowerCase() === "admin"
    );
    const onlyAdminInSystem = targetIsAdmin && adminRows.length === 1;

    let msg: string;
    if (onlyAdminInSystem) {
      msg = isSelf
        ? `You are the only Administrator. Deleting your account removes all admin access to this app. Continue?`
        : `This user is the only Administrator. Deleting them removes all admin access to User Management. Continue?`;
    } else if (isSelf) {
      msg = `Delete your own account "${org.name}"? You will be signed out. This cannot be undone.`;
    } else {
      msg = `Delete user "${org.name}" (${org.phone})? This cannot be undone.`;
    }

    if (!window.confirm(msg)) return;
    if (onlyAdminInSystem || isSelf) {
      if (!window.confirm("Final confirmation: permanently delete this profile?")) return;
    }

    setDeletingId(org.id);
    try {
      const { error } = await supabase.from("profiles").delete().eq("id", org.id);

      if (error) {
        console.error(error);
        alert(
          error.message.includes("permission") || error.code === "42501"
            ? "Delete failed: run the profiles delete policy migration in Supabase (see supabase/migrations/profiles_delete_policy.sql)."
            : error.message || "Could not delete user."
        );
        return;
      }

      setUsers((prev) => prev.filter((o) => o.id !== org.id));
      setEditingOrg(null);
      setEditingRoles(null);

      if (isSelf) {
        localStorage.removeItem("rhapsody_user");
        localStorage.removeItem("rhapsody_role");
        localStorage.removeItem("rhapsody_phone");
        router.replace("/");
      }
    } finally {
      setDeletingId(null);
    }
  };

  const toggleDraftRole = useCallback((role: string) => {
    setEditingRoles((prev) => {
      if (!prev) return null;
      const cur = prev.rolesDraft;
      const has = cur.some((r) => r.toLowerCase() === role);
      const next = has ? cur.filter((r) => r.toLowerCase() !== role) : [...cur, role];
      return { ...prev, rolesDraft: next };
    });
  }, []);

  const saveRoleEdits = async () => {
    if (!editingRoles) return;
    if (editingRoles.rolesDraft.length === 0) {
      alert("Select at least one role.");
      return;
    }

    const selfPhone =
      typeof window !== "undefined" ? localStorage.getItem("rhapsody_phone") : null;
    const isSelf = Boolean(selfPhone && editingRoles.phone === selfPhone);
    if (isSelf && !editingRoles.rolesDraft.some((r) => r.toLowerCase() === "admin")) {
      const ok = window.confirm(
        "You are removing Admin access from your own account. You may lose access to this screen. Continue?"
      );
      if (!ok) return;
    }

    setSavingRoles(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({ roles: editingRoles.rolesDraft })
        .eq("id", editingRoles.id)
        .select("id, roles")
        .maybeSingle();

      if (error) {
        console.error(error);
        alert("Could not save roles. Check your connection and try again.");
        return;
      }
      if (!data) {
        alert("No profile was updated.");
        return;
      }

      const nextRoles = normalizeProfileRoles({ roles: data.roles });
      setUsers((prev) =>
        prev.map((o) => (o.id === data.id ? { ...o, roles: nextRoles } : o))
      );
      setEditingRoles(null);
    } finally {
      setSavingRoles(false);
    }
  };

  const saveTargetEdits = async () => {
    if (!editingOrg) return;
    const pass_targets: Record<string, number> = {};
    for (const row of editingOrg.targets as { name: string; target: number }[]) {
      pass_targets[row.name] = row.target;
    }
    setSavingTargets(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .update({ pass_targets })
        .eq("id", editingOrg.id)
        .select("id, pass_targets")
        .maybeSingle();

      if (error) {
        console.error(error);
        alert(
          "Could not save targets. Run the SQL migration `supabase/migrations/add_pass_targets_to_profiles.sql` in Supabase, then try again."
        );
        return;
      }
      if (!data) {
        alert(
          "No profile row was updated. Your session may not match this organiser, or the id is invalid."
        );
        return;
      }

      const mergedPassTargets = data.pass_targets ?? pass_targets;
      setUsers((prev) =>
        prev.map((o) =>
          o.id === editingOrg.id
            ? { ...editingOrg, pass_targets: mergedPassTargets }
            : o
        )
      );
      setEditingOrg(null);
    } finally {
      setSavingTargets(false);
    }
  };

  const filteredUsers = users.filter((o) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    if (o.name.toLowerCase().includes(q) || o.phone.includes(searchQuery)) return true;
    const roleStr = (o.roles as string[] | undefined)?.join(" ").toLowerCase() ?? "";
    if (roleStr.includes(q)) return true;
    return sortedRoleEntries(o.roles || []).some((e) => e.label.toLowerCase().includes(q));
  });

  return (
    <div className="mx-auto max-w-5xl space-y-3 sm:space-y-5">
      
      <CenteredModal
        open={!!editingOrg}
        onClose={closeTargetEditor}
        closeBlocked={savingTargets}
        title="Edit Targets"
        titleId="organiser-targets-modal-title"
        headerIcon={<Target className="h-5 w-5 shrink-0 text-primary" />}
        footer={
          <div className="flex gap-2 sm:gap-3">
              <button
                type="button"
                onClick={closeTargetEditor}
                disabled={savingTargets}
                className="flex-1 rounded-xl border border-gray-200 dark:border-violet-500/20 bg-white dark:bg-violet-900/10 py-3 text-sm font-bold text-gray-800 dark:text-violet-200 transition-colors hover:bg-gray-100 dark:hover:bg-violet-900/20 disabled:opacity-50 sm:text-base"
              >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void saveTargetEdits()}
              disabled={savingTargets}
              className="flex-1 rounded-xl bg-gradient-to-r from-primary to-secondary py-3 text-sm font-bold text-white shadow-lg shadow-pink-500/20 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 sm:text-base"
            >
              {savingTargets ? (
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              ) : (
                "Save"
              )}
            </button>
          </div>
        }
      >
        {editingOrg ? (
          <>
            <p className="mb-3 text-xs text-gray-500 dark:text-violet-400/70 sm:text-sm">
              Quotas for <span className="font-bold text-gray-900 dark:text-violet-100">{editingOrg.name}</span>
            </p>
            <div className="space-y-2">
              {editingOrg.targets.map((tgt, i) => (
                <div
                  key={tgt.name}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 dark:border-violet-500/20 bg-[#fdfaff] dark:bg-violet-950/40 p-3"
                >
                  <span className="flex min-w-0 items-center gap-2 text-xs font-bold text-gray-700 dark:text-violet-200 sm:text-sm">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${tgt.color}`} />
                    <span className="truncate">{tgt.name}</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={tgt.target}
                    onChange={(e) => {
                      const newTargets = [...editingOrg.targets];
                      newTargets[i].target = Number(e.target.value);
                      setEditingOrg({ ...editingOrg, targets: newTargets });
                    }}
                    className="w-[4.5rem] rounded-lg border border-gray-200 dark:border-violet-500/30 bg-white dark:bg-violet-950/50 py-2 text-center text-sm font-bold text-gray-900 dark:text-violet-100 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 sm:w-20"
                  />
                </div>
              ))}
            </div>
          </>
        ) : null}
      </CenteredModal>

      <CenteredModal
        open={!!editingRoles}
        onClose={closeRolesEditor}
        closeBlocked={savingRoles}
        title="Edit roles"
        titleId="user-roles-modal-title"
        headerIcon={<Shield className="h-5 w-5 shrink-0 text-primary" />}
        footer={
          <div className="flex gap-2 sm:gap-3">
              <button
                type="button"
                onClick={closeRolesEditor}
                disabled={savingRoles}
                className="flex-1 rounded-xl border border-gray-200 dark:border-violet-500/20 bg-white dark:bg-violet-900/10 py-3 text-sm font-bold text-gray-800 dark:text-violet-200 transition-colors hover:bg-gray-100 dark:hover:bg-violet-900/20 disabled:opacity-50 sm:text-base"
              >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void saveRoleEdits()}
              disabled={savingRoles}
              className="flex-1 rounded-xl bg-gradient-to-r from-primary to-secondary py-3 text-sm font-bold text-white shadow-lg shadow-pink-500/20 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 sm:text-base"
            >
              {savingRoles ? (
                <Loader2 className="mx-auto h-5 w-5 animate-spin" />
              ) : (
                "Save roles"
              )}
            </button>
          </div>
        }
      >
        {editingRoles ? (
          <>
            <p className="mb-3 text-xs text-gray-500 dark:text-violet-400/70 sm:text-sm">
              Access for <span className="font-bold text-gray-900 dark:text-violet-100">{editingRoles.name}</span>
            </p>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-violet-400/60">
              System roles
            </label>
            <RoleChecklist selected={editingRoles.rolesDraft} onToggle={toggleDraftRole} />
          </>
        ) : null}
      </CenteredModal>

      {/* Header Layout */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          {view === 'add' ? (
             <button type="button" onClick={() => setView('list')} className="mb-1 flex items-center text-xs font-bold text-gray-500 dark:text-violet-400/70 transition-colors hover:text-primary sm:text-sm">
                <ArrowLeft className="mr-1 h-4 w-4 shrink-0" /> Back to Directory
             </button>
          ) : null}
          <h1 className="bg-gradient-to-r from-secondary to-primary bg-clip-text text-xl font-bold leading-tight text-transparent sm:text-2xl md:text-3xl">
             User Management
          </h1>
          {view === 'add' ? (
             <p className="mt-0.5 text-xs font-medium leading-snug text-gray-500 dark:text-violet-400/60 sm:mt-1 sm:text-sm">
                Provision access by role
             </p>
          ) : null}
        </div>
        
        {view === 'list' && (
           <button 
             type="button" 
             onClick={() => {
               setFormData({ name: "", phone: "", roles: ["organiser"], password: "" });
               setSuccess(false);
               setShowPassword(false);
               setView('add');
             }} 
             className="inline-flex min-h-[40px] shrink-0 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-primary to-secondary px-4 py-2 text-xs font-bold text-white shadow-lg shadow-pink-500/25 transition-all hover:from-primary-dark hover:to-primary active:scale-[0.98] sm:w-auto sm:gap-2 sm:px-5 sm:py-3 sm:text-sm"
           >
             <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Add user
           </button>
        )}
      </div>

      {view === "list" && loadError ? (
        <div
          className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50/95 px-4 py-3 text-sm text-red-950 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <p className="font-medium leading-snug">{loadError}</p>
          <button
            type="button"
            onClick={() => void loadUsers()}
            className="shrink-0 rounded-lg border border-red-300 bg-white px-4 py-2 text-xs font-bold text-red-900 shadow-sm transition-colors hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      ) : null}

      {view === 'add' ? (
        <div className="w-full max-w-2xl bg-white dark:bg-violet-950/20 rounded-xl sm:rounded-2xl p-5 sm:p-6 shadow-sm border border-pink-100/80 dark:border-violet-500/15 animate-in fade-in slide-in-from-right-4 duration-300">
          <form onSubmit={handleAddSubmit} className="space-y-5 sm:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label className="block text-sm font-bold text-secondary dark:text-violet-300 mb-2">Full Name</label>
                <input required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} placeholder="Sara" className="w-full bg-[#fdfaff] dark:bg-violet-950/40 border border-pink-100 dark:border-violet-500/20 rounded-xl px-4 py-3 text-sm font-medium dark:text-violet-100 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-bold text-secondary dark:text-violet-300 mb-2">Phone Number</label>
                <IndianMobileInput
                  required
                  value={formData.phone}
                  onChange={(d) => setFormData({ ...formData, phone: d })}
                  className="border border-pink-100 dark:border-violet-500/20 bg-[#fdfaff] dark:bg-violet-950/40"
                  prefixClassName="bg-pink-50/90 border-pink-100 text-secondary dark:bg-violet-950/55 dark:border-violet-500/30 dark:text-violet-200"
                  inputClassName="font-medium text-gray-900 dark:text-violet-100 shadow-none border-none focus:ring-0"
                />
                <p className="text-[10px] text-gray-400 mt-1 font-medium">India (+91)</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-secondary dark:text-violet-300 mb-2">Login Password</label>
              <div className="relative">
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={e=>setFormData({...formData, password: e.target.value})}
                  placeholder="Assign a password"
                  className="w-full bg-[#fdfaff] dark:bg-violet-950/40 border border-pink-100 dark:border-violet-500/20 rounded-xl pl-4 pr-11 py-3 text-sm font-medium dark:text-violet-100 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-gray-400 hover:text-gray-700 dark:text-violet-400 dark:hover:text-violet-200 hover:bg-pink-50 dark:hover:bg-violet-800/20 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1 font-medium">The user will use their phone number and this password to login.</p>
            </div>

            <div>
              <label className="mb-3 block text-sm font-bold text-secondary dark:text-violet-300">System Roles / Access Types</label>
              <RoleChecklist selected={formData.roles} onToggle={toggleRole} />
            </div>

            <div className="pt-2 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-h-[1.75rem]">
                 {success && <span className="inline-flex items-center text-xs sm:text-sm font-bold text-accent bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100"><CheckCircle2 className="w-4 h-4 mr-2 shrink-0" /> User saved!</span>}
              </div>
              <button type="submit" disabled={isSubmitting || !formData.name || !hasNationalDigits(formData.phone)} className="w-full sm:w-auto bg-gradient-to-r from-primary to-secondary text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-pink-500/30 transition-all active:scale-[0.98] disabled:opacity-50 sm:min-w-[140px]">
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Save member"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="animate-in fade-in duration-300">
           
           <div className="relative mb-3 sm:mb-5">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-violet-400/60 sm:left-3.5 sm:h-5 sm:w-5" />
              <input 
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search name or phone" 
                className="w-full rounded-xl border border-gray-200/90 dark:border-violet-500/20 bg-gray-100/90 dark:bg-violet-950/40 py-2 pl-9 pr-3 text-sm font-medium text-gray-900 dark:text-violet-100 placeholder:text-gray-400 dark:placeholder:text-violet-400/50 transition-all focus:bg-white dark:focus:bg-violet-950/60 focus:outline-none focus:ring-2 focus:ring-primary/20 sm:py-2.5 sm:pl-11 sm:text-sm"
              />
           </div>

           {loading ? (
              <div className="flex justify-center py-8 sm:py-12"><Loader2 className="h-7 w-7 animate-spin text-primary sm:h-8 sm:w-8" /></div>
           ) : loadError ? (
              <p className="py-6 text-center text-sm text-gray-600">
                Fix the issue above, then tap Retry to load the directory.
              </p>
           ) : filteredUsers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 dark:border-violet-500/25 bg-white/60 dark:bg-violet-950/10 px-4 py-10 text-center">
                 <p className="text-sm font-semibold text-gray-700 dark:text-violet-200">
                    {users.length === 0 ? "No users yet" : "No matches"}
                 </p>
                 <p className="text-xs text-gray-500 mt-1">
                    {users.length === 0 ? "Add your first user with the button above" : "Try a different name or phone"}
                 </p>
              </div>
           ) : (
              <ul className="m-0 list-none space-y-2 p-0 sm:space-y-4">
                {filteredUsers.map((org) => {
                   const totalTgt = org.targets.reduce((acc, t) => acc + t.target, 0);
                   const totalSld = org.targets.reduce((acc, t) => acc + t.sold, 0);
                   const overallPercNum = totalTgt > 0 ? Math.min(100, (totalSld / totalTgt) * 100) : 0;
                   const overallPerc = totalTgt > 0 ? overallPercNum.toFixed(1) : "0";
                   const roleEntries = sortedRoleEntries(org.roles || []);

                   return (
                   <li key={org.id}>
                   <div className="group flex flex-col overflow-hidden rounded-lg border border-gray-200/90 dark:border-violet-500/15 bg-white dark:bg-violet-950/25 shadow-sm transition-colors hover:border-pink-200/80 dark:hover:border-violet-500/30 sm:rounded-2xl">
                      
                      <div className="border-b border-gray-100 dark:border-violet-500/10 p-2 sm:p-4">
                         <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                               <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                  <h3 className="truncate text-sm font-bold text-gray-900 dark:text-violet-100 transition-colors group-hover:text-primary sm:text-base md:text-lg">
                                     {org.name}
                                  </h3>
                                  <span className="shrink-0 rounded bg-gray-900 px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none text-white sm:text-[10px]">
                                     {org.status}
                                  </span>
                               </div>
                               {roleEntries.length > 0 ? (
                                  <>
                                     <p className="mt-0.5 truncate text-[10px] font-medium text-secondary/90 dark:text-violet-300/80 sm:hidden">
                                        {roleEntries.map((e) => e.label).join(" · ")}
                                     </p>
                                     <div className="mt-1 hidden flex-wrap gap-1 sm:flex" aria-label="User roles">
                                        {roleEntries.map(({ key, label }) => (
                                           <span
                                              key={key}
                                              className="inline-flex items-center rounded-full border border-pink-200/90 dark:border-violet-500/30 bg-pink-50/90 dark:bg-violet-900/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-secondary dark:text-violet-300"
                                           >
                                              {label}
                                           </span>
                                        ))}
                                     </div>
                                  </>
                               ) : null}
                            </div>
                            <div className="shrink-0 text-right leading-tight">
                               <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400 sm:text-[10px]">Sales</p>
                               <span className="text-base font-bold tabular-nums text-primary sm:text-xl md:text-2xl">{org.totalSales}</span>
                            </div>
                         </div>

                         <div className="mt-2 flex gap-1.5 sm:mt-3 sm:justify-end sm:gap-2">
                            <button
                               type="button"
                               aria-label="Edit roles"
                               title="Edit roles"
                               onClick={() => {
                                  setEditingOrg(null);
                                  setEditingRoles({
                                     id: org.id,
                                     name: org.name,
                                     phone: org.phone,
                                     rolesDraft: canonicalRoleSlugs(org.roles || []),
                                  });
                               }}
                               className="inline-flex h-9 flex-1 touch-manipulation items-center justify-center rounded-lg border border-gray-200 dark:border-violet-500/20 bg-white dark:bg-violet-900/20 text-gray-800 dark:text-violet-200 shadow-sm transition-all active:scale-[0.98] hover:border-primary hover:text-primary sm:h-auto sm:min-h-[40px] sm:flex-initial sm:gap-2 sm:px-4 sm:py-2 sm:text-[11px] sm:font-bold md:text-sm"
                            >
                               <Shield className="h-4 w-4 shrink-0" />
                               <span className="hidden sm:inline">Edit roles</span>
                            </button>
                            <button
                               type="button"
                               aria-label="Edit pass targets"
                               title="Edit targets"
                               onClick={() => {
                                  setEditingRoles(null);
                                  setEditingOrg(org);
                               }}
                               className="inline-flex h-9 flex-1 touch-manipulation items-center justify-center rounded-lg border border-gray-200 dark:border-violet-500/20 bg-white dark:bg-violet-900/20 text-gray-800 dark:text-violet-200 shadow-sm transition-all active:scale-[0.98] hover:border-primary hover:text-primary sm:h-auto sm:min-h-[40px] sm:flex-initial sm:gap-2 sm:px-4 sm:py-2 sm:text-[11px] sm:font-bold md:text-sm"
                            >
                               <Edit2 className="h-4 w-4 shrink-0" />
                               <span className="hidden sm:inline">Edit targets</span>
                            </button>
                            <button
                               type="button"
                               aria-label="Delete user"
                               title="Delete user"
                               disabled={deletingId === org.id}
                               onClick={() => void deleteUser(org)}
                               className="inline-flex h-9 flex-1 touch-manipulation items-center justify-center rounded-lg border border-red-200 dark:border-red-900/30 bg-white dark:bg-red-950/20 text-red-700 dark:text-red-400 shadow-sm transition-all hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-60 sm:h-auto sm:min-h-[40px] sm:flex-initial sm:gap-2 sm:px-4 sm:py-2 sm:text-[11px] sm:font-bold md:text-sm"
                            >
                               {deletingId === org.id ? (
                                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                               ) : (
                                  <Trash2 className="h-4 w-4 shrink-0" />
                               )}
                               <span className="hidden sm:inline">Delete user</span>
                            </button>
                         </div>

                         <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-gray-100 dark:border-violet-500/10 pt-2 text-[10px] leading-snug text-gray-500 dark:text-violet-400/60 sm:mt-3 sm:pt-3 sm:text-xs">
                            <span className="inline-flex min-w-0 max-w-[100%] items-center gap-1">
                               <Phone className="h-3 w-3 shrink-0 opacity-60" />
                               <span className="truncate">{org.phone}</span>
                            </span>
                            <span className="inline-flex items-center gap-1 text-gray-400 dark:text-violet-500/60">
                               <Clock className="h-3 w-3 shrink-0 opacity-60" />
                               {org.lastLogin}
                            </span>
                         </div>
                      </div>

                      <details className="border-t border-gray-100 dark:border-violet-500/10 sm:hidden [&[open]_summary_svg:last-child]:rotate-180">
                         <summary className="flex cursor-pointer list-none items-center justify-between gap-2 bg-[#fafafa] dark:bg-violet-900/10 px-2 py-2 text-[11px] font-semibold text-gray-800 dark:text-violet-200 [&::-webkit-details-marker]:hidden">
                            <span className="flex min-w-0 items-center gap-1.5">
                               <Target className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                               Pass targets
                            </span>
                            <span className="flex shrink-0 items-center gap-1.5 tabular-nums text-primary">
                               {overallPerc}%
                               <ChevronDown className="h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200" />
                            </span>
                         </summary>
                         <div className="bg-[#fafafa] dark:bg-violet-900/10 px-1.5 pb-2 pt-0">
                            <TargetQuotaCells targets={org.targets} />
                         </div>
                         <OverallProgressFooter overallPerc={overallPerc} overallPercNum={overallPercNum} />
                      </details>

                      <div className="hidden sm:block">
                         <div className="bg-[#fafafa] dark:bg-violet-900/10 px-1.5 py-1.5 sm:p-3">
                            <TargetQuotaCells targets={org.targets} />
                         </div>
                         <OverallProgressFooter overallPerc={overallPerc} overallPercNum={overallPercNum} />
                      </div>

                   </div>
                   </li>
                   );
                })}
              </ul>
           )}
        </div>
      )}
    </div>
  );
}
