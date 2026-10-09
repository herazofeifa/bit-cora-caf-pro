import { supabase } from "@/integrations/supabase/client";
import { getOrgId } from "@/lib/cloud";

// Server-backed operations (Lovable Cloud). Every write is an RPC that validates role,
// organization and quantities inside one transaction. Writes that may be retried carry an
// operation key so a repeated tap or a replayed offline item is applied only once.

export const newOpKey = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

export function friendlyError(e: unknown): string {
  const err = e as { message?: string; code?: string } | null;
  const msg = err?.message ?? String(e);
  if (err?.code === "42501" && /Permiso/.test(msg)) return "Tu rol no permite esta acción.";
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return "Sin conexión con el servidor. Intenta de nuevo.";
  return msg;
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc as unknown as (f: string, a: unknown) => Promise<{ data: T; error: { message: string; code?: string } | null }>)(fn, args);
  if (error) throw Object.assign(new Error(friendlyError(error)), { code: error.code });
  return data;
}

export function requireOrg(): string {
  const o = getOrgId();
  if (!o) throw new Error("Sin organización activa.");
  return o;
}

export interface CloudLot {
  id: string; lot_code: string; friendly_name: string; variety: string; process_type: string;
  physical_state: string; commercial_state: string; quality_status: string; sale_released: boolean;
  qty_initial_kg: number; qty_current_kg: number; qty_reserved_kg: number; qty_committed_kg: number;
  qty_blocked_kg: number; qty_sold_kg: number; qty_free_kg: number; current_moisture: number | null;
  farm_id: string | null; parcel_id: string | null; created_at: string;
}

export const listLots = async () => {
  const { data, error } = await supabase.from("lots").select("*").eq("organization_id", requireOrg()).order("created_at", { ascending: false });
  if (error) throw new Error(friendlyError(error));
  return (data ?? []) as unknown as CloudLot[];
};
export const getLot = async (id: string) => {
  const { data, error } = await supabase.from("lots").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(friendlyError(error));
  return data as unknown as CloudLot | null;
};

export const registerHarvest = (data: Record<string, unknown>, targetLot: string | null, lotName: string | null, opKey: string) =>
  rpc<{ ticket_id: string; lot_id: string; lot_code: string; qty_kg: number }>("register_harvest", {
    _org: requireOrg(), _data: data, _target_lot: targetLot, _lot_name: lotName, _op_key: opKey,
  });
export const releaseLot = (lot: string, reason?: string) => rpc("release_lot_for_sale", { _lot: lot, _reason: reason ?? null });
export const startPhase = (lot: string, name: string, template: string | null, expected: number | null, opKey: string) =>
  rpc("start_phase", { _lot: lot, _name: name, _template: template, _phase_key: name, _expected_minutes: expected, _op_key: opKey });
export const logPhaseVariable = (phase: string, key: string, value: number, unit: string | null, opKey: string) =>
  rpc("log_phase_variable", { _phase: phase, _key: key, _value: value, _unit: unit, _notes: null, _op_key: opKey });
export const closePhase = (phase: string, weightOut: number, state: string | null, notes: string | null, opKey: string) =>
  rpc("close_phase", { _phase: phase, _weight_out_kg: weightOut, _physical_state: state, _notes: notes, _op_key: opKey });
export const recordQuality = (lot: string, status: string, score: number | null, notes: string | null) =>
  rpc("record_quality", { _lot: lot, _status: status, _score: score, _data: { notes } });
export const createReservation = (lot: string, customer: string, qty: number, price: number | null, currency: string | null, expires: string | null, opKey: string) =>
  rpc("create_reservation", { _lot: lot, _customer: customer, _qty: qty, _price: price, _currency: currency, _expires_at: expires, _notes: null, _price_unit: "kg", _op_key: opKey });
export const confirmReservation = (id: string) => rpc("confirm_reservation", { _id: id });
export const cancelReservation = (id: string, reason: string) => rpc("cancel_reservation", { _id: id, _reason: reason });
export const deliverReservation = (id: string, opKey: string) => rpc("deliver_reservation", { _id: id, _notes: null, _op_key: opKey });
export const createSacks = (lot: string, count: number, weight: number | null) =>
  rpc<{ id: string; seq: number; sack_token: string; weight_kg: number | null }[]>("create_sacks", { _lot: lot, _count: count, _weight_kg: weight });
export const publishLot = (lot: string, isPublic: boolean, story: string | null, notes: string | null, visibility: Record<string, boolean>) =>
  rpc<{ public_token: string; is_public: boolean }>("publish_lot", { _lot: lot, _is_public: isPublic, _short_story: story, _tasting_notes: notes, _visibility: visibility });
