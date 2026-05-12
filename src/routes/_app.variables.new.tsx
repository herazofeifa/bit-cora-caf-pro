import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  createVariableDefinition,
  updateVariableDefinition,
  useStore,
} from "@/lib/store";
import type { VariableCategory, VariableValueType } from "@/types/domain";

interface VariableSearch {
  id?: string;
}

export const Route = createFileRoute("/_app/variables/new")({
  validateSearch: (search: Record<string, unknown>): VariableSearch => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
  head: () => ({
    meta: [{ title: "Nueva variable — Bitácora Café Pro" }],
  }),
  component: NewVariablePage,
});

const CATEGORIES: { value: VariableCategory; label: string }[] = [
  { value: "humedad", label: "Humedad" },
  { value: "temperatura", label: "Temperatura" },
  { value: "fermentacion", label: "Fermentación" },
  { value: "fisica", label: "Física" },
  { value: "secado", label: "Secado" },
  { value: "ambiente", label: "Ambiente" },
  { value: "sensorial", label: "Sensorial" },
  { value: "general", label: "General" },
];

const VALUE_TYPES: { value: VariableValueType; label: string }[] = [
  { value: "number", label: "Número" },
  { value: "percentage", label: "Porcentaje" },
  { value: "scale_5", label: "Escala 1 a 5" },
  { value: "single_select", label: "Opción única" },
  { value: "multi_select", label: "Opción múltiple" },
  { value: "boolean", label: "Sí / No" },
  { value: "short_text", label: "Texto corto" },
  { value: "long_text", label: "Texto largo" },
  { value: "datetime", label: "Fecha y hora" },
  { value: "photo", label: "Foto" },
  { value: "file", label: "Archivo" },
  { value: "custom_unit", label: "Unidad personalizada" },
];

const PHASES = ["Recibo", "Selección", "Despulpado", "Fermentación", "Lavado", "Escurrido", "Secado", "Reposo", "Trilla", "Almacenamiento"];

const schema = z.object({
  name: z.string().trim().min(2, "Nombre muy corto").max(80),
  description: z.string().trim().max(500).optional(),
  category: z.enum(["humedad", "temperatura", "fermentacion", "fisica", "secado", "ambiente", "sensorial", "general"]),
  value_type: z.enum(["number", "percentage", "short_text", "long_text", "single_select", "multi_select", "boolean", "datetime", "photo", "file", "scale_5", "custom_unit"]),
  unit: z.string().trim().max(20).optional(),
  min_value: z.number().nullable().optional(),
  max_value: z.number().nullable().optional(),
  ideal_min: z.number().nullable().optional(),
  ideal_max: z.number().nullable().optional(),
});

