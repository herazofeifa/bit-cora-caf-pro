import { useSyncExternalStore } from "react";
import { mockDb } from "@/data/mock-data";
import type {
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
