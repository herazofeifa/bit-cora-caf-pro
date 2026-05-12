import { useSyncExternalStore } from "react";
import { mockDb } from "@/data/mock-data";
import type {
  Alert,
  AlertSeverity,
  AuditLogEntry,
  HarvestTicket,
  Lot,
  MoistureLog,
  PhaseStatus,
  ProcessPhaseInstance,
  ProcessType,
  VariableDefinition,
  VariableLog,
  WasteLog,
} from "@/types/domain";
import { generateLotCode } from "@/lib/helpers";

interface State {
  harvestTickets: HarvestTicket[];
  lots: Lot[];
  audit: AuditLogEntry[];
  phases: ProcessPhaseInstance[];
  variableLogs: VariableLog[];
  variableDefinitions: VariableDefinition[];
  moistureLogs: MoistureLog[];
  wasteLogs: WasteLog[];
  alerts: Alert[];
}

const state: State = {
  harvestTickets: [...mockDb.harvestTickets],
  lots: [...mockDb.lots],
  audit: [],
  phases: [...mockDb.processPhaseInstances],
  variableLogs: [...mockDb.variableLogs],
  variableDefinitions: [...mockDb.variableDefinitions],
  moistureLogs: [...mockDb.moistureLogs],
  wasteLogs: [...mockDb.wasteLogs],
  alerts: [...mockDb.alerts],
};

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const emit = () => listeners.forEach((l) => l());

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  );
}