function NewVariablePage() {
  const navigate = useNavigate();
  const { id } = useSearch({ from: "/_app/variables/new" });
  const editing = useStore((s) => s.variableDefinitions.find((d) => d.id === id));

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<VariableCategory>("general");
  const [valueType, setValueType] = useState<VariableValueType>("number");
  const [unit, setUnit] = useState("");
  const [minVal, setMinVal] = useState("");
  const [maxVal, setMaxVal] = useState("");
  const [idealMin, setIdealMin] = useState("");
  const [idealMax, setIdealMax] = useState("");
  const [optionsText, setOptionsText] = useState("");
  const [phases, setPhases] = useState<string[]>([]);
  const [required, setRequired] = useState(false);
  const [outOfRange, setOutOfRange] = useState(true);

  useEffect(() => {
    if (!editing) return;
    setName(editing.name);
    setDescription(editing.description ?? "");
    setCategory(editing.category);
    setValueType(editing.value_type);
    setUnit(editing.unit ?? "");
    setMinVal(editing.min_value?.toString() ?? "");
    setMaxVal(editing.max_value?.toString() ?? "");
    setIdealMin(editing.ideal_min?.toString() ?? "");
    setIdealMax(editing.ideal_max?.toString() ?? "");
    setOptionsText((editing.options ?? []).join(", "));
    setPhases(editing.phase_associations);
    setRequired(editing.alert_if_missing);
    setOutOfRange(editing.alert_if_out_of_range);
  }, [editing]);

  const isNumeric = useMemo(
    () => ["number", "percentage", "scale_5", "custom_unit"].includes(valueType),
    [valueType],
  );
  const hasOptions = valueType === "single_select" || valueType === "multi_select";

  const handleSave = () => {
    const parsed = schema.safeParse({
      name,
      description: description || undefined,
      category,
      value_type: valueType,
      unit: unit || undefined,
      min_value: minVal ? Number(minVal) : null,
      max_value: maxVal ? Number(maxVal) : null,
      ideal_min: idealMin ? Number(idealMin) : null,
      ideal_max: idealMax ? Number(idealMax) : null,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revisá los datos");
      return;
    }

    const opts = hasOptions
      ? optionsText.split(",").map((s) => s.trim()).filter(Boolean)
      : null;
    if (hasOptions && (!opts || opts.length < 2)) {
      toast.error("Agrega al menos dos opciones separadas por coma");
      return;
    }

    const payload = {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      category: parsed.data.category as VariableCategory,
      value_type: parsed.data.value_type as VariableValueType,
      unit: parsed.data.unit ?? null,
      min_value: parsed.data.min_value ?? null,
      max_value: parsed.data.max_value ?? null,
      ideal_min: parsed.data.ideal_min ?? null,
      ideal_max: parsed.data.ideal_max ?? null,
      options: opts,
      phase_associations: phases,
      alert_if_missing: required,
      alert_if_out_of_range: outOfRange,
      suggested_frequency_minutes: null,
    };

    if (editing) {
      updateVariableDefinition(editing.id, payload);
      toast.success("Variable actualizada");
    } else {
      createVariableDefinition(payload);
      toast.success("Variable creada");
    }
    navigate({ to: "/variables" });
  };

  const togglePhase = (ph: string) =>
    setPhases((prev) => (prev.includes(ph) ? prev.filter((x) => x !== ph) : [...prev, ph]));

  return (
    <div className="max-w-2xl">
      <Link
        to="/variables"
        className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver a variables
      </Link>
      <PageHeader
        title={editing ? "Editar variable" : "Nueva variable"}
        subtitle="Cada variable se asocia a una o más fases del proceso."
      />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nombre *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Ej: pH del mosto" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Descripción</Label>
              <Textarea rows={2} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as VariableCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de valor</Label>
              <Select value={valueType} onValueChange={(v) => setValueType(v as VariableValueType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VALUE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isNumeric && (
              <>
                <div className="space-y-1.5">
                  <Label>Unidad</Label>
                  <Input value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} placeholder="Ej: °C, %, kg" />
                </div>
                <div className="space-y-1.5"><Label>Mínimo</Label><Input type="number" inputMode="decimal" value={minVal} onChange={(e) => setMinVal(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Máximo</Label><Input type="number" inputMode="decimal" value={maxVal} onChange={(e) => setMaxVal(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Ideal mín</Label><Input type="number" inputMode="decimal" value={idealMin} onChange={(e) => setIdealMin(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Ideal máx</Label><Input type="number" inputMode="decimal" value={idealMax} onChange={(e) => setIdealMax(e.target.value)} /></div>
              </>
            )}
            {hasOptions && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Opciones (separadas por coma)</Label>
                <Input
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  placeholder="Soleado, Nublado, Lluvia"
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Fases asociadas</Label>
            <div className="flex flex-wrap gap-1.5">
              {PHASES.map((ph) => (
                <button
                  key={ph}
                  type="button"
                  onClick={() => togglePhase(ph)}
                  className="focus:outline-none"
                >
                  <Badge variant={phases.includes(ph) ? "default" : "outline"} className="cursor-pointer">
                    {ph}
                  </Badge>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Si no seleccionás ninguna, podrá registrarse en cualquier fase.
            </p>
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Requerida en sus fases</Label>
                <p className="text-[11px] text-muted-foreground">Bloquea cerrar la fase si no se registró.</p>
              </div>
              <Switch checked={required} onCheckedChange={setRequired} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Alertar fuera de rango ideal</Label>
                <p className="text-[11px] text-muted-foreground">Genera un aviso al guardar valores extremos.</p>
              </div>
              <Switch checked={outOfRange} onCheckedChange={setOutOfRange} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button asChild variant="ghost"><Link to="/variables">Cancelar</Link></Button>
            <Button onClick={handleSave}>{editing ? "Guardar cambios" : "Crear variable"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
