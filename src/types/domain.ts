// Domain types — Bitácora Café Pro
// Designed to map 1:1 to Supabase tables when the backend is connected.

export type UUID = string;
export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string;

// ───────────── Enums ─────────────

export type OrganizationType = "finca" | "beneficio" | "cooperativa" | "exportador";
export type UserRole = "owner" | "admin" | "supervisor" | "operario" | "comercial" | "qc";
export type CustomerType = "tostador" | "exportador" | "cafeteria" | "distribuidor" | "otro";
export type UnitType = "weight" | "volume" | "count" | "custom";

export type ProcessType =
  | "lavado"
  | "honey"
  | "natural"
  | "anaerobico"
  | "experimental"
  | "custom";

export type PhysicalState =
  | "cereza"
  | "fermentacion"
  | "secado"
  | "pergamino_humedo"
  | "pergamino_seco"
  | "trillado"
  | "verde"
  | "tostado";

export type CommercialState =
  | "no_disponible"
  | "en_proceso"
  | "disponible"
  | "reservado"
  | "comprometido"
  | "vendido";

export type QualityStatus = "sin_evaluar" | "aprobado" | "observado" | "rechazado";

export type MovementType =
  | "ingreso"
  | "salida"
  | "ajuste"
  | "transformacion"
  | "merma"
  | "transferencia"
  | "reserva"
  | "liberacion";

export type AlertSeverity = "info" | "warning" | "danger";
export type AlertStatus = "open" | "acknowledged" | "resolved";

// ───────────── Core entities ─────────────

export interface Organization {
  id: UUID;
  name: string;
  type: OrganizationType;
  country: string;
  region: string | null;
  created_at: ISODateTime;
}

