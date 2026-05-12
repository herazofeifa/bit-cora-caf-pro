import { useSyncExternalStore } from "react";
import { defaultProcessTemplates } from "@/data/default-processes";
import type { ProcessPhaseDef, ProcessTemplateV2 } from "@/types/process";

interface State {
  templates: ProcessTemplateV2[];
}

const state: State = {
  templates: [...defaultProcessTemplates],
};

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const emit = () => listeners.forEach((l) => l());

export function useProcessTemplates(): ProcessTemplateV2[] {
  return useSyncExternalStore(
    subscribe,
    () => state.templates,
    () => state.templates,
  );
}

export function getProcessTemplate(id: string): ProcessTemplateV2 | undefined {
  return state.templates.find((t) => t.id === id);
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function nowIso() {
  return new Date().toISOString();
}

export function emptyPhase(orderIndex = 1): ProcessPhaseDef {
  return {
    id: uid("phase"),
    name: "Nueva fase",
    description: null,
    order_index: orderIndex,
    expected_duration: null,
    min_duration: null,
    max_duration: null,
    duration_unit: "hours",
    initial_physical_state: null,
    final_physical_state: null,
    is_required: true,
    requires_approval: false,
    allows_split: false,
    allows_merge: false,
    allows_waste: true,
    variables: [],
    time_alerts: [],
    variable_alerts: [],
  };
}

export interface SaveTemplateInput {
  name: string;
  description: string | null;
  base_type: ProcessTemplateV2["base_type"];
  phases: ProcessPhaseDef[];
}

export function createCustomTemplate(input: SaveTemplateInput): ProcessTemplateV2 {
  const tpl: ProcessTemplateV2 = {
    id: uid("tmpl"),
    organization_id: "org-1",
    name: input.name,
    base_type: input.base_type,
    description: input.description,
    is_default: false,
    is_active: true,
    version: 1,
    parent_template_id: null,
    phases: input.phases.map((p, i) => ({ ...p, order_index: i + 1 })),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  state.templates.unshift(tpl);
  emit();
  return tpl;
}

/** Edits create a new version. Old version stays for historical lots. */
export function saveTemplateVersion(originalId: string, input: SaveTemplateInput): ProcessTemplateV2 {
  const original = state.templates.find((t) => t.id === originalId);
  const parentId = original?.parent_template_id ?? originalId;
  const lineage = state.templates.filter(
    (t) => t.id === parentId || t.parent_template_id === parentId,
  );
  const nextVersion = Math.max(...lineage.map((t) => t.version), 0) + 1;

  const tpl: ProcessTemplateV2 = {
    id: uid("tmpl"),
    organization_id: "org-1",
    name: input.name,
    base_type: input.base_type,
    description: input.description,
    is_default: false,
    is_active: true,
    version: nextVersion,
    parent_template_id: parentId,
    phases: input.phases.map((p, i) => ({ ...p, order_index: i + 1, id: uid("phase") })),
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  // Deactivate previous active version (default templates stay)
  state.templates = state.templates.map((t) =>
    !t.is_default && (t.id === parentId || t.parent_template_id === parentId)
      ? { ...t, is_active: false }
      : t,
  );
  state.templates.unshift(tpl);
  emit();
  return tpl;
}

export function duplicateTemplate(id: string): ProcessTemplateV2 | null {
  const src = state.templates.find((t) => t.id === id);
  if (!src) return null;
  return createCustomTemplate({
    name: `${src.name} (copia)`,
    description: src.description,
    base_type: src.base_type === "custom" ? "custom" : src.base_type,
    phases: src.phases.map((p) => ({ ...p, id: uid("phase") })),
  });
}

export function deactivateTemplate(id: string): boolean {
  const tpl = state.templates.find((t) => t.id === id);
  if (!tpl || tpl.is_default) return false;
  state.templates = state.templates.map((t) =>
    t.id === id ? { ...t, is_active: false } : t,
  );
  emit();
  return true;
}

export function activateTemplate(id: string): void {
  state.templates = state.templates.map((t) =>
    t.id === id ? { ...t, is_active: true } : t,
  );
  emit();
}
