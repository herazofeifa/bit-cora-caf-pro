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
const cloudFarmIds = new Set<string>();
const cloudParcelIds = new Set<string>();

// Generation counter: every start/stop bumps it. A response is applied only if it was
// requested in the current generation, so a slow reply from a previous session/org
// can never repopulate data after logout or an organization switch.
let generation = 0;
export const currentGeneration = () => generation;
const isLive = (gen: number, orgId: string) => gen === generation && cloud.orgId === orgId;

function mapCustomer(r: Record<string, unknown>): Customer {
  return r as unknown as Customer;
}

export async function refreshCustomers(orgId = cloud.orgId, gen = generation) {
  if (!orgId) return;
  const { data, error } = await supabase.from("customers").select("*").eq("organization_id", orgId).order("name");
  if (!isLive(gen, orgId)) return;
  if (error) throw error;
  setCustomersFromCloud((data ?? []).map(mapCustomer));
}
export async function refreshFarmsAndParcels(orgId = cloud.orgId, gen = generation) {
  if (!orgId) return;
  const [f, p] = await Promise.all([
    supabase.from("farms").select("*").eq("organization_id", orgId).order("created_at"),
    supabase.from("parcels").select("*").eq("organization_id", orgId).order("created_at"),
  ]);
  if (!isLive(gen, orgId)) return;
  if (f.error) throw f.error;
  if (p.error) throw p.error;
  cloudFarmIds.clear(); (f.data ?? []).forEach((r) => cloudFarmIds.add(r.id));
  cloudParcelIds.clear(); (p.data ?? []).forEach((r) => cloudParcelIds.add(r.id));
  replaceFarmsFromCloud((f.data ?? []) as unknown as Farm[]);
  replaceParcelsFromCloud((p.data ?? []) as unknown as Parcel[]);
}

/** Called on sign-in / organization switch with the server-side membership. */
export async function startCloud(orgId: string) {
  stopCloud();
  const gen = generation;
  set({ orgId, status: "loading", error: null });
  try {
    await Promise.all([refreshCustomers(orgId, gen), refreshFarmsAndParcels(orgId, gen)]);
    if (!isLive(gen, orgId)) return;
    set({ status: "ready" });
  } catch (e) {
    if (!isLive(gen, orgId)) return;
    set({ status: "error", error: e instanceof Error ? e.message : "No se pudieron cargar los datos" });
  }
  if (!isLive(gen, orgId)) return;
  channel = supabase
    .channel(`org-${orgId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "customers", filter: `organization_id=eq.${orgId}` },
      () => { void refreshCustomers(orgId, gen).catch(() => {}); })
    .subscribe();
}

/** Called on sign-out: invalidate in-flight responses, drop subscriptions and every cached row. */
export function stopCloud() {
  generation++;
  if (channel) { void supabase.removeChannel(channel); channel = null; }
  cloudFarmIds.clear(); cloudParcelIds.clear();
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
const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
/** Temporary (non-UUID) farm id → id confirmed by the server. Applied to parcels saved later. */
const farmIdMap = new Map<string, string>();
export const resolveFarmId = (id: string) => farmIdMap.get(id) ?? id;

/** Saves farms; every row is sent with a UUID so parcels can reference it. Returns old→new id map. */
export async function cloudSaveFarms(next: Farm[], _prev?: Farm[]): Promise<Map<string, string>> {
  const org = requireOrg();
  const mapping = new Map<string, string>();
  for (const f of next) {
    const id = isUuid(f.id) ? f.id : (farmIdMap.get(f.id) ?? crypto.randomUUID());
    if (id !== f.id) mapping.set(f.id, id);
    const row = {
      id, name: f.name, region: f.region, country: f.country || "Costa Rica", owner_name: f.owner_name,
      altitude_m: f.altitude_m, notes: f.notes, organization_id: org,
    };
    const res = cloudFarmIds.has(id)
      ? await supabase.from("farms").update({ ...row, updated_at: new Date().toISOString() }).eq("id", id)
      : await supabase.from("farms").insert(row);
    if (res.error) throw friendly(res.error);
    cloudFarmIds.add(id);
    if (id !== f.id) farmIdMap.set(f.id, id);
  }
  const kept = new Set(next.map((f) => resolveFarmId(f.id)));
  for (const id of [...cloudFarmIds]) {
    if (!kept.has(id)) {
      const res = await supabase.from("farms").delete().eq("id", id);
      if (res.error) throw friendly(res.error);
      cloudFarmIds.delete(id);
    }
  }
  await refreshFarmsAndParcels();
  return mapping;
}

export async function cloudSaveParcels(next: Parcel[], _prev?: Parcel[], farmMap: Map<string, string> = farmIdMap) {
  const org = requireOrg();
  for (const p of next) {
    const id = isUuid(p.id) ? p.id : crypto.randomUUID();
    const farmId = farmMap.get(p.farm_id) ?? resolveFarmId(p.farm_id);
    if (!isUuid(farmId)) throw new Error(`Guarda primero la finca de la parcela "${p.name}".`);
    const row = {
      id, farm_id: farmId, name: p.name, variety: p.variety, altitude_m: p.altitude_m, area_ha: p.area_ha,
      notes: p.notes, organization_id: org,
    };
    const res = cloudParcelIds.has(id)
      ? await supabase.from("parcels").update({ ...row, updated_at: new Date().toISOString() }).eq("id", id)
      : await supabase.from("parcels").insert(row);
    if (res.error) throw friendly(res.error);
    cloudParcelIds.add(id);
  }
  const kept = new Set(next.filter((p) => isUuid(p.id)).map((p) => p.id));
  for (const id of [...cloudParcelIds]) {
    if (!kept.has(id) && !next.some((p) => p.id === id)) {
      const res = await supabase.from("parcels").delete().eq("id", id);
      if (res.error) throw friendly(res.error);
      cloudParcelIds.delete(id);
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
