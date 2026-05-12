import { useSyncExternalStore } from "react";
import { mockDb } from "@/data/mock-data";
import type {
  Alert,
  AlertSeverity,
  AuditLogEntry,
  CommercialState,
  Customer,
  CustomerType,
  HarvestTicket,
  Lot,
  LotPublicProfile,
  MoistureLog,
  MovementType,
  PhaseStatus,
  PhysicalState,
  ProcessPhaseInstance,
  ProcessType,
  Reservation,
  ReservationStatus,
  StockMovement,
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
  customers: Customer[];
  reservations: Reservation[];
  stockMovements: StockMovement[];
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
  customers: [...mockDb.customers],
  reservations: [...mockDb.reservations],
  stockMovements: [...mockDb.stockMovements],
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

export interface LogWasteInput {
  lot_id: string;
  qty_kg: number;
  reason: string;
  waste_type?: import("@/types/domain").WasteType;
  destination?: import("@/types/domain").WasteDestination;
  qty_original?: number | null;
  qty_original_unit?: string | null;
  phase_instance_id?: string | null;
  responsible_user_id?: string | null;
  photo_url?: string | null;
  notes?: string | null;
}

export function logWaste(input: LogWasteInput): WasteLog {
  const log: WasteLog = {
    id: uid("w"),
    lot_id: input.lot_id,
    waste_type: input.waste_type ?? "otro",
    qty_kg: input.qty_kg,
    qty_original: input.qty_original ?? null,
    qty_original_unit: input.qty_original_unit ?? null,
    destination: input.destination ?? "descarte",
    reason: input.reason,
    phase_instance_id: input.phase_instance_id ?? null,
    responsible_user_id: input.responsible_user_id ?? "user-1",
    photo_url: input.photo_url ?? null,
    registered_at: nowIso(),
    created_by: "user-1",
    notes: input.notes ?? null,
  };
  state.wasteLogs.unshift(log);
  const lot = state.lots.find((l) => l.id === input.lot_id);
  if (lot) {
    const newCurrent = Math.max(0, lot.qty_current_kg - input.qty_kg);
    patchLot(input.lot_id, { qty_current_kg: newCurrent, qty_free_kg: Math.max(0, lot.qty_free_kg - input.qty_kg) });
    // Also append a stock movement so the lot history reflects it.
    const movType: import("@/types/domain").MovementType =
      input.waste_type === "muestra" ? "muestra"
      : input.waste_type === "descarte" ? "descarte"
      : input.waste_type === "reproceso" ? "reproceso"
      : input.waste_type === "ajuste" ? "ajuste"
      : "merma";
    state.stockMovements = [
      {
        id: uid("sm"),
        lot_id: input.lot_id,
        movement_type: movType,
        qty_kg: input.qty_kg,
        qty_original: input.qty_original ?? null,
        qty_original_unit: input.qty_original_unit ?? null,
        uom_original_id: null,
        from_state: lot.physical_state,
        to_state: null,
        from_location: lot.current_location,
        to_location: input.destination ?? null,
        reason: input.reason,
        notes: input.notes ?? null,
        reference_id: log.id,
        created_by: "user-1",
        created_at: nowIso(),
      },
      ...state.stockMovements,
    ];
  }
  pushAudit({
    organization_id: "org-1",
    actor_id: "user-1",
    entity: "waste_logs",
    entity_id: log.id,
    action: "create",
    diff: { qty_kg: log.qty_kg, reason: log.reason, waste_type: log.waste_type, destination: log.destination },
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

export function updateVariableDefinition(id: string, patch: Partial<Omit<VariableDefinition, "id" | "organization_id" | "is_default">>): void {
  state.variableDefinitions = state.variableDefinitions.map((d) =>
    d.id === id ? { ...d, ...patch } : d,
  );
  pushAudit({
    organization_id: "org-1",
    actor_id: "user-1",
    entity: "variable_definitions",
    entity_id: id,
    action: "update",
    diff: patch as Record<string, unknown>,
  });
  emit();
}

export function deactivateVariableDefinition(id: string): void {
  state.variableDefinitions = state.variableDefinitions.filter((d) => d.id !== id);
  pushAudit({
    organization_id: "org-1",
    actor_id: "user-1",
    entity: "variable_definitions",
    entity_id: id,
    action: "delete",
    diff: null,
  });
  emit();
}

// ───────────── Alerts ─────────────

export function raiseAlert(input: {
  lot_id: string | null;
  phase_instance_id: string | null;
  threshold_key: string;
  severity: AlertSeverity;
  title: string;
  message: string;
}): Alert | null {
  // dedupe by threshold key + lot + phase, only when status open
  const existing = state.alerts.find(
    (a) =>
      a.threshold_key === input.threshold_key &&
      a.lot_id === input.lot_id &&
      a.phase_instance_id === input.phase_instance_id &&
      a.status === "open",
  );
  if (existing) return null;
  const alert: Alert = {
    id: uid("a"),
    organization_id: "org-1",
    lot_id: input.lot_id,
    phase_instance_id: input.phase_instance_id,
    threshold_key: input.threshold_key,
    severity: input.severity,
    status: "open",
    title: input.title,
    message: input.message,
    created_at: nowIso(),
    resolved_at: null,
  };
  state.alerts = [alert, ...state.alerts];
  emit();
  return alert;
}

export function acknowledgeAlert(id: string): void {
  state.alerts = state.alerts.map((a) =>
    a.id === id ? { ...a, status: "acknowledged" } : a,
  );
  emit();
}

/**
 * Walk all running phases and create time-based alerts when elapsed crosses
 * the expected/max thresholds. Idempotent thanks to threshold_key dedupe.
 */
export function evaluateTimeAlertsForActivePhases(): void {
  let changed = false;
  for (const p of state.phases) {
    if (p.status !== "running" || !p.expected_minutes) continue;
    const lot = state.lots.find((l) => l.current_phase_id === p.id);
    if (!lot) continue;
    const el = elapsedMinutes(p);
    const exp = p.expected_minutes;
    const tryRaise = (key: string, sev: AlertSeverity, title: string, msg: string) => {
      const before = state.alerts.length;
      raiseAlert({
        lot_id: lot.id,
        phase_instance_id: p.id,
        threshold_key: key,
        severity: sev,
        title,
        message: msg,
      });
      if (state.alerts.length !== before) changed = true;
    };
    if (el > exp * 1.25) {
      tryRaise(
        `phase:critical:${p.id}`,
        "danger",
        `${p.name} muy atrasada`,
        `${lot.lot_code}: ${Math.round(el)} min vs. ${exp} esperados (>125%).`,
      );
    } else if (el > exp) {
      tryRaise(
        `phase:overdue:${p.id}`,
        "warning",
        `${p.name} fuera de tiempo`,
        `${lot.lot_code} superó la duración esperada de ${exp} min.`,
      );
    } else if (el > exp * 0.85) {
      tryRaise(
        `phase:near:${p.id}`,
        "info",
        `${p.name} cerca del límite`,
        `${lot.lot_code} a ${Math.round((el / exp) * 100)}% del tiempo esperado.`,
      );
    }
  }
  if (changed) emit();
}

export type PhaseStatusType = PhaseStatus;

// ───────────── Customers ─────────────

export interface CreateCustomerInput {
  name: string;
  type: CustomerType;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  country?: string | null;
  notes?: string | null;
}

export function createCustomer(input: CreateCustomerInput): Customer {
  const customer: Customer = {
    id: uid("cust"),
    organization_id: "org-1",
    name: input.name,
    type: input.type,
    contact_name: input.contact_name ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    country: input.country ?? null,
    notes: input.notes ?? null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  state.customers = [customer, ...state.customers];
  pushAudit({
    organization_id: "org-1",
    actor_id: "user-1",
    entity: "customers",
    entity_id: customer.id,
    action: "create",
    diff: { name: customer.name, type: customer.type },
  });
  emit();
  return customer;
}

export function updateCustomer(id: string, patch: Partial<CreateCustomerInput>): void {
  state.customers = state.customers.map((c) =>
    c.id === id ? { ...c, ...patch, updated_at: nowIso() } : c,
  );
  pushAudit({ organization_id: "org-1", actor_id: "user-1", entity: "customers", entity_id: id, action: "update", diff: patch as Record<string, unknown> });
  emit();
}

export function deleteCustomer(id: string): void {
  const used = state.reservations.some((r) => r.customer_id === id && (r.status === "reservada" || r.status === "activa" || r.status === "confirmada"));
  if (used) throw new Error("No se puede eliminar: el cliente tiene reservas activas.");
  state.customers = state.customers.filter((c) => c.id !== id);
  pushAudit({ organization_id: "org-1", actor_id: "user-1", entity: "customers", entity_id: id, action: "delete", diff: null });
  emit();
}

// ───────────── Stock movements ─────────────

export interface CreateStockMovementInput {
  lot_id: string;
  movement_type: MovementType;
  qty_kg: number;
  qty_original?: number | null;
  qty_original_unit?: string | null;
  uom_original_id?: string | null;
  from_state?: PhysicalState | null;
  to_state?: PhysicalState | null;
  from_location?: string | null;
  to_location?: string | null;
  reason?: string | null;
  notes?: string | null;
  reference_id?: string | null;
}

const ADJUST_REQUIRES_REASON: MovementType[] = ["ajuste", "merma", "descarte"];

export function createStockMovement(input: CreateStockMovementInput): StockMovement {
  const lot = state.lots.find((l) => l.id === input.lot_id);
  if (!lot) throw new Error("Lote no encontrado.");
  if (input.qty_kg <= 0) throw new Error("La cantidad debe ser mayor a 0.");
  if (ADJUST_REQUIRES_REASON.includes(input.movement_type) && !(input.reason && input.reason.trim())) {
    throw new Error("Este movimiento requiere una justificación.");
  }

  // Rules
  if (input.movement_type === "venta") {
    if (lot.commercial_state === "bloqueado_humedad" || lot.commercial_state === "bloqueado_calidad" || lot.commercial_state === "bloqueado_revision") {
      throw new Error("No se puede vender café bloqueado.");
    }
    const available = Math.max(0, lot.qty_current_kg - lot.qty_blocked_kg - lot.qty_reserved_kg - lot.qty_committed_kg - lot.stock_safety_kg);
    if (input.qty_kg > available) throw new Error("Cantidad mayor al inventario disponible.");
  }

  // Apply effects on lot
  const patch: Partial<Lot> = {};
  switch (input.movement_type) {
    case "entrada":
    case "ingreso":
      patch.qty_current_kg = lot.qty_current_kg + input.qty_kg;
      break;
    case "salida":
    case "merma":
    case "descarte":
    case "muestra":
      if (input.qty_kg > lot.qty_current_kg) throw new Error("No se permite inventario negativo.");
      patch.qty_current_kg = lot.qty_current_kg - input.qty_kg;
      break;
    case "venta":
      if (input.qty_kg > lot.qty_current_kg) throw new Error("No se permite inventario negativo.");
      patch.qty_current_kg = lot.qty_current_kg - input.qty_kg;
      patch.qty_sold_kg = lot.qty_sold_kg + input.qty_kg;
      patch.commercial_state = patch.qty_current_kg === 0 ? "vendido" : "vendido_parcial";
      break;
    case "ajuste":
      // signed: qty_kg can be negative if reason indicates so; here treat as absolute new current via reason
      patch.qty_current_kg = Math.max(0, lot.qty_current_kg + input.qty_kg);
      break;
    case "transferencia":
      if (input.to_location) patch.current_location = input.to_location;
      break;
    case "transformacion":
      if (input.to_state) patch.physical_state = input.to_state;
      break;
    case "reproceso":
      if (input.to_state) patch.physical_state = input.to_state;
      break;
    default:
      break;
  }
  if (Object.keys(patch).length) {
    const newCurrent = patch.qty_current_kg ?? lot.qty_current_kg;
    patch.qty_free_kg = Math.max(0, newCurrent - lot.qty_blocked_kg - lot.qty_reserved_kg - lot.qty_committed_kg - lot.stock_safety_kg);
    patchLot(lot.id, patch);
  }

  const mov: StockMovement = {
    id: uid("sm"),
    lot_id: input.lot_id,
    movement_type: input.movement_type,
    qty_kg: input.qty_kg,
    qty_original: input.qty_original ?? null,
    qty_original_unit: input.qty_original_unit ?? null,
    uom_original_id: input.uom_original_id ?? null,
    from_state: input.from_state ?? null,
    to_state: input.to_state ?? null,
    from_location: input.from_location ?? lot.current_location,
    to_location: input.to_location ?? null,
    reason: input.reason ?? null,
    notes: input.notes ?? null,
    reference_id: input.reference_id ?? null,
    created_by: "user-1",
    created_at: nowIso(),
  };
  state.stockMovements = [mov, ...state.stockMovements];
  pushAudit({ organization_id: "org-1", actor_id: "user-1", entity: "stock_movements", entity_id: mov.id, action: "create", diff: { type: mov.movement_type, qty_kg: mov.qty_kg, lot_id: mov.lot_id } });
  emit();
  return mov;
}

export function adjustInventory(lotId: string, deltaKg: number, reason: string): StockMovement {
  return createStockMovement({ lot_id: lotId, movement_type: "ajuste", qty_kg: deltaKg, reason });
}

// ───────────── Reservations ─────────────

export interface CreateReservationInput {
  lot_id: string;
  customer_id: string;
  qty_kg: number;
  qty_original?: number | null;
  qty_original_unit?: string | null;
  price?: number | null;
  currency?: string | null;
  expires_at?: string | null;
  notes?: string | null;
}

function availableForReservation(lot: Lot): number {
  return Math.max(0, lot.qty_current_kg - lot.qty_blocked_kg - lot.qty_reserved_kg - lot.qty_committed_kg - lot.stock_safety_kg);
}

export function createReservation(input: CreateReservationInput): Reservation {
  const lot = state.lots.find((l) => l.id === input.lot_id);
  if (!lot) throw new Error("Lote no encontrado.");
  if (input.qty_kg <= 0) throw new Error("La cantidad debe ser mayor a 0.");
  if (lot.commercial_state === "bloqueado_humedad" || lot.commercial_state === "bloqueado_calidad" || lot.commercial_state === "bloqueado_revision") {
    throw new Error("No se puede reservar café bloqueado.");
  }
  if (input.qty_kg > availableForReservation(lot)) {
    throw new Error("No hay inventario suficiente disponible para reservar.");
  }
  const res: Reservation = {
    id: uid("res"),
    organization_id: "org-1",
    lot_id: input.lot_id,
    customer_id: input.customer_id,
    qty_kg: input.qty_kg,
    qty_original: input.qty_original ?? null,
    qty_original_unit: input.qty_original_unit ?? null,
    price: input.price ?? null,
    currency: input.currency ?? null,
    status: "reservada",
    reserved_at: nowIso(),
    expires_at: input.expires_at ?? null,
    delivered_at: null,
    notes: input.notes ?? null,
  };
  state.reservations = [res, ...state.reservations];
  patchLot(lot.id, {
    qty_reserved_kg: lot.qty_reserved_kg + input.qty_kg,
    qty_free_kg: Math.max(0, lot.qty_free_kg - input.qty_kg),
    commercial_state: lot.commercial_state === "libre" || lot.commercial_state === "disponible" ? "reservado" : lot.commercial_state,
  });
  createStockMovement({ lot_id: lot.id, movement_type: "reserva", qty_kg: input.qty_kg, reason: `Reserva ${res.id}`, reference_id: res.id });
  emit();
  return res;
}

function isActiveStatus(s: ReservationStatus): boolean {
  return s === "reservada" || s === "activa" || s === "confirmada";
}

export function confirmReservation(id: string): void {
  state.reservations = state.reservations.map((r) =>
    r.id === id && isActiveStatus(r.status) ? { ...r, status: "confirmada" } : r,
  );
  emit();
}

export function cancelReservation(id: string, reason?: string): void {
  const res = state.reservations.find((r) => r.id === id);
  if (!res) return;
  if (!isActiveStatus(res.status)) throw new Error("Solo se pueden cancelar reservas activas.");
  state.reservations = state.reservations.map((r) => (r.id === id ? { ...r, status: "cancelada" } : r));
  const lot = state.lots.find((l) => l.id === res.lot_id);
  if (lot) {
    patchLot(lot.id, {
      qty_reserved_kg: Math.max(0, lot.qty_reserved_kg - res.qty_kg),
      qty_free_kg: lot.qty_free_kg + res.qty_kg,
    });
    createStockMovement({ lot_id: lot.id, movement_type: "liberacion_reserva", qty_kg: res.qty_kg, reason: reason ?? `Cancelación reserva ${res.id}`, reference_id: res.id });
  }
  emit();
}

export function deliverReservation(id: string, notes?: string): void {
  const res = state.reservations.find((r) => r.id === id);
  if (!res) return;
  if (!isActiveStatus(res.status)) throw new Error("Solo se pueden entregar reservas activas.");
  const lot = state.lots.find((l) => l.id === res.lot_id);
  if (!lot) return;
  // release reservation, then sell
  patchLot(lot.id, {
    qty_reserved_kg: Math.max(0, lot.qty_reserved_kg - res.qty_kg),
    qty_free_kg: lot.qty_free_kg + res.qty_kg,
  });
  createStockMovement({ lot_id: lot.id, movement_type: "venta", qty_kg: res.qty_kg, reason: notes ?? `Entrega reserva ${res.id}`, reference_id: res.id, to_location: "cliente" });
  state.reservations = state.reservations.map((r) =>
    r.id === id ? { ...r, status: "entregada", delivered_at: nowIso() } : r,
  );
  emit();
}

export function evaluateReservationExpirations(): void {
  let changed = false;
  const now = Date.now();
  state.reservations = state.reservations.map((r) => {
    if (!isActiveStatus(r.status) || !r.expires_at) return r;
    const exp = new Date(r.expires_at).getTime();
    if (exp < now) {
      changed = true;
      return { ...r, status: "vencida" };
    }
    if (exp - now < 1000 * 60 * 60 * 24 * 3) {
      raiseAlert({
        lot_id: r.lot_id,
        phase_instance_id: null,
        threshold_key: `reservation:near_expiry:${r.id}`,
        severity: "warning",
        title: "Reserva por vencer",
        message: `Reserva ${r.id} vence en menos de 3 días.`,
      });
    }
    return r;
  });
  if (changed) emit();
}

// ───────────── Quality samples ─────────────

export interface CreateQualitySampleInput {
  lot_id: string;
  sampled_at?: string;
  cupper?: string | null;
  score?: number | null;
  moisture_pct?: number | null;
  water_activity?: number | null;
  density?: number | null;
  screen_size?: string | null;
  primary_defects?: number | null;
  secondary_defects?: number | null;
  color?: string | null;
  smell?: string | null;
  tasting_notes?: string | null;
  defects?: string | null;
  status: import("@/types/domain").QualitySampleStatus;
  notes?: string | null;
  photo_urls?: string[];
  attachment_urls?: string[];
}

if (!(state as State & { qualitySamples?: import("@/types/domain").QualitySample[] }).qualitySamples) {
  (state as State & { qualitySamples: import("@/types/domain").QualitySample[] }).qualitySamples = [
    ...mockDb.qualitySamples,
  ];
}

export function getQualitySamples(): import("@/types/domain").QualitySample[] {
  return (state as State & { qualitySamples: import("@/types/domain").QualitySample[] }).qualitySamples;
}

export function useQualitySamples() {
  return useStore((s) => (s as State & { qualitySamples: import("@/types/domain").QualitySample[] }).qualitySamples ?? []);
}

function applyQualityToLot(lotId: string, status: import("@/types/domain").QualitySampleStatus): void {
  const lot = state.lots.find((l) => l.id === lotId);
  if (!lot) return;
  const patch: Partial<import("@/types/domain").Lot> = {};
  switch (status) {
    case "aprobado":
      patch.quality_status = "aprobado";
      if (lot.commercial_state === "bloqueado_calidad" || lot.commercial_state === "bloqueado_revision") {
        patch.commercial_state = "libre";
      }
      break;
    case "bloqueado":
      patch.quality_status = "observado";
      patch.commercial_state = "bloqueado_calidad";
      patch.qty_blocked_kg = lot.qty_current_kg;
      patch.qty_free_kg = 0;
      raiseAlert({
        lot_id: lotId,
        phase_instance_id: null,
        threshold_key: `quality:blocked:${lotId}`,
        severity: "warning",
        title: "Lote bloqueado por calidad",
        message: `${lot.lot_code} fue bloqueado por revisión de calidad.`,
      });
      break;
    case "rechazado":
      patch.quality_status = "rechazado";
      patch.commercial_state = "descartado";
      patch.qty_blocked_kg = lot.qty_current_kg;
      patch.qty_free_kg = 0;
      raiseAlert({
        lot_id: lotId,
        phase_instance_id: null,
        threshold_key: `quality:rejected:${lotId}`,
        severity: "danger",
        title: "Lote rechazado",
        message: `${lot.lot_code} fue rechazado en evaluación de calidad.`,
      });
      break;
    case "requiere_reproceso":
      patch.quality_status = "observado";
      patch.commercial_state = "bloqueado_revision";
      raiseAlert({
        lot_id: lotId,
        phase_instance_id: null,
        threshold_key: `quality:reprocess:${lotId}`,
        severity: "warning",
        title: "Lote requiere reproceso",
        message: `${lot.lot_code} requiere reproceso según calidad.`,
      });
      break;
    case "pendiente":
    case "sin_evaluar":
      patch.quality_status = "sin_evaluar";
      raiseAlert({
        lot_id: lotId,
        phase_instance_id: null,
        threshold_key: `quality:pending:${lotId}`,
        severity: "info",
        title: "Calidad pendiente",
        message: `${lot.lot_code} tiene una muestra pendiente de aprobación.`,
      });
      break;
    default:
      break;
  }
  if (Object.keys(patch).length) patchLot(lotId, patch);
}

export function createQualitySample(input: CreateQualitySampleInput): import("@/types/domain").QualitySample {
  const sample: import("@/types/domain").QualitySample = {
    id: uid("q"),
    lot_id: input.lot_id,
    sampled_at: input.sampled_at ?? nowIso(),
    cupper: input.cupper ?? null,
    score: input.score ?? null,
    moisture_pct: input.moisture_pct ?? null,
    water_activity: input.water_activity ?? null,
    density: input.density ?? null,
    screen_size: input.screen_size ?? null,
    primary_defects: input.primary_defects ?? null,
    secondary_defects: input.secondary_defects ?? null,
    color: input.color ?? null,
    smell: input.smell ?? null,
    tasting_notes: input.tasting_notes ?? null,
    defects: input.defects ?? null,
    status: input.status,
    notes: input.notes ?? null,
    photo_urls: input.photo_urls ?? [],
    attachment_urls: input.attachment_urls ?? [],
  };
  const list = getQualitySamples();
  (state as State & { qualitySamples: import("@/types/domain").QualitySample[] }).qualitySamples = [sample, ...list];

  if (input.moisture_pct != null) {
    const lot = state.lots.find((l) => l.id === input.lot_id);
    if (lot) patchLot(lot.id, { current_moisture: input.moisture_pct });
    if (input.moisture_pct > 12.5 || input.moisture_pct < 9) {
      raiseAlert({
        lot_id: input.lot_id,
        phase_instance_id: null,
        threshold_key: `quality:moisture:${sample.id}`,
        severity: "warning",
        title: "Humedad fuera de rango",
        message: `Muestra con humedad ${input.moisture_pct}% (rango ideal 9–12.5%).`,
      });
    }
  }
  if (input.water_activity != null && input.water_activity > 0.6) {
    raiseAlert({
      lot_id: input.lot_id,
      phase_instance_id: null,
      threshold_key: `quality:aw:${sample.id}`,
      severity: "warning",
      title: "Actividad de agua alta",
      message: `Aw ${input.water_activity} > 0.6. Riesgo microbiológico.`,
    });
  }
  applyQualityToLot(input.lot_id, input.status);
  pushAudit({
    organization_id: "org-1",
    actor_id: "user-1",
    entity: "quality_samples",
    entity_id: sample.id,
    action: "create",
    diff: { lot_id: sample.lot_id, status: sample.status, score: sample.score },
  });
  emit();
  return sample;
}

export function updateQualitySampleStatus(id: string, status: import("@/types/domain").QualitySampleStatus): void {
  const list = getQualitySamples();
  const sample = list.find((s) => s.id === id);
  if (!sample) return;
  (state as State & { qualitySamples: import("@/types/domain").QualitySample[] }).qualitySamples = list.map((s) =>
    s.id === id ? { ...s, status } : s,
  );
  applyQualityToLot(sample.lot_id, status);
  emit();
}

// ───────────── Lot public profiles (privacy-controlled) ─────────────

const publicProfiles: Record<string, LotPublicProfile> = {};

function defaultPublicProfile(lotId: string): LotPublicProfile {
  return {
    lot_id: lotId,
    is_public: true,
    short_story: null,
    tasting_notes: null,
    photo_urls: [],
    show_availability: false,
    show_moisture: true,
    show_quality: true,
    show_tasting_notes: true,
    show_photos: true,
    show_process_details: true,
    updated_at: nowIso(),
  };
}

export function getLotPublicProfile(lotId: string): LotPublicProfile {
  return publicProfiles[lotId] ?? defaultPublicProfile(lotId);
}

export function useLotPublicProfile(lotId: string): LotPublicProfile {
  return useStore(() => publicProfiles[lotId] ?? defaultPublicProfile(lotId));
}

export function updateLotPublicProfile(
  lotId: string,
  patch: Partial<Omit<LotPublicProfile, "lot_id" | "updated_at">>,
): LotPublicProfile {
  const current = publicProfiles[lotId] ?? defaultPublicProfile(lotId);
  const next: LotPublicProfile = { ...current, ...patch, updated_at: nowIso() };
  publicProfiles[lotId] = next;
  pushAudit({
    organization_id: "org-1",
    actor_id: "user-1",
    entity: "lot_public_profiles",
    entity_id: lotId,
    action: "update",
    diff: patch as Record<string, unknown>,
  });
  emit();
  return next;
}

// ───────────── Lot genealogy: split & merge ─────────────

function suffixForChildIndex(i: number): string {
  // 0 -> A, 1 -> B, ..., 25 -> Z, 26 -> AA
  let s = "";
  let n = i;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export interface SplitLotInput {
  parent_lot_id: string;
  parts: { qty_kg: number; friendly_name?: string | null; location?: string | null }[];
  reason?: string | null;
}

/**
 * Split a parent lot into N child lots. Child codes follow `<PARENT>-A`, `-B`, ...
 * Parent inventory is reduced by the total split amount.
 */
export function splitLot(input: SplitLotInput): Lot[] {
  const parent = state.lots.find((l) => l.id === input.parent_lot_id);
  if (!parent) throw new Error("Lote padre no encontrado.");
  const total = input.parts.reduce((a, b) => a + b.qty_kg, 0);
  if (total <= 0) throw new Error("Cantidades inválidas.");
  const available = parent.qty_current_kg - parent.qty_blocked_kg - parent.qty_reserved_kg - parent.qty_committed_kg;
  if (total > available) throw new Error("No hay suficiente café libre en el lote padre para dividir.");

  // Determine next suffix index based on existing children
  const existingChildren = state.lots.filter((l) => l.parent_lot_id === parent.id);
  const startIdx = existingChildren.length;

  const created: Lot[] = [];
  input.parts.forEach((part, i) => {
    if (part.qty_kg <= 0) return;
    const suffix = suffixForChildIndex(startIdx + i);
    const child: Lot = {
      ...parent,
      id: uid("lot"),
      lot_code: `${parent.lot_code}-${suffix}`,
      friendly_name: part.friendly_name?.trim() || `${parent.friendly_name} (${suffix})`,
      parent_lot_id: parent.id,
      harvest_ticket_id: null,
      process_instance_id: null,
      current_phase_id: null,
      qty_initial_kg: part.qty_kg,
      qty_current_kg: part.qty_kg,
      qty_blocked_kg: 0,
      qty_reserved_kg: 0,
      qty_committed_kg: 0,
      qty_sold_kg: 0,
      qty_free_kg: part.qty_kg,
      stock_safety_kg: 0,
      current_location: part.location ?? parent.current_location,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    state.lots = [child, ...state.lots];
    created.push(child);

    state.stockMovements = [
      {
        id: uid("sm"),
        lot_id: child.id,
        movement_type: "transformacion",
        qty_kg: part.qty_kg,
        qty_original: null,
        qty_original_unit: null,
        uom_original_id: null,
        from_state: parent.physical_state,
        to_state: child.physical_state,
        from_location: parent.current_location,
        to_location: child.current_location,
        reason: input.reason ?? `División desde ${parent.lot_code}`,
        notes: null,
        reference_id: parent.id,
        created_by: "user-1",
        created_at: nowIso(),
      },
      ...state.stockMovements,
    ];
  });

  patchLot(parent.id, {
    qty_current_kg: parent.qty_current_kg - total,
    qty_free_kg: Math.max(0, parent.qty_free_kg - total),
  });

  state.stockMovements = [
    {
      id: uid("sm"),
      lot_id: parent.id,
      movement_type: "salida",
      qty_kg: total,
      qty_original: null,
      qty_original_unit: null,
      uom_original_id: null,
      from_state: parent.physical_state,
      to_state: null,
      from_location: parent.current_location,
      to_location: null,
      reason: input.reason ?? `División en ${created.length} lotes`,
      notes: null,
      reference_id: created[0]?.id ?? null,
      created_by: "user-1",
      created_at: nowIso(),
    },
    ...state.stockMovements,
  ];

  pushAudit({
    organization_id: "org-1",
    actor_id: "user-1",
    entity: "lots",
    entity_id: parent.id,
    action: "update",
    diff: { split_into: created.map((c) => c.lot_code), total_kg: total },
  });
  emit();
  return created;
}

export interface MergeLotsInput {
  source_lot_ids: string[];
  /** kg to take from each source lot (parallel to source_lot_ids). */
  qty_kg_per_source: number[];
  friendly_name: string;
  reason?: string | null;
}

/**
 * Merge multiple parent lots into one new child lot. Stores the first source as
 * `parent_lot_id` and records all sources via stock movements + audit.
 */
export function mergeLots(input: MergeLotsInput): Lot {
  if (input.source_lot_ids.length < 2) throw new Error("Se requieren al menos 2 lotes para mezclar.");
  if (input.source_lot_ids.length !== input.qty_kg_per_source.length)
    throw new Error("Cantidades y lotes no coinciden.");
  const sources = input.source_lot_ids.map((id) => {
    const l = state.lots.find((x) => x.id === id);
    if (!l) throw new Error(`Lote ${id} no encontrado.`);
    return l;
  });
  const total = input.qty_kg_per_source.reduce((a, b) => a + b, 0);
  if (total <= 0) throw new Error("Cantidad inválida.");
  // Validate availability per source
  sources.forEach((src, i) => {
    const free = src.qty_current_kg - src.qty_blocked_kg - src.qty_reserved_kg - src.qty_committed_kg;
    if (input.qty_kg_per_source[i] > free) throw new Error(`Lote ${src.lot_code} no tiene suficiente café libre.`);
  });

  const primary = sources[0];
  const year = new Date().getFullYear();
  const seq = nextLotSequence(primary.process_type, year);
  const code = generateLotCode(primary.process_type, year, seq);

  const merged: Lot = {
    ...primary,
    id: uid("lot"),
    lot_code: code,
    friendly_name: input.friendly_name,
    parent_lot_id: primary.id,
    harvest_ticket_id: null,
    process_instance_id: null,
    current_phase_id: null,
    qty_initial_kg: total,
    qty_current_kg: total,
    qty_blocked_kg: 0,
    qty_reserved_kg: 0,
    qty_committed_kg: 0,
    qty_sold_kg: 0,
    qty_free_kg: total,
    stock_safety_kg: 0,
    commercial_state: "en_proceso",
    quality_status: "sin_evaluar",
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  state.lots = [merged, ...state.lots];

  // Reduce sources and add stock movements
  sources.forEach((src, i) => {
    const qty = input.qty_kg_per_source[i];
    patchLot(src.id, {
      qty_current_kg: src.qty_current_kg - qty,
      qty_free_kg: Math.max(0, src.qty_free_kg - qty),
    });
    state.stockMovements = [
      {
        id: uid("sm"),
        lot_id: src.id,
        movement_type: "salida",
        qty_kg: qty,
        qty_original: null,
        qty_original_unit: null,
        uom_original_id: null,
        from_state: src.physical_state,
        to_state: null,
        from_location: src.current_location,
        to_location: null,
        reason: input.reason ?? `Mezclado en ${merged.lot_code}`,
        notes: null,
        reference_id: merged.id,
        created_by: "user-1",
        created_at: nowIso(),
      },
      ...state.stockMovements,
    ];
  });

  state.stockMovements = [
    {
      id: uid("sm"),
      lot_id: merged.id,
      movement_type: "entrada",
      qty_kg: total,
      qty_original: null,
      qty_original_unit: null,
      uom_original_id: null,
      from_state: null,
      to_state: merged.physical_state,
      from_location: null,
      to_location: merged.current_location,
      reason: input.reason ?? `Mezcla de ${sources.map((s) => s.lot_code).join(", ")}`,
      notes: null,
      reference_id: primary.id,
      created_by: "user-1",
      created_at: nowIso(),
    },
    ...state.stockMovements,
  ];

  pushAudit({
    organization_id: "org-1",
    actor_id: "user-1",
    entity: "lots",
    entity_id: merged.id,
    action: "create",
    diff: {
      merged_from: sources.map((s, i) => ({ code: s.lot_code, qty_kg: input.qty_kg_per_source[i] })),
      total_kg: total,
    },
  });
  emit();
  return merged;
}

export function findLotByCode(code: string): Lot | undefined {
  return state.lots.find((l) => l.lot_code.toLowerCase() === code.toLowerCase());
}
