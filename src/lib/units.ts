import type { ProcessType } from "@/types/domain";

export interface UnitOption {
  id: string;
  label: string;
  /** kg per 1 unit. null when configurable / unknown (e.g. fanega). */
  kg_factor: number | null;
  configurable?: boolean;
}

export const UNIT_OPTIONS: UnitOption[] = [
  { id: "u-fanega", label: "Fanega", kg_factor: null, configurable: true },
  { id: "u-cajuela", label: "Cajuela", kg_factor: 12.85, configurable: true },
  { id: "u-kg", label: "Kilogramo (kg)", kg_factor: 1 },
  { id: "u-lb", label: "Libra (lb)", kg_factor: 0.4536 },
  { id: "u-qq-oro", label: "Quintal oro (100 lb)", kg_factor: 45.3592 },
  { id: "u-qq-metrico", label: "Quintal métrico (100 kg)", kg_factor: 100 },
  { id: "u-saco", label: "Saco", kg_factor: 69, configurable: true },
  { id: "u-otra", label: "Otra", kg_factor: null, configurable: true },
];

export function getUnitOption(id: string | null | undefined): UnitOption | undefined {
  if (!id) return undefined;
  return UNIT_OPTIONS.find((u) => u.id === id);
}

export function unitLabel(id: string | null | undefined): string {
  return getUnitOption(id)?.label ?? id ?? "—";
}

export interface ProcessOption {
  value: ProcessType | "anaerobico_lavado" | "anaerobico_natural";
  storedAs: ProcessType;
  label: string;
}

export const PROCESS_OPTIONS: ProcessOption[] = [
  { value: "lavado", storedAs: "lavado", label: "Lavado" },
  { value: "honey", storedAs: "honey", label: "Honey" },
  { value: "natural", storedAs: "natural", label: "Natural" },
  { value: "anaerobico_lavado", storedAs: "anaerobico", label: "Anaeróbico lavado" },
  { value: "anaerobico_natural", storedAs: "anaerobico", label: "Anaeróbico natural" },
  { value: "experimental", storedAs: "experimental", label: "Experimental" },
  { value: "custom", storedAs: "custom", label: "Personalizado" },
];

export const MATURITY_OPTIONS = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
  { value: "excelente", label: "Excelente" },
] as const;

export const IMPURITY_OPTIONS = [
  { value: "ninguna", label: "Ninguna" },
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
] as const;
