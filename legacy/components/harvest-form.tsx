import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle, Sprout, Scale, Coffee, Boxes } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

import { useStore } from "@/lib/store";
import { useFarms, useParcels } from "@/lib/app-config-store";
import { createHarvestTicket, createLot } from "@/lib/store";
import {
  IMPURITY_OPTIONS,
  MATURITY_OPTIONS,
  PROCESS_OPTIONS,
  UNIT_OPTIONS,
  getUnitOption,
} from "@/lib/units";
import type { HarvestKind, ProcessType } from "@/types/domain";

interface Props {
  kind: HarvestKind;
}

const stepsConfig = [
  { key: 1, label: "Origen", icon: Sprout },
  { key: 2, label: "Cantidad", icon: Scale },
  { key: 3, label: "Calidad", icon: Coffee },
  { key: 4, label: "Lote", icon: Boxes },
] as const;

const numberLike = z.union([z.number(), z.string().transform((v) => (v === "" ? NaN : Number(v)))]);

const originSchema = z.object({
  farm_id: z.string().min(1, "Seleccioná una finca"),
  variety: z.string().trim().min(1, "Indicá la variedad").max(60),
  harvest_date: z.string().min(1, "La fecha es obligatoria"),
  parcel_id: z.string().nullable(),
  producer_name: z.string().max(120).optional(),
  region: z.string().max(120).optional(),
  altitude_m: z.string().optional(),
  picker_or_team: z.string().max(120).optional(),
  notes: z.string().max(1000).optional(),
});

const quantitySchema = z
  .object({
    qty_original: numberLike.refine((n) => Number.isFinite(n) && n > 0, "Cantidad debe ser mayor a 0"),
    uom_original_id: z.string().min(1, "Seleccioná la unidad"),
    qty_kg: z.string().optional(),
    conversion_factor_to_kg: z.string().optional(),
    pending_weight: z.boolean(),
  })
  .refine(
    (v) => {
      if (v.pending_weight) return true;
      if (v.qty_kg && Number(v.qty_kg) > 0) return true;
      // Allow continuing without kg only if pending_weight is checked
      return true;
    },
    { message: "Confirmá el peso o marcá pendiente", path: ["qty_kg"] },
  );

