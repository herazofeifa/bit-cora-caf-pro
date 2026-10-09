import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Beaker, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { logVariable, useStore } from "@/lib/store";
import type { VariableDefinition } from "@/types/domain";

export const Route = createFileRoute("/_app/variables/log")({
  head: () => ({
    meta: [{ title: "Registrar variable — Bitácora Café Pro" }],
  }),
  component: VariableLogPage,
});

function VariableLogPage() {
  const navigate = useNavigate();
  const lots = useStore((s) => s.lots);
  const phases = useStore((s) => s.phases);
  const definitions = useStore((s) => s.variableDefinitions);
  const variableLogs = useStore((s) => s.variableLogs);

  const activeLots = useMemo(
    () => lots.filter((l) => l.commercial_state !== "vendido"),
    [lots],
  );

  const [step, setStep] = useState<1 | 2>(1);
  const [lotId, setLotId] = useState<string>("");
  const [variableId, setVariableId] = useState<string>("");
  const [valueNumber, setValueNumber] = useState("");
  const [valueText, setValueText] = useState("");
  const [valueBoolean, setValueBoolean] = useState(false);
  const [notes, setNotes] = useState("");

  const lot = lots.find((l) => l.id === lotId);
  const phase = phases.find((p) => p.id === lot?.current_phase_id);
  const phaseName = phase?.name ?? "";

  const required = useMemo(
    () => definitions.filter((d) => d.phase_associations.includes(phaseName) && d.alert_if_missing),
    [definitions, phaseName],
  );
  const suggested = useMemo(
    () => definitions.filter((d) => d.phase_associations.includes(phaseName) && !d.alert_if_missing),
    [definitions, phaseName],
  );
  const others = useMemo(
    () => definitions.filter((d) => !d.phase_associations.includes(phaseName)),
    [definitions, phaseName],
  );

  const missingRequiredIds = useMemo(() => {
    if (!phase) return new Set<string>();
    const recorded = new Set(
      variableLogs.filter((v) => v.phase_instance_id === phase.id).map((v) => v.variable_id),
    );
    return new Set(required.filter((d) => !recorded.has(d.id)).map((d) => d.id));
  }, [variableLogs, phase, required]);

  const def = definitions.find((d) => d.id === variableId);

  const reset = () => {
    setValueNumber(""); setValueText(""); setValueBoolean(false); setNotes("");
  };

  const handleSubmit = () => {
    if (!def || !lot) return;
    const payload: Parameters<typeof logVariable>[0] = {
      variable_id: def.id,
      lot_id: lot.id,
      phase_instance_id: phase?.id ?? null,
      notes: notes.trim() || null,
    };
    if (["number", "percentage", "scale_5", "custom_unit"].includes(def.value_type)) {
      const n = Number(valueNumber);
      const schema = z.number().min(def.min_value ?? -Infinity).max(def.max_value ?? Infinity);
      const r = schema.safeParse(n);
      if (!r.success) { toast.error("Valor fuera de rango"); return; }
      payload.value_number = r.data;
      if ((def.ideal_min != null && r.data < def.ideal_min) || (def.ideal_max != null && r.data > def.ideal_max)) {
        toast.warning(`Fuera del rango ideal (${def.ideal_min ?? "—"} a ${def.ideal_max ?? "—"} ${def.unit ?? ""})`);
      }
    } else if (def.value_type === "boolean") {
      payload.value_boolean = valueBoolean;
    } else if (def.value_type === "single_select" || def.value_type === "multi_select") {
      if (!valueText) { toast.error("Selecciona una opción"); return; }
      payload.value_text = valueText;
      payload.value_options = def.value_type === "multi_select" ? [valueText] : null;
    } else {
      if (!valueText.trim()) { toast.error("Campo requerido"); return; }
      payload.value_text = valueText.trim();
    }
    logVariable(payload);
    toast.success(`${def.name} registrada en ${lot.lot_code}`);
    reset();
    setVariableId("");
  };

  return (
    <div className="max-w-2xl">
      <Link
        to="/variables"
        className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver a variables
      </Link>
      <PageHeader
        eyebrow="VARIABLES" title="Registrar variable"
        subtitle="Selecciona el lote, su fase activa y la lectura."
      />

      {step === 1 && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <Label>Lote</Label>
            {activeLots.length === 0 ? (
              <EmptyState icon={Beaker} title="Sin lotes activos" description="Crea un lote para registrar variables." />
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {activeLots.map((l) => {
                  const ph = phases.find((p) => p.id === l.current_phase_id);
                  return (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => { setLotId(l.id); setStep(2); }}
                        className="flex w-full items-center justify-between gap-2 p-3 hover:bg-muted/40 text-left"
                      >
                        <div className="min-w-0">
                          <div className="font-mono text-[10px] text-muted-foreground">{l.lot_code}</div>
                          <div className="font-semibold truncate">{l.friendly_name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {l.variety} · {ph?.name ?? "Sin fase activa"}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="flex justify-end pt-2">
              <Button variant="ghost" onClick={() => navigate({ to: "/dashboard" })}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && lot && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="rounded-lg bg-muted/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Lote</span>
                <span className="font-semibold">{lot.lot_code} · {lot.friendly_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Fase activa</span>
                <span className="font-medium">{phaseName || "Sin fase activa"}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Variable</Label>
              <Select value={variableId} onValueChange={(v) => { setVariableId(v); reset(); }}>
                <SelectTrigger><SelectValue placeholder="Selecciona una variable" /></SelectTrigger>
                <SelectContent className="max-h-80">
                  {required.length > 0 && (
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-destructive">
                      Requeridas pendientes
                    </div>
                  )}
                  {required
                    .sort((a, b) => Number(missingRequiredIds.has(b.id)) - Number(missingRequiredIds.has(a.id)))
                    .map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {missingRequiredIds.has(d.id) ? "● " : "○ "}{d.name}{d.unit ? ` (${d.unit})` : ""}
                      </SelectItem>
                    ))}
                  {suggested.length > 0 && (
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      Sugeridas para esta fase
                    </div>
                  )}
                  {suggested.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}{d.unit ? ` (${d.unit})` : ""}</SelectItem>
                  ))}
                  {others.length > 0 && (
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                      Otras variables
                    </div>
                  )}
                  {others.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}{d.unit ? ` (${d.unit})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {def?.description && <p className="text-xs text-muted-foreground">{def.description}</p>}
            </div>

            {def && (
              <ValueInput
                def={def}
                valueNumber={valueNumber}
                setValueNumber={setValueNumber}
                valueText={valueText}
                setValueText={setValueText}
                valueBoolean={valueBoolean}
                setValueBoolean={setValueBoolean}
              />
            )}

            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
            </div>

            {missingRequiredIds.size > 0 && (
              <p className="text-xs text-warning-foreground bg-warning/10 border border-warning/30 rounded-lg p-2">
                Faltan {missingRequiredIds.size} variable(s) requerida(s) en esta fase.
              </p>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(1)}>← Cambiar lote</Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => navigate({ to: "/lots/$id", params: { id: lot.id } })}>
                  Ver lote
                </Button>
                <Button onClick={handleSubmit} disabled={!def}>Guardar lectura</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ValueInput({
  def, valueNumber, setValueNumber, valueText, setValueText, valueBoolean, setValueBoolean,
}: {
  def: VariableDefinition;
  valueNumber: string;
  setValueNumber: (v: string) => void;
  valueText: string;
  setValueText: (v: string) => void;
  valueBoolean: boolean;
  setValueBoolean: (v: boolean) => void;
}) {
  const t = def.value_type;
  if (t === "number" || t === "percentage" || t === "custom_unit") {
    return (
      <div className="space-y-1.5">
        <Label>Valor {def.unit ? <span className="text-muted-foreground">({def.unit})</span> : null}</Label>
        <Input type="number" inputMode="decimal" value={valueNumber} onChange={(e) => setValueNumber(e.target.value)} />
        {(def.ideal_min != null || def.ideal_max != null) && (
          <p className="text-[11px] text-muted-foreground">
            Rango ideal: {def.ideal_min ?? "—"} a {def.ideal_max ?? "—"} {def.unit ?? ""}
          </p>
        )}
      </div>
    );
  }
  if (t === "scale_5") {
    return (
      <div className="space-y-1.5">
        <Label>Valor (1 a 5)</Label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <Button key={n} type="button" variant={valueNumber === String(n) ? "default" : "outline"} size="sm" onClick={() => setValueNumber(String(n))} className="flex-1">{n}</Button>
          ))}
        </div>
      </div>
    );
  }
  if (t === "boolean") {
    return (
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
        <Label>Valor</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{valueBoolean ? "Sí" : "No"}</span>
          <Switch checked={valueBoolean} onCheckedChange={setValueBoolean} />
        </div>
      </div>
    );
  }
  if (t === "single_select" || t === "multi_select") {
    return (
      <div className="space-y-1.5">
        <Label>Opción</Label>
        <Select value={valueText} onValueChange={setValueText}>
          <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
          <SelectContent>
            {(def.options ?? []).map((o) => (<SelectItem key={o} value={o}>{o}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (t === "datetime") {
    return (
      <div className="space-y-1.5">
        <Label>Fecha y hora</Label>
        <Input type="datetime-local" value={valueText} onChange={(e) => setValueText(e.target.value)} />
      </div>
    );
  }
  if (t === "long_text") {
    return (
      <div className="space-y-1.5">
        <Label>Texto</Label>
        <Textarea rows={4} maxLength={2000} value={valueText} onChange={(e) => setValueText(e.target.value)} />
      </div>
    );
  }
  if (t === "photo" || t === "file") {
    return (
      <div className="space-y-1.5">
        <Label>{t === "photo" ? "Foto" : "Archivo"}</Label>
        <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
          <Badge variant="outline" className="mb-2">Próximamente</Badge>
          <p>La carga estará disponible al conectar el almacenamiento.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label>Valor</Label>
      <Input maxLength={200} value={valueText} onChange={(e) => setValueText(e.target.value)} />
    </div>
  );
}
