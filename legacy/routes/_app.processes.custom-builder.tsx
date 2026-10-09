import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Save,
  Eye,
  Settings2,
  Bell,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  createCustomTemplate,
  emptyPhase,
  getProcessTemplate,
  saveTemplateVersion,
  useProcessTemplates,
} from "@/lib/process-store";
import { PhaseTimelinePreview } from "@/routes/_app.processes";
import type {
  DurationUnit,
  PhaseTimeAlert,
  PhaseVariableAlert,
  PhaseVariableRequirement,
  ProcessBaseType,
  ProcessPhaseDef,
  ProcessTemplateV2,
} from "@/types/process";
import type { PhysicalState } from "@/types/domain";
import { physicalStateLabel } from "@/lib/helpers";

interface BuilderSearch {
  from?: string;
  mode?: "edit" | "duplicate";
}

export const Route = createFileRoute("/_app/processes/custom-builder")({
  validateSearch: (s: Record<string, unknown>): BuilderSearch => ({
    from: typeof s.from === "string" ? s.from : undefined,
    mode: s.mode === "edit" || s.mode === "duplicate" ? s.mode : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Crear proceso — Bitácora Café Pro" },
      { name: "description", content: "Diseña tu proceso de café paso a paso." },
    ],
  }),
  component: BuilderPage,
});

const BASE_LABEL: Record<ProcessBaseType, string> = {
  lavado: "Lavado",
  honey: "Honey",
  natural: "Natural",
  anaerobico_lavado: "Anaeróbico lavado",
  anaerobico_natural: "Anaeróbico natural",
  experimental: "Experimental",
  custom: "Personalizado",
};

function uid() {
  return `tmp-${Math.random().toString(36).slice(2, 9)}`;
}

type Step = 1 | 2 | 3;

function BuilderPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_app/processes/custom-builder" });
  const templates = useProcessTemplates();

  const initialFrom = search.from ? getProcessTemplate(search.from) : null;
  const isEditMode = search.mode === "edit" && initialFrom && !initialFrom.is_default;

  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState(
    isEditMode
      ? initialFrom!.name
      : initialFrom
      ? `${initialFrom.name} (copia)`
      : "",
  );
  const [description, setDescription] = useState(initialFrom?.description ?? "");
  const [baseType, setBaseType] = useState<ProcessBaseType>(initialFrom?.base_type ?? "custom");
  const [seedFrom, setSeedFrom] = useState<string>(initialFrom?.id ?? "");
  const [phases, setPhases] = useState<ProcessPhaseDef[]>(
    initialFrom
      ? initialFrom.phases.map((p) => ({ ...p, id: uid() }))
      : [emptyPhase(1)],
  );

  const handleSeedFromChange = (id: string) => {
    setSeedFrom(id);
    if (!id) return;
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    setBaseType(tpl.base_type === "custom" ? "custom" : tpl.base_type);
    setPhases(tpl.phases.map((p) => ({ ...p, id: uid() })));
    if (!name) setName(`${tpl.name} (mi versión)`);
    toast.success(`Plantilla cargada desde “${tpl.name}”`);
  };

  const updatePhase = (id: string, patch: Partial<ProcessPhaseDef>) => {
    setPhases((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };
  const addPhase = () => {
    setPhases((ps) => [...ps, emptyPhase(ps.length + 1)]);
  };
  const removePhase = (id: string) => {
    setPhases((ps) => ps.filter((p) => p.id !== id).map((p, i) => ({ ...p, order_index: i + 1 })));
  };
  const movePhase = (id: string, dir: -1 | 1) => {
    setPhases((ps) => {
      const idx = ps.findIndex((p) => p.id === id);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= ps.length) return ps;
      const copy = [...ps];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy.map((p, i) => ({ ...p, order_index: i + 1 }));
    });
  };

  const canGoStep2 = name.trim().length >= 3;
  const canSave = canGoStep2 && phases.length > 0 && phases.every((p) => p.name.trim().length > 0);

  const handleSave = () => {
    if (!canSave) {
      toast.error("Faltan datos. Revisá nombre y fases.");
      return;
    }
    const input = {
      name: name.trim(),
      description: description.trim() || null,
      base_type: baseType,
      phases,
    };
    let saved: ProcessTemplateV2;
    if (isEditMode && initialFrom) {
      saved = saveTemplateVersion(initialFrom.id, input);
      toast.success(`Nueva versión v${saved.version} guardada`);
    } else {
      saved = createCustomTemplate(input);
      toast.success(`Proceso “${saved.name}” creado`);
    }
    navigate({ to: "/processes" });
  };

  const previewTpl = useMemo<ProcessTemplateV2>(
    () => ({
      id: "preview",
      organization_id: "org-1",
      name: name || "Proceso sin nombre",
      base_type: baseType,
      description: description || null,
      is_default: false,
      is_active: true,
      version: 1,
      parent_template_id: null,
      phases,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
    [name, baseType, description, phases],
  );

  return (
    <div className="pb-24">
      <Link
        to="/processes"
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver a procesos
      </Link>

      <div className="mb-6">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold">
          {isEditMode ? "Editar proceso" : "Nuevo proceso"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-xl">
          Podés empezar desde un proceso existente y ajustarlo a tu forma de trabajar.
        </p>
        {isEditMode && (
          <p className="mt-2 inline-flex items-center text-xs text-warning-foreground bg-warning/30 rounded-full px-2 py-0.5">
            <Sparkles className="h-3 w-3 mr-1" /> Al guardar se crea una nueva versión. Los lotes
            antiguos conservan su versión original.
          </p>
        )}
      </div>

      <Stepper step={step} />

      {step === 1 && (
        <Step1
          name={name}
          setName={setName}
          description={description}
          setDescription={setDescription}
          baseType={baseType}
          setBaseType={setBaseType}
          seedFrom={seedFrom}
          onSeedFromChange={handleSeedFromChange}
          templates={templates}
          disableSeed={!!isEditMode}
        />
      )}

      {step === 2 && (
        <Step2
          phases={phases}
          updatePhase={updatePhase}
          addPhase={addPhase}
          removePhase={removePhase}
          movePhase={movePhase}
        />
      )}

      {step === 3 && <Step3 tpl={previewTpl} />}

      <div className="mt-6 flex items-center justify-between gap-2 sticky bottom-4">
        <div className="flex gap-2 bg-background/90 backdrop-blur rounded-full p-1 border border-border shadow-sm">
          <Button
            variant="ghost"
            size="sm"
            disabled={step === 1}
            onClick={() => setStep((s) => (s - 1) as Step)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Atrás
          </Button>
          {step < 3 ? (
            <Button
              size="sm"
              disabled={step === 1 ? !canGoStep2 : false}
              onClick={() => setStep((s) => (s + 1) as Step)}
            >
              Siguiente <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleSave} disabled={!canSave}>
              <Save className="h-4 w-4 mr-1" /> {isEditMode ? "Guardar versión" : "Guardar proceso"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps = [
    { n: 1, label: "Datos básicos" },
    { n: 2, label: "Fases y configuración" },
    { n: 3, label: "Revisar y guardar" },
  ];
  return (
    <div className="mb-6 flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center gap-2 flex-1">
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
              s.n <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {s.n < step ? <Check className="h-4 w-4" /> : s.n}
          </div>
          <span
            className={`text-xs sm:text-sm truncate ${
              s.n === step ? "font-semibold text-foreground" : "text-muted-foreground"
            }`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && <div className="hidden sm:block flex-1 h-px bg-border" />}
        </div>
      ))}
    </div>
  );
}

// ──────── Step 1 ────────
function Step1({
  name,
  setName,
  description,
  setDescription,
  baseType,
  setBaseType,
  seedFrom,
  onSeedFromChange,
  templates,
  disableSeed,
}: {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  baseType: ProcessBaseType;
  setBaseType: (v: ProcessBaseType) => void;
  seedFrom: string;
  onSeedFromChange: (id: string) => void;
  templates: ProcessTemplateV2[];
  disableSeed?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos básicos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nombre del proceso *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Mi anaeróbico carbónico"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="desc">Descripción</Label>
          <Textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="¿En qué consiste tu proceso?"
            rows={3}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Tipo base</Label>
          <Select value={baseType} onValueChange={(v) => setBaseType(v as ProcessBaseType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(BASE_LABEL).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Sirve para clasificar tu proceso en reportes y filtros.
          </p>
        </div>

        {!disableSeed && (
          <div className="space-y-1.5 rounded-xl border border-dashed border-border p-3 bg-muted/30">
            <Label className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Empezar desde una plantilla
            </Label>
            <Select value={seedFrom || "none"} onValueChange={(v) => onSeedFromChange(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Empezar desde cero" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Empezar desde cero</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} {t.is_default ? "· por defecto" : `· v${t.version}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Cargá las fases de un proceso existente y ajustalas.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ──────── Step 2 ────────
function Step2({
  phases,
  updatePhase,
  addPhase,
  removePhase,
  movePhase,
}: {
  phases: ProcessPhaseDef[];
  updatePhase: (id: string, patch: Partial<ProcessPhaseDef>) => void;
  addPhase: () => void;
  removePhase: (id: string) => void;
  movePhase: (id: string, dir: -1 | 1) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Fases del proceso ({phases.length})</h2>
        <Button size="sm" onClick={addPhase}>
          <Plus className="h-4 w-4 mr-1" /> Agregar fase
        </Button>
      </div>

      <Accordion type="multiple" className="space-y-2">
        {phases.map((phase, idx) => (
          <PhaseEditor
            key={phase.id}
            phase={phase}
            index={idx}
            isFirst={idx === 0}
            isLast={idx === phases.length - 1}
            onUpdate={(patch) => updatePhase(phase.id, patch)}
            onRemove={() => removePhase(phase.id)}
            onMove={(dir) => movePhase(phase.id, dir)}
          />
        ))}
      </Accordion>

      {phases.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Tu proceso no tiene fases. Agregá la primera para empezar.
        </div>
      )}
    </div>
  );
}

const PHYSICAL_STATES: PhysicalState[] = [
  "cereza",
  "fermentacion",
  "secado",
  "pergamino_humedo",
  "pergamino_seco",
  "trillado",
  "verde",
  "tostado",
];

function PhaseEditor({
  phase,
  index,
  isFirst,
  isLast,
  onUpdate,
  onRemove,
  onMove,
}: {
  phase: ProcessPhaseDef;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (patch: Partial<ProcessPhaseDef>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <AccordionItem value={phase.id} className="rounded-xl border border-border bg-card px-3">
      <div className="flex items-center gap-1">
        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isFirst} onClick={() => onMove(-1)}>
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={isLast} onClick={() => onMove(1)}>
          <ChevronDown className="h-4 w-4" />
        </Button>
        <AccordionTrigger className="flex-1 hover:no-underline py-3">
          <div className="flex items-center gap-2 min-w-0 text-left">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary shrink-0">
              {index + 1}
            </span>
            <span className="font-medium truncate">{phase.name || "Sin nombre"}</span>
            {!phase.is_required && (
              <Badge variant="outline" className="text-[9px]">Opcional</Badge>
            )}
          </div>
        </AccordionTrigger>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <AccordionContent className="pt-2 pb-4">
        <Tabs defaultValue="basic">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">
              <Settings2 className="h-3.5 w-3.5 mr-1" /> Básico
            </TabsTrigger>
            <TabsTrigger value="vars">Variables</TabsTrigger>
            <TabsTrigger value="alerts">
              <Bell className="h-3.5 w-3.5 mr-1" /> Alertas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 pt-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre">
                <Input value={phase.name} onChange={(e) => onUpdate({ name: e.target.value })} />
              </Field>
              <Field label="Unidad de duración">
                <Select
                  value={phase.duration_unit}
                  onValueChange={(v) => onUpdate({ duration_unit: v as DurationUnit })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutes">Minutos</SelectItem>
                    <SelectItem value="hours">Horas</SelectItem>
                    <SelectItem value="days">Días</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Descripción" full>
                <Textarea
                  rows={2}
                  value={phase.description ?? ""}
                  onChange={(e) => onUpdate({ description: e.target.value || null })}
                />
              </Field>
              <Field label="Duración esperada">
                <NumberInput
                  value={phase.expected_duration}
                  onChange={(v) => onUpdate({ expected_duration: v })}
                />
              </Field>
              <Field label="Duración mínima">
                <NumberInput
                  value={phase.min_duration}
                  onChange={(v) => onUpdate({ min_duration: v })}
                />
              </Field>
              <Field label="Duración máxima">
                <NumberInput
                  value={phase.max_duration}
                  onChange={(v) => onUpdate({ max_duration: v })}
                />
              </Field>
              <Field label="Estado físico inicial">
                <PhysicalSelect
                  value={phase.initial_physical_state}
                  onChange={(v) => onUpdate({ initial_physical_state: v })}
                />
              </Field>
              <Field label="Estado físico final">
                <PhysicalSelect
                  value={phase.final_physical_state}
                  onChange={(v) => onUpdate({ final_physical_state: v })}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <ToggleRow
                label="Requerida"
                checked={phase.is_required}
                onChange={(v) => onUpdate({ is_required: v })}
              />
              <ToggleRow
                label="Requiere aprobación"
                checked={phase.requires_approval}
                onChange={(v) => onUpdate({ requires_approval: v })}
              />
              <ToggleRow
                label="Permite mermas"
                checked={phase.allows_waste}
                onChange={(v) => onUpdate({ allows_waste: v })}
              />
              <ToggleRow
                label="Permite dividir lote"
                checked={phase.allows_split}
                onChange={(v) => onUpdate({ allows_split: v })}
              />
              <ToggleRow
                label="Permite mezclar lote"
                checked={phase.allows_merge}
                onChange={(v) => onUpdate({ allows_merge: v })}
              />
            </div>
          </TabsContent>

          <TabsContent value="vars" className="pt-3">
            <VariablesEditor
              variables={phase.variables}
              onChange={(vars) => onUpdate({ variables: vars })}
            />
          </TabsContent>

          <TabsContent value="alerts" className="pt-3 space-y-4">
            <TimeAlertsEditor
              alerts={phase.time_alerts}
              defaultUnit={phase.duration_unit}
              onChange={(a) => onUpdate({ time_alerts: a })}
            />
            <VariableAlertsEditor
              alerts={phase.variable_alerts}
              variables={phase.variables}
              onChange={(a) => onUpdate({ variable_alerts: a })}
            />
          </TabsContent>
        </Tabs>
      </AccordionContent>
    </AccordionItem>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <Input
      type="number"
      min={0}
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? null : Number(v));
      }}
      placeholder="—"
    />
  );
}

function PhysicalSelect({
  value,
  onChange,
}: {
  value: PhysicalState | null;
  onChange: (v: PhysicalState | null) => void;
}) {
  return (
    <Select value={value ?? "none"} onValueChange={(v) => onChange(v === "none" ? null : (v as PhysicalState))}>
      <SelectTrigger>
        <SelectValue placeholder="Sin definir" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Sin definir</SelectItem>
        {PHYSICAL_STATES.map((s) => (
          <SelectItem key={s} value={s}>
            {physicalStateLabel[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 gap-2">
      <Label className="text-xs cursor-pointer">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function VariablesEditor({
  variables,
  onChange,
}: {
  variables: PhaseVariableRequirement[];
  onChange: (v: PhaseVariableRequirement[]) => void;
}) {
  const add = () =>
    onChange([
      ...variables,
      { id: uid(), variable_name: "", required: true, unit: null },
    ]);
  const update = (id: string, patch: Partial<PhaseVariableRequirement>) =>
    onChange(variables.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  const remove = (id: string) => onChange(variables.filter((v) => v.id !== id));

  return (
    <div className="space-y-2">
      {variables.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Agregá variables que el operario deberá registrar en esta fase (humedad, pH, Brix, etc).
        </p>
      )}
      {variables.map((v) => (
        <div key={v.id} className="flex items-end gap-2 rounded-lg border border-border bg-card p-2">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Variable</Label>
            <Input
              placeholder="Ej: pH"
              value={v.variable_name}
              onChange={(e) => update(v.id, { variable_name: e.target.value })}
            />
          </div>
          <div className="w-20 space-y-1">
            <Label className="text-xs">Unidad</Label>
            <Input
              placeholder="—"
              value={v.unit ?? ""}
              onChange={(e) => update(v.id, { unit: e.target.value || null })}
            />
          </div>
          <div className="flex items-center gap-1.5 pb-2">
            <Switch checked={v.required} onCheckedChange={(c) => update(v.id, { required: c })} />
            <span className="text-xs">{v.required ? "Req." : "Opc."}</span>
          </div>
          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => remove(v.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Agregar variable
      </Button>
    </div>
  );
}

function TimeAlertsEditor({
  alerts,
  defaultUnit,
  onChange,
}: {
  alerts: PhaseTimeAlert[];
  defaultUnit: DurationUnit;
  onChange: (a: PhaseTimeAlert[]) => void;
}) {
  const add = () =>
    onChange([
      ...alerts,
      {
        id: uid(),
        after_value: 1,
        after_unit: defaultUnit,
        severity: "warning",
        message: "",
      },
    ]);
  const update = (id: string, patch: Partial<PhaseTimeAlert>) =>
    onChange(alerts.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const remove = (id: string) => onChange(alerts.filter((a) => a.id !== id));

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">Alertas por tiempo</h4>
      {alerts.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Te avisamos si la fase lleva más tiempo del esperado.
        </p>
      )}
      {alerts.map((a) => (
        <div key={a.id} className="rounded-lg border border-border bg-card p-2 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Después de</span>
            <Input
              className="w-20"
              type="number"
              min={0}
              value={a.after_value}
              onChange={(e) => update(a.id, { after_value: Number(e.target.value) })}
            />
            <Select value={a.after_unit} onValueChange={(v) => update(a.id, { after_unit: v as DurationUnit })}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">min</SelectItem>
                <SelectItem value="hours">horas</SelectItem>
                <SelectItem value="days">días</SelectItem>
              </SelectContent>
            </Select>
            <Select value={a.severity} onValueChange={(v) => update(a.id, { severity: v as PhaseTimeAlert["severity"] })}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Aviso</SelectItem>
                <SelectItem value="danger">Crítico</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="text-destructive ml-auto" onClick={() => remove(a.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <Input
            placeholder="Mensaje de la alerta"
            value={a.message}
            onChange={(e) => update(a.id, { message: e.target.value })}
          />
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Alerta por tiempo
      </Button>
    </div>
  );
}

function VariableAlertsEditor({
  alerts,
  variables,
  onChange,
}: {
  alerts: PhaseVariableAlert[];
  variables: PhaseVariableRequirement[];
  onChange: (a: PhaseVariableAlert[]) => void;
}) {
  const add = () =>
    onChange([
      ...alerts,
      {
        id: uid(),
        variable_name: variables[0]?.variable_name ?? "",
        op: "gt",
        value: 0,
        severity: "warning",
        message: "",
      },
    ]);
  const update = (id: string, patch: Partial<PhaseVariableAlert>) =>
    onChange(alerts.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const remove = (id: string) => onChange(alerts.filter((a) => a.id !== id));

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">Alertas por variable</h4>
      {alerts.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Te avisamos si una variable supera o baja del valor esperado.
        </p>
      )}
      {alerts.map((a) => (
        <div key={a.id} className="rounded-lg border border-border bg-card p-2 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="w-32"
              placeholder="Variable"
              value={a.variable_name}
              onChange={(e) => update(a.id, { variable_name: e.target.value })}
            />
            <Select value={a.op} onValueChange={(v) => update(a.id, { op: v as PhaseVariableAlert["op"] })}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lt">&lt;</SelectItem>
                <SelectItem value="lte">≤</SelectItem>
                <SelectItem value="eq">=</SelectItem>
                <SelectItem value="gte">≥</SelectItem>
                <SelectItem value="gt">&gt;</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="w-24"
              type="number"
              value={a.value}
              onChange={(e) => update(a.id, { value: Number(e.target.value) })}
            />
            <Select value={a.severity} onValueChange={(v) => update(a.id, { severity: v as PhaseVariableAlert["severity"] })}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Aviso</SelectItem>
                <SelectItem value="danger">Crítico</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="text-destructive ml-auto" onClick={() => remove(a.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <Input
            placeholder="Mensaje de la alerta"
            value={a.message}
            onChange={(e) => update(a.id, { message: e.target.value })}
          />
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Alerta por variable
      </Button>
    </div>
  );
}

// ──────── Step 3 ────────
function Step3({ tpl }: { tpl: ProcessTemplateV2 }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" /> Vista previa
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <h3 className="font-display text-xl font-semibold">{tpl.name}</h3>
          {tpl.description && (
            <p className="text-sm text-muted-foreground mt-1">{tpl.description}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="secondary">{BASE_LABEL[tpl.base_type]}</Badge>
            <Badge variant="outline">{tpl.phases.length} fases</Badge>
          </div>
        </div>
        <PhaseTimelinePreview tpl={tpl} />
      </CardContent>
    </Card>
  );
}