export function HarvestForm({ kind }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Step 1
  const [farmId, setFarmId] = useState("");
  const [parcelId, setParcelId] = useState<string | "">("");
  const [producer, setProducer] = useState("");
  const [region, setRegion] = useState("");
  const [altitude, setAltitude] = useState("");
  const [variety, setVariety] = useState("");
  const [harvestDate, setHarvestDate] = useState(new Date().toISOString().slice(0, 10));
  const [team, setTeam] = useState("");
  const [obs1, setObs1] = useState("");

  // Step 2
  const [qtyOriginal, setQtyOriginal] = useState("");
  const [unitId, setUnitId] = useState("");
  const [qtyKg, setQtyKg] = useState("");
  const [factor, setFactor] = useState("");
  const [pendingWeight, setPendingWeight] = useState(false);

  // Step 3
  const [maturity, setMaturity] = useState<string>("");
  const [impurity, setImpurity] = useState<string>("");
  const [greenPct, setGreenPct] = useState("");
  const [overripePct, setOverripePct] = useState("");
  const [obs3, setObs3] = useState("");

  // Step 4
  const [lotChoice, setLotChoice] = useState<"new" | "existing" | "ticket_only">("new");
  const [lotName, setLotName] = useState("");
  const [processOpt, setProcessOpt] = useState("");
  const [location, setLocation] = useState("");
  const [responsible, setResponsible] = useState("");
  const [existingLotId, setExistingLotId] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});

  const farms = useFarms();
  const allParcels = useParcels();
  const parcels = useMemo(() => allParcels.filter((p) => p.farm_id === farmId), [allParcels, farmId]);
  const selectedUnit = getUnitOption(unitId);
  const selectedFarm = farms.find((f) => f.id === farmId);
  const lots = useStore((s) => s.lots);

  // Auto-suggest kg when factor known
  const suggestedKg = useMemo(() => {
    const q = Number(qtyOriginal);
    if (!q || q <= 0) return null;
    const f = factor ? Number(factor) : selectedUnit?.kg_factor;
    if (!f || !Number.isFinite(f)) return null;
    return Math.round(q * f * 100) / 100;
  }, [qtyOriginal, factor, selectedUnit]);

  const currentKg = pendingWeight
    ? null
    : qtyKg
      ? Number(qtyKg)
      : suggestedKg;

  function validateStep(): boolean {
    setErrors({});
    if (step === 1) {
      const r = originSchema.safeParse({
        farm_id: farmId,
        variety,
        harvest_date: harvestDate,
        parcel_id: parcelId || null,
        producer_name: producer,
        region,
        altitude_m: altitude,
        picker_or_team: team,
        notes: obs1,
      });
      if (!r.success) {
        setErrors(zodErrors(r.error));
        return false;
      }
    }
    if (step === 2) {
      const r = quantitySchema.safeParse({
        qty_original: qtyOriginal,
        uom_original_id: unitId,
        qty_kg: qtyKg,
        conversion_factor_to_kg: factor,
        pending_weight: pendingWeight,
      });
      if (!r.success) {
        setErrors(zodErrors(r.error));
        return false;
      }
    }
    if (step === 4 && lotChoice === "new") {
      const errs: Record<string, string> = {};
      if (!lotName.trim()) errs.lotName = "Ponele un nombre amigable al lote";
      if (!processOpt) errs.processOpt = "Elegí un proceso inicial";
      if (Object.keys(errs).length) {
        setErrors(errs);
        return false;
      }
    }
    if (step === 4 && lotChoice === "existing" && !existingLotId) {
      setErrors({ existingLotId: "Elegí un lote existente" });
      return false;
    }
    return true;
  }

  function next() {
    if (validateStep()) setStep((s) => Math.min(4, s + 1));
  }
  function back() {
    setStep((s) => Math.max(1, s - 1));
  }

  function submit() {
    if (!validateStep()) return;

    const factorNum = factor ? Number(factor) : selectedUnit?.kg_factor ?? null;
    const kg = pendingWeight
      ? null
      : qtyKg
        ? Number(qtyKg)
        : suggestedKg;

    const ticket = createHarvestTicket({
      kind,
      farm_id: farmId,
      parcel_id: parcelId || null,
      producer_name: producer || null,
      harvest_date: harvestDate,
      intake_datetime: new Date().toISOString(),
      picker_or_team: team || null,
      variety,
      qty_original: Number(qtyOriginal),
      uom_original_id: unitId,
      qty_kg: kg,
      conversion_factor_to_kg: kg != null ? factorNum : null,
      conversion_basis: kg == null ? "pending" : factor ? "configured" : selectedUnit?.kg_factor ? "configured" : "estimated",
      maturity_level: maturity || null,
      impurity_level: impurity || null,
      green_pct: greenPct ? Number(greenPct) : null,
      overripe_pct: overripePct ? Number(overripePct) : null,
      notes: [obs1, obs3].filter(Boolean).join(" — ") || null,
      photo_url: null,
      created_by: null,
    });

    let createdLotCode: string | null = null;

    if (lotChoice === "new") {
      const opt = PROCESS_OPTIONS.find((o) => o.value === processOpt)!;
      const lot = createLot({
        friendly_name: lotName.trim(),
        variety,
        process_type: opt.storedAs as ProcessType,
        farm_id: farmId,
        parcel_id: parcelId || null,
        region: region || selectedFarm?.region || null,
        altitude_m: altitude ? Number(altitude) : selectedFarm?.altitude_m ?? null,
        producer_name: producer || selectedFarm?.owner_name || null,
        harvest_ticket_id: ticket.id,
        qty_initial_kg: kg ?? 0,
        current_location: location || null,
      });
      createdLotCode = lot.lot_code;
    } else if (lotChoice === "existing") {
      createdLotCode = lots.find((l) => l.id === existingLotId)?.lot_code ?? null;
    }

    if (responsible) {
      // placeholder for future audit field
    }

    const verb = kind === "harvest" ? "la cosecha" : "el recibo";
    toast.success(
      createdLotCode
        ? `Listo. Se registró ${verb} y se ${lotChoice === "new" ? "creó" : "vinculó"} el lote ${createdLotCode}.`
        : `Listo. Se registró ${verb} como ticket.`,
    );

    navigate({ to: kind === "harvest" ? "/harvest" : "/intake" });
  }

  // ───────── render ─────────
  return (
    <div>
      {/* Stepper */}
      <ol className="flex items-center gap-2 mb-8">
        {stepsConfig.map((s, i) => {
          const active = step === s.key;
          const done = step > s.key;
          return (
            <li key={s.key} className="flex-1 min-w-0">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2",
                  active ? "bg-primary text-primary-foreground" : done ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground",
                )}
              >
                <s.icon className="h-4 w-4 shrink-0" />
                <span className="text-xs font-semibold truncate hidden sm:inline">
                  {i + 1}. {s.label}
                </span>
                <span className="text-xs font-semibold sm:hidden">{i + 1}</span>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-soft space-y-5">
        {step === 1 && (
          <>
            <SectionHeading title="Origen" hint="¿De dónde viene este café?" />
            <Field label="Finca *" error={errors.farm_id}>
              <Select value={farmId} onValueChange={setFarmId}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Seleccionar finca" />
                </SelectTrigger>
                <SelectContent>
                  {farms.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Parcela">
              <Select value={parcelId || undefined} onValueChange={setParcelId} disabled={!farmId}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder={farmId ? "Seleccionar parcela" : "Elegí una finca primero"} />
                </SelectTrigger>
                <SelectContent>
                  {parcels.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Productor">
                <Input value={producer} onChange={(e) => setProducer(e.target.value)} maxLength={120} className="h-11 rounded-xl" />
              </Field>
              <Field label="Región">
                <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder={selectedFarm?.region ?? ""} maxLength={120} className="h-11 rounded-xl" />
              </Field>
              <Field label="Altura (msnm)">
                <Input type="number" min={0} value={altitude} onChange={(e) => setAltitude(e.target.value)} placeholder={selectedFarm?.altitude_m?.toString() ?? ""} className="h-11 rounded-xl" />
              </Field>
              <Field label="Variedad *" error={errors.variety}>
                <Input value={variety} onChange={(e) => setVariety(e.target.value)} placeholder="Geisha, Catuaí, Caturra..." maxLength={60} className="h-11 rounded-xl" />
              </Field>
              <Field label="Fecha de cosecha *" error={errors.harvest_date}>
                <Input type="date" value={harvestDate} onChange={(e) => setHarvestDate(e.target.value)} className="h-11 rounded-xl" />
              </Field>
              <Field label="Cuadrilla o recolector">
                <Input value={team} onChange={(e) => setTeam(e.target.value)} maxLength={120} className="h-11 rounded-xl" />
              </Field>
            </div>

            <Field label="Observaciones">
              <Textarea value={obs1} onChange={(e) => setObs1(e.target.value)} maxLength={1000} className="rounded-xl" rows={3} />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <SectionHeading title="Cantidad" hint="Anotamos siempre la unidad original. El kg lo confirmás cuando lo tengás." />
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Cantidad *" error={errors.qty_original}>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={qtyOriginal}
                  onChange={(e) => setQtyOriginal(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </Field>
              <Field label="Unidad *" error={errors.uom_original_id}>
                <Select value={unitId} onValueChange={setUnitId}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="Seleccionar unidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.label}
                        {u.configurable && " ·  configurable"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {selectedUnit && selectedUnit.kg_factor == null && !factor && (
              <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/15 p-3 text-sm text-warning-foreground">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <p>
                  La unidad <strong>{selectedUnit.label}</strong> no tiene factor de conversión configurado.
                  Podés ingresar el peso en kg directamente o marcarlo como pendiente.
                </p>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <Field
                label="Peso neto en kg (opcional)"
                hint={suggestedKg != null && !pendingWeight ? `Sugerido: ${suggestedKg} kg` : undefined}
                error={errors.qty_kg}
              >
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={qtyKg}
                  onChange={(e) => setQtyKg(e.target.value)}
                  disabled={pendingWeight}
                  placeholder={suggestedKg != null ? String(suggestedKg) : ""}
                  className="h-11 rounded-xl"
                />
              </Field>
              <Field label="Factor de conversión usado (opcional)">
                <Input
                  type="number"
                  min={0}
                  step="0.001"
                  value={factor}
                  onChange={(e) => setFactor(e.target.value)}
                  disabled={pendingWeight}
                  placeholder={selectedUnit?.kg_factor != null ? `Por defecto: ${selectedUnit.kg_factor}` : "kg por unidad"}
                  className="h-11 rounded-xl"
                />
              </Field>
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-border p-3 cursor-pointer hover:bg-secondary/50">
              <Checkbox
                checked={pendingWeight}
                onCheckedChange={(v) => setPendingWeight(v === true)}
                className="mt-0.5"
              />
              <div className="text-sm">
                <p className="font-medium text-foreground">Peso pendiente de confirmar</p>
                <p className="text-muted-foreground">
                  Continuamos sin kg. Lo confirmás más tarde cuando lo pesés.
                </p>
              </div>
            </label>

            {pendingWeight && (
              <div className="flex items-start gap-2 rounded-xl bg-secondary/60 p-3 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4 mt-0.5 text-warning" />
                <p>Peso en kg pendiente. Podés continuar y confirmarlo después.</p>
              </div>
            )}

            {currentKg != null && !pendingWeight && (
              <div className="flex items-center gap-2 rounded-xl bg-success/15 p-3 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" />
                <p>Se registrarán <strong>{currentKg} kg</strong> equivalentes.</p>
              </div>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <SectionHeading title="Calidad rápida" hint="Una evaluación corta a ojo. Después se afina en catación." />
            <Field label="Madurez">
              <Select value={maturity} onValueChange={setMaturity}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {MATURITY_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Impurezas">
              <Select value={impurity} onValueChange={setImpurity}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {IMPURITY_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="% verde">
                <Input type="number" min={0} max={100} step="0.1" value={greenPct} onChange={(e) => setGreenPct(e.target.value)} className="h-11 rounded-xl" />
              </Field>
              <Field label="% sobremaduro">
                <Input type="number" min={0} max={100} step="0.1" value={overripePct} onChange={(e) => setOverripePct(e.target.value)} className="h-11 rounded-xl" />
              </Field>
            </div>
            <Field label="Foto (opcional)">
              <Input type="file" accept="image/*" className="h-11 rounded-xl" />
            </Field>
            <Field label="Observaciones">
              <Textarea value={obs3} onChange={(e) => setObs3(e.target.value)} maxLength={1000} rows={3} className="rounded-xl" />
            </Field>
          </>
        )}

        {step === 4 && (
          <>
            <SectionHeading title="Crear lote" hint="¿Cómo seguimos con este café?" />
            <RadioGroup value={lotChoice} onValueChange={(v) => setLotChoice(v as typeof lotChoice)} className="space-y-2">
              <RadioOption value="new" label="Crear lote nuevo" desc="Empezamos un lote desde este recibo." />
              <RadioOption value="existing" label="Agrupar con lote existente" desc="Sumamos este café a un lote ya creado." />
              <RadioOption value="ticket_only" label="Guardar solo como ticket" desc="Por ahora no creamos lote." />
            </RadioGroup>

            {lotChoice === "new" && (
              <div className="space-y-4 pt-2">
                <Field label="Nombre amigable *" error={errors.lotName}>
                  <Input value={lotName} onChange={(e) => setLotName(e.target.value)} placeholder="Ej. Geisha Natural Mayo" maxLength={80} className="h-11 rounded-xl" />
                </Field>
                <Field label="Proceso inicial *" error={errors.processOpt}>
                  <Select value={processOpt} onValueChange={setProcessOpt}>
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Seleccionar proceso" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROCESS_OPTIONS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Ubicación inicial">
                    <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Patio 2, Tanque 1..." className="h-11 rounded-xl" />
                  </Field>
                  <Field label="Responsable">
                    <Input value={responsible} onChange={(e) => setResponsible(e.target.value)} className="h-11 rounded-xl" />
                  </Field>
                </div>
                <p className="text-xs text-muted-foreground">
                  El código del lote se genera automáticamente al guardar (ej. NAT-2026-001).
                </p>
              </div>
            )}

            {lotChoice === "existing" && (
              <Field label="Lote existente *" error={errors.existingLotId}>
                <Select value={existingLotId} onValueChange={setExistingLotId}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="Seleccionar lote" />
                  </SelectTrigger>
                  <SelectContent>
                    {lots.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.lot_code} · {l.friendly_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </>
        )}
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between gap-3 mt-6 pb-4">
        <Button
          variant="outline"
          onClick={step === 1 ? () => navigate({ to: kind === "harvest" ? "/harvest" : "/intake" }) : back}
          className="h-12 rounded-xl"
        >
          <ArrowLeft className="h-4 w-4" /> {step === 1 ? "Cancelar" : "Atrás"}
        </Button>
        {step < 4 ? (
          <Button onClick={next} className="h-12 rounded-xl">
            Siguiente <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={submit} className="h-12 rounded-xl">
            Guardar
          </Button>
        )}
      </div>
    </div>
  );
}

// ───────── helpers ─────────

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function RadioOption({ value, label, desc }: { value: string; label: string; desc: string }) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-border p-3 cursor-pointer hover:bg-secondary/50">
      <RadioGroupItem value={value} className="mt-0.5" />
      <div className="text-sm">
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-muted-foreground">{desc}</p>
      </div>
    </label>
  );
}

function zodErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
