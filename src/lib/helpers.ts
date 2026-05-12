import type {
  AlertSeverity,
  CommercialState,
  Lot,
  PhysicalState,
  ProcessPhaseInstance,
  QualityStatus,
  Unit,
} from "@/types/domain";

// ───────────── Inventory ─────────────

/**
 * Canonical inventory formula:
 * available = current - blocked - reserved - committed - safety
 * (sold is already deducted from current_kg by stock movements)
 */
export function calcAvailableKg(lot: Pick<
  Lot,
  "qty_current_kg" | "qty_blocked_kg" | "qty_reserved_kg" | "qty_committed_kg" | "stock_safety_kg"
>): number {
  const available =
    lot.qty_current_kg -
    lot.qty_blocked_kg -
    lot.qty_reserved_kg -
    lot.qty_committed_kg -
    lot.stock_safety_kg;
  return Math.max(0, round2(available));
}

export function calcYieldPct(initialKg: number, currentKg: number): number | null {
  if (!initialKg || initialKg <= 0) return null;
  return round2((currentKg / initialKg) * 100);
}

// ───────────── Unit conversion ─────────────

/**
 * Convert original quantity to kg using the unit's kg_factor when defined.
 * Returns null when conversion is not possible (e.g. fanega without local factor).
 */
export function toKg(qtyOriginal: number, unit: Pick<Unit, "kg_factor">): number | null {
  if (unit.kg_factor == null) return null;
  return round2(qtyOriginal * unit.kg_factor);
}

export function fromKg(qtyKg: number, unit: Pick<Unit, "kg_factor">): number | null {
  if (!unit.kg_factor) return null;
  return round2(qtyKg / unit.kg_factor);
}

// ───────────── Lot codes ─────────────

const PROCESS_PREFIX: Record<string, string> = {
  lavado: "LAV",
  honey: "HNY",
  natural: "NAT",
  anaerobico: "ANA",
  experimental: "EXP",
  custom: "CST",
};

/**
 * Generates a lot code like "NAT-2026-001".
 * `sequence` should come from the org's lot counter for the year.
 */
export function generateLotCode(processType: string, year: number, sequence: number): string {
  const prefix = PROCESS_PREFIX[processType] ?? "LOT";
  return `${prefix}-${year}-${String(sequence).padStart(3, "0")}`;
}

// ───────────── Phase duration ─────────────

export function phaseDurationHours(phase: Pick<ProcessPhaseInstance, "started_at" | "ended_at">): number {
  const start = new Date(phase.started_at).getTime();
  const end = phase.ended_at ? new Date(phase.ended_at).getTime() : Date.now();
  return round2((end - start) / (1000 * 60 * 60));
}

export function phaseDurationDays(phase: Pick<ProcessPhaseInstance, "started_at" | "ended_at">): number {
  return round2(phaseDurationHours(phase) / 24);
}

// ───────────── Status color mapping ─────────────
// Returns Tailwind-friendly tokens that map to the design system.

type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export function physicalStateTone(state: PhysicalState): StatusTone {
  switch (state) {
    case "cereza":
    case "cafe_fruta":
    case "cafe_seleccionado":
    case "cafe_despulpado":
    case "cafe_en_baba":
    case "fermentacion":
    case "secado":
    case "pergamino_humedo":
    case "pergamino_en_secado":
      return "info";
    case "pergamino_seco":
    case "trillado":
    case "verde":
    case "oro_verde":
    case "en_reposo":
      return "success";
    case "tostado":
    case "muestra":
    case "subproducto":
      return "neutral";
    case "merma":
    case "descarte":
      return "danger";
    default:
      return "neutral";
  }
}

export function commercialStateTone(state: CommercialState): StatusTone {
  switch (state) {
    case "disponible":
    case "libre":
      return "success";
    case "reservado":
    case "comprometido":
      return "info";
    case "vendido_parcial":
    case "en_proceso":
      return "warning";
    case "vendido":
      return "neutral";
    case "bloqueado_humedad":
    case "bloqueado_calidad":
    case "bloqueado_revision":
    case "descartado":
    case "no_disponible":
      return "danger";
    default:
      return "neutral";
  }
}