export interface Profile {
  id: UUID;
  full_name: string;
  role: UserRole;
  phone: string | null;
  organization_id: UUID;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Farm {
  id: UUID;
  organization_id: UUID;
  name: string;
  region: string | null;
  country: string;
  owner_name: string | null;
  altitude_m: number | null;
  notes: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Parcel {
  id: UUID;
  farm_id: UUID;
  name: string;
  variety: string | null;
  altitude_m: number | null;
  area_ha: number | null;
  notes: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Customer {
  id: UUID;
  organization_id: UUID;
  name: string;
  type: CustomerType;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  country: string | null;
  notes: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Unit {
  id: UUID;
  organization_id: UUID;
  name: string;
  symbol: string;
  unit_type: UnitType;
  /** kg per 1 unit. null when conversion is pending or volume-based. */
  kg_factor: number | null;
  /** liters per 1 unit when applicable. */
  liters_factor: number | null;
  /** True for units like fanega whose kg factor depends on local interpretation. */
  is_configurable: boolean;
  notes: string | null;
}

// ───────────── Harvest & lots ─────────────

export type HarvestKind = "harvest" | "intake";

export interface HarvestTicket {
  id: UUID;
  organization_id: UUID;
  /** "harvest" = recolección en campo. "intake" = recibo en beneficio. */
  kind: HarvestKind;
  farm_id: UUID;
  parcel_id: UUID | null;
  producer_name: string | null;
  harvest_date: ISODate;
  intake_datetime: ISODateTime;
  picker_or_team: string | null;
  variety: string | null;
  /** Original quantity as entered by the producer. NEVER overwrite. */
  qty_original: number;
  /** Original unit id (e.g. fanega, lata, cajuela). */
  uom_original_id: UUID;
  /** Canonical kg. May be null when pending weight confirmation. */
  qty_kg: number | null;
  /** Conversion factor used at the moment of registration. */
  conversion_factor_to_kg: number | null;
  /** "configured" | "weighed" | "estimated" | "pending" */
  conversion_basis: "configured" | "weighed" | "estimated" | "pending";
  maturity_level: "verde" | "pintón" | "maduro" | "sobremaduro" | "mezcla" | null;
  impurity_level: "baja" | "media" | "alta" | null;
  green_pct: number | null;
  overripe_pct: number | null;
  notes: string | null;
  photo_url: string | null;
  created_by: UUID | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface Lot {
  id: UUID;
  organization_id: UUID;
  lot_code: string;
  friendly_name: string;
  farm_id: UUID;
  parcel_id: UUID | null;
  harvest_ticket_id: UUID | null;
  parent_lot_id: UUID | null;
  producer_name: string | null;
  region: string | null;
  altitude_m: number | null;
  variety: string;

  process_template_id: UUID | null;
  process_instance_id: UUID | null;
  process_type: ProcessType;
  is_custom_process: boolean;

  physical_state: PhysicalState;
  commercial_state: CommercialState;
  quality_status: QualityStatus;

  qty_initial_kg: number;
  qty_current_kg: number;
  qty_blocked_kg: number;
  qty_reserved_kg: number;
  qty_committed_kg: number;
  qty_sold_kg: number;
  qty_free_kg: number;
  stock_safety_kg: number;

  current_moisture: number | null;
  current_phase_id: UUID | null;
  current_location: string | null;

  created_at: ISODateTime;
  updated_at: ISODateTime;
}

// ───────────── Processes ─────────────

export interface ProcessTemplate {
  id: UUID;
  organization_id: UUID;
  name: string;
  process_type: ProcessType;
  description: string | null;
  created_at: ISODateTime;
}

export interface ProcessTemplatePhase {
  id: UUID;
  template_id: UUID;
  name: string;
  order_index: number;
  expected_duration_hours: number | null;
  description: string | null;
}

export interface ProcessInstance {
  id: UUID;
  template_id: UUID | null;
  lot_id: UUID;
  started_at: ISODateTime;
  ended_at: ISODateTime | null;
  is_custom: boolean;
}

export interface ProcessPhaseInstance {
  id: UUID;
  process_instance_id: UUID;
  template_phase_id: UUID | null;
  name: string;
  order_index: number;
  started_at: ISODateTime;
  ended_at: ISODateTime | null;
  notes: string | null;
}

// ───────────── Variables & measurements ─────────────

export type VariableValueType = "number" | "text" | "select" | "boolean";

export interface VariableDefinition {
  id: UUID;
  organization_id: UUID;
  name: string;
  unit: string | null;
  value_type: VariableValueType;
  options: string[] | null;
  min_value: number | null;
  max_value: number | null;
  description: string | null;
}

export interface VariableLog {
  id: UUID;
  variable_id: UUID;
  lot_id: UUID;
  phase_instance_id: UUID | null;
  value_number: number | null;
  value_text: string | null;
  measured_at: ISODateTime;
  measured_by: UUID | null;
  notes: string | null;
}

export interface MoistureLog {
  id: UUID;
  lot_id: UUID;
  moisture_pct: number;
  measured_at: ISODateTime;
  measured_by: UUID | null;
  device: string | null;
  notes: string | null;
}

// ───────────── Stock, mermas, reservas ─────────────

export interface StockMovement {
  id: UUID;
  lot_id: UUID;
  movement_type: MovementType;
  qty_kg: number;
  qty_original: number | null;
  uom_original_id: UUID | null;
  reason: string | null;
  reference_id: UUID | null;
  created_by: UUID | null;
  created_at: ISODateTime;
}

export interface WasteLog {
  id: UUID;
  lot_id: UUID;
  qty_kg: number;
  reason: string;
  phase_instance_id: UUID | null;
  registered_at: ISODateTime;
  created_by: UUID | null;
  notes: string | null;
}

export type ReservationStatus = "activa" | "convertida" | "cancelada" | "vencida";

export interface Reservation {
  id: UUID;
  organization_id: UUID;
  lot_id: UUID;
  customer_id: UUID;
  qty_kg: number;
  status: ReservationStatus;
  reserved_at: ISODateTime;
  expires_at: ISODateTime | null;
  notes: string | null;
}

// ───────────── Calidad ─────────────

export interface QualitySample {
  id: UUID;
  lot_id: UUID;
  sampled_at: ISODateTime;
  cupper: string | null;
  score: number | null;
  notes: string | null;
  defects: string | null;
  status: QualityStatus;
}

// ───────────── Alertas y auditoría ─────────────

export interface Alert {
  id: UUID;
  organization_id: UUID;
  lot_id: UUID | null;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  created_at: ISODateTime;
  resolved_at: ISODateTime | null;
}

export interface AuditLogEntry {
  id: UUID;
  organization_id: UUID;
  actor_id: UUID | null;
  entity: string;
  entity_id: UUID;
  action: "create" | "update" | "delete";
  diff: Record<string, unknown> | null;
  created_at: ISODateTime;
}