export const declareLotExport = (lot: string, exportedAt: string | null) =>
  rpc("declare_lot_export", { _lot: lot, _exported_at: exportedAt as string });
export const salesSummary = (from: Date, to: Date) =>
  rpc<{ currency: string; deliveries: number; kg_delivered: number; kg_priced: number | null; weighted_price_per_kg: number | null }[]>(
    "sales_summary", { _org: requireOrg(), _from: from.toISOString(), _to: to.toISOString() });
export const overduePhases = () =>
  rpc<{ phase_id: string; lot_id: string; lot_code: string; phase_name: string; elapsed_days: number; reason: string }[]>("overdue_phases", { _org: requireOrg() });
export const publishReportSnapshot = (title: string, payload: Record<string, unknown>, days: number) =>
  rpc<{ id: string; token: string; expires_at: string }>("publish_report_snapshot", { _org: requireOrg(), _title: title, _payload: payload, _days: days });
export const revokeReportSnapshot = (id: string) => rpc("revoke_report_snapshot", { _id: id });
export const createDemoEnvironment = () => rpc<string>("create_demo_environment", {});

// ───── Files: private bucket, path <org>/<lot>/<uuid>.<ext> ─────
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export async function uploadLotFile(lotId: string, phaseId: string | null, kind: string, title: string, file: File) {
  if (!ALLOWED.includes(file.type)) throw new Error("Tipo no permitido (JPG, PNG, WEBP o PDF).");
  if (file.size > MAX_FILE_BYTES) throw new Error("El archivo supera 10 MB.");
  const org = requireOrg();
  const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${org}/${lotId}/${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage.from("lot-files").upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) throw new Error(friendlyError(up.error));
  const { data: u } = await supabase.auth.getUser();
  const ins = await supabase.from("files").insert({
    organization_id: org, lot_id: lotId, phase_id: phaseId, kind, title: title.trim() || file.name,
    storage_path: path, mime_type: file.type, size_bytes: file.size, uploaded_by: u.user?.id,
  });
  if (ins.error) {
    await supabase.storage.from("lot-files").remove([path]); // no orphan object
    throw new Error(friendlyError(ins.error));
  }
}
export async function signedFileUrl(path: string) {
  const { data, error } = await supabase.storage.from("lot-files").createSignedUrl(path, 300);
  if (error) throw new Error(friendlyError(error));
  return data.signedUrl;
}

// ───── Additional business operations used by the unified screens ─────
export const createLot = (name: string, qty: number, farm: string | null, parcel: string | null, variety: string, process: string, state: string, opKey: string) =>
  rpc<CloudLot>("create_lot", { _org: requireOrg(), _friendly_name: name, _qty_kg: qty, _farm_id: farm, _parcel_id: parcel, _variety: variety, _process_type: process, _physical_state: state, _harvest_ticket_id: null, _op_key: opKey });
export const logMoisture = (lot: string, pct: number, device: string | null, notes: string | null) => rpc("log_moisture", { _lot: lot, _pct: pct, _device: device, _notes: notes });
export const logWaste = (lot: string, qty: number, type: string, reason: string, destination: string) =>
  rpc("log_waste", { _lot: lot, _qty: qty, _waste_type: type, _reason: reason, _destination: destination });
export const adjustInventory = (lot: string, delta: number, reason: string) => rpc("adjust_inventory", { _lot: lot, _delta: delta, _reason: reason });
export const splitLot = (lot: string, parts: { qty_kg: number; name?: string }[]) => rpc("split_lot", { _lot: lot, _parts: parts });
export const mergeLots = (lots: string[], name: string) => rpc("merge_lots", { _lots: lots, _name: name });
export const saveProcessTemplate = (template: string | null, name: string, processType: string, description: string | null, phases: unknown[]) =>
  rpc("save_process_template", { _org: requireOrg(), _template: template, _name: name, _process_type: processType, _description: description, _phases: phases });
export const setReservationTerms = (id: string, delivery: string | null, conditions: string | null) =>
  rpc("set_reservation_terms", { _id: id, _delivery: delivery, _conditions: conditions });
export const setLotLocation = (lot: string, location: string) => rpc("set_lot_location", { _lot: lot, _location: location });
export const resolveAlert = (id: string) => rpc("resolve_alert", { _id: id });
export const createReservationFull = (a: { lot: string; customer: string; qty: number; price: number | null; currency: string | null; priceUnit: string; expires: string | null; notes: string | null }, opKey: string) =>
  rpc<{ id: string }>("create_reservation", { _lot: a.lot, _customer: a.customer, _qty: a.qty, _price: a.price, _currency: a.currency, _expires_at: a.expires, _notes: a.notes, _price_unit: a.priceUnit, _op_key: opKey });