export function qualityTone(status: QualityStatus): StatusTone {
  switch (status) {
    case "aprobado":
      return "success";
    case "observado":
      return "warning";
    case "rechazado":
      return "danger";
    case "sin_evaluar":
    default:
      return "neutral";
  }
}

export function alertTone(severity: AlertSeverity): StatusTone {
  return severity === "danger" ? "danger" : severity === "warning" ? "warning" : "info";
}

// ───────────── Alert severity from value vs threshold ─────────────

/**
 * Map a measurement against expected range to an alert severity.
 * Used for moisture, temperature, pH, etc.
 */
export function severityForRange(
  value: number,
  range: { min?: number; max?: number; warnMargin?: number },
): AlertSeverity | null {
  const warn = range.warnMargin ?? 0;
  if (range.min != null && value < range.min - warn) return "danger";
  if (range.max != null && value > range.max + warn) return "danger";
  if (range.min != null && value < range.min) return "warning";
  if (range.max != null && value > range.max) return "warning";
  return null;
}

// ───────────── Friendly labels (Spanish) ─────────────

export const physicalStateLabel: Record<PhysicalState, string> = {
  cereza: "Cereza",
  fermentacion: "Fermentación",
  secado: "Secado",
  pergamino_humedo: "Pergamino húmedo",
  pergamino_seco: "Pergamino seco",
  trillado: "Trillado",
  verde: "Verde",
  tostado: "Tostado",
  cafe_fruta: "Café fruta",
  cafe_seleccionado: "Café seleccionado",
  cafe_despulpado: "Café despulpado",
  cafe_en_baba: "Café en baba",
  pergamino_en_secado: "Pergamino en secado",
  en_reposo: "En reposo",
  oro_verde: "Oro verde",
  muestra: "Muestra",
  subproducto: "Subproducto",
  merma: "Merma",
  descarte: "Descarte",
};

export const commercialStateLabel: Record<CommercialState, string> = {
  no_disponible: "No disponible",
  en_proceso: "En proceso",
  disponible: "Disponible",
  reservado: "Reservado",
  comprometido: "Comprometido",
  vendido: "Vendido",
  libre: "Libre",
  bloqueado_humedad: "Bloqueado por humedad",
  bloqueado_calidad: "Bloqueado por calidad",
  bloqueado_revision: "Bloqueado por revisión",
  vendido_parcial: "Vendido parcialmente",
  descartado: "Descartado",
};

export const locationLabel: Record<string, string> = {
  finca: "Finca",
  recibo: "Recibo",
  tanque: "Tanque",
  patio: "Patio",
  cama_africana: "Cama africana",
  secadora: "Secadora",
  bodega: "Bodega",
  trilla: "Trilla",
  empaque: "Empaque",
  cliente: "Cliente",
  otra: "Otra",
};

export const movementTypeLabel: Record<string, string> = {
  entrada: "Entrada",
  ingreso: "Entrada",
  salida: "Salida",
  ajuste: "Ajuste",
  transformacion: "Transformación",
  transferencia: "Transferencia",
  reserva: "Reserva",
  liberacion: "Liberación de reserva",
  liberacion_reserva: "Liberación de reserva",
  venta: "Venta",
  merma: "Merma",
  muestra: "Muestra",
  descarte: "Descarte",
  reproceso: "Reproceso",
};

export const reservationStatusLabel: Record<string, string> = {
  reservada: "Reservada",
  activa: "Reservada",
  confirmada: "Confirmada",
  entregada: "Entregada",
  convertida: "Entregada",
  cancelada: "Cancelada",
  vencida: "Vencida",
};

export const customerTypeLabel: Record<string, string> = {
  tostador: "Tostador",
  exportador: "Exportador",
  cafeteria: "Cafetería",
  distribuidor: "Distribuidor",
  consumidor: "Consumidor",
  otro: "Otro",
};