export function getStoreSnapshot(): State {
  return state;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function pushAudit(entry: Omit<AuditLogEntry, "id" | "created_at">) {
  state.audit.unshift({ ...entry, id: uid("aud"), created_at: nowIso() });
}

export function nextLotSequence(processType: ProcessType, year: number): number {
  const code = generateLotCode(processType, year, 1);
  const prefix = code.split("-")[0];
  const existing = state.lots
    .filter((l) => l.lot_code.startsWith(`${prefix}-${year}-`))
    .map((l) => parseInt(l.lot_code.split("-")[2] ?? "0", 10) || 0);
  return Math.max(0, ...existing) + 1;
}

export interface CreateHarvestInput
  extends Omit<HarvestTicket, "id" | "created_at" | "updated_at" | "organization_id"> {}

export function createHarvestTicket(input: CreateHarvestInput): HarvestTicket {
  const orgId = state.lots[0]?.organization_id ?? "org-1";
  const ticket: HarvestTicket = {
    ...input,
    id: uid("ht"),
    organization_id: orgId,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  state.harvestTickets.unshift(ticket);
  pushAudit({
    organization_id: orgId,
    actor_id: input.created_by,
    entity: "harvest_tickets",
    entity_id: ticket.id,
    action: "create",
    diff: { kind: ticket.kind, qty_original: ticket.qty_original, farm_id: ticket.farm_id },
  });
  emit();
  return ticket;
}

export interface CreateLotInput {
  friendly_name: string;
  variety: string;
  process_type: ProcessType;
  farm_id: string;
  parcel_id: string | null;
  region: string | null;
  altitude_m: number | null;
  producer_name: string | null;
  harvest_ticket_id: string | null;
  qty_initial_kg: number;
  current_location: string | null;
}

export function createLot(input: CreateLotInput): Lot {
  const orgId = state.lots[0]?.organization_id ?? "org-1";
  const year = new Date().getFullYear();
  const seq = nextLotSequence(input.process_type, year);
  const lot_code = generateLotCode(input.process_type, year, seq);

  const lot: Lot = {
    id: uid("lot"),
    organization_id: orgId,
    lot_code,
    friendly_name: input.friendly_name,
    farm_id: input.farm_id,
    parcel_id: input.parcel_id,
    harvest_ticket_id: input.harvest_ticket_id,
    parent_lot_id: null,
    producer_name: input.producer_name,
    region: input.region,
    altitude_m: input.altitude_m,
    variety: input.variety,
    process_template_id: null,
    process_instance_id: null,
    process_type: input.process_type,
    is_custom_process: input.process_type === "custom",
    physical_state: "cereza",
    commercial_state: "en_proceso",
    quality_status: "sin_evaluar",
    qty_initial_kg: input.qty_initial_kg,
    qty_current_kg: input.qty_initial_kg,
    qty_blocked_kg: 0,
    qty_reserved_kg: 0,
    qty_committed_kg: 0,
    qty_sold_kg: 0,
    qty_free_kg: input.qty_initial_kg,
    stock_safety_kg: 0,
    current_moisture: null,
    current_phase_id: null,
    current_location: input.current_location,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  state.lots.unshift(lot);
  pushAudit({
    organization_id: orgId,
    actor_id: null,
    entity: "lots",
    entity_id: lot.id,
    action: "create",
    diff: { lot_code: lot.lot_code, variety: lot.variety, process_type: lot.process_type },
  });
  emit();
  return lot;
}

// ───────────── Phase execution ─────────────

function findPhase(phaseId: string): ProcessPhaseInstance | undefined {
  return state.phases.find((p) => p.id === phaseId);
}

function patchPhase(phaseId: string, patch: Partial<ProcessPhaseInstance>) {
  state.phases = state.phases.map((p) => (p.id === phaseId ? { ...p, ...patch } : p));
}

function patchLot(lotId: string, patch: Partial<Lot>) {
  state.lots = state.lots.map((l) => (l.id === lotId ? { ...l, ...patch, updated_at: nowIso() } : l));
}

export function elapsedMinutes(p: Pick<ProcessPhaseInstance, "started_at" | "ended_at" | "paused_at" | "total_paused_minutes" | "status">): number {
  const start = new Date(p.started_at).getTime();
  const end = p.ended_at
    ? new Date(p.ended_at).getTime()
    : p.status === "paused" && p.paused_at
    ? new Date(p.paused_at).getTime()
    : Date.now();
  const raw = (end - start) / 60000;
  return Math.max(0, Math.round(raw - (p.total_paused_minutes ?? 0)));
}

export type TimeStatus = "ontime" | "near" | "overdue" | "finished_outside";

export function timeStatus(p: Pick<ProcessPhaseInstance, "started_at" | "ended_at" | "paused_at" | "total_paused_minutes" | "status" | "expected_minutes">): TimeStatus {
  const elapsed = elapsedMinutes(p);
  const exp = p.expected_minutes ?? 0;
  if (p.status === "finished") {
    if (!exp) return "ontime";
    if (elapsed > exp * 1.1 || elapsed < exp * 0.5) return "finished_outside";
    return "ontime";
  }
  if (!exp) return "ontime";
  if (elapsed > exp) return "overdue";
  if (elapsed > exp * 0.85) return "near";
  return "ontime";
}

export function startPhase(input: {
  lot_id: string;
  name: string;
  process_instance_id: string;
  expected_minutes: number | null;
  location?: string | null;
  notes?: string | null;
}): ProcessPhaseInstance {
  const order = state.phases.filter((p) => p.process_instance_id === input.process_instance_id).length + 1;
  const phase: ProcessPhaseInstance = {
    id: uid("ph"),
    process_instance_id: input.process_instance_id,
    template_phase_id: null,
    name: input.name,
    order_index: order,
    started_at: nowIso(),
    ended_at: null,
    paused_at: null,
    resumed_at: null,
    total_paused_minutes: 0,
    expected_minutes: input.expected_minutes,
    status: "running",
    responsible_user_id: "user-1",
    location: input.location ?? null,
    notes: input.notes ?? null,
  };
  state.phases.unshift(phase);
  patchLot(input.lot_id, { current_phase_id: phase.id });
  pushAudit({
    organization_id: "org-1",
    actor_id: "user-1",
    entity: "process_phase_instances",
    entity_id: phase.id,
    action: "create",
    diff: { name: phase.name, lot_id: input.lot_id },
  });
  emit();
  return phase;
}

export function pausePhase(phaseId: string, reason?: string): void {
  const p = findPhase(phaseId);
  if (!p || p.status !== "running") return;
  patchPhase(phaseId, { status: "paused", paused_at: nowIso() });
  pushAudit({
    organization_id: "org-1",
    actor_id: "user-1",
    entity: "process_phase_instances",
    entity_id: phaseId,
    action: "update",
    diff: { status: "paused", reason: reason ?? null },
  });
  emit();
}

export function resumePhase(phaseId: string): void {
  const p = findPhase(phaseId);
  if (!p || p.status !== "paused" || !p.paused_at) return;
  const pausedFor = Math.round((Date.now() - new Date(p.paused_at).getTime()) / 60000);
  patchPhase(phaseId, {
    status: "running",
    resumed_at: nowIso(),
    paused_at: null,
    total_paused_minutes: (p.total_paused_minutes ?? 0) + pausedFor,
  });
  pushAudit({
    organization_id: "org-1",
    actor_id: "user-1",
    entity: "process_phase_instances",
    entity_id: phaseId,
    action: "update",
    diff: { status: "running", paused_minutes_added: pausedFor },
  });
  emit();
}

export interface PhaseTransitionCheck {
  ok: boolean;
  warnings: string[];
  blockers: string[];
  next_phase_name: string | null;
}

/**
 * Validate the move from the current phase to the next phase, using the
 * legacy template phase order linked to the lot's process instance.
 */
export function validatePhaseTransition(phaseId: string): PhaseTransitionCheck {
  const phase = findPhase(phaseId);
  if (!phase) return { ok: true, warnings: [], blockers: [], next_phase_name: null };
  const instance = mockDb.processInstances.find((p) => p.id === phase.process_instance_id);
  if (!instance?.template_id) return { ok: true, warnings: [], blockers: [], next_phase_name: null };
  const tpls = mockDb.processTemplatePhases
    .filter((t) => t.template_id === instance.template_id)
    .sort((a, b) => a.order_index - b.order_index);
  const idx = tpls.findIndex((t) => t.id === phase.template_phase_id);
  if (idx < 0) return { ok: true, warnings: [], blockers: [], next_phase_name: null };
  const nextTpl = tpls[idx + 1] ?? null;
  const warnings: string[] = [];
  if (!nextTpl) warnings.push("Esta es la última fase del proceso. Al finalizar, el lote queda disponible.");
  return { ok: true, warnings, blockers: [], next_phase_name: nextTpl?.name ?? null };
}

export function finishPhase(input: {
  phase_id: string;
  lot_id: string;
  notes?: string | null;
  override_reason?: string | null;
}): void {
  const p = findPhase(input.phase_id);
  if (!p) return;
  patchPhase(input.phase_id, {
    status: "finished",
    ended_at: nowIso(),
    notes: input.notes ?? p.notes,
  });
  pushAudit({
    organization_id: "org-1",
    actor_id: "user-1",
    entity: "process_phase_instances",
    entity_id: input.phase_id,
    action: "update",
    diff: {
      status: "finished",
      override_reason: input.override_reason ?? null,
      elapsed_minutes: elapsedMinutes(p),
    },
  });
  // Resolve any open time alerts tied to this phase
  state.alerts = state.alerts.map((a) =>
    a.phase_instance_id === input.phase_id && a.status === "open"
      ? { ...a, status: "resolved", resolved_at: nowIso() }
      : a,
  );
  emit();
}

export function logVariable(input: {
  variable_id: string;
  lot_id: string;
  phase_instance_id: string | null;
  value_number?: number | null;
  value_text?: string | null;
  value_options?: string[] | null;
  value_boolean?: boolean | null;
  value_datetime?: string | null;
  photo_url?: string | null;
  file_url?: string | null;
  notes?: string | null;
}): VariableLog {
  const log: VariableLog = {
    id: uid("vl"),
    variable_id: input.variable_id,
    lot_id: input.lot_id,
    phase_instance_id: input.phase_instance_id,
    value_number: input.value_number ?? null,
    value_text: input.value_text ?? null,
    value_options: input.value_options ?? null,
    value_boolean: input.value_boolean ?? null,
    value_datetime: input.value_datetime ?? null,
    photo_url: input.photo_url ?? null,
    file_url: input.file_url ?? null,
    measured_at: nowIso(),
    measured_by: "user-1",
    notes: input.notes ?? null,
  };
  state.variableLogs.unshift(log);
  pushAudit({
    organization_id: "org-1",
    actor_id: "user-1",
    entity: "variable_logs",
    entity_id: log.id,
    action: "create",
    diff: { variable_id: log.variable_id, lot_id: log.lot_id },
  });
  emit();
  return log;
}

export function logMoisture(input: {
  lot_id: string;
  moisture_pct: number;
  device?: string | null;
  notes?: string | null;
}): MoistureLog {
  const log: MoistureLog = {
    id: uid("ml"),
    lot_id: input.lot_id,
    moisture_pct: input.moisture_pct,
    measured_at: nowIso(),
    measured_by: "user-1",
    device: input.device ?? null,
    notes: input.notes ?? null,
  };
  state.moistureLogs.unshift(log);
  patchLot(input.lot_id, { current_moisture: input.moisture_pct });
  pushAudit({
    organization_id: "org-1",
    actor_id: "user-1",
    entity: "moisture_logs",
    entity_id: log.id,
    action: "create",
    diff: { moisture_pct: log.moisture_pct },
  });
  emit();
  return log;
}

export function logWaste(input: {
  lot_id: string;
  qty_kg: number;
  reason: string;
  phase_instance_id?: string | null;
  notes?: string | null;
}): WasteLog {
  const log: WasteLog = {
    id: uid("w"),
    lot_id: input.lot_id,
    qty_kg: input.qty_kg,
    reason: input.reason,
    phase_instance_id: input.phase_instance_id ?? null,
    registered_at: nowIso(),
    created_by: "user-1",
    notes: input.notes ?? null,
  };
  state.wasteLogs.unshift(log);
  const lot = state.lots.find((l) => l.id === input.lot_id);
  if (lot) {
    const newCurrent = Math.max(0, lot.qty_current_kg - input.qty_kg);
    patchLot(input.lot_id, { qty_current_kg: newCurrent, qty_free_kg: Math.max(0, lot.qty_free_kg - input.qty_kg) });
  }
  pushAudit({
    organization_id: "org-1",
    actor_id: "user-1",
    entity: "waste_logs",
    entity_id: log.id,
    action: "create",
    diff: { qty_kg: log.qty_kg, reason: log.reason },
  });
  emit();
  return log;
}

export function createVariableDefinition(input: Omit<VariableDefinition, "id" | "is_default" | "organization_id">): VariableDefinition {
  const def: VariableDefinition = {
    ...input,
    id: uid("v"),
    organization_id: "org-1",
    is_default: false,
  };
  state.variableDefinitions.unshift(def);
  emit();
  return def;
}

export type PhaseStatusType = PhaseStatus;
