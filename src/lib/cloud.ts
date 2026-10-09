import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setCustomersFromCloud } from "@/lib/store";
import { replaceFarmsFromCloud, replaceParcelsFromCloud } from "@/lib/app-config-store";
import type { Customer, Farm, Parcel } from "@/types/domain";
import type { CreateCustomerInput } from "@/lib/store";

// ───────────────────────────────────────────────────────────
// Lovable Cloud data layer for modules already shared between devices:
// customers, farms and parcels. Every write is confirmed by the server
// (RLS + role) before the UI updates; realtime keeps other devices in sync.
// ───────────────────────────────────────────────────────────

export type CloudStatus = "idle" | "loading" | "ready" | "error";
interface CloudState { orgId: string | null; status: CloudStatus; error: string | null }

let cloud: CloudState = { orgId: null, status: "idle", error: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<CloudState>) => { cloud = { ...cloud, ...patch }; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
export const useCloudState = () => useSyncExternalStore(subscribe, () => cloud, () => cloud);
export const getOrgId = () => cloud.orgId;

let channel: ReturnType<typeof supabase.channel> | null = null;

function mapCustomer(r: Record<string, unknown>): Customer {
  return r as unknown as Customer;
}

export async function refreshCustomers(orgId = cloud.orgId) {
  if (!orgId) return;
  const { data, error } = await supabase.from("customers").select("*").eq("organization_id", orgId).order("name");
  if (error) throw error;
  setCustomersFromCloud((data ?? []).map(mapCustomer));
}
export async function refreshFarmsAndParcels(orgId = cloud.orgId) {
  if (!orgId) return;
  const [f, p] = await Promise.all([
    supabase.from("farms").select("*").eq("organization_id", orgId).order("created_at"),
    supabase.from("parcels").select("*").eq("organization_id", orgId).order("created_at"),
  ]);
  if (f.error) throw f.error;
  if (p.error) throw p.error;
  replaceFarmsFromCloud((f.data ?? []) as unknown as Farm[]);
  replaceParcelsFromCloud((p.data ?? []) as unknown as Parcel[]);
}

/** Called on sign-in with the server-side membership. */
export async function startCloud(orgId: string) {
  stopCloud();
  set({ orgId, status: "loading", error: null });
  try {
    await Promise.all([refreshCustomers(orgId), refreshFarmsAndParcels(orgId)]);
    set({ status: "ready" });
  } catch (e) {
    set({ status: "error", error: e instanceof Error ? e.message : "No se pudieron cargar los datos" });
  }
  channel = supabase
    .channel(`org-${orgId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "customers", filter: `organization_id=eq.${orgId}` },
      () => { void refreshCustomers(orgId).catch(() => {}); })
    .subscribe();
}

/** Called on sign-out: drop subscriptions and every cached row. */
export function stopCloud() {
  if (channel) { void supabase.removeChannel(channel); channel = null; }
  setCustomersFromCloud([]);
  replaceFarmsFromCloud([]);
  replaceParcelsFromCloud([]);
  set({ orgId: null, status: "idle", error: null });
}

function requireOrg(): string {
  if (!cloud.orgId) throw new Error("Sin organización activa");
  return cloud.orgId;
}
function friendly(error: { message: string; code?: string }): Error {
  if (error.code === "42501" || /row-level security|permission/i.test(error.message)) return new Error("Tu rol no permite esta acción.");
  if (error.code === "23503") return new Error("No se puede borrar: tiene registros asociados.");
  return new Error(error.message);
}

// ───────────── Customers ─────────────
export async function cloudCreateCustomer(input: CreateCustomerInput) {
  const { error } = await supabase.from("customers").insert({ ...input, organization_id: requireOrg() });
  if (error) throw friendly(error);
  await refreshCustomers();
}
export async function cloudUpdateCustomer(id: string, patch: Partial<CreateCustomerInput>) {
  const { error } = await supabase.from("customers").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw friendly(error);
  await refreshCustomers();
}
export async function cloudDeleteCustomer(id: string) {
  const { error, count } = await supabase.from("customers").delete({ count: "exact" }).eq("id", id);
  if (error) throw friendly(error);
  if (count === 0) throw new Error("Tu rol no permite eliminar clientes.");
  await refreshCustomers();
}

// ───────────── Farms & parcels (Settings "Guardar cambios") ─────────────
const FARM_COLS = ["name", "region", "country", "owner_name", "altitude_m", "notes"] as const;
const PARCEL_COLS = ["farm_id", "name", "variety", "altitude_m", "area_ha", "notes"] as const;
const pick = <T extends object>(o: T, cols: readonly string[]) =>
  Object.fromEntries(cols.map((c) => [c, (o as Record<string, unknown>)[c] ?? null]));
const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

export async function cloudSaveFarms(next: Farm[], prev: Farm[]) {
  const org = requireOrg();
  for (const f of next) {
    const row = { ...pick(f, FARM_COLS), organization_id: org, country: f.country || "Costa Rica", ...(isUuid(f.id) ? { id: f.id } : {}) };
    const res = prev.some((p) => p.id === f.id)
      ? await supabase.from("farms").update({ ...row, updated_at: new Date().toISOString() }).eq("id", f.id)
      : await supabase.from("farms").insert(row);
    if (res.error) throw friendly(res.error);
  }
  for (const p of prev) {
    if (!next.some((f) => f.id === p.id)) {
      const res = await supabase.from("farms").delete().eq("id", p.id);
      if (res.error) throw friendly(res.error);
    }
  }
  await refreshFarmsAndParcels();
}

export async function cloudSaveParcels(next: Parcel[], prev: Parcel[]) {
  const org = requireOrg();
  for (const p of next) {
    const row = { ...pick(p, PARCEL_COLS), organization_id: org, ...(isUuid(p.id) ? { id: p.id } : {}) };
    const res = prev.some((x) => x.id === p.id)
      ? await supabase.from("parcels").update({ ...row, updated_at: new Date().toISOString() }).eq("id", p.id)
      : await supabase.from("parcels").insert(row);
    if (res.error) throw friendly(res.error);
  }
  for (const p of prev) {
    if (!next.some((x) => x.id === p.id)) {
      const res = await supabase.from("parcels").delete().eq("id", p.id);
      if (res.error) throw friendly(res.error);
    }
  }
  await refreshFarmsAndParcels();
}

// ───────────── Members ─────────────
export async function cloudSetMemberRole(userId: string, role: string) {
  const { error } = await supabase.rpc("set_member_role", {
    _org: requireOrg(), _user: userId, _role: role as never,
  });
  if (error) throw friendly(error);
}
