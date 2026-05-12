// Default process templates for Bitácora Café Pro.
// These are seeded for every organization. They cannot be deleted, only duplicated.

import type { PhysicalState } from "@/types/domain";
import type { DurationUnit, ProcessPhaseDef, ProcessTemplateV2 } from "@/types/process";

const ORG = "org-1";
const NOW = "2026-05-12T08:00:00Z";

interface PhaseSeed {
  name: string;
  description?: string;
  expected?: number;
  min?: number;
  max?: number;
  unit?: DurationUnit;
  initial?: PhysicalState;
  final?: PhysicalState;
  required?: boolean;
  approval?: boolean;
  split?: boolean;
  merge?: boolean;
  waste?: boolean;
}

let phaseCounter = 0;
function buildPhases(seeds: PhaseSeed[]): ProcessPhaseDef[] {
  return seeds.map((s, i) => ({
    id: `pdef-${++phaseCounter}`,
    name: s.name,
    description: s.description ?? null,
    order_index: i + 1,
    expected_duration: s.expected ?? null,
    min_duration: s.min ?? null,
    max_duration: s.max ?? null,
    duration_unit: s.unit ?? "hours",
    initial_physical_state: s.initial ?? null,
    final_physical_state: s.final ?? null,
    is_required: s.required ?? true,
    requires_approval: s.approval ?? false,
    allows_split: s.split ?? false,
    allows_merge: s.merge ?? false,
    allows_waste: s.waste ?? true,
    variables: [],
    time_alerts: [],
    variable_alerts: [],
  }));
}

const lavado: PhaseSeed[] = [
  { name: "Recibo", initial: "cereza", final: "cereza", expected: 2, unit: "hours", approval: false },
  { name: "Selección", initial: "cereza", final: "cereza", expected: 2, unit: "hours" },
  { name: "Despulpado", initial: "cereza", final: "pergamino_humedo", expected: 1, unit: "hours" },
  { name: "Fermentación", initial: "pergamino_humedo", final: "pergamino_humedo", expected: 18, min: 12, max: 36, unit: "hours", approval: true },
  { name: "Lavado", initial: "pergamino_humedo", final: "pergamino_humedo", expected: 1, unit: "hours" },
  { name: "Escurrido", initial: "pergamino_humedo", final: "pergamino_humedo", expected: 4, unit: "hours" },
  { name: "Secado", initial: "pergamino_humedo", final: "pergamino_seco", expected: 10, min: 7, max: 18, unit: "days" },
  { name: "Reposo", initial: "pergamino_seco", final: "pergamino_seco", expected: 30, min: 15, max: 90, unit: "days" },
  { name: "Trilla", initial: "pergamino_seco", final: "trillado", expected: 2, unit: "hours", split: true },
  { name: "Selección final", initial: "trillado", final: "verde", expected: 2, unit: "hours" },
  { name: "Oro verde disponible", initial: "verde", final: "verde", expected: 0, unit: "hours", waste: false, approval: true },
];

const honey: PhaseSeed[] = [
  { name: "Recibo", initial: "cereza", final: "cereza", expected: 2, unit: "hours" },
  { name: "Selección", initial: "cereza", final: "cereza", expected: 2, unit: "hours" },
  { name: "Despulpado parcial", initial: "cereza", final: "pergamino_humedo", expected: 1, unit: "hours" },
  { name: "Secado con mucílago", initial: "pergamino_humedo", final: "pergamino_seco", expected: 14, min: 10, max: 21, unit: "days" },
  { name: "Reposo", initial: "pergamino_seco", final: "pergamino_seco", expected: 30, min: 15, max: 90, unit: "days" },
  { name: "Trilla", initial: "pergamino_seco", final: "trillado", expected: 2, unit: "hours", split: true },
  { name: "Selección final", initial: "trillado", final: "verde", expected: 2, unit: "hours" },
  { name: "Oro verde disponible", initial: "verde", final: "verde", expected: 0, unit: "hours", waste: false, approval: true },
];

const natural: PhaseSeed[] = [
  { name: "Recibo", initial: "cereza", final: "cereza", expected: 2, unit: "hours" },
  { name: "Selección", initial: "cereza", final: "cereza", expected: 2, unit: "hours" },
  { name: "Secado en fruta", initial: "cereza", final: "pergamino_seco", expected: 18, min: 14, max: 30, unit: "days" },
  { name: "Reposo", initial: "pergamino_seco", final: "pergamino_seco", expected: 30, min: 15, max: 90, unit: "days" },
  { name: "Trilla", initial: "pergamino_seco", final: "trillado", expected: 2, unit: "hours", split: true },
  { name: "Selección final", initial: "trillado", final: "verde", expected: 2, unit: "hours" },
  { name: "Oro verde disponible", initial: "verde", final: "verde", expected: 0, unit: "hours", waste: false, approval: true },
];

