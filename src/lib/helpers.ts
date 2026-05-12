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
    case "fermentacion":
    case "secado":
    case "pergamino_humedo":
      return "info";
    case "pergamino_seco":
    case "trillado":
    case "verde":
      return "success";
    case "tostado":
      return "neutral";
    default:
      return "neutral";
  }
}

export function commercialStateTone(state: CommercialState): StatusTone {
  switch (state) {
    case "disponible":
      return "success";
    case "reservado":
    case "comprometido":
      return "info";
    case "en_proceso":
      return "warning";
    case "vendido":
      return "neutral";
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
};

export const commercialStateLabel: Record<CommercialState, string> = {
  no_disponible: "No disponible",
  en_proceso: "En proceso",
  disponible: "Disponible",
  reservado: "Reservado",
  comprometido: "Comprometido",
  vendido: "Vendido",
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
