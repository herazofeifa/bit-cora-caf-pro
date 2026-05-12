// Rich process template system with versioning, custom builder, and per-phase config.
// Designed to map cleanly to Supabase tables when the backend is connected.

import type { PhysicalState, UUID } from "@/types/domain";

export type ProcessBaseType =
  | "lavado"
  | "honey"
  | "natural"
  | "anaerobico_lavado"
  | "anaerobico_natural"
  | "experimental"
  | "custom";

export type DurationUnit = "minutes" | "hours" | "days";

export type AlertConditionOp = "lt" | "lte" | "gt" | "gte" | "eq";

export interface PhaseTimeAlert {
  id: UUID;
  /** Trigger when phase has been active for X duration units. */
  after_value: number;
  after_unit: DurationUnit;
  severity: "info" | "warning" | "danger";
  message: string;
}

export interface PhaseVariableAlert {
  id: UUID;
  variable_name: string;
  op: AlertConditionOp;
  value: number;
  severity: "info" | "warning" | "danger";
  message: string;
}

export interface PhaseVariableRequirement {
  id: UUID;
  variable_name: string;
  required: boolean;
  unit?: string | null;
}

export interface ProcessPhaseDef {
  id: UUID;
  name: string;
  description: string | null;
  order_index: number;

  expected_duration: number | null;
  min_duration: number | null;
  max_duration: number | null;
  duration_unit: DurationUnit;

  initial_physical_state: PhysicalState | null;
  final_physical_state: PhysicalState | null;

  is_required: boolean;
  requires_approval: boolean;
  allows_split: boolean;
  allows_merge: boolean;
  allows_waste: boolean;

  variables: PhaseVariableRequirement[];
  time_alerts: PhaseTimeAlert[];
  variable_alerts: PhaseVariableAlert[];
}

export interface ProcessTemplateV2 {
  id: UUID;
  organization_id: UUID;
  name: string;
  base_type: ProcessBaseType;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  version: number;
  /** Each edit creates a new version. Older versions are kept for historical lots. */
  parent_template_id: UUID | null;
  phases: ProcessPhaseDef[];
  created_at: string;
  updated_at: string;
}