const anaerobicoLavado: PhaseSeed[] = [
  { name: "Recibo", initial: "cereza", final: "cereza", expected: 2, unit: "hours" },
  { name: "Selección", initial: "cereza", final: "cereza", expected: 2, unit: "hours" },
  { name: "Fermentación controlada", initial: "cereza", final: "fermentacion", expected: 72, min: 24, max: 120, unit: "hours", approval: true },
  { name: "Despulpado", initial: "fermentacion", final: "pergamino_humedo", expected: 1, unit: "hours" },
  { name: "Fermentación secundaria", initial: "pergamino_humedo", final: "pergamino_humedo", expected: 24, min: 12, max: 48, unit: "hours", approval: true },
  { name: "Lavado", initial: "pergamino_humedo", final: "pergamino_humedo", expected: 1, unit: "hours" },
  { name: "Secado", initial: "pergamino_humedo", final: "pergamino_seco", expected: 12, min: 8, max: 20, unit: "days" },
  { name: "Reposo", initial: "pergamino_seco", final: "pergamino_seco", expected: 30, min: 15, max: 90, unit: "days" },
  { name: "Trilla", initial: "pergamino_seco", final: "trillado", expected: 2, unit: "hours", split: true },
  { name: "Selección final", initial: "trillado", final: "verde", expected: 2, unit: "hours" },
  { name: "Oro verde disponible", initial: "verde", final: "verde", expected: 0, unit: "hours", waste: false, approval: true },
];

const anaerobicoNatural: PhaseSeed[] = [
  { name: "Recibo", initial: "cereza", final: "cereza", expected: 2, unit: "hours" },
  { name: "Selección", initial: "cereza", final: "cereza", expected: 2, unit: "hours" },
  { name: "Fermentación controlada en fruta", initial: "cereza", final: "fermentacion", expected: 96, min: 36, max: 144, unit: "hours", approval: true },
  { name: "Secado en fruta", initial: "fermentacion", final: "pergamino_seco", expected: 18, min: 14, max: 30, unit: "days" },
  { name: "Reposo", initial: "pergamino_seco", final: "pergamino_seco", expected: 30, min: 15, max: 90, unit: "days" },
  { name: "Trilla", initial: "pergamino_seco", final: "trillado", expected: 2, unit: "hours", split: true },
  { name: "Selección final", initial: "trillado", final: "verde", expected: 2, unit: "hours" },
  { name: "Oro verde disponible", initial: "verde", final: "verde", expected: 0, unit: "hours", waste: false, approval: true },
];

const experimental: PhaseSeed[] = [
  { name: "Recibo", initial: "cereza", final: "cereza", expected: 2, unit: "hours" },
  { name: "Fase experimental", description: "Editá esta fase para tu propio flujo.", initial: "cereza", final: "fermentacion", expected: 24, unit: "hours" },
];

export const defaultProcessTemplates: ProcessTemplateV2[] = [
  {
    id: "tmpl-default-lavado",
    organization_id: ORG,
    name: "Lavado",
    base_type: "lavado",
    description: "Proceso lavado tradicional con fermentación y lavado.",
    is_default: true,
    is_active: true,
    version: 1,
    parent_template_id: null,
    phases: buildPhases(lavado),
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: "tmpl-default-honey",
    organization_id: ORG,
    name: "Honey",
    base_type: "honey",
    description: "Despulpado parcial, secado con mucílago.",
    is_default: true,
    is_active: true,
    version: 1,
    parent_template_id: null,
    phases: buildPhases(honey),
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: "tmpl-default-natural",
    organization_id: ORG,
    name: "Natural",
    base_type: "natural",
    description: "Secado en cereza completa, sin despulpar.",
    is_default: true,
    is_active: true,
    version: 1,
    parent_template_id: null,
    phases: buildPhases(natural),
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: "tmpl-default-ana-lav",
    organization_id: ORG,
    name: "Anaeróbico lavado",
    base_type: "anaerobico_lavado",
    description: "Doble fermentación con tanque cerrado y proceso lavado.",
    is_default: true,
    is_active: true,
    version: 1,
    parent_template_id: null,
    phases: buildPhases(anaerobicoLavado),
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: "tmpl-default-ana-nat",
    organization_id: ORG,
    name: "Anaeróbico natural",
    base_type: "anaerobico_natural",
    description: "Fermentación anaeróbica en fruta y secado natural.",
    is_default: true,
    is_active: true,
    version: 1,
    parent_template_id: null,
    phases: buildPhases(anaerobicoNatural),
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: "tmpl-default-experimental",
    organization_id: ORG,
    name: "Experimental",
    base_type: "experimental",
    description: "Estructura mínima para diseñar tu propio proceso.",
    is_default: true,
    is_active: true,
    version: 1,
    parent_template_id: null,
    phases: buildPhases(experimental),
    created_at: NOW,
    updated_at: NOW,
  },
];
