import { useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  elapsedMinutes,
  finishPhase,
  logMoisture,
  logVariable,
  logWaste,
  raiseAlert,
  timeStatus,
  useStore,
  validatePhaseTransition,
} from "@/lib/store";
import type { Lot, ProcessPhaseInstance } from "@/types/domain";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lot: Lot;
  phase: ProcessPhaseInstance;
  nextPhaseName?: string | null;
}

function fmtMinutes(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h < 24) return r ? `${h} h ${r} min` : `${h} h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d} d ${rh} h` : `${d} d`;
}

const finishSchema = z.object({
  moisture: z.string().optional(),
  weight: z.string().optional(),
  waste: z.string().optional(),
  notes: z.string().trim().max(500).optional(),
  override_reason: z.string().trim().max(500).optional(),
});

export function FinishPhaseDialog({ open, onOpenChange, lot, phase, nextPhaseName }: Props) {
  const definitions = useStore((s) => s.variableDefinitions);
  const variableLogs = useStore((s) => s.variableLogs);

  const requiredVars = useMemo(
    () => definitions.filter((d) => d.phase_associations.includes(phase.name) && d.alert_if_missing),
    [definitions, phase.name],
  );
  const missingRequired = useMemo(
    () =>
      requiredVars.filter(
        (d) => !variableLogs.some((l) => l.variable_id === d.id && l.phase_instance_id === phase.id),
      ),
    [requiredVars, variableLogs, phase.id],
  );

  const elapsed = elapsedMinutes(phase);
  const expected = phase.expected_minutes ?? 0;
  const status = timeStatus(phase);
  const isDryingPhase = /secado/i.test(phase.name);

  const [moisture, setMoisture] = useState("");
  const [weight, setWeight] = useState("");
  const [waste, setWaste] = useState("");
  const [notes, setNotes] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideAcknowledged, setOverrideAcknowledged] = useState(false);

  const transition = useMemo(() => validatePhaseTransition(phase.id), [phase.id]);
  const dryingNeedsMoisture = isDryingPhase && !moisture && lot.current_moisture == null;
  const blockingMissing = missingRequired.length > 0;
  const needsOverride = blockingMissing || dryingNeedsMoisture;

  const handleFinish = () => {
    const parsed = finishSchema.safeParse({ moisture, weight, waste, notes, override_reason: overrideReason });
    if (!parsed.success) {
      toast.error("Revisá los datos");
      return;
    }
    if (needsOverride && !overrideReason.trim()) {
      toast.error("Indica una justificación para finalizar igual.");
      return;
    }

    // Optional captures first
    if (parsed.data.moisture) {
      const m = Number(parsed.data.moisture);
      if (!Number.isNaN(m) && m >= 0 && m <= 40) {
        logMoisture({ lot_id: lot.id, moisture_pct: m, notes: "Capturado al cerrar fase" });
      }
    }
    if (parsed.data.weight) {
      const wDef = definitions.find((d) => d.id === "v-peso");
      const w = Number(parsed.data.weight);
      if (wDef && !Number.isNaN(w) && w >= 0) {
        logVariable({
          variable_id: wDef.id,
          lot_id: lot.id,
          phase_instance_id: phase.id,
          value_number: w,
          notes: "Capturado al cerrar fase",
        });
      }
    }
    if (parsed.data.waste) {
      const wq = Number(parsed.data.waste);
      if (!Number.isNaN(wq) && wq > 0 && wq <= lot.qty_current_kg) {
        logWaste({
          lot_id: lot.id,
          qty_kg: wq,
          reason: `Cierre fase ${phase.name}`,
          phase_instance_id: phase.id,
        });
      }
    }

    finishPhase({
      phase_id: phase.id,
      lot_id: lot.id,
      notes: parsed.data.notes ?? null,
      override_reason: needsOverride ? overrideReason.trim() : null,
    });

    if (status === "overdue") {
      raiseAlert({
        lot_id: lot.id,
        phase_instance_id: phase.id,
        threshold_key: `phase:closed_overdue:${phase.id}`,
        severity: "warning",
        title: `${phase.name} cerrada fuera de tiempo`,
        message: `${lot.lot_code}: real ${elapsed} min vs. esperado ${expected} min.`,
      });
      toast.warning("Fase finalizada fuera del tiempo esperado");
    } else {
      toast.success("Fase finalizada");
    }
    setMoisture(""); setWeight(""); setWaste(""); setNotes(""); setOverrideReason(""); setOverrideAcknowledged(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
        <DialogHeader>
          <DialogTitle>Finalizar fase</DialogTitle>
          <DialogDescription>
            Confirma los datos antes de cerrar esta fase.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Phase summary */}
          <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Fase actual</span>
              <span className="font-semibold">{phase.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Próxima fase</span>
              <span className="font-medium">{nextPhaseName ?? transition.next_phase_name ?? "Por definir"}</span>
            </div>
            {transition.warnings.map((w) => (
              <p key={w} className="text-[11px] text-warning-foreground mt-1">{w}</p>
            ))}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Duración real</span>
              <span className="font-medium">{fmtMinutes(elapsed)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Duración esperada</span>
              <span className="font-medium">{expected ? fmtMinutes(expected) : "—"}</span>
            </div>
            <div className="mt-2">
              {status === "overdue" ? (
                <Badge variant="destructive"><Clock className="h-3 w-3 mr-1" /> Fuera de tiempo</Badge>
              ) : status === "near" ? (
                <Badge className="bg-warning text-warning-foreground"><Clock className="h-3 w-3 mr-1" /> Cerca del límite</Badge>
              ) : (
                <Badge variant="secondary"><CheckCircle2 className="h-3 w-3 mr-1" /> A tiempo</Badge>
              )}
            </div>
          </div>

          {/* Warnings */}
          {missingRequired.length > 0 && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <div className="flex items-center gap-2 font-semibold text-destructive">
                <ShieldAlert className="h-4 w-4" /> Faltan variables requeridas
              </div>
              <ul className="mt-1 ml-6 list-disc text-destructive/90">
                {missingRequired.map((d) => (
                  <li key={d.id}>{d.name}</li>
                ))}
              </ul>
            </div>
          )}

          {dryingNeedsMoisture && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4 text-warning-foreground" /> Sin humedad final
              </div>
              <p className="mt-1 text-foreground/80">
                Cerrar el secado sin medir humedad final puede comprometer la calidad. Registra el valor abajo.
              </p>
            </div>
          )}

          {/* Optional captures */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Humedad % {dryingNeedsMoisture && <span className="text-destructive">*</span>}</Label>
              <Input type="number" inputMode="decimal" value={moisture} onChange={(e) => setMoisture(e.target.value)} placeholder="—" />
            </div>
            <div className="space-y-1.5">
              <Label>Peso (kg)</Label>
              <Input type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="—" />
            </div>
            <div className="space-y-1.5">
              <Label>Merma (kg)</Label>
              <Input type="number" inputMode="decimal" value={waste} onChange={(e) => setWaste(e.target.value)} placeholder="—" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Observación</Label>
              <Textarea rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          {needsOverride && (
            <div className="rounded-xl border border-border bg-card p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm">Finalizar igual con justificación</Label>
                <Switch checked={overrideAcknowledged} onCheckedChange={setOverrideAcknowledged} />
              </div>
              {overrideAcknowledged && (
                <Textarea
                  rows={2}
                  maxLength={500}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Motivo de la excepción (queda en bitácora)"
                />
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleFinish}
            disabled={needsOverride && (!overrideAcknowledged || !overrideReason.trim())}
            variant={status === "overdue" ? "destructive" : "default"}
          >
            Finalizar fase
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