export const qualityStatusLabel: Record<QualityStatus, string> = {
  sin_evaluar: "Sin evaluar",
  aprobado: "Aprobado",
  observado: "Observado",
  rechazado: "Rechazado",
};

// ───────────── Utils ─────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatKg(kg: number | null | undefined): string {
  if (kg == null) return "—";
  return `${kg.toLocaleString("es", { maximumFractionDigits: 1 })} kg`;
}

// ───────────── Quality sample status ─────────────

import type { QualitySampleStatus, WasteType, WasteDestination } from "@/types/domain";

export const sampleStatusLabel: Record<QualitySampleStatus, string> = {
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  bloqueado: "Bloqueado",
  rechazado: "Rechazado",
  requiere_reproceso: "Requiere reproceso",
  sin_evaluar: "Pendiente",
  observado: "Observado",
};

export function sampleStatusTone(s: QualitySampleStatus): "success" | "warning" | "danger" | "info" | "neutral" {
  switch (s) {
    case "aprobado":
      return "success";
    case "rechazado":
      return "danger";
    case "bloqueado":
    case "requiere_reproceso":
    case "observado":
      return "warning";
    case "pendiente":
    case "sin_evaluar":
    default:
      return "neutral";
  }
}

export const wasteTypeLabel: Record<WasteType, string> = {
  pulpa: "Pulpa",
  mucilago: "Mucílago",
  agua_miel: "Agua miel",
  perdida_secado: "Pérdida por secado",
  cisco: "Cisco / cascarilla",
  defectos: "Defectos",
  muestra: "Muestra",
  descarte: "Descarte",
  ajuste: "Ajuste de inventario",
  reproceso: "Reproceso",
  otro: "Otro",
};

export const wasteDestinationLabel: Record<WasteDestination, string> = {
  compost: "Compost",
  venta: "Venta",
  descarte: "Descarte",
  muestra: "Muestra",
  consumo_interno: "Consumo interno",
  otro: "Otro",
};

// ───────────── Yield helpers ─────────────

export interface YieldBreakdown {
  fruit_to_parchment_pct: number | null; // cereza → pergamino seco
  parchment_to_green_pct: number | null; // pergamino seco → oro verde
  green_to_roasted_pct: number | null;   // oro verde → tostado
  total_yield_pct: number | null;        // current vs initial
}

const PARCHMENT_STATES = new Set(["pergamino_seco", "pergamino_humedo", "pergamino_en_secado", "trillado", "en_reposo"]);
const GREEN_STATES = new Set(["verde", "oro_verde"]);
const ROASTED_STATES = new Set(["tostado"]);

export function computeYieldBreakdown(args: {
  initial_kg: number;
  current_kg: number;
  physical_state: string;
}): YieldBreakdown {
  const { initial_kg, current_kg, physical_state } = args;
  const total = initial_kg > 0 ? round2((current_kg / initial_kg) * 100) : null;
  let fruit_to_parchment: number | null = null;
  let parchment_to_green: number | null = null;
  let green_to_roasted: number | null = null;
  if (PARCHMENT_STATES.has(physical_state) && initial_kg > 0) {
    fruit_to_parchment = round2((current_kg / initial_kg) * 100);
  }
  if (GREEN_STATES.has(physical_state) && initial_kg > 0) {
    // estimate parchment as ~current * 1.18 if we had history; fallback to a typical ratio of green vs parchment ~0.8
    parchment_to_green = round2((current_kg / (current_kg / 0.8)) * 100); // ≈ 80%
    fruit_to_parchment = round2((current_kg / 0.8 / initial_kg) * 100);
  }
  if (ROASTED_STATES.has(physical_state) && initial_kg > 0) {
    green_to_roasted = round2((current_kg / (current_kg / 0.84)) * 100);
  }
  return {
    fruit_to_parchment_pct: fruit_to_parchment,
    parchment_to_green_pct: parchment_to_green,
    green_to_roasted_pct: green_to_roasted,
    total_yield_pct: total,
  };
}

